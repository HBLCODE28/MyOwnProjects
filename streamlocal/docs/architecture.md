# StreamLocal Architecture

## Stage 1 baseline

StreamLocal is a local-first Windows application delivered as a browser UI backed by a localhost service.

Development topology:

- Frontend: React + TypeScript + Vite on `127.0.0.1:5173`.
- Backend: FastAPI on `127.0.0.1:4310`.
- Database: SQLite under `%LOCALAPPDATA%\StreamLocal\data\streamlocal.db`.
- Migrations: Alembic.
- Production topology planned for Stage 15: frontend static assets served by FastAPI on one localhost port.

The frontend does not receive arbitrary filesystem access. Later media APIs will operate on database IDs rather than raw paths.

Stage 1 intentionally does not implement scanning, metadata retrieval or playback.
