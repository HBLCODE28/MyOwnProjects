# StreamLocal - Codex Handoff Document

Last updated: 2026-08-25
Project owner environment: Linux development checkout; the original media may still be on Windows
Primary browser target: current Chromium-based Chrome/Chromium

> This document is the current handoff. The sections near the end override older
> stage notes when they describe newer behavior or requirements.

---

# 1. Project Summary

StreamLocal is a Windows-oriented, browser-based local media library and player.

The project started as a FastAPI/Python + React application, but it was intentionally migrated to a browser-only architecture.

The current intended runtime architecture is:

- React + TypeScript
- Vite
- HashRouter
- IndexedDB via Dexie
- File System Access API
- Web Crypto
- Static PWA/browser app
- No application backend
- No SQLite runtime database
- No Python runtime
- No required cloud account
- No required metadata API key
- Node/Vite are development/build tools only

The user should be able to copy the static application to another PC, import StreamLocal metadata, reconnect local folders, and continue using the application.

The original media files must NEVER be modified or deleted by StreamLocal.

---

# 2. Repository Layout

Git repository root on the current Linux machine:

```text
/home/magshimim/Documents/Projects
```

StreamLocal project:

```text
/home/magshimim/Documents/Projects/streamlocal
```

Important detail:

`.git` is in the parent `Projects` directory, NOT inside `streamlocal`.

Scripts must stage/check only the StreamLocal project path and must avoid unrelated files from the parent repository.

Git fallback path used by scripts:

```text
C:\Program Files\Git\cmd\git.exe
```

The project is currently being developed with Bash/Linux. The old PowerShell notes
below are historical and apply only when working from the Windows checkout.

PowerShell version (historical Windows checkout):

```text
Windows PowerShell 5.1
```

PowerShell 5.1 does not have:

```text
[System.IO.Path]::GetRelativePath()
```

Existing stage scripts use a URI-based compatibility helper instead.

---

# 3. Product Requirements

## Local library

Supported media discovery:

- MP4
- MKV

Library is persistent in IndexedDB.

Sources are selected with the File System Access API.

Sources are read-only.

Recursive scanning is supported.

The app must NEVER:

- delete the user's actual video file
- rename the user's actual video file
- modify the user's actual video file
- upload local video bytes

## Media recognition

Filename/folder parsing examples:

```text
Dune.Part.Two.2024.2160p.WEB-DL.mkv
Severance.S02E03.1080p.WEBRip.mkv
Show.Name.1x07.mkv
Series/Season 02/S02E03.mkv
```

Known noise terms cleaned by parser include:

```text
2160p
1080p
720p
WEB-DL
WEBRip
BluRay
REMUX
HDR
DV
x264
x265
H264
H265
HEVC
AAC
AC3
EAC3
DTS
TrueHD
Atmos
10bit
```

Recognition confidence:

- high
- medium
- low

Low confidence can become:

```text
Needs Match
```

Manual metadata must NEVER be silently overwritten.

There is a:

```text
Reset to automatic
```

action.

## Series organization

Series structure is represented by:

- `Series`
- `MediaItem.seriesId`
- `MediaItem.seasonNumber`
- `MediaItem.episodeNumber`

There are not currently separate Season/Episode database tables.

## Artwork

Local artwork has highest priority.

Recognized local names include:

Posters:

```text
poster.jpg
poster.jpeg
poster.png
poster.webp
folder.jpg
cover.jpg
```

Backdrops:

```text
backdrop.jpg
backdrop.jpeg
backdrop.png
backdrop.webp
fanart.jpg
background.jpg
```

Local sidecar metadata:

```text
basename.json
movie.json
episode.json
basename.nfo
movie.nfo
tvshow.nfo
```

Priority concept:

```text
manual metadata
>
local sidecar metadata
>
filename/folder parser
>
optional online metadata
```

---

# 4. Browser-Only Architecture

Database:

```text
IndexedDB
```

Library database name:

```text
StreamLocal
```

