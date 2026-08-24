import { describe, expect, it } from "vitest";
import type { MediaFile, MediaItem, Series } from "../types/library";
import { filterMovies, filterSeries, groupSeries, libraryCounts } from "./browseSelectors";

function item(partial: Partial<MediaItem>): MediaItem {
  return {
    id: "item",
    mediaFileId: "file",
    type: "movie",
    title: "Arrival",
    year: 2016,
    overview: "",
    genres: [],
    seriesId: null,
    seasonNumber: null,
    episodeNumber: null,
    episodeTitle: null,
    confidence: "high",
    matchStatus: "matched",
    manuallyEdited: false,
    posterArtworkId: null,
    backdropArtworkId: null,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

function file(partial: Partial<MediaFile>): MediaFile {
  const fileName = partial.fileName ?? "Arrival.2016.mkv";

  return {
    id: "file",
    sourceId: "source",
    relativePath: `Movies/${fileName}`,
    fileName,
    extension: fileName.split(".").pop()?.toLowerCase() ?? "mkv",
    size: 100,
    lastModified: 1,
    fingerprint: "fp",
    available: true,
    lastSeenAt: 1,
    ...partial,
  };
}

function series(partial: Partial<Series>): Series {
  return {
    id: "series",
    normalizedTitle: "severance",
    title: "Severance",
    year: 2022,
    overview: "",
    genres: [],
    posterArtworkId: null,
    backdropArtworkId: null,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

describe("browse selectors", () => {
  it("filters movies by title, year and filename", () => {
    const movies = [
      {
        item: item({ title: "Arrival", year: 2016 }),
        file: file({
          fileName: "Arrival.2016.mkv",
          relativePath: "Movies/Arrival.2016.mkv",
        }),
      },
      {
        item: item({
          id: "item-2",
          mediaFileId: "file-2",
          title: "Dune",
          year: 2021,
        }),
        file: file({
          id: "file-2",
          fileName: "Dune.2021.mkv",
          relativePath: "Movies/Dune.2021.mkv",
          fingerprint: "fp-2",
        }),
      },
    ];

    expect(filterMovies(movies, "2016")).toHaveLength(1);
    expect(filterMovies(movies, "dune")).toHaveLength(1);
    expect(filterMovies(movies, "dune")[0].item.title).toBe("Dune");
  });

  it("groups series episodes by season and episode number", () => {
    const seriesRows = [series({})];
    const episodes = [
      item({
        id: "e2",
        mediaFileId: "f2",
        type: "episode",
        title: "Episode 2",
        seriesId: "series",
        seasonNumber: 1,
        episodeNumber: 2,
      }),
      item({
        id: "e1",
        mediaFileId: "f1",
        type: "episode",
        title: "Episode 1",
        seriesId: "series",
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    ];
    const files = [
      file({
        id: "f1",
        fileName: "S01E01.mkv",
        relativePath: "Severance/Season 01/S01E01.mkv",
        fingerprint: "fp-1",
      }),
      file({
        id: "f2",
        fileName: "S01E02.mkv",
        relativePath: "Severance/Season 01/S01E02.mkv",
        fingerprint: "fp-2",
      }),
    ];

    const grouped = groupSeries(seriesRows, episodes, files);

    expect(grouped).toHaveLength(1);
    expect(
      grouped[0].seasons[0].episodes.map(({ item }) => item.episodeNumber),
    ).toEqual([1, 2]);
  });

  it("filters series by episode filename", () => {
    const grouped = groupSeries(
      [series({})],
      [
        item({
          id: "e1",
          mediaFileId: "f1",
          type: "episode",
          seriesId: "series",
          seasonNumber: 2,
          episodeNumber: 3,
        }),
      ],
      [
        file({
          id: "f1",
          fileName: "Severance.S02E03.mkv",
          relativePath: "Severance/Season 02/Severance.S02E03.mkv",
          fingerprint: "fp-1",
        }),
      ],
    );

    expect(filterSeries(grouped, "s02e03")).toHaveLength(1);
  });

  it("counts library rows", () => {
    const items = [
      item({ id: "m1", mediaFileId: "f1", type: "movie" }),
      item({
        id: "e1",
        mediaFileId: "f2",
        type: "episode",
        matchStatus: "needs_match",
      }),
    ];
    const files = [
      file({ id: "f1", available: true, fingerprint: "fp-1" }),
      file({ id: "f2", available: false, fingerprint: "fp-2" }),
    ];

    expect(libraryCounts(items, files)).toEqual({
      movies: 1,
      episodes: 1,
      availableItems: 1,
      needsMatch: 1,
    });
  });
});
