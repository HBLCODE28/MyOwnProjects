import os
import shutil
import sys
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from werkzeug.security import generate_password_hash
from pyngrok import ngrok
from pyngrok.conf import PyngrokConfig
from pyngrok.exception import PyngrokNgrokInstallError

DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin123"
DB_NAME = "beatsense.sqlite3"
NGROK_ENV = "NGROK_AUTHTOKEN"
LOCAL_PORT = 5000
NGROK_PATH_ENV = "NGROK_PATH"


def set_base_path() -> Path:
    in_colab = "google.colab" in sys.modules
    if in_colab:
        from google.colab import drive
        drive.mount("/content/drive")

    env_path = os.getenv("BEATSENSE_BASE_PATH", "").strip()
    candidates = [
        Path(env_path) if env_path else None,
        Path.cwd(),
        Path(__file__).resolve().parent,
        Path("/content/drive/.shortcut-targets-by-id/1j2sw71JRivxu8M8D8ZLogivOqyPymLY5/final-project:תדר"),
        Path("/content/drive/MyDrive/hila ben levy/final-project:BeatSense"),
    ]
    base_path = next(
        (
            candidate
            for candidate in candidates
            if candidate
            and candidate.exists()
            and (candidate / "app.py").exists()
            and (candidate / "main.ipynb").exists()
        ),
        None,
    )
    if base_path is None:
        raise FileNotFoundError("Could not locate the BeatSense project directory.")

    os.chdir(base_path)
    os.environ["BEATSENSE_BASE_PATH"] = str(base_path)
    return base_path


def get_db_path(base_path: Path) -> Path:
    return base_path / DB_NAME


def resolve_ngrok_path() -> str:
    candidates = [
        os.getenv(NGROK_PATH_ENV, "").strip(),
        shutil.which("ngrok") or "",
        "/usr/local/bin/ngrok",
        "/root/.ngrok2/ngrok",
        "/root/.cache/ngrok/ngrok",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return ""


def ensure_schema(db: sqlite3.Connection) -> None:
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            liked_genres TEXT DEFAULT '[]',
            disliked_genres TEXT DEFAULT '[]',
            is_admin INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            source_type TEXT NOT NULL,
            source_name TEXT NOT NULL,
            model_path TEXT NOT NULL DEFAULT '',
            label TEXT NOT NULL,
            confidence REAL NOT NULL,
            score REAL NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS battles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_by INTEGER,
            model_a TEXT,
            model_b TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT '',
            last_result_json TEXT
        );
        """
    )
    db.commit()


def ensure_admin(db_path: Path) -> None:
    with sqlite3.connect(db_path) as db:
        ensure_schema(db)
        exists = db.execute("SELECT id FROM users WHERE username = ?", (DEFAULT_USERNAME,)).fetchone()
        if exists:
            return
        db.execute(
            "INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?)",
            (DEFAULT_USERNAME, generate_password_hash(DEFAULT_PASSWORD), 1, datetime.now(timezone.utc).isoformat(timespec="seconds")),
        )
        db.commit()


def run_server() -> None:
    token = os.getenv(NGROK_ENV)
    if not token:
        raise RuntimeError("NGROK token missing")
    ngrok_path = resolve_ngrok_path()
    pyngrok_config = PyngrokConfig(ngrok_path=ngrok_path) if ngrok_path else None

    try:
        ngrok.set_auth_token(token, pyngrok_config=pyngrok_config)
    except PyngrokNgrokInstallError as exc:
        raise RuntimeError(
            "pyngrok could not download ngrok and no local ngrok binary was found. "
            "If this keeps happening, install ngrok manually once in Colab and set NGROK_PATH."
        ) from exc

    ngrok.kill(pyngrok_config=pyngrok_config)
    public_url = ngrok.connect(LOCAL_PORT, pyngrok_config=pyngrok_config)
    print("Public URL:", public_url)
    from app import app
    app.run(port=LOCAL_PORT, use_reloader=False)


if __name__ == "__main__":
    base_path = set_base_path()
    ensure_admin(get_db_path(base_path))
    run_server()
