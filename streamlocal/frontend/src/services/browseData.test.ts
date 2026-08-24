import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/streamlocalDb";
import type { MediaFile, MediaItem, Series } from "../types/library";
import { loadBrowseData } from "./browseData";

const series: Series = {
  id: "series-1",
  normalizedTitle: "example show",
  title: "Example Show",
  year: 2026,
  overview: "",
  genres: [],
  posterArtworkId: null,
  backdropArtworkId: null,
  createdAt: 1,
  updatedAt: 1,
};

function episode(id: string, fileId: string, number: number): MediaItem {
  return {
    id,
    mediaFileId: fileId,
    type: "episode",
    title: "Example Show",
    year: 2026,
    overview: "",
    genres: [],
    seriesId: series.id,
    seasonNumber: 1,
    episodeNumber: number,
    episodeTitle: `Episode ${number}`,
    confidence: "high",
    matchStatus: "matched",
    manuallyEdited: false,
    posterArtworkId: null,
    backdropArtworkId: null,
    createdAt: 1,
    updatedAt: 1,
  };
}

function file(id: string): MediaFile {
  return {
    id,
    sourceId: "source-1",
    relativePath: `${id}.mp4`,
    fileName: `${id}.mp4`,
    extension: "mp4",
    size: 1,
    lastModified: 1,
    fingerprint: id,
    available: true,
    lastSeenAt: 1,
  };
}

describe("browse data", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.series.add(series);
    await db.mediaFiles.bulkAdd([file("file-1"), file("file-2")]);
    await db.mediaItems.bulkAdd([
      episode("episode-1", "file-1", 1),
      episode("episode-2", "file-2", 2),
    ]);
    await db.playbackProgress.add({
      mediaItemId: "episode-1",
      positionSeconds: 1200,
      durationSeconds: 1200,
      percent: 1,
      started: true,
      firstPlayedAt: 1,
      watched: true,
      lastPlayedAt: 2,
      completedAt: 2,
    });
  });

  it("puts the next available episode in Continue Watching after a watched episode", async () => {
    const data = await loadBrowseData();
    expect(data.continueWatching[0]?.item.id).toBe("episode-2");
    expect(data.continueWatching[0]?.reason).toBe("next_episode");
  });
});
