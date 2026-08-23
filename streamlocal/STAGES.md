# StreamLocal Development Stages

Version: 1.0
Project: StreamLocal
Purpose: Authoritative implementation plan and progress tracker
Target: Windows local web application
Repository model: Existing Git repository

## How this document is used

This file is the implementation source of truth for StreamLocal. Development should proceed in Stage order unless a dependency explicitly allows parallel work.

Rules:

- A Stage is not complete because its code exists. It is complete only after its acceptance criteria and tests pass.
- Do not silently move unfinished tasks to a later Stage. Record them as explicit follow-up tasks.
- Update each checkbox as work is completed.
- Update the Status line for every Stage: NOT STARTED, IN PROGRESS, BLOCKED, or COMPLETE.
- Keep implementation compatible with `SPEC.md`.
- If `SPEC.md` and this file conflict, update the documents explicitly before changing architecture.
- Each completed Stage must end with tests, documentation updates when required, and a clean Git status.
- Prefer small logical commits. Do not mix unrelated future-stage work into the current Stage.
- Generated media, local database files, cache, logs, API secrets and user media must never be committed.
- The original video and subtitle files must not be modified by StreamLocal.

## Git workflow

Recommended commit naming:

`Stage 01: foundation`
`Stage 02: persistent media library`
`Stage 03: media recognition and metadata`

A Stage may contain multiple commits when useful, but each commit should remain logically scoped.

Before declaring a Stage complete:

1. Run its tests.
2. Fix failures.
3. Update this file.
4. Update README/docs if behavior changed.
5. Check `git status`.
6. Commit the completed work.

## Global definition of done

A task is complete only when:
- implementation exists,
- errors are handled,
- relevant tests exist and pass,
- generated/local-only data is not tracked by Git,
- original user media is not destructively modified,
- the UI exposes the feature where required,
- behavior survives application restart when persistence is required.

---

# Stage 0 - Repository and Development Rules

**Status:** COMPLETE

**Depends on:** None

## Goal

Prepare the existing Git repository so all later work follows one predictable structure and workflow.

## Tasks
- [x] Place SPEC.md and STAGES.md in the repository root.
- [x] Create frontend/, backend/, scripts/, tools/, docs/ and data/ directories.
- [x] Create a .gitignore that excludes virtual environments, node_modules, build output, local databases, logs, cache, generated HLS segments, generated thumbnails, local secrets and media files.
- [x] Create .env.example without real secrets.
- [x] Confirm the repository has a clean working tree before implementation starts.
- [x] Record the current baseline with a Git commit.
- [x] Use one logical commit or small series of commits per Stage.
- [x] Do not start a later Stage while the current Stage has failed acceptance criteria.
- [x] Keep source video files and user-generated media out of Git.

## Deliverables
- [x] Repository directory structure
- [x] .gitignore
- [x] .env.example
- [x] SPEC.md
- [x] STAGES.md
- [x] Baseline Git commit

## Required tests / verification
- [x] git status shows no generated/local-only files after a normal development start.
- [x] Repository can be cloned without requiring local media or secrets.

## Acceptance criteria
- [x] Required directories exist.
- [x] Specification and stage tracker are committed.
- [x] Generated files are ignored.
- [x] Working tree is clean.

## Stage completion record

- Completion date: 2026-08-23
- Git commit/tag: Stage 0 baseline commit
- Known follow-ups: None
---

# Stage 1 - Foundation

**Status:** COMPLETE

**Depends on:** Stage 0

## Goal

Create the runnable StreamLocal application shell with React, FastAPI, SQLite and migrations.

## Tasks
- [x] Create React + TypeScript + Vite frontend.
- [x] Create Python FastAPI backend.
- [x] Add SQLAlchemy 2.x and SQLite database bootstrap.
- [x] Configure Alembic migrations.
- [x] Create backend configuration layer for application paths, localhost host and port.
- [x] Use %LOCALAPPDATA%\StreamLocal as the default application-data root.
- [x] Create GET /api/v1/health.
- [x] Health response must report backend status, database status and FFmpeg availability.
- [x] Create basic frontend API client.
- [x] Create top-level application routes and navigation shell.
- [x] Create an original dark streaming-service visual foundation.
- [x] Create PowerShell development scripts for starting frontend and backend.
- [x] Add backend health endpoint tests.
- [x] Document local development commands in README.md.

