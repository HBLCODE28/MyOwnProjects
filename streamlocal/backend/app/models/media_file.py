from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class MediaFile(Base):
    __tablename__ = "media_files"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    media_item_id: Mapped[int] = mapped_column(ForeignKey("media_items.id"), nullable=False, index=True)
    library_source_id: Mapped[int] = mapped_column(ForeignKey("library_sources.id"), nullable=False, index=True)
    absolute_path: Mapped[str] = mapped_column(String(2048), nullable=False)
    normalized_path: Mapped[str] = mapped_column(String(2048), nullable=False, unique=True, index=True)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    modified_at_fs: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at_fs: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fingerprint: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    container: Mapped[str | None] = mapped_column(String(100), nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    video_codec: Mapped[str | None] = mapped_column(String(100), nullable=True)
    frame_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    bitrate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ffprobe_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    online: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)
    media_item = relationship("MediaItem", back_populates="files")
    library_source = relationship("LibrarySource", back_populates="files")
    audio_tracks = relationship("AudioTrack", back_populates="media_file", cascade="all, delete-orphan")
    subtitle_tracks = relationship("SubtitleTrack", back_populates="media_file", cascade="all, delete-orphan")
