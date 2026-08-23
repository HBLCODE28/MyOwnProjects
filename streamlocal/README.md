# StreamLocal

StreamLocal is a Windows local-first movie and TV library/player running through a localhost web application.

## Current implementation

Stage 2 - Persistent Media Library.

Implemented:
- Persistent Windows media folders.
- MP4 and MKV discovery.
- SQLite library records under `%LOCALAPPDATA%\StreamLocal`.
- Lightweight file fingerprinting for move/rename reconciliation.
- Missing-file state without deleting media records.
- FFprobe technical metadata when available.
- Embedded audio/subtitle stream discovery.
- Debounced filesystem monitoring with watchdog.
- Native Windows folder chooser.
- Library screen with Add, Rescan and Remove.
- Original source media is never moved, renamed, edited or deleted.

Movie/series filename recognition and online metadata begin in Stage 3.

## Development

Install/update dependencies and migrations:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Verify:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
```

URLs:
- UI: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:4310`
- Health: `http://127.0.0.1:4310/api/v1/health`

Local DB:
`%LOCALAPPDATA%\StreamLocal\data\streamlocal.db`
