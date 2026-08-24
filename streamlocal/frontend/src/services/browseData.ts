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
    progress?: PlaybackProgress;
    reason: "resume" | "next_episode";
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
          reason: "resume" as const,
        },
      ];
    });

  const progressByItem = new Map(progressRows.map((row) => [row.mediaItemId, row]));
  const episodesBySeries = new Map<string, MediaItem[]>();
  for (const episode of episodeItems) {
    if (!episode.seriesId) continue;
    const episodes = episodesBySeries.get(episode.seriesId) ?? [];
    episodes.push(episode);
    episodesBySeries.set(episode.seriesId, episodes);
  }

  const nextEpisodeRows = progressRows
    .filter((row) => row.watched)
    .flatMap((progress) => {
      const watched = itemById.get(progress.mediaItemId);
      if (!watched?.seriesId) return [];
      const episodes = (episodesBySeries.get(watched.seriesId) ?? []).sort(
        (a, b) =>
          (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) ||
          (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0),
      );
      const index = episodes.findIndex((episode) => episode.id === watched.id);
      const next = index >= 0 ? episodes[index + 1] : undefined;
      const nextFile = next ? fileById.get(next.mediaFileId) : undefined;
      const nextProgress = next ? progressByItem.get(next.id) : undefined;
      if (!next || !nextFile?.available || nextProgress?.watched) return [];
      return [{ item: next, file: nextFile, progress: nextProgress, reason: "next_episode" as const }];
    });

  const seenContinueIds = new Set<string>();
  const continueWatching = [...continueRows, ...nextEpisodeRows]
    .filter((entry) => {
      if (seenContinueIds.has(entry.item.id)) return false;
      seenContinueIds.add(entry.item.id);
      return true;
    })
    .sort((a, b) =>
      (b.progress?.lastPlayedAt ?? 0) - (a.progress?.lastPlayedAt ?? 0),
    )
    .slice(0, 12);

  return {
    movies,
    series: groupSeries(seriesRows, episodeItems, files),
    items,
    files,
    progressByItemId,
    continueWatching,
    counts: libraryCounts(items, files),
  };
}
