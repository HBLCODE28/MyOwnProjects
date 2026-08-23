from functools import lru_cache
from pathlib import Path
import os

from pydantic_settings import BaseSettings, SettingsConfigDict


def default_app_data_dir() -> Path:
    local_app_data = os.getenv("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data) / "StreamLocal"
    return Path.home() / ".streamlocal"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    streamlocal_host: str = "127.0.0.1"
    streamlocal_port: int = 4310
    streamlocal_log_level: str = "INFO"
    ffmpeg_path: str | None = None
    ffprobe_path: str | None = None
    tmdb_api_key: str | None = None

    @property
    def app_data_dir(self) -> Path:
        return default_app_data_dir()

    @property
    def database_dir(self) -> Path:
        return self.app_data_dir / "data"

    @property
    def database_path(self) -> Path:
        return self.database_dir / "streamlocal.db"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.database_path.as_posix()}"

    @property
    def logs_dir(self) -> Path:
        return self.app_data_dir / "logs"

    @property
    def cache_dir(self) -> Path:
        return self.app_data_dir / "cache"

    def ensure_directories(self) -> None:
        self.database_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_directories()
    return settings
