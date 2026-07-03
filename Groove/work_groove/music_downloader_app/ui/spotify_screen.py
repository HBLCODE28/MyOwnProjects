from __future__ import annotations

import tkinter as tk
from collections.abc import Callable
from tkinter import ttk

from music_downloader_app.models import SearchResult
from music_downloader_app.ui.widgets import ThumbnailLoader

_PAD = 20
_GAP = 12


class SpotifyScreen(ttk.Frame):
    """Placeholder screen shown while Spotify integration is in development."""

    def __init__(
        self,
        master: tk.Misc,
        colors: dict[str, str],
        on_queue_playlist: Callable[[SearchResult], None],
        thumbnail_loader: ThumbnailLoader,
        client_id: str | None = None,
    ) -> None:
        super().__init__(master)
        self.colors = colors
        self._build()
        self.refresh_theme(colors)

    def refresh_theme(self, colors: dict[str, str]) -> None:
        self.colors = colors
        self.shell.configure(bg=colors["bg"])
        self.panel.configure(bg=colors["surface"], highlightbackground=colors["border"])
        self.notice_card.configure(bg=colors["surface_alt"], highlightbackground=colors["border"])
        for widget in self.panel.winfo_children():
            self._recolor_tree(widget)

    def _build(self) -> None:
        self.shell = tk.Frame(self, bg=self.colors["bg"])
        self.shell.pack(fill="both", expand=True)

        self.panel = tk.Frame(
            self.shell,
            bg=self.colors["surface"],
            highlightthickness=1,
            padx=_PAD,
            pady=_PAD,
        )
        self.panel.pack(fill="x")

        tk.Label(
            self.panel,
            text="Spotify playlists",
            bg=self.colors["surface"],
            fg=self.colors["text"],
            font=("Segoe UI", 16, "bold"),
        ).pack(anchor="w")

        tk.Label(
            self.panel,
            text="This feature is currently under development.",
            bg=self.colors["surface"],
            fg=self.colors["text_muted"],
            font=("Segoe UI", 10),
        ).pack(anchor="w", pady=(4, _GAP + 4))

        self.notice_card = tk.Frame(
            self.panel,
            bg=self.colors["surface_alt"],
            highlightbackground=self.colors["border"],
            highlightthickness=1,
            padx=_PAD,
            pady=_PAD,
        )
        self.notice_card.pack(fill="x")

        tk.Label(
            self.notice_card,
            text="Coming soon",
            bg=self.colors["surface_alt"],
            fg=self.colors["text"],
            font=("Segoe UI", 13, "bold"),
        ).pack(anchor="w")

        tk.Label(
            self.notice_card,
            text=(
                "Playlist import from Spotify is being worked on. "
                "For now, use Search to download artists, albums, or songs."
            ),
            bg=self.colors["surface_alt"],
            fg=self.colors["text_muted"],
            font=("Segoe UI", 10),
            wraplength=900,
            justify="left",
        ).pack(anchor="w", pady=(4, _GAP))

        ttk.Button(
            self.notice_card,
            text="Not available yet",
            style="Secondary.TButton",
            state="disabled",
        ).pack(anchor="w")

    def _recolor_tree(self, widget: tk.Widget) -> None:
        try:
            if isinstance(widget, tk.Label):
                widget.configure(bg=widget.master.cget("bg"))
        except Exception:
            pass
        for child in widget.winfo_children():
            self._recolor_tree(child)
