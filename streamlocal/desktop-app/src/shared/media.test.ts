import { describe, expect, it } from "vitest";
import { classifyMedia, stableId } from "./media";
describe("media classification", () => {
  it("recognizes season and episode filenames", () => expect(classifyMedia("The.Show.S02E07.1080p.mkv", "TV/The Show/S02/The.Show.S02E07.1080p.mkv")).toMatchObject({ type: "episode", series: "The Show", season: 2, episode: 7 }));
  it("recognizes movies and years", () => expect(classifyMedia("Arrival.2016.2160p.mkv", "Movies/Arrival.2016.2160p.mkv")).toMatchObject({ type: "movie", title: "Arrival", year: 2016 }));
  it("keeps stable IDs stable", () => expect(stableId("one", "A.mkv", 2, 3)).toBe(stableId("one", "A.mkv", 2, 3)));
});
