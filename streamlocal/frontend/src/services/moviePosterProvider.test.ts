import { afterEach, describe, expect, it, vi } from "vitest";
import { findPreservationNetworkPoster } from "./moviePosterProvider";

describe("movie poster provider", () => {
  afterEach(() => vi.restoreAllMocks());

  it("extracts a poster URL from an exact title/year match", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          results: [
            {
              id: 123,
              data: {
                title: "The Matrix",
                year: "1999",
                poster_url:
                  "https://images.example.test/the-matrix-poster.jpg",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(
      findPreservationNetworkPoster("The Matrix", 1999),
    ).resolves.toContain("the-matrix-poster.jpg");
  });

  it("rejects a different movie even if it contains an image", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          results: [
            {
              data: {
                title: "Different Movie",
                year: "1999",
                poster_url:
                  "https://images.example.test/wrong-poster.jpg",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(
      findPreservationNetworkPoster("The Matrix", 1999),
    ).resolves.toBeNull();
  });
});
