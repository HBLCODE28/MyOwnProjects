import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/streamlocalDb";
import type { MediaItem } from "../types/library";
import { removeMediaFileFromLibrary, setWatchedState } from "./libraryManagement";

const item: MediaItem = {
  id: "item-1",
  mediaFileId: "file-1",
  type: "movie",
  title: "Movie",
  year: 2026,
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
};

describe("library management", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.mediaFiles.add({
      id: "file-1",
      sourceId: "source-1",
      relativePath: "Movie.mp4",
      fileName: "Movie.mp4",
      extension: "mp4",
      size: 1,
      lastModified: 1,
      fingerprint: "fingerprint",
      available: true,
      lastSeenAt: 1,
    });
    await db.mediaItems.add(item);
  });

  it("marks an item watched and unwatched", async () => {
    await setWatchedState(item, true);
    expect((await db.playbackProgress.get(item.id))?.watched).toBe(true);
    await setWatchedState(item, false);
    expect((await db.playbackProgress.get(item.id))?.watched).toBe(false);
  });

  it("removes database records without physical-file access", async () => {
    await removeMediaFileFromLibrary("file-1");
    expect(await db.mediaFiles.get("file-1")).toBeUndefined();
    expect(await db.mediaItems.get(item.id)).toBeUndefined();
  });
});
