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

  it("rejects a mostly-black logo even when it has a small bright subtitle", () => {
    const entries: Array<[number, number, number, number]> = [];
    for (let index = 0; index < 40; index += 1) {
      entries.push(index < 32
        ? [28, 28, 28, 255]
        : [242, 190, 48, 255]);
    }
    expect(analyzeLogoPixels(pixels(entries), 10, 4).usable).toBe(false);
  });

  it("keeps a saturated red logo readable on a dark interface", () => {
    const entries: Array<[number, number, number, number]> = [];
    for (let index = 0; index < 40; index += 1) {
      entries.push([188, 18, 32, 255]);
    }
    expect(analyzeLogoPixels(pixels(entries), 10, 4).usable).toBe(true);
  });


  it("rejects an opaque white matte behind a logo", () => {
    const entries: Array<[number, number, number, number]> = [];
    for (let index = 0; index < 160; index += 1) {
      entries.push(index < 132
        ? [248, 248, 248, 255]
        : [176, 18, 28, 255]);
    }

    const result = analyzeLogoPixels(pixels(entries), 20, 8);
    expect(result.nearWhitePixelRatio).toBeGreaterThan(0.58);
    expect(result.usable).toBe(false);
  });

  it("rejects poster and frame candidates by name", () => {
    expect(isRejectedLogoCandidateName("Dune poster logo.png")).toBe(true);
    expect(isRejectedLogoCandidateName("Breaking Bad video frame.jpg")).toBe(true);
    expect(isRejectedLogoCandidateName("Stranger Things logo transparent.png")).toBe(false);
  });
  it("rejects a fully opaque photographic rectangle used as a logo", () => {
    const entries: Array<[number, number, number, number]> = [];
    for (let y = 0; y < 12; y += 1) {
      for (let x = 0; x < 20; x += 1) {
        entries.push([
          (x * 31 + y * 17) % 220 + 20,
          (x * 13 + y * 37) % 220 + 20,
          (x * 47 + y * 11) % 220 + 20,
          255,
        ]);
      }
    }
    expect(analyzeLogoPixels(pixels(entries), 20, 12).usable).toBe(false);
  });

  it("rejects an opaque photo-like title card even with fewer quantized colors", () => {
    const entries: Array<[number, number, number, number]> = [];
    const palette: Array<[number, number, number]> = [
      [42, 58, 74], [88, 110, 126], [150, 132, 104], [202, 188, 158],
      [36, 74, 48], [118, 82, 64], [210, 222, 226], [82, 42, 34],
    ];
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const [r, g, b] = palette[(x * 3 + y * 5) % palette.length];
        entries.push([r, g, b, 255]);
      }
    }
    expect(analyzeLogoPixels(pixels(entries), 16, 10).usable).toBe(false);
  });

});
