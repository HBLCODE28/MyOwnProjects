import { db } from "../db/streamlocalDb";

export type CacheStats = {
  timelinePreviews: number;
  artwork: number;
  artworkBytes: number;
};

export async function getCacheStats(): Promise<CacheStats> {
  const [timelinePreviews, artwork] = await Promise.all([
    db.timelinePreviews.count(),
    db.artwork.toArray(),
  ]);
  return {
    timelinePreviews,
    artwork: artwork.length,
    artworkBytes: artwork.reduce((total, row) => total + row.blob.size, 0),
  };
}

export async function clearTimelinePreviewCache(): Promise<number> {
  const count = await db.timelinePreviews.count();
  await db.timelinePreviews.clear();
  return count;
}

export async function clearUnreferencedArtwork(): Promise<number> {
  const [items, series, artwork] = await Promise.all([
    db.mediaItems.toArray(),
    db.series.toArray(),
    db.artwork.toArray(),
  ]);
  const referenced = new Set<string>();
  for (const item of items) {
    if (item.posterArtworkId) referenced.add(item.posterArtworkId);
    if (item.backdropArtworkId) referenced.add(item.backdropArtworkId);
    if (item.logoArtworkId) referenced.add(item.logoArtworkId);
  }
  for (const row of series) {
    if (row.posterArtworkId) referenced.add(row.posterArtworkId);
    if (row.backdropArtworkId) referenced.add(row.backdropArtworkId);
    if (row.logoArtworkId) referenced.add(row.logoArtworkId);
  }
  const orphaned = artwork.filter((row) => !referenced.has(row.id));
  await db.artwork.bulkDelete(orphaned.map((row) => row.id));
  return orphaned.length;
}

export async function getPlaybackSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return (row?.value as T | undefined) ?? fallback;
}

export async function setPlaybackSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}
