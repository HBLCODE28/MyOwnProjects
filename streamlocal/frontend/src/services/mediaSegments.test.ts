import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/streamlocalDb";
import {
  activeMediaSegment,
  getMediaSegments,
  replaceManualMediaSegments,
} from "./mediaSegments";

describe("media segments", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("stores manual segments and finds the active segment", async () => {
    await replaceManualMediaSegments("item-1", {
      intro: { startSeconds: 10, endSeconds: 40 },
      credits: { startSeconds: 500, endSeconds: 600 },
    });

    const segments = await getMediaSegments("item-1");
    expect(segments).toHaveLength(2);
    expect(activeMediaSegment(segments, 20)?.type).toBe("intro");
    expect(activeMediaSegment(segments, 450)).toBeNull();
    expect(activeMediaSegment(segments, 550)?.type).toBe("credits");
  });

  it("rejects reversed segment ranges", async () => {
    await expect(
      replaceManualMediaSegments("item-1", {
        recap: { startSeconds: 100, endSeconds: 20 },
      }),
    ).rejects.toThrow("recap segment times are invalid");
  });
});
