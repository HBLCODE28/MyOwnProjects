import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/streamlocalDb";
import { removeUnavailableEntries } from "./libraryCleanup";

describe("unavailable library cleanup", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("removes unavailable database records without touching available media", async () => {
    await db.mediaFiles.bulkAdd([
      {
        id: "file-unavailable",
        sourceId: "source-1",
        relativePath: "gone/movie.mp4",
        fileName: "movie.mp4",
        extension: "mp4",
        size: 10,
        lastModified: 1,
        fingerprint: "gone",
        available: false,
        lastSeenAt: 1,
      },
      {
        id: "file-available",
        sourceId: "source-1",
        relativePath: "here/show.mp4",
        fileName: "show.mp4",
        extension: "mp4",
        size: 20,
        lastModified: 1,
        fingerprint: "here",
        available: true,
        lastSeenAt: 1,
      },
    ]);
    await db.mediaItems.bulkAdd([
      {
        id: "item-unavailable",
        mediaFileId: "file-unavailable",
        type: "movie",
        title: "Gone",
        year: null,
        overview: "",
        genres: [],
        seriesId: null,
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        confidence: "high",
        matchStatus: "matched",
        manuallyEdited: false,
        posterArtworkId: null,
        backdropArtworkId: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "item-available",
        mediaFileId: "file-available",
        type: "movie",
        title: "Here",
        year: null,
        overview: "",
        genres: [],
        seriesId: null,
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        confidence: "high",
        matchStatus: "matched",
        manuallyEdited: false,
        posterArtworkId: null,
        backdropArtworkId: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    await db.playbackProgress.put({
      mediaItemId: "item-unavailable",
      positionSeconds: 30,
      durationSeconds: 600,
      percent: 0.05,
      started: true,
      firstPlayedAt: 1,
      watched: false,
      lastPlayedAt: 1,
      completedAt: null,
    });

    const result = await removeUnavailableEntries();

    expect(result.unavailableFiles).toBe(1);
    expect(result.removedItems).toBe(1);
    expect(await db.mediaFiles.get("file-unavailable")).toBeUndefined();
    expect(await db.mediaItems.get("item-unavailable")).toBeUndefined();
    expect(await db.playbackProgress.get("item-unavailable")).toBeUndefined();
    expect(await db.mediaFiles.get("file-available")).toBeDefined();
    expect(await db.mediaItems.get("item-available")).toBeDefined();
  });
});
