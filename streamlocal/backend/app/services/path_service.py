from pathlib import Path
import os

SUPPORTED_VIDEO_EXTENSIONS = {".mp4", ".mkv"}

def normalize_windows_path(path: str | Path) -> str:
    resolved = Path(path).expanduser().resolve()
    return os.path.normcase(os.path.normpath(str(resolved)))

def validate_library_folder(path: str) -> Path:
    candidate = Path(path).expanduser()
    if not candidate.exists():
        raise ValueError("Folder does not exist.")
    if not candidate.is_dir():
        raise ValueError("Path is not a folder.")
    return candidate.resolve()

def iter_media_files(root: Path, recursive: bool = True):
    iterator = root.rglob("*") if recursive else root.glob("*")
    for candidate in iterator:
        if candidate.is_file() and candidate.suffix.lower() in SUPPORTED_VIDEO_EXTENSIONS:
            yield candidate
