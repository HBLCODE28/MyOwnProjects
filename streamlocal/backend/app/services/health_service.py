from pathlib import Path
import shutil
import subprocess

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import Settings
from app.database import engine
from app.schemas.health import ComponentHealth, HealthResponse


def _database_health() -> ComponentHealth:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return ComponentHealth(status="ok")
    except SQLAlchemyError as exc:
        return ComponentHealth(status="error", detail=type(exc).__name__)


def _resolve_executable(configured: str | None, fallback_name: str) -> str | None:
    if configured:
        configured_path = Path(configured)
        if configured_path.exists():
            return str(configured_path)
    return shutil.which(fallback_name)


def _ffmpeg_health(settings: Settings) -> ComponentHealth:
    executable = _resolve_executable(settings.ffmpeg_path, "ffmpeg")
    if executable is None:
        return ComponentHealth(
            status="unavailable",
            detail="FFmpeg was not found. It is optional in Stage 1 and required for later playback stages.",
        )

    try:
        completed = subprocess.run(
            [executable, "-version"],
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
        if completed.returncode == 0:
            first_line = completed.stdout.splitlines()[0] if completed.stdout else "FFmpeg available"
            return ComponentHealth(status="ok", detail=first_line)
        return ComponentHealth(status="error", detail="FFmpeg returned a non-zero exit code.")
    except (OSError, subprocess.SubprocessError) as exc:
        return ComponentHealth(status="error", detail=type(exc).__name__)


def build_health(settings: Settings) -> HealthResponse:
    database = _database_health()
    ffmpeg = _ffmpeg_health(settings)

    status = "ok" if database.status == "ok" else "degraded"

    return HealthResponse(
        status=status,
        backend=ComponentHealth(status="ok"),
        database=database,
        ffmpeg=ffmpeg,
        app_data_dir=str(settings.app_data_dir),
    )
