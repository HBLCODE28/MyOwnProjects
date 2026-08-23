# Browser-Only Architecture

## Runtime

StreamLocal is a static web application/PWA. There is no application backend.

Data flow:

User-selected Windows folder
-> File System Access API
-> File objects
-> local parser/fingerprint
-> IndexedDB
-> React UI

## Security boundaries

- Folder access requires an explicit browser permission.
- StreamLocal requests read access, not read/write access.
- IndexedDB is isolated by browser origin/profile.
- No source media is uploaded.
- Recognition performs no network requests.
- No API secret exists in the application.

## Persistence

StreamLocal calls `navigator.storage.persist()` when possible. This reduces the chance of browser storage eviction but does not replace backups.

Users should use Export Library before moving machines or clearing browser data.

## Portability

Backup ZIPs contain library metadata and artwork. They do not contain filesystem permission handles or video files.

After import on another computer, the user reconnects each source folder and StreamLocal reconciles files by stored file records/fingerprints during rescans.

## Deployment

The production artifact is `frontend/dist`.

A secure HTTPS origin is recommended so File System Access and PWA features work correctly. Development uses Vite on localhost.

The application does not need a database server or application server. Any ordinary static HTTPS host is sufficient for the built assets.
