import { afterEach, describe, expect, it, vi } from "vitest";
import { findWikipediaMovie } from "./wikipediaMovieProvider";

describe("Wikipedia movie provider", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prefers the year-specific page and browser-friendly thumbnail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          query: {
            pages: {
              "1": {
                pageid: 1,
                title: "Dune",
                original: {
                  source: "https://example.test/generic-original.jpg",
                  width: 2000,
                  height: 2000,
                },
                thumbnail: {
                  source: "https://example.test/generic-thumb.jpg",
                  width: 1000,
                  height: 1000,
                },
                extract: "Generic page",
              },
              "2": {
                pageid: 2,
                title: "Dune (2021 film)",
                original: {
                  source: "https://example.test/dune-original.jpg",
                  width: 1400,
                  height: 2000,
                },
                thumbnail: {
                  source: "https://example.test/dune-thumb.jpg",
                  width: 700,
                  height: 1000,
                },
                extract: "2021 film",
              },
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
      );

    const result = await findWikipediaMovie("Dune", 2021);

    expect(result?.pageId).toBe("2");
    expect(result?.posterUrl).toContain("dune-thumb.jpg");
  });

  it("returns null when Wikipedia has no matching page", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          query: {
            pages: {
              "-1": {
                title: "Missing",
                missing: true,
              },
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ query: { search: [] } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ));

    await expect(
      findWikipediaMovie("Missing Movie", 2025),
    ).resolves.toBeNull();
  });

  it("falls back to Wikipedia search when the guessed title is missing", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ query: { pages: { "-1": { title: "DUNE 2021", missing: true } } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ query: { search: [{ title: "Dune (2021 film)" }] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            query: {
              pages: {
                "2": {
                  pageid: 2,
                  title: "Dune (2021 film)",
                  thumbnail: { source: "https://example.test/dune.jpg", width: 700, height: 1000 },
                },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    await expect(findWikipediaMovie("Dune 2021", null)).resolves.toMatchObject({
      pageId: "2",
      posterUrl: "https://example.test/dune.jpg",
    });
  });
});
