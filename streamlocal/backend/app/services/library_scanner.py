from datetime import datetime
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.models import AudioTrack, LibrarySource, MediaFile, MediaItem, ScanJob, SubtitleTrack
from app.services.ffprobe_service import FFprobeUnavailable, probe_media
from app.services.fingerprint_service import build_fingerprint
from app.services.path_service import iter_media_files, normalize_windows_path

class LibraryScanner:
    def __init__(self, db: Session):
        self.db = db

    def scan_source(self, source_id: int) -> ScanJob:
        source = self.db.get(LibrarySource, source_id)
        if source is None:
            raise ValueError("Library source was not found.")
        if not source.enabled:
            raise ValueError("Library source is disabled.")

        root = Path(source.path)
        if not root.exists() or not root.is_dir():
            raise ValueError("Library source folder is unavailable.")

        job = ScanJob(source_id=source.id, status="running")
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        seen_paths: set[str] = set()

        try:
            for path in iter_media_files(root, recursive=source.recursive):
                job.files_scanned += 1
                normalized = normalize_windows_path(path)
                seen_paths.add(normalized)
                try:
                    outcome = self._upsert_file(source, path, normalized)
                    if outcome == "added":
                        job.files_added += 1
                    elif outcome == "updated":
                        job.files_updated += 1
                except Exception as exc:
                    job.errors_count += 1
                    if job.error_message is None:
                        job.error_message = str(exc)

            for media_file in self.db.scalars(
                select(MediaFile).where(MediaFile.library_source_id == source.id)
            ).all():
                if media_file.normalized_path not in seen_paths:
                    media_file.online = False

            now = datetime.now()
            source.last_scan_at = now
            job.finished_at = now
            job.status = "complete" if job.errors_count == 0 else "complete_with_errors"
            self.db.commit()
            self.db.refresh(job)
            return job
        except Exception as exc:
            job.status = "failed"
            job.finished_at = datetime.now()
            job.errors_count += 1
            job.error_message = str(exc)
            self.db.commit()
            raise

    def _upsert_file(self, source: LibrarySource, path: Path, normalized: str) -> str:
        stat = path.stat()
        modified = datetime.fromtimestamp(stat.st_mtime)
        created = datetime.fromtimestamp(stat.st_ctime) if stat.st_ctime else None

        existing = self.db.scalar(
            select(MediaFile)
            .options(selectinload(MediaFile.audio_tracks), selectinload(MediaFile.subtitle_tracks))
            .where(MediaFile.normalized_path == normalized)
        )

        if existing is not None and existing.file_size == stat.st_size and existing.modified_at_fs == modified:
            existing.online = True
            existing.last_seen_at = datetime.now()
            self.db.commit()
            return "unchanged"

        fingerprint = build_fingerprint(path)

        if existing is None:
            existing = self.db.scalar(
                select(MediaFile)
                .options(selectinload(MediaFile.audio_tracks), selectinload(MediaFile.subtitle_tracks))
                .where(MediaFile.fingerprint == fingerprint)
                .order_by(MediaFile.online.asc())
            )

        try:
            probe = probe_media(path)
        except (FFprobeUnavailable, RuntimeError, ValueError, OSError):
            probe = None

        if existing is not None:
            existing.absolute_path = str(path)
            existing.normalized_path = normalized
            existing.library_source_id = source.id
            existing.file_size = stat.st_size
            existing.modified_at_fs = modified
            existing.created_at_fs = created
            existing.fingerprint = fingerprint
            existing.online = True
            existing.last_seen_at = datetime.now()
            self._apply_probe(existing, probe)
            self.db.commit()
            return "updated"

        item = MediaItem(media_type="unmatched", title=path.stem)
        self.db.add(item)
        self.db.flush()

        media_file = MediaFile(
            media_item_id=item.id,
            library_source_id=source.id,
            absolute_path=str(path),
            normalized_path=normalized,
            file_size=stat.st_size,
            modified_at_fs=modified,
            created_at_fs=created,
            fingerprint=fingerprint,
            online=True,
            last_seen_at=datetime.now(),
        )
        self.db.add(media_file)
        self.db.flush()
        self._apply_probe(media_file, probe)
        self.db.commit()
        return "added"

    def _apply_probe(self, media_file: MediaFile, probe) -> None:
        if probe is None:
            return
        media_file.container = probe.container
        media_file.duration_seconds = probe.duration_seconds
        media_file.width = probe.width
        media_file.height = probe.height
        media_file.video_codec = probe.video_codec
        media_file.frame_rate = probe.frame_rate
        media_file.bitrate = probe.bitrate
        media_file.ffprobe_json = probe.raw_json
        media_file.audio_tracks.clear()
        media_file.subtitle_tracks.clear()
        for track in probe.audio_tracks:
            media_file.audio_tracks.append(AudioTrack(
                stream_index=track.stream_index, language=track.language, title=track.title,
                codec=track.codec, channels=track.channels, is_default=track.is_default,
            ))
        for track in probe.subtitle_tracks:
            media_file.subtitle_tracks.append(SubtitleTrack(
                stream_index=track.stream_index, source_type="embedded", language=track.language,
                title=track.title, format=track.format, is_default=track.is_default,
            ))
