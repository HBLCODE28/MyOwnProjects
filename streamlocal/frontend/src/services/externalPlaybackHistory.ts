import { db } from "../db/streamlocalDb";
import type { MediaFile, MediaItem, PlaybackProgress } from "../types/library";
import { watchedFromPosition } from "./playbackProgress";
import { SqliteReader, type SqliteTable } from "./sqliteReader";

export const PLAYBACK_HISTORY_UPDATED_EVENT = "streamlocal:playback-history-updated";

const VLC_HANDLE_KEY = "externalHistory.vlcHandle";
const VLC_SIGNATURE_KEY = "externalHistory.vlcSignature";
const WINDOWS_HANDLES_KEY = "externalHistory.windowsHandles";
const WINDOWS_SIGNATURE_KEY = "externalHistory.windowsSignature";
const BRIDGE_DIRECTORY_KEY = "externalHistory.bridgeDirectory";
const BRIDGE_SIGNATURE_KEY = "externalHistory.bridgeSignature";
const BRIDGE_SOURCES_KEY = "externalHistory.bridgeSources";

const VIDEO_EXTENSIONS = new Set(["mp4", "mkv", "avi", "mov", "wmv", "m4v", "webm", "mts", "m2ts"]);

type ExternalPlaybackRecord = {
  path: string | null;
  title?: string | null;
  albumTitle?: string | null;
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

type BridgeSources = {
  vlc: boolean;
  windowsMediaPlayer: boolean;
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

export function parseLivePlaybackHistory(text: string): ExternalPlaybackRecord[] {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("live-playback-history.json is not valid JSON.");
  }

  const rows = payload && typeof payload === "object" && Array.isArray((payload as { records?: unknown }).records)
    ? (payload as { records: unknown[] }).records
    : [];

  return rows.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const source = row.source === "vlc" || row.source === "windows_media_player" ? row.source : null;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!source || !title) return [];
    const positionSeconds = typeof row.positionSeconds === "number" && Number.isFinite(row.positionSeconds)
      ? Math.max(0, row.positionSeconds)
      : null;
    const durationSeconds = typeof row.durationSeconds === "number" && Number.isFinite(row.durationSeconds)
      ? Math.max(0, row.durationSeconds)
      : null;
    const playedAt = typeof row.firstSeenAt === "string" ? Date.parse(row.firstSeenAt) : Number.NaN;
    return [{
      path: null,
      title,
      albumTitle: typeof row.albumTitle === "string" ? row.albumTitle : null,
      positionSeconds,
      durationSeconds,
      playedAt: Number.isFinite(playedAt) ? playedAt : null,
      completed: row.completed === true,
      source,
    } satisfies ExternalPlaybackRecord];
  });
}

function normalizedMediaLabel(value: string | null | undefined): string {
  if (!value) return "";
  let label = value.trim();
  if (/^file:/i.test(label) || /[\\/]/.test(label)) label = basename(label);
  label = label.replace(/\.[a-z0-9]{2,5}$/i, "");
  return label
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function recordKey(record: ExternalPlaybackRecord): string {
  if (record.path) return `path:${normalizedPath(record.path)}`;
  return `session:${record.source}:${normalizedMediaLabel(record.title)}:${normalizedMediaLabel(record.albumTitle)}`;
}

function attachLiveSessionPaths(
  liveRecords: ExternalPlaybackRecord[],
  staticRecords: ExternalPlaybackRecord[],
): ExternalPlaybackRecord[] {
  const pathRecords = staticRecords.filter((record) => Boolean(record.path));
  return liveRecords.map((record) => {
    if (record.path) return record;
    const title = normalizedMediaLabel(record.title);
    if (!title) return record;

    const titleMatches = pathRecords.filter((candidate) => {
      if (candidate.source !== record.source || !candidate.path) return false;
      const stem = normalizedMediaLabel(candidate.path);
      return stem === title || stem.startsWith(`${title} `) || title.startsWith(`${stem} `);
    });
    if (titleMatches.length === 1) return { ...record, path: titleMatches[0].path };

    if (record.source === "windows_media_player" && record.playedAt !== null) {
      const timed = pathRecords
        .filter((candidate) => candidate.source === record.source && candidate.path && candidate.playedAt !== null)
        .map((candidate) => ({ candidate, distance: Math.abs((candidate.playedAt ?? 0) - (record.playedAt ?? 0)) }))
        .sort((a, b) => a.distance - b.distance);
      if (timed[0] && timed[0].distance <= 15 * 60 * 1000) {
        return { ...record, path: timed[0].candidate.path };
      }
    }

    if (record.source === "vlc") {
      const vlcCandidates = pathRecords.filter((candidate) => candidate.source === "vlc" && candidate.path);
      if (vlcCandidates.length > 0) return { ...record, path: vlcCandidates[0].path };
    }
    return record;
  });
}

function mergeRecords(records: ExternalPlaybackRecord[]): ExternalPlaybackRecord[] {
  const byKey = new Map<string, ExternalPlaybackRecord>();
  for (const record of records) {
    const key = recordKey(record);
    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, record);
      continue;
    }
    byKey.set(key, {
      ...previous,
      ...record,
      path: record.path ?? previous.path,
      title: record.title ?? previous.title,
      albumTitle: record.albumTitle ?? previous.albumTitle,
      positionSeconds: Math.max(previous.positionSeconds ?? 0, record.positionSeconds ?? 0),
      durationSeconds: Math.max(previous.durationSeconds ?? 0, record.durationSeconds ?? 0),
      playedAt: Math.max(previous.playedAt ?? 0, record.playedAt ?? 0) || null,
      completed: previous.completed || record.completed,
    });
  }
  return [...byKey.values()];
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

