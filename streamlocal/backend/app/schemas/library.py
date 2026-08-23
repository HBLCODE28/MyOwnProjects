from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

SourceType = Literal["automatic", "movies", "tv"]

class LibrarySourceCreate(BaseModel):
    path: str = Field(min_length=1, max_length=2048)
    source_type: SourceType = "automatic"
    recursive: bool = True

class LibrarySourceUpdate(BaseModel):
    source_type: SourceType | None = None
    enabled: bool | None = None
    recursive: bool | None = None

class LibrarySourceRead(BaseModel):
    id: int
    path: str
    source_type: SourceType
    enabled: bool
    recursive: bool
    created_at: datetime
    last_scan_at: datetime | None
    file_count: int = 0
    online_file_count: int = 0
    model_config = {"from_attributes": True}

class ScanJobRead(BaseModel):
    id: int
    source_id: int | None
    status: str
    files_scanned: int
    files_added: int
    files_updated: int
    errors_count: int
    error_message: str | None
    started_at: datetime
    finished_at: datetime | None
    model_config = {"from_attributes": True}

class FolderDialogResponse(BaseModel):
    path: str | None
