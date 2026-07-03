from __future__ import annotations

import logging
import os
import queue
import re
import subprocess
import sys
import threading
from dataclasses import replace
from pathlib import Path

import requests
from uuid import uuid4

from PySide6.QtCore import QEvent, QRectF, Qt, QTimer, Signal
from PySide6.QtGui import QBrush, QColor, QDesktopServices, QFont, QIcon, QPainter, QPen, QPixmap, QRadialGradient
from PySide6.QtWidgets import (
    QApplication,
    QAbstractItemView,
    QButtonGroup,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QFileDialog,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QScrollArea,
    QStackedWidget,
    QVBoxLayout,
    QWidget,
)

from music_downloader_app.config import APP_DATA_DIR, APP_NAME, LOG_DIR, PROJECT_ROOT
from music_downloader_app.models import QueueSnapshot, SearchFilters, SearchResult, SettingsData
from music_downloader_app.services.downloads import DownloadService
from music_downloader_app.services.musicbrainz import MusicMetadataService
from music_downloader_app.services.settings import SettingsService
from music_downloader_app.services.youtube import YouTubeService, format_length


DARK_STYLE = """
* { font-family: Segoe UI, Arial; font-size: 10.5pt; }
QMainWindow, QWidget#Root { background: #070b16; color: #f8fafc; }
QWidget#Page { background: transparent; }
QFrame#Header { background: transparent; border: none; }
QFrame#FooterBrand { background: rgba(15,23,42,230); border: 1px solid #334155; border-radius: 22px; }
QFrame#Card { background: rgba(17,24,39,238); border: 1px solid #243044; border-radius: 22px; }
QFrame#HeroCard { background: rgba(15,23,42,245); border: 1px solid #2f3d55; border-radius: 28px; }
QFrame#WelcomeCard { background: qlineargradient(x1:0,y1:0,x2:1,y2:1, stop:0 #101a33, stop:0.55 #111827, stop:1 #0a1022); border: 1px solid #334155; border-radius: 34px; }
QFrame#FloatingNav { background: rgba(15,23,42,230); border: 1px solid #334155; border-radius: 27px; }
QFrame#ResultCard, QFrame#QueueCard { background: rgba(21,31,50,240); border: 1px solid #2f3d55; border-radius: 20px; }
QFrame#ResultCard[selected="true"] { border: 2px solid #60a5fa; background: rgba(23,41,72,245); }
QLabel { color: #f8fafc; }
QLabel#Muted { color: #94a3b8; }
QLabel#Title { font-size: 24pt; font-weight: 800; }
QLabel#AppHeroTitle { font-size: 38pt; font-weight: 900; letter-spacing: 1px; }
QLabel#HeroSubtitle { color: #cbd5e1; font-size: 13pt; }
QLabel#SectionTitle { font-size: 15pt; font-weight: 800; }
QLineEdit, QComboBox { background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 14px; padding: 10px 13px; }
QLineEdit[blocked="true"] { background: rgba(255,255,255,225); color: #0f172a; border: 1px solid rgba(255,255,255,235); font-weight: 600; }
QPushButton { background: #1f2937; color: #f8fafc; border: 1px solid #334155; border-radius: 14px; padding: 10px 16px; font-weight: 650; }
QPushButton:hover { background: #263449; }
QPushButton#Primary { background: #2563eb; border-color: #2563eb; color: white; }
QPushButton#Primary:hover { background: #1d4ed8; }
QPushButton#Danger { background: #7f1d1d; border-color: #991b1b; color: white; }
QPushButton#NavButton { background: transparent; border: none; color: #cbd5e1; border-radius: 19px; padding: 9px 20px; min-width: 84px; }
QPushButton#NavButton:hover, QPushButton#NavButton:focus { background: rgba(148,163,184,35); color: #ffffff; }
QPushButton#NavButtonActive { background: #2563eb; border: none; color: #ffffff; border-radius: 19px; padding: 9px 20px; min-width: 84px; }
QPushButton:disabled { background: #111827; color: #64748b; border-color: #263244; }
QProgressBar { background: #0f172a; border: 1px solid #334155; border-radius: 8px; text-align: center; color: #f8fafc; height: 15px; }
QProgressBar::chunk { background: #2563eb; border-radius: 8px; }
QScrollArea { border: none; background: transparent; }
QListWidget { background: rgba(15,23,42,180); border: 1px solid #263244; border-radius: 16px; color: #f8fafc; padding: 8px; }
"""


LIGHT_STYLE = """
* { font-family: Segoe UI, Arial; font-size: 10.5pt; }
QMainWindow, QWidget#Root { background: #eef3f8; color: #0f172a; }
QWidget#Page { background: transparent; }
QFrame#Header { background: transparent; border: none; }
QFrame#FooterBrand { background: rgba(255,255,255,235); border: 1px solid #cbd5e1; border-radius: 22px; }
QFrame#Card { background: rgba(255,255,255,245); border: 1px solid #d9e2ef; border-radius: 22px; }
QFrame#HeroCard { background: white; border: 1px solid #d9e2ef; border-radius: 28px; }
QFrame#WelcomeCard { background: qlineargradient(x1:0,y1:0,x2:1,y2:1, stop:0 #ffffff, stop:0.60 #eff6ff, stop:1 #e0e7ff); border: 1px solid #cbd5e1; border-radius: 34px; }
QFrame#FloatingNav { background: rgba(255,255,255,235); border: 1px solid #cbd5e1; border-radius: 27px; }
QFrame#ResultCard, QFrame#QueueCard { background: rgba(255,255,255,245); border: 1px solid #d9e2ef; border-radius: 20px; }
QFrame#ResultCard[selected="true"] { border: 2px solid #2563eb; background: #eff6ff; }
QLabel { color: #0f172a; }
QLabel#Muted { color: #64748b; }
QLabel#Title { font-size: 24pt; font-weight: 800; }
QLabel#AppHeroTitle { font-size: 38pt; font-weight: 900; letter-spacing: 1px; }
QLabel#HeroSubtitle { color: #334155; font-size: 13pt; }
QLabel#SectionTitle { font-size: 15pt; font-weight: 800; }
QLineEdit, QComboBox { background: white; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 14px; padding: 10px 13px; }
QLineEdit[blocked="true"] { background: rgba(255,255,255,235); color: #334155; border: 1px solid rgba(148,163,184,220); font-weight: 600; }
QPushButton { background: #f8fafc; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 14px; padding: 10px 16px; font-weight: 650; }
QPushButton:hover { background: #e2e8f0; }
QPushButton#Primary { background: #2563eb; border-color: #2563eb; color: white; }
QPushButton#Primary:hover { background: #1d4ed8; }
QPushButton#Danger { background: #dc2626; border-color: #dc2626; color: white; }
QPushButton#NavButton { background: transparent; border: none; color: #334155; border-radius: 19px; padding: 9px 20px; min-width: 84px; }
QPushButton#NavButton:hover, QPushButton#NavButton:focus { background: rgba(37,99,235,25); color: #0f172a; }
QPushButton#NavButtonActive { background: #2563eb; border: none; color: #ffffff; border-radius: 19px; padding: 9px 20px; min-width: 84px; }
QPushButton:disabled { background: #f1f5f9; color: #94a3b8; border-color: #e2e8f0; }
QProgressBar { background: white; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center; color: #0f172a; height: 15px; }
QProgressBar::chunk { background: #2563eb; border-radius: 8px; }
QScrollArea { border: none; background: transparent; }
QListWidget { background: rgba(255,255,255,230); border: 1px solid #d9e2ef; border-radius: 16px; color: #0f172a; padding: 8px; }
"""


SUSPICIOUS_RELEASE_WORDS = ("cover", "covers", "unreleased", "demo", "bootleg")
APP_ICON_PATH = PROJECT_ROOT / "assets" / "app_icon.ico"


