from __future__ import annotations

import tkinter as tk
from collections.abc import Callable
from tkinter import ttk

from music_downloader_app.models import SearchFilters, SearchResult
from music_downloader_app.ui.widgets import ScrollableFrame, SearchCard, ThumbnailLoader

_PAD = 20
_GAP = 12

_MODES = [
    ("artist", "Artist", "Albums & singles"),
    ("album", "Album", "Full album"),
    ("song", "Song", "Single track"),
]


class SearchScreen(ttk.Frame):
    def __init__(
        self,
        master: tk.Misc,
        colors: dict[str, str],
        on_search: Callable[[SearchFilters], None],
        on_queue_selected: Callable[[], None],
        on_open_downloads: Callable[[], None],
        thumbnail_loader: ThumbnailLoader,
    ) -> None:
        super().__init__(master)
        self.colors = colors
        self.on_search = on_search
        self.on_queue_selected = on_queue_selected
        self.on_open_downloads = on_open_downloads
        self.thumbnail_loader = thumbnail_loader
        self.selected_ids: set[str] = set()
        self.results: list[SearchResult] = []

        self.mode_var = tk.StringVar(value="artist")
        self.artist_var = tk.StringVar()
        self.album_var = tk.StringVar()
        self.song_var = tk.StringVar()
        self.status_var = tk.StringVar(value="Search for an artist, album, or song to get started.")
        self.selection_var = tk.StringVar(value="No items selected")

        self._build()
        self.refresh_theme(colors)

    def refresh_theme(self, colors: dict[str, str]) -> None:
        self.colors = colors
        self.configure(style="TFrame")
        self.shell.configure(bg=colors["bg"])
        self.search_panel.configure(bg=colors["surface"], highlightbackground=colors["border"])
        for row in (self.form_row, self.action_row, self.footer_row):
            row.configure(bg=colors["surface"])
        self.results_section.configure(bg=colors["bg"])
        self.results_host.canvas.configure(bg=colors["bg"])
        self.results_host.inner.configure(bg=colors["bg"])
        self.results_header.configure(bg=colors["bg"])
        self.empty_state.configure(bg=colors["surface"], highlightbackground=colors["border"])
        for widget in self.mode_buttons.values():
            self._paint_mode_button(widget, widget.mode_value == self.mode_var.get())

    def get_selected_results(self) -> list[SearchResult]:
        return [r for r in self.results if r.id in self.selected_ids]

    def set_loading(self, is_loading: bool) -> None:
        state = "disabled" if is_loading else "normal"
        self.search_button.configure(state=state)
        self.clear_button.configure(state=state)
        self.download_button.configure(
            state="disabled" if is_loading or not self.selected_ids else "normal"
        )

    def update_results(self, results: list[SearchResult]) -> None:
        self.results = results
        self.selected_ids.clear()
        self._update_selection_text()
        self._render_results()

    def set_empty_state(self, title: str, message: str) -> None:
        self.results = []
        self.selected_ids.clear()
        self._update_selection_text()
        self._clear_results()
        tk.Label(
            self.empty_state,
            text=title,
            bg=self.colors["surface"],
            fg=self.colors["text"],
            font=("Segoe UI", 14, "bold"),
        ).pack(anchor="w")
        tk.Label(
            self.empty_state,
            text=message,
            bg=self.colors["surface"],
            fg=self.colors["text_muted"],
            font=("Segoe UI", 10),
            wraplength=800,
            justify="left",
        ).pack(anchor="w", pady=(4, 0))
        self.empty_state.pack(fill="x", pady=(0, _GAP))
        self.download_button.configure(state="disabled")

    def set_status(self, text: str) -> None:
        self.status_var.set(text)

    def reset(self) -> None:
        self.artist_var.set("")
        self.album_var.set("")
        self.song_var.set("")
        self.set_status("Search for an artist, album, or song to get started.")
        self.set_empty_state("Start here", "Search for an artist, album, or song to get started.")

    def _build(self) -> None:
        self.shell = tk.Frame(self, bg=self.colors["bg"])
        self.shell.pack(fill="both", expand=True)
        self.shell.grid_columnconfigure(0, weight=1)
        self.shell.grid_rowconfigure(0, weight=0)
        self.shell.grid_rowconfigure(1, weight=1)
        self.shell.bind("<Configure>", self._resize_results_area)

        # Search panel
        self.search_panel = tk.Frame(
            self.shell,
            bg=self.colors["surface"],
            highlightthickness=1,
            padx=_PAD,
            pady=_PAD,
        )
        self.search_panel.grid(row=0, column=0, sticky="ew", pady=(0, _GAP))
        self.search_panel.grid_columnconfigure(0, weight=1)

        # Panel header
        header_row = tk.Frame(self.search_panel, bg=self.colors["surface"])
        header_row.grid(row=0, column=0, sticky="ew", pady=(0, _GAP))
        header_row.grid_columnconfigure(0, weight=1)
        tk.Label(
            header_row,
            text="Find music",
            bg=self.colors["surface"],
            fg=self.colors["text"],
            font=("Segoe UI", 16, "bold"),
        ).grid(row=0, column=0, sticky="w")
        tk.Label(
            header_row,
            textvariable=self.selection_var,
            bg=self.colors["surface"],
            fg=self.colors["text_muted"],
            font=("Segoe UI", 10),
        ).grid(row=0, column=1, sticky="e")

        # Mode selector
        mode_row = tk.Frame(self.search_panel, bg=self.colors["surface"])
        mode_row.grid(row=1, column=0, sticky="ew", pady=(0, _GAP))
        mode_row.grid_columnconfigure((0, 1, 2), weight=1, uniform="mode")

        self.mode_buttons: dict[str, tk.Frame] = {}
        for index, (value, title, hint) in enumerate(_MODES):
            button = tk.Frame(
                mode_row,
                bg=self.colors["surface_alt"],
                highlightthickness=1,
                padx=12,
                pady=10,
                cursor="hand2",
            )
            button.mode_value = value
            button.grid(row=0, column=index, sticky="ew", padx=(0, 8 if index < 2 else 0))
            tk.Label(
                button,
                text=title,
                bg=self.colors["surface_alt"],
                fg=self.colors["text"],
                font=("Segoe UI", 11, "bold"),
            ).pack(anchor="w")
            tk.Label(
                button,
                text=hint,
                bg=self.colors["surface_alt"],
                fg=self.colors["text_muted"],
                font=("Segoe UI", 9),
            ).pack(anchor="w")
            button.bind("<Button-1>", lambda _e, v=value: self._set_mode(v))
            for child in button.winfo_children():
                child.bind("<Button-1>", lambda _e, v=value: self._set_mode(v))
            self.mode_buttons[value] = button

        # Input fields
        self.form_row = tk.Frame(self.search_panel, bg=self.colors["surface"])
        self.form_row.grid(row=2, column=0, sticky="ew")
        self.form_row.grid_columnconfigure((0, 1, 2), weight=1, uniform="field")
        self.artist_entry = self._make_field(self.form_row, 0, "Artist", self.artist_var)
        self.album_entry = self._make_field(self.form_row, 1, "Album", self.album_var)
        self.song_entry = self._make_field(self.form_row, 2, "Song", self.song_var)

        # Action row
        self.action_row = tk.Frame(self.search_panel, bg=self.colors["surface"])
        self.action_row.grid(row=3, column=0, sticky="ew", pady=(_GAP, 0))
        self.action_row.grid_columnconfigure(2, weight=1)

        self.search_button = ttk.Button(
            self.action_row, text="Search", style="Primary.TButton", command=self._submit_search
        )
        self.search_button.grid(row=0, column=0, sticky="w")

        self.clear_button = ttk.Button(
            self.action_row, text="Clear", style="Secondary.TButton", command=self.reset
        )
        self.clear_button.grid(row=0, column=1, sticky="w", padx=(8, 0))

        ttk.Button(
            self.action_row,
            text="Open folder",
            style="Secondary.TButton",
            command=self.on_open_downloads,
        ).grid(row=0, column=3, sticky="e", padx=(0, 8))

        self.download_button = ttk.Button(
            self.action_row,
            text="Add to downloads",
            style="Primary.TButton",
            command=self.on_queue_selected,
            state="disabled",
        )
        self.download_button.grid(row=0, column=4, sticky="e")

        # Status bar
        self.footer_row = tk.Frame(self.search_panel, bg=self.colors["surface"])
        self.footer_row.grid(row=4, column=0, sticky="ew", pady=(8, 0))
        tk.Label(
            self.footer_row,
            textvariable=self.status_var,
            bg=self.colors["surface"],
            fg=self.colors["text_muted"],
            font=("Segoe UI", 9),
        ).pack(side="left")

        # Results section
        self.results_section = tk.Frame(self.shell, bg=self.colors["bg"])
        self.results_section.grid(row=1, column=0, sticky="nsew")
        self.results_section.grid_columnconfigure(0, weight=1)
        self.results_section.grid_rowconfigure(1, weight=1)

        self.results_header = tk.Frame(self.results_section, bg=self.colors["bg"])
        self.results_header.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        tk.Label(
            self.results_header,
            text="Results",
            bg=self.colors["bg"],
            fg=self.colors["text"],
            font=("Segoe UI", 13, "bold"),
        ).pack(side="left")

        self.results_host = ScrollableFrame(self.results_section, bg=self.colors["bg"])
        self.results_host.grid(row=1, column=0, sticky="nsew")
        self._create_empty_state()
        self.reset()
        self._set_mode("artist")

    def _resize_results_area(self, event: tk.Event) -> None:
        self.shell.grid_rowconfigure(1, minsize=max(260, event.height // 2))

    def _make_field(self, parent: tk.Misc, column: int, label: str, variable: tk.StringVar) -> ttk.Entry:
        container = tk.Frame(parent, bg=self.colors["surface"])
        container.grid(row=0, column=column, sticky="ew", padx=(0, 8 if column < 2 else 0))
        tk.Label(
            container,
            text=label,
            bg=self.colors["surface"],
            fg=self.colors["text_muted"],
            font=("Segoe UI", 9, "bold"),
        ).pack(anchor="w")
        entry = ttk.Entry(container, textvariable=variable)
        entry.pack(fill="x", pady=(3, 0))
        entry.bind("<Return>", lambda _event: self._submit_search())
        return entry

    def _set_mode(self, mode: str) -> None:
        self.mode_var.set(mode)
        for value, widget in self.mode_buttons.items():
            self._paint_mode_button(widget, value == mode)
        self.album_entry.configure(state="normal" if mode == "album" else "disabled")
        self.song_entry.configure(state="normal" if mode == "song" else "disabled")

    def _paint_mode_button(self, button: tk.Frame, selected: bool) -> None:
        bg = self.colors["accent_soft"] if selected else self.colors["surface_alt"]
        border = self.colors["accent"] if selected else self.colors["border"]
        button.configure(bg=bg, highlightbackground=border)
        for child in button.winfo_children():
            child.configure(bg=bg)

    def _submit_search(self) -> None:
        self.on_search(SearchFilters(
            mode=self.mode_var.get(),
            artist=self.artist_var.get().strip(),
            album=self.album_var.get().strip(),
            song=self.song_var.get().strip(),
        ))

    def _clear_results(self) -> None:
        for child in self.results_host.inner.winfo_children():
            child.destroy()
        self._create_empty_state()

    def _create_empty_state(self) -> None:
        self.empty_state = tk.Frame(
            self.results_host.inner,
            bg=self.colors["surface"],
            highlightthickness=1,
            padx=_PAD,
            pady=_PAD,
        )

    def _render_results(self) -> None:
        self._clear_results()
        if not self.results:
            self.set_empty_state("No results found", "Try a different search.")
            return
        for result in self.results:
            SearchCard(
                self.results_host.inner,
                colors=self.colors,
                result=result,
                selected=result.id in self.selected_ids,
                on_toggle=self._toggle_selection,
                thumbnail_loader=self.thumbnail_loader,
            ).pack(fill="x", pady=(0, _GAP))
        self.download_button.configure(state="normal" if self.selected_ids else "disabled")

    def _toggle_selection(self, result_id: str) -> None:
        if result_id in self.selected_ids:
            self.selected_ids.remove(result_id)
        else:
            self.selected_ids.add(result_id)
        self._update_selection_text()
        self._render_results()

    def _update_selection_text(self) -> None:
        count = len(self.selected_ids)
        self.selection_var.set(
            f"{count} item{'s' if count != 1 else ''} selected" if count else "No items selected"
        )
        self.download_button.configure(state="normal" if count else "disabled")
