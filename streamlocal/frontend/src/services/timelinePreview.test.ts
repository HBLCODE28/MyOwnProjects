import { describe, expect, it } from "vitest";
import {
  timelinePreviewPosition,
  TIMELINE_PREVIEW_INTERVAL,
} from "./timelinePreview";

describe("timeline previews", () => {
  it("rounds hover positions to a small cache interval", () => {
    expect(timelinePreviewPosition(0)).toBe(0);
    expect(timelinePreviewPosition(2.2)).toBe(0);
    expect(timelinePreviewPosition(7.6)).toBe(TIMELINE_PREVIEW_INTERVAL * 2);
  });

  it("handles invalid positions safely", () => {
    expect(timelinePreviewPosition(Number.NaN)).toBe(0);
    expect(timelinePreviewPosition(-10)).toBe(0);
  });
});
