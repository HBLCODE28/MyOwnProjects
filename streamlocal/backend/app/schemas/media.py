from datetime import datetime
from pydantic import BaseModel

class AudioTrackRead(BaseModel):
    stream_index: int
    language: str | None
    title: str | None
    codec: str | None
    channels: int | None
    is_default: bool
    model_config = {"from_attributes": True}

class SubtitleTrackRead(BaseModel):
    stream_index: int | None
    source_type: str
    language: str | None
    title: str | None
    format: str | None
    is_default: bool
    model_config = {"from_attributes": True}

class MediaFileRead(BaseModel):
    id: int
    media_item_id: int
    library_source_id: int
    absolute_path: str
    file_size: int
    container: str | None
    duration_seconds: float | None
    width: int | None
    height: int | None
    video_codec: str | None
    bitrate: int | None
    online: bool
    last_seen_at: datetime
    audio_tracks: list[AudioTrackRead]
    subtitle_tracks: list[SubtitleTrackRead]
    model_config = {"from_attributes": True}

class LibraryMediaRead(BaseModel):
    id: int
    title: str
    media_type: str
    date_added: datetime
    files: list[MediaFileRead]
    model_config = {"from_attributes": True}
