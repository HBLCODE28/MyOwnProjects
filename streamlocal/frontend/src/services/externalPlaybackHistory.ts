import { db } from "../db/streamlocalDb";
import type { MediaFile, MediaItem, PlaybackProgress } from "../types/library";
import { watchedFromPosition } from "./playbackProgress";
import { SqliteReader, type SqliteTable } from "./sqliteReader";

export const PLAYBACK_HISTORY_UPDATED_EVENT = "streamlocal:playback-history-updated";

const VLC_HANDLE_KEY = "externalHistory.vlcHandle";
const VLC_SIGNATURE_KEY = "externalHistory.vlcSignature";
const WINDOWS_HANDLES_KEY = "externalHistory.windowsHandles";
const WINDOWS_SIGNATURE_KEY = "externalHistory.windowsSignature";

const VIDEO_EXTENSIONS = new Set(["mp4", "mkv", "avi", "mov", "wmv", "m4v", "webm", "mts", "m2ts"]);

type ExternalPlaybackRecord = {
  path: string;
  positionSeconds: number | null;
  durationSeconds: number | null;
  playedAt: number | null;
  completed: boolean;
  source: "vlc" | "windows_media_player";
};

export type ExternalHistoryImportReport = {
  source: "VLC" | "Windows Media Player";
  found: number;
  matched: number;
  unmatched: number;
  started: number;
  watched: number;
  unchanged: number;
  skipped: number;
  message: string;
};

type SavedWindowsHandles = {
  database?: FileSystemFileHandle;
  wal?: FileSystemFileHandle;
  appState?: FileSystemFileHandle;
};

type SyncOptions = {
  requestPermission?: boolean;
  force?: boolean;
};

