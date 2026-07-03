from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal
from uuid import uuid4

SearchMode = Literal["artist", "album", "song"]
MediaFormat = Literal["mp3", "mp4"]
ResultType = Literal["Artist", "Album", "Song", "Playlist", "Video"]
DownloadStatus = Literal[
    "queued",
    "waiting",
    "downloading",
    "paused",
    "completed",
    "failed",
    "canceled",
]


@dataclass(slots=True)
class SearchResult:
    id: str
    result_type: ResultType
    title: str
    subtitle: str
    description: str
    metadata_lines: list[str]
    thumbnail_url: str | None
    artist_name: str | None = None
    musicbrainz_id: str | None = None
    raw_data: dict = field(default_factory=dict)


@dataclass(slots=True)
class SearchFilters:
    mode: SearchMode = "artist"
    artist: str = ""
    album: str = ""
    song: str = ""


@dataclass(slots=True)
class SettingsData:
    download_folder: Path
    mp3_quality: str = "192"
    theme: Literal["light", "dark"] = "dark"
    media_format: MediaFormat = "mp3"
    video_quality: str = "best"


@dataclass(slots=True)
class DownloadQueueItem:
    source: SearchResult
    destination_folder: Path
    id: str = field(default_factory=lambda: uuid4().hex)
    status: DownloadStatus = "queued"
    progress: float = 0.0
    status_message: str = "Queued"
    detail_message: str = ""
    output_paths: list[Path] = field(default_factory=list)
    error_message: str | None = None
    total_steps: int = 1
    completed_steps: int = 0
    cancel_requested: bool = False


@dataclass(slots=True)
class QueueSnapshot:
    items: list[DownloadQueueItem]
    active_item_id: str | None
    paused: bool
    overall_progress: float
    summary_message: str

