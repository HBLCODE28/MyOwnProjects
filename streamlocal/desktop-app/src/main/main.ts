import { app, BrowserWindow, dialog, ipcMain, net, protocol } from "electron";
import { basename, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile, stat } from "node:fs/promises";
import { getState, loadState, updateState, exportableState, setProviderKey, providerKeyNames, setSubtitleKey, subtitleKey, providerKey } from "./store";
import { newSource, scanSource } from "./scanner";
import { importVlcHistory } from "./vlc";
import { downloadSubtitle, findSubtitles } from "./subtitles";
import { artworkFor } from "./artwork";

protocol.registerSchemesAsPrivileged([{ scheme: "streamlocal-media", privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }]);
let window: BrowserWindow | null = null;
function createWindow() {
  window = new BrowserWindow({ width: 1400, height: 900, minWidth: 980, minHeight: 650, backgroundColor: "#0a0d14", titleBarStyle: "hidden", titleBarOverlay: { color: "#0a0d14", symbolColor: "#f5f7fb", height: 36 }, webPreferences: { preload: `${__dirname}/preload.js`, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const devUrl = process.env.STREAMLOCAL_DEV_URL;
  if (devUrl) window.loadURL(devUrl); else window.loadFile(`${__dirname}/../renderer/index.html`);
}
function sourceForPath(path: string) { const source = getState().sources.find((item) => { const fromSource = relative(resolve(item.path), resolve(path)); return fromSource !== "" && !fromSource.startsWith("..") && !fromSource.includes(`..${sep}`); }); if (!source) throw new Error("This media file is outside your selected library folders."); return source; }
async function syncArtwork() { if (!providerKey("tmdb")) return { updated: 0, message: "Add a TMDb API key in Settings first." }; const files = [...getState().files]; let updated = 0; for (const file of files) { if (file.posterUrl || file.backdropUrl) continue; const artwork = await artworkFor(file).catch(() => null); if (!artwork) continue; await updateState((current) => { const target = current.files.find((item) => item.id === file.id); if (target) Object.assign(target, artwork); }); updated++; } if (updated) window?.webContents.send("library:artworkUpdated", { updated }); return { updated, message: updated ? `${updated} posters updated.` : "No new posters were returned by TMDb. Check the key and title names." }; }
async function preferredSubtitles(id: string) { const existing = getState().preferredSubtitles?.[id]; if (existing?.he || existing?.en) return { he: existing.he ? pathToFileURL(existing.he).toString() : undefined, en: existing.en ? pathToFileURL(existing.en).toString() : undefined }; const file = getState().files.find((item) => item.id === id); if (!file || !subtitleKey()) return {}; const result: { he?: string; en?: string } = {}; for (const language of ["he", "en"] as const) { try { const match = (await findSubtitles(file.type === "episode" ? `${file.series} S${file.season}E${file.episode}` : file.title, language)).sort((a, b) => b.downloadCount - a.downloadCount)[0]; if (match) result[language] = await downloadSubtitle(match.id); } catch { /* Manual subtitle selection remains available. */ } } await updateState((current) => { current.preferredSubtitles ||= {}; current.preferredSubtitles[id] = result; }); return { he: result.he ? pathToFileURL(result.he).toString() : undefined, en: result.en ? pathToFileURL(result.en).toString() : undefined }; }
function prepareSubtitlesInBackground(files: { id: string }[]) { if (!subtitleKey()) return; void (async () => { for (const file of files) await preferredSubtitles(file.id); })(); }
async function scan(sourceId: string) { const source = getState().sources.find((item) => item.id === sourceId); if (!source) throw new Error("Library folder not found."); const files = await scanSource(source, (progress) => window?.webContents.send("library:scanProgress", { sourceId, ...progress })); await updateState((current) => { const previous = new Map(current.files.map((item) => [item.id, item])); current.files = [...current.files.filter((item) => item.sourceId !== sourceId), ...files.map((item) => ({ ...item, posterUrl: previous.get(item.id)?.posterUrl, backdropUrl: previous.get(item.id)?.backdropUrl }))]; const target = current.sources.find((item) => item.id === sourceId); if (target) target.lastScanAt = Date.now(); }); void syncArtwork(); prepareSubtitlesInBackground(files); return { files: files.length }; }
app.whenReady().then(async () => {
  await loadState();
  void syncArtwork();
  prepareSubtitlesInBackground(getState().files);
  protocol.handle("streamlocal-media", async (request) => { const id = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, "")); const file = getState().files.find((item) => item.id === id); if (!file) return new Response("Not found", { status: 404 }); sourceForPath(file.path); try { await stat(file.path); const range = request.headers.get("range"); return net.fetch(pathToFileURL(file.path).toString(), { headers: range ? { Range: range } : undefined }); } catch { return new Response("Missing file", { status: 404 }); } });
  ipcMain.handle("library:selectFolder", async () => { const result = await dialog.showOpenDialog(window!, { title: "Choose a media folder", properties: ["openDirectory"] }); if (result.canceled || !result.filePaths[0]) return null; const path = result.filePaths[0]; let source = getState().sources.find((item) => resolve(item.path).toLowerCase() === resolve(path).toLowerCase()); if (!source) { source = newSource(path, basename(path)); await updateState((current) => current.sources.push(source!)); } return source; });
  ipcMain.handle("library:scan", (_, sourceId: string) => scan(sourceId));
  ipcMain.handle("library:syncArtwork", () => syncArtwork());
  ipcMain.handle("library:listFiles", () => ({ sources: getState().sources, files: getState().files, progress: getState().progress, onboardingDone: getState().settings.onboardingDone }));
  ipcMain.handle("library:removeSource", async (_, sourceId: string) => updateState((current) => { current.sources = current.sources.filter((item) => item.id !== sourceId); current.files = current.files.filter((item) => item.sourceId !== sourceId); }));
  ipcMain.handle("library:completeOnboarding", () => updateState((current) => { current.settings.onboardingDone = true; }));
  ipcMain.handle("library:export", async () => { const choice = await dialog.showSaveDialog(window!, { defaultPath: "StreamLocal-library.json", filters: [{ name: "StreamLocal library", extensions: ["json"] }] }); if (!choice.filePath) return false; await require("node:fs/promises").writeFile(choice.filePath, JSON.stringify(exportableState(), null, 2)); return true; });
  ipcMain.handle("library:import", async () => { const choice = await dialog.showOpenDialog(window!, { properties: ["openFile"], filters: [{ name: "StreamLocal library", extensions: ["json"] }] }); if (choice.canceled || !choice.filePaths[0]) return false; const incoming = JSON.parse(await readFile(choice.filePaths[0], "utf8")); await updateState((current) => { current.sources = Array.isArray(incoming.sources) ? incoming.sources : []; current.files = Array.isArray(incoming.files) ? incoming.files : []; current.progress = incoming.progress || {}; }); return true; });
  ipcMain.handle("media:open", (_, id: string) => { const file = getState().files.find((item) => item.id === id); if (!file) throw new Error("Media file not found."); sourceForPath(file.path); return `streamlocal-media://media/${encodeURIComponent(id)}`; });
  ipcMain.handle("history:saveProgress", (_, id: string, position: number, duration: number) => updateState((current) => { current.progress[id] = { position, duration, watched: duration > 0 && position / duration >= 0.9, lastPlayedAt: Date.now() }; }));
  ipcMain.handle("history:importVlc", async () => { const result = await importVlcHistory(getState().files); await updateState((current) => { for (const id of result.ids || []) current.progress[id] = { position: 0, duration: 0, watched: false, lastPlayedAt: Date.now() }; }); return result; });
  ipcMain.handle("settings:get", () => ({ hasSubtitleKey: Boolean(getState().encryptedSubtitleKey), providerKeys: providerKeyNames(), encryptionAvailable: require("electron").safeStorage.isEncryptionAvailable() }));
  ipcMain.handle("settings:set", async (_, key: string) => { await setSubtitleKey(key); prepareSubtitlesInBackground(getState().files); });
  ipcMain.handle("settings:setProviderKey", async (_, provider: string, key: string) => { await setProviderKey(provider, key); if (provider === "tmdb") void syncArtwork(); });
  ipcMain.handle("subtitles:search", (_, query: string, language: string) => findSubtitles(query, language));
  ipcMain.handle("subtitles:download", async (_, fileId: string) => pathToFileURL(await downloadSubtitle(fileId)).toString());
  ipcMain.handle("subtitles:preferred", (_, id: string) => preferredSubtitles(id));
  createWindow();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