Dexie database stores currently include:

```text
librarySources
mediaFiles
mediaItems
series
artwork
settings
playbackProgress
```

Important File System Access behavior:

- FileSystemDirectoryHandle may be stored in IndexedDB when supported.
- After backup/import on another computer, handles are intentionally removed.
- User must reconnect folders manually.

The app should run from a stable secure origin.

Development:

```text
http://127.0.0.1:5173
```

Production should preferably be:

- HTTPS static host
- installed PWA

Avoid relying on direct `file://`.

---

# 5. Main Data Models

Current conceptual models:

## LibrarySource

```ts
{
  id
  name
  createdAt
  lastScanAt
  enabled
  recursive
  handle
}
```

## MediaFile

```ts
{
  id
  sourceId
  relativePath
  fileName
  extension
  size
  lastModified
  fingerprint
  available
  lastSeenAt
}
```

## MediaItem

```ts
{
  id
  mediaFileId
  type
  title
  year
  overview
  genres
  seriesId
  seasonNumber
  episodeNumber
  episodeTitle
  confidence
  matchStatus
  manuallyEdited
  posterArtworkId
  backdropArtworkId

  // Stage 8+
  remotePosterUrl?
  remoteBackdropUrl?
  metadataProvider?
  providerId?

  createdAt
  updatedAt
}
```

## Series

```ts
{
  id
  normalizedTitle
  title
  year
  overview
  genres
  posterArtworkId
  backdropArtworkId

  remotePosterUrl?
  remoteBackdropUrl?
  metadataProvider?
  providerId?

  createdAt
  updatedAt
}
```

## PlaybackProgress

Current intended model:

```ts
{
  mediaItemId
  positionSeconds
  durationSeconds
  percent

  // Stage 9
  started
  firstPlayedAt

  watched
  lastPlayedAt
  completedAt
}
```

---

# 6. Watched Rules

Authoritative StreamLocal watched state is based on StreamLocal playback.

Movie is watched when:

```text
>= 90%
OR
<= 5 minutes remaining
```

Episode is watched when:

```text
>= 90%
OR
<= 2 minutes remaining
```

Stage 9 added a separate state:

```text
Started
```

This means:

- user opened the media in StreamLocal
- Started is NOT equivalent to Watched

Expected labels:

```text
Play
Resume
Play again
Started
Watched
```

Continue Watching should include meaningful unfinished playback.

---

# 7. Current UI Philosophy

Visual style:

- dark
- premium streaming UI
- original design
- similar usability concepts to Netflix/Plex/etc.
- do not clone another service exactly

UI language:

```text
English
```

Home slogan:

```text
Your local player.
```

No user profiles.

No login.

No mobile target.

No Cast requirement.

No drag/drop requirement.

Series details should NOT use a dedicated page.

Use an overlay/hub.

---

# 8. Navigation

Current primary routes:

```text
/
#/movies
#/series
#/identify
#/library
#/settings
```

Navigation component:

```text
frontend/src/components/layout/AppShell.tsx
```

Current desired behavior:

- main StreamLocal navbar visible on normal pages
- main navbar visible while Series Hub is open
- main navbar hidden while actual video playback is open
- player should be visually isolated from application navigation

---

# 9. Series Hub

Implemented during Stage 7 and refined afterward.

Component:

```text
frontend/src/components/browse/SeriesHubOverlay.tsx
```

The Series Hub should contain:

- series title
- year
- genres
- overview
- season count
- episode count
- season selector
- episodes list
- SxxExx
- episode title
- filename
- available/unavailable
- local playback button
- Started/Watched state
- progress bar

Current preferred heading layout:

```text
Season 1   EPISODES
```

The user explicitly requested `EPISODES` to be next to the season title.

Do NOT reintroduce a second navigation bar inside the hub.

Use one compact close button inside the hub.

---

# 10. Player

Component:

```text
frontend/src/components/player/PlayerOverlay.tsx
```

Supported local containers:

