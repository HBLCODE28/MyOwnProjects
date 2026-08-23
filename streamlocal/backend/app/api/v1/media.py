from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.models import MediaFile, MediaItem
from app.schemas.media import LibraryMediaRead

router = APIRouter(prefix="/media", tags=["media"])

@router.get("", response_model=list[LibraryMediaRead])
def list_media(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    statement = (
        select(MediaItem)
        .options(
            selectinload(MediaItem.files).selectinload(MediaFile.audio_tracks),
            selectinload(MediaItem.files).selectinload(MediaFile.subtitle_tracks),
        )
        .order_by(MediaItem.date_added.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement).unique().all())