## Deliverables
- [x] Runnable frontend
- [x] Runnable backend
- [x] SQLite initialization
- [x] Alembic migration setup
- [x] Health API
- [x] Development scripts
- [x] Initial UI shell

## Required tests / verification
- [x] Backend unit/API test suite passes.
- [x] Frontend TypeScript compilation succeeds.
- [x] GET /api/v1/health returns HTTP 200.
- [x] SQLite file is created in application data, not in Git-tracked source folders.

## Acceptance criteria
- [x] Application opens in a desktop browser from localhost.
- [x] Frontend can call the backend.
- [x] Database migrations can run from an empty installation.
- [x] No media scanning or playback is required yet.

## Stage completion record

- Completion date: 2026-08-23
- Git commit/tag: Stage 1 foundation commit
- Known follow-ups: None

---

# Stage 2 - Persistent Media Library

**Status:** COMPLETE

**Depends on:** Stage 1

## Goal

Allow the user to configure permanent media folders and scan MP4/MKV files into the local database.

## Tasks
- [x] Create library_sources database model and migration.
- [x] Create media_items and media_files base models and migrations.
- [x] Create Library Source API endpoints: list, add, update, remove and rescan.
- [x] Validate Windows folder paths before adding a source.
- [x] Support source types automatic, movies and tv.
- [x] Recursively discover .mp4 and .mkv files.
- [x] Integrate FFprobe and save technical metadata such as duration, codecs, resolution and audio/subtitle stream information.
- [x] Create lightweight file fingerprinting based on file size, timestamps and partial hashes.
- [x] Do not full-hash large media files by default.
- [x] Skip unchanged files during subsequent scans.
- [x] Add filesystem monitoring using watchdog.
- [x] Debounce filesystem events before scanning.
- [x] Mark missing files as unavailable instead of deleting their database history.
- [x] Provide manual Rescan action and visible scan status.
- [x] Create basic Library Management page showing sources and discovered files.

## Deliverables
- [x] Persistent source configuration
- [x] MP4/MKV scanner
- [x] FFprobe integration
- [x] File fingerprint service
- [x] Filesystem watcher
- [x] Library management source view

## Required tests / verification
- [x] Adding a folder imports supported media.
- [x] Unsupported extensions are ignored.
- [x] Second scan does not re-probe unchanged files unnecessarily.
- [x] Renamed or moved files can be reconciled when fingerprint matches.
- [x] Removing a source never deletes physical video files.

## Acceptance criteria
- [x] Library survives application restart.
- [x] At least MP4 and MKV are discovered.
- [x] Technical metadata is persisted.
- [x] Unavailable files retain watch-history-compatible database records.

## Stage completion record

- Completion date: 2026-08-23
- Git commit/tag: Stage 2 persistent media library commit
- Known follow-ups: None

---

# Stage 3 - Browser-Only Media Recognition

**Status:** COMPLETE  
**Depends on:** Stage 2 - Persistent Media Library

## Goal

Move StreamLocal to a browser-only architecture and identify/organize movies and TV episodes locally without an application backend or external metadata API.

## Tasks

- [x] Remove runtime dependency on FastAPI, Python, SQLAlchemy, Alembic and SQLite.
- [x] Store StreamLocal library data in IndexedDB.
- [x] Request persistent browser storage when supported.
- [x] Use the File System Access API for user-selected Windows folders.
- [x] Request read-only folder access.
- [x] Scan MP4 and MKV recursively.
- [x] Preserve unavailable file records instead of deleting them.
- [x] Use Web Crypto SHA-256 fingerprints from the first/last file chunks.
- [x] Reconcile a moved/renamed file by fingerprint where possible.
- [x] Parse movie filenames locally in TypeScript.
- [x] Parse S01E01, S1E1 and 1x01 episode patterns.
- [x] Use folder names when the episode filename does not contain the series title.
- [x] Remove common release/codec/resolution noise from filenames.
- [x] Create local Series grouping and season/episode numbering.
- [x] Use confidence levels and Needs Match rather than forcing weak recognition.
- [x] Add an Identify screen.
- [x] Add manual Edit / Identify metadata.
- [x] Ensure manual metadata is not silently overwritten by automatic recognition.
- [x] Add Reset to Automatic.
- [x] Support local JSON/NFO sidecar metadata.
- [x] Detect common local poster/backdrop filenames.
- [x] Allow manual JPG/PNG/WebP poster and backdrop selection.
- [x] Store artwork locally in IndexedDB.
- [x] Add StreamLocal ZIP export/import.
- [x] Exclude filesystem permission handles from backup.
- [x] Require folder reconnect after importing on another computer.
- [x] Add a PWA manifest and offline application-shell service worker.
- [x] Produce a static frontend build in frontend/dist.
- [x] Make recognition perform no external metadata/API requests.
- [x] Keep original media read-only and never rename/move/delete source video files.

