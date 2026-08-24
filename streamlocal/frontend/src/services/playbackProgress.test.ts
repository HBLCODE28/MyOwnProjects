import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/streamlocalDb";
import type { MediaItem } from "../types/library";
import {
  markPlaybackStarted,
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
});
