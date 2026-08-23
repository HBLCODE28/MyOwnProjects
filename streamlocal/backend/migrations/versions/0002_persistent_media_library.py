"""Stage 2 persistent media library.

Revision ID: 0002_library
Revises: 0001_stage1
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0002_library"
down_revision: Union[str, None] = "0001_stage1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "library_sources",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("path", sa.String(2048), nullable=False),
        sa.Column("normalized_path", sa.String(2048), nullable=False, unique=True),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("recursive", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("last_scan_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_library_sources_normalized_path", "library_sources", ["normalized_path"])

    op.create_table(
        "media_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("media_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("original_title", sa.String(512), nullable=True),
        sa.Column("overview", sa.Text(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("date_added", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_media_items_media_type", "media_items", ["media_type"])

    op.create_table(
        "media_files",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("media_item_id", sa.Integer(), sa.ForeignKey("media_items.id"), nullable=False),
        sa.Column("library_source_id", sa.Integer(), sa.ForeignKey("library_sources.id"), nullable=False),
        sa.Column("absolute_path", sa.String(2048), nullable=False),
        sa.Column("normalized_path", sa.String(2048), nullable=False, unique=True),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("modified_at_fs", sa.DateTime(), nullable=False),
        sa.Column("created_at_fs", sa.DateTime(), nullable=True),
        sa.Column("fingerprint", sa.String(160), nullable=False),
        sa.Column("container", sa.String(100), nullable=True),
        sa.Column("duration_seconds", sa.Float(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("video_codec", sa.String(100), nullable=True),
        sa.Column("frame_rate", sa.Float(), nullable=True),
        sa.Column("bitrate", sa.Integer(), nullable=True),
        sa.Column("ffprobe_json", sa.Text(), nullable=True),
        sa.Column("online", sa.Boolean(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    for name, columns in [
        ("ix_media_files_media_item_id", ["media_item_id"]),
        ("ix_media_files_library_source_id", ["library_source_id"]),
        ("ix_media_files_normalized_path", ["normalized_path"]),
        ("ix_media_files_fingerprint", ["fingerprint"]),
        ("ix_media_files_online", ["online"]),
    ]:
        op.create_index(name, "media_files", columns)

    op.create_table(
        "audio_tracks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("media_file_id", sa.Integer(), sa.ForeignKey("media_files.id"), nullable=False),
        sa.Column("stream_index", sa.Integer(), nullable=False),
        sa.Column("language", sa.String(32), nullable=True),
        sa.Column("title", sa.String(256), nullable=True),
        sa.Column("codec", sa.String(100), nullable=True),
        sa.Column("channels", sa.Integer(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_audio_tracks_media_file_id", "audio_tracks", ["media_file_id"])

    op.create_table(
        "subtitle_tracks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("media_file_id", sa.Integer(), sa.ForeignKey("media_files.id"), nullable=False),
        sa.Column("stream_index", sa.Integer(), nullable=True),
        sa.Column("external_path", sa.String(2048), nullable=True),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("language", sa.String(32), nullable=True),
        sa.Column("title", sa.String(256), nullable=True),
        sa.Column("format", sa.String(100), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("checksum", sa.String(128), nullable=True),
        sa.Column("cached_vtt_path", sa.String(2048), nullable=True),
    )
    op.create_index("ix_subtitle_tracks_media_file_id", "subtitle_tracks", ["media_file_id"])

    op.create_table(
        "scan_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("library_sources.id"), nullable=True),
        sa.Column("started_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("files_scanned", sa.Integer(), nullable=False),
        sa.Column("files_added", sa.Integer(), nullable=False),
        sa.Column("files_updated", sa.Integer(), nullable=False),
        sa.Column("errors_count", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index("ix_scan_jobs_source_id", "scan_jobs", ["source_id"])

def downgrade() -> None:
    op.drop_table("scan_jobs")
    op.drop_table("subtitle_tracks")
    op.drop_table("audio_tracks")
    op.drop_table("media_files")
    op.drop_table("media_items")
    op.drop_table("library_sources")
