from __future__ import annotations

import logging
import re
import threading
from collections.abc import Callable
from pathlib import Path

from music_downloader_app.models import DownloadQueueItem, QueueSnapshot, SearchResult, SettingsData
from music_downloader_app.services.musicbrainz import MusicMetadataService
from music_downloader_app.services.youtube import DownloadCanceledError, YouTubeService, safe_name

LOGGER = logging.getLogger(__name__)

QueueListener = Callable[[QueueSnapshot], None]


_SKIP_RELEASE_WORDS = (
    "soundtrack",
    "original television soundtrack",
    "original motion picture soundtrack",
    "ost",
    "live",
    "concert",
    "karaoke",
    "instrumental",
    "remix",
    "dj mix",
    "commentary",
)

_SUSPICIOUS_RELEASE_WORDS = (
    "cover",
    "covers",
    "unreleased",
    "unreleased track",
    "demo",
    "bootleg",
)


def _normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def clean_track_title(title: str, artist_name: str | None = None) -> str:
    value = str(title or "").strip()
    artist = str(artist_name or "").strip()

    if artist and " - " in value:
        left, right = value.split(" - ", 1)
        left_norm = _normalized(left)
        artist_norm = _normalized(artist.split(",")[0])
        if artist_norm and (left_norm == artist_norm or left_norm in artist_norm or artist_norm in left_norm):
            value = right.strip()

    if artist:
        artist_norm = _normalized(artist.split(",")[0])
        value_norm = _normalized(value)
        if artist_norm and value_norm.startswith(artist_norm):
            value = re.sub(re.escape(artist.split(",")[0]), "", value, count=1, flags=re.IGNORECASE).strip(" -:|/")

    cleanup_patterns = [
        r"\s*\((official|lyrics?|audio|video|visualizer|from .*?|.*?cover.*?)\)\s*$",
        r"\s*\[(official|lyrics?|audio|video|visualizer|from .*?|.*?cover.*?)\]\s*$",
        r"\s+-\s+(official|lyrics?|audio|video|visualizer).*?$",
    ]
    changed = True
    while changed:
        changed = False
        for pattern in cleanup_patterns:
            new_value = re.sub(pattern, "", value, flags=re.IGNORECASE).strip()
            if new_value != value:
                value = new_value
                changed = True

    value = re.sub(r"\s+", " ", value).strip(" -:|/")
    return value or str(title or "Unknown title").strip() or "Unknown title"


