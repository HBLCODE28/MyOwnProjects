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

**Status:** COMPLETE  
**Depends on:** Stage 4 - Streaming-Style Browse UI

## Goal

Add direct local MP4 playback in the browser and introduce encrypted local API-key storage for future poster/metadata integrations.

## Tasks

- [x] Open local MP4 files directly from File System Access handles.
- [x] Create temporary object URLs without uploading media.
- [x] Add player overlay.
- [x] Add Play/Pause.
- [x] Add seek bar.
- [x] Add -10s / +10s controls.
- [x] Add volume control.
- [x] Add playback speed control.
- [x] Add fullscreen.
- [x] Add keyboard shortcuts: Space/K, J/L, arrows, F, Escape.
- [x] Release object URLs when playback closes.
- [x] Do not offer Stage 5 Play controls for MKV files.
- [x] Keep MKV compatibility explicitly deferred to Stage 6.
- [x] Add encrypted local API-key vault in Settings.
- [x] Derive an AES-256-GCM vault key with PBKDF2/SHA-256.
- [x] Use a unique random IV for every encrypted secret.
- [x] Do not store the vault password.
- [x] Keep the decrypted CryptoKey only in memory while unlocked.
- [x] Support TMDb API Read Access Token.
- [x] Support TMDb API Key.
- [x] Allow Save, Reveal, Delete and Lock.
- [x] Exclude encrypted API credentials from StreamLocal exports.
- [x] Preserve the local encrypted vault when importing a library backup.
- [x] Keep Stage 5 itself free of external metadata requests.

## Required tests / verification

- [x] Encrypted secret is not stored as plaintext.
- [x] Wrong vault password is rejected.
- [x] Vault persists in IndexedDB.
- [x] StreamLocal export excludes the encrypted vault.
- [x] MKV is rejected by Stage 5 playback service.
- [x] Unavailable media is rejected before filesystem access.
- [x] TypeScript typecheck.
- [x] Production static build.
- [x] No backend API dependency.

## Acceptance criteria

- [x] Clicking an available MP4 movie can open the local player.
- [x] Series cards can launch an available MP4 episode.
- [x] Original media is never modified.
- [x] Video bytes are not uploaded.
- [x] Basic player controls work.
- [x] Fullscreen works.
- [x] Playback speed can be changed.
- [x] Keyboard playback shortcuts work.
- [x] API credentials can be encrypted locally with a user vault password.
- [x] Vault password is not persisted.
- [x] Credentials are not exported with library backups.
- [x] Stage 5 does not fetch posters or metadata yet.
- [x] MKV/codec compatibility remains Stage 6.

## Completion record

- Completion date: 2026-08-23
- Git commit/tag: Stage 5 basic MP4 player and encrypted API vault commit
- Known follow-ups: Stage 6 adds MKV/codec compatibility and multi-audio. Poster fetching can later use a vault credential only while the vault is unlocked.

# Stage 6 - MKV and Browser Media Compatibility

**Status:** COMPLETE  
**Depends on:** Stage 5 - Basic MP4 Player

## Goal

Extend the browser-only player from MP4-only playback to direct MP4/MKV playback where the current browser can decode the file, improve codec diagnostics, expose multiple audio tracks when the browser supports the standard API, fix keyboard shortcuts across keyboard layouts, and add an account-free series poster provider.

## Tasks

