# StreamLocal Agent History

Rolling log of agent changes. Most recent first.

---

## 2026-10-28 | Desktop VLC-style player controls

- Reworked the Electron player into a compact top toolbar with Hebrew and English subtitle selection, brightness, playback speed, and a close action.
- Added the requested subtitle alignment flow: pause on a line, then use “I SEE NOW” and “I HEAR NOW” to shift loaded subtitle cues by the measured offset.
- Kept the existing subtitle search and download flow in an accessible drawer, with announced loading and error states.
- Verified: renderer TypeScript check passed.

---

## 2026-10-28 | Bundle desktop logo asset

- Moved the renderer logo dependency into `desktop-app/src/renderer/assets/` and updated the app to load that bundled SVG.
- This removes the invalid cross-project reference to `frontend/public`, so the logo works in Electron development and packaged builds.
- Verification: desktop renderer TypeScript check passed.

---

## 2026-10-28 | Desktop network library, series browsing, and poster refresh

- Added a dedicated Windows network-folder field in Settings. It accepts validated UNC paths such as `\\SERVER\Media`, then scans that shared folder like any local source.
- Redesigned the desktop Series page for larger libraries: alphabetized responsive cards, series/season/episode counts, and a filter field.
- Strengthened artwork matching to use exact TVmaze and Wikipedia title matches only. The manual poster refresh now replaces existing artwork so previously incorrect images can be fixed.
- Verification: renderer TypeScript check passed. The Electron main-process check and packaged build require installing the missing `desktop-app` development dependencies first.

---

## 2026-10-26 | StreamLocal desktop player and home improvements

- Updated the Windows Electron app (`desktop-app/`), not the browser PWA.
- Replaced the fixed Home marketing text with a three-second rotating feature view covering local films and series.
- Added explicit Hebrew/English subtitle controls, accessible status messages, subtitle-loading failure feedback, manual subtitle search, three-dots subtitle synchronization, and left/right ten-second player shortcuts.
- Removed the visible “Resuming from …” line and styled series titles as title marks containing only the series name.
- Improved movie artwork lookup by preferring the exact Wikipedia film page instead of an arbitrary search result, avoiding cast/crew images when a film poster is available.
- Verification limitation: `desktop-app/node_modules` is not installed, so the Electron/Node type dependencies required by the app typecheck are unavailable.

---

## 2026-10-26 | Player subtitles, home carousel, and poster safety

- Added clear Hebrew and English subtitle actions in the player. Each action reports loading, success, no-match, and download errors; repeated selection rotates through alternative matching subtitle releases.
- Made subtitle status messages accessible to screen readers and exposed the existing manual subtitle synchronization controls from the three-dots menu.
- Kept the ±10-second seek controls in the player and changed the Home hero to rotate through every playable movie and series every three seconds.
- Tightened poster selection from the Preservation Network so a cast or crew image is never accepted unless its URL explicitly identifies it as a poster or cover.
- Verification: TypeScript typecheck passed. Vitest could not start because the shared-drive installation is missing Rollup's optional Linux native package. The shared smoke test passed its PHP lint phase; its JavaScript syntax phase exceeded the reporting window on the shared drive.

---

## 2026-10-24 | StreamLocal standalone Electron desktop app

- Added `desktop-app/` as an independent Electron + React + TypeScript application; the existing `frontend/` PWA was not modified.
- Implemented Windows-native folder selection, recursive read-only media scanning, safe local media protocol, library persistence, series/season views, internal playback progress, VLC recent-history import, and OpenSubtitles search/download using a DPAPI-protected user key.
- Added unit coverage for filename classification and stable media identifiers.
- Added electron-builder NSIS configuration for the per-user `StreamLocal-Setup.exe` installer, including Desktop and Start Menu shortcuts.
- Verification: TypeScript typecheck passed; three unit tests for classification and stable media IDs passed; the production Electron/React build passed. An NSIS Windows x64 build was also run in a temporary local build workspace because the shared drive has insufficient free space for Electron dependencies or release artifacts.
- Follow-up build: with disk space restored, the checked production Windows application was copied to `desktop-app/release/StreamLocal-win-x64`. The Linux NSIS finalization is blocked only by the missing system `wine` executable; building the installer through `npm run dist` on Windows remains supported.
- Interface follow-up: added arrow-key, arrow-button, and pointer-drag browsing rails; a dedicated Movies page; a discovery-style Search page; securely stored API connection fields; and reliable player close controls including Escape.