## Deliverables

- Browser-only IndexedDB database.
- File System Access based library scanner.
- Local TypeScript movie/episode recognition.
- Series grouping.
- Local metadata editor.
- Local artwork storage.
- Import/export ZIP workflow.
- Static PWA build.
- Node-only development/build/test scripts.

## Required tests / verification

- [x] Movie filename parsing.
- [x] SxxExx parsing.
- [x] 1x01 parsing.
- [x] Folder-aware episode parsing.
- [x] Series grouping.
- [x] Manual metadata survives recognition.
- [x] Recognition makes no fetch/API call.
- [x] Backup excludes filesystem handles.
- [x] TypeScript typecheck.
- [x] Production static build.
- [x] No backend API references remain in frontend/src.
- [x] No backend directory remains in the Stage 3 runtime project.

## Acceptance criteria

- [x] StreamLocal runtime does not require Python.
- [x] StreamLocal runtime does not require FastAPI.
- [x] StreamLocal runtime does not require SQLite or a database server.
- [x] No external metadata API is used.
- [x] No API key/token exists in the application.
- [x] Library metadata persists in IndexedDB.
- [x] User-selected folders can be scanned in a supported Chromium browser.
- [x] Movie/episode recognition works locally.
- [x] Series are grouped locally.
- [x] Needs Match and manual correction work.
- [x] Local artwork works.
- [x] Export/import works for moving library metadata to another computer.
- [x] Imported folders require explicit reconnect permission on the new computer.
- [x] Recognition works offline.
- [x] Original media files are not modified.

## Completion record

- Completion date: 2026-08-23
- Git commit/tag: Stage 3 browser-only media recognition commit
- Known follow-ups: Browser-native MKV/codec limitations are handled in later playback stages. Production use should be from a stable HTTPS origin/PWA rather than file://.

# Stage 4 - Streaming-Style Browse UI

**Status:** COMPLETE  
**Depends on:** Stage 3 - Browser-Only Media Recognition

## Goal

Create the first real streaming-style browse experience on top of the browser-only IndexedDB library.

## Tasks

- [x] Replace placeholder Movies page with real local movie browse UI.
- [x] Replace placeholder Series page with real local series browse UI.
- [x] Replace Home with a browse dashboard.
- [x] Add featured hero section based on local library content.
- [x] Add movie poster grid.
- [x] Add series grid.
- [x] Group series by seasons and episodes.
- [x] Display available/unavailable state.
- [x] Display local poster/backdrop artwork when present.
- [x] Use local placeholder artwork when no poster exists.
- [x] Add search on Movies.
- [x] Add search on Series.
- [x] Add library counters.
- [x] Keep all browsing data local in IndexedDB.
- [x] Avoid any backend/API dependency.
- [x] Update persistent storage status message so false is not shown as an app error.

## Required tests / verification

- [x] Movie search by title/year/filename.
- [x] Series grouping by season/episode.
- [x] Series search by episode filename.
- [x] Browse counters.
- [x] TypeScript typecheck.
- [x] Production static build.
- [x] No backend/API references in frontend source.

## Acceptance criteria

