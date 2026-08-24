import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/streamlocalDb";
import { getPlaybackSetting, setPlaybackSetting } from "./maintenance";

describe("maintenance settings", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("persists playback preferences in IndexedDB", async () => {
    expect(await getPlaybackSetting("playback.seekInterval", 5)).toBe(5);
    await setPlaybackSetting("playback.seekInterval", 15);
    expect(await getPlaybackSetting("playback.seekInterval", 5)).toBe(15);
  });
});
