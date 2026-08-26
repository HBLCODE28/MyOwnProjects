import { db } from "../db/streamlocalDb";
import type {
  MediaItem,
  PlaybackProgress,
} from "../types/library";

export function watchedFromPosition(
  item: Pick<MediaItem, "type">,
  positionSeconds: number,
  durationSeconds: number,
): boolean {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;

  const percent = positionSeconds / durationSeconds;
  const remaining = Math.max(0, durationSeconds - positionSeconds);

  if (percent >= 0.9) return true;

  if (item.type === "movie") {
    // A short test clip can have five minutes remaining at the very start.
    // Only use the remaining-time shortcut for feature-length media; shorter
    // movies still become watched at the authoritative 90% threshold.
    return durationSeconds > 10 * 60 && remaining <= 5 * 60;
  }

  if (item.type === "episode") {
    return remaining <= 2 * 60;
  }

  return false;
}

export async function markPlaybackStarted(
  item: MediaItem,
): Promise<PlaybackProgress> {
  const previous = await db.playbackProgress.get(item.id);
  const now = Date.now();

  const record: PlaybackProgress = {
    mediaItemId: item.id,
    positionSeconds: previous?.positionSeconds ?? 0,
    durationSeconds: previous?.durationSeconds ?? 0,
    percent: previous?.percent ?? 0,
    started: true,
    firstPlayedAt: previous?.firstPlayedAt ?? now,
    watched: previous?.watched ?? false,
    lastPlayedAt: now,
    completedAt: previous?.completedAt ?? null,
  };

  await db.playbackProgress.put(record);
  return record;
}

export async function savePlaybackProgress(
  item: MediaItem,
  positionSeconds: number,
  durationSeconds: number,
): Promise<PlaybackProgress | null> {
  if (
    !Number.isFinite(positionSeconds) ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return null;
  }

  const normalizedPosition = Math.max(
    0,
    Math.min(positionSeconds, durationSeconds),
  );
  const percent = Math.max(
    0,
    Math.min(1, normalizedPosition / durationSeconds),
  );
  const previous = await db.playbackProgress.get(item.id);
  const watched =
    previous?.watched === true ||
    watchedFromPosition(
      item,
      normalizedPosition,
      durationSeconds,
    );
  const now = Date.now();

  const record: PlaybackProgress = {
    mediaItemId: item.id,
    positionSeconds: normalizedPosition,
    durationSeconds,
    percent,
    started: true,
    firstPlayedAt: previous?.firstPlayedAt ?? now,
    watched,
    lastPlayedAt: now,
    completedAt: watched
      ? previous?.completedAt ?? now
      : null,
  };

  await db.playbackProgress.put(record);
  return record;
}


export async function markPlaybackCompleted(
  item: MediaItem,
  positionSeconds: number,
  durationSeconds: number,
): Promise<PlaybackProgress> {
  const previous = await db.playbackProgress.get(item.id);
  const now = Date.now();

  const finitePosition =
    Number.isFinite(positionSeconds) && positionSeconds > 0
      ? positionSeconds
      : 0;
  const finiteDuration =
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : 0;

  const resolvedDuration =
    finiteDuration || previous?.durationSeconds || finitePosition;
  const resolvedPosition =
    resolvedDuration > 0
      ? resolvedDuration
      : finitePosition || previous?.positionSeconds || 0;

  const record: PlaybackProgress = {
    mediaItemId: item.id,
    positionSeconds: resolvedPosition,
    durationSeconds: resolvedDuration,
    percent: 1,
    started: true,
    firstPlayedAt: previous?.firstPlayedAt ?? now,
    watched: true,
    lastPlayedAt: now,
    completedAt: previous?.completedAt ?? now,
  };

  await db.playbackProgress.put(record);
  return record;
}

export async function getPlaybackProgress(
  mediaItemId: string,
): Promise<PlaybackProgress | null> {
  return (await db.playbackProgress.get(mediaItemId)) ?? null;
}

export async function clearPlaybackProgress(
  mediaItemId: string,
): Promise<void> {
  await db.playbackProgress.delete(mediaItemId);
}

export async function continueWatching(
  limit = 12,
): Promise<PlaybackProgress[]> {
  const rows = await db.playbackProgress
    .orderBy("lastPlayedAt")
    .reverse()
    .toArray();

  return rows
    .filter(
      (row) =>
        !row.watched &&
        row.positionSeconds > 10 &&
        row.percent < 0.9,
    )
    .slice(0, limit);
}
