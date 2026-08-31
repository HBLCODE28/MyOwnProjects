# StreamLocal Agent Notes

Follow `/mnt/VMSHARE/_CODEX_SHARED/docs/AGENTS_BASE.md` and `/home/n/AGENTS.md`.

## Project Context

- Start with `_CODEX/project_specific/INDEX.md` for current architecture and important paths.
- Do not treat `SPEC.md` as current runtime truth without checking `README.md` and `docs/browser-only-architecture.md`; the project moved from the original backend plan to a browser-only React/PWA runtime.
- `frontend/dist/`, `release/`, and generated installers are build outputs unless a release task explicitly needs them.

## Development

- Main app code lives under `frontend/src/`.
- Use `node node_modules/typescript/bin/tsc -b --pretty false` for typecheck on the VMSHARE mount.
- Vitest may need `ESBUILD_BINARY_PATH` pointed at an executable `/tmp` copy of esbuild because CIFS files are mounted non-executable.
