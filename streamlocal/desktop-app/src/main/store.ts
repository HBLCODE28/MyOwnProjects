import { app, safeStorage } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LibraryState } from "../shared/types";

const initial = (): LibraryState => ({ sources: [], files: [], progress: {}, settings: { onboardingDone: false } });
let state: LibraryState = initial();
const statePath = () => join(app.getPath("userData"), "library.json");
export async function loadState() { try { state = { ...initial(), ...JSON.parse(await readFile(statePath(), "utf8")) }; } catch { state = initial(); } return state; }
export function getState() { return state; }
export async function saveState() { await mkdir(app.getPath("userData"), { recursive: true }); const temp = `${statePath()}.tmp`; await writeFile(temp, JSON.stringify(state), "utf8"); await rename(temp, statePath()); }
export async function updateState(mutator: (current: LibraryState) => void) { mutator(state); await saveState(); return state; }
export function setSubtitleKey(key: string) { state.encryptedSubtitleKey = key && safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(key).toString("base64") : undefined; return saveState(); }
export function subtitleKey() { try { return state.encryptedSubtitleKey ? safeStorage.decryptString(Buffer.from(state.encryptedSubtitleKey, "base64")) : ""; } catch { return ""; } }
export function exportableState() { const { encryptedSubtitleKey, ...rest } = state; return rest; }
