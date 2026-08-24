import { describe, expect, it } from "vitest";
import { parseMediaName } from "./filenameParser";

describe("parseMediaName", () => {
  it("parses a movie with year and release noise", () => {
    const result = parseMediaName("Dune.Part.Two.2024.2160p.WEB-DL.mkv");
    expect(result.type).toBe("movie");
    expect(result.title).toContain("Dune");
    expect(result.year).toBe(2024);
  });

  it("parses S02E03", () => {
    const result = parseMediaName(
      "Severance.S02E03.1080p.WEB-DL.mkv",
      "Severance/Season 02/Severance.S02E03.1080p.WEB-DL.mkv",
    );
    expect(result.type).toBe("episode");
    expect(result.title).toBe("Severance");
    expect(result.seasonNumber).toBe(2);
    expect(result.episodeNumber).toBe(3);
  });

  it("parses 1x07", () => {
    const result = parseMediaName("Show.Name.1x07.HDTV.mp4");
    expect(result.type).toBe("episode");
    expect(result.seasonNumber).toBe(1);
    expect(result.episodeNumber).toBe(7);
  });

  it("uses parent folder when filename only has SxxExx", () => {
    const result = parseMediaName("S02E03.mkv", "Severance/Season 02/S02E03.mkv");
    expect(result.type).toBe("episode");
    expect(result.title).toBe("Severance");
  });
});
