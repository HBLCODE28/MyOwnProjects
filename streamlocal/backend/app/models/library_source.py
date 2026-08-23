from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class LibrarySource(Base):
    __tablename__ = "library_sources"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    path: Mapped[str] = mapped_column(String(2048), nullable=False)
    normalized_path: Mapped[str] = mapped_column(String(2048), nullable=False, unique=True, index=True)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="automatic")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    recursive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=False)
    last_scan_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    files = relationship("MediaFile", back_populates="library_source")