- [x] Home shows local streaming-style rows.
- [x] Movies page shows real recognized movies from IndexedDB.
- [x] Series page shows real recognized series from IndexedDB.
- [x] Search works locally.
- [x] Series/season/episode grouping works locally.
- [x] Missing media is visible as unavailable rather than hidden.
- [x] UI uses local artwork or local placeholders.
- [x] No external metadata API is used.
- [x] No application backend is required.
- [x] Static PWA build succeeds.

## Completion record

- Completion date: 2026-08-23
- Git commit/tag: Stage 4 streaming browse UI commit
- Known follow-ups: Detailed title pages and playback launch are handled in later stages.

# Stage 5 - Basic MP4 Player

**Status:** NOT STARTED

**Depends on:** Stage 4

## Goal

Implement the custom StreamLocal player and reliable direct streaming for browser-compatible MP4 files.

## Tasks
- [ ] Create custom VideoPlayer component around HTML5 video.
- [ ] Implement HTTP byte-range streaming endpoint.
- [ ] Return 206 Partial Content for range requests.
- [ ] Do not load the entire file into memory.
- [ ] Add Play/Pause, seek timeline, current time, duration, volume, mute and fullscreen.
- [ ] Add playback speed menu from 0.5x to 2.0x.
- [ ] Implement control auto-hide while playing.
- [ ] Implement common keyboard shortcuts: Space/K, arrows/J/L, M, F, volume and C where applicable.
- [ ] Prevent player shortcuts while typing in inputs.
- [ ] Single click toggles Play/Pause.
- [ ] Double click toggles fullscreen.
- [ ] Add back-to-library behavior that restores browsing position when practical.
- [ ] Add basic player error overlay.

## Deliverables
- [ ] Custom player UI
- [ ] Range streaming backend
- [ ] Fullscreen
- [ ] Playback speed
- [ ] Keyboard shortcuts

## Required tests / verification
- [ ] Browser-compatible MP4 starts and seeks correctly.
- [ ] Range endpoint handles valid and invalid ranges.
- [ ] Keyboard shortcuts work and do not fire in form inputs.
- [ ] Large files are streamed in chunks.

## Acceptance criteria
- [ ] H.264/AAC MP4 playback is reliable.
- [ ] Seeking does not require full download.
- [ ] The player uses StreamLocal's custom UI.

## Stage completion record

- Completion date: 
- Git commit/tag: 
- Known follow-ups: None

---

# Stage 6 - MKV, Codec Compatibility and Multi-Audio

**Status:** NOT STARTED

**Depends on:** Stage 5

## Goal

Make MKV and incompatible codecs playable through the least expensive conversion strategy.

## Tasks
- [ ] Create playback capability probe using FFprobe data.
- [ ] Select strategy in this order: direct play, remux, audio transcode, full transcode.
- [ ] Integrate HLS.js in frontend.
- [ ] Create backend HLS playback sessions.
- [ ] Generate HLS/fMP4 output with FFmpeg.
- [ ] Copy compatible video streams instead of re-encoding whenever possible.
- [ ] Transcode incompatible audio to AAC when required.
- [ ] Transcode incompatible video to H.264 only when required.
- [ ] Create cancellation and cleanup for FFmpeg processes.
- [ ] Clean stale HLS sessions.
- [ ] Expose playback preparation/error states to the UI.
- [ ] Enumerate multiple audio streams.
- [ ] Provide Audio menu in player.
- [ ] Support language/title labels for tracks.
- [ ] Persist preferred audio language globally and optionally per series.

## Deliverables
- [ ] Playback strategy service
- [ ] HLS session service
- [ ] FFmpeg worker lifecycle
- [ ] MKV support
- [ ] Multi-audio selection

## Required tests / verification
- [ ] Test MP4 H.264/AAC direct play.
- [ ] Test MKV H.264/AAC.
- [ ] Test MKV H.264/AC3.
- [ ] Test MKV H.265/AC3 fallback.
- [ ] Test file with at least two audio tracks.
- [ ] Closing player terminates unused FFmpeg session.

## Acceptance criteria
- [ ] Required MP4/MKV test matrix is playable or produces a clear supported error.
- [ ] Compatible streams are not unnecessarily re-encoded.
- [ ] Audio tracks can be selected for supported files.

## Stage completion record

- Completion date: 
- Git commit/tag: 
- Known follow-ups: None