- [x] Allow direct local MP4 playback.
- [x] Allow direct local MKV/Matroska playback attempts.
- [x] Keep original media unchanged and local.
- [x] Detect browser media errors and show useful codec/container diagnostics.
- [x] Keep object URL cleanup.
- [x] Keep seek, speed, volume and fullscreen controls.
- [x] Fix J/L/F keyboard shortcuts by using physical KeyboardEvent.code.
- [x] Keep fallback KeyboardEvent.key behavior.
- [x] Add automated shortcut tests including non-English key values.
- [x] Detect HTMLMediaElement audioTracks when exposed by the browser.
- [x] Show an Audio selector when multiple tracks are exposed.
- [x] Do not claim audio-track switching when the browser hides that API.
- [x] Add TVmaze as optional online metadata for series.
- [x] TVmaze integration requires no API key/account.
- [x] Send only the series title when the user explicitly starts poster matching.
- [x] Require an exact normalized title match before attaching TVmaze metadata.
- [x] Add TVmaze remote poster fallback for series cards and hero artwork.
- [x] Preserve local artwork as higher priority than remote artwork.
- [x] Rename Settings API vault to generic optional API-key storage.
- [x] Keep encrypted vault credentials out of library exports.
- [x] Keep browser-only architecture with no StreamLocal backend.

## Compatibility notes

- MKV is a container. Whether a particular MKV plays depends on the video/audio codecs inside it and on the codecs enabled by the installed browser/OS.
- StreamLocal does not transcode large video files in Stage 6.
- Multi-audio selection is displayed only when the browser exposes `HTMLMediaElement.audioTracks`.
- Chromium-based browsers can hide `audioTracks`, so some multi-audio files may play only the browser-selected/default track.
- TVmaze poster matching is opt-in and series-only in this stage.

## Required tests / verification

- [x] MP4 and MKV recognized as supported StreamLocal containers.
- [x] Unsupported containers rejected.
- [x] Physical J/L/F shortcuts map correctly even with non-English `event.key`.
- [x] Playback and arrow shortcuts map correctly.
- [x] TVmaze exact normalized matching.
- [x] TVmaze does not guess when exact matching fails.
- [x] TypeScript typecheck.
- [x] Production static build.
- [x] No StreamLocal backend dependency.

## Acceptance criteria

- [x] MP4 cards open the player.
- [x] MKV cards can open the player and attempt native browser playback.
- [x] Unsupported MKV/codec combinations show a useful message instead of silently failing.
- [x] J/L/F work independently of English/Hebrew keyboard layout.
- [x] Fullscreen can be triggered by F.
- [x] Multiple audio tracks are selectable when the browser exposes them.
- [x] Settings can fetch series metadata/posters from TVmaze without an account or API key.
- [x] Wrong/fuzzy TVmaze matches are not automatically accepted.
- [x] Local poster artwork remains preferred over TVmaze artwork.
- [x] Original video files are never modified or uploaded.

## Completion record

- Completion date: 2026-08-23
- Git commit/tag: Stage 6 browser media compatibility commit
- Known limitation: Chromium currently does not reliably expose the standard `audioTracks` API, so full multi-audio selection cannot be guaranteed in a pure browser-only application. Codec support also depends on the installed browser and OS.

# Stage 7 - Series Hub and Hero Consistency

**Status:** COMPLETE  
**Depends on:** Stage 6 - MKV and Browser Media Compatibility

## Goal

Create a Netflix-style series browsing experience without a dedicated detail page, fix mixed Movie/Series hero metadata, and use horizontal series artwork in horizontal cards.

## Tasks

- [x] Fix featured Hero so a single entity supplies title, type, year, overview and artwork.
- [x] Never combine a movie title/type with a series overview.
- [x] Prefer a real series entity for Home featured content when series exist.
- [x] Keep Movies page Hero movie-only.
- [x] Add a Series Hub overlay instead of a dedicated detail page.
- [x] Open Series Hub from Home and Series cards.
- [x] Show series title, year, genres, overview, season count and episode count.
- [x] Add season selector.
- [x] Add episode list ordered by season/episode.
- [x] Show SxxExx labels.
- [x] Show episode title.
- [x] Show episode filename and availability.
- [x] Launch any available MP4/MKV episode from the hub.
- [x] Keep the hub open while returning from player.
- [x] Upgrade TVmaze artwork lookup to use /shows/:id/images.
- [x] Prefer TVmaze `background` artwork for horizontal cards/hero.
- [x] Fall back to TVmaze `banner`, then portrait poster only when needed.
- [x] Use CSS `object-fit: cover` so artwork fills cards without stretching.
- [x] Keep local backdrop/poster higher priority than remote artwork.
- [x] Keep exact series-title matching before attaching remote metadata.
- [x] Preserve Stage 6 J/L/F keyboard-layout fix.

