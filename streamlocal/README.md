# StreamLocal

StreamLocal is a browser-only local movie and TV library for Windows.

## Current architecture

Stage 3 removes the runtime backend.

StreamLocal now uses:

- React + TypeScript.
- IndexedDB through Dexie.
- File System Access API for user-selected folders.
- Web Crypto for lightweight file fingerprints.
- Local filename/folder recognition.
- Local manual metadata and artwork.
- ZIP export/import for moving the library to another computer.
- PWA application shell.

StreamLocal no longer requires at runtime:

- Python.
- FastAPI.
- SQLAlchemy.
- Alembic.
- SQLite.
- A database server.
- TMDb or any external metadata API.
- API keys or tokens.

## Supported browser target

Use a current Microsoft Edge or Google Chrome on Windows.

Folder selection uses `showDirectoryPicker`, so the app must run in a secure browser context. Localhost is suitable for development. A production copy should be hosted as static HTTPS files and can then be installed as a PWA.

Opening `index.html` directly with `file://` is not the supported deployment mode.

## Development

Install dependencies:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Build static files:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

Output:

```text
frontend\dist
```

## Library storage

Library metadata is stored in IndexedDB inside the browser profile.

Original video files are never moved, renamed, edited or deleted.

## Moving to another computer

On computer A:

1. Settings.
2. Export library.
3. Copy the generated `StreamLocal-Backup-YYYY-MM-DD.zip`.

On computer B:

1. Open/install StreamLocal from the same HTTPS origin.
2. Settings -> Import library.
3. Library -> Reconnect each media folder.
4. Rescan.

Folder permissions cannot be exported because browsers intentionally require the user to grant folder access separately on each computer.

## Old Stage 2 SQLite data

The former SQLite database under `%LOCALAPPDATA%\StreamLocal` is not used after this stage. Stage 3 does not delete it automatically. Since playback history was not implemented yet, the browser-only library can safely be rebuilt by reconnecting/rescanning the media folders.
