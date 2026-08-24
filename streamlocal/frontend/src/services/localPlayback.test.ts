import { describe, expect, it } from "vitest";
import { browserContainerHint, isSupportedLocalContainer } from "./localPlayback";

describe("Stage 6 local playback compatibility", () => {
  it("accepts MP4 and MKV containers", () => {
    expect(isSupportedLocalContainer("mp4")).toBe(true);
    expect(isSupportedLocalContainer("MKV")).toBe(true);
    expect(isSupportedLocalContainer("avi")).toBe(false);
  });

  it("provides browser MIME hints for supported containers", () => {
    expect(browserContainerHint("mp4")).toBe("video/mp4");
    expect(browserContainerHint("mkv")).toBe("video/x-matroska");
  });
});
