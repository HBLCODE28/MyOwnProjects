# StreamLocal

StreamLocal is a Windows local-first movie and TV library/player that runs through a localhost web application.

## Current implementation

Stage 1 - Foundation.

Implemented:

- React + TypeScript + Vite frontend.
- FastAPI backend.
- SQLite database in `%LOCALAPPDATA%\StreamLocal`.
- SQLAlchemy 2.x.
- Alembic migrations.
- `/api/v1/health`.
- Original dark desktop application shell.
- Windows PowerShell bootstrap, development, build and test scripts.

Media scanning and playback intentionally begin in later Stages.

## Requirements for development

- Windows 10/11.
- Python 3.11 or newer.
- Node.js 20 or newer.
- Git.

FFmpeg is optional in Stage 1. The health endpoint reports whether it is available.

## Setup

From the StreamLocal project directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
```

This creates `backend\.venv`, installs Python dependencies, runs Alembic migrations and runs `npm install`.

## Development

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Development URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:4310`
- Health: `http://127.0.0.1:4310/api/v1/health`

Vite proxies `/api` requests to the backend.

## Verification

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
```

The Stage 1 verification runs:

- backend pytest suite,
- frontend TypeScript checking,
- frontend production build.

## Database

The local SQLite DB is not stored inside the Git repository.

Default path:

```text
%LOCALAPPDATA%\StreamLocal\data\streamlocal.db
```

Migrations can be run manually:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
```

## Project documents

- `SPEC.md` - product and technical specification.
- `STAGES.md` - authoritative development plan and progress tracker.
