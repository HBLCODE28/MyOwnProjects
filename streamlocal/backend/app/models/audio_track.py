from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class AudioTrack(Base):
    __tablename__ = "audio_tracks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    media_file_id: Mapped[int] = mapped_column(ForeignKey("media_files.id"), nullable=False, index=True)
    stream_index: Mapped[int] = mapped_column(Integer, nullable=False)
    language: Mapped[str | None] = mapped_column(String(32), nullable=True)
    title: Mapped[str | None] = mapped_column(String(256), nullable=True)
    codec: Mapped[str | None] = mapped_column(String(100), nullable=True)
    channels: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    media_file = relationship("MediaFile", back_populates="audio_tracks")
