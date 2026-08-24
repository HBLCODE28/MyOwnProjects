# StreamLocal Browser Release Checklist

## Build and verification

From `frontend/`:

```text
npm ci
npm run typecheck
npm test -- --run
npm run build
```

The release artifact is `frontend/dist/`. It must be served from HTTPS or a
development localhost origin. Direct `file://` opening is not supported because
the File System Access API requires a secure context.

## Manual smoke test

- Open Home, Movies, Series, Identify, Library and Settings.
- Add and rescan a folder containing MP4/MKV files.
- Identify automatic items and edit one item manually.
- Play a movie longer than ten minutes, pause, close, reopen and verify Resume.
- Verify timeline previews do not block playback.
- Configure Intro, Recap and Credits segments and verify skip controls.
- Verify a series episode can advance to the next available episode after Credits.
- Export and import a backup; reconnect the folder afterward.
- Remove a library record and confirm the original media file still exists.
- Test browsing with the network disabled after the library has loaded once.

## Architecture boundary

The shipped product is browser-only. The old backend/SQLite/FFmpeg-installer
requirements from the original early stages are superseded by IndexedDB,
File System Access API, native browser playback and static PWA deployment.
StreamLocal never uploads or modifies source media.