def configure_logging() -> None:
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        filename=LOG_DIR / "app.log",
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def clear_layout(layout: QVBoxLayout | QHBoxLayout) -> None:
    while layout.count():
        item = layout.takeAt(0)
        widget = item.widget()
        if widget is not None:
            widget.deleteLater()


def label(text: str, object_name: str | None = None, word_wrap: bool = False) -> QLabel:
    w = QLabel(text)
    if object_name:
        w.setObjectName(object_name)
    w.setWordWrap(word_wrap)
    return w


def repolish(widget: QWidget) -> None:
    widget.style().unpolish(widget)
    widget.style().polish(widget)


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



class SpinningRecordWidget(QWidget):
    """Animated vinyl record for the welcome screen.

    This is a lightweight Qt animation: a timer increments the rotation angle and
    the paint event draws the record using vector primitives. No external GIF or
    video file is required, so the installer remains self-contained.
    """

    def __init__(self, size: int = 230, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._angle = 0
        self._size = size
        self.setFixedSize(size, size)
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self.setAttribute(Qt.WA_TranslucentBackground, True)

    def start(self) -> None:
        if not self._timer.isActive():
            self._timer.start(16)

    def stop(self) -> None:
        self._timer.stop()

    def _tick(self) -> None:
        self._angle = (self._angle + 2) % 360
        self.update()

    def paintEvent(self, event) -> None:
        del event
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing, True)
        painter.setRenderHint(QPainter.SmoothPixmapTransform, True)

        w = self.width()
        h = self.height()
        center_x = w / 2
        center_y = h / 2
        radius = min(w, h) / 2 - 12
        record_rect = QRectF(center_x - radius, center_y - radius, radius * 2, radius * 2)

        shadow = QColor(0, 0, 0, 70)
        painter.setPen(Qt.NoPen)
        painter.setBrush(QBrush(shadow))
        painter.drawEllipse(record_rect.adjusted(4, 8, 4, 8))

        gradient = QRadialGradient(center_x - radius * 0.28, center_y - radius * 0.34, radius * 1.2)
        gradient.setColorAt(0.0, QColor('#334155'))
        gradient.setColorAt(0.45, QColor('#111827'))
        gradient.setColorAt(1.0, QColor('#020617'))
        painter.setBrush(QBrush(gradient))
        painter.drawEllipse(record_rect)

        painter.save()
        painter.translate(center_x, center_y)
        painter.rotate(self._angle)
        painter.translate(-center_x, -center_y)

        ring_colors = [QColor('#1d4ed8'), QColor('#2563eb'), QColor('#38bdf8'), QColor('#8b5cf6')]
        for i, inset in enumerate((18, 34, 50, 68, 88)):
            color = ring_colors[i % len(ring_colors)]
            color.setAlpha(130 if i < 2 else 90)
            painter.setPen(QPen(color, 2))
            painter.setBrush(Qt.NoBrush)
            painter.drawEllipse(record_rect.adjusted(inset, inset, -inset, -inset))

        arc_pen = QPen(QColor('#60a5fa'), 5)
        arc_pen.setCapStyle(Qt.RoundCap)
        painter.setPen(arc_pen)
        painter.drawArc(record_rect.adjusted(24, 24, -24, -24), 20 * 16, 72 * 16)
        painter.setPen(QPen(QColor('#a78bfa'), 4))
        painter.drawArc(record_rect.adjusted(42, 42, -42, -42), 205 * 16, 58 * 16)
        painter.restore()

        painter.setPen(Qt.NoPen)
        painter.setBrush(QBrush(QColor('#2563eb')))
        label_radius = radius * 0.31
        painter.drawEllipse(QRectF(center_x - label_radius, center_y - label_radius, label_radius * 2, label_radius * 2))
        painter.setBrush(QBrush(QColor('#0f172a')))
        hole_radius = radius * 0.075
        painter.drawEllipse(QRectF(center_x - hole_radius, center_y - hole_radius, hole_radius * 2, hole_radius * 2))

        painter.setPen(QColor('#e0f2fe'))
        font = QFont('Segoe UI Symbol', int(radius * 0.34), QFont.Bold)
        painter.setFont(font)
        painter.drawText(record_rect, Qt.AlignCenter, '♪')

class ThumbnailView(QLabel):
    image_ready = Signal(bytes)

    def __init__(self, text: str, url: str | None, width: int = 160, height: int = 90) -> None:
        super().__init__(text)
        self.setFixedSize(width, height)
        self.setAlignment(Qt.AlignCenter)
        self.setWordWrap(True)
        self._fallback_style = "background:#2563eb;color:white;border-radius:12px;font-weight:700;"
        self.setStyleSheet(self._fallback_style)
        self.image_ready.connect(self._apply_image)
        if url:
            threading.Thread(target=self._download_image, args=(url,), daemon=True).start()

    def _download_image(self, url: str) -> None:
        try:
            response = requests.get(url, timeout=15, headers={"User-Agent": "Groove/3.0"})
            response.raise_for_status()
            self.image_ready.emit(response.content)
        except Exception:
            return

    def _apply_image(self, data: bytes) -> None:
        pixmap = QPixmap()
        if not pixmap.loadFromData(data):
            return
        self.setStyleSheet("background: transparent; border: none;")
        self.setPixmap(pixmap.scaled(self.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation))
        self.setText("")


class ResultCard(QFrame):
    def __init__(self, result: SearchResult, selected: bool, on_toggle) -> None:
        super().__init__()
        self.result = result
        self.on_toggle = on_toggle
        self.setObjectName("ResultCard")
        self.setProperty("selected", "true" if selected else "false")
        self.setCursor(Qt.PointingHandCursor)
        root = QHBoxLayout(self)
        root.setContentsMargins(18, 16, 18, 16)
        root.setSpacing(14)

        thumbnail = ThumbnailView(result.result_type, result.thumbnail_url)
        root.addWidget(thumbnail)

        text = QVBoxLayout()
        text.setSpacing(5)
        title = label(result.title, "SectionTitle", True)
        text.addWidget(title)
        text.addWidget(label(result.subtitle, "Muted", True))
        text.addWidget(label(result.description, None, True))
        for line in result.metadata_lines[:4]:
            text.addWidget(label(line, "Muted", True))
        root.addLayout(text, 1)

        button = QPushButton("Selected" if selected else "Select")
        button.setObjectName("Primary" if selected else "")
        button.clicked.connect(lambda: on_toggle(result.id))
        root.addWidget(button)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.on_toggle(self.result.id)
        super().mousePressEvent(event)


class QueueCard(QFrame):
    def __init__(self, item, is_active: bool, on_cancel) -> None:
        super().__init__()
        self.setObjectName("QueueCard")
        root = QVBoxLayout(self)
        root.setContentsMargins(18, 16, 18, 16)
        root.setSpacing(8)
        top = QHBoxLayout()
        top.addWidget(label(item.source.title, "SectionTitle", True), 1)
        status = QLabel(item.status.upper())
        status.setAlignment(Qt.AlignCenter)
        status.setStyleSheet("background:#2563eb;color:white;border-radius:10px;padding:5px 10px;font-weight:700;")
        top.addWidget(status)
        root.addLayout(top)
        root.addWidget(label(item.source.subtitle, "Muted", True))
        progress = QProgressBar()
        progress.setRange(0, 100)
        progress.setValue(int(item.progress or 0))
        root.addWidget(progress)
        root.addWidget(label(item.status_message, None, True))
        detail = item.detail_message or item.error_message or f"Saving to {item.destination_folder}"
        root.addWidget(label(detail, "Muted", True))
        cancel = QPushButton("Cancel")
        cancel.setObjectName("Danger")
        cancel.setEnabled(item.status in {"queued", "waiting", "downloading", "paused"})
        cancel.clicked.connect(lambda: on_cancel(item.id))
        row = QHBoxLayout()
        row.addStretch(1)
        row.addWidget(cancel)
        root.addLayout(row)


