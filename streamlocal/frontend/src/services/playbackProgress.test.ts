import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/streamlocalDb";
import type { MediaItem } from "../types/library";
import {
  getPlaybackProgress,
  markPlaybackStarted,
  savePlaybackProgress,
  watchedFromPosition,
} from "./playbackProgress";

function episode(): MediaItem {
  return {
    id: "episode-1",
    mediaFileId: "file-1",
    type: "episode",
    title: "Episode",
    year: null,
    overview: "",
    genres: [],
    seriesId: "series-1",
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: "Pilot",
    confidence: "high",
    matchStatus: "matched",
    manuallyEdited: false,
    posterArtworkId: null,
    backdropArtworkId: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

function movie(): MediaItem {
  return {
    ...episode(),
    id: "movie-1",
    mediaFileId: "movie-file-1",
    type: "movie",
    seriesId: null,
    seasonNumber: null,
    episodeNumber: null,
    episodeTitle: null,
  };
}

describe("playback state", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("marks an episode started immediately when the player opens", async () => {
    await markPlaybackStarted(episode());
    const progress = await db.playbackProgress.get("episode-1");
    expect(progress?.started).toBe(true);
    expect(progress?.watched).toBe(false);
  });

  it("marks a movie watched at 90 percent", () => {
    expect(watchedFromPosition({ type: "movie" }, 5400, 6000)).toBe(true);
  });

  it("marks a movie watched with five minutes remaining", () => {
    expect(watchedFromPosition({ type: "movie" }, 6900, 7200)).toBe(true);
  });

  it("marks an episode watched with two minutes remaining", () => {
    expect(watchedFromPosition({ type: "episode" }, 2280, 2400)).toBe(true);
  });

  it("does not mark an early episode watched", () => {
    expect(watchedFromPosition({ type: "episode" }, 600, 2400)).toBe(false);
  });

  it("persists an unfinished movie position for resume", async () => {
    await savePlaybackProgress(movie(), 60, 1200);

    const progress = await getPlaybackProgress("movie-1");
    expect(progress?.positionSeconds).toBe(60);
    expect(progress?.percent).toBe(0.05);
    expect(progress?.started).toBe(true);
    expect(progress?.watched).toBe(false);
  });
});