---

# Stage 7 - Watch Progress, Watched State and Personal Lists

**Status:** NOT STARTED

**Depends on:** Stage 6

## Goal

Make StreamLocal remember what the user watched and where playback stopped.

## Tasks
- [ ] Create playback_state migration/model.
- [ ] Save progress approximately every 5 seconds plus pause, seek and exit events.
- [ ] Do not write on every browser timeupdate event.
- [ ] Resume unfinished media from saved position.
- [ ] Ignore trivial resume positions under about 30 seconds.
- [ ] Mark movies watched at 90% or when no more than 5 minutes remain.
- [ ] Mark episodes watched at 90% or when no more than 2 minutes remain.
- [ ] Use StreamLocal playback tracking as the authoritative watched signal.
- [ ] Do not automatically mark watched solely from Windows Last Access Time.
- [ ] Optionally store external-access hints for future use.
- [ ] Show a clear V/checkmark for watched movies and episodes.
- [ ] Calculate series/season watched state from episodes.
- [ ] Implement Continue Watching.
- [ ] Implement Recently Watched.
- [ ] Create manual Mark Watched / Mark Unwatched actions.
- [ ] Create favorites and watchlist persistent state.
- [ ] Refresh Home state immediately after leaving the player.

## Deliverables
- [ ] Playback progress persistence
- [ ] Resume
- [ ] Watched checkmarks
- [ ] Continue Watching
- [ ] Recently Watched
- [ ] Favorites
- [ ] Watchlist

## Required tests / verification
- [ ] Progress survives restart.
- [ ] Movie and episode watched thresholds work.
- [ ] Mark Unwatched resets state according to chosen default.
- [ ] Continue Watching excludes completed and trivial-start items.
- [ ] Favorite and Watchlist are separate persistent flags.

## Acceptance criteria
- [ ] User can stop and later resume playback.
- [ ] Completed content is marked with V/check.
- [ ] Home rows reflect current history.
- [ ] Filesystem last-access time is not treated as authoritative viewing history.

## Stage completion record

- Completion date: 
- Git commit/tag: 
- Known follow-ups: None

---

# Stage 8 - TV Episode Playback Workflow

**Status:** NOT STARTED

**Depends on:** Stage 7

## Goal

Add streaming-service episode behavior for series.

## Tasks
- [ ] Create backend next-episode resolver.
- [ ] Resolve next episode within current season.
- [ ] Continue into next season when appropriate.
- [ ] Add Previous Episode and Next Episode controls.
- [ ] Show next-episode countdown near episode completion.
- [ ] Provide Play Now and Cancel controls.
- [ ] Autoplay next episode when enabled.
- [ ] Do not autoplay after movies.
- [ ] Persist autoplay-next-episode setting.
- [ ] Support marking an episode watched when user reaches configured credits segment.
- [ ] Update series and season progress indicators.

## Deliverables
- [ ] Next episode resolver
- [ ] Autoplay countdown
- [ ] Previous/next controls
- [ ] Series progress

## Required tests / verification
- [ ] S01E01 resolves to S01E02.
- [ ] Final episode of a season resolves to next season when available.
- [ ] Final known episode does not produce invalid autoplay.
- [ ] Cancel stops autoplay.

## Acceptance criteria
- [ ] Series can be watched continuously without returning to the library after each episode.
- [ ] Episode watch state updates correctly.

## Stage completion record

- Completion date: 
- Git commit/tag: 
- Known follow-ups: None

---

# Stage 9 - Subtitle System

**Status:** NOT STARTED

**Depends on:** Stage 6; can be developed after Stage 8 in project order

## Goal

Support external SRT, text subtitle tracks, language selection and manual synchronization controls.

## Tasks
- [ ] Detect external .srt files using common naming patterns.
- [ ] Store subtitle tracks and language labels.
- [ ] Convert SRT to WebVTT without modifying the original file.
- [ ] Detect embedded text subtitles using FFprobe.
- [ ] Extract compatible embedded text tracks through FFmpeg.
- [ ] Add subtitle selection menu to player.
- [ ] Add Off option.
- [ ] Implement preferred subtitle language.
- [ ] Add manual subtitle offset controls.
- [ ] Support at least +/-0.5 second adjustments and Reset.
- [ ] Optionally add +/-0.1 second fine controls.
- [ ] Cache generated VTT files.
- [ ] Invalidate subtitle cache when the source file changes.
- [ ] Handle unsupported image subtitle formats without crashing playback.