## 2026-08-31 15:14:00 (local) | streamlocal-fix-streamlocal-dev-service-worker-20260831-151358.zip

- Task: Prevent stale service-worker cache from hiding Vite dev changes.
- Backup: `_CODEX/backups/streamlocal-fix-streamlocal-dev-service-worker-20260831-151358.zip`
- Files changed:
  - `frontend/src/main.tsx`
  - `_CODEX/AGENT_HISTORY.md`
- Change summary:
  - Service worker registration now runs only in production builds.
  - Vite dev mode unregisters existing service workers for this origin so old portable assets do not keep controlling localhost.
- Verification:
  - `curl http://127.0.0.1:5173/src/main.tsx` shows dev-mode unregister logic.
  - `node node_modules/typescript/bin/tsc -b --pretty false` PASS.
  - `bash /mnt/VMSHARE/_CODEX_SHARED/scripts/after_change.sh "$PWD"` PASS.
- Notes:
  - Port `17836` serves the Windows portable package and still requires rebuilding `release/StreamLocal-Website-Portable` from Windows.

---

## 2026-08-31 15:04:00 (local) | streamlocal-fix-streamlocal-vite-dev-entry-20260831-150406.zip

- Task: Fixed Vite dev server white page showing only `v0.3.1`.
- Backup: `_CODEX/backups/streamlocal-fix-streamlocal-vite-dev-entry-20260831-150406.zip`
- Files changed:
  - `frontend/index.html`
  - `_CODEX/AGENT_HISTORY.md`
- Change summary:
  - Replaced stale portable-build asset tags in `frontend/index.html` with the Vite dev module entry `/src/main.tsx`.
  - Removed the direct `./assets/index-streamlocal.css` reference from the dev index because Vite imports app CSS through React modules.
- Verification:
  - `curl http://127.0.0.1:5173/` shows `<script type="module" src="/src/main.tsx"></script>`.
  - `node node_modules/typescript/bin/tsc -b --pretty false` PASS.
  - `bash /mnt/VMSHARE/_CODEX_SHARED/scripts/after_change.sh "$PWD"` PASS.

---

## 2026-08-31 14:50:00 (local) | streamlocal-organize-streamlocal-project-folder-docs-20260831-145000.manifest.txt

- Task: Organized StreamLocal project documentation entrypoints.
- Backup: `_CODEX/backups/streamlocal-organize-streamlocal-project-folder-docs-20260831-145000.manifest.txt`
- Files changed:
  - `AGENTS.md`
  - `_CODEX/project_specific/INDEX.md`
  - `_CODEX/project_specific/.context_hygiene.json`
  - `docs/INDEX.md`
  - `_CODEX/AGENT_HISTORY.md`
- Change summary:
  - Added a short project-local `AGENTS.md` to route future agents to current context.
  - Added `_CODEX/project_specific/INDEX.md` so future sessions start from a compact current architecture map.
  - Added `docs/INDEX.md` so root and docs-folder documents have clear roles.
  - Recorded context hygiene marker metadata.
- Verification:
  - Pending: shared after-change smoke.
- Notes:
  - No app source files were moved or edited.
  - Root `.txt` and `.docx` files were left in place pending explicit approval to move tracked files.

---

## 2026-08-31 14:36:00 (local) | streamlocal-fix-streamlocal-pending-queue-issues-20260831-142550.zip

- Task: Implemented SuperTasks pending batch for project_key `p-9b67f541403bbb68`.
- Run ID: `codex-20260831T142533-39982`
- Backup: `_CODEX/backups/streamlocal-fix-streamlocal-pending-queue-issues-20260831-142550.zip`
- SuperTasks moved to `ready_for_qa`: 327, 328, 329, 330, 331, 332, 333, 334.
- Files changed:
  - `frontend/src/services/browseData.ts`
  - `frontend/src/services/browseData.test.ts`
  - `frontend/src/pages/HomePage.tsx`
  - `frontend/src/components/browse/SeriesCard.tsx`
  - `frontend/src/components/icons/TablerIcons.tsx`
  - `frontend/src/components/player/PlayerOverlay.tsx`
  - `frontend/src/pages/SettingsPage.tsx`
  - `frontend/src/styles/browse.css`
  - `frontend/src/styles/player.css`
