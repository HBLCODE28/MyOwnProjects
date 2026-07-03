from __future__ import annotations

import tkinter as tk
from collections.abc import Callable
from pathlib import Path
from tkinter import filedialog, ttk

from music_downloader_app.models import SettingsData

_PAD = 20
_FIELD_GAP = 16


class SettingsScreen(ttk.Frame):
    def __init__(
        self,
        master: tk.Misc,
        colors: dict[str, str],
        settings: SettingsData,
        on_save: Callable[[SettingsData], None],
    ) -> None:
        super().__init__(master)
        self.colors = colors
        self.on_save = on_save
        self.folder_var = tk.StringVar(value=str(settings.download_folder))
        self.quality_var = tk.StringVar(value=settings.mp3_quality)
        self.theme_var = tk.StringVar(value=settings.theme)
        self.message_var = tk.StringVar(value="Configure your download preferences.")
        self._build()

    def refresh_theme(self, colors: dict[str, str]) -> None:
        self.colors = colors
        self.shell.configure(bg=colors["bg"])
        self.card.configure(bg=colors["surface"], highlightbackground=colors["border"])

    def update_settings(self, settings: SettingsData) -> None:
        self.folder_var.set(str(settings.download_folder))
        self.quality_var.set(settings.mp3_quality)
        self.theme_var.set(settings.theme)

    def _build(self) -> None:
        self.shell = tk.Frame(self, bg=self.colors["bg"])
        self.shell.pack(fill="both", expand=True)

        self.card = tk.Frame(
            self.shell,
            bg=self.colors["surface"],
            highlightbackground=self.colors["border"],
            highlightthickness=1,
            padx=_PAD,
            pady=_PAD,
        )
        self.card.pack(fill="x")

        tk.Label(
            self.card,
            text="Settings",
            bg=self.colors["surface"],
            fg=self.colors["text"],
            font=("Segoe UI", 16, "bold"),
        ).pack(anchor="w")

        tk.Label(
            self.card,
            textvariable=self.message_var,
            bg=self.colors["surface"],
            fg=self.colors["text_muted"],
            font=("Segoe UI", 10),
        ).pack(anchor="w", pady=(4, _FIELD_GAP))

        # Divider
        tk.Frame(self.card, bg=self.colors["border"], height=1).pack(fill="x", pady=(0, _FIELD_GAP))

        self._row_label("Download folder")
        folder_row = tk.Frame(self.card, bg=self.colors["surface"])
        folder_row.pack(fill="x", pady=(4, _FIELD_GAP))
        ttk.Entry(folder_row, textvariable=self.folder_var).pack(
            side="left", fill="x", expand=True, ipady=2
        )
        ttk.Button(
            folder_row, text="Browse", style="Secondary.TButton", command=self._browse
        ).pack(side="left", padx=(8, 0))

        self._row_label("MP3 quality")
        ttk.Combobox(
            self.card,
            textvariable=self.quality_var,
            state="readonly",
            values=["128", "160", "192", "256", "320"],
        ).pack(fill="x", pady=(4, _FIELD_GAP), ipady=2)

        self._row_label("Appearance")
        ttk.Combobox(
            self.card,
            textvariable=self.theme_var,
            state="readonly",
            values=["dark", "light"],
        ).pack(fill="x", pady=(4, _FIELD_GAP + 6), ipady=2)

        # Divider before save
        tk.Frame(self.card, bg=self.colors["border"], height=1).pack(fill="x", pady=(0, _FIELD_GAP))

        ttk.Button(
            self.card, text="Save settings", style="Primary.TButton", command=self._save
        ).pack(anchor="e")

    def _row_label(self, text: str) -> None:
        tk.Label(
            self.card,
            text=text,
            bg=self.colors["surface"],
            fg=self.colors["text"],
            font=("Segoe UI", 10, "bold"),
        ).pack(anchor="w")

    def _browse(self) -> None:
        path = filedialog.askdirectory(initialdir=self.folder_var.get() or str(Path.home()))
        if path:
            self.folder_var.set(path)

    def _save(self) -> None:
        settings = SettingsData(
            download_folder=Path(self.folder_var.get()).expanduser(),
            mp3_quality=self.quality_var.get(),
            theme=self.theme_var.get(),
        )
        self.on_save(settings)
        self.message_var.set("Settings saved successfully.")
