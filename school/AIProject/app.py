from collections import Counter
from datetime import datetime, timedelta
from email.message import EmailMessage
from functools import wraps
import hashlib
import importlib.util
import json
import math
import os
import pickle
import re
import secrets
import shutil
import smtplib
import subprocess
import tempfile
import threading
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from flask import (
    Flask,
    abort,
    flash,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from flask_login import (
    LoginManager,
    UserMixin,
    current_user,
    login_required,
    login_user,
    logout_user,
)
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / "instance"
METRICS_DIR = BASE_DIR / "metrics"
TRAIN_PROFILE_PATH = INSTANCE_DIR / "genre_profiles.json"
GENRE_CLASSIFIER_PATH = INSTANCE_DIR / "genre_classifier.pkl"
GENRE_CLASSIFIER_META_PATH = INSTANCE_DIR / "genre_classifier_meta.json"
GENRE_CLASSIFIER_VERSION = "segment-logreg-v2"
MAIN_TRAINING_NOTEBOOK = BASE_DIR / "main.ipynb"
MAIN_TRAINING_RUNNER = BASE_DIR / "run_main_training.py"
TRAINING_SPLITS = ("train", "val", "test")
IMG_HEIGHT = 40
IMG_WIDTH = 200
N_MFCC = 40
HOP_LENGTH = 512
SAMPLE_RATE = 22050
DURATION_SECONDS = 4.0
TARGET_SAMPLES = int(SAMPLE_RATE * DURATION_SECONDS)
ANALYSIS_SOURCE_SECONDS = 30
MULTI_SEGMENT_TIMESTAMPS = (0.2, 0.4, 0.5, 0.6, 0.8)
SEGMENT_WEIGHT_AVG = 0.7
SEGMENT_WEIGHT_MAX = 0.3
MAX_FILE_SIZE_MB = 50
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
APP_TIMEZONE = ZoneInfo("Asia/Jerusalem")
MAIN_PROGRESS_PATTERN = re.compile(r"^\[progress\]\s+(\d+)%\s*(.*)$")
MAIN_LOG_MARKERS = (
    "Loaded training namespace",
    "Override applied:",
    "Genres detected:",
    "Training config:",
    "Augmentation config:",
    "Train split files:",
    "Val split files:",
    "Test split files:",
    "Training data shape:",
    "Validation data shape:",
    "Test data shape:",
    "Train label distribution:",
    "Validation label distribution:",
    "Test label distribution:",
    "Saved shared feature scaler to:",
    "Model built for",
    "Class weights:",
    "Starting model.fit()",
    "Training summary:",
    "Saved model to:",
    "Saved evaluation report to:",
    "Saved confusion matrix to:",
    "Training complete.",
    "Error during training:",
    "Training failed:",
)
NOISY_LOG_MARKERS = [
    "Debugger warning:",
    "make the debugger miss breakpoints.",
    "Please pass -Xfrozen_modules=off",
    "Note: Debugging will proceed.",
    "PYDEVD_DISABLE_FILE_VALIDATION=1",
    "[NbConvertApp] ERROR | unhandled iopub msg: colab_request",
    "Could not find cuda drivers on your machine",
    "Unable to register cuFFT factory",
    "Unable to register cuDNN factory",
    "Unable to register cuBLAS factory",
    "tensorflow/core/platform/cpu_feature_guard.cc",
    "TF-TRT Warning: Could not find TensorRT",
]
INSTANCE_DIR.mkdir(exist_ok=True)


def now_local_str(fmt="%Y-%m-%d %H:%M:%S"):
    return datetime.now(APP_TIMEZONE).strftime(fmt)

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SECRET_KEY"] = os.environ.get("BEATSENSE_SECRET_KEY", "beatsense-dev-secret")
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE_BYTES
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("BEATSENSE_COOKIE_SECURE", "0").strip() == "1"


db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = "login"

prediction_history = {}
battles = []
MODEL_CACHE = {}
SCALER_CACHE = {}
GENRE_CLASSIFIER_CACHE = None
TRAINING_STATUS_LOCK = threading.Lock()
training_status = {
    "stage_label": "ממתין",
    "message": "עדיין לא התחיל",
    "progress": 0,
    "graph": [],
    "recent_metrics": [],
    "last_run": None,
    "profile_path": None,
    "running": False,
    "started_at": None,
    "finished_at": None,
    "_thread": None,
}
main_training_status = {
    "stage_label": "ממתין",
    "message": "עדיין לא התחיל",
    "progress": 0,
    "running": False,
    "started_at": None,
    "finished_at": None,
    "log_path": None,
    "output_notebook": None,
    "last_exit_code": None,
    "post_refresh_started_for": None,
    "log_tail": [],
    "command": None,
    "_process": None,
    "_log_handle": None,
}


@login_manager.unauthorized_handler
def unauthorized():
    if request.path.startswith("/api") or request.path.startswith("/models_data"):
        return jsonify({"error": "unauthorized"}), 401
    return redirect(url_for("login"))


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True)
    email = db.Column(db.String(255), unique=True)
    password = db.Column(db.String(200))
    onboarding_step = db.Column(db.Integer, default=0)
    preference_genre = db.Column(db.String(255))
    preference_energy = db.Column(db.String(255))
    preference_use_case = db.Column(db.String(50))
    is_admin = db.Column(db.Boolean, default=False)
    reset_token_hash = db.Column(db.String(64), unique=True)
    reset_token_expires_at = db.Column(db.DateTime)
    reset_token_used_at = db.Column(db.DateTime)


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


def is_admin_user(user=None):
    target = user or current_user
    if not getattr(target, "is_authenticated", False):
        return False
    if bool(getattr(target, "is_admin", False)):
        return True
    if getattr(target, "username", "").strip().lower() == "admin":
        try:
            return User.query.filter_by(is_admin=True).first() is None
        except Exception:
            return True
    return False


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not current_user.is_authenticated:
            return login_manager.unauthorized()
        if is_admin_user(current_user):
            return view(*args, **kwargs)
        if request.path.startswith("/api") or request.path.startswith("/models_data"):
            return jsonify({"error": "forbidden"}), 403
        flash("נדרשת הרשאת אדמין כדי לצפות בעמוד הזה.", "error")
        return redirect(url_for("dashboard"))

    return wrapped


@app.before_request
def attach_template_user():
    g.user = {"username": current_user.username} if current_user.is_authenticated else None


@app.context_processor
def inject_globals():
    return {
        "is_admin": is_admin_user(current_user),
        "translate_preference_label": translate_preference_label,
    }


def ensure_database_schema():
    db.create_all()
    sqlite_columns = {
        "email": "VARCHAR(255)",
        "is_admin": "BOOLEAN DEFAULT 0",
        "reset_token_hash": "VARCHAR(64)",
        "reset_token_expires_at": "DATETIME",
        "reset_token_used_at": "DATETIME",
    }
    with db.engine.begin() as conn:
        existing = {
            row[1]
            for row in conn.exec_driver_sql("PRAGMA table_info(user)").fetchall()
        }
        for column_name, column_sql in sqlite_columns.items():
            if column_name not in existing:
                conn.exec_driver_sql(f"ALTER TABLE user ADD COLUMN {column_name} {column_sql}")


def token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def send_password_reset_email(user, reset_link):
    site_name = "תדר"
    smtp_host = os.environ.get("BEATSENSE_SMTP_HOST", "").strip()
    if not smtp_host:
        return False, "SMTP is not configured."

    smtp_port = int(os.environ.get("BEATSENSE_SMTP_PORT", "587"))
    smtp_user = os.environ.get("BEATSENSE_SMTP_USER", "").strip()
    smtp_password = os.environ.get("BEATSENSE_SMTP_PASSWORD", "")
    sender = os.environ.get("BEATSENSE_EMAIL_FROM", smtp_user).strip()
    use_ssl = os.environ.get("BEATSENSE_SMTP_SSL", "0").strip() == "1" or smtp_port == 465
    use_tls = os.environ.get("BEATSENSE_SMTP_TLS", "1").strip() != "0" and not use_ssl
    if not sender:
        return False, "Sender email is not configured."

    message = EmailMessage()
    message["Subject"] = f"איפוס סיסמה ל{site_name}"
    message["From"] = sender
    message["To"] = user.email
    plain_body = "\n".join(
        [
            f"{site_name}",
            "",
            "שלום,",
            "",
            "קיבלנו בקשה לאיפוס הסיסמה עבור החשבון שלך.",
            "",
            "כדי לאפס את הסיסמה, אנא לחץ/י על הקישור הבא:",
            reset_link,
            "",
            "אם לא ביקשת לאפס את הסיסמה, ניתן להתעלם מהודעה זו והסיסמה שלך תישאר ללא שינוי.",
            "",
            "למען אבטחת המידע שלך, הקישור יהיה זמין לזמן מוגבל בלבד.",
            "",
            "במידה ואת/ה נתקל/ת בבעיה או זקוק/ה לעזרה נוספת, נשמח לעמוד לרשותך.",
            "",
            "בברכה,",
            "צוות התמיכה",
        ]
    )
    html_body = f"""\
<!doctype html>
<html lang="he" dir="rtl">
  <body dir="rtl" style="margin:0;background:#f4f7fb;font-family:Rubik,Arial,Helvetica,sans-serif;color:#172033;text-align:right;">
    <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
      <div dir="rtl" style="background:#ffffff;border:1px solid #d9e2ef;border-radius:8px;padding:28px;line-height:1.75;font-size:16px;text-align:right;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-family:Rubik,Arial,Helvetica,sans-serif;font-size:32px;font-weight:700;color:#111827;line-height:1;">{site_name}</div>
        </div>
        <p>שלום,</p>
        <p>קיבלנו בקשה לאיפוס הסיסמה עבור החשבון שלך.</p>
        <p>כדי לאפס את הסיסמה, אנא לחץ/י על הקישור הבא:</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="{reset_link}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 20px;font-weight:700;">איפוס סיסמה</a>
        </p>
        <p>אם לא ביקשת לאפס את הסיסמה, ניתן להתעלם מהודעה זו והסיסמה שלך תישאר ללא שינוי.</p>
        <p>למען אבטחת המידע שלך, הקישור יהיה זמין לזמן מוגבל בלבד.</p>
        <p>במידה ואת/ה נתקל/ת בבעיה או זקוק/ה לעזרה נוספת, נשמח לעמוד לרשותך.</p>
        <p>בברכה,<br />צוות התמיכה</p>
      </div>
    </div>
  </body>
</html>
"""
    message.set_content(plain_body)
    message.add_alternative(html_body, subtype="html")

    try:
        smtp_class = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
        with smtp_class(smtp_host, smtp_port, timeout=20) as server:
            if use_tls:
                server.starttls()
            if smtp_user or smtp_password:
                server.login(smtp_user, smtp_password)
            server.send_message(message)
        return True, ""
    except smtplib.SMTPAuthenticationError:
        return False, "SMTP authentication failed. Check the Gmail account and App Password."
    except (smtplib.SMTPException, OSError) as exc:
        return False, f"SMTP send failed: {exc}"


