from __future__ import annotations

import tkinter as tk
from collections.abc import Callable
from tkinter import ttk

from music_downloader_app.models import QueueSnapshot
from music_downloader_app.ui.widgets import DownloadCard, ScrollableFrame

_PAD = 20   # standard section padding
_GAP = 12   # gap between stacked cards


class DownloadsScreen(ttk.Frame):
    def __init__(
        self,
        master: tk.Misc,
        colors: dict[str, str],
        on_pause: Callable[[], None],
        on_resume: Callable[[], None],
        on_cancel_item: Callable[[str], None],
        on_cancel_all: Callable[[], None],
        on_open_downloads: Callable[[], None],
    ) -> None:
        super().__init__(master)
        self.colors = colors
        self.on_pause = on_pause
        self.on_resume = on_resume
        self.on_cancel_item = on_cancel_item
        self.on_cancel_all = on_cancel_all
        self.on_open_downloads = on_open_downloads
        self.snapshot = QueueSnapshot([], None, False, 0.0, "No downloads yet.")
        self._build()

    def refresh_theme(self, colors: dict[str, str]) -> None:
        self.colors = colors
        self.shell.configure(bg=colors["bg"])
        self.header_card.configure(bg=colors["surface"], highlightbackground=colors["border"])
        self.active_box.configure(bg=colors["surface_alt"])
        self.queue_host.canvas.configure(bg=colors["bg"])
        self.queue_host.inner.configure(bg=colors["bg"])

    def update_snapshot(self, snapshot: QueueSnapshot) -> None:
        self.snapshot = snapshot
        self.summary_label.configure(text=snapshot.summary_message)
        self.progress.configure(value=snapshot.overall_progress)

        active = next((i for i in snapshot.items if i.id == snapshot.active_item_id), None)
        self.active_label.configure(
            text=active.source.title if active else "Nothing is downloading right now."
        )

        has_items = bool(snapshot.items)
        self.pause_button.configure(state="disabled" if snapshot.paused or not has_items else "normal")
        self.resume_button.configure(state="normal" if snapshot.paused else "disabled")
        self.cancel_all_button.configure(state="normal" if has_items else "disabled")
        self._render_items()

    def _build(self) -> None:
        self.shell = tk.Frame(self, bg=self.colors["bg"])
        self.shell.pack(fill="both", expand=True)

        # Header card
        self.header_card = tk.Frame(
            self.shell,
            bg=self.colors["surface"],
            highlightthickness=1,
            highlightbackground=self.colors["border"],
            padx=_PAD,
            pady=_PAD,
        )
        self.header_card.pack(fill="x", pady=(0, _GAP))

        tk.Label(
            self.header_card,
            text="Download queue",
            bg=self.colors["surface"],
            fg=self.colors["text"],
            font=("Segoe UI", 16, "bold"),
        ).pack(anchor="w")

        self.summary_label = tk.Label(
            self.header_card,
            text=self.snapshot.summary_message,
            bg=self.colors["surface"],
            fg=self.colors["text_muted"],
            font=("Segoe UI", 10),
        )
        self.summary_label.pack(anchor="w", pady=(4, 12))

        self.progress = ttk.Progressbar(self.header_card, maximum=100, value=0)
        self.progress.pack(fill="x")

        # Active item row
        self.active_box = tk.Frame(self.header_card, bg=self.colors["surface_alt"], padx=_PAD, pady=12)
        self.active_box.pack(fill="x", pady=(_GAP, 0))

        tk.Label(
            self.active_box,
            text="NOW DOWNLOADING",
            bg=self.colors["surface_alt"],
            fg=self.colors["text_muted"],
            font=("Segoe UI", 8, "bold"),
        ).pack(anchor="w")

        self.active_label = tk.Label(
            self.active_box,
            text="Nothing is downloading right now.",
            bg=self.colors["surface_alt"],
            fg=self.colors["text"],
            font=("Segoe UI", 11),
        )
        self.active_label.pack(anchor="w", pady=(4, 0))

        # Controls row
        controls = tk.Frame(self.header_card, bg=self.colors["surface"])
        controls.pack(fill="x", pady=(_GAP, 0))

        self.pause_button = ttk.Button(
            controls, text="Pause", style="Secondary.TButton", command=self.on_pause
        )
        self.pause_button.pack(side="left")

        self.resume_button = ttk.Button(
            controls, text="Resume", style="Primary.TButton", command=self.on_resume, state="disabled"
        )
        self.resume_button.pack(side="left", padx=(8, 0))

        ttk.Button(
            controls, text="Open folder", style="Secondary.TButton", command=self.on_open_downloads
        ).pack(side="right")

        self.cancel_all_button = ttk.Button(
            controls, text="Cancel all", style="Danger.TButton", command=self.on_cancel_all, state="disabled"
        )
        self.cancel_all_button.pack(side="right", padx=(0, 8))

        # Queue list
        self.queue_host = ScrollableFrame(self.shell, bg=self.colors["bg"])
        self.queue_host.pack(fill="both", expand=True)

    def _render_items(self) -> None:
        for child in self.queue_host.inner.winfo_children():
            child.destroy()

        if not self.snapshot.items:
            self._render_empty()
            return

        for item in self.snapshot.items:
            DownloadCard(
                self.queue_host.inner,
                colors=self.colors,
                item=item,
                is_active=item.id == self.snapshot.active_item_id,
                on_cancel=self.on_cancel_item,
            ).pack(fill="x", pady=(0, _GAP))

    def _render_empty(self) -> None:
        empty = tk.Frame(
            self.queue_host.inner,
            bg=self.colors["surface"],
            highlightbackground=self.colors["border"],
            highlightthickness=1,
            padx=_PAD,
            pady=_PAD,
        )
        empty.pack(fill="x")
        tk.Label(
            empty,
            text="Queue is empty",
            bg=self.colors["surface"],
            fg=self.colors["text"],
            font=("Segoe UI", 14, "bold"),
        ).pack(anchor="w")
        tk.Label(
            empty,
            text="Add results from Search to see your queue here.",
            bg=self.colors["surface"],
            fg=self.colors["text_muted"],
            font=("Segoe UI", 10),
        ).pack(anchor="w", pady=(6, 0))