```text
MP4
MKV
```

Important limitation:

MKV is only a container.

Actual playback depends on browser/OS codec support.

The current pure browser approach:

- opens original File
- creates Object URL
- browser plays directly
- no transcoding
- no upload
- no modification

## Player controls

Implemented:

- Play/Pause
- seek
- -10 seconds
- +10 seconds
- volume
- playback speed
- fullscreen
- audio selector if browser exposes audioTracks
- Close

## Keyboard shortcuts

Important fix:

Use `KeyboardEvent.code`, not only `KeyboardEvent.key`.

Required mappings:

```text
Space / K -> Play/Pause
ArrowLeft -> -5s
ArrowRight -> +5s
J -> -10s
L -> +10s
F -> Fullscreen
Escape -> close when not fullscreen
```

This must continue to work when Windows keyboard layout is Hebrew.

Automated tests exist for Hebrew/non-English key values with physical `KeyJ`, `KeyL`, `KeyF`.

## Current player layout goal

The user complained that video was visually too high.

Stage 10 intended layout:

- player covers full viewport
- site navbar hidden
- floating X in upper-right
- video centered horizontally AND vertically
- controls fixed/overlayed at bottom
- controls should not push the video upward

Relevant CSS:

```text
frontend/src/styles/player.css
```

---

# 11. Metadata Providers

## TVmaze

Used for series.

No API key/account required.

User explicitly preferred this over TMDb because TMDb requested personal details.

Current behavior:

- user manually presses a Settings action
- query sends series title
- exact normalized title match required
- stores:
  - year if missing
  - concise overview / summary
  - genres if missing
  - provider id
  - portrait poster
  - horizontal backdrop/background when available

TVmaze image endpoint was added to prefer:

```text
background
then banner
then poster
```

Horizontal series cards should use:

```text
background / banner
```

not portrait poster when possible.

Local artwork always wins.

## Wikipedia movie posters

Was attempted first.

Problem observed by user:

```text
Checked 27
Matched pages 4
Posters saved 0
Matching page without image 4
No page 23
Failed 0
```

Conclusion:

Wikipedia is a weak movie-poster provider.

It remains useful as fallback metadata only.

## Movie Posters Database / Preservation Network

Stage 10 added a second movie poster provider concept.

Service:

```text
frontend/src/services/moviePosterProvider.ts
```

Intended flow:

```text
Poster DB
-> fallback Wikipedia
```

Current Settings action:

```text
Find movie posters
```

Important:

The current parser for the public poster DB is deliberately generic because public JSON shape may differ.

If this provider still fails in real usage, Codex should inspect the live API response and adjust parsing rather than claiming success.

Do not count:

```text
matched page
```

as:

```text
poster saved
```

unless an actual usable image URL was stored.

---

# 12. Plot / Overview Requirement

The user explicitly dislikes long descriptions containing production trivia.

Desired overview:

- plot-focused
- concise
- about the story
- no behind-the-scenes information

Do NOT prioritize sentences like:

```text
Directed by...
Written by...
Produced by...
Starring...
Released in...
Filming took place...
Box office...
Critical reception...
Awards...
Created by...
Developed by...
```

Stage 11 plot-summary work is complete.

A helper was being created:

```text
frontend/src/services/plotSummary.ts
```

Desired function:

```ts
concisePlotSummary(text, maxCharacters = ~420)
```

It should:

- strip HTML
- split sentences
- remove production/background sentences
- keep first 2-3 useful plot sentences
- cap total length

Implemented in `frontend/src/services/plotSummary.ts` and applied only when
an automatic provider is filling an empty overview. Manual metadata remains
authoritative.

---

# 13. Library Cleanup Requirement - Completed

User requested a button in Library that removes all entries marked:

```text
Unavailable
```

Important:

This must remove ONLY StreamLocal database records.

It must NEVER delete actual video files.

Recommended behavior:

```text
Library
-> Remove unavailable entries
```

Before delete:

- show confirmation
- show number of unavailable records