## Deliverables
- [ ] SRT discovery
- [ ] SRT-to-VTT conversion
- [ ] Embedded text subtitle extraction
- [ ] Subtitle menu
- [ ] Manual offset

## Required tests / verification
- [ ] External SRT works with MP4.
- [ ] External SRT works with MKV/HLS playback.
- [ ] Language labels are displayed.
- [ ] Manual offset visibly changes cue timing.
- [ ] Original SRT remains untouched.

## Acceptance criteria
- [ ] User can select external SRT subtitles.
- [ ] Common embedded text subtitles work where technically supported.
- [ ] Manual synchronization adjustment is reliable.

## Stage completion record

- Completion date: 
- Git commit/tag: 
- Known follow-ups: None

---

# Stage 10 - Automatic Subtitle Synchronization

**Status:** NOT STARTED

**Depends on:** Stage 9

## Goal

Automatically correct SRT timing against the video's audio while preserving the original subtitle.

## Tasks
- [ ] Integrate ffsubsync or a technically equivalent local audio-based synchronization method.
- [ ] Create background subtitle synchronization job.
- [ ] Extract/reference audio efficiently.
- [ ] Generate synchronized subtitle copy in StreamLocal cache.
- [ ] Never overwrite the original SRT.
- [ ] Store source checksum, media fingerprint, offset/correction data, algorithm and confidence when available.
- [ ] Invalidate synchronized output if source subtitle or target media changes.
- [ ] Add Auto Sync action in subtitle menu.
- [ ] Display synchronization progress.
- [ ] Reload corrected subtitle track after successful synchronization.
- [ ] On failure, preserve original track and manual offset controls.
- [ ] Log technical synchronization errors.
- [ ] Add setting for manual-only, ask, or automatic-on-first-use behavior.

## Deliverables
- [ ] Auto-sync service
- [ ] Background job
- [ ] Sync cache
- [ ] Auto Sync player action
- [ ] Failure fallback

## Required tests / verification
- [ ] Known constant-offset SRT sample is corrected.
- [ ] Original subtitle file hash remains unchanged.
- [ ] Failed sync leaves original subtitles usable.
- [ ] Cached synchronization is reused for unchanged source/target.

## Acceptance criteria
- [ ] User can request automatic SRT synchronization from the player.
- [ ] Successful sync persists for later playback.
- [ ] Failures do not block video playback.

## Stage completion record

- Completion date: 
- Git commit/tag: 
- Known follow-ups: None

---

# Stage 11 - Timeline Preview Thumbnails

**Status:** NOT STARTED

**Depends on:** Stage 6

## Goal

Show visual frame previews while hovering over the playback timeline.

## Tasks
- [ ] Create timeline thumbnail generation service using FFmpeg.
- [ ] Generate frames at configurable intervals.
- [ ] Prefer sprite sheets plus timing metadata to reduce HTTP requests.
- [ ] Store generated output in local cache.
- [ ] Generate previews as a background task after scanning or on demand.
- [ ] Do not block initial playback while previews are generated.
- [ ] Create timeline preview API.
- [ ] Show thumbnail and timestamp on timeline hover.
- [ ] Clamp preview panel inside the viewport.
- [ ] Regenerate previews when underlying media changes.
- [ ] Add Library action to regenerate timeline preview.

## Deliverables
- [ ] Thumbnail generator
- [ ] Sprite/timing metadata
- [ ] Timeline hover UI
- [ ] Cache invalidation

## Required tests / verification
- [ ] Hover near known timestamps returns approximately correct frames.
- [ ] Long movies do not generate excessive request counts.
- [ ] Missing preview cache does not block playback.

## Acceptance criteria
- [ ] Timeline previews appear for processed media.
- [ ] Generation is asynchronous and does not degrade normal browsing significantly.

## Stage completion record

- Completion date: 
- Git commit/tag: 
- Known follow-ups: None

