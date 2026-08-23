from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import LibrarySource, MediaFile, ScanJob
from app.schemas.library import FolderDialogResponse, LibrarySourceCreate, LibrarySourceRead, LibrarySourceUpdate, ScanJobRead
from app.services.library_scanner import LibraryScanner
from app.services.path_service import normalize_windows_path, validate_library_folder
from app.services.watcher_service import watcher_manager
from app.services.windows_dialog_service import choose_folder

router = APIRouter(prefix="/library", tags=["library"])

def _read_source(db: Session, source: LibrarySource) -> LibrarySourceRead:
    total = db.scalar(select(func.count(MediaFile.id)).where(MediaFile.library_source_id == source.id)) or 0
    online = db.scalar(select(func.count(MediaFile.id)).where(
        MediaFile.library_source_id == source.id, MediaFile.online.is_(True)
    )) or 0
    return LibrarySourceRead(
        id=source.id, path=source.path, source_type=source.source_type, enabled=source.enabled,
        recursive=source.recursive, created_at=source.created_at, last_scan_at=source.last_scan_at,
        file_count=total, online_file_count=online,
    )

@router.get("/sources", response_model=list[LibrarySourceRead])
def list_sources(db: Session = Depends(get_db)):
    sources = db.scalars(select(LibrarySource).order_by(LibrarySource.created_at)).all()
    return [_read_source(db, source) for source in sources]

@router.post("/sources", response_model=LibrarySourceRead, status_code=201)
def add_source(payload: LibrarySourceCreate, db: Session = Depends(get_db)):
    try:
        folder = validate_library_folder(payload.path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    normalized = normalize_windows_path(folder)
    existing = db.scalar(select(LibrarySource).where(LibrarySource.normalized_path == normalized))
    if existing:
        if not existing.enabled:
            existing.enabled = True
            existing.source_type = payload.source_type
            existing.recursive = payload.recursive
            db.commit()
            db.refresh(existing)
            watcher_manager.restart()
            return _read_source(db, existing)
        raise HTTPException(status_code=409, detail="This folder is already in the library.")

    source = LibrarySource(
        path=str(folder), normalized_path=normalized, source_type=payload.source_type,
        recursive=payload.recursive, enabled=True,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    watcher_manager.restart()
    return _read_source(db, source)

@router.patch("/sources/{source_id}", response_model=LibrarySourceRead)
def update_source(source_id: int, payload: LibrarySourceUpdate, db: Session = Depends(get_db)):
    source = db.get(LibrarySource, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Library source not found.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(source, key, value)
    db.commit()
    db.refresh(source)
    watcher_manager.restart()
    return _read_source(db, source)

@router.delete("/sources/{source_id}", status_code=204)
def remove_source(source_id: int, db: Session = Depends(get_db)):
    source = db.get(LibrarySource, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Library source not found.")
    for media_file in db.scalars(select(MediaFile).where(MediaFile.library_source_id == source.id)).all():
        media_file.online = False
    source.enabled = False
    db.commit()
    watcher_manager.restart()

@router.post("/sources/{source_id}/scan", response_model=ScanJobRead)
def scan_source(source_id: int, db: Session = Depends(get_db)):
    try:
        return LibraryScanner(db).scan_source(source_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.get("/scan-jobs/latest", response_model=ScanJobRead | None)
def latest_scan(db: Session = Depends(get_db)):
    return db.scalar(select(ScanJob).order_by(ScanJob.started_at.desc()).limit(1))

@router.post("/folder-dialog", response_model=FolderDialogResponse)
def folder_dialog():
    return FolderDialogResponse(path=choose_folder())