Suggested cleanup:

1. find `mediaFiles` where `available === false`
2. collect `MediaItem` rows linked to those files
3. delete playbackProgress for deleted media items
4. delete mediaItems
5. delete mediaFiles
6. optionally clean Series rows that now have zero episodes
7. optionally clean unreferenced artwork

Original files must not be touched.

Implemented in `frontend/src/services/libraryCleanup.ts` and exposed in the
Library page as `Remove unavailable entries`. The operation deletes only
IndexedDB records and removes orphaned metadata/artwork; it never accesses or
deletes original media files.

---

# 14. Movie Resume Bug - Verified

User reported:

```text
Series resume works.
Movies do not remember where playback stopped.
```

Likely cause to inspect:

Movie watched logic:

```text
movie is watched if <= 5 minutes remaining
```

This causes short test videos to become Watched immediately or very early.

For example, a 4-minute test movie always satisfies:

```text
remaining <= 5 minutes
```

Therefore resume is intentionally skipped because it appears Watched.

This is NOT a useful test fixture for movie resume.

Stage 10 added a 20-minute test-media helper for this reason.

The resume path was verified with an unfinished 20-minute-equivalent movie
fixture in the playback-progress tests. The reported short test-video issue
is explained by the existing `<= 5 minutes remaining` watched rule; the
authoritative threshold was not changed. Browser playback with a real local
file should still be manually smoke-tested on Windows.

Do not change the authoritative watched threshold unless the user asks.

---

# 15. 20-Minute Test Media

Stage 10 introduced:

```text
scripts/download-test-media.ps1
```

Goal:

create two exact 20-minute local MP4 files:

```text
test-media\StreamLocal.Test.Movie.2026.mp4
test-media\StreamLocal.Test.Show.S01E01.mp4
```

Intended use:

- Movie resume
- Episode resume
- Continue Watching
- Started
- Watched threshold
- scanner recognition
- MP4 playback

The helper downloads Big Buck Bunny and loops/remuxes it with FFmpeg.

FFmpeg is ONLY for generating developer test media.

StreamLocal itself remains browser-only at runtime.

Generated MP4 files must NEVER be committed.

Stage scripts reject:

```text
test-media/
*.mp4
*.mkv
```

from Git staging.

---

# 16. Backup / Import

Backup file naming:

```text
StreamLocal-Backup-YYYY-MM-DD.zip
```

Backup includes:

- library sources without filesystem handles
- media files
- media items
- series
- local artwork
- settings except private vault
- playback progress

Backup excludes:

- video files
- filesystem handles
- encrypted API vault

On import:

- source handles become null
- sources disabled/reconnect required
- media availability false until reconnected/scanned
- private local encrypted vault should be preserved if present

---

# 17. Encrypted API Vault

Implemented in Settings.

Service:

```text
frontend/src/services/secretVault.ts
```

Storage:

```text
IndexedDB
```

Encryption:

```text
PBKDF2 SHA-256
AES-256-GCM
```

Vault password:

- NOT stored
- used to derive CryptoKey
- key lives only in memory while unlocked

Important:

This is protection at rest.

A browser application cannot keep an API credential completely secret while actively using it.

Vault credentials are intentionally excluded from backup export.

The vault is now generic, not TMDb-specific.

Possible slots:

```text
customMetadataApiKey
customPosterApiKey
```

---

# 18. Persistent Browser Storage

`navigator.storage.persist()` is optional.

If Chromium returns false, do NOT show this as an application failure.

Desired message:

```text
Browser storage is active.

StreamLocal data is stored locally in IndexedDB, but the browser did not mark
it as protected from automatic cleanup.

Use Export Library for important backups.
```

IndexedDB still works when persist returns false.

---

# 19. Fingerprinting

Local file fingerprint:

```text
size
+
SHA-256(first 1 MiB)
+
SHA-256(last 1 MiB)
```

Implemented using Web Crypto.

Purpose:

