import { db } from "../db/streamlocalDb";
import type {
  MediaFile,
  MediaItem,
  PlaybackProgress,
} from "../types/library";
import {
  groupSeries,
  libraryCounts,
  type MovieCard,
  type SeriesCard,
} from "./browseSelectors";

export type BrowseData = {
  movies: MovieCard[];
  series: SeriesCard[];
  items: MediaItem[];
  files: MediaFile[];
  progressByItemId: Record<string, PlaybackProgress>;
  continueWatching: Array<{
    item: MediaItem;
    file: MediaFile | undefined;
    progress: PlaybackProgress;
  }>;
  counts: {
    movies: number;
    episodes: number;
    availableItems: number;
    needsMatch: number;
  };
};

export async function loadBrowseData(): Promise<BrowseData> {
  const [items, files, seriesRows, progressRows] = await Promise.all([
    db.mediaItems.toArray(),
    db.mediaFiles.toArray(),
    db.series.toArray(),
    db.playbackProgress.toArray(),
  ]);

  const fileById = new Map(files.map((file) => [file.id, file]));
  const itemById = new Map(items.map((item) => [item.id, item]));

  const movies = items
    .filter((item) => item.type === "movie")
    .map((item) => ({
      item,
      file: fileById.get(item.mediaFileId),
    }))
    .sort((a, b) => a.item.title.localeCompare(b.item.title));

  const episodeItems = items.filter((item) => item.type === "episode");

  const progressByItemId = Object.fromEntries(
    progressRows.map((row) => [row.mediaItemId, row]),
  );

  const continueRows = progressRows
    .filter(
      (row) =>
        !row.watched &&
        row.positionSeconds > 10 &&
        row.percent < 0.9,
    )
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
    .slice(0, 12)
    .flatMap((progress) => {
      const item = itemById.get(progress.mediaItemId);
      if (!item) return [];
      return [
        {
          item,
          file: fileById.get(item.mediaFileId),
          progress,
        },
      ];
    });

  return {
    movies,
    series: groupSeries(seriesRows, episodeItems, files),
    items,
    files,
    progressByItemId,
    continueWatching: continueRows,
    counts: libraryCounts(items, files),
  };
}
