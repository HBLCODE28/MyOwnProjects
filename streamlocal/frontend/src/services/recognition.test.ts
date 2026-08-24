import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/streamlocalDb";
import type { MediaFile } from "../types/library";
import { recognizeFile } from "./recognition";

function mediaFile(id: string, name: string): MediaFile {
  return {
    id,
    sourceId: "source-1",
    relativePath: `Severance/Season 02/${name}`,
    fileName: name,
    extension: "mkv",
    size: 100,
    lastModified: 1,
    fingerprint: `fp-${id}`,
    available: true,
    lastSeenAt: 1,
  };
}

describe("local recognition", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.librarySources.add({
      id: "source-1",
      name: "TV",
      createdAt: 1,
      lastScanAt: null,
      enabled: true,
      recursive: true,
      handle: null,
    });
  });

  it("does not perform a network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const file = mediaFile("f1", "Severance.S02E03.1080p.mkv");
    await db.mediaFiles.add(file);

    await recognizeFile(file);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("groups episodes from the same show into one series", async () => {
    const first = mediaFile("f1", "Severance.S02E03.mkv");
    const second = mediaFile("f2", "Severance.S02E04.mkv");
    await db.mediaFiles.bulkAdd([first, second]);

    const one = await recognizeFile(first);
    const two = await recognizeFile(second);

    expect(one.seriesId).toBeTruthy();
    expect(two.seriesId).toBe(one.seriesId);
    expect(await db.series.count()).toBe(1);
  });

  it("manual edits survive automatic recognition", async () => {
    const file = mediaFile("f1", "Severance.S02E03.mkv");
    await db.mediaFiles.add(file);
    const item = await recognizeFile(file);

    await db.mediaItems.update(item.id, {
      title: "My Custom Episode",
      manuallyEdited: true,
      matchStatus: "matched",
    });

    const after = await recognizeFile(file);
    expect(after.title).toBe("My Custom Episode");
  });
});