- stable local identity
- detect moved/renamed file
- avoid hashing full huge media files

Scanner skips fingerprint recomputation if:

```text
path + size + lastModified
```

did not change.

---

# 20. Important Known Bug / Design Issue

Automatic artwork attachment previously called a function that sets:

```text
manuallyEdited = true
```

Potential effect:

automatic artwork can accidentally freeze future automatic metadata updates.

If still present, fix by making artwork attachment configurable:

```ts
attachArtworkToItem(
  itemId,
  artworkId,
  kind,
  markManual = true
)
```

Automatic artwork detection should call with:

```ts
markManual = false
```

Manual user-selected artwork should call with:

```ts
markManual = true
```

This should be audited.

---

# 21. Stage History

## Stage 0
Repository baseline.

Commit:

```text
Stage 0: repository baseline
```

## Stage 1
Initial foundation.

Originally FastAPI + React.

Commit:

```text
Stage 1: foundation
```

Backend architecture is obsolete after browser-only migration.

## Stage 2
Persistent media library.

Originally backend/SQLite based.

Completed before architecture pivot.

Commit:

```text
Stage 2: persistent media library
```

## Stage 3
Browser-only media recognition.

Major migration:

- removed backend runtime
- IndexedDB
- File System Access
- local parser
- local artwork
- local sidecars
- backup/import
- PWA

Commit:

```text
Stage 3: browser-only media recognition
```

## Stage 4
Streaming-style browse UI.

Added:

- Home browse
- Movies
- Series
- search
- hero
- cards
- counters

Commit:

```text
Stage 4: streaming browse UI
```

## Stage 5
Basic MP4 player + encrypted API vault.

Commit:

```text
Stage 5: basic MP4 player and encrypted API vault
```

## Stage 6
Browser media compatibility.

Added:

- MP4 + MKV native attempt
- codec errors
- J/L/F physical-key fix
- browser audioTracks selector when exposed
- TVmaze series metadata/posters

Commit:

```text
Stage 6: browser media compatibility
```

## Stage 7
Series Hub and hero consistency.

Added:

- series overlay
- seasons
- episodes
- corrected Hero type/title mixing
- horizontal TVmaze backgrounds

Commit:

```text
Stage 7: series hub and hero consistency
```

## Stage 8
Continue Watching + movie artwork + unified navigation.

Added:

- playback progress
- watched thresholds
- Continue Watching
- progress bars
- Wikipedia movie artwork attempt
- navbar redesign
- Series Hub nav cleanup

Commit:

```text
Stage 8: continue watching movie artwork and navigation
```

## Stage 9
Immersive player + viewing state.

Added:

- Started vs Watched
- episode state in Series Hub
- hidden navbar while player open
- floating player close
- Wikipedia poster reporting fix

Commit:

```text
Stage 9: immersive player and viewing state
```

## Stage 10
Centered player + movie poster provider + 20-minute test media.

Added:

- centered player layout
- fixed bottom controls
- public poster DB attempt
- Wikipedia fallback
- 20-minute test-media helper

Commit:

```text
Stage 10: centered player movie posters and test media
```

## Stage 11
NOT completed yet.

User requested:

1. better movie poster source if Stage 10 provider still fails
2. Library button to remove all unavailable DB entries
3. verify/fix movie resume
4. concise plot-only summaries for movies and series
5. preserve local viewing history
6. potentially infer pre-StreamLocal history, but user clarified this is only approximate

Do NOT mark Stage 11 complete until implemented and tested.

---

# 22. Stage Apply Script Pattern

Every stage generally has:

```text
stageN-browser-apply.ps1
STAGEN_BLOCK.md
STAGEN_INSTALL.txt
```

Apply script pattern:

1. verify previous stage COMPLETE in `STAGES.md`
2. verify required files exist
3. run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
```

4. verify production build:

```text
frontend\dist\index.html
```

5. reject backend runtime references:

```text
127.0.0.1:4310
localhost:4310
/api/v1/
```

6. replace current stage block in `STAGES.md`
7. stage ONLY StreamLocal project
8. reject runtime/private files
9. commit exact stage commit message
10. require clean StreamLocal working tree

---

# 23. Test Script

Main test command:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
```

