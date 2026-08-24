import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getTvmazeSeriesArtwork,
  searchTvmazeSeriesExact,
} from "./tvmazeProvider";

describe("TVmaze provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("chooses an exact normalized series-title match", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            score: 0.95,
            show: {
              id: 1,
              name: "The Office UK",
              premiered: "2001-07-09",
              genres: ["Comedy"],
              summary: null,
              image: null,
            },
          },
          {
            score: 0.9,
            show: {
              id: 2,
              name: "The Office",
              premiered: "2005-03-24",
              genres: ["Comedy"],
              summary: "<p>Workplace comedy.</p>",
              image: {
                medium: "https://static.tvmaze.com/poster-medium.jpg",
                original: "https://static.tvmaze.com/poster.jpg",
              },
            },
          },
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await searchTvmazeSeriesExact("The.Office");

    expect(result?.id).toBe(2);
  });

  it("does not guess when there is no exact normalized match", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            score: 0.9,
            show: {
              id: 5,
              name: "A Different Show",
              premiered: null,
              genres: [],
              summary: null,
              image: null,
            },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      searchTvmazeSeriesExact("Wanted Show"),
    ).resolves.toBeNull();
  });

  it("prefers a background image for horizontal series cards", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 11,
            type: "poster",
            main: true,
            resolutions: {
              original: {
                url: "https://static.tvmaze.com/poster.jpg",
                width: 680,
                height: 1000,
              },
            },
          },
          {
            id: 12,
            type: "background",
            main: true,
            resolutions: {
              original: {
                url: "https://static.tvmaze.com/background.jpg",
                width: 1920,
                height: 1080,
              },
            },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await getTvmazeSeriesArtwork(123);

    expect(result.poster).toContain("poster.jpg");
    expect(result.backdrop).toContain("background.jpg");
  });
});