def project_path(*parts):
    return BASE_DIR.joinpath(*parts)


def csv_to_list(raw_value):
    if not raw_value:
        return []
    return [value for value in raw_value.split(",") if value]


def get_genres():
    base = project_path("data", "processed_data", "train")
    if not base.exists():
        return []
    excluded = {"like", "dislike"}
    return sorted(
        entry.name
        for entry in base.iterdir()
        if entry.is_dir() and entry.name not in excluded
    )


def get_user_preferences(user):
    liked = csv_to_list(user.preference_genre)
    disliked = csv_to_list(user.preference_energy)
    return liked, disliked


def save_user_preferences(user, liked, disliked):
    user.preference_genre = ",".join(sorted(dict.fromkeys(liked)))
    user.preference_energy = ",".join(sorted(dict.fromkeys(disliked)))
    user.onboarding_step = 1


def get_user_history(user):
    return prediction_history.get(user.username, [])


def add_history_entry(user, source_name, label):
    history = prediction_history.setdefault(user.username, [])
    history.insert(
        0,
        {
            "created_at": now_local_str(),
            "source_name": source_name,
            "label": label,
        },
    )
    del history[10:]


def parse_model_stats(name):
    accuracy_match = re.search(r"acc_(\d+(?:\.\d+)?)", name)
    epoch_match = re.search(r"ep(\d+)", name)
    accuracy = float(accuracy_match.group(1)) if accuracy_match else None
    epoch = int(epoch_match.group(1)) if epoch_match else None
    return accuracy, epoch


def sidecar_candidates(model_path):
    return [model_path.with_suffix(".json"), Path(f"{model_path}.json")]


def sidecar_path(model_path):
    for candidate in sidecar_candidates(model_path):
        if candidate.exists():
            return candidate
    return model_path.with_suffix(".json")


def scaler_sidecar_path(model_path):
    return model_path.with_suffix(".scaler.pkl")


def load_model_metadata(model_path):
    meta_path = sidecar_path(model_path)
    if meta_path.exists():
        with meta_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    else:
        data = {}

    accuracy, epoch = parse_model_stats(model_path.name)
    data.setdefault("name", model_path.name)
    data.setdefault("accuracy", f"{accuracy:.3f}" if accuracy is not None else "N/A")
    data.setdefault("epoch", epoch if epoch is not None else "N/A")
    data.setdefault("battles", [])
    data.setdefault("wins", 0)
    data.setdefault("losses", 0)
    data.setdefault("draws", 0)
    return data


def save_model_metadata(model_path, metadata):
    meta_path = sidecar_path(model_path)
    with meta_path.open("w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)


def recalculate_record_totals(metadata):
    results = Counter(entry.get("result") for entry in metadata.get("battles", []))
    metadata["wins"] = results.get("win", 0)
    metadata["losses"] = results.get("loss", 0)
    metadata["draws"] = results.get("draw", 0)


def upsert_battle_record(model_path, battle_id, opponent_name, outcome):
    metadata = load_model_metadata(model_path)
    history = [entry for entry in metadata.get("battles", []) if entry.get("battle_id") != battle_id]
    history.append(
        {
            "battle_id": battle_id,
            "timestamp": now_local_str("%Y-%m-%d %H:%M"),
            "result": outcome,
            "opponent": opponent_name,
        }
    )
    metadata["battles"] = history[-20:]
    recalculate_record_totals(metadata)
    save_model_metadata(model_path, metadata)


def model_record_summary(model_path, rel_path):
    metadata = load_model_metadata(model_path)
    wins = int(metadata.get("wins", 0))
    losses = int(metadata.get("losses", 0))
    draws = int(metadata.get("draws", 0))
    total = max(wins + losses + draws, 1)
    accuracy = metadata.get("accuracy", "N/A")
    test_match = re.search(r"test_(\d+(?:\.\d+)?)", model_path.name)
    test_accuracy = test_match.group(1) if test_match else metadata.get("test_accuracy", "N/A")
    short_name = model_path.stem
    if short_name.startswith("BeatSense_genre_"):
        short_name = short_name[len("BeatSense_genre_"):]
    if "_acc_" in short_name:
        short_name = short_name.split("_acc_", 1)[0]
    short_name = short_name.replace("_", " ")
    return {
        "name": model_path.name,
        "short_name": short_name,
        "path": rel_path,
        "accuracy": accuracy,
        "test_accuracy": test_accuracy,
        "epoch": metadata.get("epoch", "N/A"),
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "battle_count": wins + losses + draws,
        "win_width": round((wins / total) * 100, 2),
        "loss_width": round((losses / total) * 100, 2),
        "draw_width": round((draws / total) * 100, 2),
    }


def short_model_label(raw_name):
    if not raw_name:
        return "לא ידוע"
    short_name = Path(raw_name).stem
    if short_name.startswith("BeatSense_genre_"):
        short_name = short_name[len("BeatSense_genre_"):]
    if short_name.startswith("models_history/"):
        short_name = short_name[len("models_history/"):]
    if "_acc_" in short_name:
        short_name = short_name.split("_acc_", 1)[0]
    return short_name.replace("_", " ")


def find_models():
    seen = set()
    models = []
    excluded_dirs = {".venv", "__pycache__", "backups", "instance", ".git"}
    for directory in (BASE_DIR, project_path("models_history")):
        if not directory.exists():
            continue
        for model_path in sorted(directory.rglob("*")):
            if excluded_dirs.intersection(model_path.parts):
                continue
            if not model_path.is_file() or model_path.suffix not in {".keras", ".h5"}:
                continue
            if model_path in seen:
                continue
            seen.add(model_path)
            rel_path = os.path.relpath(model_path, BASE_DIR)
            models.append(model_record_summary(model_path, rel_path))
    return models


def best_available_genre_model_path():
    best_path = None
    best_score = (-1.0, -1.0, -1)

    for model in find_models():
        model_path = BASE_DIR / model["path"]
        metadata = load_model_metadata(model_path)
        if metadata.get("task") != "genre" and not metadata.get("genre_labels"):
            continue

        try:
            val_accuracy = float(metadata.get("accuracy", 0.0))
        except (TypeError, ValueError):
            val_accuracy = 0.0

        try:
            test_accuracy = float(metadata.get("test_accuracy", 0.0))
        except (TypeError, ValueError):
            test_accuracy = 0.0

        try:
            epoch = int(metadata.get("epoch", 0))
        except (TypeError, ValueError):
            epoch = 0

        score = (test_accuracy, val_accuracy, epoch)
        if score > best_score:
            best_score = score
            best_path = model_path

    return best_path


def resolve_model_path(rel_path):
    for model in find_models():
        if model["path"] == rel_path:
            return BASE_DIR / rel_path
    return None


def normalize_model_reference(raw_path):
    if not raw_path:
        return None

    direct_path = BASE_DIR / raw_path
    if direct_path.exists():
        return raw_path

    try:
        target = Path(raw_path).expanduser()
    except (TypeError, ValueError):
        return None

    for model in find_models():
        model_path = BASE_DIR / model["path"]
        if str(model_path) == str(target) or model_path.name == target.name:
            return model["path"]
    return None


def active_model_path():
    config_path = project_path("active_model.json")
    if not config_path.exists():
        return None
    with config_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    normalized_path = normalize_model_reference(data.get("path") or data.get("model_path"))
    if normalized_path:
        if data.get("path") != normalized_path:
            save_active_model(normalized_path)
        return normalized_path

    save_active_model(None)
    return None


def save_active_model(path):
    config_path = project_path("active_model.json")
    if not path:
        if config_path.exists():
            config_path.unlink()
        return
    normalized_path = normalize_model_reference(path) or path
    with config_path.open("w", encoding="utf-8") as handle:
        json.dump({"path": normalized_path}, handle, indent=2)


def ml_runtime():
    cache = getattr(ml_runtime, "_cache", None)
    if cache is None:
        import librosa
        import numpy as np
        from tensorflow.keras.models import load_model

        cache = {"librosa": librosa, "np": np, "load_model": load_model}
        ml_runtime._cache = cache
    return cache


def validate_audio_file(file_path):
    target = Path(file_path)
    if not target.exists() or not target.is_file():
        return False, "הקובץ לא קיים."
    if target.stat().st_size == 0:
        return False, "הקובץ ריק."
    if target.stat().st_size > MAX_FILE_SIZE_BYTES:
        return False, f"הקובץ גדול מדי. הגודל המרבי הוא {MAX_FILE_SIZE_MB}MB."
    return True, ""


def validate_url(url):
    if not url:
        return False
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return False

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return False

    valid_domains = {"youtube.com", "youtu.be", "music.youtube.com"}
    return hostname in valid_domains or any(
        hostname.endswith(f".{domain}") for domain in valid_domains if domain != "youtu.be"
    )


def humanize_youtube_download_error(error_text):
    lowered = (error_text or "").lower()

    if any(
        marker in lowered
        for marker in (
            "not available in your country",
            "not available in your region",
            "video is unavailable in your country",
            "geo-restricted",
            "geo restricted",
            "geoblocked",
            "geo block",
        )
    ):
        return "This YouTube video is unavailable in your country."

    if "private video" in lowered:
        return "This YouTube video is private."

    if any(marker in lowered for marker in ("video unavailable", "this video is unavailable")):
        return "This YouTube video is unavailable."

    return error_text


def save_uploaded_audio(file_storage, prefix):
    suffix = Path(file_storage.filename or "upload.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, dir=INSTANCE_DIR, prefix=prefix, suffix=suffix) as handle:
        file_storage.save(handle.name)
        return Path(handle.name)


def download_youtube_audio(url, output_path):
    import yt_dlp

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    stem = output_path.with_suffix("")
    template = f"{stem}.%(ext)s"
    base_options = {
        "format": "bestaudio/best",
        "outtmpl": template,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
            "preferredquality": "192",
        }],
    }

    def run_download(options):
        with yt_dlp.YoutubeDL(options) as ydl:
            ydl.download([url])

    try:
        run_download(base_options)
    except Exception as exc:
        error_text = str(exc)
        cookie_related = any(
            marker in error_text.lower()
            for marker in ("cookies", "cookie", "sign in", "confirm you're not a bot")
        )
        if not cookie_related:
            return False, humanize_youtube_download_error(error_text)
        try:
            retry_options = dict(base_options)
            cookies_file = os.environ.get("YTDLP_COOKIES_FILE", "").strip()
            chrome_cookie_db = Path.home() / ".config" / "google-chrome" / "Default" / "Cookies"
            if cookies_file:
                retry_options["cookiefile"] = cookies_file
            elif chrome_cookie_db.exists():
                retry_options["cookiesfrombrowser"] = ("chrome",)
            else:
                return False, (
                    "YouTube ביקש cookies או התחברות, אבל לא נמצא קובץ cookies של Chrome בשרת. "
                    "יש להגדיר YTDLP_COOKIES_FILE לקובץ cookies תקין או להשתמש בקישור YouTube פתוח."
                )
            run_download(retry_options)
        except Exception as retry_exc:
            return False, humanize_youtube_download_error(str(retry_exc))

    wav_path = stem.with_suffix(".wav")
    if wav_path.exists():
        return True, wav_path

    matches = sorted(output_path.parent.glob(f"{stem.name}*.wav"))
    if matches:
        return True, matches[0]
    return False, "קובץ האודיו שהורד לא נוצר."


