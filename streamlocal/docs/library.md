# Persistent Media Library - Stage 2

Stage 2 tracks physical MP4/MKV files. Recognition of movies, series, seasons and episodes is deliberately deferred to Stage 3.

## File identity

Each file stores:
- normalized path,
- file size,
- filesystem timestamps,
- SHA-256 of the first 1 MiB,
- SHA-256 of the last 1 MiB.

Unchanged files skip full probing. If the path changes but the fingerprint matches, StreamLocal reuses the existing media-file identity.

## Missing files

Missing files are marked `online = false` and retained in SQLite. This preserves identity for future watch history and relocation.

## FFprobe

When available, FFprobe records container, duration, video codec, resolution, frame rate, bitrate, audio streams and embedded subtitle streams.

A missing or failed FFprobe does not block import.

## Watcher

Enabled sources are watched using `watchdog`. File events are debounced for approximately 3 seconds before rescanning.

## Safety

StreamLocal does not move, rename, edit or delete source media in Stage 2. Removing a source disables it and marks its files unavailable.
