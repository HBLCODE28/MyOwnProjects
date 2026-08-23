from hashlib import sha256
from pathlib import Path

CHUNK_SIZE = 1024 * 1024

def build_fingerprint(path: Path) -> str:
    stat = path.stat()
    first_hash = sha256()
    last_hash = sha256()

    with path.open("rb") as handle:
        first_hash.update(handle.read(CHUNK_SIZE))
        if stat.st_size > CHUNK_SIZE:
            handle.seek(max(0, stat.st_size - CHUNK_SIZE))
            last_hash.update(handle.read(CHUNK_SIZE))
        else:
            last_hash.update(b"")

    return f"{stat.st_size}:{first_hash.hexdigest()}:{last_hash.hexdigest()}"