## Acceptance criteria

- [x] Home Hero shows correct title and correct media type from the same entity.
- [x] A series Hero says FEATURED SERIES, not Movie.
- [x] Horizontal Series cards use horizontal TVmaze artwork when available.
- [x] Artwork fills its frame without being squeezed or distorted.
- [x] Clicking a series opens its Series Hub.
- [x] User can choose a season.
- [x] User can see and select individual episodes.
- [x] Play opens the chosen local episode.
- [x] No dedicated series route/page is required.
- [x] Original video files remain local and untouched.

## Completion record

- Completion date: 2026-08-23
- Git commit/tag: Stage 7 series hub and hero consistency commit
- Known follow-ups: episode-specific remote thumbnails and movie metadata/artwork provider can be added later.

# Stage 8 - Continue Watching, Movie Artwork and Unified Navigation

**Status:** COMPLETE  
**Depends on:** Stage 7 - Series Hub and Hero Consistency

## Goal

Make StreamLocal behave more like a real streaming library: persist playback position and watched state, add Continue Watching, add account-free movie artwork, and unify Series Hub navigation with the main application navigation.

## Tasks

- [x] Add IndexedDB playback progress records.
- [x] Upgrade StreamLocal IndexedDB schema without deleting the existing library.
- [x] Save playback position while a video is playing.
- [x] Save playback position on pause and player close.
- [x] Resume unfinished playback automatically.
- [x] Mark movies watched at >=90% or <=5 minutes remaining.
- [x] Mark episodes watched at >=90% or <=2 minutes remaining.
- [x] Add Continue Watching to Home.
- [x] Add progress bars to movie/continue-watching cards.
- [x] Add Watched badge.
- [x] Include playback progress in StreamLocal library backups.
- [x] Keep encrypted API-key vault excluded from exports.
- [x] Add Wikipedia as optional movie artwork provider.
- [x] Wikipedia provider requires no StreamLocal account or API key.
- [x] Send only movie title/year when movie artwork lookup is explicitly requested.
- [x] Prefer year-specific Wikipedia film pages.
- [x] Use Wikipedia lead image as remote movie poster when available.
- [x] Keep local artwork higher priority than Wikipedia artwork.
- [x] Show Wikipedia movie artwork in movie cards.
- [x] Avoid aggressive poster crop in Movie Hero when only portrait art is available.
- [x] Redesign the StreamLocal navigation bar to match the site aesthetic.
- [x] Keep the main navigation visible while Series Hub is open.
- [x] Remove the second text-style Close navigation bar from Series Hub.
- [x] Use one compact close button inside the Series Hub content.
- [x] Position Series Hub below the main navigation bar.
- [x] Use non-destructive contain behavior for Series Hub hero art to prevent extreme zoom/cropping.
- [x] Preserve Stage 6 J/L/F keyboard-layout fix.
- [x] Preserve Stage 7 seasons/episodes Series Hub.

## Privacy / online behavior

- TVmaze remains opt-in for series metadata/artwork.
- Wikipedia movie lookup is opt-in.
- No local video bytes, local filesystem paths, watch history or API-vault values are sent to either provider.
- Wikimedia Action API requests use anonymous cross-origin access.
- StreamLocal still has no application backend.

## Required tests / verification

- [x] Movie watched threshold.
- [x] Episode watched threshold.
- [x] Early playback remains unwatched.
- [x] Wikipedia year-specific film matching.
- [x] Wikipedia missing-page behavior.
- [x] Existing unit tests.
- [x] TypeScript typecheck.
- [x] Production static build.
- [x] Browser-only runtime verification.

