import { db } from "../db/streamlocalDb";

export type UnavailableCleanupResult = {
  unavailableFiles: number;
  removedItems: number;
  removedSeries: number;
  removedArtwork: number;
};

/**
 * Remove only StreamLocal records whose source files are unavailable.
 * The File System Access API is never used here, so original media files
 * cannot be deleted by this operation.
 */
export async function removeUnavailableEntries(): Promise<UnavailableCleanupResult> {
  return db.transaction(
    "rw",
    [
      db.mediaFiles,
      db.mediaItems,
      db.playbackProgress,
      db.series,
      db.artwork,
      db.timelinePreviews,
    ],
    async () => {
      const unavailableFiles = await db.mediaFiles
        .filter((file) => file.available === false)
        .toArray();
      const unavailableFileIds = new Set(unavailableFiles.map((file) => file.id));
      const items = await db.mediaItems.toArray();
      const itemsToRemove = items.filter((item) => unavailableFileIds.has(item.mediaFileId));
      const itemIds = itemsToRemove.map((item) => item.id);

      if (itemIds.length > 0) {
        await db.playbackProgress.bulkDelete(itemIds);
        await db.mediaItems.bulkDelete(itemIds);
      }

      await db.mediaFiles.bulkDelete(unavailableFiles.map((file) => file.id));
      const previewRows = await db.timelinePreviews.toArray();
      await db.timelinePreviews.bulkDelete(
        previewRows
          .filter((preview) => unavailableFileIds.has(preview.mediaFileId))
          .map((preview) => preview.id),
      );

      const allSeries = await db.series.toArray();
      const remainingItems = await db.mediaItems.toArray();
      const remainingSeriesIds = new Set(
        remainingItems
          .map((item) => item.seriesId)
          .filter((id): id is string => Boolean(id)),
      );
      const emptySeries = allSeries.filter((series) => !remainingSeriesIds.has(series.id));
      await db.series.bulkDelete(emptySeries.map((series) => series.id));

      const remainingItemsAfterSeries = await db.mediaItems.toArray();
      const remainingSeries = await db.series.toArray();
      const referencedArtworkIds = new Set<string>();
      for (const item of remainingItemsAfterSeries) {
        if (item.posterArtworkId) referencedArtworkIds.add(item.posterArtworkId);
        if (item.backdropArtworkId) referencedArtworkIds.add(item.backdropArtworkId);
      }
      for (const series of remainingSeries) {
        if (series.posterArtworkId) referencedArtworkIds.add(series.posterArtworkId);
        if (series.backdropArtworkId) referencedArtworkIds.add(series.backdropArtworkId);
      }

      const artworkRows = await db.artwork.toArray();
      const orphanedArtwork = artworkRows.filter(
        (artwork) => !referencedArtworkIds.has(artwork.id),
      );
      await db.artwork.bulkDelete(orphanedArtwork.map((artwork) => artwork.id));

      return {
        unavailableFiles: unavailableFiles.length,
        removedItems: itemsToRemove.length,
        removedSeries: emptySeries.length,
        removedArtwork: orphanedArtwork.length,
      };
    },
  );
}