---

# Stage 12 - Skip Intro, Skip Recap and Credits

**Status:** NOT STARTED

**Depends on:** Stage 8

## Goal

Provide Netflix-style segment skipping using explicit segment data, with automatic detection treated as experimental.

## Tasks
- [ ] Create media_segments model/migration.
- [ ] Support intro, recap and credits segment types.
- [ ] Create Library Management controls for manually defining segment start/end times.
- [ ] Show Skip Intro only while playback is inside an intro segment.
- [ ] Show Skip Recap only while playback is inside a recap segment.
- [ ] Use credits_start to trigger earlier next-episode flow where configured.
- [ ] Persist segment source as manual or detected.
- [ ] Add experimental feature flag for automatic intro detection.
- [ ] Do not make automatic intro/recap detection a release blocker.
- [ ] If automatic detection is later implemented, use cross-episode repeated audio/video fingerprint analysis and store confidence.

## Deliverables
- [ ] Media segments DB
- [ ] Manual segment editor
- [ ] Skip Intro
- [ ] Skip Recap
- [ ] Credits integration

## Required tests / verification
- [ ] Buttons appear only during configured segments.
- [ ] Clicking skip seeks to the expected end time.
- [ ] Credits-start can initiate next-episode flow.

## Acceptance criteria
- [ ] Manual intro/recap skipping works reliably.
- [ ] Automatic detection remains isolated behind an experimental flag until proven stable.

## Stage completion record

- Completion date: 
- Git commit/tag: 
- Known follow-ups: None

---

# Stage 13 - Library Management Completion

**Status:** NOT STARTED

**Depends on:** Stages 2-12 as relevant

## Goal

Give the user complete control over incorrect or incomplete library information without touching SQLite manually.

## Tasks
- [ ] Complete media table/grid management interface.
- [ ] Show title, type, path, match status, watched state, subtitle count, duration, resolution and codecs.
- [ ] Implement Edit Metadata.
- [ ] Implement Rematch Metadata.
- [ ] Implement Change Poster and Change Backdrop.
- [ ] Implement Change Title and Year.
- [ ] Implement Movie/Series reassignment.
- [ ] Implement Season/Episode reassignment.
- [ ] Implement Mark Watched/Unwatched.
- [ ] Implement technical metadata rescan.
- [ ] Implement regenerate timeline preview.
- [ ] Implement Open Folder in Explorer.
- [ ] Implement Locate File for missing files.
- [ ] Implement Remove from Library.
- [ ] Never silently delete the source video file.
- [ ] Support duplicate physical files for one logical item.

## Deliverables
- [ ] Complete Library Management UI
- [ ] Metadata editor
- [ ] Missing-file recovery
- [ ] Duplicate version handling

## Required tests / verification
- [ ] Incorrect movie can be rematched.
- [ ] Episode can be reassigned to correct season/episode.
- [ ] Missing file can be relinked.
- [ ] Remove from Library does not delete physical file.

## Acceptance criteria
- [ ] Common library mistakes can be fixed entirely through the UI.
- [ ] Original media remains protected from destructive actions.

## Stage completion record

- Completion date: 
- Git commit/tag: 
- Known follow-ups: None

---

# Stage 14 - Settings, Offline Behavior and Maintenance

**Status:** NOT STARTED

**Depends on:** Core functional stages

## Goal

Finish persistent configuration, offline behavior, cache management, logging and database maintenance.

## Tasks
- [ ] Create Settings sections for Library, Playback, Subtitles, Metadata, Storage and Advanced.
- [ ] Persist autoplay next episode, watched thresholds, seek interval and playback speed.
- [ ] Persist preferred audio/subtitle languages.
- [ ] Provide TMDb API status/configuration.
- [ ] Support operation without TMDb credentials.
- [ ] Use cached metadata when offline.
- [ ] Add cache-size reporting.
- [ ] Add clear timeline cache, stream cache and artwork cache actions.
- [ ] Create rotating application logs.
- [ ] Add Open Logs action.
- [ ] Add DB backup before schema migrations.
- [ ] Add manual StreamLocal data backup.
- [ ] Create stale HLS/transcoding cleanup.
- [ ] Verify no secrets are written to logs.

