from pathlib import Path
from app.services.fingerprint_service import build_fingerprint

def test_fingerprint_changes_when_content_changes(tmp_path: Path):
    file_path = tmp_path / "movie.mp4"
    file_path.write_bytes(b"a" * 100)
    first = build_fingerprint(file_path)
    file_path.write_bytes(b"b" * 100)
    second = build_fingerprint(file_path)
    assert first != second

def test_fingerprint_contains_file_size(tmp_path: Path):
    file_path = tmp_path / "movie.mkv"
    file_path.write_bytes(b"abc")
    assert build_fingerprint(file_path).startswith("3:")
