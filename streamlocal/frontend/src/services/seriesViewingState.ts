import { db } from "../db/streamlocalDb";
import type { MediaItem } from "../types/library";
import { setWatchedState } from "./libraryManagement";

export type SeriesViewingState = {
  seriesId: string;
  status: "not_started" | "in_progress";
  lastWatchedEpisodeId: string | null;
  updatedAt: number;
};

function key(seriesId: string): string {
  return `series.viewing.${seriesId}`;
}

export async function getSeriesViewingState(
  seriesId: string,
): Promise<SeriesViewingState | null> {
  const setting = await db.settings.get(key(seriesId));
  return (setting?.value as SeriesViewingState | undefined) ?? null;
}

export async function setSeriesLastWatchedEpisode(
  seriesId: string,
  episode: MediaItem,
  episodes: MediaItem[],
): Promise<SeriesViewingState> {
  const selectedIndex = episodes.findIndex((item) => item.id === episode.id);
  const watchedThrough = selectedIndex >= 0 ? episodes.slice(0, selectedIndex + 1) : [episode];

  for (const item of watchedThrough) await setWatchedState(item, true);

  const state: SeriesViewingState = {
    seriesId,
    status: "in_progress",
    lastWatchedEpisodeId: episode.id,
    updatedAt: Date.now(),
  };
  await db.settings.put({ key: key(seriesId), value: state });
  return state;
}

export async function setSeriesNotWatched(
  seriesId: string,
  episodes: MediaItem[],
): Promise<SeriesViewingState> {
  await db.playbackProgress.bulkDelete(episodes.map((item) => item.id));
  const state: SeriesViewingState = {
    seriesId,
    status: "not_started",
    lastWatchedEpisodeId: null,
    updatedAt: Date.now(),
  };
  await db.settings.put({ key: key(seriesId), value: state });
  return state;
}