def load_prediction_scaler(model_path=None):
    scaler_path = scaler_sidecar_path(Path(model_path)) if model_path else None
    if scaler_path is None or not scaler_path.exists():
        scaler_path = project_path("mfcc_scaler.pkl")
    cache_key = str(scaler_path)
    if cache_key in SCALER_CACHE:
        return SCALER_CACHE[cache_key]
    if not scaler_path.exists():
        SCALER_CACHE[cache_key] = None
        return None
    with scaler_path.open("rb") as handle:
        scaler = pickle.load(handle)
    SCALER_CACHE[cache_key] = scaler
    return scaler


def load_prediction_model(model_path):
    runtime = ml_runtime()
    cache_key = str(model_path)
    if cache_key not in MODEL_CACHE:
        MODEL_CACHE[cache_key] = runtime["load_model"](model_path)
    return MODEL_CACHE[cache_key]


def audio_to_mfcc(y, sr, scaler=None):
    runtime = ml_runtime()
    np = runtime["np"]
    librosa = runtime["librosa"]

    if len(y) < sr:
        return None

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC, hop_length=HOP_LENGTH)
    if mfcc.shape[1] < IMG_WIDTH:
        mfcc = np.pad(mfcc, ((0, 0), (0, IMG_WIDTH - mfcc.shape[1])), mode="constant")
    else:
        mfcc = mfcc[:, :IMG_WIDTH]

    mfcc_flat = mfcc.flatten().reshape(1, -1)
    if isinstance(scaler, dict) and scaler.get("kind") == "tensor_stats":
        mean_value = np.asarray(scaler.get("mean", []), dtype=np.float32).reshape(1, -1)
        std_value = np.asarray(scaler.get("std", []), dtype=np.float32).reshape(1, -1)
        if mean_value.size == mfcc_flat.shape[1] and std_value.size == mfcc_flat.shape[1]:
            mfcc_flat = (mfcc_flat - mean_value) / (std_value + 1e-6)
        else:
            mfcc_flat = (mfcc_flat - np.mean(mfcc_flat)) / (np.std(mfcc_flat) + 1e-6)
    elif scaler is not None and hasattr(scaler, "transform"):
        mfcc_flat = scaler.transform(mfcc_flat)
    else:
        mfcc_flat = (mfcc_flat - np.mean(mfcc_flat)) / (np.std(mfcc_flat) + 1e-6)

    mfcc_normalized = mfcc_flat.reshape(IMG_HEIGHT, IMG_WIDTH)
    return np.expand_dims(mfcc_normalized, axis=-1)


