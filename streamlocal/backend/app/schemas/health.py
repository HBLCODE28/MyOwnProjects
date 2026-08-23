from typing import Literal

from pydantic import BaseModel


class ComponentHealth(BaseModel):
    status: Literal["ok", "unavailable", "error"]
    detail: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    backend: ComponentHealth
    database: ComponentHealth
    ffmpeg: ComponentHealth
    app_data_dir: str
