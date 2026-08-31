# Project Context

## What This Is

StreamLocal is a Windows-focused local video library and playback app. The current implementation is a browser-only React/TypeScript PWA that stores library metadata in IndexedDB and reads user-selected media folders through browser file APIs or the local portable bridge.

## Project Type

- Type: browser-only web app / Windows local media tool
- Main runtime: React + TypeScript + Vite static frontend

## Main Users / Audience

- A single local Windows user managing private movie and TV files.

## Main Goals

- Browse local movies and series in a streaming-style UI.
- Keep media files local and never upload them.
- Track watch progress, Continue Watching, episode state, subtitles, artwork, and metadata.
- Support portable/static builds for localhost or HTTPS hosting.

## Stack / Runtime

- Language/framework: React 19, TypeScript, Vite
- Storage: IndexedDB through Dexie
- Important integrations: File System Access API, optional local network/portable bridge, optional online artwork/subtitle providers
- Local/dev entrypoints: `frontend/package.json`, `frontend/src/App.tsx`, `frontend/src/pages/`, `frontend/src/services/`

## Important Paths

- `frontend/src/` - active application source.
- `frontend/src/services/` - library scanning, recognition, playback, metadata, artwork, external playback history.
- `frontend/src/components/` - browse, player, library, settings, and shared UI components.
- `frontend/src/styles/` - global and feature CSS.
- `scripts/` - Windows PowerShell helper scripts for dev, build, release, and player history bridge.
- `tools/website-portable/` - local portable web server tooling.
- `desktop/launcher/` - Windows launcher source.
- `docs/` - current focused technical docs.
- `SPEC.md` - original broad product specification; useful for intent but not always current implementation truth.

## High-Risk Areas

- File System Access permissions and reconnect flows.
- IndexedDB schema and import/export compatibility.
- Playback progress, watched-state, and Continue Watching behavior.
- External VLC/Windows Media Player history bridge.
- CIFS/VMSHARE executable-bit limitations for Node tooling.

## Read More When Needed

- `README.md` - current runtime, development, storage, and migration summary.
- `docs/browser-only-architecture.md` - current architecture source of truth.
- `docs/library.md` - older Stage 2 library behavior; verify against current source before relying on it.
- `docs/release-checklist.md` - build and release checks.
- `docs/test-media-stage10.md` - test media expectations.
- `SPEC.md` - full original product plan and acceptance criteria.

## Open Questions

- Which generated release outputs should be retained in the repository versus regenerated on demand?
- Whether root files `DESKTOP_APP_INSTALL_HE.txt`, `PACKAGER_README.txt`, and `StreamLocal_STAGES.docx` should move under `docs/`.
