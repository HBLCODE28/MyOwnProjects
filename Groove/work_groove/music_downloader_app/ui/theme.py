from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from music_downloader_app.config import THEMES

# Consistent spacing scale used across the whole app
PAD_XS = 4
PAD_SM = 8
PAD_MD = 16
PAD_LG = 24
PAD_XL = 32

FONT_FAMILY = "Segoe UI"


class ThemeManager:
    def __init__(self, root: tk.Tk, theme_name: str) -> None:
        self.root = root
        self.style = ttk.Style(root)
        self.theme_name = theme_name if theme_name in THEMES else "dark"
        self.colors = THEMES[self.theme_name]
        self.style.theme_use("clam")
        self.apply()

    def set_theme(self, theme_name: str) -> None:
        self.theme_name = theme_name if theme_name in THEMES else "dark"
        self.colors = THEMES[self.theme_name]
        self.apply()

    def apply(self) -> None:
        c = self.colors
        input_bg = c.get("input_bg", c["surface"])
        input_fg = c.get("input_fg", c["text"])
        accent_hover = c.get("accent_hover", c["accent"])
        disabled_bg = c.get("disabled_bg", c.get("surface_alt", c["surface"]))
        disabled_fg = c.get("disabled_text", c.get("text_muted", c["text"]))

        self.root.configure(bg=c["bg"])

        self.style.configure("TFrame", background=c["bg"])
        self.style.configure("Card.TFrame", background=c["surface"])

        # Labels - clear hierarchy: Title > Section > Body > Muted
        self.style.configure(
            "TLabel",
            background=c["bg"],
            foreground=c["text"],
            font=(FONT_FAMILY, 11),
        )
        self.style.configure(
            "Surface.TLabel",
            background=c["surface"],
            foreground=c["text"],
            font=(FONT_FAMILY, 11),
        )
        self.style.configure(
            "Title.TLabel",
            background=c["bg"],
            foreground=c["text"],
            font=(FONT_FAMILY, 18, "bold"),
        )
        self.style.configure(
            "Section.TLabel",
            background=c["bg"],
            foreground=c["text"],
            font=(FONT_FAMILY, 13, "bold"),
        )
        self.style.configure(
            "Muted.TLabel",
            background=c["bg"],
            foreground=c["text_muted"],
            font=(FONT_FAMILY, 10),
        )

        # Primary button - filled, high contrast
        self.style.configure(
            "Primary.TButton",
            background=c["accent"],
            foreground=c["accent_text"],
            padding=(PAD_LG, PAD_SM + 1),
            borderwidth=0,
            font=(FONT_FAMILY, 10, "bold"),
            relief="flat",
        )
        self.style.map(
            "Primary.TButton",
            background=[
                ("disabled", disabled_bg),
                ("active", accent_hover),
                ("pressed", accent_hover),
            ],
            foreground=[
                ("disabled", disabled_fg),
                ("active", c["accent_text"]),
                ("pressed", c["accent_text"]),
            ],
        )

        # Secondary button - ghost style
        self.style.configure(
            "Secondary.TButton",
            background=c["surface_alt"],
            foreground=c["text"],
            padding=(PAD_MD + 2, PAD_SM + 1),
            borderwidth=0,
            font=(FONT_FAMILY, 10),
            relief="flat",
        )
        self.style.map(
            "Secondary.TButton",
            background=[
                ("disabled", disabled_bg),
                ("active", c["surface_hover"]),
                ("pressed", c["surface_hover"]),
            ],
            foreground=[
                ("disabled", disabled_fg),
                ("active", c["text"]),
                ("pressed", c["text"]),
            ],
        )

        # Danger button - destructive actions only
        self.style.configure(
            "Danger.TButton",
            background=c["danger"],
            foreground="#ffffff",
            padding=(PAD_MD + 2, PAD_SM + 1),
            borderwidth=0,
            font=(FONT_FAMILY, 10, "bold"),
            relief="flat",
        )
        self.style.map(
            "Danger.TButton",
            background=[
                ("disabled", disabled_bg),
                ("active", c["danger"]),
                ("pressed", c["danger"]),
            ],
            foreground=[
                ("disabled", disabled_fg),
                ("active", "#ffffff"),
                ("pressed", "#ffffff"),
            ],
        )

        self.style.configure(
            "TEntry",
            fieldbackground=input_bg,
            background=input_bg,
            foreground=input_fg,
            borderwidth=1,
            bordercolor=c["border"],
            lightcolor=c["border"],
            darkcolor=c["border"],
            insertcolor=c["text"],
            padding=(PAD_SM + 2, PAD_SM),
            font=(FONT_FAMILY, 11),
        )
        self.style.map(
            "TEntry",
            fieldbackground=[
                ("disabled", input_bg),
                ("readonly", input_bg),
                ("focus", input_bg),
            ],
            foreground=[
                ("disabled", disabled_fg),
                ("readonly", input_fg),
                ("focus", input_fg),
            ],
        )

        self.style.configure(
            "TCombobox",
            fieldbackground=input_bg,
            background=input_bg,
            foreground=input_fg,
            selectbackground=input_bg,
            selectforeground=input_fg,
            bordercolor=c["border"],
            lightcolor=c["border"],
            darkcolor=c["border"],
            arrowcolor=c["text"],
            arrowsize=13,
            padding=(PAD_SM + 2, PAD_SM),
            font=(FONT_FAMILY, 11),
        )
        self.style.map(
            "TCombobox",
            fieldbackground=[
                ("readonly", input_bg),
                ("disabled", input_bg),
                ("focus", input_bg),
            ],
            background=[
                ("readonly", input_bg),
                ("disabled", input_bg),
                ("active", c["surface_hover"]),
            ],
            foreground=[
                ("readonly", input_fg),
                ("disabled", disabled_fg),
                ("focus", input_fg),
            ],
            selectbackground=[("readonly", input_bg), ("focus", input_bg)],
            selectforeground=[("readonly", input_fg), ("focus", input_fg)],
            arrowcolor=[
                ("disabled", disabled_fg),
                ("active", c["text"]),
                ("readonly", c["text"]),
            ],
        )

        # Slim progress bar - more refined
        self.style.configure(
            "Horizontal.TProgressbar",
            background=c["accent"],
            troughcolor=c["surface_alt"],
            borderwidth=0,
            thickness=5,
        )
