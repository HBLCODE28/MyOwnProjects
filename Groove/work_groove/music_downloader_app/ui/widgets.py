from __future__ import annotations

import io
import threading
import tkinter as tk
from collections.abc import Callable
from tkinter import ttk

import requests
from PIL import Image, ImageTk

from music_downloader_app.models import DownloadQueueItem, SearchResult

# Shared card padding constants
_CARD_PAD_X = 20
_CARD_PAD_Y = 16


class ScrollableFrame(ttk.Frame):
    def __init__(self, master: tk.Misc, bg: str, **kwargs) -> None:
        super().__init__(master, **kwargs)
        self.canvas = tk.Canvas(self, highlightthickness=0, bg=bg)
        self.scrollbar = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.inner = tk.Frame(self.canvas, bg=bg)
        self.window = self.canvas.create_window((0, 0), window=self.inner, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar.pack(side="right", fill="y")
        self.inner.bind(
            "<Configure>",
            lambda _event: self.canvas.configure(scrollregion=self.canvas.bbox("all")),
        )
        self.canvas.bind(
            "<Configure>",
            lambda event: self.canvas.itemconfigure(self.window, width=event.width),
        )
        self.canvas.bind(
            "<MouseWheel>",
            lambda event: self.canvas.yview_scroll(-1 * int(event.delta / 120), "units"),
        )


class ThumbnailLoader:
    def __init__(self, root: tk.Misc) -> None:
        self.root = root
        self.session = requests.Session()
        self.cache: dict[str, ImageTk.PhotoImage] = {}

    def load(
        self,
        url: str | None,
        size: tuple[int, int],
        on_ready: Callable[[ImageTk.PhotoImage | None], None],
    ) -> None:
        if not url:
            on_ready(None)
            return
        if url in self.cache:
            on_ready(self.cache[url])
            return

        def worker() -> None:
            image_obj: Image.Image | None = None
            try:
                response = self.session.get(url, timeout=15)
                response.raise_for_status()
                image = Image.open(io.BytesIO(response.content)).convert("RGB")
                image.thumbnail(size)
                image_obj = image
            except Exception:
                image_obj = None
            self.root.after(0, lambda: self._finish_load(url, image_obj, on_ready))

        threading.Thread(target=worker, daemon=True).start()

    def _finish_load(
        self,
        url: str,
        image: Image.Image | None,
        on_ready: Callable[[ImageTk.PhotoImage | None], None],
    ) -> None:
        if image is None:
            on_ready(None)
            return
        photo = ImageTk.PhotoImage(image)
        self.cache[url] = photo
        on_ready(photo)


class SearchCard(tk.Frame):
    def __init__(
        self,
        master: tk.Misc,
        colors: dict[str, str],
        result: SearchResult,
        selected: bool,
        on_toggle: Callable[[str], None],
        thumbnail_loader: ThumbnailLoader,
    ) -> None:
        bg = colors["surface_hover"] if selected else colors["surface"]
        border = colors["accent"] if selected else colors["border"]
        super().__init__(
            master,
            bg=bg,
            highlightbackground=border,
            highlightthickness=1,
            padx=_CARD_PAD_X,
            pady=_CARD_PAD_Y,
            cursor="hand2",
        )
        self.result_id = result.id
        self.colors = colors
        self.on_toggle = on_toggle

        self.thumbnail_label = tk.Label(
            self,
            width=18,
            height=8,
            bg=colors["surface_alt"],
            fg=colors["text_muted"],
            text=result.result_type,
            font=("Segoe UI", 10),
        )
        self.thumbnail_label.pack(side="left", padx=(0, _CARD_PAD_X))
        thumbnail_loader.load(result.thumbnail_url, (160, 90), self._set_thumbnail)

        content = tk.Frame(self, bg=bg)
        content.pack(side="left", fill="both", expand=True)

        top_row = tk.Frame(content, bg=bg)
        top_row.pack(fill="x")
        tk.Label(
            top_row,
            text=result.title,
            bg=bg,
            fg=colors["text"],
            font=("Segoe UI", 13, "bold"),
            anchor="w",
        ).pack(side="left", fill="x", expand=True)
        tk.Label(
            top_row,
            text=result.result_type.upper(),
            bg=self._badge_color(result.result_type),
            fg="#ffffff",
            padx=8,
            pady=3,
            font=("Segoe UI", 8, "bold"),
        ).pack(side="right")

        tk.Label(
            content,
            text=result.subtitle,
            bg=bg,
            fg=colors["text_muted"],
            font=("Segoe UI", 10),
            anchor="w",
        ).pack(fill="x", pady=(3, 6))

        tk.Label(
            content,
            text=result.description,
            bg=bg,
            fg=colors["text"],
            font=("Segoe UI", 10),
            wraplength=660,
            justify="left",
            anchor="w",
        ).pack(fill="x")

        for line in result.metadata_lines:
            tk.Label(
                content,
                text=line,
                bg=bg,
                fg=colors["text_muted"],
                wraplength=660,
                justify="left",
                anchor="w",
                font=("Segoe UI", 9),
            ).pack(fill="x", pady=(3, 0))

        action_text = "Selected" if selected else "Select"
        ttk.Button(
            self,
            text=action_text,
            style="Primary.TButton" if selected else "Secondary.TButton",
            command=lambda: on_toggle(result.id),
        ).pack(side="right", padx=(12, 0))

        for widget in (self, content, top_row, self.thumbnail_label):
            widget.bind("<Button-1>", lambda _event: on_toggle(result.id))

    def _badge_color(self, result_type: str) -> str:
        key = {"Artist": "badge_artist", "Album": "badge_album", "Song": "badge_song"}[result_type]
        return self.colors[key]

    def _set_thumbnail(self, image: ImageTk.PhotoImage | None) -> None:
        if not image:
            return
        self.thumbnail_label.configure(image=image, text="")
        self.thumbnail_label.image = image


class DownloadCard(tk.Frame):
    _STATUS_COLORS = {
        "queued": "warning",
        "waiting": "warning",
        "downloading": "queue_downloading",
        "paused": "warning",
        "completed": "queue_completed",
        "failed": "queue_failed",
        "canceled": "queue_canceled",
    }

    def __init__(
        self,
        master: tk.Misc,
        colors: dict[str, str],
        item: DownloadQueueItem,
        is_active: bool,
        on_cancel: Callable[[str], None],
    ) -> None:
        super().__init__(
            master,
            bg=colors["surface"],
            highlightbackground=colors["accent"] if is_active else colors["border"],
            highlightthickness=1,
            padx=_CARD_PAD_X,
            pady=_CARD_PAD_Y,
        )

        top = tk.Frame(self, bg=colors["surface"])
        top.pack(fill="x")
        tk.Label(
            top,
            text=item.source.title,
            bg=colors["surface"],
            fg=colors["text"],
            font=("Segoe UI", 13, "bold"),
            anchor="w",
        ).pack(side="left", fill="x", expand=True)
        tk.Label(
            top,
            text=item.status.upper(),
            bg=colors.get(self._STATUS_COLORS.get(item.status, "accent"), colors["accent"]),
            fg="#ffffff",
            padx=8,
            pady=3,
            font=("Segoe UI", 8, "bold"),
        ).pack(side="right")

        tk.Label(
            self,
            text=self._source_context(item),
            bg=colors["surface"],
            fg=colors["text_muted"],
            font=("Segoe UI", 10),
            anchor="w",
        ).pack(fill="x", pady=(4, 10))

        ttk.Progressbar(
            self,
            style="Horizontal.TProgressbar",
            maximum=100,
            value=item.progress,
        ).pack(fill="x")

        tk.Label(
            self,
            text=item.status_message,
            bg=colors["surface"],
            fg=colors["text"],
            anchor="w",
            font=("Segoe UI", 10),
        ).pack(fill="x", pady=(8, 0))

        detail = item.detail_message or item.error_message or f"Saving to {item.destination_folder}"
        tk.Label(
            self,
            text=detail,
            bg=colors["surface"],
            fg=colors["text_muted"],
            wraplength=650,
            justify="left",
            anchor="w",
            font=("Segoe UI", 9),
        ).pack(fill="x", pady=(3, 0))

        can_cancel = item.status in {"queued", "waiting", "downloading", "paused"}
        ttk.Button(
            self,
            text="Cancel",
            style="Danger.TButton",
            command=lambda: on_cancel(item.id),
            state="normal" if can_cancel else "disabled",
        ).pack(anchor="e", pady=(10, 0))

    def _source_context(self, item: DownloadQueueItem) -> str:
        source = item.source
        album = self._album_name(source)
        if album:
            return f"{source.subtitle} · {album}" if source.subtitle else album
        return source.subtitle

    def _album_name(self, source: SearchResult) -> str:
        for line in getattr(source, "metadata_lines", []):
            normalized = line.strip()
            for prefix in ("album:", "album -", "from album:", "from album -"):
                if normalized.lower().startswith(prefix):
                    return normalized.split(":", 1)[-1].split("-", 1)[-1].strip()
        subtitle = getattr(source, "subtitle", "")
        if " album " in f" {subtitle.lower()} ":
            return subtitle.strip()
        return ""