It runs approximately:

```text
npm test
npm run typecheck
npm run build
```

Frontend directory:

```text
frontend
```

Useful direct commands:

```powershell
cd frontend
npm test
npm run typecheck
npm run build
npm run dev
```

---

# 24. Existing Tests

Known test areas:

```text
filenameParser.test.ts
recognition.test.ts
backup.test.ts
browseSelectors.test.ts
secretVault.test.ts
localPlayback.test.ts
playerShortcuts.test.ts
tvmazeProvider.test.ts
wikipediaMovieProvider.test.ts
moviePosterProvider.test.ts
playbackProgress.test.ts
plotSummary.test.ts (Stage 11 WIP)
```

When fixing a bug:

- add or update a unit test if possible
- do not only patch UI behavior

---

# 25. User Preferences / Communication

The user mainly communicates in Hebrew.

Preferred assistant style:

- direct
- technical
- implementation focused
- minimal filler
- no emojis

The user prefers:

```text
"
```

rather than typographic quotes.

Prefer normal hyphens.

Do not over-explain basic concepts unless necessary.

When providing fixes, small ZIP replacement packages were commonly used.

The user generally extracts ZIP into:

```text
C:\Users\Cyber_User\Documents\Projects\streamlocal
```

with:

```text
Replace / Merge
```

Then runs a stage apply script.

---

# 26. User Expectations for Safety

Always preserve:

- original media files
- local-only playback history
- user privacy
- no hidden upload
- no destructive file operations

Any "delete" feature should mean:

```text
delete StreamLocal database record
```

unless the user explicitly asks to delete an actual file.

For the requested Unavailable cleanup button:

DO NOT delete actual media files.

---

# 27. Pre-StreamLocal Viewing History Idea

The user asked whether StreamLocal can infer what they watched before installing StreamLocal.

Important technical limitation:

Browser File System Access does NOT provide a reliable last-opened/last-accessed history.

`lastModified` is NOT watch history.

Possible states:

```text
Unseen
Started
Watched
Previously watched?   // heuristic only
```

Do NOT automatically mark real Watched based only on file timestamps.

A better future approach could import history from players such as VLC if available.

Examples:

- VLC recent media
- VLC resume positions
- VLC config/history

This would be much more reliable than filesystem timestamps.

No pre-StreamLocal inference has been implemented yet.

---

# 28. Immediate Next Work for Codex - Stage 11

Recommended implementation order:

## 1. Verify current branch/build

Run:

```powershell
git status
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
```

Confirm Stage 10 is actually committed/clean before Stage 11.

## 2. Audit movie poster provider

The user still wants reliable movie posters.

If Stage 10 provider returns zero posters:

- inspect actual public provider response
- fix parser
- do not guess fields
- keep title/year validation
- keep Wikipedia as fallback
- consider adding another account-free source only if licensing/CORS are acceptable

## 3. Add Remove Unavailable button - COMPLETE

In Library UI:

```text
Remove unavailable entries
```

Database-only cleanup.

Add tests.

## 4. Verify movie resume using 20-minute fixture - COMPLETE IN UNIT TESTS

