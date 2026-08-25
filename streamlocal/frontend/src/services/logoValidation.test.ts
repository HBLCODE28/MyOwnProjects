import { describe, expect, it } from "vitest";
import { analyzeLogoPixels, isRejectedLogoCandidateName } from "./logoValidation";

function pixels(entries: Array<[number, number, number, number]>): Uint8ClampedArray {
  return new Uint8ClampedArray(entries.flat());
}

describe("logo validation", () => {
  it("ignores transparent pixels when deciding whether a logo is black", () => {
    const data = pixels([
      [0, 0, 0, 0],
      [255, 255, 255, 255],
      [240, 240, 240, 255],
      [0, 0, 0, 0],
      [255, 255, 255, 255],
      [240, 240, 240, 255],
      [255, 255, 255, 255],
      [240, 240, 240, 255],
      [255, 255, 255, 255],
      [240, 240, 240, 255],
      [255, 255, 255, 255],
      [240, 240, 240, 255],
    ]);
    expect(analyzeLogoPixels(data, 4, 3).usable).toBe(true);
  });

  it("rejects artwork that is overwhelmingly black", () => {
    const data = new Uint8ClampedArray(12 * 4);
    for (let index = 0; index < data.length; index += 4) {
      data[index] = 4;
      data[index + 1] = 4;
      data[index + 2] = 4;
      data[index + 3] = 255;
    }
    expect(analyzeLogoPixels(data, 4, 3).usable).toBe(false);
  });

  it("rejects poster and frame candidates by name", () => {
    expect(isRejectedLogoCandidateName("Dune poster logo.png")).toBe(true);
    expect(isRejectedLogoCandidateName("Breaking Bad video frame.jpg")).toBe(true);
    expect(isRejectedLogoCandidateName("Stranger Things logo transparent.png")).toBe(false);
  });
});