function bestRecordMatch(
  record: ExternalPlaybackRecord,
  files: MediaFile[],
  items: MediaItem[],
): { file: MediaFile; item: MediaItem } | null {
  if (record.path) {
    const file = bestFileMatch(record.path, files);
    if (!file) return null;
    const item = items.find((candidate) => candidate.mediaFileId === file.id);
    return item ? { file, item } : null;
  }

  const title = normalizedMediaLabel(record.title);
  if (!title) return null;
  const candidates = files.flatMap((file) => {
    const item = items.find((candidate) => candidate.mediaFileId === file.id);
    if (!item) return [];
    const labels = new Set([
      normalizedMediaLabel(file.fileName),
      normalizedMediaLabel(item.title),
      normalizedMediaLabel(item.episodeTitle),
    ].filter(Boolean));
    return labels.has(title) ? [{ file, item }] : [];
  });
  return candidates.length === 1 ? candidates[0] : null;
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
    const match = bestRecordMatch(record, files, items);
    if (!match) {
      unmatched += 1;
      return;
    }
    const { item } = match;
    if (item.type === "unmatched") {
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
  handle: FileSystemHandle,
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


async function openHistoryBridgeDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) {
    throw new Error("Use current Chrome or Edge on Windows to connect the StreamLocal history bridge folder.");
  }
  return window.showDirectoryPicker({
    id: normalizePickerId("sl-player-history-bridge"),
    mode: "read",
    startIn: "documents",
  });
}

async function filesFromBridgeDirectory(
  handle: FileSystemDirectoryHandle,
  requestPermission: boolean,
): Promise<Map<string, File>> {
  if (!(await permissionGranted(handle, requestPermission))) {
    throw new Error("StreamLocal does not currently have permission to read the history bridge folder.");
  }

  const files = new Map<string, File>();
  for await (const [name, child] of handle.entries()) {
    if (!("getFile" in child) || typeof child.getFile !== "function") continue;
    const lower = name.toLowerCase();
    if (![
      "vlc-qt-interface.ini",
      "mediaplayer.db",
      "mediaplayer.db-wal",
      "appstate.json",
      "bridge-status.json",
      "live-playback-history.json",
    ].includes(lower)) continue;
    files.set(lower, await child.getFile());
  }
  return files;
}

export async function connectExternalHistoryBridge(): Promise<ExternalHistoryImportReport[]> {
  const handle = await openHistoryBridgeDirectory();
  await saveSetting(BRIDGE_DIRECTORY_KEY, handle);
  await saveSetting(BRIDGE_SIGNATURE_KEY, "");
  return syncExternalHistoryBridge({ requestPermission: true, force: true });
}

