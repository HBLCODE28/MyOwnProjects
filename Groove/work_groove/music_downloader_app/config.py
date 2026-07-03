from __future__ import annotations

import sys
from pathlib import Path

APP_NAME = "Groove"
APP_VERSION = "3.0.0"
APP_AUTHOR = "OpenAI Codex"
USER_AGENT = f"{APP_NAME}/{APP_VERSION}"
MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2"

IS_WINDOWS = sys.platform.startswith("win")
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _default_data_dir() -> Path:
    if IS_WINDOWS:
        local_app_data = Path.home() / "AppData" / "Local"
        return local_app_data / "Groove"
    return PROJECT_ROOT / ".appdata"


APP_DATA_DIR = _default_data_dir()
LOG_DIR = APP_DATA_DIR / "logs"
DEFAULT_DOWNLOAD_DIR = Path.home() / "Music"
SETTINGS_FILE = APP_DATA_DIR / "settings.json"
THUMBNAIL_CACHE_DIR = APP_DATA_DIR / "thumb_cache"
VENDOR_DIR = PROJECT_ROOT / "vendor"
WINDOWS_FFMPEG_PATH = VENDOR_DIR / "ffmpeg" / "bin" / "ffmpeg.exe"

SEARCH_RESULT_LIMIT = 10
YOUTUBE_PREVIEW_LIMIT = 4

LIGHT_THEME = {
    "name": "light",
    "bg": "#f4f7fb",
    "surface": "#ffffff",
    "surface_alt": "#edf3fb",
    "surface_hover": "#e4eefc",
    "border": "#d8e3f0",
    "text": "#10213a",
    "text_muted": "#64748b",
    "accent": "#2563eb",
    "accent_soft": "#dbeafe",
    "accent_text": "#ffffff",
    "success": "#16a34a",
    "warning": "#d97706",
    "danger": "#dc2626",
    "queue_downloading": "#0f766e",
    "queue_completed": "#16a34a",
    "queue_failed": "#dc2626",
    "queue_canceled": "#6b7280",
    "badge_artist": "#7c3aed",
    "badge_album": "#2563eb",
    "badge_song": "#059669",
}

DARK_THEME = {
    "name": "dark",
    "bg": "#0f0f13",
    "surface": "#17171f",
    "surface_alt": "#1e1e2a",
    "surface_hover": "#22243a",
    "border": "#2a2a3d",
    "text": "#f8fafc",
    "text_muted": "#94a3b8",
    "accent": "#6c63ff",
    "accent_soft": "#25284b",
    "accent_text": "#ffffff",
    "success": "#22c55e",
    "warning": "#f59e0b",
    "danger": "#ef4444",
    "queue_downloading": "#38bdf8",
    "queue_completed": "#22c55e",
    "queue_failed": "#f87171",
    "queue_canceled": "#94a3b8",
    "badge_artist": "#a855f7",
    "badge_album": "#3b82f6",
    "badge_song": "#10b981",
}

THEMES = {
    LIGHT_THEME["name"]: LIGHT_THEME,
    DARK_THEME["name"]: DARK_THEME,
}



SPOTIFY_CLIENT_ID = "8394e0b336b44a65834c371eea042ae9"
