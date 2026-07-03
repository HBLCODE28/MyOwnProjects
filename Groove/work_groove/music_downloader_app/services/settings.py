from __future__ import annotations

import json
import logging
from pathlib import Path

from music_downloader_app.config import APP_DATA_DIR, DEFAULT_DOWNLOAD_DIR, SETTINGS_FILE
from music_downloader_app.models import SettingsData

LOGGER = logging.getLogger(__name__)


class SettingsService:
    """Load and persist application settings."""

    def __init__(self, settings_file: Path = SETTINGS_FILE) -> None:
        self.settings_file = settings_file

    def load(self) -> SettingsData:
        """Return saved settings or defaults when no settings file exists."""
        APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
        if not self.settings_file.exists():
            return SettingsData(download_folder=DEFAULT_DOWNLOAD_DIR)

        try:
            payload = json.loads(self.settings_file.read_text(encoding="utf-8"))
            return SettingsData(
                download_folder=Path(payload.get("download_folder", DEFAULT_DOWNLOAD_DIR)),
                mp3_quality=str(payload.get("mp3_quality", "192")),
                theme=payload.get("theme", "dark"),
                media_format=payload.get("media_format", "mp3") if payload.get("media_format", "mp3") in {"mp3", "mp4"} else "mp3",
                video_quality=str(payload.get("video_quality", "best")),
            )
        except Exception as exc:
            LOGGER.exception("Failed to load settings: %s", exc)
            return SettingsData(download_folder=DEFAULT_DOWNLOAD_DIR)

    def save(self, settings: SettingsData) -> None:
        """Persist settings to disk."""
        APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "download_folder": str(settings.download_folder),
            "mp3_quality": settings.mp3_quality,
            "theme": settings.theme,
            "media_format": settings.media_format,
            "video_quality": settings.video_quality,
        }
        self.settings_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

