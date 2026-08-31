# StreamLocal Agent History

Rolling log of agent changes. Most recent first.

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
