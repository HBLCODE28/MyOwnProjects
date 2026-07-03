from __future__ import annotations

import logging
import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk
from uuid import uuid4

from music_downloader_app.config import APP_DATA_DIR, APP_NAME, LOG_DIR, SPOTIFY_CLIENT_ID
from music_downloader_app.models import QueueSnapshot, SearchFilters, SearchResult, SettingsData
from music_downloader_app.services.downloads import DownloadService
from music_downloader_app.services.musicbrainz import MusicMetadataService
from music_downloader_app.services.settings import SettingsService
from music_downloader_app.services.youtube import YouTubeService, format_length
from music_downloader_app.ui.downloads_screen import DownloadsScreen
from music_downloader_app.ui.search_screen import SearchScreen
from music_downloader_app.ui.settings_screen import SettingsScreen
from music_downloader_app.ui.spotify_screen import SpotifyScreen
from music_downloader_app.ui.theme import ThemeManager
from music_downloader_app.ui.widgets import ThumbnailLoader


def configure_logging() -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        filename=LOG_DIR / "app.log",
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


class MusicDownloaderDesktopApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        configure_logging()
        self.logger = logging.getLogger(__name__)
        self.title(APP_NAME)
        self.geometry("1320x860")
        self.minsize(1100, 760)

        self.settings_service = SettingsService()
        self.settings = self.settings_service.load()
        self.metadata_service = MusicMetadataService()
        self.youtube_service = YouTubeService()
        self.event_queue: queue.Queue[tuple[str, object]] = queue.Queue()
        self.thumbnail_loader = ThumbnailLoader(self)
        self.theme_manager = ThemeManager(self, self.settings.theme)

        self.download_service = DownloadService(
            metadata_service=self.metadata_service,
            youtube_service=self.youtube_service,
            settings=self.settings,
            listener=lambda snapshot: self.event_queue.put(("queue", snapshot)),
        )

        self.search_results: list[SearchResult] = []
        self.nav_buttons: dict[str, ttk.Button] = {}
        self.current_screen = "search"
        self._build_shell()
        self.after(100, self._poll_events)

    def _build_shell(self) -> None:
        colors = self.theme_manager.colors
        header = tk.Frame(self, bg=colors["surface"], height=92, padx=28, pady=16)
        header.pack(fill="x")
        header.pack_propagate(False)

        brand = tk.Frame(header, bg=colors["surface"])
        brand.pack(side="left")
        badge = tk.Frame(brand, bg=colors["accent"], width=46, height=46)
        badge.pack(side="left", padx=(0, 12))
        badge.pack_propagate(False)
        tk.Label(
            badge,
            text="♪",
            bg=colors["accent"],
            fg="#ffffff",
            font=("Segoe UI Symbol", 24, "bold"),
        ).pack(expand=True)
        copy = tk.Frame(brand, bg=colors["surface"])
        copy.pack(side="left")
        tk.Label(
            copy,
            text=APP_NAME,
            bg=colors["surface"],
            fg=colors["text"],
            font=("Segoe UI Semibold", 23),
        ).pack(anchor="w")
        tk.Label(
            copy,
            text="Search, queue, and download music without leaving the app.",
            bg=colors["surface"],
            fg=colors["text_muted"],
            font=("Segoe UI", 10),
        ).pack(anchor="w")

        body = tk.Frame(self, bg=colors["bg"])
        body.pack(fill="both", expand=True, padx=24, pady=20)

        sidebar = tk.Frame(body, bg=colors["surface"], width=210, padx=14, pady=14)
        sidebar.pack(side="left", fill="y")
        sidebar.pack_propagate(False)
        tk.Label(
            sidebar,
            text="Navigation",
            bg=colors["surface"],
            fg=colors["text_muted"],
            font=("Segoe UI", 9, "bold"),
        ).pack(anchor="w", pady=(0, 10))

        for key, label in [
            ("search", "Search"),
            ("downloads", "Downloads"),
            ("spotify", "Spotify"),
            ("settings", "Settings"),
        ]:
            button = ttk.Button(
                sidebar,
                text=label,
                style="Primary.TButton" if key == "search" else "Secondary.TButton",
                command=lambda item=key: self.show_screen(item),
            )
            button.pack(fill="x", pady=(0, 10))
            self.nav_buttons[key] = button

        self.content = tk.Frame(body, bg=colors["bg"])
        self.content.pack(side="left", fill="both", expand=True, padx=(18, 0))

        self.search_screen = SearchScreen(
            self.content,
            colors=colors,
            on_search=self.start_search,
            on_queue_selected=self.add_selected_results_to_queue,
            on_open_downloads=self.open_downloads_folder,
            thumbnail_loader=self.thumbnail_loader,
        )
        self.downloads_screen = DownloadsScreen(
            self.content,
            colors=colors,
            on_pause=self.pause_queue,
            on_resume=self.resume_queue,
            on_cancel_item=self.cancel_queue_item,
            on_cancel_all=self.cancel_all_queue_items,
            on_open_downloads=self.open_downloads_folder,
        )
        self.settings_screen = SettingsScreen(
            self.content,
            colors=colors,
            settings=self.settings,
            on_save=self.save_settings,
        )

        self.spotify_screen = SpotifyScreen(
            self.content,
            colors=colors,
            on_queue_playlist=self._queue_spotify_playlist,
            thumbnail_loader=self.thumbnail_loader,
            client_id=SPOTIFY_CLIENT_ID,
        )

        for screen in [self.search_screen, self.downloads_screen, self.spotify_screen, self.settings_screen]:
            screen.place(relx=0, rely=0, relwidth=1, relheight=1)

        self.show_screen("search")
        self.downloads_screen.update_snapshot(self.download_service.get_snapshot())

    def show_screen(self, screen_name: str) -> None:
        self.current_screen = screen_name
        for key, button in self.nav_buttons.items():
            button.configure(style="Primary.TButton" if key == screen_name else "Secondary.TButton")
        mapping = {
            "search": self.search_screen,
            "downloads": self.downloads_screen,
            "spotify": self.spotify_screen,
            "settings": self.settings_screen,
        }
        mapping[screen_name].tkraise()

    def start_search(self, filters: SearchFilters) -> None:
        if not filters.artist.strip():
            messagebox.showerror("Missing information", "Please enter an artist name.")
            return
        if filters.mode == "album" and not filters.album.strip():
            messagebox.showerror("Missing information", "Please enter an album title.")
            return
        if filters.mode == "song" and not filters.song.strip():
            messagebox.showerror("Missing information", "Please enter a song title.")
            return

        self.search_screen.set_loading(True)
        self.search_screen.set_status("Searching...")
        threading.Thread(target=self._run_search, args=(filters,), daemon=True).start()

    def _run_search(self, filters: SearchFilters) -> None:
        try:
            if filters.mode == "artist":
                raw_results = self.metadata_service.search_artist(filters.artist)
                results = [self._build_artist_result(item) for item in raw_results]
            elif filters.mode == "album":
                raw_results = self.metadata_service.search_album(filters.album, filters.artist)
                results = [self._build_album_result(item, filters.artist) for item in raw_results]
            else:
                raw_results = self.metadata_service.search_recording(filters.song, filters.artist)
                results = [self._build_song_result(item, filters.artist) for item in raw_results]
            self.event_queue.put(("search_results", results))
        except Exception as exc:
            self.logger.exception("Search failed: %s", exc)
            self.event_queue.put(("search_error", "Search failed. Check your connection and try again."))

    def _build_artist_result(self, artist: dict) -> SearchResult:
        name = artist.get("name", "Unknown Artist")
        youtube = self.youtube_service.search(f"{name} most popular songs", 4)
        albums = self.metadata_service.get_release_groups_for_artist(artist["id"], "album")[:4]
        singles = self.metadata_service.get_release_groups_for_artist(artist["id"], "single")[:4]
        return SearchResult(
            id=uuid4().hex,
            result_type="Artist",
            title=name,
            subtitle=f"{artist.get('country', 'Unknown country')} artist",
            description=self.metadata_service.get_wikipedia_summary(name),
            metadata_lines=[
                f"Albums preview: {', '.join(item.get('title', 'Unknown') for item in albums) or 'Not available'}",
                f"Singles preview: {', '.join(item.get('title', 'Unknown') for item in singles) or 'Not available'}",
                f"YouTube preview: {youtube[0]['title'] if youtube else 'Not found'}",
            ],
            thumbnail_url=youtube[0]["thumbnail_url"] if youtube else None,
            artist_name=name,
            musicbrainz_id=artist.get("id"),
            raw_data=artist,
        )

    def _build_album_result(self, album: dict, artist_name: str) -> SearchResult:
        title = album.get("title", "Unknown Album")
        tracks = self.metadata_service.get_tracks_from_release_group(album["id"])
        youtube = self.youtube_service.search(f"{artist_name} {title} full album", 2)
        return SearchResult(
            id=uuid4().hex,
            result_type="Album",
            title=title,
            subtitle=f"{artist_name} • {album.get('first-release-date', 'Unknown date')}",
            description=f"{len(tracks)} tracks found." if tracks else "Track list not available.",
            metadata_lines=[
                f"Tracks: {', '.join(track['title'] for track in tracks[:8]) or 'Not available'}",
                f"YouTube preview: {youtube[0]['title'] if youtube else 'Not found'}",
            ],
            thumbnail_url=self.metadata_service.get_cover_url(album["id"]) or (
                youtube[0]["thumbnail_url"] if youtube else None
            ),
            artist_name=artist_name,
            musicbrainz_id=album.get("id"),
            raw_data=album,
        )

    def _build_song_result(self, song: dict, fallback_artist: str) -> SearchResult:
        title = song.get("title", "Unknown Song")
        artists = ", ".join(
            credit["artist"]["name"]
            for credit in song.get("artist-credit", [])
            if "artist" in credit
        ) or fallback_artist
        youtube = self.youtube_service.search(f"{artists} {title}", 2)
        return SearchResult(
            id=uuid4().hex,
            result_type="Song",
            title=title,
            subtitle=f"{artists} • {format_length(song.get('length'))}",
            description="Single track result.",
            metadata_lines=[
                f"Appears on: {', '.join(release.get('title', 'Unknown') for release in song.get('releases', [])[:5]) or 'Not available'}",
                f"YouTube preview: {youtube[0]['title'] if youtube else 'Not found'}",
            ],
            thumbnail_url=youtube[0]["thumbnail_url"] if youtube else None,
            artist_name=artists,
            musicbrainz_id=song.get("id"),
            raw_data=song,
        )

    def add_selected_results_to_queue(self) -> None:
        selected = self.search_screen.get_selected_results()
        if not selected:
            messagebox.showerror("Nothing selected", "Select at least one result first.")
            return
        self.download_service.add_results(selected)
        self.show_screen("downloads")
        messagebox.showinfo("Added to downloads", f"Added {len(selected)} item(s) to the queue.")

    def _queue_spotify_playlist(self, result: SearchResult) -> None:
        self.download_service.add_results([result])
        self.show_screen("downloads")
        messagebox.showinfo(
            "Playlist added",
            f'Added Spotify playlist "{result.title}" to the queue.'
        )

    def pause_queue(self) -> None:
        self.download_service.pause_queue()

    def resume_queue(self) -> None:
        self.download_service.resume_queue()

    def cancel_queue_item(self, item_id: str) -> None:
        self.download_service.cancel_item(item_id)

    def cancel_all_queue_items(self) -> None:
        self.download_service.cancel_all()

    def save_settings(self, settings: SettingsData) -> None:
        if not settings.download_folder:
            messagebox.showerror("Invalid folder", "Please choose a download folder.")
            return
        settings.download_folder.mkdir(parents=True, exist_ok=True)
        self.settings = settings
        self.settings_service.save(settings)
        self.download_service.update_settings(settings)
        self.settings_screen.update_settings(settings)
        self.theme_manager.set_theme(settings.theme)
        self._rebuild_shell()

    def _rebuild_shell(self) -> None:
        active_screen = self.current_screen
        for child in self.winfo_children():
            child.destroy()
        self.nav_buttons.clear()
        self._build_shell()
        self.show_screen(active_screen)

    def open_downloads_folder(self) -> None:
        path = self.settings.download_folder.expanduser()
        path.mkdir(parents=True, exist_ok=True)
        try:
            if sys.platform.startswith("win"):
                os.startfile(path)  # type: ignore[attr-defined]
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(path)])
            else:
                subprocess.Popen(["xdg-open", str(path)])
        except Exception as exc:
            messagebox.showerror("Could not open folder", str(exc))

    def _poll_events(self) -> None:
        while True:
            try:
                event_type, payload = self.event_queue.get_nowait()
            except queue.Empty:
                break
            self._handle_event(event_type, payload)
        self.after(100, self._poll_events)

    def _handle_event(self, event_type: str, payload: object) -> None:
        if event_type == "search_results":
            results = payload if isinstance(payload, list) else []
            self.search_results = results  # type: ignore[assignment]
            self.search_screen.set_loading(False)
            if results:
                self.search_screen.update_results(results)  # type: ignore[arg-type]
                self.search_screen.set_status(f"Found {len(results)} result(s).")
            else:
                self.search_screen.set_empty_state("No results found", "No results found. Try a different search.")
                self.search_screen.set_status("No results found.")
        elif event_type == "search_error":
            self.search_screen.set_loading(False)
            self.search_screen.set_empty_state("Search failed", str(payload))
            self.search_screen.set_status("Search failed.")
        elif event_type == "queue" and isinstance(payload, QueueSnapshot):
            self.downloads_screen.update_snapshot(payload)
            if payload.items:
                latest = payload.items[-1]
                if latest.status in {"completed", "failed", "canceled"}:
                    self.search_screen.set_status(payload.summary_message)


def main() -> None:
    app = MusicDownloaderDesktopApp()
    app.mainloop()


if __name__ == "__main__":
    main()
