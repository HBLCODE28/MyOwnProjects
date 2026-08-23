from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class SubtitleTrack(Base):
    __tablename__ = "subtitle_tracks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    media_file_id: Mapped[int] = mapped_column(ForeignKey("media_files.id"), nullable=False, index=True)
    stream_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    external_path: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="embedded")
    language: Mapped[str | None] = mapped_column(String(32), nullable=True)
    title: Mapped[str | None] = mapped_column(String(256), nullable=True)
    format: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    cached_vtt_path: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    media_file = relationship("MediaFile", back_populates="subtitle_tracks")
