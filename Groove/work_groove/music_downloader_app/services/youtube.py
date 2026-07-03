from __future__ import annotations

import hashlib
import logging
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from contextlib import contextmanager
from collections.abc import Callable
from pathlib import Path

import requests
from PIL import Image
from mutagen.id3 import (
    APIC,
    COMM,
    ID3,
    ID3NoHeaderError,
    TALB,
    TCOM,
    TCON,
    TCOP,
    TDOR,
    TDRC,
    TIT2,
    TLAN,
    TMED,
    TPE1,
    TPE2,
    TPUB,
    TPOS,
    TRCK,
    TSO2,
    TSOA,
    TSOP,
    TSRC,
    TXXX,
)
from yt_dlp import YoutubeDL

from music_downloader_app.config import WINDOWS_FFMPEG_PATH

LOGGER = logging.getLogger(__name__)

ProgressCallback = Callable[[float, str], None]


def safe_name(name: str) -> str:
    """Return a Windows-safe file or folder name."""
    name = re.sub(r'[<>:"/\\|?*]', "", name)
    name = re.sub(r"\s+", " ", name).strip()
    name = name.rstrip(" .")

    reserved = {
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5",
        "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4",
        "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    }

    if not name:
        return "Unknown"

    if name.upper() in reserved:
        name = f"_{name}"

    return name[:60]


def format_length(length_ms: int | None) -> str:
    """Format milliseconds as m:ss."""
    if not length_ms:
        return "Unknown"
    seconds = int(length_ms / 1000)
    return f"{seconds // 60}:{seconds % 60:02d}"


def seconds_to_time(seconds: int | None) -> str:
    """Format seconds as m:ss."""
    if not seconds:
        return "Unknown"
    seconds = int(seconds)
    return f"{seconds // 60}:{seconds % 60:02d}"


class DownloadCanceledError(RuntimeError):
    """Raised when the active download is canceled."""


class CancelAwareLogger:
    def debug(self, msg: str) -> None:
        LOGGER.debug(msg)

    def warning(self, msg: str) -> None:
        LOGGER.warning(msg)

    def error(self, msg: str) -> None:
        LOGGER.error(msg)


class YouTubeService:
    """Search YouTube and download audio.

    This version does not use yt-dlp's FFmpegExtractAudio postprocessor.
    It downloads the source audio first, then runs ffmpeg directly. That avoids
    the recurring Windows "Postprocessing: permission denied" issue.
    """

    def __init__(self, session: requests.Session | None = None) -> None:
        self.session = session or requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        })
        self._candidate_thumbnail_cache: dict[str, str] = {}
        self.last_downloaded_url: str | None = None

    def search(self, query: str, count: int = 4, popular: bool = False) -> list[dict]:
        """Return light-weight YouTube search previews.

        When popular=True the service fetches a larger set and sorts entries with
        available view counts from highest to lowest. YouTube does not expose a
        stable public "sort by views" switch through yt-dlp search, so this is a
        best-effort ranking over the returned search entries.
        """
        fetch_count = max(count * 2, count) if popular else count
        options = {
            "quiet": True,
            "skip_download": True,
            "extract_flat": False if popular else "in_playlist",
            "playlist_items": f"1:{fetch_count}",
            "logger": CancelAwareLogger(),
        }
        search_query = f"{query} popular" if popular else query
        with self._hide_child_console_windows():
            with YoutubeDL(options) as ydl:
                info = ydl.extract_info(f"ytsearch{fetch_count}:{search_query}", download=False)

        entries = list(info.get("entries", []) or [])
        if popular and any(entry.get("view_count") for entry in entries):
            entries.sort(key=lambda entry: entry.get("view_count") or 0, reverse=True)

        items: list[dict] = []
        for entry in entries[:count]:
            video_id = entry.get("id")
            items.append(
                {
                    "id": video_id,
                    "title": entry.get("title") or "Unknown title",
                    "channel": entry.get("channel") or entry.get("uploader") or "Unknown channel",
                    "duration": seconds_to_time(entry.get("duration")),
                    "url": entry.get("webpage_url") or (
                        f"https://www.youtube.com/watch?v={video_id}" if video_id else None
                    ),
                    "thumbnail_url": (
                        f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else None
                    ),
                    "view_count": entry.get("view_count") or 0,
                }
            )
        return items

    def search_trusted_artist_covers(self, artist_name: str, count: int = 6) -> list[dict]:
        """Return likely real covers performed by the requested artist.

        The filter is intentionally strict. It rejects AI/clone/generated titles
        and keeps results only when the channel looks tied to the artist, such as
        the artist channel, VEVO, Topic, or an official channel.
        """
        candidates = self.search(f"{artist_name} cover official", max(count * 3, 12), popular=True)
        accepted: list[dict] = []
        seen_ids: set[str] = set()
        for item in candidates:
            video_id = str(item.get("id") or item.get("url") or item.get("title") or "")
            if not video_id or video_id in seen_ids:
                continue
            if not self._looks_like_trusted_artist_cover(item, artist_name):
                continue
            seen_ids.add(video_id)
            accepted.append(item)
            if len(accepted) >= count:
                break
        return accepted

    def _looks_like_trusted_artist_cover(self, item: dict, artist_name: str) -> bool:
        title = str(item.get("title") or "")
        channel = str(item.get("channel") or "")
        text = f"{title} {channel}".lower()
        ai_markers = (
            " ai ", "ai cover", "a.i.", "artificial intelligence", "generated",
            "voice clone", "voice model", "rvc", "so-vits", "suno", "udio",
            "karaoke", "instrumental", "reaction", "tutorial", "tribute",
            "sped up", "nightcore", "type beat", "fanmade", "fan made",
        )
        padded_text = f" {text} "
        if any(marker in padded_text for marker in ai_markers):
            return False
        if "cover" not in text and "covered" not in text and "covers" not in text:
            return False

        def normalize(value: str) -> str:
            return re.sub(r"[^a-z0-9]+", "", value.lower())

        artist_norm = normalize(artist_name.split(",")[0])
        channel_norm = normalize(channel)
        title_norm = normalize(title)
        if not artist_norm:
            return False

        official_channel = (
            artist_norm in channel_norm
            or (artist_norm in title_norm and any(word in channel.lower() for word in ("official", "vevo", "topic")))
            or channel_norm in {f"{artist_norm}vevo", f"{artist_norm}official", f"{artist_norm}topic"}
        )
        return official_channel

    def resolve_ffmpeg_path(self) -> str | None:
        """Return an ffmpeg folder when available."""
        if WINDOWS_FFMPEG_PATH.exists():
            return str(WINDOWS_FFMPEG_PATH.parent)
        system_ffmpeg = shutil.which("ffmpeg")
        if system_ffmpeg:
            return str(Path(system_ffmpeg).parent)
        return None

    def _resolve_ffmpeg_binary(self) -> str:
        if WINDOWS_FFMPEG_PATH.exists():
            return str(WINDOWS_FFMPEG_PATH)

        system_ffmpeg = shutil.which("ffmpeg")
        if system_ffmpeg:
            return system_ffmpeg

        raise RuntimeError(
            "FFmpeg was not found. Install FFmpeg or place ffmpeg.exe in vendor\\ffmpeg\\bin."
        )

    def _hidden_subprocess_kwargs(self, kwargs: dict | None = None) -> dict:
        """Return subprocess kwargs that prevent child console windows on Windows."""
        updated = dict(kwargs or {})
        if not sys.platform.startswith("win"):
            return updated

        create_no_window = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        if create_no_window:
            updated["creationflags"] = int(updated.get("creationflags", 0)) | create_no_window

        startupinfo = updated.get("startupinfo")
        if startupinfo is None and hasattr(subprocess, "STARTUPINFO"):
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= getattr(subprocess, "STARTF_USESHOWWINDOW", 1)
            startupinfo.wShowWindow = 0
            updated["startupinfo"] = startupinfo
        return updated

    @contextmanager
    def _hide_child_console_windows(self):
        """Temporarily hide console windows opened by yt-dlp or ffmpeg on Windows."""
        if not sys.platform.startswith("win"):
            yield
            return

        original_popen = subprocess.Popen

        def popen_without_window(*args, **kwargs):
            return original_popen(*args, **self._hidden_subprocess_kwargs(kwargs))

        subprocess.Popen = popen_without_window  # type: ignore[assignment]
        try:
            yield
        finally:
            subprocess.Popen = original_popen  # type: ignore[assignment]

    def download_media(
        self,
        query: str,
        output_no_ext: Path,
        quality: str,
        media_format: str = "mp3",
        video_quality: str = "best",
        cover_url: str | None = None,
        allow_youtube_thumbnail_cover: bool = True,
        cover_overwrite: bool = False,
        metadata: dict | None = None,
        expected_title: str | None = None,
        expected_artist: str | None = None,
        expected_album: str | None = None,
        expected_duration_seconds: int | None = None,
        blocked_urls: set[str] | None = None,
        progress_callback: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
    ) -> Path:
        """Download either MP3 audio or MP4 video based on media_format."""
        if media_format == "mp4":
            return self.download_video(
                query=query,
                output_no_ext=output_no_ext,
                video_quality=video_quality,
                progress_callback=progress_callback,
                cancel_event=cancel_event,
            )
        return self.download_track(
            query=query,
            output_no_ext=output_no_ext,
            quality=quality,
            cover_url=cover_url,
            allow_youtube_thumbnail_cover=allow_youtube_thumbnail_cover,
            cover_overwrite=cover_overwrite,
            metadata=metadata,
            expected_title=expected_title,
            expected_artist=expected_artist,
            expected_album=expected_album,
            expected_duration_seconds=expected_duration_seconds,
            blocked_urls=blocked_urls,
            progress_callback=progress_callback,
            cancel_event=cancel_event,
        )

    def download_video(
        self,
        query: str,
        output_no_ext: Path,
        video_quality: str = "best",
        progress_callback: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
    ) -> Path:
        """Download a single YouTube result as MP4 video."""
        output_no_ext.parent.mkdir(parents=True, exist_ok=True)
        final_mp4 = output_no_ext.with_suffix(".mp4")
        ffmpeg_location = self.resolve_ffmpeg_path()
        attempts = self._search_download_candidates(query, count=5)
        if not attempts:
            attempts = [f"ytsearch1:{query}"]

        errors: list[str] = []
        for index, target in enumerate(attempts, start=1):
            self._check_cancel(cancel_event)
            if progress_callback:
                progress_callback(0.0, f"Trying video source {index} of {len(attempts)}")
            try:
                with tempfile.TemporaryDirectory(prefix="mdv_") as temp_dir:
                    temp_folder = Path(temp_dir)
                    stem = self._short_temp_stem(output_no_ext.name, index)
                    temp_mp4 = temp_folder / f"{stem}.mp4"

                    def _hook(payload: dict) -> None:
                        self._check_cancel(cancel_event)
                        status = payload.get("status")
                        if status == "downloading":
                            downloaded = payload.get("downloaded_bytes") or 0
                            total = payload.get("total_bytes") or payload.get("total_bytes_estimate") or 0
                            progress = (downloaded / total) * 95 if total else 0.0
                            if progress_callback:
                                progress_callback(progress, "Downloading video")
                        elif status == "finished" and progress_callback:
                            progress_callback(96.0, "Finalizing MP4")

                    options = {
                        "format": self._video_format_selector(video_quality),
                        "merge_output_format": "mp4",
                        "outtmpl": str(temp_mp4),
                        "quiet": True,
                        "noplaylist": True,
                        "skip_download": False,
                        "progress_hooks": [_hook],
                        "logger": CancelAwareLogger(),
                        "retries": 2,
                        "fragment_retries": 2,
                        "continuedl": False,
                        "overwrites": True,
                        "nopart": True,
                        "windowsfilenames": True,
                    }
                    if ffmpeg_location:
                        options["ffmpeg_location"] = ffmpeg_location

                    with self._hide_child_console_windows():
                        with YoutubeDL(options) as ydl:
                            ydl.download([target])

                    self._wait_for_file_ready(temp_mp4)
                    if final_mp4.exists():
                        self._safe_unlink(final_mp4)
                    shutil.move(str(temp_mp4), str(final_mp4))
                    self._wait_for_file_ready(final_mp4)
                    if progress_callback:
                        progress_callback(100.0, "Completed")
                    return final_mp4
            except DownloadCanceledError:
                raise
            except Exception as exc:
                errors.append(f"source {index}: {exc}")
                LOGGER.warning("Video download candidate failed for %s: %s", query, exc)
                continue

        raise RuntimeError("All YouTube video sources failed. Last errors: " + " | ".join(errors[-3:]))

    def download_track(
        self,
        query: str,
        output_no_ext: Path,
        quality: str,
        cover_url: str | None = None,
        allow_youtube_thumbnail_cover: bool = True,
        cover_overwrite: bool = False,
        metadata: dict | None = None,
        expected_title: str | None = None,
        expected_artist: str | None = None,
        expected_album: str | None = None,
        expected_duration_seconds: int | None = None,
        blocked_urls: set[str] | None = None,
        progress_callback: ProgressCallback | None = None,
        cancel_event: threading.Event | None = None,
    ) -> Path:
        """Download a single track to MP3.

        The file is downloaded to a short temporary path, converted to MP3 using
        a direct ffmpeg subprocess, then moved to the final destination.
        """
        final_no_ext = output_no_ext
        final_no_ext.parent.mkdir(parents=True, exist_ok=True)
        final_mp3 = final_no_ext.with_suffix(".mp3")

        ffmpeg_binary = self._resolve_ffmpeg_binary()

        attempts = self._search_download_candidates(
            query,
            count=8,
            expected_title=expected_title,
            expected_artist=expected_artist,
            expected_album=expected_album,
            expected_duration_seconds=expected_duration_seconds,
            blocked_urls=blocked_urls,
        )
        if not attempts:
            if expected_title:
                raise RuntimeError(f"No verified YouTube result matched: {expected_artist or ''} - {expected_title}")
            attempts = [f"ytsearch1:{query}"]

        errors: list[str] = []

        for index, target in enumerate(attempts, start=1):
            self._check_cancel(cancel_event)

            if progress_callback:
                progress_callback(0.0, f"Trying source {index} of {len(attempts)}")

            try:
                with tempfile.TemporaryDirectory(prefix="md_") as temp_dir:
                    temp_folder = Path(temp_dir)
                    stem = self._short_temp_stem(final_no_ext.name, index)
                    source_path = self._download_source_audio(
                        target=target,
                        temp_folder=temp_folder,
                        stem=stem,
                        progress_callback=progress_callback,
                        cancel_event=cancel_event,
                    )

                    self._wait_for_file_ready(source_path)

                    temp_mp3 = temp_folder / f"{stem}.mp3"
                    self._convert_to_mp3(
                        ffmpeg_binary=ffmpeg_binary,
                        source_path=source_path,
                        output_path=temp_mp3,
                        quality=quality,
                        progress_callback=progress_callback,
                        cancel_event=cancel_event,
                    )
                    self._wait_for_file_ready(temp_mp3)

                    if final_mp3.exists():
                        self._safe_unlink(final_mp3)

                    shutil.move(str(temp_mp3), str(final_mp3))
                    self._wait_for_file_ready(final_mp3)

                    cover_path = None
                    if cover_url:
                        cover_path = self.save_cover_image(
                            final_mp3.parent,
                            cover_url,
                            overwrite=cover_overwrite,
                        )

                    # For single-song downloads, fallback to the thumbnail from the
                    # selected YouTube source. For album downloads this must stay
                    # disabled, otherwise the first track thumbnail can overwrite the
                    # real album cover and then every MP3 receives the wrong cover.
                    if cover_path is None and allow_youtube_thumbnail_cover:
                        fallback_cover_url = self._candidate_thumbnail_cache.get(target)
                        if fallback_cover_url:
                            cover_path = self.save_cover_image(final_mp3.parent, fallback_cover_url)

                    if cover_path:
                        self._embed_cover_in_mp3(final_mp3, cover_path)

                    if metadata:
                        self._write_mp3_metadata(final_mp3, metadata)

                    self.last_downloaded_url = target

                    if progress_callback:
                        progress_callback(100.0, "Completed")

                    return final_mp3

            except DownloadCanceledError:
                raise
            except Exception as exc:
                errors.append(f"source {index}: {exc}")
                LOGGER.warning("Download candidate failed for %s: %s", query, exc)
                continue

        raise RuntimeError(
            "All YouTube sources failed. Last errors: " + " | ".join(errors[-3:])
        )

    def _video_format_selector(self, video_quality: str) -> str:
        quality = str(video_quality or "best").lower().replace("p", "")
        if quality == "best":
            return "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best"
        if quality.isdigit():
            return f"bv*[height<={quality}][ext=mp4]+ba[ext=m4a]/b[height<={quality}][ext=mp4]/best[height<={quality}]/best"
        return "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best"

    def _search_download_candidates(
        self,
        query: str,
        count: int = 5,
        expected_title: str | None = None,
        expected_artist: str | None = None,
        expected_album: str | None = None,
        expected_duration_seconds: int | None = None,
        blocked_urls: set[str] | None = None,
    ) -> list[str]:
        """Return direct video URLs from YouTube search results.

        When expected_title is provided, results are filtered by title and
        artist before download. This prevents album downloads from saving the
        same broad/full-album YouTube result for every track.
        """
        fetch_count = max(count, 24) if expected_title else count
        blocked_urls = set(blocked_urls or set())
        options = {
            "quiet": True,
            "skip_download": True,
            "extract_flat": "in_playlist",
            "playlist_items": f"1:{fetch_count}",
            "logger": CancelAwareLogger(),
        }

        try:
            with self._hide_child_console_windows():
                with YoutubeDL(options) as ydl:
                    info = ydl.extract_info(f"ytsearch{fetch_count}:{query}", download=False)
        except Exception as exc:
            LOGGER.warning("YouTube candidate search failed for %s: %s", query, exc)
            return []

        scored: list[tuple[int, str, dict]] = []
        plain: list[str] = []
        seen: set[str] = set()
        for entry in info.get("entries", []) or []:
            url = entry.get("webpage_url")
            video_id = entry.get("id")
            if not url and video_id:
                url = f"https://www.youtube.com/watch?v={video_id}"
            if not url or url in seen or url in blocked_urls:
                continue
            seen.add(url)
            thumbnail = self._best_thumbnail_url(entry)
            if thumbnail:
                self._candidate_thumbnail_cache[url] = thumbnail

            if expected_title:
                score = self._score_youtube_track_candidate(
                    entry,
                    expected_title,
                    expected_artist,
                    expected_album,
                    expected_duration_seconds,
                )
                if score > 0:
                    scored.append((score, url, entry))
            else:
                plain.append(url)

        if expected_title:
            scored.sort(key=lambda item: item[0], reverse=True)
            return [url for score, url, _entry in scored if score >= 70][:count]
        return plain[:count]

    def _score_youtube_track_candidate(
        self,
        entry: dict,
        expected_title: str,
        expected_artist: str | None = None,
        expected_album: str | None = None,
        expected_duration_seconds: int | None = None,
    ) -> int:
        title = str(entry.get("title") or "")
        channel = str(entry.get("channel") or entry.get("uploader") or "")
        norm_title = self._normalize_youtube_text(title)
        norm_channel = self._normalize_youtube_text(channel)
        norm_expected = self._normalize_youtube_text(expected_title)
        norm_artist = self._normalize_youtube_text((expected_artist or "").split(",")[0])
        norm_album = self._normalize_youtube_text(expected_album or "")

        if not norm_expected:
            return 0

        blocked = (
            "full album", "full ep", "album stream", "ep stream", "complete album",
            "complete ep", "entire album", "entire ep", "playlist", "reaction",
            "cover", "karaoke", "instrumental", "sped up", "nightcore", "remix",
            "tutorial", "live", "concert", "compilation",
        )
        if any(token in norm_title for token in blocked):
            return 0

        title_score = 0
        if norm_expected == norm_title:
            title_score = 120
        elif norm_expected in norm_title:
            title_score = 100
        else:
            expected_words = {word for word in norm_expected.split() if len(word) > 1}
            title_words = {word for word in norm_title.split() if len(word) > 1}
            overlap = len(expected_words & title_words)
            if expected_words and overlap / max(len(expected_words), 1) >= 0.75:
                title_score = 75
        if title_score < 70:
            return 0

        duration = entry.get("duration")
        if isinstance(duration, (int, float)) and duration > 0:
            if duration > 720:
                return 0
            if expected_duration_seconds and expected_duration_seconds > 0:
                diff = abs(float(duration) - float(expected_duration_seconds))
                allowed = max(45.0, float(expected_duration_seconds) * 0.35)
                if diff > allowed:
                    return 0

        score = title_score
        if norm_artist:
            if norm_artist in norm_title or norm_artist in norm_channel:
                score += 55
            else:
                artist_words = {word for word in norm_artist.split() if len(word) > 1}
                text_words = {word for word in f"{norm_title} {norm_channel}".split() if len(word) > 1}
                if artist_words and len(artist_words & text_words) / max(len(artist_words), 1) >= 0.75:
                    score += 35
                else:
                    return 0

        if norm_album and norm_album in norm_title:
            # Album title is helpful, but not required because many official
            # audio uploads contain only artist and track names.
            score += 10

        official_markers = ("official", "audio", "topic", "vevo")
        if any(marker in f"{norm_title} {norm_channel}" for marker in official_markers):
            score += 15
        return score

    def _normalize_youtube_text(self, value: str) -> str:
        value = str(value or "").lower()
        value = re.sub(r"\([^)]*\)", " ", value)
        value = re.sub(r"\[[^]]*\]", " ", value)
        value = re.sub(r"\b(official|audio|video|visualizer|lyrics?|hd|hq|mv)\b", " ", value)
        value = re.sub(r"[^a-z0-9]+", " ", value)
        return re.sub(r"\s+", " ", value).strip()

    def _best_thumbnail_url(self, info: dict) -> str | None:
        """Return the best thumbnail URL from a yt-dlp info dict."""
        thumbnails = info.get("thumbnails") or []
        if isinstance(thumbnails, list) and thumbnails:
            def _score(item: dict) -> int:
                return int(item.get("width") or 0) * int(item.get("height") or 0)

            for thumb in sorted(thumbnails, key=_score, reverse=True):
                url = thumb.get("url")
                if url:
                    return url
        thumbnail = info.get("thumbnail")
        return thumbnail if isinstance(thumbnail, str) and thumbnail else None

    def _download_source_audio(
        self,
        target: str,
        temp_folder: Path,
        stem: str,
        progress_callback: ProgressCallback | None,
        cancel_event: threading.Event | None,
    ) -> Path:
        """Download source audio without yt-dlp postprocessing."""
        output_template = str(temp_folder / f"{stem}.%(ext)s")

        before = set(temp_folder.iterdir())

        def _hook(payload: dict) -> None:
            self._check_cancel(cancel_event)

            status = payload.get("status")
            if status == "downloading":
                downloaded = payload.get("downloaded_bytes") or 0
                total = (
                    payload.get("total_bytes")
                    or payload.get("total_bytes_estimate")
                    or 0
                )
                progress = (downloaded / total) * 85 if total else 0.0
                if progress_callback:
                    progress_callback(progress, "Downloading audio")
            elif status == "finished" and progress_callback:
                progress_callback(88.0, "Preparing conversion")

        options = {
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "outtmpl": output_template,
            "quiet": True,
            "noplaylist": True,
            "writethumbnail": False,
            "skip_download": False,
            "progress_hooks": [_hook],
            "logger": CancelAwareLogger(),
            "retries": 2,
            "fragment_retries": 2,
            "continuedl": False,
            "overwrites": True,
            "nopart": True,
            "windowsfilenames": True,
        }

        with self._hide_child_console_windows():
            with YoutubeDL(options) as ydl:
                ydl.download([target])

        after = set(temp_folder.iterdir())
        created = [path for path in after - before if path.is_file()]
        created = [path for path in created if path.suffix.lower() not in {".part", ".ytdl"}]

        if not created:
            created = [
                path for path in temp_folder.glob(f"{stem}.*")
                if path.is_file() and path.suffix.lower() not in {".part", ".ytdl"}
            ]

        if not created:
            raise FileNotFoundError("yt-dlp did not create a source audio file.")

        # Use the largest created file, because sidecar files are usually small.
        source_path = max(created, key=lambda path: path.stat().st_size)
        self._wait_for_file_ready(source_path)
        return source_path

    def _convert_to_mp3(
        self,
        ffmpeg_binary: str,
        source_path: Path,
        output_path: Path,
        quality: str,
        progress_callback: ProgressCallback | None,
        cancel_event: threading.Event | None,
    ) -> None:
        """Convert downloaded source audio to MP3 using direct ffmpeg."""
        self._check_cancel(cancel_event)

        bitrate = f"{quality}k" if str(quality).isdigit() else "192k"

        if progress_callback:
            progress_callback(92.0, "Converting to MP3")

        command = [
            ffmpeg_binary,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(source_path),
            "-vn",
            "-map_metadata",
            "-1",
            "-codec:a",
            "libmp3lame",
            "-b:a",
            bitrate,
            str(output_path),
        ]

        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            **self._hidden_subprocess_kwargs(),
        )

        while process.poll() is None:
            if cancel_event and cancel_event.is_set():
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                raise DownloadCanceledError("Download canceled.")
            time.sleep(0.2)

        stdout, stderr = process.communicate()

        if process.returncode != 0:
            details = (stderr or stdout or "unknown ffmpeg error").strip()
            raise RuntimeError(f"ffmpeg conversion failed: {details}")

        self._wait_for_file_ready(output_path)

    def _short_temp_stem(self, name: str, attempt_index: int) -> str:
        base = safe_name(name)
        digest = hashlib.sha1(f"{name}-{attempt_index}".encode("utf-8")).hexdigest()[:8]
        return f"{base[:24]}_{digest}_{attempt_index}"

    def _check_cancel(self, cancel_event: threading.Event | None) -> None:
        if cancel_event and cancel_event.is_set():
            raise DownloadCanceledError("Download canceled.")

    def _wait_for_file_ready(self, path: Path) -> None:
        """Wait until Windows releases the file."""
        for _ in range(40):
            if path.exists():
                try:
                    with open(path, "rb"):
                        pass
                    if path.stat().st_size > 0:
                        return
                except PermissionError:
                    time.sleep(0.25)
                except OSError:
                    time.sleep(0.25)
            else:
                time.sleep(0.25)

        raise FileNotFoundError(f"Expected output file was not created or is locked: {path}")

    def _safe_unlink(self, path: Path) -> None:
        for _ in range(15):
            try:
                path.unlink(missing_ok=True)
                return
            except PermissionError:
                time.sleep(0.2)
            except OSError:
                LOGGER.debug("Failed to remove existing output %s", path)
                return

    def _cleanup_partial_outputs(self, folder: Path, stem: str) -> None:
        for candidate in folder.glob(f"{stem}*"):
            self._safe_unlink(candidate)

    def save_cover_image(
        self,
        folder: Path,
        cover_url: str,
        filename: str = "cover.jpg",
        overwrite: bool = False,
    ) -> Path | None:
        """Save album/single cover art and return its path.

        When overwrite=True the existing cover is replaced. This is important for
        albums: an older run may have saved the first song thumbnail as cover.jpg,
        and the corrected album cover must be able to replace it.
        """
        folder.mkdir(parents=True, exist_ok=True)
        cover_path = folder / filename
        source_path = folder / f"{filename}.source.txt"

        if cover_path.exists() and cover_path.stat().st_size > 0 and not overwrite:
            self._safe_unlink(source_path)
            return cover_path

        try:
            response = self.session.get(
                cover_url,
                timeout=30,
                headers={
                    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                    "Referer": "https://www.google.com/",
                },
            )
            response.raise_for_status()
            with tempfile.NamedTemporaryFile(prefix="groove_cover_", suffix=".img", delete=False) as tmp:
                tmp.write(response.content)
                tmp_path = Path(tmp.name)
            try:
                with Image.open(tmp_path) as image:
                    image.convert("RGB").save(cover_path, "JPEG", quality=92)
                self._safe_unlink(source_path)
            finally:
                self._safe_unlink(tmp_path)
            return cover_path if cover_path.exists() and cover_path.stat().st_size > 0 else None
        except Exception as exc:
            LOGGER.warning("Cover download failed for %s from %s: %s", folder, cover_url, exc)
            try:
                (folder / "cover.error.txt").write_text(
                    f"Failed to download cover from:\n{cover_url}\n\nError:\n{exc}\n",
                    encoding="utf-8",
                )
            except Exception:
                pass
            return None

    def _embed_cover_in_mp3(self, mp3_path: Path, cover_path: Path) -> bool:
        """Embed cover.jpg into an MP3 file and verify the result.

        First it tries Mutagen because it edits ID3 tags without spawning another
        process. If the tag is still missing afterward, it falls back to a hidden
        ffmpeg remux. The fallback is important because some MP3 files produced
        by different ffmpeg/yt-dlp combinations reject direct tag edits until they
        are remuxed.
        """
        try:
            image_bytes = cover_path.read_bytes()
            try:
                tags = ID3(mp3_path)
            except ID3NoHeaderError:
                tags = ID3()
            tags.delall("APIC")
            tags.add(APIC(
                encoding=3,
                mime="image/jpeg",
                type=3,
                desc="Cover",
                data=image_bytes,
            ))
            tags.save(mp3_path, v2_version=3)
            if self._mp3_has_cover(mp3_path):
                return True
        except Exception as exc:
            LOGGER.debug("Mutagen cover embedding failed for %s: %s", mp3_path, exc)

        return self._embed_cover_with_ffmpeg(mp3_path, cover_path)

    def _mp3_has_cover(self, mp3_path: Path) -> bool:
        try:
            tags = ID3(mp3_path)
            return any(key.startswith("APIC") for key in tags.keys())
        except Exception:
            return False

    def _embed_cover_with_ffmpeg(self, mp3_path: Path, cover_path: Path) -> bool:
        """Fallback cover embedding using ffmpeg without showing a CMD window."""
        temp_output = mp3_path.with_name(f"{mp3_path.stem}.__cover_tmp__.mp3")
        try:
            ffmpeg_binary = self._resolve_ffmpeg_binary()
            command = [
                ffmpeg_binary,
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(mp3_path),
                "-i",
                str(cover_path),
                "-map",
                "0:a",
                "-map",
                "1:v",
                "-c:a",
                "copy",
                "-c:v",
                "mjpeg",
                "-id3v2_version",
                "3",
                "-metadata:s:v",
                "title=Album cover",
                "-metadata:s:v",
                "comment=Cover (front)",
                str(temp_output),
            ]
            process = subprocess.run(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                **self._hidden_subprocess_kwargs(),
            )
            if process.returncode != 0 or not temp_output.exists():
                LOGGER.debug(
                    "ffmpeg cover embedding failed for %s: %s",
                    mp3_path,
                    (process.stderr or process.stdout or "unknown error").strip(),
                )
                return False
            self._wait_for_file_ready(temp_output)
            self._safe_unlink(mp3_path)
            shutil.move(str(temp_output), str(mp3_path))
            self._wait_for_file_ready(mp3_path)
            return self._mp3_has_cover(mp3_path)
        except Exception as exc:
            LOGGER.debug("ffmpeg cover embedding skipped for %s: %s", mp3_path, exc)
            return False
        finally:
            if temp_output.exists():
                self._safe_unlink(temp_output)

    def _write_mp3_metadata(self, mp3_path: Path, metadata: dict) -> bool:
        """Write ID3 metadata fields that are known for the downloaded MP3.

        The method updates common player-visible fields first, then writes extra
        MusicBrainz/source details as TXXX frames. It leaves the embedded cover
        art untouched.
        """
        try:
            try:
                tags = ID3(mp3_path)
            except ID3NoHeaderError:
                tags = ID3()

            def first_value(key: str) -> str | None:
                value = metadata.get(key)
                if value is None:
                    return None
                if isinstance(value, (list, tuple, set)):
                    value = ", ".join(str(item).strip() for item in value if str(item).strip())
                value = str(value).strip()
                return value or None

            def set_text(frame_id: str, frame) -> None:
                tags.delall(frame_id)
                tags.add(frame)

            title = first_value("title")
            if title:
                set_text("TIT2", TIT2(encoding=3, text=title))

            artist = first_value("artist")
            if artist:
                set_text("TPE1", TPE1(encoding=3, text=artist))

            album = first_value("album")
            if album:
                set_text("TALB", TALB(encoding=3, text=album))

            album_artist = first_value("album_artist") or artist
            if album_artist:
                set_text("TPE2", TPE2(encoding=3, text=album_artist))

            artist_sort = first_value("artist_sort")
            if artist_sort:
                set_text("TSOP", TSOP(encoding=3, text=artist_sort))

            album_artist_sort = first_value("album_artist_sort")
            if album_artist_sort:
                set_text("TSO2", TSO2(encoding=3, text=album_artist_sort))

            album_sort = first_value("album_sort")
            if album_sort:
                set_text("TSOA", TSOA(encoding=3, text=album_sort))

            track_number = first_value("track_number")
            track_total = first_value("track_total")
            if track_number:
                track_text = f"{track_number}/{track_total}" if track_total else track_number
                set_text("TRCK", TRCK(encoding=3, text=track_text))

            disc_number = first_value("disc_number")
            disc_total = first_value("disc_total")
            if disc_number:
                disc_text = f"{disc_number}/{disc_total}" if disc_total else disc_number
                set_text("TPOS", TPOS(encoding=3, text=disc_text))

            date = first_value("date") or first_value("year")
            if date:
                set_text("TDRC", TDRC(encoding=3, text=date))

            original_date = first_value("original_date")
            if original_date:
                set_text("TDOR", TDOR(encoding=3, text=original_date))

            genre = first_value("genre")
            if genre:
                set_text("TCON", TCON(encoding=3, text=genre))

            publisher = first_value("publisher") or first_value("label")
            if publisher:
                set_text("TPUB", TPUB(encoding=3, text=publisher))

            composer = first_value("composer")
            if composer:
                set_text("TCOM", TCOM(encoding=3, text=composer))

            copyright_text = first_value("copyright")
            if copyright_text:
                set_text("TCOP", TCOP(encoding=3, text=copyright_text))

            language = first_value("language")
            if language:
                set_text("TLAN", TLAN(encoding=3, text=language))

            media_type = first_value("media_type")
            if media_type:
                set_text("TMED", TMED(encoding=3, text=media_type))

            isrc = first_value("isrc")
            if isrc:
                set_text("TSRC", TSRC(encoding=3, text=isrc))

            comment = first_value("comment")
            if comment:
                tags.delall("COMM")
                tags.add(COMM(encoding=3, lang="eng", desc="Groove", text=comment))

            txxx_fields = {
                "MusicBrainz Artist Id": first_value("musicbrainz_artist_id"),
                "MusicBrainz Album Id": first_value("musicbrainz_release_group_id"),
                "MusicBrainz Release Id": first_value("musicbrainz_release_id"),
                "MusicBrainz Track Id": first_value("musicbrainz_recording_id"),
                "Release Country": first_value("release_country"),
                "Release Status": first_value("release_status"),
                "Release Type": first_value("release_type"),
                "Catalog Number": first_value("catalog_number"),
                "Barcode": first_value("barcode"),
                "ASIN": first_value("asin"),
                "Source": first_value("source"),
            }
            for desc, value in txxx_fields.items():
                tags.delall(f"TXXX:{desc}")
                if value:
                    tags.add(TXXX(encoding=3, desc=desc, text=value))

            tags.save(mp3_path, v2_version=3)
            return True
        except Exception as exc:
            LOGGER.debug("MP3 metadata writing failed for %s: %s", mp3_path, exc)
            return False

    def _embed_cover_if_missing(
        self,
        mp3_path: Path,
        cover_url: str,
        ffmpeg_location: str | None,
    ) -> None:
        """Compatibility wrapper used by older code paths."""
        cover_path = self.save_cover_image(mp3_path.parent, cover_url)
        if cover_path:
            self._embed_cover_in_mp3(mp3_path, cover_path)