## Acceptance criteria

- [x] Closing an unfinished video stores its position.
- [x] Opening it again resumes from the stored position.
- [x] Home shows Continue Watching after meaningful playback.
- [x] Watched thresholds follow StreamLocal rules.
- [x] Movies can receive posters without requiring a personal account/API key.
- [x] Series Hub no longer looks like it has a second navigation bar.
- [x] Main StreamLocal navigation remains visually consistent.
- [x] Series Hub artwork is not forcibly zoomed/cropped when its source framing is unsuitable.
- [x] Original media files remain untouched.

## Completion record

- Completion date: 2026-08-23
- Git commit/tag: Stage 8 continue watching, movie artwork and navigation commit
- Known limitation: Wikipedia does not guarantee that every film article has a usable lead poster image. Missing movie artwork can still be supplied locally or manually.

# Stage 9 - Episode Viewing State, Immersive Player and Artwork Reliability

**Status:** COMPLETE  
**Depends on:** Stage 8 - Continue Watching, Movie Artwork and Unified Navigation

## Goal

Polish local viewing state and playback UX: distinguish an episode that the user opened from one that is fully watched, make the non-fullscreen player truly immersive, refine Series Hub information layout, make the main navigation feel native to StreamLocal, and make movie-poster lookup report only real artwork updates.

## Tasks

- [x] Add local `started` state to playback progress.
- [x] Add local `firstPlayedAt` timestamp.
- [x] Mark an episode/movie Started as soon as the local player opens.
- [x] Keep Started separate from Watched.
- [x] Keep existing Watched thresholds:
  - Movie: >=90% OR <=5 minutes remaining.
  - Episode: >=90% OR <=2 minutes remaining.
- [x] Show Started badge in Series Hub.
- [x] Show Watched badge in Series Hub.
- [x] Show Resume for started unfinished episodes.
- [x] Show Play again for watched episodes.
- [x] Show episode progress bar.
- [x] Keep viewing state in IndexedDB only.
- [x] Update Series Hub from fresh browse data after player state changes.
- [x] Move EPISODES label next to Season heading.
- [x] Remove player top navigation/header.
- [x] Hide StreamLocal main navbar while PlayerOverlay is open.
- [x] Make PlayerOverlay cover the complete viewport above all application UI.
- [x] Keep a floating Close button permanently visible in non-fullscreen playback.
- [x] Keep playback controls and title inside the player only.
- [x] Preserve keyboard shortcuts and fullscreen.
- [x] Restyle main StreamLocal navigation with stronger application-specific styling.
- [x] Keep Series Hub below the main navbar when not playing.
- [x] Change Wikipedia artwork accounting:
  - Matched page is not the same as saved poster.
  - Count a poster update only when a real image URL is returned.
- [x] Prefer Wikipedia's generated thumbnail over very large/unusual originals.
- [x] Show separate counts for page match, poster saved, page without image, no page and failure.
- [x] Keep local movie artwork higher priority than Wikipedia artwork.

## Privacy

- Started/Watched/progress/history stay in local IndexedDB.
- They are not sent to TVmaze or Wikipedia.
- Video files and filesystem paths are never uploaded.
- Wikipedia requests still contain only movie title/year when explicitly requested.

## Required tests / verification

- [x] Opening an episode records Started without marking it Watched.
- [x] Existing movie watched thresholds.
- [x] Existing episode watched thresholds.
- [x] Wikipedia year-specific matching.
- [x] Wikipedia thumbnail preference.
- [x] Wikipedia missing-page behavior.
- [x] Existing keyboard shortcut tests.
- [x] TypeScript typecheck.
- [x] Production static build.
- [x] Browser-only runtime verification.

## Acceptance criteria