def select_representative_starts(y_full, desired_count=6):
    runtime = ml_runtime()
    np = runtime["np"]

    if len(y_full) <= TARGET_SAMPLES:
        return [0]

    max_start = len(y_full) - TARGET_SAMPLES
    starts = [0, max_start // 2]
    starts.extend(int(max_start * fraction) for fraction in MULTI_SEGMENT_TIMESTAMPS)

    step_size = max(1, TARGET_SAMPLES // 3)
    energy_candidates = []
    for start in range(0, max_start + 1, step_size):
        clip = y_full[start:start + TARGET_SAMPLES]
        if len(clip) < TARGET_SAMPLES:
            continue
        energy = float(np.mean(np.square(clip)))
        energy_candidates.append((energy, start))

    energy_candidates.sort(reverse=True)
    min_gap = max(1, TARGET_SAMPLES // 2)

    for _, start in energy_candidates:
        if all(abs(start - existing) >= min_gap for existing in starts):
            starts.append(start)
        if len(starts) >= desired_count:
            break

    normalized = []
    seen = set()
    for start in starts:
        start = max(0, min(int(start), max_start))
        if start in seen:
            continue
        seen.add(start)
        normalized.append(start)
    return normalized


def load_audio_for_analysis(audio_path, duration=30):
    runtime = ml_runtime()
    librosa = runtime["librosa"]

    try:
        y_full, sr = librosa.load(str(audio_path), sr=SAMPLE_RATE, duration=duration)
    except Exception:
        return None, None

    if len(y_full) == 0:
        return None, None
    return y_full, sr


def build_prediction_batch(audio_path, scaler):
    runtime = ml_runtime()
    np = runtime["np"]
    y_full, sr = load_audio_for_analysis(audio_path, duration=30)
    if y_full is None:
        return None

    starts = select_representative_starts(y_full, desired_count=6)
    segments = []
    for start in starts:
        clip = y_full[start:start + TARGET_SAMPLES]
        if len(clip) < TARGET_SAMPLES:
            clip = np.pad(clip, (0, TARGET_SAMPLES - len(clip)), mode="constant")
        spec = audio_to_mfcc(clip, sr, scaler=scaler)
        if spec is not None:
            segments.append(spec)

    if not segments:
        return None
    return np.array(segments)


def predict_audio_with_model(model_path, audio_path):
    runtime = ml_runtime()
    np = runtime["np"]

    metadata = load_model_metadata(model_path)
    model = load_prediction_model(str(model_path))

    if metadata.get("task") == "genre" or metadata.get("genre_labels"):
        scaler = load_prediction_scaler(model_path)
        batch = build_prediction_batch(audio_path, scaler=scaler)
        if batch is None or len(batch) == 0:
            raise ValueError("לא ניתן היה לחלץ מהקובץ מאפייני אודיו שימושיים.")

        probabilities = np.asarray(model.predict(batch, verbose=0))
        if probabilities.ndim == 1:
            probabilities = probabilities.reshape(1, -1)
        mean_probabilities = probabilities.mean(axis=0)
        labels = metadata.get("genre_labels") or metadata.get("labels") or metadata.get("genres") or []
        if len(labels) != len(mean_probabilities):
            labels = [f"class_{idx}" for idx in range(len(mean_probabilities))]

        scored = [
            {"genre": label, "score": round(float(score) * 100, 1)}
            for label, score in zip(labels, mean_probabilities)
        ]
        scored.sort(key=lambda item: item["score"], reverse=True)
        primary = scored[0] if scored else {"genre": "לא ידוע", "score": 0.0}
        return {
            "name": model_path.name,
            "task": "genre",
            "label": primary["genre"],
            "primary_genre": primary["genre"],
            "score": primary["score"],
            "confidence": primary["score"],
            "styles": scored[:3],
            "all_styles": scored,
            "engine": "keras",
            "accuracy": metadata.get("accuracy", "N/A"),
            "epoch": metadata.get("epoch", "N/A"),
            "segment_count": int(len(probabilities)),
        }

    scaler = load_prediction_scaler(model_path)
    batch = build_prediction_batch(audio_path, scaler)
    if batch is None or len(batch) == 0:
        raise ValueError("לא ניתן היה לחלץ מהקובץ מאפייני אודיו שימושיים.")

    probabilities = np.asarray(model.predict(batch, verbose=0)).reshape(-1)
    avg_score = float(probabilities.mean())
    peak_score = float(probabilities.max())
    blended_score = (avg_score * SEGMENT_WEIGHT_AVG) + (peak_score * SEGMENT_WEIGHT_MAX)
    blended_score = max(0.0, min(blended_score, 1.0))

    label = "Like" if blended_score >= 0.5 else "Dislike"
    confidence = blended_score if label == "Like" else 1.0 - blended_score
    return {
        "name": model_path.name,
        "task": "binary",
        "label": label,
        "score": round(blended_score * 100, 1),
        "confidence": round(confidence * 100, 1),
        "engine": "keras",
        "accuracy": metadata.get("accuracy", "N/A"),
        "epoch": metadata.get("epoch", "N/A"),
        "segment_count": int(len(probabilities)),
        "average_probability": round(avg_score * 100, 1),
    }


def default_prediction_model_path():
    active_path = active_model_path()
    resolved = resolve_model_path(active_path) if active_path else None

    if resolved and resolved.exists():
        metadata = load_model_metadata(resolved)
        if metadata.get("task") == "genre" or metadata.get("genre_labels"):
            return resolved

    best_genre = best_available_genre_model_path()
    if best_genre and best_genre.exists():
        return best_genre

    if resolved and resolved.exists():
        return resolved
    fallback = project_path("best_model.keras")
    return fallback if fallback.exists() else None


def analyze_audio_source(audio_path, model_path=None):
    target_model_path = model_path or default_prediction_model_path()
    if not target_model_path or not Path(target_model_path).exists():
        raise FileNotFoundError("אין מודל מאומן זמין לחיזוי.")
    is_valid, error = validate_audio_file(audio_path)
    if not is_valid:
        raise ValueError(error)
    return predict_audio_with_model(Path(target_model_path), Path(audio_path))


def genre_classifier_signature():
    graph = collect_split_counts()
    return {
        "version": GENRE_CLASSIFIER_VERSION,
        "counts": {item["genre"]: item["total"] for item in graph},
    }


def genre_feature_from_audio(audio_array, sr):
    runtime = ml_runtime()
    np = runtime["np"]
    librosa = runtime["librosa"]

    if len(audio_array) < sr:
        return None

    mfcc = librosa.feature.mfcc(y=audio_array, sr=sr, n_mfcc=20, hop_length=HOP_LENGTH)
    chroma = librosa.feature.chroma_stft(y=audio_array, sr=sr, hop_length=HOP_LENGTH)
    spectral_centroid = librosa.feature.spectral_centroid(y=audio_array, sr=sr)
    zero_crossing = librosa.feature.zero_crossing_rate(audio_array)
    rms = librosa.feature.rms(y=audio_array)

    feature_vector = np.concatenate([
        mfcc.mean(axis=1),
        mfcc.std(axis=1),
        chroma.mean(axis=1),
        chroma.std(axis=1),
        spectral_centroid.mean(axis=1),
        spectral_centroid.std(axis=1),
        zero_crossing.mean(axis=1),
        zero_crossing.std(axis=1),
        rms.mean(axis=1),
        rms.std(axis=1),
    ]).astype(float)
    return feature_vector


def segment_audio_for_genre(audio_path):
    runtime = ml_runtime()
    np = runtime["np"]
    y_full, sr = load_audio_for_analysis(audio_path, duration=30)
    if y_full is None:
        return []

    starts = select_representative_starts(y_full, desired_count=6)
    features = []
    for start in starts:
        clip = y_full[start:start + TARGET_SAMPLES]
        if len(clip) < TARGET_SAMPLES:
            clip = np.pad(clip, (0, TARGET_SAMPLES - len(clip)), mode="constant")
        feature_vector = genre_feature_from_audio(clip, sr)
        if feature_vector is not None:
            features.append(feature_vector)
    return features


def train_genre_classifier(max_files_per_genre=40, progress_callback=None):
    global GENRE_CLASSIFIER_CACHE
    runtime = ml_runtime()
    np = runtime["np"]
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score
    from sklearn.preprocessing import StandardScaler

    data_root = project_path("data", "processed_data")
    genres = get_genres()
    if not genres:
        raise ValueError("לא נמצאו תיקיות סגנונות לאימון המסווג.")

    scan_plan = [
        ("train", max_files_per_genre),
        ("val", max(1, max_files_per_genre // 3)),
        ("test", max(1, max_files_per_genre // 3)),
    ]
    total_scan_steps = max(1, len(genres) * len(scan_plan))
    scan_step = 0

    def report(stage_label, message, progress):
        if progress_callback:
            progress_callback(stage_label, message, progress)

    report("הכנת נתונים", "קוראים את תיקיות הדאטה של הסגנונות.", 8)

    def gather(split_name, limit_per_genre):
        nonlocal scan_step
        rows = []
        labels = []
        for genre_index, genre in enumerate(genres, start=1):
            genre_dir = data_root / split_name / genre
            files = []
            if genre_dir.exists():
                files = sorted(path for path in genre_dir.iterdir() if path.is_file())[:limit_per_genre]
            scan_step += 1
            progress = 12 + int((scan_step / total_scan_steps) * 58)
            report(
                "חילוץ מאפיינים",
                f"מעבדים קבצי {split_name} עבור {genre} ({genre_index}/{len(genres)}).",
                min(progress, 70),
            )
            for sample_path in files:
                try:
                    features = segment_audio_for_genre(sample_path)
                except Exception:
                    continue
                for feature_vector in features:
                    rows.append(feature_vector)
                    labels.append(genre)
        return rows, labels

    X_train, y_train = gather("train", max_files_per_genre)
    X_val, y_val = gather("val", max(1, max_files_per_genre // 3))
    X_test, y_test = gather("test", max(1, max_files_per_genre // 3))

    if not X_train:
        raise ValueError("אימון מסווג הסגנונות לא מצא מאפייני אימון שימושיים.")

    report("אימון מסווג", "מאמנים את מסווג Genre Helper.", 78)
    X_train = np.vstack(X_train)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)

    classifier = LogisticRegression(
        max_iter=1400,
        multi_class="multinomial",
        class_weight="balanced",
        n_jobs=None,
    )
    classifier.fit(X_train_scaled, y_train)

    report("בדיקת מסווג", "בודקים דיוק ולידציה ודיוק בדיקה.", 88)
    eval_rows = X_val + X_test
    eval_labels = y_val + y_test
    accuracy = None
    if eval_rows:
        X_eval = scaler.transform(np.vstack(eval_rows))
        predictions = classifier.predict(X_eval)
        accuracy = float(accuracy_score(eval_labels, predictions))

    payload = {
        "signature": genre_classifier_signature(),
        "trained_at": now_local_str(),
        "genres": genres,
        "scaler": scaler,
        "classifier": classifier,
        "classifier_type": "LogisticRegression",
        "feature_mode": "segment-mean-proba",
        "accuracy": accuracy,
        "train_samples": int(len(y_train)),
        "eval_samples": int(len(eval_labels)),
    }

    report("שמירת מסווג", "שומרים את קבצי מסווג העזר בתוך instance/.", 95)
    with GENRE_CLASSIFIER_PATH.open("wb") as handle:
        pickle.dump(payload, handle)

    meta = {
        "trained_at": payload["trained_at"],
        "accuracy": round(accuracy, 4) if accuracy is not None else None,
        "genres": genres,
        "train_samples": payload["train_samples"],
        "eval_samples": payload["eval_samples"],
        "classifier_type": payload["classifier_type"],
        "feature_mode": payload["feature_mode"],
        "signature": payload["signature"],
    }
    GENRE_CLASSIFIER_META_PATH.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    GENRE_CLASSIFIER_CACHE = payload
    return payload


def run_genre_helper_refresh(run_label):
    try:
        evaluate_training_state(run_label, preserve_runtime=True)

        def progress_callback(stage_label, message, progress):
            update_training_status(
                stage_label=stage_label,
                message=message,
                progress=progress,
                running=True,
                last_run=run_label,
            )

        payload = train_genre_classifier(max_files_per_genre=24, progress_callback=progress_callback)
        accuracy = payload.get("accuracy")
        accuracy_text = f"{accuracy:.2%}" if accuracy is not None else "N/A"
        evaluate_training_state(run_label, preserve_runtime=True)
        update_training_status(
            stage_label="Completed",
            message=(
                f"Genre helper classifier trained across {len(payload.get('genres', []))} genres. "
                f"Validation/Test accuracy: {accuracy_text}."
            ),
            progress=100,
            running=False,
            finished_at=now_local_str(),
            last_run=run_label,
            profile_path=str(GENRE_CLASSIFIER_META_PATH.relative_to(BASE_DIR)),
        )
    except Exception as exc:
        evaluate_training_state(run_label, preserve_runtime=True)
        update_training_status(
            stage_label="Failed",
            message=f"Genre helper classifier training failed: {exc}",
            progress=100,
            running=False,
            finished_at=now_local_str(),
            last_run=run_label,
        )
    finally:
        update_training_status(_thread=None)


def load_genre_classifier(force_refresh=False):
    global GENRE_CLASSIFIER_CACHE
    signature = genre_classifier_signature()
    if not force_refresh and GENRE_CLASSIFIER_CACHE and GENRE_CLASSIFIER_CACHE.get("signature") == signature:
        return GENRE_CLASSIFIER_CACHE

    if GENRE_CLASSIFIER_PATH.exists():
        try:
            with GENRE_CLASSIFIER_PATH.open("rb") as handle:
                payload = pickle.load(handle)
            if payload.get("signature") == signature:
                GENRE_CLASSIFIER_CACHE = payload
                return payload
        except Exception:
            pass

    return None


def predict_genre_styles(audio_path, top_n=3):
    runtime = ml_runtime()
    np = runtime["np"]

    payload = load_genre_classifier()
    if not payload:
        return []

    features = segment_audio_for_genre(audio_path)
    if not features:
        return []

    scaled = payload["scaler"].transform(np.vstack(features))
    probabilities = payload["classifier"].predict_proba(scaled)
    mean_probabilities = probabilities.mean(axis=0)
    labels = list(payload["classifier"].classes_)

    scored = [
        {"genre": label, "score": round(float(probability) * 100, 1)}
        for label, probability in zip(labels, mean_probabilities)
    ]
    scored.sort(key=lambda item: item["score"], reverse=True)
    if top_n is None:
        return scored
    return scored[:top_n]


def filter_style_matches(style_matches, min_score=5.0, top_n=3):
    filtered = [
        item for item in (style_matches or [])
        if float(item.get("score", 0.0)) >= min_score and item.get("genre")
    ]
    filtered.sort(key=lambda item: float(item.get("score", 0.0)), reverse=True)
    if top_n is None:
        return filtered
    return filtered[:top_n]


def merge_style_scores(primary_styles, helper_styles, primary_weight=0.6, helper_weight=0.4, top_n=3):
    if not helper_styles:
        primary_only = [dict(item) for item in (primary_styles or []) if item.get("genre")]
        primary_only.sort(key=lambda item: float(item.get("score", 0.0)), reverse=True)
        return primary_only[:top_n] if top_n is not None else primary_only

    combined = {}
    primary_ranked = [item for item in (primary_styles or []) if item.get("genre")]
    primary_allowed = {item["genre"] for item in primary_ranked[:5]}

    for item in primary_ranked:
        genre = item.get("genre")
        if not genre:
            continue
        combined.setdefault(genre, 0.0)
        combined[genre] += float(item.get("score", 0.0)) * primary_weight

    for item in helper_styles or []:
        genre = item.get("genre")
        if not genre or (primary_allowed and genre not in primary_allowed):
            continue
        combined.setdefault(genre, 0.0)
        combined[genre] += float(item.get("score", 0.0)) * helper_weight

    merged = [
        {"genre": genre, "score": round(score, 1)}
        for genre, score in combined.items()
    ]
    merged.sort(key=lambda item: item["score"], reverse=True)
    return merged[:top_n]


def refine_style_matches(primary_styles, helper_styles, top_n=3):
    if not helper_styles:
        return []

    refined = [dict(item) for item in helper_styles]
    helper_by_genre = {item.get("genre"): float(item.get("score", 0.0)) for item in refined if item.get("genre")}
    primary_by_genre = {
        item.get("genre"): float(item.get("score", 0.0))
        for item in (primary_styles or [])
        if item.get("genre")
    }
    primary_top = (primary_styles or [{}])[0].get("genre")
    hiphop_helper = helper_by_genre.get("hiphop", 0.0)
    hiphop_primary = primary_by_genre.get("hiphop", 0.0)
    reggae_helper = helper_by_genre.get("reggae", 0.0)
    reggae_primary = primary_by_genre.get("reggae", 0.0)

    top_helper = refined[0]
    top_genre = top_helper.get("genre")
    top_score = float(top_helper.get("score", 0.0))
    should_promote_hiphop = (
        top_genre in {"pop", "disco", "reggae"}
        and (
            (primary_top == "hiphop" and top_score <= 80.0)
            or (hiphop_primary >= 80.0 and top_score <= 72.0)
            or (hiphop_helper >= 20.0 and hiphop_primary >= 15.0 and top_score - hiphop_helper <= 18.0)
        )
    )

    if should_promote_hiphop:
        promoted_score = max(top_score + 0.1, hiphop_helper, hiphop_primary)
        demoted_score = max(top_score - 0.1, 0.0)
        promoted = False
        for item in refined:
            if item.get("genre") == "hiphop":
                item["score"] = round(promoted_score, 1)
                promoted = True
            elif item.get("genre") == top_genre:
                item["score"] = round(demoted_score, 1)
        if not promoted:
            refined.append({"genre": "hiphop", "score": round(promoted_score, 1)})
        refined.sort(key=lambda item: item.get("score", 0.0), reverse=True)

    should_promote_reggae = (
        not should_promote_hiphop
        and top_genre in {"pop", "blues", "disco", "country"}
        and (
            (primary_top == "reggae" and top_score <= 80.0)
            or (reggae_primary >= 65.0 and top_score <= 75.0)
            or (reggae_helper >= 15.0 and reggae_primary >= 10.0 and top_score - reggae_helper <= 22.0)
        )
    )

    if should_promote_reggae:
        promoted_score = max(top_score + 0.1, reggae_helper, reggae_primary)
        demoted_score = max(top_score - 0.1, 0.0)
        promoted = False
        for item in refined:
            if item.get("genre") == "reggae":
                item["score"] = round(promoted_score, 1)
                promoted = True
            elif item.get("genre") == top_genre:
                item["score"] = round(demoted_score, 1)
        if not promoted:
            refined.append({"genre": "reggae", "score": round(promoted_score, 1)})
        refined.sort(key=lambda item: item.get("score", 0.0), reverse=True)

    return refined[:top_n] if top_n is not None else refined


def genre_summary(style_matches):
    if not style_matches:
        return "לא נמצא סגנון דומיננטי מספיק."
    return ", ".join(f"{item['genre']} ({item['score']}%)" for item in style_matches)


def translate_preference_label(label):
    mapping = {
        "Like": "אהבתי",
        "Dislike": "לא אהבתי",
    }
    return mapping.get(label, label)


def build_preference_fit(base_result, style_matches, liked, disliked):
    liked_set = {item.lower() for item in liked}
    disliked_set = {item.lower() for item in disliked}

    liked_hits = [item for item in style_matches if item["genre"].lower() in liked_set]
    disliked_hits = [item for item in style_matches if item["genre"].lower() in disliked_set]
    liked_strength = max((item["score"] for item in liked_hits), default=0.0)
    disliked_strength = max((item["score"] for item in disliked_hits), default=0.0)
    dominant_disliked = disliked_strength >= 50.0

    if base_result.get("task") == "genre":
        lead_strength = style_matches[0]["score"] if style_matches else 0.0
        if dominant_disliked:
            profile_score = max(
                disliked_strength,
                70.0 + (disliked_strength - 50.0) * 0.9 - (liked_strength * 0.2),
            )
        else:
            profile_score = 45.0 + (liked_strength * 0.45) - (disliked_strength * 0.55)
            profile_score += max(0.0, lead_strength - 50.0) * 0.1
    else:
        profile_score = float(base_result["score"])
        if base_result["label"] == "Like":
            profile_score += liked_strength * 0.18
            profile_score -= disliked_strength * 0.55
        else:
            profile_score += liked_strength * 0.08
            profile_score -= disliked_strength * 0.20

    profile_score = max(0.0, min(100.0, profile_score))
    profile_label = "Dislike" if dominant_disliked else ("Like" if profile_score >= 50 else "Dislike")

    if disliked_hits and liked_hits:
        reason = (
            f"התאמה מעורבת: נמצאה חפיפה גם לסגנונות אהובים "
            f"({', '.join(item['genre'] for item in liked_hits)}) וגם לסגנונות שפחות מתאימים לך "
            f"({', '.join(item['genre'] for item in disliked_hits)})."
        )
    elif disliked_hits:
        reason = f"נמצאה חפיפה לסגנונות שפחות מתאימים לך: {', '.join(item['genre'] for item in disliked_hits)}."
    elif liked_hits:
        reason = f"נמצאה חפיפה לסגנונות האהובים עליך: {', '.join(item['genre'] for item in liked_hits)}."
    else:
        reason = "לא נמצאה חפיפה חזקה להעדפות ששמרת."

    return {
        "label": profile_label,
        "score": round(profile_score, 1),
        "reason": reason,
        "liked_hits": liked_hits,
        "disliked_hits": disliked_hits,
    }


def analyze_audio_recommendation(audio_path, user=None, model_path=None):
    base_result = analyze_audio_source(audio_path, model_path=model_path)
    liked, disliked = get_user_preferences(user) if user else ([], [])

    if base_result.get("task") == "genre":
        helper_ready = load_genre_classifier() is not None
        helper_styles = predict_genre_styles(audio_path, top_n=None) if helper_ready else []
        merged_styles = merge_style_scores(base_result.get("all_styles", []), helper_styles, top_n=3)
        style_matches = refine_style_matches(base_result.get("all_styles", []), merged_styles, top_n=3)
        style_matches = filter_style_matches(style_matches, min_score=5.0, top_n=3)
        displayed_primary = style_matches[0]["genre"] if style_matches else base_result.get("primary_genre")
        displayed_confidence = style_matches[0]["score"] if style_matches else base_result.get("confidence", 0.0)
        preference_fit = build_preference_fit(base_result, style_matches, liked, disliked)
        style_summary = genre_summary(style_matches)
        model_result = {
            "label": preference_fit["label"],
            "score": preference_fit["score"],
            "confidence": preference_fit["score"],
            "task": "genre",
            "primary_genre": displayed_primary,
            "genre_confidence": displayed_confidence,
            "genre_source": "helper_weighted_merge" if helper_styles else "main_genre_cnn",
            "accuracy": base_result.get("accuracy", "N/A"),
            "epoch": base_result.get("epoch", "N/A"),
        }
        return {
            "model_result": model_result,
            "styles": style_matches,
            "style_summary": style_summary,
            "preference_fit": preference_fit,
            "classifier_ready": helper_ready,
        }

    classifier_ready = load_genre_classifier() is not None
    style_matches = predict_genre_styles(audio_path) if classifier_ready else []
    style_matches = filter_style_matches(style_matches, min_score=5.0, top_n=3)
    preference_fit = build_preference_fit(base_result, style_matches, liked, disliked)
    style_summary = genre_summary(style_matches)
    if not classifier_ready:
        style_summary = "מסווג ה־Genre Helper עדיין לא מוכן. יש להיכנס לעמוד האימון ולהריץ רענון נתוני Genre Helper."
    return {
        "model_result": base_result,
        "styles": style_matches,
        "style_summary": style_summary,
        "preference_fit": preference_fit,
        "classifier_ready": classifier_ready,
    }


def update_training_status(**changes):
    with TRAINING_STATUS_LOCK:
        training_status.update(changes)
        return {
            key: value
            for key, value in training_status.items()
            if not key.startswith("_")
        }


def training_status_view():
    with TRAINING_STATUS_LOCK:
        return {
            key: value
            for key, value in training_status.items()
            if not key.startswith("_")
        }


def collect_split_counts():
    data_root = project_path("data", "processed_data")
    graph = []
    genres = set()
    counts_by_split = {}
    files_by_split = {}

    for split in TRAINING_SPLITS:
        split_root = data_root / split
        counts = {}
        split_files = {}
        if split_root.exists():
            for genre_dir in split_root.iterdir():
                if not genre_dir.is_dir() or genre_dir.name in {"like", "dislike"}:
                    continue
                file_names = sorted(file.name for file in genre_dir.iterdir() if file.is_file())
                counts[genre_dir.name] = len(file_names)
                split_files[genre_dir.name] = file_names
                genres.add(genre_dir.name)
        counts_by_split[split] = counts
        files_by_split[split] = split_files

    for genre in sorted(genres):
        train_count = counts_by_split["train"].get(genre, 0)
        val_count = counts_by_split["val"].get(genre, 0)
        test_count = counts_by_split["test"].get(genre, 0)
        graph.append(
            {
                "genre": genre,
                "train": train_count,
                "val": val_count,
                "test": test_count,
                "total": train_count + val_count + test_count,
                "files": {
                    split: files_by_split[split].get(genre, [])
                    for split in TRAINING_SPLITS
                },
            }
        )
    return graph


def extract_report_accuracy(report_lines):
    for line in report_lines:
        stripped = line.strip()
        if not stripped.startswith("accuracy"):
            continue
        parts = stripped.split()
        if len(parts) >= 2:
            return parts[1]
    return "N/A"


def latest_metric_entry():
    if not METRICS_DIR.exists():
        return None

    image_paths = sorted(METRICS_DIR.glob("confusion_matrix_*.png"), reverse=True)
    if not image_paths:
        return None

    image_path = image_paths[0]
    suffix = image_path.stem.replace("confusion_matrix_", "")
    report_path = METRICS_DIR / f"classification_report_{suffix}.txt"
    report_excerpt = []
    accuracy = "N/A"
    if report_path.exists():
        with report_path.open("r", encoding="utf-8") as handle:
            report_lines = [line.rstrip() for line in handle.readlines()]
        report_excerpt = report_lines[:8]
        accuracy = extract_report_accuracy(report_lines)

    return {
        "label": suffix,
        "image": image_path.name,
        "report": report_path.name if report_path.exists() else None,
        "excerpt": report_excerpt,
        "accuracy": accuracy,
    }


def evaluate_training_state(run_label=None, preserve_runtime=False):
    graph = collect_split_counts()
    latest_metric = latest_metric_entry()
    total_files = sum(item["total"] for item in graph)

    if not graph or total_files == 0:
        update_payload = {
            "graph": [],
            "recent_metrics": [latest_metric] if latest_metric else [],
            "last_run": run_label,
            "profile_path": None,
        }
        if not preserve_runtime:
            update_payload.update(
                {
                    "stage_label": "חסרים נתונים",
                    "message": "לא נמצאו קבצי סגנונות שמוכנים לאימון תחת data/processed_data.",
                    "progress": 0,
                }
            )
        return update_training_status(**update_payload)

    profile_payload = {
        "generated_at": now_local_str(),
        "graph": graph,
        "metrics_found": 1 if latest_metric else 0,
        "total_files": total_files,
    }
    with TRAIN_PROFILE_PATH.open("w", encoding="utf-8") as handle:
        json.dump(profile_payload, handle, indent=2)

    update_payload = {
        "graph": graph,
        "recent_metrics": [latest_metric] if latest_metric else [],
        "last_run": run_label or profile_payload["generated_at"],
        "profile_path": str(TRAIN_PROFILE_PATH.relative_to(BASE_DIR)),
    }
    if not preserve_runtime:
        update_payload.update(
            {
                "stage_label": "הושלם",
                "message": f"פרופיל Genre Helper רוענן מתוך {total_files} קבצים על פני {len(graph)} סגנונות.",
                "progress": 100,
            }
        )
    return update_training_status(**update_payload)


def main_training_view():
    update_main_training_status()
    runtime = main_training_runtime_details()
    view = {
        key: value
        for key, value in main_training_status.items()
        if not key.startswith("_")
    }
    view["runner_available"] = runtime["available"]
    view["runner_name"] = runtime["runner"] or "לא זמין"
    view["runner_note"] = runtime["note"]
    if not view.get("running") and not view.get("started_at") and not runtime["available"]:
        view["stage_label"] = "לא זמין"
        view["message"] = runtime["note"]
    return view


def read_log_lines(log_path):
    if not log_path:
        return []
    target = Path(log_path)
    if not target.exists():
        return []
    with target.open("r", encoding="utf-8", errors="replace") as handle:
        lines = [line.rstrip() for line in handle.readlines()]
    return [
        line for line in lines
        if line and not any(marker in line for marker in NOISY_LOG_MARKERS)
    ]


def summarize_main_training_log(lines, limit=12):
    summary_lines = []
    last_progress = None
    error_lines = []

    for line in lines:
        progress_match = MAIN_PROGRESS_PATTERN.match(line)
        if progress_match:
            percent = int(progress_match.group(1))
            label = progress_match.group(2).strip() or "Training in progress"
            formatted = f"Progress {percent}% - {label}"
            if formatted != last_progress:
                summary_lines.append(formatted)
                last_progress = formatted
            continue

        if any(marker in line for marker in MAIN_LOG_MARKERS):
            summary_lines.append(line)
            continue

        lowered = line.lower()
        if (
            "traceback" in lowered
            or "modulenotfounderror" in lowered
            or "importerror" in lowered
            or "error:" in lowered
            or "exception" in lowered
        ):
            error_lines.append(line)

    if not summary_lines and error_lines:
        return error_lines[-limit:]

    if error_lines:
        summary_lines.extend(error_lines[-3:])

    return summary_lines[-limit:]


def read_log_tail(log_path, limit=12):
    return summarize_main_training_log(read_log_lines(log_path), limit=limit)


def read_main_training_progress(log_path):
    progress_value = None
    progress_message = ""

    for line in read_log_lines(log_path):
        progress_match = MAIN_PROGRESS_PATTERN.match(line)
        if progress_match:
            progress_value = int(progress_match.group(1))
            progress_message = progress_match.group(2).strip()

    return progress_value, progress_message


def main_training_runtime_details():
    note = "אימון המודל הראשי משתמש ברכיב הרצה ייעודי לאימון בלבד, כדי שהאתר לא יריץ את ממשק המחברת המלא."
    required_modules = ("numpy", "librosa", "tensorflow", "sklearn", "matplotlib")
    missing_modules = [
        module_name
        for module_name in required_modules
        if importlib.util.find_spec(module_name) is None
    ]

    if MAIN_TRAINING_RUNNER.exists() and shutil.which("python3") and not missing_modules:
        return {"available": True, "runner": "python3 run_main_training.py", "note": note}

    if missing_modules:
        return {
            "available": False,
            "runner": None,
            "note": "אי אפשר להפעיל כאן את אימון המודל הראשי כי חסרות חבילות Python: "
            + ", ".join(missing_modules)
            + ". יש להתקין את requirements.txt לפני תחילת האימון.",
        }

    return {
        "available": False,
        "runner": None,
        "note": "אי אפשר להפעיל כאן את אימון המודל הראשי כי python3 או run_main_training.py חסרים בפרויקט.",
    }


def build_main_training_command():
    timestamp = now_local_str("%Y%m%d_%H%M%S")
    output_name = f"main_training_run_{timestamp}.json"

    runtime = main_training_runtime_details()
    if runtime["runner"] == "python3 run_main_training.py":
        return [
            "python3",
            str(MAIN_TRAINING_RUNNER),
            "--summary-path",
            str(INSTANCE_DIR / output_name),
        ], output_name
    return None, output_name


def update_main_training_status():
    proc = main_training_status.get("_process")
    if not proc:
        main_training_status["log_tail"] = read_log_tail(main_training_status.get("log_path"))
        return main_training_status

    exit_code = proc.poll()
    progress_value, progress_message = read_main_training_progress(main_training_status.get("log_path"))
    main_training_status["log_tail"] = read_log_tail(main_training_status.get("log_path"))

    if exit_code is None:
        main_training_status.update(
            {
                "running": True,
                "stage_label": "בתהליך",
                "message": progress_message or "אימון המודל הראשי רץ דרך runner ייעודי לאימון בלבד.",
                "progress": max(main_training_status.get("progress", 0), progress_value or 12),
            }
        )
        return main_training_status

    log_handle = main_training_status.pop("_log_handle", None)
    if log_handle:
        log_handle.close()
    main_training_status["_process"] = None
    main_training_status["running"] = False
    main_training_status["last_exit_code"] = exit_code
    main_training_status["finished_at"] = now_local_str()

    if exit_code == 0:
        main_training_status.update(
            {
                "stage_label": "הושלם",
                "message": "אימון המודל הראשי הסתיים בהצלחה.",
                "progress": 100,
            }
        )
        output_marker = main_training_status.get("output_notebook")
        helper_thread = training_status.get("_thread")
        if output_marker and main_training_status.get("post_refresh_started_for") != output_marker:
            if helper_thread and helper_thread.is_alive():
                main_training_status["post_refresh_started_for"] = output_marker
            else:
                run_label = f"main-training-auto-refresh-{now_local_str('%Y%m%d_%H%M%S')}"
                refresh_thread = threading.Thread(
                    target=run_genre_helper_refresh,
                    args=(run_label,),
                    daemon=True,
                )
                update_training_status(
                    stage_label="Queued",
                    message="מרעננים את מסווג Genre Helper לאחר אימון המודל הראשי.",
                    progress=6,
                    running=True,
                    started_at=now_local_str(),
                    finished_at=None,
                    last_run=run_label,
                    _thread=refresh_thread,
                )
                refresh_thread.start()
                main_training_status["post_refresh_started_for"] = output_marker
    else:
        main_training_status.update(
            {
                "stage_label": "נכשל",
                "message": "אימון המודל הראשי נכשל. אפשר לבדוק את הלוג למטה.",
                "progress": 100,
            }
        )
    return main_training_status


def start_main_training_run():
    update_main_training_status()
    if main_training_status.get("running"):
        return False, "אימון המודל הראשי כבר רץ."
    if not MAIN_TRAINING_NOTEBOOK.exists():
        return False, "main.ipynb was not found in the project root."

    command, output_name = build_main_training_command()
    if not command:
        return False, main_training_runtime_details()["note"]

    timestamp = now_local_str("%Y%m%d_%H%M%S")
    log_path = INSTANCE_DIR / f"main_training_{timestamp}.log"
    log_handle = log_path.open("w", encoding="utf-8")
    env = os.environ.copy()
    env["BEATSENSE_AUTORUN_MAIN_TRAINING"] = "1"
    env["BEATSENSE_BASE_PATH"] = str(BASE_DIR)
    proc = subprocess.Popen(
        command,
        cwd=str(BASE_DIR),
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        env=env,
    )
    main_training_status.update(
        {
            "stage_label": "בתור",
            "message": "אימון המודל הראשי התחיל.",
            "progress": 10,
            "running": True,
            "started_at": now_local_str(),
            "finished_at": None,
            "log_path": str(log_path.relative_to(BASE_DIR)),
            "output_notebook": str((INSTANCE_DIR / output_name).relative_to(BASE_DIR)),
            "last_exit_code": None,
            "post_refresh_started_for": None,
            "log_tail": [],
            "command": " ".join(command),
            "_process": proc,
            "_log_handle": log_handle,
        }
    )
    return True, None


def apply_battle_verdict(battle, verdict):
    battle["judge_counts"].setdefault(verdict, 0)
    previous = battle.get("judge_choice")
    if previous:
        battle["judge_counts"][previous] = max(0, battle["judge_counts"].get(previous, 0) - 1)

    battle["judge_choice"] = verdict
    battle["judge_counts"][verdict] += 1
    battle["status"] = "judged"

    model_a_path = resolve_model_path(battle["model_a"])
    model_b_path = resolve_model_path(battle["model_b"])
    if not model_a_path or not model_b_path:
        return

    if verdict == "model_a":
        upsert_battle_record(model_a_path, battle["id"], model_b_path.name, "win")
        upsert_battle_record(model_b_path, battle["id"], model_a_path.name, "loss")
    elif verdict == "model_b":
        upsert_battle_record(model_a_path, battle["id"], model_b_path.name, "loss")
        upsert_battle_record(model_b_path, battle["id"], model_a_path.name, "win")
    else:
        upsert_battle_record(model_a_path, battle["id"], model_b_path.name, "draw")
        upsert_battle_record(model_b_path, battle["id"], model_a_path.name, "draw")


def genre_score_for_label(result, actual_style):
    target = (actual_style or "").strip().lower()
    if not target:
        return 0.0

    for item in result.get("all_styles", []):
        if item.get("genre", "").strip().lower() == target:
            return float(item.get("score", 0.0))
    return 0.0


def battle_verdict_from_style(result_a, result_b, actual_style):
    score_a = genre_score_for_label(result_a, actual_style)
    score_b = genre_score_for_label(result_b, actual_style)

    if abs(score_a - score_b) < 1e-6:
        return "tie", score_a, score_b
    if score_a > score_b:
        return "model_a", score_a, score_b
    return "model_b", score_a, score_b


def battle_view(battle):
    return {
        "id": battle["id"],
        "model_a": battle["model_a"],
        "model_b": battle["model_b"],
        "model_a_short": short_model_label(battle["model_a"]),
        "model_b_short": short_model_label(battle["model_b"]),
        "status": battle["status"],
        "judge_choice": battle.get("judge_choice"),
        "judge_style": battle.get("judge_style"),
        "judge_counts": battle.get("judge_counts", {"model_a": 0, "model_b": 0, "tie": 0}),
        "last_result": battle.get("last_result"),
    }


def delete_model_artifacts(model_rel_paths):
    deleted = []
    active_path = active_model_path()
    for rel_path in model_rel_paths:
        model_path = resolve_model_path(rel_path)
        if not model_path or not model_path.exists():
            if active_path == rel_path:
                save_active_model(None)
            continue
        for extra_path in [model_path, *sidecar_candidates(model_path), scaler_sidecar_path(model_path)]:
            if extra_path.exists() and extra_path.is_file():
                extra_path.unlink()
        deleted.append(rel_path)
        if active_path == rel_path:
            save_active_model(None)
    return deleted


@app.route("/")
def home():
    if current_user.is_authenticated and request.args.get("from_logo") != "1":
        return redirect(url_for("dashboard"))
    return render_template("index.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if len(username) < 3 or len(password) < 6 or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            flash("שם המשתמש חייב להכיל לפחות 3 תווים, אימייל תקין, וסיסמה של לפחות 6 תווים.", "error")
            return render_template("register.html")

        if User.query.filter_by(username=username).first():
            flash("שם המשתמש הזה כבר קיים.", "error")
            return render_template("register.html")

        if User.query.filter_by(email=email).first():
            flash("האימייל הזה כבר רשום במערכת.", "error")
            return render_template("register.html")

        user = User(username=username, email=email, password=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()
        flash("החשבון נוצר בהצלחה. אפשר להתחבר עכשיו.", "success")
        return redirect(url_for("login"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        user = User.query.filter_by(username=username).first()

        if user and check_password_hash(user.password, password):
            login_user(user)
            if user.preference_genre or user.preference_energy:
                return redirect(url_for("dashboard"))
            return redirect(url_for("onboarding"))

        flash("שם משתמש או סיסמה שגויים.", "error")

    return render_template("login.html")


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return redirect(url_for("home"))


@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        user = User.query.filter_by(email=email).first() if email else None
        if user:
            raw_token = secrets.token_urlsafe(32)
            user.reset_token_hash = token_hash(raw_token)
            user.reset_token_expires_at = datetime.now(APP_TIMEZONE).replace(tzinfo=None) + timedelta(hours=1)
            user.reset_token_used_at = None
            db.session.commit()
            reset_link = url_for("reset_password", token=raw_token, _external=True)
            sent, error = send_password_reset_email(user, reset_link)
            if not sent:
                print(f"Password reset email failed for {user.email}: {error}")
                flash("שירות שליחת המייל לא מוגדר כרגע. יש להגדיר SMTP לפני איפוס סיסמה במייל.", "error")
                return render_template("forgot_password.html")
        flash("אם האימייל קיים במערכת, נשלח אליו קישור לאיפוס הסיסמה.", "success")
    return render_template("forgot_password.html")


@app.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token):
    hashed_token = token_hash(token)
    user = User.query.filter_by(reset_token_hash=hashed_token).first()
    now = datetime.now(APP_TIMEZONE).replace(tzinfo=None)
    if (
        not user
        or not user.reset_token_expires_at
        or user.reset_token_used_at
        or user.reset_token_expires_at < now
    ):
        return "קישור איפוס הסיסמה אינו תקין או שפג תוקפו.", 400

    if request.method == "POST":
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")
        if password != confirm:
            return "הסיסמאות אינן תואמות", 400
        if len(password) < 6:
            return "הסיסמה חייבת להכיל לפחות 6 תווים.", 400
        user.password = generate_password_hash(password)
        user.reset_token_used_at = now
        user.reset_token_hash = None
        user.reset_token_expires_at = None
        db.session.commit()
        flash("הסיסמה עודכנה. אפשר להתחבר עכשיו.", "success")
        return redirect(url_for("login"))

    return render_template("reset_password.html")


@app.route("/onboarding", methods=["GET", "POST"])
@login_required
def onboarding():
    genres = get_genres()
    liked, disliked = get_user_preferences(current_user)

    if request.method == "POST":
        new_liked = []
        new_disliked = []
        for genre in genres:
            value = request.form.get(f"pref_{genre}", "neutral")
            if value == "like":
                new_liked.append(genre)
            elif value == "dislike":
                new_disliked.append(genre)
        save_user_preferences(current_user, new_liked, new_disliked)
        db.session.commit()
        flash("התדר שלי נשמר בהצלחה.", "success")
        return redirect(url_for("dashboard"))

    return render_template("onboarding.html", genres=genres, liked=liked, disliked=disliked)


@app.route("/dashboard", methods=["GET", "POST"])
@login_required
def dashboard():
    if request.method == "POST":
        source_mode = request.form.get("source_mode")
        temp_path = None
        source_name = None

        try:
            if source_mode == "file":
                audio = request.files.get("audio")
                if not audio or not audio.filename:
                    flash("יש לבחור קובץ אודיו.", "error")
                    return redirect(url_for("dashboard"))
                source_name = audio.filename
                temp_path = save_uploaded_audio(audio, "predict_")
            elif source_mode == "youtube":
                youtube_url = request.form.get("youtube_url", "").strip()
                if not validate_url(youtube_url):
                    flash("יש להזין קישור YouTube תקין.", "error")
                    return redirect(url_for("dashboard"))
                source_name = youtube_url
                success, download_result = download_youtube_audio(
                    youtube_url,
                    INSTANCE_DIR / f"youtube_predict_{now_local_str('%Y%m%d_%H%M%S')}.wav",
                )
                if not success:
                    flash(f"לא ניתן היה להוריד את האודיו מ־YouTube: {download_result}", "error")
                    return redirect(url_for("dashboard"))
                temp_path = Path(download_result)
            else:
                flash("סוג מקור הקלט אינו נתמך.", "error")
                return redirect(url_for("dashboard"))

            analysis = analyze_audio_recommendation(temp_path, user=current_user)
            model_result = analysis["model_result"]
            preference_fit = analysis["preference_fit"]
            style_summary = analysis["style_summary"]
            session["latest_analysis"] = {
                "source_name": source_name,
                "model_result": model_result,
                "preference_fit": preference_fit,
                "styles": analysis.get("styles", []),
                "style_summary": style_summary,
                "classifier_ready": analysis.get("classifier_ready", False),
                "segment_count": len(MULTI_SEGMENT_TIMESTAMPS),
                "analysis_source_seconds": ANALYSIS_SOURCE_SECONDS,
            }
            model_label_he = translate_preference_label(model_result["label"])
            fit_label_he = translate_preference_label(preference_fit["label"])
            confidence_sentence = (
                f"אני בטוח ב-{model_result['confidence']} אחוזים שאתה תאהב את זה"
                if model_result["label"] == "Like"
                else f"אני בטוח ב-{model_result['confidence']} אחוזים שאתה לא תאהב את זה"
            )
            result_summary = (
                f"תוצאת המודל: {model_label_he} ({model_result['confidence']}%) | "
                f"התאמה אישית: {fit_label_he} ({preference_fit['score']}%) | "
                f"סגנונות תואמים: {style_summary}"
            )
            add_history_entry(current_user, source_name, result_summary)
            return redirect(url_for("dashboard"))
        except Exception as exc:
            flash(f"ניתוח השיר נכשל: {exc}", "error")
            return redirect(url_for("dashboard"))
        finally:
            if temp_path and Path(temp_path).exists():
                Path(temp_path).unlink(missing_ok=True)

    evaluate_training_state(training_status.get("last_run"))
    liked, disliked = get_user_preferences(current_user)
    return render_template(
        "dashboard.html",
        user=current_user,
        liked=liked,
        disliked=disliked,
        history=get_user_history(current_user),
        latest_analysis=session.get("latest_analysis"),
        latest_metric=latest_metric_entry(),
        max_file_size_mb=MAX_FILE_SIZE_MB,
        analysis_source_seconds=ANALYSIS_SOURCE_SECONDS,
        model_window_seconds=DURATION_SECONDS,
    )


@app.route("/training")
@login_required
@admin_required
def training_page():
    evaluate_training_state(training_status.get("last_run"))
    return render_template(
        "training.html",
        latest_metric=latest_metric_entry(),
        training_state=training_status,
        main_training_state=main_training_view(),
    )


@app.route("/models")
@login_required
@admin_required
def models_page():
    return render_template(
        "models.html",
        models=find_models(),
        active_path=active_model_path(),
        latest_metric=latest_metric_entry(),
    )


@app.route("/activate_model", methods=["POST"])
@login_required
@admin_required
def activate_model():
    selected_path = request.form.get("model_path", "")
    valid_paths = {model["path"] for model in find_models()}
    if selected_path not in valid_paths:
        abort(400)
    save_active_model(selected_path)
    flash("המודל הפעיל עודכן.", "success")
    return redirect(url_for("models_page"))


@app.route("/delete_all_models", methods=["POST"])
@login_required
@admin_required
def delete_all_models():
    deleted = delete_model_artifacts([model["path"] for model in find_models()])
    flash(f"נמחקו {len(deleted)} קובצי מודל והמטא-דאטה שלהם.", "success")
    return redirect(url_for("models_page"))


@app.route("/models_data")
@login_required
@admin_required
def models_data():
    return jsonify(find_models())


@app.route("/battles")
@login_required
@admin_required
def battles_page():
    return render_template(
        "battles.html",
        models=find_models(),
        max_file_size_mb=MAX_FILE_SIZE_MB,
        analysis_source_seconds=ANALYSIS_SOURCE_SECONDS,
        model_window_seconds=DURATION_SECONDS,
    )


@app.route("/api/create_battle", methods=["POST"])
@login_required
@admin_required
def create_battle():
    data = request.get_json(silent=True) or {}
    model_a = data.get("model_a")
    model_b = data.get("model_b")
    valid_paths = {model["path"] for model in find_models()}

    if not model_a or not model_b:
        return jsonify({"error": "יש לבחור שני מודלים."}), 400
    if model_a == model_b:
        return jsonify({"error": "יש לבחור שני מודלים שונים."}), 400
    if model_a not in valid_paths or model_b not in valid_paths:
        return jsonify({"error": "אחד המודלים שנבחרו לא קיים."}), 400

    battle = {
        "id": len(battles),
        "model_a": model_a,
        "model_b": model_b,
        "status": "מוכן",
        "judge_choice": None,
        "judge_counts": {"model_a": 0, "model_b": 0, "tie": 0},
        "last_result": None,
    }
    battles.append(battle)
    return jsonify({"ok": True, "battle": battle_view(battle)})


@app.route("/api/get_battles")
@login_required
@admin_required
def get_battles():
    return jsonify([battle_view(battle) for battle in battles])


@app.route("/api/run_battle", methods=["POST"])
@login_required
@admin_required
def run_battle():
    payload = request.get_json(silent=True) or request.form
    battle_id = payload.get("battle_id")

    try:
        battle = battles[int(battle_id)]
    except (TypeError, ValueError, IndexError):
        return jsonify({"error": "הקרב לא נמצא."}), 404

    model_a_path = resolve_model_path(battle["model_a"])
    model_b_path = resolve_model_path(battle["model_b"])
    if not model_a_path or not model_b_path:
        return jsonify({"error": "אחד או יותר מקובצי המודלים חסרים."}), 404

    audio = request.files.get("audio")
    if not audio or not audio.filename:
        return jsonify({"error": "יש להעלות קובץ אודיו לקרב."}), 400

    temp_path = None
    try:
        temp_path = save_uploaded_audio(audio, "battle_")
        source_name = audio.filename

        result_a = analyze_audio_source(temp_path, model_path=model_a_path)
        result_b = analyze_audio_source(temp_path, model_path=model_b_path)
        style_candidates = sorted({
            item["genre"]
            for item in (result_a.get("all_styles", []) + result_b.get("all_styles", []))
        })
        default_winner = "model_a" if result_a["confidence"] >= result_b["confidence"] else "model_b"

        result = {
            "model_a": result_a,
            "model_b": result_b,
            "model_a_short": short_model_label(model_a_path.name),
            "model_b_short": short_model_label(model_b_path.name),
            "default_winner": default_winner,
            "winner_name": short_model_label(model_a_path.name) if default_winner == "model_a" else short_model_label(model_b_path.name),
            "source_name": source_name,
            "style_options": style_candidates,
            "stages": [
                {"name": "העלאה", "done": True},
                {"name": "הכנה", "done": True},
                {"name": "חיזוי", "done": True},
                {"name": "הכרעה", "done": True},
            ],
            "chart": [
                {"label": short_model_label(model_a_path.name), "value": result_a["confidence"], "tone": "ok"},
                {"label": short_model_label(model_b_path.name), "value": result_b["confidence"], "tone": "bad"},
            ],
            "judge_choice": battle.get("judge_choice"),
            "judge_style": battle.get("judge_style"),
            "judge_counts": battle.get("judge_counts"),
        }

        battle["status"] = "ממתין להכרעה"
        battle["last_result"] = result
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": f"חיזוי הקרב נכשל: {exc}"}), 500
    finally:
        if temp_path and Path(temp_path).exists():
            Path(temp_path).unlink(missing_ok=True)


@app.route("/api/judge_battle", methods=["POST"])
@login_required
@admin_required
def judge_battle():
    data = request.get_json(silent=True) or {}
    actual_style = (data.get("actual_style") or "").strip()
    battle_id = data.get("battle_id")

    try:
        battle = battles[int(battle_id)]
    except (TypeError, ValueError, IndexError):
        return jsonify({"error": "הקרב לא נמצא."}), 404

    if not battle.get("last_result"):
        return jsonify({"error": "יש להריץ את הקרב לפני שמכריעים אותו."}), 400

    if not actual_style:
        return jsonify({"error": "יש לבחור את הסגנון האמיתי של השיר לפני ההכרעה."}), 400

    verdict, score_a, score_b = battle_verdict_from_style(
        battle["last_result"]["model_a"],
        battle["last_result"]["model_b"],
        actual_style,
    )
    apply_battle_verdict(battle, verdict)
    battle["last_result"]["judge_choice"] = verdict
    battle["last_result"]["judge_style"] = actual_style
    battle["last_result"]["style_scores"] = {
        "model_a": round(score_a, 1),
        "model_b": round(score_b, 1),
    }
    battle["last_result"]["judge_counts"] = battle["judge_counts"]
    battle["judge_style"] = actual_style
    return jsonify({"ok": True, "battle": battle_view(battle), "models": find_models()})


@app.route("/api/start_training", methods=["POST"])
@app.route("/train/start", methods=["POST"])
@login_required
@admin_required
def start_training():
    current_thread = training_status.get("_thread")
    if current_thread and current_thread.is_alive():
        return jsonify(training_status_view())

    run_label = now_local_str()
    evaluate_training_state(run_label, preserve_runtime=True)
    worker = threading.Thread(target=run_genre_helper_refresh, args=(run_label,), daemon=True)
    update_training_status(
        stage_label="בתור",
        message="רענון Genre Helper התחיל. ממתינים לעדכון ההתקדמות הראשון.",
        progress=3,
        running=True,
        started_at=run_label,
        finished_at=None,
        last_run=run_label,
        _thread=worker,
    )
    worker.start()
    return jsonify(training_status_view())


@app.route("/api/training_status")
@app.route("/train/status")
@login_required
@admin_required
def get_training_status():
    is_running = bool(training_status.get("running"))
    evaluate_training_state(training_status.get("last_run"), preserve_runtime=is_running)
    return jsonify(training_status_view())


@app.route("/api/main_training/start", methods=["POST"])
@login_required
@admin_required
def start_main_training():
    ok, error = start_main_training_run()
    if not ok:
        return jsonify({"error": error, "status": main_training_view()}), 400
    return jsonify(main_training_view())


@app.route("/api/main_training/status")
@login_required
@admin_required
def get_main_training_status():
    return jsonify(main_training_view())


@app.route("/metrics/<path:filename>")
@login_required
def metric_asset(filename):
    return send_from_directory(METRICS_DIR, filename)


@app.route("/health")
def health():
    return jsonify({"ok": True})


if __name__ == "__main__":
    with app.app_context():
        ensure_database_schema()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "7860")))
