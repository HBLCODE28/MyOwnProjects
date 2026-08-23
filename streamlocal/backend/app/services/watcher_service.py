from threading import Lock, Timer
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer
from app.database import SessionLocal
from app.models import LibrarySource
from app.services.library_scanner import LibraryScanner

class DebouncedSourceHandler(FileSystemEventHandler):
    def __init__(self, source_id: int):
        super().__init__()
        self.source_id = source_id
        self._timer: Timer | None = None
        self._lock = Lock()

    def on_any_event(self, event):
        if event.is_directory:
            return
        with self._lock:
            if self._timer:
                self._timer.cancel()
            self._timer = Timer(3.0, self._scan)
            self._timer.daemon = True
            self._timer.start()

    def _scan(self):
        with SessionLocal() as db:
            try:
                LibraryScanner(db).scan_source(self.source_id)
            except Exception:
                pass

class WatcherManager:
    def __init__(self):
        self._observer: Observer | None = None

    def start(self):
        if self._observer is not None:
            return
        observer = Observer()
        with SessionLocal() as db:
            sources = db.query(LibrarySource).filter(LibrarySource.enabled.is_(True)).all()
            for source in sources:
                try:
                    observer.schedule(DebouncedSourceHandler(source.id), source.path, recursive=source.recursive)
                except OSError:
                    continue
        observer.daemon = True
        observer.start()
        self._observer = observer

    def stop(self):
        if self._observer is None:
            return
        self._observer.stop()
        self._observer.join(timeout=5)
        self._observer = None

    def restart(self):
        self.stop()
        self.start()

watcher_manager = WatcherManager()