- Change summary:
  - Started-but-unwatched episodes now appear in Continue Watching even when playback position is low.
  - Home movie genre rails no longer hide single-item genre groups.
  - Series card View episodes action moved away from metadata text and uses a Tabler-style icon.
  - Player options and subtitle options are separate translucent menus.
  - Settings exposes direct VLC history file connection as a fallback to the bridge folder.
  - Fallback hero/title text spacing is relaxed for series without logo artwork.
- Verification:
  - Typecheck: `node node_modules/typescript/bin/tsc -b --pretty false` PASS
  - Targeted tests: `ESBUILD_BINARY_PATH=/tmp/streamlocal-esbuild node node_modules/vitest/vitest.mjs run src/services/browseData.test.ts src/services/browseSelectors.test.ts src/services/externalPlaybackHistory.test.ts` PASS
  - Shared smoke: `bash /mnt/VMSHARE/_CODEX_SHARED/scripts/after_change.sh "$PWD"` PASS
- Notes:
  - Plain `npm run typecheck` is blocked by non-executable `.bin` wrappers on the CIFS share.
  - Plain Vitest is blocked by the esbuild binary on the CIFS share; using an executable `/tmp` copy of esbuild verified the tests.

| 2026-08-31 14:50:00 | `streamlocal-organize-streamlocal-project-folder-docs-20260831-145000.manifest.txt` | organize streamlocal project folder docs |

| 2026-08-31 15:04:06 | `streamlocal-fix-streamlocal-vite-dev-entry-20260831-150406.zip` | fix streamlocal vite dev entry |

| 2026-08-31 15:13:58 | `streamlocal-fix-streamlocal-dev-service-worker-20260831-151358.zip` | fix streamlocal dev service worker |

| 2026-08-31 18:44:37 | `streamlocal-fix-streamlocal-pending-ui-batch-20260831-184437.zip` | fix streamlocal pending ui batch |
## 2026-08-31 18:55:00 (local) | streamlocal-fix-streamlocal-pending-ui-batch-20260831-184437.zip

- Task: Implemented SuperTasks pending UI batch for project_key `p-9b67f541403bbb68`.
- Run ID: `codex-20260831T184354-140847`
- Backup: `_CODEX/backups/streamlocal-fix-streamlocal-pending-ui-batch-20260831-184437.zip`
- SuperTasks moved to `ready_for_qa`: 349, 350, 351, 352, 353, 354, 355, 356.
- Files changed:
  - `frontend/index.html`
  - `frontend/src/components/browse/HeroRail.tsx`
  - `frontend/src/components/browse/SeriesHubOverlay.tsx`
  - `frontend/src/components/settings/FanartProviderCard.tsx`
  - `frontend/src/pages/LibraryPage.tsx`
  - `frontend/src/pages/RecognitionPage.tsx`
  - `frontend/src/styles/browse.css`
  - `frontend/src/styles/responsive.css`
  - `frontend/src/styles/settings.css`
- Change summary:
  - Hero descriptions have more spacing from the header and can expand from More info.
  - Movie genre rails now match the compact series rail sizing more closely.
  - The visible `v0.3.1` version marker was removed from the app shell.
  - Recognition header copy now explains why identification matters.
  - Library source Disconnect is a two-step action that changes to Delete on first click.
  - Artwork sync shows a short live process note while Finding artwork is running.
  - Episode thumbnails now prefer episode still/backdrop/poster URLs before series artwork.
- Verification:
  - Typecheck: `node node_modules/typescript/bin/tsc -b --pretty false` PASS
  - Shared smoke: PHP lint PASS; JS syntax phase was interrupted after hanging on the Windows share.
  - Deployment: not deployed.

---

| 2026-10-24 08:19:42 | `streamlocal-create-standalone-electron-desktop-application-20261024-081942.zip` | create standalone electron desktop application |

| 2026-10-24 08:53:38 | `streamlocal-bundle-single-file-windows-installer-20261024-085338.zip` | bundle single file windows installer |

| 2026-10-24 09:24:29 | `streamlocal-improve-desktop-streaming-interface-controls-20261024-092429.zip` | improve desktop streaming interface controls |
