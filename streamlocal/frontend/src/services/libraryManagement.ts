import { db } from "../db/streamlocalDb";
import type { MediaItem } from "../types/library";

export async function removeMediaFileFromLibrary(mediaFileId: string): Promise<void> {
  const items = await db.mediaItems.where("mediaFileId").equals(mediaFileId).toArray();
  const itemIds = items.map((item) => item.id);

  await db.transaction(
    "rw",
    [db.mediaFiles, db.mediaItems, db.playbackProgress, db.mediaSegments],
    async () => {
      await db.playbackProgress.bulkDelete(itemIds);
      const segments = await db.mediaSegments.toArray();
      await db.mediaSegments.bulkDelete(
        segments.filter((segment) => itemIds.includes(segment.mediaItemId)).map((segment) => segment.id),
      );
      await db.mediaItems.bulkDelete(itemIds);
      await db.mediaFiles.delete(mediaFileId);
    },
  );
}

export async function setWatchedState(item: MediaItem, watched: boolean): Promise<void> {
  const previous = await db.playbackProgress.get(item.id);
  const now = Date.now();
  const duration = previous?.durationSeconds ?? 0;
  await db.playbackProgress.put({
    mediaItemId: item.id,
    positionSeconds: watched ? duration : previous?.positionSeconds ?? 0,
    durationSeconds: duration,
    percent: watched ? 1 : previous?.percent ?? 0,
    started: previous?.started ?? watched,
    firstPlayedAt: previous?.firstPlayedAt ?? (watched ? now : null),
    watched,
    lastPlayedAt: now,
    completedAt: watched ? previous?.completedAt ?? now : null,
  });
}