function normalizedPath(value: string): string {
  let path = value.trim();
  if (/^file:/i.test(path)) {
    try {
      const url = new URL(path);
      path = decodeURIComponent(url.pathname);
      if (/^\/[a-zA-Z]:\//.test(path)) path = path.slice(1);
    } catch {
      path = path.replace(/^file:\/\/\/?/i, "");
      try {
        path = decodeURIComponent(path);
      } catch {
        // Keep the undecoded path if it is malformed.
      }
    }
  } else {
    try {
      path = decodeURIComponent(path);
    } catch {
      // Keep the original string.
    }
  }
  return path
    .replace(/^\\\\\?\\/, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\//, "")
    .toLowerCase();
}

function basename(value: string): string {
  const path = normalizedPath(value);
  return path.slice(path.lastIndexOf("/") + 1);
}

function extension(value: string): string {
  const name = basename(value);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function looksLikeVideoPath(value: string): boolean {
  return VIDEO_EXTENSIONS.has(extension(value));
}

function splitQtList(value: string): string[] {
  if (!value || value === "@Invalid()") return [];
  const raw = value.startsWith("@StringList(") && value.endsWith(")")
    ? value.slice(12, -1)
    : value;
  return raw
    .split(/,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseVlcRecentHistory(text: string): ExternalPlaybackRecord[] {
  const sectionMatch = text.match(/(?:^|\r?\n)\[RecentsMRL\]\r?\n([\s\S]*?)(?=\r?\n\[|$)/i);
  if (!sectionMatch) return [];

  const section = sectionMatch[1];
  const listLine = section.match(/^list=(.*)$/im)?.[1] ?? "";
  const timesLine = section.match(/^times=(.*)$/im)?.[1] ?? "";
  const paths = splitQtList(listLine);
  const times = splitQtList(timesLine).map((value) => Number.parseInt(value, 10));

  return paths.flatMap((path, index) => {
    if (!looksLikeVideoPath(path)) return [];
    const milliseconds = Number.isFinite(times[index]) ? times[index] : -1;
    return [{
      path,
      positionSeconds: milliseconds > 0 ? milliseconds / 1000 : milliseconds === 0 ? 0 : null,
      durationSeconds: null,
      playedAt: null,
      completed: milliseconds === 0,
      source: "vlc" as const,
    }];
  });
}

function tableColumnIndex(table: SqliteTable, name: string): number {
  return table.columns.findIndex((column) => column.toLowerCase() === name.toLowerCase());
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
}

function microsoftTicksToUnixMs(value: unknown): number | null {
  const numeric = typeof value === "bigint"
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? BigInt(Math.trunc(value))
      : null;
  if (numeric === null) return null;

  const candidates = [
    Number((numeric - 621355968000000000n) / 10000n),
    Number((numeric - 116444736000000000n) / 10000n),
  ];
  const min = Date.UTC(2000, 0, 1);
  const max = Date.UTC(2100, 0, 1);
  return candidates.find((candidate) => candidate >= min && candidate <= max) ?? null;
}

export function parseWindowsMediaPlayerDatabase(
  databaseBytes: Uint8Array,
  walBytes: Uint8Array | null = null,
): ExternalPlaybackRecord[] {
  const reader = new SqliteReader(databaseBytes, walBytes);
  const tables = reader.tables();
  const fileTable = tables.find((table) => table.name.toLowerCase() === "file") ?? null;
  const recentTable = tables.find((table) => table.name.toLowerCase() === "recentlyplayed") ?? null;
  if (!fileTable || !recentTable) {
    throw new Error("MediaPlayer.db does not contain the expected File and RecentlyPlayed tables.");
  }

  const fileIdIndex = tableColumnIndex(fileTable, "Id");
  const fileUriIndex = tableColumnIndex(fileTable, "Uri");
  const recentIdIndex = tableColumnIndex(recentTable, "Id");
  const itemTypeIndex = tableColumnIndex(recentTable, "ItemType");
  const playedTimeIndex = tableColumnIndex(recentTable, "PlayedTime");
  if ([fileIdIndex, fileUriIndex, recentIdIndex].some((index) => index < 0)) {
    throw new Error("MediaPlayer.db uses an unsupported File/RecentlyPlayed schema.");
  }

  const pathById = new Map<string, string>();
  for (const row of fileTable.rows) {
    const id = row[fileIdIndex];
    const uri = row[fileUriIndex];
    if (typeof uri !== "string" || id === null || id === undefined) continue;
    pathById.set(String(id), uri);
  }

  return recentTable.rows.flatMap((row) => {
    if (itemTypeIndex >= 0) {
      const itemType = asNumber(row[itemTypeIndex]);
      if (itemType !== null && itemType !== 5) return [];
    }
    const id = row[recentIdIndex];
    if (id === null || id === undefined) return [];
    const path = pathById.get(String(id));
    if (!path || !looksLikeVideoPath(path)) return [];
    return [{
      path,
      positionSeconds: null,
      durationSeconds: null,
      playedAt: playedTimeIndex >= 0 ? microsoftTicksToUnixMs(row[playedTimeIndex]) : null,
      completed: false,
      source: "windows_media_player" as const,
    }];
  });
}

function parseClockLikeSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed)) {
    const parts = trimmed.split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

function timeValueToSeconds(value: unknown, key: string): number | null {
  if (typeof value === "string") {
    const clock = parseClockLikeSeconds(value);
    if (clock !== null) return clock;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    value = numeric;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes("millisecond") || lowerKey.endsWith("ms")) return value / 1000;
  if (lowerKey.includes("tick") || value > 1_000_000_000) return value / 10_000_000;
  if (value > 100_000) return value / 1000;
  return value;
}

function timeValueToUnixMs(value: unknown): number | null {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    value = numeric;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value > 1e15) return microsoftTicksToUnixMs(BigInt(Math.trunc(value)));
  if (value > 1e12) return value;
  if (value > 1e9) return value * 1000;
  return null;
}

type AppStateContext = {
  positionSeconds: number | null;
  durationSeconds: number | null;
  playedAt: number | null;
};

export function parseWindowsMediaPlayerAppState(text: string): ExternalPlaybackRecord[] {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new Error("AppState.json is not valid JSON.");
  }

  const found = new Map<string, ExternalPlaybackRecord>();
  const positionKey = /(position|progress|playback.*time|current.*time|offset)/i;
  const durationKey = /(duration|total.*time|natural.*duration)/i;
  const playedKey = /(played.*time|last.*played|updated|timestamp|modified)/i;

  const visit = (value: unknown, inherited: AppStateContext) => {
    if (!value || typeof value !== "object") return;
    const entries = Array.isArray(value)
      ? value.map((entry, index) => [String(index), entry] as const)
      : Object.entries(value as Record<string, unknown>);

    const context = { ...inherited };
    for (const [key, child] of entries) {
      if (positionKey.test(key)) {
        const seconds = timeValueToSeconds(child, key);
        if (seconds !== null) context.positionSeconds = seconds;
      }
      if (durationKey.test(key)) {
        const seconds = timeValueToSeconds(child, key);
        if (seconds !== null) context.durationSeconds = seconds;
      }
      if (playedKey.test(key)) {
        const playedAt = timeValueToUnixMs(child);
        if (playedAt !== null) context.playedAt = playedAt;
      }
    }

    for (const [, child] of entries) {
      if (typeof child === "string" && looksLikeVideoPath(child)) {
        const normalized = normalizedPath(child);
        const previous = found.get(normalized);
        const candidate: ExternalPlaybackRecord = {
          path: child,
          positionSeconds: context.positionSeconds,
          durationSeconds: context.durationSeconds,
          playedAt: context.playedAt,
          completed: false,
          source: "windows_media_player",
        };
        if (!previous || (candidate.positionSeconds ?? 0) >= (previous.positionSeconds ?? 0)) {
          found.set(normalized, candidate);
        }
      }
      visit(child, context);
    }
  };

  visit(root, { positionSeconds: null, durationSeconds: null, playedAt: null });
  return [...found.values()];
}

function mergeRecords(records: ExternalPlaybackRecord[]): ExternalPlaybackRecord[] {
  const byPath = new Map<string, ExternalPlaybackRecord>();
  for (const record of records) {
    const key = normalizedPath(record.path);
    const previous = byPath.get(key);
    if (!previous) {
      byPath.set(key, record);
      continue;
    }
    byPath.set(key, {
      ...previous,
      ...record,
      positionSeconds: record.positionSeconds ?? previous.positionSeconds,
      durationSeconds: record.durationSeconds ?? previous.durationSeconds,
      playedAt: record.playedAt ?? previous.playedAt,
      completed: previous.completed || record.completed,
    });
  }
  return [...byPath.values()];
}

function bestFileMatch(path: string, files: MediaFile[]): MediaFile | null {
  const target = normalizedPath(path);
  const targetName = basename(target);
  const exactSuffix = files.filter((file) => {
    const relative = normalizedPath(file.relativePath);
    return relative && target.endsWith(relative);
  });
  if (exactSuffix.length === 1) return exactSuffix[0];
  if (exactSuffix.length > 1) {
    return exactSuffix.sort((a, b) => b.relativePath.length - a.relativePath.length)[0];
  }

  const byName = files.filter((file) => file.fileName.toLowerCase() === targetName);
  return byName.length === 1 ? byName[0] : null;
}

function progressChanged(a: PlaybackProgress | undefined, b: PlaybackProgress): boolean {
  if (!a) return true;
  return (
    a.positionSeconds !== b.positionSeconds ||
    a.durationSeconds !== b.durationSeconds ||
    a.percent !== b.percent ||
    a.started !== b.started ||
    a.watched !== b.watched ||
    a.lastPlayedAt !== b.lastPlayedAt ||
    a.completedAt !== b.completedAt
  );
}

async function applyRecords(
  label: ExternalHistoryImportReport["source"],
  rawRecords: ExternalPlaybackRecord[],
): Promise<ExternalHistoryImportReport> {
  const records = mergeRecords(rawRecords);
  const [files, items, existingRows] = await Promise.all([
    db.mediaFiles.toArray(),
    db.mediaItems.toArray(),
    db.playbackProgress.toArray(),
  ]);
  const itemByFileId = new Map(items.map((item) => [item.mediaFileId, item]));
  const existingByItemId = new Map(existingRows.map((row) => [row.mediaItemId, row]));
  const importTime = Date.now();

  let matched = 0;
  let unmatched = 0;
  let started = 0;
  let watched = 0;
  let unchanged = 0;
  let skipped = 0;
  const updates: PlaybackProgress[] = [];

  records.forEach((record, index) => {
    const file = bestFileMatch(record.path, files);
    if (!file) {
      unmatched += 1;
      return;
    }
    const item = itemByFileId.get(file.id);
    if (!item || item.type === "unmatched") {
      skipped += 1;
      return;
    }
    matched += 1;

    const previous = existingByItemId.get(item.id);
    const playedAt = record.playedAt ?? Math.max(1, importTime - index * 1000);
    const importedPosition = Math.max(0, record.positionSeconds ?? 0);
    const importedDuration = Math.max(0, record.durationSeconds ?? 0);
    const duration = importedDuration || previous?.durationSeconds || 0;
    const position = Math.max(previous?.positionSeconds ?? 0, importedPosition);
    const completedByThreshold = duration > 0 && watchedFromPosition(item, position, duration);
    const isWatched = previous?.watched === true || record.completed || completedByThreshold;
    const resolvedDuration = duration || (isWatched ? position : 0);
    const resolvedPosition = isWatched && resolvedDuration > 0 ? resolvedDuration : position;
    const percent = isWatched
      ? 1
      : resolvedDuration > 0
        ? Math.max(0, Math.min(1, resolvedPosition / resolvedDuration))
        : previous?.percent ?? 0;

    const next: PlaybackProgress = {
      mediaItemId: item.id,
      positionSeconds: resolvedPosition,
      durationSeconds: resolvedDuration,
      percent,
      started: true,
      firstPlayedAt: previous?.firstPlayedAt ?? playedAt,
      watched: isWatched,
      lastPlayedAt: Math.max(previous?.lastPlayedAt ?? 0, playedAt),
      completedAt: isWatched ? previous?.completedAt ?? playedAt : previous?.completedAt ?? null,
    };

    if (!progressChanged(previous, next)) {
      unchanged += 1;
      return;
    }
    updates.push(next);
    if (next.watched && !previous?.watched) watched += 1;
    else if (next.started && !previous?.started) started += 1;
    else started += 1;
  });

  if (updates.length > 0) {
    await db.playbackProgress.bulkPut(updates);
    window.dispatchEvent(new Event(PLAYBACK_HISTORY_UPDATED_EVENT));
  }

  return {
    source: label,
    found: records.length,
    matched,
    unmatched,
    started,
    watched,
    unchanged,
    skipped,
    message: `${label}: matched ${matched} of ${records.length}; ${watched} marked watched; ${started} progress record${started === 1 ? "" : "s"} updated.`,
  };
}

async function settingValue<T>(key: string): Promise<T | null> {
  const row = await db.settings.get(key);
  return (row?.value as T | undefined) ?? null;
}

async function saveSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

async function permissionGranted(
  handle: FileSystemFileHandle,
  requestPermission: boolean,
): Promise<boolean> {
  const current = await handle.queryPermission({ mode: "read" });
  if (current === "granted") return true;
  if (!requestPermission) return false;
  return (await handle.requestPermission({ mode: "read" })) === "granted";
}

function signature(files: File[]): string {
  return files
    .map((file) => `${file.name}:${file.size}:${file.lastModified}`)
    .sort()
    .join("|");
}

export function normalizePickerId(value: string): string {
  return value
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .slice(0, 32) || "streamlocal-picker";
}

async function openFileHandles(options: {
  id: string;
  multiple?: boolean;
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
}): Promise<FileSystemFileHandle[]> {
  if (!window.showOpenFilePicker) {
    throw new Error("Use current Chrome or Edge on Windows to connect external player history.");
  }
  const pickerId = normalizePickerId(options.id);
  const pickerOptions: {
    id: string;
    multiple: boolean;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  } = {
    id: pickerId,
    multiple: options.multiple ?? false,
  };
  if (options.types?.length) pickerOptions.types = options.types;
  return window.showOpenFilePicker(pickerOptions);
}

export async function connectVlcHistory(): Promise<ExternalHistoryImportReport> {
  const [handle] = await openFileHandles({
    id: "sl-vlc-history",
    types: [{
      description: "VLC interface history",
      accept: { "text/plain": [".ini"] },
    }],
  });
  if (!handle) throw new Error("No VLC history file selected.");
  await saveSetting(VLC_HANDLE_KEY, handle);
  await saveSetting(VLC_SIGNATURE_KEY, "");
  const report = await syncVlcHistory({ requestPermission: true, force: true });
  if (!report) throw new Error("Could not read the VLC history file.");
  return report;
}

export async function connectWindowsMediaPlayerHistory(): Promise<ExternalHistoryImportReport> {
  // Do not pass a file-extension filter here. Chromium rejects compound names
  // such as `.db-wal` in showOpenFilePicker() accept lists. Let the native
  // picker show all files and validate the exact Media Player filenames below.
  const handles = await openFileHandles({
    id: "sl-wmp-history",
    multiple: true,
  });

  const saved: SavedWindowsHandles = {};
  for (const handle of handles) {
    const name = handle.name.toLowerCase();
    if (name === "mediaplayer.db") saved.database = handle;
    else if (name === "mediaplayer.db-wal") saved.wal = handle;
    else if (name === "appstate.json") saved.appState = handle;
  }
  if (!saved.database && !saved.appState) {
    throw new Error(
      "Select MediaPlayer.db and/or AppState.json from the Windows Media Player LocalState folder. MediaPlayer.db-wal is optional but recommended when present.",
    );
  }
  await saveSetting(WINDOWS_HANDLES_KEY, saved);
  await saveSetting(WINDOWS_SIGNATURE_KEY, "");
  const report = await syncWindowsMediaPlayerHistory({ requestPermission: true, force: true });
  if (!report) throw new Error("Could not read Windows Media Player history.");
  return report;
}

export async function syncVlcHistory(options: SyncOptions = {}): Promise<ExternalHistoryImportReport | null> {
  const handle = await settingValue<FileSystemFileHandle>(VLC_HANDLE_KEY);
  if (!handle) return null;
  if (!(await permissionGranted(handle, options.requestPermission ?? false))) return null;
  const file = await handle.getFile();
  const currentSignature = signature([file]);
  const previousSignature = await settingValue<string>(VLC_SIGNATURE_KEY);
  if (!options.force && previousSignature === currentSignature) return null;
  const records = parseVlcRecentHistory(await file.text());
  const report = await applyRecords("VLC", records);
  await saveSetting(VLC_SIGNATURE_KEY, currentSignature);
  return report;
}

export async function syncWindowsMediaPlayerHistory(options: SyncOptions = {}): Promise<ExternalHistoryImportReport | null> {
  const handles = await settingValue<SavedWindowsHandles>(WINDOWS_HANDLES_KEY);
  if (!handles || (!handles.database && !handles.appState)) return null;

  const candidateHandles = [handles.database, handles.wal, handles.appState].filter(
    (handle): handle is FileSystemFileHandle => Boolean(handle),
  );
  for (const handle of candidateHandles) {
    if (!(await permissionGranted(handle, options.requestPermission ?? false))) return null;
  }
  const files = await Promise.all(candidateHandles.map((handle) => handle.getFile()));
  const currentSignature = signature(files);
  const previousSignature = await settingValue<string>(WINDOWS_SIGNATURE_KEY);
  if (!options.force && previousSignature === currentSignature) return null;

  const byName = new Map(files.map((file) => [file.name.toLowerCase(), file]));
  const records: ExternalPlaybackRecord[] = [];
  const databaseFile = byName.get("mediaplayer.db");
  if (databaseFile) {
    const walFile = byName.get("mediaplayer.db-wal");
    records.push(...parseWindowsMediaPlayerDatabase(
      new Uint8Array(await databaseFile.arrayBuffer()),
      walFile ? new Uint8Array(await walFile.arrayBuffer()) : null,
    ));
  }
  const appState = byName.get("appstate.json");
  if (appState) records.push(...parseWindowsMediaPlayerAppState(await appState.text()));

  const report = await applyRecords("Windows Media Player", records);
  await saveSetting(WINDOWS_SIGNATURE_KEY, currentSignature);
  return report;
}

export async function syncConnectedExternalHistories(options: SyncOptions = {}): Promise<ExternalHistoryImportReport[]> {
  const reports: ExternalHistoryImportReport[] = [];
  for (const sync of [syncVlcHistory, syncWindowsMediaPlayerHistory]) {
    try {
      const report = await sync(options);
      if (report) reports.push(report);
    } catch (error) {
      if (options.force) throw error;
      console.warn("External playback history sync failed:", error);
    }
  }
  return reports;
}

export async function externalHistoryConnectionState(): Promise<{
  vlc: boolean;
  windowsMediaPlayer: boolean;
}> {
  const [vlc, windows] = await Promise.all([
    settingValue<FileSystemFileHandle>(VLC_HANDLE_KEY),
    settingValue<SavedWindowsHandles>(WINDOWS_HANDLES_KEY),
  ]);
  return { vlc: Boolean(vlc), windowsMediaPlayer: Boolean(windows?.database || windows?.appState) };
}
