from dataclasses import dataclass, field
import json
from pathlib import Path
import shutil
import subprocess
from app.config import get_settings

@dataclass
class AudioStreamInfo:
    stream_index: int
    language: str | None
    title: str | None
    codec: str | None
    channels: int | None
    is_default: bool

@dataclass
class SubtitleStreamInfo:
    stream_index: int
    language: str | None
    title: str | None
    format: str | None
    is_default: bool

@dataclass
class ProbeResult:
    container: str | None = None
    duration_seconds: float | None = None
    width: int | None = None
    height: int | None = None
    video_codec: str | None = None
    frame_rate: float | None = None
    bitrate: int | None = None
    audio_tracks: list[AudioStreamInfo] = field(default_factory=list)
    subtitle_tracks: list[SubtitleStreamInfo] = field(default_factory=list)
    raw_json: str | None = None

class FFprobeUnavailable(RuntimeError):
    pass

def _fraction_to_float(value: str | None) -> float | None:
    if not value or value in {"0/0", "N/A"}:
        return None
    try:
        if "/" in value:
            numerator, denominator = value.split("/", 1)
            denominator_value = float(denominator)
            return float(numerator) / denominator_value if denominator_value else None
        return float(value)
    except (ValueError, ZeroDivisionError):
        return None

def resolve_ffprobe() -> str:
    settings = get_settings()
    if settings.ffprobe_path and Path(settings.ffprobe_path).exists():
        return settings.ffprobe_path
    found = shutil.which("ffprobe")
    if found:
        return found
    raise FFprobeUnavailable("FFprobe was not found. Set FFPROBE_PATH or install FFmpeg.")

def probe_media(path: Path) -> ProbeResult:
    completed = subprocess.run(
        [resolve_ffprobe(), "-v", "error", "-show_format", "-show_streams", "-print_format", "json", str(path)],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "FFprobe failed.")

    payload = json.loads(completed.stdout)
    format_info = payload.get("format", {})
    result = ProbeResult(
        container=format_info.get("format_name"),
        duration_seconds=float(format_info["duration"]) if format_info.get("duration") else None,
        bitrate=int(format_info["bit_rate"]) if format_info.get("bit_rate") else None,
        raw_json=json.dumps(payload, ensure_ascii=False),
    )

    for stream in payload.get("streams", []):
        stream_type = stream.get("codec_type")
        tags = stream.get("tags", {}) or {}
        disposition = stream.get("disposition", {}) or {}

        if stream_type == "video" and result.video_codec is None:
            result.video_codec = stream.get("codec_name")
            result.width = stream.get("width")
            result.height = stream.get("height")
            result.frame_rate = _fraction_to_float(stream.get("avg_frame_rate") or stream.get("r_frame_rate"))
        elif stream_type == "audio":
            result.audio_tracks.append(AudioStreamInfo(
                stream_index=int(stream.get("index", 0)),
                language=tags.get("language"),
                title=tags.get("title"),
                codec=stream.get("codec_name"),
                channels=stream.get("channels"),
                is_default=bool(disposition.get("default", 0)),
            ))
        elif stream_type == "subtitle":
            result.subtitle_tracks.append(SubtitleStreamInfo(
                stream_index=int(stream.get("index", 0)),
                language=tags.get("language"),
                title=tags.get("title"),
                format=stream.get("codec_name"),
                is_default=bool(disposition.get("default", 0)),
            ))
    return result