export async function syncExternalHistoryBridge(options: SyncOptions = {}): Promise<ExternalHistoryImportReport[]> {
  const handle = await settingValue<FileSystemDirectoryHandle>(BRIDGE_DIRECTORY_KEY);
  if (!handle) return [];

  const files = await filesFromBridgeDirectory(handle, options.requestPermission ?? false);
  const payloadFiles = [...files.values()].filter((file) => file.name.toLowerCase() !== "bridge-status.json");
  if (payloadFiles.length === 0) {
    if (options.force) {
      throw new Error(
        "No mirrored player-history files were found. Start scripts\\start-player-history-bridge.cmd, then select Documents\\StreamLocal\\ExternalPlayerHistory.",
      );
    }
    return [];
  }

  const currentSignature = signature(payloadFiles);
  const previousSignature = await settingValue<string>(BRIDGE_SIGNATURE_KEY);
  if (!options.force && previousSignature === currentSignature) return [];

  const reports: ExternalHistoryImportReport[] = [];
  const vlc = files.get("vlc-qt-interface.ini");
  const database = files.get("mediaplayer.db");
  const appState = files.get("appstate.json");
  const liveHistory = files.get("live-playback-history.json");
  const liveRecords = liveHistory ? parseLivePlaybackHistory(await liveHistory.text()) : [];

  const vlcStatic = vlc ? parseVlcRecentHistory(await vlc.text()) : [];
  const vlcLive = attachLiveSessionPaths(
    liveRecords.filter((record) => record.source === "vlc"),
    vlcStatic,
  );
  if (vlcStatic.length > 0 || vlcLive.length > 0) {
    reports.push(await applyRecords("VLC", [...vlcStatic, ...vlcLive]));
  }

  const windowsStatic: ExternalPlaybackRecord[] = [];
  if (database) {
    const databaseBytes = new Uint8Array(await database.arrayBuffer());
    const wal = files.get("mediaplayer.db-wal");
    const walBytes = wal ? new Uint8Array(await wal.arrayBuffer()) : null;
    try {
      windowsStatic.push(...parseWindowsMediaPlayerDatabase(databaseBytes, walBytes));
    } catch (error) {
      if (!walBytes) throw error;
      windowsStatic.push(...parseWindowsMediaPlayerDatabase(databaseBytes, null));
    }
  }
  if (appState) windowsStatic.push(...parseWindowsMediaPlayerAppState(await appState.text()));
  const windowsLive = attachLiveSessionPaths(
    liveRecords.filter((record) => record.source === "windows_media_player"),
    windowsStatic,
  );
  if (windowsStatic.length > 0 || windowsLive.length > 0) {
    reports.push(await applyRecords("Windows Media Player", [...windowsStatic, ...windowsLive]));
  }

  const sources: BridgeSources = {
    vlc: Boolean(vlc || liveRecords.some((record) => record.source === "vlc")),
    windowsMediaPlayer: Boolean(database || appState || liveRecords.some((record) => record.source === "windows_media_player")),
  };
  await Promise.all([
    saveSetting(BRIDGE_SIGNATURE_KEY, currentSignature),
    saveSetting(BRIDGE_SOURCES_KEY, sources),
  ]);
  return reports;
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
    const databaseBytes = new Uint8Array(await databaseFile.arrayBuffer());
    const walFile = byName.get("mediaplayer.db-wal");
    const walBytes = walFile ? new Uint8Array(await walFile.arrayBuffer()) : null;
    try {
      records.push(...parseWindowsMediaPlayerDatabase(databaseBytes, walBytes));
    } catch (error) {
      if (!walBytes) throw error;
      records.push(...parseWindowsMediaPlayerDatabase(databaseBytes, null));
    }
  }
  const appState = byName.get("appstate.json");
  if (appState) records.push(...parseWindowsMediaPlayerAppState(await appState.text()));

  const report = await applyRecords("Windows Media Player", records);
  await saveSetting(WINDOWS_SIGNATURE_KEY, currentSignature);
  return report;
}

export async function syncConnectedExternalHistories(options: SyncOptions = {}): Promise<ExternalHistoryImportReport[]> {
  const bridge = await settingValue<FileSystemDirectoryHandle>(BRIDGE_DIRECTORY_KEY);
  if (bridge) {
    try {
      return await syncExternalHistoryBridge(options);
    } catch (error) {
      if (options.force) throw error;
      console.warn("External playback history bridge sync failed:", error);
      return [];
    }
  }

  // Legacy direct-file handles are retained for existing installations, but
  // Chromium may block AppData and other protected locations. New connections
  // should use the safe Documents bridge folder instead.
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
  bridge: boolean;
  vlc: boolean;
  windowsMediaPlayer: boolean;
}> {
  const [bridge, bridgeSources, vlc, windows] = await Promise.all([
    settingValue<FileSystemDirectoryHandle>(BRIDGE_DIRECTORY_KEY),
    settingValue<BridgeSources>(BRIDGE_SOURCES_KEY),
    settingValue<FileSystemFileHandle>(VLC_HANDLE_KEY),
    settingValue<SavedWindowsHandles>(WINDOWS_HANDLES_KEY),
  ]);
  if (bridge) {
    try {
      const files = await filesFromBridgeDirectory(bridge, false);
      const live = files.get("live-playback-history.json");
      const liveRecords = live ? parseLivePlaybackHistory(await live.text()) : [];
      return {
        bridge: true,
        vlc: Boolean(files.get("vlc-qt-interface.ini") || liveRecords.some((record) => record.source === "vlc")),
        windowsMediaPlayer: Boolean(
          files.get("mediaplayer.db") ||
          files.get("appstate.json") ||
          liveRecords.some((record) => record.source === "windows_media_player"),
        ),
      };
    } catch {
      return {
        bridge: true,
        vlc: bridgeSources?.vlc ?? false,
        windowsMediaPlayer: bridgeSources?.windowsMediaPlayer ?? false,
      };
    }
  }
  return {
    bridge: false,
    vlc: Boolean(vlc),
    windowsMediaPlayer: Boolean(windows?.database || windows?.appState),
  };
}