class DownloadPreviewDialog(QDialog):
    def __init__(self, rows: list[dict], parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Review download list")
        self.resize(760, 520)
        layout = QVBoxLayout(self)
        layout.addWidget(label("Review before download", "SectionTitle"))
        layout.addWidget(label("Uncheck songs or videos you do not want to download. Only checked items will be added to the queue.", "Muted", True))

        self.list_widget = QListWidget()
        self.list_widget.setSelectionMode(QAbstractItemView.NoSelection)
        self.rows = rows
        for row in rows:
            item = QListWidgetItem(row["display"])
            item.setFlags(item.flags() | Qt.ItemIsUserCheckable)
            item.setCheckState(Qt.Checked)
            self.list_widget.addItem(item)
        layout.addWidget(self.list_widget, 1)

        quick_row = QHBoxLayout()
        all_btn = QPushButton("Select all")
        none_btn = QPushButton("Clear all")
        all_btn.clicked.connect(lambda: self._set_all(Qt.Checked))
        none_btn.clicked.connect(lambda: self._set_all(Qt.Unchecked))
        quick_row.addWidget(all_btn)
        quick_row.addWidget(none_btn)
        quick_row.addStretch(1)
        layout.addLayout(quick_row)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.button(QDialogButtonBox.Ok).setText("Add checked to downloads")
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _set_all(self, state: Qt.CheckState) -> None:
        for index in range(self.list_widget.count()):
            self.list_widget.item(index).setCheckState(state)

    def checked_rows(self) -> list[dict]:
        checked: list[dict] = []
        for index, row in enumerate(self.rows):
            if self.list_widget.item(index).checkState() == Qt.Checked:
                checked.append(row)
        return checked


class SuspiciousReleaseDialog(QDialog):
    def __init__(self, artist_name: str, releases: list[dict], parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.choice = "skip"
        self.setWindowTitle("Possible covers or unreleased releases")
        self.resize(720, 420)
        layout = QVBoxLayout(self)
        layout.addWidget(label(f"Possible covers/unreleased items found for {artist_name}", "SectionTitle", True))
        layout.addWidget(label("Choose whether these items should be downloaded. Use 'The list is wrong' when the detection is not correct.", "Muted", True))
        items = QListWidget()
        for release in releases:
            items.addItem(self._release_text(release))
        layout.addWidget(items, 1)

        row = QHBoxLayout()
        include_btn = QPushButton("Download these too")
        skip_btn = QPushButton("Skip these")
        wrong_btn = QPushButton("The list is wrong")
        cancel_btn = QPushButton("Cancel")
        include_btn.setObjectName("Primary")
        include_btn.clicked.connect(lambda: self._choose("include"))
        skip_btn.clicked.connect(lambda: self._choose("skip"))
        wrong_btn.clicked.connect(lambda: self._choose("wrong"))
        cancel_btn.clicked.connect(self.reject)
        row.addWidget(include_btn)
        row.addWidget(skip_btn)
        row.addWidget(wrong_btn)
        row.addStretch(1)
        row.addWidget(cancel_btn)
        layout.addLayout(row)

    def _choose(self, choice: str) -> None:
        self.choice = choice
        self.accept()

    def _release_text(self, release: dict) -> str:
        title = release.get("title", "Unknown title")
        year = release.get("first-release-date") or "unknown date"
        release_type = release.get("_requested_type") or release.get("primary-type") or "release"
        return f"{title} - {release_type} - {year}"


class MusicDownloaderQtApp(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        configure_logging()
        self.logger = logging.getLogger(__name__)
        self.setWindowTitle(APP_NAME)
        if APP_ICON_PATH.exists():
            self.setWindowIcon(QIcon(str(APP_ICON_PATH)))
        self.resize(1320, 860)
        self.setMinimumSize(1080, 720)

        self.settings_service = SettingsService()
        self.settings = self.settings_service.load()
        self.metadata_service = MusicMetadataService()
        self.youtube_service = YouTubeService()
        self.event_queue: queue.Queue[tuple[str, object]] = queue.Queue()
        self.download_service = DownloadService(
            metadata_service=self.metadata_service,
            youtube_service=self.youtube_service,
            settings=self.settings,
            listener=lambda snapshot: self.event_queue.put(("queue", snapshot)),
        )
        self.search_results: list[SearchResult] = []
        self.selected_ids: set[str] = set()
        self.video_results: list[SearchResult] = []
        self.selected_video_ids: set[str] = set()
        self.nav_buttons: dict[str, QPushButton] = {}

        self.root = QWidget()
        self.root.setObjectName("Root")
        self.setCentralWidget(self.root)
        self.apply_theme()
        self.build_ui()

        self.timer = QTimer(self)
        self.timer.timeout.connect(self.poll_events)
        self.timer.start(120)
        self.render_queue(self.download_service.get_snapshot())

    def apply_theme(self) -> None:
        QApplication.instance().setStyleSheet(DARK_STYLE if self.settings.theme == "dark" else LIGHT_STYLE)

    def build_ui(self) -> None:
        root = QVBoxLayout(self.root)
        root.setContentsMargins(26, 22, 26, 18)
        root.setSpacing(16)

        self.nav_order = ["music", "videos", "downloads", "settings"]
        self.current_screen = "welcome"

        self.header = QFrame()
        self.header.setObjectName("Header")
        header_layout = QHBoxLayout(self.header)
        header_layout.setContentsMargins(0, 0, 0, 0)
        header_layout.setSpacing(0)
        header_layout.addStretch(1)

        self.nav_container = QFrame()
        self.nav_container.setObjectName("FloatingNav")
        self.nav_container.setFocusPolicy(Qt.StrongFocus)
        self.nav_container.installEventFilter(self)
        nav_layout = QHBoxLayout(self.nav_container)
        nav_layout.setContentsMargins(8, 7, 8, 7)
        nav_layout.setSpacing(5)
        for name, text in [("music", "Music"), ("videos", "Videos"), ("downloads", "Downloads"), ("settings", "Settings")]:
            btn = QPushButton(text)
            btn.setObjectName("NavButton")
            btn.setFocusPolicy(Qt.StrongFocus)
            btn.installEventFilter(self)
            btn.clicked.connect(lambda checked=False, n=name: self.show_screen(n))
            nav_layout.addWidget(btn)
            self.nav_buttons[name] = btn
        header_layout.addWidget(self.nav_container, 0, Qt.AlignCenter)
        header_layout.addStretch(1)
        root.addWidget(self.header)

        self.stack = QStackedWidget()
        self.welcome_page = self.build_welcome_page()
        self.search_page = self.build_search_page()
        self.video_page = self.build_video_page()
        self.downloads_page = self.build_downloads_page()
        self.settings_page = self.build_settings_page()
        self.stack.addWidget(self.welcome_page)
        self.stack.addWidget(self.search_page)
        self.stack.addWidget(self.video_page)
        self.stack.addWidget(self.downloads_page)
        self.stack.addWidget(self.settings_page)
        root.addWidget(self.stack, 1)

        self.footer = QWidget()
        footer_layout = QHBoxLayout(self.footer)
        footer_layout.setContentsMargins(0, 0, 0, 0)
        footer_layout.setSpacing(12)

        brand = QFrame()
        brand.setObjectName("FooterBrand")
        brand_layout = QVBoxLayout(brand)
        brand_layout.setContentsMargins(18, 10, 18, 10)
        brand_layout.setSpacing(0)
        brand_layout.addWidget(label(APP_NAME, "SectionTitle"))
        brand_layout.addWidget(label("Pick what you love.", "Muted"))
        footer_layout.addWidget(brand, 0, Qt.AlignLeft | Qt.AlignBottom)
        footer_layout.addStretch(1)

        self.open_btn = QPushButton("Open downloads")
        self.open_btn.clicked.connect(self.open_downloads_folder)
        footer_layout.addWidget(self.open_btn, 0, Qt.AlignRight | Qt.AlignBottom)
        root.addWidget(self.footer)

        self.show_screen("welcome")

    def build_welcome_page(self) -> QWidget:
        page = QWidget()
        page.setObjectName("Page")
        outer = QVBoxLayout(page)
        outer.setContentsMargins(32, 28, 32, 28)
        outer.addStretch(1)

        hero = QFrame()
        hero.setObjectName("WelcomeCard")
        hero.setMaximumWidth(780)
        layout = QVBoxLayout(hero)
        layout.setContentsMargins(44, 34, 44, 34)
        layout.setSpacing(12)

        self.record_widget = SpinningRecordWidget(205)
        layout.addWidget(self.record_widget, 0, Qt.AlignHCenter)

        title = label(APP_NAME, "AppHeroTitle")
        title.setAlignment(Qt.AlignCenter)
        layout.addWidget(title)

        subtitle = label("Pick what you love.", "HeroSubtitle")
        subtitle.setAlignment(Qt.AlignCenter)
        layout.addWidget(subtitle)

        body = label(
            "Search music and videos, review every item, remove what you do not want, and save clean MP3/MP4 files.",
            "Muted",
            True,
        )
        body.setAlignment(Qt.AlignCenter)
        body.setMaximumWidth(560)
        layout.addWidget(body, 0, Qt.AlignHCenter)

        enter_btn = QPushButton("Enter Groove")
        enter_btn.setObjectName("Primary")
        enter_btn.setMinimumWidth(190)
        enter_btn.clicked.connect(lambda: self.show_screen("music"))
        layout.addWidget(enter_btn, 0, Qt.AlignHCenter)

        note = label("No login or registration needed.", "Muted")
        note.setAlignment(Qt.AlignCenter)
        layout.addWidget(note)

        outer.addWidget(hero, 0, Qt.AlignHCenter)
        outer.addStretch(1)
        return page

    def build_search_page(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(14)

        card = QFrame()
        card.setObjectName("Card")
        form = QVBoxLayout(card)
        form.setContentsMargins(20, 18, 20, 18)
        form.setSpacing(12)
        form.addWidget(label("Find music", "SectionTitle"))
        form.addWidget(label("Search artists, albums, or songs. Music results are queued as MP3 files. Band and artist images are loaded from Wikipedia/Wikimedia when available.", "Muted", True))

        mode_row = QHBoxLayout()
        self.mode_group = QButtonGroup(self)
        for mode in ("artist", "album", "song"):
            btn = QPushButton(mode.title())
            btn.setCheckable(True)
            btn.clicked.connect(lambda checked=False, m=mode: self.update_mode(m))
            self.mode_group.addButton(btn)
            mode_row.addWidget(btn)
            if mode == "artist":
                btn.setChecked(True)
        form.addLayout(mode_row)

        fields = QHBoxLayout()
        self.artist_input = QLineEdit()
        self.artist_input.setPlaceholderText("Artist")
        self.album_input = QLineEdit()
        self.album_input.setPlaceholderText("Album")
        self.song_input = QLineEdit()
        self.song_input.setPlaceholderText("Song")
        self.album_input.setToolTip("Album mode needs artist and album. Song is not needed.")
        self.song_input.setToolTip("This field is only needed in Song mode. Album mode does not need a song name.")
        for field in (self.artist_input, self.album_input, self.song_input):
            field.returnPressed.connect(self.start_search)
            fields.addWidget(field)
        form.addLayout(fields)

        actions = QHBoxLayout()
        self.search_status = label("Search for an artist, album, or song to get started.", "Muted")
        actions.addWidget(self.search_status, 1)
        self.search_button = QPushButton("Search")
        self.search_button.setObjectName("Primary")
        self.search_button.clicked.connect(self.start_search)
        actions.addWidget(self.search_button)
        self.add_button = QPushButton("Add selected to downloads")
        self.add_button.setEnabled(False)
        self.add_button.clicked.connect(self.add_selected_results_to_queue)
        actions.addWidget(self.add_button)
        form.addLayout(actions)
        layout.addWidget(card)

        self.results_area = QScrollArea()
        self.results_area.setWidgetResizable(True)
        self.results_container = QWidget()
        self.results_layout = QVBoxLayout(self.results_container)
        self.results_layout.setContentsMargins(0, 0, 0, 0)
        self.results_layout.setSpacing(12)
        self.results_container.setObjectName("Page")
        self.results_area.setWidget(self.results_container)
        self.results_area.setFrameShape(QFrame.NoFrame)
        self.results_area.viewport().setAutoFillBackground(False)
        layout.addWidget(self.results_area, 1)
        self.results_area.setVisible(False)
        self.update_mode("artist")
        return page

    def build_video_page(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(14)

        card = QFrame()
        card.setObjectName("Card")
        form = QVBoxLayout(card)
        form.setContentsMargins(20, 18, 20, 18)
        form.setSpacing(12)
        form.addWidget(label("Find videos", "SectionTitle"))
        form.addWidget(label("Search YouTube videos directly. Results are ranked by popularity when view-count data is available. These downloads are queued as MP4 files.", "Muted", True))

        self.video_query_input = QLineEdit()
        self.video_query_input.setPlaceholderText("Video search, YouTube URL, artist live show, tutorial, clip...")
        self.video_query_input.returnPressed.connect(self.start_video_search)
        form.addWidget(self.video_query_input)

        actions = QHBoxLayout()
        self.video_status = label("Search for a video to get started.", "Muted")
        actions.addWidget(self.video_status, 1)
        self.video_search_button = QPushButton("Search videos")
        self.video_search_button.setObjectName("Primary")
        self.video_search_button.clicked.connect(self.start_video_search)
        actions.addWidget(self.video_search_button)
        self.video_add_button = QPushButton("Add selected videos")
        self.video_add_button.setEnabled(False)
        self.video_add_button.clicked.connect(self.add_selected_video_results_to_queue)
        actions.addWidget(self.video_add_button)
        form.addLayout(actions)
        layout.addWidget(card)

        self.video_results_area = QScrollArea()
        self.video_results_area.setWidgetResizable(True)
        self.video_results_container = QWidget()
        self.video_results_layout = QVBoxLayout(self.video_results_container)
        self.video_results_layout.setContentsMargins(0, 0, 0, 0)
        self.video_results_layout.setSpacing(12)
        self.video_results_container.setObjectName("Page")
        self.video_results_area.setWidget(self.video_results_container)
        self.video_results_area.setFrameShape(QFrame.NoFrame)
        self.video_results_area.viewport().setAutoFillBackground(False)
        layout.addWidget(self.video_results_area, 1)
        self.video_results_area.setVisible(False)
        return page

    def build_downloads_page(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(14)
        card = QFrame()
        card.setObjectName("Card")
        c = QVBoxLayout(card)
        c.setContentsMargins(20, 18, 20, 18)
        c.addWidget(label("Download queue", "SectionTitle"))
        self.queue_summary = label("No downloads yet.", "Muted")
        c.addWidget(self.queue_summary)
        self.queue_progress = QProgressBar()
        self.queue_progress.setRange(0, 100)
        c.addWidget(self.queue_progress)
        row = QHBoxLayout()
        self.pause_button = QPushButton("Pause")
        self.pause_button.clicked.connect(self.download_service.pause_queue)
        self.resume_button = QPushButton("Resume")
        self.resume_button.clicked.connect(self.download_service.resume_queue)
        self.cancel_all_button = QPushButton("Cancel all")
        self.cancel_all_button.setObjectName("Danger")
        self.cancel_all_button.clicked.connect(self.download_service.cancel_all)
        row.addWidget(self.pause_button)
        row.addWidget(self.resume_button)
        row.addWidget(self.cancel_all_button)
        row.addStretch(1)
        c.addLayout(row)
        layout.addWidget(card)

        self.queue_area = QScrollArea()
        self.queue_area.setWidgetResizable(True)
        self.queue_container = QWidget()
        self.queue_layout = QVBoxLayout(self.queue_container)
        self.queue_layout.setContentsMargins(0, 0, 0, 0)
        self.queue_layout.setSpacing(12)
        self.queue_container.setObjectName("Page")
        self.queue_area.setWidget(self.queue_container)
        self.queue_area.setFrameShape(QFrame.NoFrame)
        self.queue_area.viewport().setAutoFillBackground(False)
        layout.addWidget(self.queue_area, 1)
        self.queue_area.setVisible(False)
        return page

    def build_settings_page(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(0, 0, 0, 0)
        card = QFrame()
        card.setObjectName("Card")
        form = QVBoxLayout(card)
        form.setContentsMargins(20, 18, 20, 18)
        form.setSpacing(12)
        form.addWidget(label("Settings", "SectionTitle"))
        form.addWidget(label("These values are saved to the existing settings file and are used by the download service.", "Muted", True))

        folder_row = QHBoxLayout()
        self.folder_input = QLineEdit(str(self.settings.download_folder))
        browse = QPushButton("Browse")
        browse.clicked.connect(self.browse_download_folder)
        folder_row.addWidget(self.folder_input, 1)
        folder_row.addWidget(browse)
        form.addWidget(label("Download folder", "Muted"))
        form.addLayout(folder_row)

        self.quality_combo = QComboBox()
        self.quality_combo.addItems(["128", "160", "192", "256", "320"])
        self.quality_combo.setCurrentText(self.settings.mp3_quality)
        form.addWidget(label("MP3 quality", "Muted"))
        form.addWidget(self.quality_combo)

        self.video_quality_combo = QComboBox()
        self.video_quality_combo.addItems(["best", "1080", "720", "480", "360"])
        self.video_quality_combo.setCurrentText(str(getattr(self.settings, "video_quality", "best")))
        form.addWidget(label("Video quality", "Muted"))
        form.addWidget(self.video_quality_combo)

        self.theme_combo = QComboBox()
        self.theme_combo.addItems(["dark", "light"])
        self.theme_combo.setCurrentText(self.settings.theme)
        form.addWidget(label("Appearance", "Muted"))
        form.addWidget(self.theme_combo)

        save = QPushButton("Save settings")
        save.setObjectName("Primary")
        save.clicked.connect(self.save_settings)
        form.addWidget(save)
        layout.addWidget(card)
        layout.addStretch(1)
        return page

    def show_screen(self, name: str) -> None:
        index_by_name = {"welcome": 0, "music": 1, "videos": 2, "downloads": 3, "settings": 4}
        if name not in index_by_name:
            return
        self.current_screen = name
        self.stack.setCurrentIndex(index_by_name[name])
        self.header.setVisible(name != "welcome")
        self.footer.setVisible(name != "welcome")
        for key, btn in self.nav_buttons.items():
            btn.setObjectName("NavButtonActive" if key == name else "NavButton")
            repolish(btn)
        if hasattr(self, "record_widget"):
            if name == "welcome":
                self.record_widget.start()
            else:
                self.record_widget.stop()

    def eventFilter(self, watched, event) -> bool:
        if event.type() == QEvent.KeyPress and (watched == self.nav_container or watched in self.nav_buttons.values()):
            if event.key() == Qt.Key_Right:
                self._move_nav(1)
                return True
            if event.key() == Qt.Key_Left:
                self._move_nav(-1)
                return True
            if event.key() in {Qt.Key_Return, Qt.Key_Enter} and self.current_screen in self.nav_order:
                self.show_screen(self.current_screen)
                return True
        return super().eventFilter(watched, event)

    def _move_nav(self, direction: int) -> None:
        current = self.current_screen if self.current_screen in self.nav_order else "music"
        index = self.nav_order.index(current)
        next_name = self.nav_order[(index + direction) % len(self.nav_order)]
        self.show_screen(next_name)
        self.nav_buttons[next_name].setFocus(Qt.TabFocusReason)


    def _set_input_blocked(self, field: QLineEdit, blocked: bool, hint: str, placeholder: str) -> None:
        blocked_hints = {
            "Album not needed for artist search",
            "Song not needed for artist search",
            "Song not needed for album search",
        }
        field.setProperty("blocked", blocked)
        if blocked:
            field.setReadOnly(True)
            field.setFocusPolicy(Qt.NoFocus)
            field.setText(hint)
            field.setPlaceholderText("")
        else:
            field.setReadOnly(False)
            field.setFocusPolicy(Qt.StrongFocus)
            if field.text() in blocked_hints:
                field.clear()
            field.setPlaceholderText(placeholder)
        repolish(field)

    def update_mode(self, mode: str) -> None:
        self.current_mode = mode
        if mode == "artist":
            self._set_input_blocked(self.album_input, True, "Album not needed for artist search", "Album")
            self._set_input_blocked(self.song_input, True, "Song not needed for artist search", "Song")
        elif mode == "album":
            self._set_input_blocked(self.album_input, False, "", "Album")
            self._set_input_blocked(self.song_input, True, "Song not needed for album search", "Song")
        else:
            self._set_input_blocked(self.album_input, False, "", "Album optional")
            self._set_input_blocked(self.song_input, False, "", "Song")
        self.album_input.setToolTip("Only Album mode needs this field." if mode != "album" else "Enter the album title.")
        self.song_input.setToolTip("This field is locked because this search mode does not need a song name." if mode != "song" else "Enter the song title.")

    def start_search(self) -> None:
        filters = SearchFilters(
            mode=self.current_mode,
            artist=self.artist_input.text().strip(),
            album="" if self.album_input.isReadOnly() else self.album_input.text().strip(),
            song="" if self.song_input.isReadOnly() else self.song_input.text().strip(),
        )
        if not filters.artist:
            QMessageBox.warning(self, "Missing information", "Please enter an artist name.")
            return
        if filters.mode == "album" and not filters.album:
            QMessageBox.warning(self, "Missing information", "Please enter an album title.")
            return
        if filters.mode == "song" and not filters.song:
            QMessageBox.warning(self, "Missing information", "Please enter a song title.")
            return
        self.search_button.setEnabled(False)
        self.add_button.setEnabled(False)
        self.search_status.setText("Searching...")
        self.set_empty_results("Searching", "Fetching metadata and preview data.")
        threading.Thread(target=self._run_search, args=(filters,), daemon=True).start()

    def _run_search(self, filters: SearchFilters) -> None:
        try:
            if filters.mode == "artist":
                raw = self.metadata_service.search_artist(filters.artist)
                results = [self._build_artist_result(item) for item in raw]
            elif filters.mode == "album":
                raw = self.metadata_service.search_album(filters.album, filters.artist)
                results = [self._build_album_result(item, filters.artist) for item in raw]
            else:
                raw = self.metadata_service.search_recording(filters.song, filters.artist)
                results = [self._build_song_result(item, filters.artist) for item in raw]
            self.event_queue.put(("search_results", results))
        except Exception as exc:
            self.logger.exception("Search failed: %s", exc)
            self.event_queue.put(("search_error", "Search failed. Check your connection and try again."))

    def start_video_search(self) -> None:
        query = self.video_query_input.text().strip()
        if not query:
            QMessageBox.warning(self, "Missing information", "Please enter a video search query or URL.")
            return
        self.video_search_button.setEnabled(False)
        self.video_add_button.setEnabled(False)
        self.video_status.setText("Searching videos...")
        self.set_empty_video_results("Searching", "Fetching YouTube video results.")
        threading.Thread(target=self._run_video_search, args=(query,), daemon=True).start()

    def _run_video_search(self, query: str) -> None:
        try:
            videos = self.youtube_service.search(query, 12, popular=True)
            results = [self._build_video_result(item) for item in videos]
            self.event_queue.put(("video_results", results))
        except Exception as exc:
            self.logger.exception("Video search failed: %s", exc)
            self.event_queue.put(("video_error", "Video search failed. Check your connection and try again."))

    def _build_video_result(self, video: dict) -> SearchResult:
        title = video.get("title") or "Unknown video"
        channel = video.get("channel") or "Unknown channel"
        duration = video.get("duration") or "Unknown length"
        raw_data = dict(video)
        raw_data["_media_format"] = "mp4"
        raw_data["_video_quality"] = str(getattr(self.settings, "video_quality", "best"))
        return SearchResult(
            id=uuid4().hex,
            result_type="Video",
            title=title,
            subtitle=f"{channel} - {duration}",
            description="YouTube video result.",
            metadata_lines=[
                "Format: MP4 video",
                f"Views: {video.get('view_count') or 'Not available'}",
                f"Source: {video.get('url') or 'YouTube search'}",
            ],
            thumbnail_url=video.get("thumbnail_url"),
            artist_name=channel,
            raw_data=raw_data,
        )

    def _build_artist_result(self, artist: dict) -> SearchResult:
        name = artist.get("name", "Unknown Artist")
        youtube = self.youtube_service.search(f"{name} most popular songs", 4)
        albums = self.metadata_service.get_release_groups_for_artist(artist["id"], "album")[:4]
        singles = self.metadata_service.get_release_groups_for_artist(artist["id"], "single")[:4]
        wiki_image = self.metadata_service.get_wikipedia_image_url(name)
        raw_data = dict(artist)
        raw_data["_media_format"] = "mp3"
        return SearchResult(
            id=uuid4().hex,
            result_type="Artist",
            title=name,
            subtitle=self._artist_subtitle(artist),
            description=self.metadata_service.get_wikipedia_summary(name),
            metadata_lines=[
                f"Albums preview: {', '.join(item.get('title', 'Unknown') for item in albums) or 'Not available'}",
                f"Singles preview: {', '.join(item.get('title', 'Unknown') for item in singles) or 'Not available'}",
                f"YouTube preview: {youtube[0]['title'] if youtube else 'Not found'}",
            ],
            thumbnail_url=wiki_image or (youtube[0]["thumbnail_url"] if youtube else None),
            artist_name=name,
            musicbrainz_id=artist.get("id"),
            raw_data=raw_data,
        )

    def _build_album_result(self, album: dict, artist_name: str) -> SearchResult:
        title = album.get("title", "Unknown Album")
        tracks = self.metadata_service.get_tracks_from_release_group(album["id"])
        youtube = self.youtube_service.search(f"{artist_name} {title} full album", 2)
        cover_image = self.metadata_service.get_cover_url(album["id"])
        wiki_image = self.metadata_service.get_wikipedia_image_url(artist_name)
        raw_data = dict(album)
        raw_data["_media_format"] = "mp3"
        return SearchResult(
            id=uuid4().hex,
            result_type="Album",
            title=title,
            subtitle=f"{artist_name} - {album.get('first-release-date', 'Unknown date')}",
            description=f"{len(tracks)} tracks found." if tracks else "Track list not available.",
            metadata_lines=[
                f"Tracks: {', '.join(track['title'] for track in tracks[:8]) or 'Not available'}",
                f"YouTube preview: {youtube[0]['title'] if youtube else 'Not found'}",
            ],
            thumbnail_url=cover_image or wiki_image or (youtube[0]["thumbnail_url"] if youtube else None),
            artist_name=artist_name,
            musicbrainz_id=album.get("id"),
            raw_data=raw_data,
        )

    def _build_song_result(self, song: dict, fallback_artist: str) -> SearchResult:
        raw_title = song.get("title", "Unknown Song")
        artists = ", ".join(credit["artist"]["name"] for credit in song.get("artist-credit", []) if "artist" in credit) or fallback_artist
        title = clean_track_title(raw_title, artists)
        youtube = self.youtube_service.search(f"{artists} {title}", 2)
        primary_artist = artists.split(",")[0].strip() or artists
        wiki_image = self.metadata_service.get_wikipedia_image_url(primary_artist)
        raw_data = dict(song)
        raw_data["_media_format"] = "mp3"
        raw_data["_clean_title"] = title
        return SearchResult(
            id=uuid4().hex,
            result_type="Song",
            title=title,
            subtitle=f"{artists} - {format_length(song.get('length'))}",
            description="Single track result.",
            metadata_lines=[
                f"Appears on: {', '.join(release.get('title', 'Unknown') for release in song.get('releases', [])[:5]) or 'Not available'}",
                f"YouTube preview: {youtube[0]['title'] if youtube else 'Not found'}",
            ],
            thumbnail_url=wiki_image or (youtube[0]["thumbnail_url"] if youtube else None),
            artist_name=artists,
            musicbrainz_id=song.get("id"),
            raw_data=raw_data,
        )


    def _artist_subtitle(self, artist: dict) -> str:
        country = str(artist.get("country") or "").strip()
        artist_type = str(artist.get("type") or "").strip().lower()
        if country:
            return f"{country} artist"
        if artist_type == "group":
            return "Music group"
        if artist_type == "person":
            return "Artist"
        if artist_type:
            return artist_type.title()
        return "Artist"

    def _track_key(self, title: str) -> str:
        import re
        value = title.lower()
        value = re.sub(r"\([^)]*\)", "", value)
        value = re.sub(r"\[[^]]*\]", "", value)
        value = re.sub(r"\b(feat|ft|with)\b.*$", "", value)
        value = re.sub(r"[^a-z0-9]+", "", value)
        return value.strip()

    def _is_suspicious_release(self, release: dict) -> bool:
        title = str(release.get("title", "")).lower()
        types = " ".join(str(value).lower() for value in release.get("secondary-types", []))
        requested = str(release.get("_requested_type", "")).lower()
        return any(word in f"{title} {types} {requested}" for word in SUSPICIOUS_RELEASE_WORDS)

    def _collect_suspicious_releases(self, results: list[SearchResult]) -> dict[str, list[dict]]:
        """Collect suspicious releases without touching the Qt UI. Runs in a worker thread."""
        suspicious_by_result: dict[str, list[dict]] = {}
        for result in results:
            suspicious: list[dict] = []
            if result.result_type == "Artist" and result.musicbrainz_id:
                for release_type in ("album", "ep", "single"):
                    for release in self.metadata_service.get_release_groups_for_artist(result.musicbrainz_id, release_type):
                        release = dict(release)
                        release["_requested_type"] = release_type
                        if self._is_suspicious_release(release):
                            suspicious.append(release)
            elif result.result_type == "Album" and self._is_suspicious_release(result.raw_data):
                suspicious.append(result.raw_data)
            if suspicious:
                suspicious_by_result[result.id] = suspicious
        return suspicious_by_result

    def _copy_result_with_raw(self, result: SearchResult, **updates) -> SearchResult:
        raw_data = dict(result.raw_data)
        raw_data.update(updates)
        return replace(result, raw_data=raw_data)

    def _confirm_suspicious_releases(self, results: list[SearchResult]) -> list[SearchResult] | None:
        confirmed: list[SearchResult] = []
        for result in results:
            suspicious: list[dict] = []
            if result.result_type == "Artist" and result.musicbrainz_id:
                for release_type in ("album", "ep", "single"):
                    for release in self.metadata_service.get_release_groups_for_artist(result.musicbrainz_id, release_type):
                        release = dict(release)
                        release["_requested_type"] = release_type
                        if self._is_suspicious_release(release):
                            suspicious.append(release)
            elif result.result_type == "Album" and self._is_suspicious_release(result.raw_data):
                suspicious.append(result.raw_data)

            if suspicious:
                dialog = SuspiciousReleaseDialog(result.artist_name or result.title, suspicious, self)
                if dialog.exec() != QDialog.Accepted:
                    return None
                include_suspicious = dialog.choice in {"include", "wrong"}
                confirmed.append(self._copy_result_with_raw(result, _include_suspicious_releases=include_suspicious))
            else:
                confirmed.append(result)
        return confirmed

    def _build_music_preview_rows(self, results: list[SearchResult]) -> list[dict]:
        rows: list[dict] = []
        for result in results:
            if result.result_type == "Song":
                raw_title = result.raw_data.get("_clean_title") or result.raw_data.get("title", result.title)
                title = clean_track_title(raw_title, result.artist_name)
                song_id = result.raw_data.get("id") or result.musicbrainz_id or result.id
                key = f"song:{song_id}:track:{self._track_key(title)}"
                rows.append({"result_id": result.id, "key": key, "display": f"Song - {title}"})
                continue

            if result.result_type == "Album" and result.musicbrainz_id:
                tracks = self.metadata_service.get_tracks_from_release_group(result.musicbrainz_id)
                if not tracks:
                    rows.append({"result_id": result.id, "key": f"result:{result.id}", "display": f"Album - {result.title}"})
                    continue
                for track in tracks:
                    title = clean_track_title(track.get("title", "Unknown title"), result.artist_name)
                    position = str(track.get("position") or "").zfill(2)
                    key = f"release:{result.musicbrainz_id}:track:{self._track_key(title)}"
                    rows.append({"result_id": result.id, "key": key, "display": f"{position}. {title} (Album: {result.title})"})
                continue

            if result.result_type == "Artist" and result.musicbrainz_id:
                include_suspicious = bool(result.raw_data.get("_include_suspicious_releases"))
                for release_type in ("album", "ep", "single"):
                    for release in self.metadata_service.get_release_groups_for_artist(result.musicbrainz_id, release_type):
                        release = dict(release)
                        release["_requested_type"] = release_type
                        if self.download_service._should_skip_release(release, include_suspicious=include_suspicious):
                            continue
                        release_id = release.get("id", "")
                        release_title = release.get("title", "Unknown release")
                        if release_type in {"album", "ep"}:
                            tracks = self.metadata_service.get_tracks_from_release_group(release_id)
                            for track in tracks:
                                title = clean_track_title(track.get("title", "Unknown title"), result.title)
                                position = str(track.get("position") or "").zfill(2)
                                key = f"release:{release_id}:track:{self._track_key(title)}"
                                rows.append({"result_id": result.id, "key": key, "display": f"{position}. {title} (Album: {release_title})"})
                        else:
                            title = clean_track_title(release_title, result.title)
                            key = f"release:{release_id}:track:{self._track_key(title)}"
                            rows.append({"result_id": result.id, "key": key, "display": f"{title} (Single)"})

                cover_items = self.youtube_service.search_trusted_artist_covers(result.title, 8)
                result.raw_data["_trusted_youtube_covers"] = cover_items
                for cover in cover_items:
                    video_id = cover.get("id") or cover.get("url") or cover.get("title", "")
                    title = clean_track_title(cover.get("title", "Unknown cover"), result.title)
                    channel = cover.get("channel") or "trusted channel"
                    rows.append({
                        "result_id": result.id,
                        "key": f"youtube-cover:{video_id}",
                        "display": f"YouTube cover - {title} ({channel})",
                    })

                if not any(row["result_id"] == result.id for row in rows):
                    rows.append({"result_id": result.id, "key": f"result:{result.id}", "display": f"Artist - {result.title}"})
                continue

            rows.append({"result_id": result.id, "key": f"result:{result.id}", "display": f"{result.result_type} - {result.title}"})
        return rows

    def _apply_preview_selection(self, results: list[SearchResult], rows: list[dict], checked_rows: list[dict]) -> list[SearchResult]:
        row_keys_by_result: dict[str, set[str]] = {}
        checked_keys_by_result: dict[str, set[str]] = {}
        for row in rows:
            row_keys_by_result.setdefault(row["result_id"], set()).add(row["key"])
        for row in checked_rows:
            checked_keys_by_result.setdefault(row["result_id"], set()).add(row["key"])

        filtered: list[SearchResult] = []
        for result in results:
            all_keys = row_keys_by_result.get(result.id)
            if all_keys is None:
                filtered.append(result)
                continue
            checked_keys = checked_keys_by_result.get(result.id, set())
            if not checked_keys:
                continue
            raw_updates = {"_allowed_download_keys": sorted(checked_keys)}
            filtered.append(self._copy_result_with_raw(result, **raw_updates))
        return filtered

    def _set_music_review_busy(self, busy: bool, message: str | None = None) -> None:
        self.add_button.setEnabled(False if busy else bool(self.selected_ids))
        self.search_button.setEnabled(not busy)
        if message:
            self.search_status.setText(message)
        QApplication.setOverrideCursor(Qt.WaitCursor) if busy else QApplication.restoreOverrideCursor()

    def _start_music_review_preparation(self, selected: list[SearchResult], scan_suspicious: bool = True) -> None:
        self._set_music_review_busy(True, "Preparing the download list...")
        threading.Thread(
            target=self._prepare_music_review_worker,
            args=(selected, scan_suspicious),
            daemon=True,
        ).start()

    def _prepare_music_review_worker(self, selected: list[SearchResult], scan_suspicious: bool) -> None:
        try:
            suspicious = self._collect_suspicious_releases(selected) if scan_suspicious else {}
            rows = self._build_music_preview_rows(selected)
            self.event_queue.put((
                "music_review_ready",
                {"results": selected, "rows": rows, "suspicious": suspicious},
            ))
        except Exception as exc:
            self.logger.exception("Preparing music review failed: %s", exc)
            self.event_queue.put(("music_review_error", str(exc)))

    def _handle_music_review_ready(self, payload: object) -> None:
        self._set_music_review_busy(False, None)
        data = payload if isinstance(payload, dict) else {}
        results = data.get("results") if isinstance(data.get("results"), list) else []
        rows = data.get("rows") if isinstance(data.get("rows"), list) else []
        suspicious = data.get("suspicious") if isinstance(data.get("suspicious"), dict) else {}
        if not results:
            QMessageBox.warning(self, "No downloadable items", "No downloadable tracks were found.")
            self.render_results()
            return

        confirmed: list[SearchResult] = []
        needs_rebuild = False
        for result in results:
            releases = suspicious.get(result.id, [])
            if releases:
                dialog = SuspiciousReleaseDialog(result.artist_name or result.title, releases, self)
                if dialog.exec() != QDialog.Accepted:
                    self.render_results()
                    return
                include_suspicious = dialog.choice in {"include", "wrong"}
                if include_suspicious:
                    needs_rebuild = True
                confirmed.append(self._copy_result_with_raw(result, _include_suspicious_releases=include_suspicious))
            else:
                confirmed.append(result)

        if needs_rebuild:
            self._start_music_review_preparation(confirmed, scan_suspicious=False)
            return

        self._finish_music_review(confirmed, rows)

    def _finish_music_review(self, confirmed: list[SearchResult], rows: list[dict]) -> None:
        if not rows:
            QMessageBox.warning(self, "No downloadable items", "No downloadable tracks were found.")
            self.render_results()
            return
        dialog = DownloadPreviewDialog(rows, self)
        if dialog.exec() != QDialog.Accepted:
            self.render_results()
            return
        reviewed = self._apply_preview_selection(confirmed, rows, dialog.checked_rows())
        if not reviewed:
            self.render_results()
            return
        self.download_service.add_results(reviewed)
        self.show_screen("downloads")
        self.selected_ids.clear()
        self.render_results()

    def _review_music_downloads(self, selected: list[SearchResult]) -> list[SearchResult] | None:
        QApplication.setOverrideCursor(Qt.WaitCursor)
        try:
            confirmed = self._confirm_suspicious_releases(selected)
            if confirmed is None:
                return None
            rows = self._build_music_preview_rows(confirmed)
        finally:
            QApplication.restoreOverrideCursor()

        if not rows:
            QMessageBox.warning(self, "No downloadable items", "No downloadable tracks were found.")
            return None
        dialog = DownloadPreviewDialog(rows, self)
        if dialog.exec() != QDialog.Accepted:
            return None
        return self._apply_preview_selection(confirmed, rows, dialog.checked_rows())

    def _review_video_downloads(self, selected: list[SearchResult]) -> list[SearchResult] | None:
        rows = [
            {"result_id": result.id, "key": f"video:{result.id}", "display": f"Video - {result.title}"}
            for result in selected
        ]
        dialog = DownloadPreviewDialog(rows, self)
        if dialog.exec() != QDialog.Accepted:
            return None
        return self._apply_preview_selection(selected, rows, dialog.checked_rows())

    def set_empty_results(self, title: str, message: str) -> None:
        del title
        clear_layout(self.results_layout)
        self.results_area.setVisible(False)
        self.add_button.setEnabled(False)
        if message:
            self.search_status.setText(message)

    def render_results(self) -> None:
        clear_layout(self.results_layout)
        if not self.search_results:
            self.results_area.setVisible(False)
            self.add_button.setEnabled(False)
            return
        self.results_area.setVisible(True)
        for result in self.search_results:
            self.results_layout.addWidget(ResultCard(result, result.id in self.selected_ids, self.toggle_result))
        self.results_layout.addStretch(1)
        count = len(self.selected_ids)
        self.add_button.setEnabled(count > 0)
        self.search_status.setText(f"{len(self.search_results)} result(s). {count} selected.")

    def toggle_result(self, result_id: str) -> None:
        if result_id in self.selected_ids:
            self.selected_ids.remove(result_id)
        else:
            self.selected_ids.add(result_id)
        self.render_results()

    def set_empty_video_results(self, title: str, message: str) -> None:
        del title
        clear_layout(self.video_results_layout)
        self.video_results_area.setVisible(False)
        self.video_add_button.setEnabled(False)
        if message:
            self.video_status.setText(message)

    def render_video_results(self) -> None:
        clear_layout(self.video_results_layout)
        if not self.video_results:
            self.video_results_area.setVisible(False)
            self.video_add_button.setEnabled(False)
            return
        self.video_results_area.setVisible(True)
        for result in self.video_results:
            self.video_results_layout.addWidget(ResultCard(result, result.id in self.selected_video_ids, self.toggle_video_result))
        self.video_results_layout.addStretch(1)
        count = len(self.selected_video_ids)
        self.video_add_button.setEnabled(count > 0)
        self.video_status.setText(f"{len(self.video_results)} video result(s). {count} selected.")

    def toggle_video_result(self, result_id: str) -> None:
        if result_id in self.selected_video_ids:
            self.selected_video_ids.remove(result_id)
        else:
            self.selected_video_ids.add(result_id)
        self.render_video_results()

    def add_selected_video_results_to_queue(self) -> None:
        selected = [r for r in self.video_results if r.id in self.selected_video_ids]
        if not selected:
            QMessageBox.warning(self, "Nothing selected", "Select at least one video first.")
            return
        reviewed = self._review_video_downloads(selected)
        if not reviewed:
            return
        self.download_service.add_results(reviewed)
        self.show_screen("downloads")
        self.selected_video_ids.clear()
        self.render_video_results()

    def add_selected_results_to_queue(self) -> None:
        selected = [r for r in self.search_results if r.id in self.selected_ids]
        if not selected:
            QMessageBox.warning(self, "Nothing selected", "Select at least one result first.")
            return
        self._start_music_review_preparation(selected, scan_suspicious=True)

    def render_queue(self, snapshot: QueueSnapshot) -> None:
        self.queue_summary.setText(snapshot.summary_message)
        self.queue_progress.setValue(int(snapshot.overall_progress or 0))
        self.pause_button.setEnabled(bool(snapshot.items) and not snapshot.paused)
        self.resume_button.setEnabled(snapshot.paused)
        self.cancel_all_button.setEnabled(bool(snapshot.items))
        clear_layout(self.queue_layout)
        if not snapshot.items:
            self.queue_area.setVisible(False)
        else:
            self.queue_area.setVisible(True)
            for item in snapshot.items:
                self.queue_layout.addWidget(QueueCard(item, item.id == snapshot.active_item_id, self.download_service.cancel_item))
            self.queue_layout.addStretch(1)

    def save_settings(self) -> None:
        folder = Path(self.folder_input.text()).expanduser()
        folder.mkdir(parents=True, exist_ok=True)
        self.settings = SettingsData(
            download_folder=folder,
            mp3_quality=self.quality_combo.currentText(),
            theme=self.theme_combo.currentText(),
            media_format="mp3",
            video_quality=self.video_quality_combo.currentText(),
        )
        self.settings_service.save(self.settings)
        self.download_service.update_settings(self.settings)
        self.apply_theme()
        QMessageBox.information(self, "Saved", "Settings saved.")

    def browse_download_folder(self) -> None:
        folder = QFileDialog.getExistingDirectory(self, "Choose download folder", self.folder_input.text())
        if folder:
            self.folder_input.setText(folder)

    def open_downloads_folder(self) -> None:
        path = self.settings.download_folder.expanduser()
        path.mkdir(parents=True, exist_ok=True)
        if sys.platform.startswith("win"):
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
        else:
            subprocess.Popen(["xdg-open", str(path)])

    def poll_events(self) -> None:
        while True:
            try:
                event_type, payload = self.event_queue.get_nowait()
            except queue.Empty:
                break
            if event_type == "search_results":
                self.search_button.setEnabled(True)
                self.search_results = payload if isinstance(payload, list) else []
                self.selected_ids.clear()
                if self.search_results:
                    self.render_results()
                else:
                    self.set_empty_results("No results found", "Try a different search.")
                    self.search_status.setText("No results found.")
            elif event_type == "search_error":
                self.search_button.setEnabled(True)
                self.set_empty_results("Search failed", str(payload))
                self.search_status.setText("Search failed.")
            elif event_type == "video_results":
                self.video_search_button.setEnabled(True)
                self.video_results = payload if isinstance(payload, list) else []
                self.selected_video_ids.clear()
                if self.video_results:
                    self.render_video_results()
                else:
                    self.set_empty_video_results("No videos found", "Try a different video search.")
                    self.video_status.setText("No videos found.")
            elif event_type == "video_error":
                self.video_search_button.setEnabled(True)
                self.set_empty_video_results("Video search failed", str(payload))
                self.video_status.setText("Video search failed.")
            elif event_type == "music_review_ready":
                self._handle_music_review_ready(payload)
            elif event_type == "music_review_error":
                self._set_music_review_busy(False, "Preparing the list failed.")
                QMessageBox.warning(self, "Could not prepare list", str(payload))
                self.render_results()
            elif event_type == "queue" and isinstance(payload, QueueSnapshot):
                self.render_queue(payload)


def main() -> None:
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    if APP_ICON_PATH.exists():
        app.setWindowIcon(QIcon(str(APP_ICON_PATH)))
    window = MusicDownloaderQtApp()
    window.showMaximized()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
