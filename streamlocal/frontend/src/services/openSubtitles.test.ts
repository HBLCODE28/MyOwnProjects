import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/streamlocalDb";
import type { MediaFile, MediaItem, Series } from "../types/library";
import { buildOpenSubtitlesFeatureParams, buildOpenSubtitlesSearchParams, searchOpenSubtitles } from "./openSubtitles";
import * as secretVault from "./secretVault";

const baseItem: MediaItem = {
  id: "item-1", mediaFileId: "file-1", type: "movie", title: "Interstellar", year: 2014,
  overview: "", genres: [], seriesId: null, seasonNumber: null, episodeNumber: null, episodeTitle: null,
  confidence: "high", matchStatus: "matched", manuallyEdited: false, posterArtworkId: null,
  backdropArtworkId: null, logoArtworkId: null, createdAt: 1, updatedAt: 1,
};

const baseFile: MediaFile = {
  id: "file-1", sourceId: "source-1", relativePath: "Interstellar.2014.1080p.BluRay.x265.mkv",
  fileName: "Interstellar.2014.1080p.BluRay.x265.mkv", extension: "mkv", size: 100,
  lastModified: 1, fingerprint: "fingerprint", available: true, lastSeenAt: 1,
};

beforeEach(async () => {
  await Promise.all([db.series.clear(), db.mediaFiles.clear()]);
  await db.mediaFiles.put(baseFile);
  vi.restoreAllMocks();
});

describe("OpenSubtitles search parameters", () => {
  it("resolves movies using exact feature title and year", async () => {
    const params = await buildOpenSubtitlesFeatureParams(baseItem);
    expect(params.get("query")).toBe("interstellar");
    expect(params.get("query_match")).toBe("exact");
    expect(params.get("full_search")).toBe("true");
    expect(params.get("type")).toBe("movie");
    expect(params.get("year")).toBe("2014");
  });

  it("keeps a strict title fallback for movie subtitle search", async () => {
    const params = await buildOpenSubtitlesSearchParams(baseItem);
    expect(params.get("query")).toBe("interstellar");
    expect(params.get("year")).toBe("2014");
    expect(params.get("type")).toBe("movie");
    expect(params.get("languages")).toBe("en,he");
  });

  it("resolves episodes using the exact series title and exact season/episode", async () => {
    const series: Series = {
      id: "series-1", normalizedTitle: "the last of us", title: "The Last of Us", year: 2023,
      overview: "", genres: [], posterArtworkId: null, backdropArtworkId: null, logoArtworkId: null,
      createdAt: 1, updatedAt: 1,
    };
    await db.series.put(series);
    const item = { ...baseItem, id: "episode-1", type: "episode" as const, title: "When You're Lost in the Darkness",
      year: null, seriesId: series.id, seasonNumber: 1, episodeNumber: 1, episodeTitle: "When You're Lost in the Darkness" };

    const feature = await buildOpenSubtitlesFeatureParams(item);
    expect(feature.get("query")).toBe("the last of us");
    expect(feature.get("type")).toBe("tvshow");
    expect(feature.get("query_match")).toBe("exact");

    const params = await buildOpenSubtitlesSearchParams(item);
    expect(params.get("query")).toBe("the last of us");
    expect(params.get("type")).toBe("episode");
    expect(params.get("season_number")).toBe("1");
    expect(params.get("episode_number")).toBe("1");
  });
});

describe("OpenSubtitles result matching", () => {
  it("uses an exact feature ID and still rejects a different returned movie title", async () => {
    vi.spyOn(secretVault, "readSecret").mockResolvedValue("test-key");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: "house", attributes: { feature_type: "Movie", title: "House", year: 1985, imdb_id: 90555, tmdb_id: 11415 } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [
        { id: "wrong", attributes: { language: "en", download_count: 99999, release: "Horror.Show.2010.1080p", feature_details: { feature_type: "Movie", title: "Horror Show", year: 2010 }, files: [{ file_id: 10 }] } },
        { id: "right", attributes: { language: "en", download_count: 100, release: "House.1985.1080p.BluRay", feature_details: { feature_type: "Movie", title: "House", year: 1985 }, files: [{ file_id: 11 }] } },
      ] }) });
    vi.stubGlobal("fetch", fetchMock);

    const matches = await searchOpenSubtitles({ ...baseItem, title: "House", year: 1985 });
    expect(fetchMock.mock.calls[1][0]).toContain("imdb_id=90555");
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("right");
  });

  it("uses parent series ID and rejects another series or episode", async () => {
    vi.spyOn(secretVault, "readSecret").mockResolvedValue("test-key");
    const series: Series = { id: "house-series", normalizedTitle: "house", title: "House", year: 2004, overview: "", genres: [], posterArtworkId: null, backdropArtworkId: null, logoArtworkId: null, createdAt: 1, updatedAt: 1 };
    await db.series.put(series);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: "house-show", attributes: { feature_type: "Tvshow", title: "House", year: 2004, imdb_id: 412142, tmdb_id: 1408 } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [
        { id: "wrong-show", attributes: { language: "en", feature_details: { feature_type: "Episode", parent_title: "Horror Show", title: "Pilot", season_number: 1, episode_number: 1 }, files: [{ file_id: 20 }] } },
        { id: "wrong-episode", attributes: { language: "en", feature_details: { feature_type: "Episode", parent_title: "House", title: "Paternity", season_number: 1, episode_number: 2 }, files: [{ file_id: 21 }] } },
        { id: "right", attributes: { language: "en", release: "House.S01E01.720p.HDTV", feature_details: { feature_type: "Episode", parent_title: "House", title: "Pilot", season_number: 1, episode_number: 1 }, files: [{ file_id: 22 }] } },
      ] }) });
    vi.stubGlobal("fetch", fetchMock);

    const matches = await searchOpenSubtitles({ ...baseItem, type: "episode", title: "Pilot", year: null, seriesId: series.id, seasonNumber: 1, episodeNumber: 1, episodeTitle: "Pilot" });
    expect(fetchMock.mock.calls[1][0]).toContain("parent_imdb_id=412142");
    expect(matches.map((match) => match.id)).toEqual(["right"]);
  });

  it("ranks a matching release above a more-downloaded generic release", async () => {
    vi.spyOn(secretVault, "readSecret").mockResolvedValue("test-key");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: "feature", attributes: { feature_type: "Movie", title: "Interstellar", year: 2014, imdb_id: 816692 } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [
        { id: "popular", attributes: { language: "en", download_count: 100000, release: "Interstellar.2014.WEB-DL-GROUP", feature_details: { feature_type: "Movie", title: "Interstellar", year: 2014 }, files: [{ file_id: 30 }] } },
        { id: "release-match", attributes: { language: "en", download_count: 20, release: "Interstellar.2014.1080p.BluRay.x265", feature_details: { feature_type: "Movie", title: "Interstellar", year: 2014 }, files: [{ file_id: 31 }] } },
      ] }) }));

    const matches = await searchOpenSubtitles(baseItem);
    expect(matches[0].id).toBe("release-match");
  });
});