class DownloadService:
    """Manage the background download queue."""

    def __init__(
        self,
        metadata_service: MusicMetadataService,
        youtube_service: YouTubeService,
        settings: SettingsData,
        listener: QueueListener | None = None,
    ) -> None:
        self.metadata_service = metadata_service
        self.youtube_service = youtube_service
        self.settings = settings
        self.listener = listener
        self.items: list[DownloadQueueItem] = []
        self.active_item_id: str | None = None
        self.paused = False
        self._pause_condition = threading.Condition()
        self._cancel_events: dict[str, threading.Event] = {}
        self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker_thread.start()

    def update_settings(self, settings: SettingsData) -> None:
        """Update download-related settings used by the queue."""
        self.settings = settings

    def _media_format_for_item(self, item: DownloadQueueItem) -> str:
        """Return the format requested by the menu that queued this item.

        Music search results are always downloaded as MP3. Video search results are
        always downloaded as MP4. This keeps the two menus independent from a
        global setting and allows mixed music/video queues.
        """
        if item.source.result_type == "Video":
            return "mp4"
        requested = item.source.raw_data.get("_media_format") or item.source.raw_data.get("media_format")
        if requested in {"mp3", "mp4"}:
            return str(requested)
        return "mp3"

    def _video_quality_for_item(self, item: DownloadQueueItem) -> str:
        return str(item.source.raw_data.get("_video_quality") or self.settings.video_quality or "best")

    def _is_allowed_download_key(self, item: DownloadQueueItem, *keys: str) -> bool:
        allowed = item.source.raw_data.get("_allowed_download_keys")
        if not allowed:
            return True
        allowed_set = {str(value) for value in allowed}
        return any(key in allowed_set for key in keys if key)

    def add_results(self, results: list[SearchResult]) -> None:
        """Enqueue selected search results."""
        for result in results:
            item = DownloadQueueItem(
                source=result,
                destination_folder=self.settings.download_folder,
                status="queued",
                status_message="Queued",
            )
            self.items.append(item)
            self._cancel_events[item.id] = threading.Event()
        self._emit_snapshot()

    def pause_queue(self) -> None:
        """Pause the queue after the current blocking section yields."""
        self.paused = True
        active = self._find_active_item()
        if active and active.status == "downloading":
            active.status_message = "Finishing current step before pause"
        self._emit_snapshot()

    def resume_queue(self) -> None:
        """Resume processing queued items."""
        with self._pause_condition:
            self.paused = False
            active = self._find_active_item()
            if active and active.status == "paused":
                active.status = "downloading"
                active.status_message = "Resuming"
            self._pause_condition.notify_all()
        self._emit_snapshot()

    def cancel_item(self, item_id: str) -> None:
        """Cancel one queued or active item."""
        item = self._find_item(item_id)
        if not item:
            return

        item.cancel_requested = True
        event = self._cancel_events.get(item_id)
        if event:
            event.set()

        if item.status in {"queued", "waiting", "paused"}:
            item.status = "canceled"
            item.status_message = "Canceled"
            item.detail_message = "Removed from queue."
        elif item.status == "downloading":
            item.status_message = "Canceling"
            item.detail_message = "The current conversion will stop when yt-dlp/ffmpeg returns control."

        with self._pause_condition:
            self._pause_condition.notify_all()

        self._emit_snapshot()

    def cancel_all(self) -> None:
        """Cancel every item that is not already finished."""
        for item in self.items:
            if item.status in {"completed", "failed", "canceled"}:
                continue

            item.cancel_requested = True
            event = self._cancel_events.get(item.id)
            if event:
                event.set()

            if item.status in {"queued", "waiting", "paused"}:
                item.status = "canceled"
                item.status_message = "Canceled"
                item.detail_message = "Removed from queue."
            elif item.status == "downloading":
                item.status_message = "Canceling"
                item.detail_message = "Stopping after the current yt-dlp/ffmpeg step."

        with self._pause_condition:
            self.paused = False
            self._pause_condition.notify_all()

        self._emit_snapshot()

    def get_snapshot(self) -> QueueSnapshot:
        """Return a current queue snapshot."""
        finished = sum(1 for item in self.items if item.status in {"completed", "failed", "canceled"})
        total = len(self.items)
        overall_progress = (finished / total) * 100 if total else 0.0
        message = "No downloads yet."
        if total:
            message = f"{finished} of {total} item{'s' if total != 1 else ''} finished."
        return QueueSnapshot(
            items=[self._clone_item(item) for item in self.items],
            active_item_id=self.active_item_id,
            paused=self.paused,
            overall_progress=overall_progress,
            summary_message=message,
        )

    def _emit_snapshot(self) -> None:
        if self.listener:
            self.listener(self.get_snapshot())

    def _worker_loop(self) -> None:
        while True:
            item = self._next_pending_item()
            if not item:
                with self._pause_condition:
                    self._pause_condition.wait(timeout=0.3)
                continue

            self._wait_if_paused(item)
            if item.cancel_requested:
                self._mark_canceled(item, "Canceled before download started.")
                continue

            self.active_item_id = item.id
            item.status = "downloading"
            item.status_message = "Starting download"
            self._emit_snapshot()

            try:
                self._process_item(item)
                if item.cancel_requested:
                    self._mark_canceled(item, "Download canceled.")
                else:
                    item.status = "completed"
                    item.progress = 100.0
                    item.status_message = "Completed"
                    item.detail_message = f"Saved {len(item.output_paths)} file(s)."
            except DownloadCanceledError:
                self._mark_canceled(item, "Partial files were removed.")
            except Exception as exc:
                LOGGER.exception("Queue item failed: %s", exc)
                if item.cancel_requested:
                    self._mark_canceled(item, "Download canceled.")
                else:
                    item.status = "failed"
                    item.status_message = "Failed"
                    item.error_message = "The download could not be completed."
                    item.detail_message = str(exc)
            finally:
                self.active_item_id = None
                self._emit_snapshot()

    def _mark_canceled(self, item: DownloadQueueItem, detail: str) -> None:
        item.status = "canceled"
        item.status_message = "Canceled"
        item.detail_message = detail
        self._emit_snapshot()

    def _wait_if_paused(self, item: DownloadQueueItem) -> None:
        with self._pause_condition:
            while self.paused and not item.cancel_requested:
                item.status = "paused"
                item.status_message = "Queue paused"
                self._emit_snapshot()
                self._pause_condition.wait(timeout=0.3)
            if item.status == "paused":
                item.status = "downloading"

    def _next_pending_item(self) -> DownloadQueueItem | None:
        for item in self.items:
            if item.cancel_requested:
                continue
            if item.status in {"queued", "waiting", "paused"}:
                return item
        return None

    def _find_item(self, item_id: str) -> DownloadQueueItem | None:
        for item in self.items:
            if item.id == item_id:
                return item
        return None

    def _find_active_item(self) -> DownloadQueueItem | None:
        if not self.active_item_id:
            return None
        return self._find_item(self.active_item_id)

    def _clone_item(self, item: DownloadQueueItem) -> DownloadQueueItem:
        return DownloadQueueItem(
            source=item.source,
            destination_folder=item.destination_folder,
            id=item.id,
            status=item.status,
            progress=item.progress,
            status_message=item.status_message,
            detail_message=item.detail_message,
            output_paths=list(item.output_paths),
            error_message=item.error_message,
            total_steps=item.total_steps,
            completed_steps=item.completed_steps,
            cancel_requested=item.cancel_requested,
        )

    def _process_item(self, item: DownloadQueueItem) -> None:
        result = item.source
        cancel_event = self._cancel_events[item.id]

        if result.result_type == "Artist":
            self._download_artist(item, cancel_event)
        elif result.result_type == "Album":
            self._download_album(item, cancel_event)
        elif result.result_type == "Playlist":
            self._download_playlist(item, cancel_event)
        elif result.result_type == "Video":
            self._download_video(item, cancel_event)
        else:
            self._download_song(item, cancel_event)

    def _download_artist(self, item: DownloadQueueItem, cancel_event: threading.Event) -> None:
        artist = item.source.raw_data
        artist_name = artist.get("name", item.source.title)

        include_suspicious = bool(item.source.raw_data.get("_include_suspicious_releases"))
        releases: list[dict] = []
        for release_type in ("album", "ep", "single"):
            for release in self.metadata_service.get_release_groups_for_artist(artist["id"], release_type):
                release = dict(release)
                release["_requested_type"] = release_type
                if not self._should_skip_release(release, include_suspicious=include_suspicious):
                    releases.append(release)

        releases.sort(key=lambda release: (
            {"album": 0, "ep": 1, "single": 2}.get(release.get("_requested_type"), 9),
            release.get("first-release-date", ""),
            release.get("title", ""),
        ))

        youtube_covers = self._selected_youtube_covers(item)
        item.total_steps = max(len(releases) + len(youtube_covers), 1)
        item.completed_steps = 0
        seen_tracks: set[str] = set()

        for release in releases:
            self._check_canceled(item)

            release_type = release.get("_requested_type")
            if release_type in {"album", "ep"}:
                downloaded_keys = self._download_album_data(
                    item,
                    release,
                    artist_name,
                    cancel_event,
                    seen_tracks=seen_tracks,
                    release_step=item.completed_steps,
                    release_total=item.total_steps,
                )
                seen_tracks.update(downloaded_keys)
            elif release_type == "single":
                raw_title = release.get("title", "Unknown Single")
                title = clean_track_title(raw_title, artist_name)
                track_key = self._track_key(title)
                release_id = release.get("id", "")
                if not self._is_allowed_download_key(
                    item,
                    f"release:{release_id}:track:{track_key}",
                    f"single:{release_id}",
                    f"track:{track_key}",
                ):
                    item.detail_message = f"Skipped by user: {title}"
                    self._emit_snapshot()
                elif track_key in seen_tracks:
                    item.detail_message = f"Skipped duplicate single: {title}"
                    self._emit_snapshot()
                else:
                    self._download_single_release(item, release, artist_name, cancel_event)
                    seen_tracks.add(track_key)

            item.completed_steps += 1
            item.progress = (item.completed_steps / item.total_steps) * 100
            item.detail_message = f"Processed {item.completed_steps} of {item.total_steps} items."
            self._emit_snapshot()

        for cover in youtube_covers:
            self._check_canceled(item)
            self._download_youtube_cover(item, cover, artist_name, cancel_event)
            item.completed_steps += 1
            item.progress = (item.completed_steps / item.total_steps) * 100
            self._emit_snapshot()

    def _download_single_release(
        self,
        item: DownloadQueueItem,
        single: dict,
        artist_name: str,
        cancel_event: threading.Event,
    ) -> None:
        raw_title = single.get("title", "Unknown Single")
        title = clean_track_title(raw_title, artist_name)
        folder = self.settings.download_folder / safe_name(artist_name) / "Singles"
        item.status_message = f"Downloading {self._media_format_for_item(item).upper()} single"
        item.detail_message = f"Single: {title}"
        self._emit_snapshot()

        cover_url = None
        release_group_id = single.get("id")
        if release_group_id:
            cover_url = self.metadata_service.get_cover_url(release_group_id)

        release_id = single.get("id", "")
        track_key = self._track_key(title)
        if not self._is_allowed_download_key(
            item,
            f"release:{release_id}:track:{track_key}",
            f"single:{release_id}",
            f"track:{track_key}",
        ):
            item.detail_message = f"Skipped by user: {title}"
            self._emit_snapshot()
            return

        output_path = self.youtube_service.download_media(
            query=self._track_search_query(artist_name, title),
            output_no_ext=self._unique_output_no_ext(folder, title, self._media_format_for_item(item)),
            quality=self.settings.mp3_quality,
            media_format=self._media_format_for_item(item),
            video_quality=self._video_quality_for_item(item),
            cover_url=cover_url,
            metadata=self._mp3_metadata(
                title=title,
                artist_name=artist_name,
                album_title=single.get("title"),
                album_artist=artist_name,
                date=single.get("first-release-date"),
                musicbrainz_release_group_id=single.get("id"),
            ),
            expected_title=title,
            expected_artist=artist_name,
            progress_callback=lambda progress, message: self._update_item_progress(
                item, progress, f"{title}: {message}"
            ),
            cancel_event=cancel_event,
        )
        item.output_paths.append(output_path)

    def _download_album(self, item: DownloadQueueItem, cancel_event: threading.Event) -> None:
        album = item.source.raw_data
        artist_name = item.source.artist_name or "Unknown Artist"
        if self._should_skip_release(album, include_suspicious=bool(item.source.raw_data.get("_include_suspicious_releases"))):
            item.detail_message = f"Skipped release by filter: {album.get('title', item.source.title)}"
            self._emit_snapshot()
            return
        self._download_album_data(item, album, artist_name, cancel_event, seen_tracks=set())

    def _download_album_data(
        self,
        item: DownloadQueueItem,
        album: dict,
        artist_name: str,
        cancel_event: threading.Event,
        seen_tracks: set[str] | None = None,
        release_step: int | None = None,
        release_total: int | None = None,
    ) -> set[str]:
        album_title = album.get("title", item.source.title)
        tracks = self.metadata_service.get_tracks_from_release_group(album["id"])
        if not tracks:
            item.detail_message = f"Skipped empty release: {album_title}"
            self._emit_snapshot()
            return set()

        folder = self.settings.download_folder / safe_name(artist_name) / safe_name(album_title)
        item.status_message = "Finding album cover"
        item.detail_message = f"Album: {album_title}"
        self._emit_snapshot()
        cover_url = self.metadata_service.get_album_cover_url(
            album_title=album_title,
            artist_name=artist_name,
            release_group_id=album.get("id"),
        )
        if not cover_url:
            # Do not use the first YouTube track thumbnail as an album cover.
            # It can be wrong and then every song in the album gets that image.
            item.detail_message = f"No reliable album cover found for: {album_title}"
            self._emit_snapshot()

        if release_total is None:
            item.total_steps = max(len(tracks), 1)
            item.completed_steps = 0

        downloaded_keys: set[str] = set()
        seen_tracks = seen_tracks or set()
        used_youtube_urls: set[str] = set()

        for index, track in enumerate(tracks, start=1):
            self._check_canceled(item)
            raw_track_title = track["title"]
            track_title = clean_track_title(raw_track_title, artist_name)
            track_key = self._track_key(track_title)
            release_id = album.get("id", "")

            if not self._is_allowed_download_key(
                item,
                f"release:{release_id}:track:{track_key}",
                f"track:{track_key}",
            ):
                item.detail_message = f"Skipped by user: {track_title}"
                self._emit_snapshot()
                continue

            if track_key in seen_tracks:
                item.detail_message = f"Skipped duplicate: {track_title}"
                self._emit_snapshot()
                continue

            item.status_message = f"Downloading {self._media_format_for_item(item).upper()} track {index} of {len(tracks)}"
            item.detail_message = f"Track: {track_title}"
            self._emit_snapshot()

            length_ms = track.get("length_ms") or 0
            expected_duration_seconds = int(length_ms / 1000) if isinstance(length_ms, (int, float)) and length_ms else None

            output_path = self.youtube_service.download_media(
                query=self._track_search_query(artist_name, track_title),
                output_no_ext=self._unique_output_no_ext(folder, track_title, self._media_format_for_item(item)),
                quality=self.settings.mp3_quality,
                media_format=self._media_format_for_item(item),
                video_quality=self._video_quality_for_item(item),
                cover_url=cover_url,
                allow_youtube_thumbnail_cover=False,
                cover_overwrite=True,
                metadata=self._metadata_from_track(
                    title=track_title,
                    artist_name=artist_name,
                    album_title=album_title,
                    album=album,
                    track=track,
                    track_total=len(tracks),
                ),
                expected_title=track_title,
                expected_artist=artist_name,
                expected_album=album_title,
                expected_duration_seconds=expected_duration_seconds,
                blocked_urls=used_youtube_urls,
                progress_callback=lambda progress, message, idx=index, total=len(tracks), title=track_title, album_name=album_title, outer_step=release_step, outer_total=release_total: self._update_nested_progress(
                    item,
                    progress,
                    idx,
                    total,
                    title,
                    message,
                    album_name,
                    outer_step,
                    outer_total,
                ),
                cancel_event=cancel_event,
            )
            item.output_paths.append(output_path)
            if self.youtube_service.last_downloaded_url:
                used_youtube_urls.add(self.youtube_service.last_downloaded_url)
            downloaded_keys.add(track_key)
            seen_tracks.add(track_key)

            if release_total is None:
                item.completed_steps = index
                item.progress = (index / len(tracks)) * 100
            self._emit_snapshot()

        return downloaded_keys

    def _download_playlist(self, item: DownloadQueueItem, cancel_event: threading.Event) -> None:
        playlist = item.source.raw_data
        playlist_name = playlist.get("name", item.source.title)
        playlist_cover_url = playlist.get("cover_url")
        tracks = playlist.get("tracks", [])

        if not tracks:
            raise RuntimeError(f"No tracks found in playlist {playlist_name}.")

        folder = self.settings.download_folder / "Spotify Playlists" / safe_name(playlist_name)
        item.total_steps = max(len(tracks), 1)
        item.completed_steps = 0

        seen_tracks: set[str] = set()

        for index, track in enumerate(tracks, start=1):
            self._check_canceled(item)

            artist_name = track.get("artist_name") or "Unknown Artist"
            title = track.get("title") or "Unknown title"
            album_name = track.get("album_name") or "Unknown album"
            title = clean_track_title(title, artist_name)
            track_key = self._track_key(title)

            if track_key in seen_tracks:
                item.detail_message = f"Skipped duplicate: {artist_name} - {title}"
                self._emit_snapshot()
                continue

            seen_tracks.add(track_key)
            item.status_message = f"Downloading {self._media_format_for_item(item).upper()} playlist track {index} of {len(tracks)}"
            item.detail_message = f"Playlist: {playlist_name} - {artist_name} - {title}"
            self._emit_snapshot()

            output_path = self.youtube_service.download_media(
                query=f"{artist_name} {title} official audio",
                output_no_ext=self._unique_output_no_ext(folder, title, self._media_format_for_item(item)),
                quality=self.settings.mp3_quality,
                media_format=self._media_format_for_item(item),
                video_quality=self._video_quality_for_item(item),
                cover_url=None,
                metadata=self._mp3_metadata(
                    title=title,
                    artist_name=artist_name,
                    album_title=album_name if album_name != "Unknown album" else playlist_name,
                    album_artist=artist_name,
                    track_number=index,
                    track_total=len(tracks),
                    source="Groove playlist",
                ),
                progress_callback=lambda progress, message, idx=index, total=len(tracks), artist=artist_name, song=title: self._update_playlist_progress(
                    item,
                    progress,
                    idx,
                    total,
                    artist,
                    song,
                    message,
                ),
                cancel_event=cancel_event,
            )
            item.output_paths.append(output_path)
            item.completed_steps = index
            item.progress = (index / len(tracks)) * 100
            self._emit_snapshot()

        if playlist_cover_url and item.output_paths and not item.cancel_requested:
            item.status_message = "Downloading playlist cover"
            item.detail_message = f"Saving cover for playlist: {playlist_name}"
            self._emit_snapshot()
            self.youtube_service.save_cover_image(folder, playlist_cover_url)

    def _download_video(self, item: DownloadQueueItem, cancel_event: threading.Event) -> None:
        video = item.source.raw_data
        title = video.get("title") or item.source.title or "Untitled video"
        channel = video.get("channel") or item.source.artist_name or "Unknown channel"
        target = video.get("url") or video.get("webpage_url") or title
        folder = self.settings.download_folder / "Videos"

        item.total_steps = 1
        item.completed_steps = 0
        item.status_message = "Downloading MP4 video"
        item.detail_message = f"Video: {title} - {channel}"
        self._emit_snapshot()

        output_path = self.youtube_service.download_media(
            query=target,
            output_no_ext=folder / safe_name(title),
            quality=self.settings.mp3_quality,
            media_format="mp4",
            video_quality=self._video_quality_for_item(item),
            cover_url=None,
            progress_callback=lambda progress, message: self._update_item_progress(
                item, progress, message
            ),
            cancel_event=cancel_event,
        )
        item.output_paths.append(output_path)
        item.completed_steps = 1

    def _download_song(self, item: DownloadQueueItem, cancel_event: threading.Event) -> None:
        song = item.source.raw_data
        artist_name = item.source.artist_name or "Unknown Artist"
        title = clean_track_title(song.get("_clean_title") or song.get("title", item.source.title), artist_name)
        folder = self.settings.download_folder / safe_name(artist_name) / "Singles"

        cover_url = None
        releases = song.get("releases", [])
        if releases:
            release_group = releases[0].get("release-group") or {}
            release_group_id = release_group.get("id") or releases[0].get("id")
            if release_group_id:
                cover_url = self.metadata_service.get_cover_url(release_group_id)

        track_key = self._track_key(title)
        song_id = song.get("id") or item.source.musicbrainz_id or item.source.id
        if not self._is_allowed_download_key(
            item,
            f"song:{song_id}:track:{track_key}",
            f"track:{track_key}",
        ):
            item.detail_message = f"Skipped by user: {title}"
            self._emit_snapshot()
            return

        release_title = None
        release_date = None
        release_group_id = None
        if releases:
            first_release = releases[0] or {}
            release_title = first_release.get("title")
            release_date = first_release.get("date")
            release_group = first_release.get("release-group") or {}
            release_group_id = release_group.get("id") or first_release.get("id")

        output_path = self.youtube_service.download_media(
            query=self._track_search_query(artist_name, title),
            output_no_ext=self._unique_output_no_ext(folder, title, self._media_format_for_item(item)),
            quality=self.settings.mp3_quality,
            media_format=self._media_format_for_item(item),
            video_quality=self._video_quality_for_item(item),
            cover_url=cover_url,
            metadata=self._mp3_metadata(
                title=title,
                artist_name=artist_name,
                album_title=release_title,
                album_artist=artist_name,
                date=release_date,
                musicbrainz_release_group_id=release_group_id,
                musicbrainz_recording_id=song.get("id") or item.source.musicbrainz_id,
            ),
            expected_title=title,
            expected_artist=artist_name,
            progress_callback=lambda progress, message: self._update_item_progress(
                item, progress, message
            ),
            cancel_event=cancel_event,
        )
        item.output_paths.append(output_path)
        item.completed_steps = 1
        item.total_steps = 1

    def _selected_youtube_covers(self, item: DownloadQueueItem) -> list[dict]:
        covers = list(item.source.raw_data.get("_trusted_youtube_covers") or [])
        selected: list[dict] = []
        for cover in covers:
            video_id = str(cover.get("id") or cover.get("url") or cover.get("title") or "")
            if self._is_allowed_download_key(item, f"youtube-cover:{video_id}"):
                selected.append(cover)
        return selected

    def _download_youtube_cover(
        self,
        item: DownloadQueueItem,
        cover: dict,
        artist_name: str,
        cancel_event: threading.Event,
    ) -> None:
        title = clean_track_title(str(cover.get("title") or "Unknown cover"), artist_name)
        channel = str(cover.get("channel") or "trusted channel")
        target = cover.get("url") or cover.get("webpage_url") or f"{artist_name} {title} cover"
        folder = self.settings.download_folder / safe_name(artist_name) / "Covers"
        item.status_message = "Downloading trusted YouTube cover"
        item.detail_message = f"Cover: {title} ({channel})"
        self._emit_snapshot()
        output_path = self.youtube_service.download_media(
            query=target,
            output_no_ext=self._unique_output_no_ext(folder, title, self._media_format_for_item(item)),
            quality=self.settings.mp3_quality,
            media_format=self._media_format_for_item(item),
            video_quality=self._video_quality_for_item(item),
            cover_url=None,
            metadata=self._mp3_metadata(
                title=title,
                artist_name=artist_name,
                album_title="Covers",
                album_artist=artist_name,
                source=f"YouTube cover - {channel}",
            ),
            progress_callback=lambda progress, message: self._update_item_progress(
                item, progress, f"{title}: {message}"
            ),
            cancel_event=cancel_event,
        )
        item.output_paths.append(output_path)

    def _mp3_metadata(
        self,
        *,
        title: str,
        artist_name: str,
        album_title: str | None = None,
        album_artist: str | None = None,
        track_number: int | str | None = None,
        track_total: int | str | None = None,
        disc_number: int | str | None = None,
        disc_total: int | str | None = None,
        date: str | None = None,
        original_date: str | None = None,
        genre: str | None = "Music",
        publisher: str | None = None,
        composer: str | None = None,
        copyright_text: str | None = None,
        artist_sort: str | None = None,
        album_artist_sort: str | None = None,
        isrc: str | None = None,
        asin: str | None = None,
        catalog_number: str | None = None,
        language: str | None = None,
        media_type: str | None = None,
        release_type: str | None = None,
        musicbrainz_artist_id: str | None = None,
        musicbrainz_release_group_id: str | None = None,
        musicbrainz_release_id: str | None = None,
        musicbrainz_recording_id: str | None = None,
        release_country: str | None = None,
        release_status: str | None = None,
        barcode: str | None = None,
        source: str = "Groove",
    ) -> dict:
        """Build an MP3 metadata payload from fields available with confidence.

        The tag writer ignores empty values, so callers can pass optional
        MusicBrainz/album values without needing separate checks for every tag.
        """
        payload = {
            "title": title,
            "artist": artist_name,
            "album": album_title,
            "album_artist": album_artist or artist_name,
            "track_number": track_number,
            "track_total": track_total,
            "disc_number": disc_number,
            "disc_total": disc_total,
            "date": date,
            "original_date": original_date,
            "genre": genre,
            "publisher": publisher,
            "composer": composer,
            "copyright": copyright_text,
            "artist_sort": artist_sort,
            "album_artist_sort": album_artist_sort,
            "isrc": isrc,
            "asin": asin,
            "catalog_number": catalog_number,
            "language": language,
            "media_type": media_type,
            "release_type": release_type,
            "musicbrainz_artist_id": musicbrainz_artist_id,
            "musicbrainz_release_group_id": musicbrainz_release_group_id,
            "musicbrainz_release_id": musicbrainz_release_id,
            "musicbrainz_recording_id": musicbrainz_recording_id,
            "release_country": release_country,
            "release_status": release_status,
            "barcode": barcode,
            "source": source,
            "comment": "Downloaded and tagged by Groove.",
        }
        return {key: value for key, value in payload.items() if value not in (None, "", [])}

    def _metadata_from_track(
        self,
        *,
        title: str,
        artist_name: str,
        album_title: str,
        album: dict,
        track: dict,
        track_total: int,
    ) -> dict:
        labels = [str(value).strip() for value in (track.get("labels") or []) if str(value).strip()]
        publisher = ", ".join(labels) if labels else None
        catalog_numbers = [str(value).strip() for value in (track.get("catalog_numbers") or []) if str(value).strip()]
        release_group_secondary = track.get("release_group_secondary_types") or []
        release_types = [str(track.get("release_group_type") or "").strip(), *[str(v).strip() for v in release_group_secondary]]
        release_type = ", ".join(value for value in release_types if value)
        medium_position = track.get("medium_position")
        medium_total = track.get("medium_total")
        album_artist = track.get("album_artist") or artist_name
        track_artist = track.get("track_artist") or artist_name
        return self._mp3_metadata(
            title=title,
            artist_name=track_artist,
            album_title=album_title,
            album_artist=album_artist,
            track_number=track.get("position"),
            track_total=track.get("total_tracks") or track_total,
            disc_number=medium_position,
            disc_total=medium_total,
            date=track.get("release_date") or album.get("first-release-date"),
            original_date=album.get("first-release-date"),
            publisher=publisher,
            artist_sort=track.get("track_artist_sort"),
            album_artist_sort=track.get("album_artist_sort"),
            isrc=track.get("isrc"),
            asin=track.get("asin"),
            catalog_number=", ".join(catalog_numbers) if catalog_numbers else None,
            language=track.get("language"),
            media_type=track.get("medium_format"),
            release_type=release_type or None,
            musicbrainz_artist_id=track.get("track_artist_id") or track.get("album_artist_id"),
            musicbrainz_release_group_id=album.get("id") or track.get("release_group_id"),
            musicbrainz_release_id=track.get("release_id"),
            musicbrainz_recording_id=track.get("recording_id"),
            release_country=track.get("release_country"),
            release_status=track.get("release_status"),
            barcode=track.get("barcode"),
        )

    def _unique_output_no_ext(self, folder: Path, title: str, media_format: str) -> Path:
        folder.mkdir(parents=True, exist_ok=True)
        base = folder / safe_name(title)
        suffix = ".mp4" if media_format == "mp4" else ".mp3"
        candidate = base
        counter = 2
        while candidate.with_suffix(suffix).exists():
            candidate = folder / safe_name(f"{title} ({counter})")
            counter += 1
        return candidate

    def _update_item_progress(
        self,
        item: DownloadQueueItem,
        progress: float,
        message: str,
    ) -> None:
        item.progress = progress
        item.status_message = message
        self._emit_snapshot()

    def _update_nested_progress(
        self,
        item: DownloadQueueItem,
        track_progress: float,
        current_index: int,
        total: int,
        title: str,
        message: str,
        album_title: str,
        outer_step: int | None = None,
        outer_total: int | None = None,
    ) -> None:
        if outer_total is not None and outer_step is not None:
            overall = ((outer_step + (track_progress / 100)) / outer_total) * 100
        else:
            completed_before = current_index - 1
            overall = ((completed_before + (track_progress / 100)) / total) * 100

        item.progress = overall
        item.status_message = f"Track {current_index} of {total}"
        item.detail_message = f"{title} - {message}"
        self._emit_snapshot()

    def _update_playlist_progress(
        self,
        item: DownloadQueueItem,
        track_progress: float,
        current_index: int,
        total: int,
        artist_name: str,
        title: str,
        message: str,
    ) -> None:
        completed_before = current_index - 1
        item.progress = ((completed_before + (track_progress / 100)) / total) * 100
        item.status_message = f"Playlist track {current_index} of {total}"
        item.detail_message = f"{artist_name} - {title} - {message}"
        self._emit_snapshot()

    def _track_search_query(self, artist_name: str, track_title: str, album_title: str | None = None) -> str:
        """Build a strict YouTube search query for one specific track.

        Album downloads must not use a broad album-level result. Quoting the
        track title and keeping the artist in the query makes yt-dlp search less
        likely to return the same full-album video for every track.
        """
        artist = str(artist_name or "").strip()
        title = str(track_title or "").strip()
        album = str(album_title or "").strip()
        parts = []
        if artist:
            parts.append(f'"{artist}"')
        if title:
            parts.append(f'"{title}"')
        # Do not include the album title in the YouTube query here. For EPs and
        # albums, adding the album title often makes YouTube return the same
        # full-album/EP video for every track. The album name is still passed
        # separately for candidate scoring.
        parts.append("official audio")
        return " ".join(parts)

    def _check_canceled(self, item: DownloadQueueItem) -> None:
        event = self._cancel_events.get(item.id)
        if item.cancel_requested or (event and event.is_set()):
            raise DownloadCanceledError("Download canceled.")

    def _should_skip_release(self, release: dict, include_suspicious: bool = False) -> bool:
        title = str(release.get("title", "")).lower()
        primary_type = str(release.get("primary-type", "")).lower()
        secondary_types = [str(value).lower() for value in release.get("secondary-types", [])]
        requested_type = str(release.get("_requested_type", "")).lower()

        allowed_type = requested_type in {"album", "ep", "single"} or primary_type in {"album", "ep", "single"}
        if not allowed_type:
            return True

        all_type_text = " ".join([primary_type, requested_type, *secondary_types, title])
        if any(word in all_type_text for word in _SKIP_RELEASE_WORDS):
            return True
        if not include_suspicious and any(word in all_type_text for word in _SUSPICIOUS_RELEASE_WORDS):
            return True
        return False

    def _track_key(self, title: str) -> str:
        value = title.lower()
        value = re.sub(r"\([^)]*\)", "", value)
        value = re.sub(r"\[[^]]*\]", "", value)
        value = re.sub(r"\b(feat|ft|with)\b.*$", "", value)
        value = re.sub(r"[^a-z0-9]+", "", value)
        return value.strip()
