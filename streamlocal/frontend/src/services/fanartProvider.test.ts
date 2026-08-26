import { describe, expect, it } from "vitest";
import { fanartResponseMatchesRequestedId } from "./fanartProvider";

describe("Fanart provider identity validation", () => {
  it("accepts the exact IMDb movie ID returned by Fanart", () => {
    expect(fanartResponseMatchesRequestedId(
      "movie",
      "tt0816692",
      { name: "Interstellar", imdb_id: "tt0816692", tmdb_id: "157336" },
    )).toBe(true);
  });

  it("rejects a Fanart movie response for a different IMDb title", () => {
    expect(fanartResponseMatchesRequestedId(
      "movie",
      "tt0816692",
      { name: "Interstellar", imdb_id: "tt9999999", tmdb_id: "1" },
    )).toBe(false);
  });

  it("rejects a Fanart TV response for another TVDB series", () => {
    expect(fanartResponseMatchesRequestedId(
      "tv",
      "81189",
      { name: "Breaking Bad", thetvdb_id: "99999" },
    )).toBe(false);
  });
});