- [x] Player hides site navigation while playing.
- [x] Close is always visible when not fullscreen.
- [x] Closing early still marks an episode Started.
- [x] Closing early does not incorrectly mark an episode Watched.
- [x] Series Hub visually distinguishes Started and Watched.
- [x] EPISODES appears beside the selected season heading.
- [x] Main navbar uses StreamLocal-specific styling.
- [x] Wikipedia does not claim a poster was updated when no image was saved.
- [x] Movie cards can display a newly saved Wikipedia image after reloading browse data.
- [x] Original media remains untouched.

## Completion record

- Completion date: 2026-08-23
- Git commit/tag: Stage 9 immersive player and viewing state commit
- Known limitation: Wikipedia is a fallback artwork source, not a dedicated movie-poster database, so some movies will correctly report "Matching page without image".

# Stage 10 - Centered Player, Reliable Movie Posters and 20-Minute Test Media

**Status:** COMPLETE  
**Depends on:** Stage 9 - Episode Viewing State, Immersive Player and Artwork Reliability

## Goal

Polish the immersive player layout, improve the probability of finding movie posters without requiring personal registration, and provide reproducible 20-minute local MP4 fixtures for real playback/progress testing.

## Tasks

- [x] Center the video relative to the full player viewport.
- [x] Stop the bottom controls from pushing the video upward.
- [x] Convert player controls to a fixed bottom overlay.
- [x] Keep the video centered horizontally and vertically.
- [x] Keep floating Close visible above video and controls.
- [x] Keep the StreamLocal navbar hidden during actual playback.
- [x] Preserve Fullscreen, J/L/F and all existing player controls.
- [x] Add a multi-provider movie-poster lookup.
- [x] Query The Preservation Network / Movie Posters Database public basic search first.
- [x] Fall back to Wikipedia when the poster database does not yield a confident image.
- [x] Match poster-database results against movie title and year before accepting.
- [x] Continue to prefer local artwork over all remote artwork.
- [x] Replace the old Wikipedia-only Settings action with one `Find movie posters` action.
- [x] Add automated poster matching tests.
- [x] Add `scripts/download-test-media.ps1`.
- [x] Download an open H.264 Big Buck Bunny engineering sample only when the user runs the test-media helper.
- [x] Create two exact 20:00 MP4 test files using FFmpeg stream looping/remuxing.
- [x] Create one movie filename and one S01E01 episode filename.
- [x] Keep generated test videos outside Git.
- [x] Document the test-media workflow.

## Test media

The helper creates:

- `test-media/StreamLocal.Test.Movie.2026.mp4`
- `test-media/StreamLocal.Test.Show.S01E01.mp4`

Both are exactly 20 minutes and are intended for local StreamLocal testing.

## Privacy / networking

- Movie artwork requests contain title/year only.
- Test media is downloaded only when the user explicitly runs the helper.
- No video playback data is uploaded.
- No StreamLocal backend is introduced.

## Required tests / verification

- [x] Exact title/year poster result accepted.
- [x] Wrong-title poster result rejected.
- [x] Existing Wikipedia fallback tests.
- [x] Existing playback state tests.
- [x] Existing keyboard shortcut tests.
- [x] TypeScript typecheck.
- [x] Production static build.
- [x] Browser-only runtime verification.

## Acceptance criteria

- [x] Non-fullscreen video appears visually centered in the player viewport.
- [x] Controls remain at the bottom without shrinking the stage into a top-heavy layout.
- [x] Close remains accessible.
- [x] Settings has one movie-poster lookup that uses more than Wikipedia alone.
- [x] A poster is not accepted from a clearly different movie.
- [x] User can generate real 20-minute MP4 movie/episode test fixtures locally.
- [x] Generated test media is never staged or committed.

## Completion record

- Completion date: 2026-08-23
- Git commit/tag: Stage 10 centered player, movie posters and test media commit
- Known limitation: public poster services can still have gaps, rate limits or CORS/availability changes. Local artwork remains the deterministic fallback.

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











