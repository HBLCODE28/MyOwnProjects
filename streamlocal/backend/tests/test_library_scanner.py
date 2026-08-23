from pathlib import Path
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from app.database import Base
from app.models import LibrarySource, MediaFile
from app.services.library_scanner import LibraryScanner
from app.services.path_service import normalize_windows_path

def make_session():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, class_=Session, expire_on_commit=False)()

def make_source(db, tmp_path):
    source = LibrarySource(
        path=str(tmp_path),
        normalized_path=normalize_windows_path(tmp_path),
        source_type="automatic",
        enabled=True,
        recursive=True,
    )
    db.add(source)
    db.commit()
    return source

def test_scanner_imports_mp4_and_mkv_only(tmp_path: Path, monkeypatch):
    db = make_session()
    source = make_source(db, tmp_path)
    (tmp_path / "one.mp4").write_bytes(b"mp4")
    (tmp_path / "two.mkv").write_bytes(b"mkv")
    (tmp_path / "ignore.txt").write_text("no", encoding="utf-8")
    monkeypatch.setattr("app.services.library_scanner.probe_media", lambda path: None)
    job = LibraryScanner(db).scan_source(source.id)
    assert job.files_scanned == 2
    assert job.files_added == 2
    assert len(db.scalars(select(MediaFile)).all()) == 2

def test_second_scan_does_not_probe_unchanged_file(tmp_path: Path, monkeypatch):
    db = make_session()
    source = make_source(db, tmp_path)
    (tmp_path / "one.mp4").write_bytes(b"content")
    calls = {"count": 0}
    def fake_probe(path):
        calls["count"] += 1
        return None
    monkeypatch.setattr("app.services.library_scanner.probe_media", fake_probe)
    first = LibraryScanner(db).scan_source(source.id)
    second = LibraryScanner(db).scan_source(source.id)
    assert first.files_added == 1
    assert second.files_added == 0
    assert second.files_updated == 0
    assert calls["count"] == 1

def test_missing_file_is_marked_offline_not_deleted(tmp_path: Path, monkeypatch):
    db = make_session()
    source = make_source(db, tmp_path)
    media = tmp_path / "one.mkv"
    media.write_bytes(b"content")
    monkeypatch.setattr("app.services.library_scanner.probe_media", lambda path: None)
    LibraryScanner(db).scan_source(source.id)
    media.unlink()
    LibraryScanner(db).scan_source(source.id)
    stored = db.scalar(select(MediaFile))
    assert stored is not None
    assert stored.online is False

def test_rename_reuses_media_file_identity(tmp_path: Path, monkeypatch):
    db = make_session()
    source = make_source(db, tmp_path)
    original = tmp_path / "old.mp4"
    original.write_bytes(b"same-content")
    monkeypatch.setattr("app.services.library_scanner.probe_media", lambda path: None)
    LibraryScanner(db).scan_source(source.id)
    first_id = db.scalar(select(MediaFile)).id
    original.rename(tmp_path / "new.mp4")
    LibraryScanner(db).scan_source(source.id)
    files = db.scalars(select(MediaFile)).all()
    assert len(files) == 1
    assert files[0].id == first_id
    assert files[0].absolute_path.endswith("new.mp4")