Use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\download-test-media.ps1
```

Add folder to library.

Play movie for ~1 minute.

Close.

Reopen.

Confirm resume.

If movie resume works with 20-minute fixture, document that the old 4-minute test was immediately Watched due to the <=5 minute movie threshold.

If it still fails, fix player/progress logic.

## 5. Finish concise plot summaries - COMPLETE

Use:

```text
plotSummary.ts
```

Apply to:

- TVmaze series summary
- movie provider summary
- display fallback

Do not overwrite user manual overview.

Do not overwrite local sidecar overview unless intended by priority rules.

## 6. Keep Started/Watched local - COMPLETE

Playback state remains IndexedDB only.

Do not send to metadata providers.

## 7. Consider previous-history import later

Do not implement a fake watch history based only on `lastModified`.

---

# 29. Critical Do-Not-Do List

Do NOT:

- restore FastAPI runtime
- restore SQLite runtime
- require a server for normal use
- require TMDb
- require personal registration for basic posters if avoidable
- upload local video
- modify original media
- delete original media from an Unavailable cleanup
- overwrite manual metadata silently
- commit `node_modules`
- commit `frontend/dist`
- commit test MP4/MKV files
- commit `.env`
- claim a poster was saved when only a metadata page matched
- use `event.key` alone for J/L/F shortcuts
- mark short movie resume bugs without considering the 5-minute remaining watched rule

---

# 30. Useful Commands

Run development server:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Run full verification:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
```