## Deliverables
- [ ] Settings UI
- [ ] Offline fallback
- [ ] Cache management
- [ ] Logging
- [ ] Backup/maintenance

## Required tests / verification
- [ ] Application starts and browses cached library without internet.
- [ ] Clearing generated caches does not remove source media or core watch history.
- [ ] Migration backup is created before schema changes.
- [ ] Secrets are absent from logs.

## Acceptance criteria
- [ ] Core playback and library browsing do not require internet.
- [ ] User can manage local cache and logs.
- [ ] Persistent preferences survive restart.

## Stage completion record

- Completion date: 
- Git commit/tag: 
- Known follow-ups: None

---

# Stage 15 - Windows Release, QA and Installer

**Status:** NOT STARTED

**Depends on:** All required previous stages

## Goal

Produce a polished Windows-local release with automated tests and a simple installation/start experience.

## Tasks
- [ ] Serve production frontend assets from the FastAPI backend so release uses one localhost port.
- [ ] Create Windows launcher that starts backend, waits for health and opens the default browser.
- [ ] Package Python backend using PyInstaller or equivalent.
- [ ] Decide FFmpeg distribution model and verify applicable licensing obligations.
- [ ] Bundle or configure FFmpeg/FFprobe reliably.
- [ ] Create installer for Windows.
- [ ] Ensure launcher binds to 127.0.0.1 by default.
- [ ] Add cleanup behavior for backend and child FFmpeg processes.
- [ ] Run backend unit/API/integration tests.
- [ ] Run frontend tests and TypeScript build.
- [ ] Run Playwright end-to-end flows.
- [ ] Test required media compatibility matrix.
- [ ] Test Windows paths with spaces, Unicode and long filenames.
- [ ] Test clean installation without development tools.
- [ ] Test upgrade from a previous local database using migrations.
- [ ] Update README with installation, usage, troubleshooting and uninstall instructions.

## Deliverables
- [ ] Windows launcher
- [ ] Packaged backend/frontend
- [ ] FFmpeg integration
- [ ] Windows installer
- [ ] Automated QA suite
- [ ] Release documentation

## Required tests / verification
- [ ] Clean Windows installation launches StreamLocal.
- [ ] Localhost UI opens automatically.
- [ ] Required MP4/MKV matrix is tested.
- [ ] SRT and auto-sync test scenarios pass.
- [ ] Watch state persists across restart.
- [ ] Installer does not remove or modify user media.

## Acceptance criteria
- [ ] StreamLocal can be installed and used on supported Windows versions without Node.js/Python development setup.
- [ ] Core P0 and P1 acceptance criteria pass.
- [ ] No known destructive media-file behavior remains.
- [ ] Release Git commit/tag is created only after QA passes.

## Stage completion record

- Completion date: 
- Git commit/tag: 
- Known follow-ups: None

---

# Final Release Gate

StreamLocal v1 is release-ready only after all required Stages are COMPLETE and these project-level checks pass:

- [ ] Windows launcher works on a clean supported Windows installation.
- [ ] Persistent library scan works for MP4 and MKV.
- [ ] Common movies and TV episodes are identified and can be manually corrected.
- [ ] Cached metadata permits offline browsing.
- [ ] Direct MP4 playback and MKV fallback playback work.
- [ ] Multiple audio tracks can be selected where present.
- [ ] External SRT subtitles work.
- [ ] Automatic SRT synchronization works for the defined test sample and falls back safely on failure.
- [ ] Resume and watched-state tracking survive restart.
- [ ] Watched items display a visible checkmark.
- [ ] Continue Watching and Recently Watched update correctly.
- [ ] Series autoplay-next-episode works.
- [ ] Manual Skip Intro / Skip Recap segments work.
- [ ] Search and filters work offline.
- [ ] Timeline preview thumbnails work when generated.
- [ ] Library Management can correct metadata and missing-file issues.
- [ ] User media files are never modified or deleted by normal library-management actions.
- [ ] Logs do not contain API secrets.
- [ ] Local server binds to 127.0.0.1 by default.
- [ ] Automated tests pass.
- [ ] README and installation instructions match the release.
- [ ] Git working tree is clean.