Generate 20-minute test media:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\download-test-media.ps1
```

Check Git:

```powershell
git status
git log --oneline -15
```

---

# 31. Final Product Direction

StreamLocal should eventually feel like:

- a private local Netflix/Plex-style library
- simple to install
- no server configuration
- no account
- persistent local history
- rich series navigation
- local + optional online artwork
- portable library metadata
- reliable local playback
- excellent keyboard behavior
- strong privacy

The current project is not complete.

Stage 10 is the last stage intended as completed.

Stage 11 is the next implementation stage.

Before making major architectural changes, preserve the browser-only requirement unless the project owner explicitly changes that decision.

---

# 32. Latest User Requirements and Unresolved Logo Bug

This section is the most important current handoff for the next AI assistant.
The user explicitly asked that it be written down so it can be sent to ChatGPT.

## The exact unresolved problem

Some title logos are still wrong in two ways:

1. A logo that is effectively 100% black is displayed on the dark StreamLocal
   interface and therefore cannot be seen.
2. When a real logo is missing, a poster/cover/frame from the video is sometimes
   being used where the title logo should be. The user does NOT want a cover,
   poster, thumbnail, first video frame, or generic artwork to be treated as a
   logo.

The expected behavior is:

- If a valid logo exists, show the logo.
- If the selected logo is truly black or nearly all black, search for another
  logo for the same exact movie/series.
- Prefer a different color variant of the same logo, such as white, light,
  transparent, or an alternate Fanart/Wikimedia logo.
- Validate the replacement by inspecting its rendered pixels, not only its
  filename. Do not accept a replacement if it is also effectively black.
- Never use a poster, cover, backdrop, screenshot, season image, DVD cover,
  video frame, or generic banner as a logo.
- If no valid logo is found, display the normal text title. Do not display a
  cover in the title-logo slot.
- A white background must be used only when it is genuinely needed to make a
  black logo visible. Do not put a white background behind a normal white or
  colored logo. In particular, Stranger Things and similar normal logos must
  not receive an unnecessary white rectangle.
- Local logo artwork has priority, but it must pass the same validation. A
  locally stored black logo must not silently become an invisible title.

## Required logo validation strategy

The next implementation should make logo selection explicit rather than
depending only on one `onLoad` fallback:

1. Collect candidates from Fanart.tv and Wikimedia Commons for the exact title.
2. Reject candidates whose names or metadata suggest:

```text
poster, cover, backdrop, background, screenshot, season, episode, dvd,
thumbnail, frame, fanart
```

3. Render/test the candidate image using a canvas with transparency handled
   correctly. Measure the visible pixels, luminance, contrast, and image shape.
4. Treat a candidate as unusably black only when the visible artwork itself is
   overwhelmingly black; do not classify a transparent logo as black because
   transparent pixels were counted as black.
5. If unusably black, try another same-title candidate. Prefer an alternate
   color variant and verify that the replacement is not black.
6. If all candidates fail, render the text title rather than a poster/cover.

The user specifically wants the system to find another logo of the same series
or movie, or the same logo in another color, not merely add a white background
to every dark image.

## One-button artwork behavior

Settings should have one clearly visible action, for example:

```text
Find all artwork
```

That one action must run the complete artwork pipeline:

- movie poster lookup
- series poster lookup
- movie and series backdrop lookup
- movie and series logo lookup
- Fanart.tv lookup when its key is available
- Wikimedia fallback when appropriate
- validation/rejection of black logos and cover-as-logo results

The result must report separate counts for posters, backdrops, valid logos,
rejected logos, missing artwork, and provider failures. It must not claim that
a logo was found when it only found a poster.

## API key UI behavior

The encrypted vault currently supports:

```text
openSubtitlesApiKey
fanartApiKey
customMetadataApiKey
customPosterApiKey
```

The UI requirement is:

- API fields that have not been saved should not be shown as full credential
  forms.
- Provide a compact `Add API key` control for adding a new provider field.
- Once saved, show that provider's field and allow reveal, replacement, or
  deletion.
- Never print or commit API keys.

If the app reports that Fanart is missing after the user saved the key, first
verify that:

- the encrypted vault is unlocked in the current browser session;
- the key was saved under `fanartApiKey`;
- the user is using the same origin/port where the key was saved, because
  IndexedDB is origin-specific (`127.0.0.1:5173` and `127.0.0.1:5174` are
  different browser databases);
- the current page is not an old server instance.

The app should distinguish these states in its message instead of showing the
same generic “add the key” message for all of them.

## Series progress behavior

The series hub previously showed:

```text
YOUR PROGRESS
Where did you stop watching?
Use this if StreamLocal has no playback record for the series.
```

This prompt is only for a series with no playback record and no saved manual
series state. If the user has watched or started any episode in StreamLocal,
the prompt must disappear immediately after the playback state refreshes. It
must not reappear just because the series overlay was reopened.

The user does not want a `Browse episodes` action button in the series hub.
The season selector and episode list are sufficient.

## Current implementation context

Recent commits already added a Fanart provider and a combined artwork action,
but the logo behavior still needs a real end-to-end fix:

```text
5a3bf46  Integrate Fanart artwork provider
e35d237  Refine artwork scanning and series progress
```

Relevant files:

```text
frontend/src/components/browse/ArtworkImage.tsx
frontend/src/components/browse/MediaCard.tsx
frontend/src/components/browse/SeriesCard.tsx
frontend/src/components/browse/HeroRail.tsx
frontend/src/components/browse/SeriesHubOverlay.tsx
frontend/src/services/fanartProvider.ts
frontend/src/services/wikimediaLogoProvider.ts
frontend/src/components/settings/ApiKeyVault.tsx
frontend/src/components/settings/FanartProviderCard.tsx
frontend/src/services/seriesViewingState.ts
```

Do not solve the logo problem by making every logo background white. The
correct solution is candidate filtering plus rendered-image validation and a
same-title alternate logo search.

## Required QA before declaring this complete

Use real or generated media longer than 10 seconds and test at least:

- A movie with a known poster and no usable logo.
- A known series with a valid colored logo.
- A series whose first logo candidate is 100% black.
- A series with no logo at all.
- A title for which a poster exists but no logo exists.
- The Last of Us, Breaking Bad, Stranger Things, and Dune where available.
- Confirm no poster, cover, screenshot, or video frame appears in a logo slot.
- Confirm a black logo is replaced by a visible same-title alternate or falls
  back to text.
- Confirm Stranger Things does not receive an unnecessary white background.
- Save the Fanart key, lock/unlock the vault, and run the combined scan.
- Confirm the same-origin/port behavior for the encrypted key.
- Start an episode, reopen the series hub, and confirm the progress prompt is
  gone.
- Confirm unavailable episodes still show a clear warning at the top/center.

Run:

```bash
npm run typecheck
npm test -- --run
npm run build
npm run dev -- --host 127.0.0.1
curl -I http://127.0.0.1:5174/
```

The development port may be `5173` or `5174` depending on whether another Vite
process is already running. Report the actual working URL to the user.
