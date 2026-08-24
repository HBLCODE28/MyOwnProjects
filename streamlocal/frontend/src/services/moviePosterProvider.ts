import { db } from "../db/streamlocalDb";
import { findWikipediaMovie } from "./wikipediaMovieProvider";
import { concisePlotSummary } from "./plotSummary";

const PRESERVATION_SEARCH =
  "https://api.thepreservationnetwork.org/v1/vhs/search";

export type MoviePosterSyncResult = {
  checked: number;
  preservationMatched: number;
  preservationSaved: number;
  wikipediaSaved: number;
  noPoster: number;
  failed: number;
};

type UnknownRecord = Record<string, unknown>;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stringsDeep(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsDeep);
  if (value && typeof value === "object") {
    return Object.values(value as UnknownRecord).flatMap(stringsDeep);
  }
  return [];
}

function valuesForKeys(
  value: unknown,
  wantedKeys: string[],
): string[] {
  if (!value || typeof value !== "object") return [];

  const output: string[] = [];
  const record = value as UnknownRecord;

  for (const [key, nested] of Object.entries(record)) {
    if (
      wantedKeys.some(
        (wanted) => key.toLowerCase() === wanted.toLowerCase(),
      ) &&
      typeof nested === "string"
    ) {
      output.push(nested);
    }

    if (nested && typeof nested === "object") {
      output.push(...valuesForKeys(nested, wantedKeys));
    }
  }

  return output;
}

function imageCandidates(value: unknown): string[] {
  return stringsDeep(value).filter((candidate) => {
    if (!/^https:\/\//i.test(candidate)) return false;

    return (
      /\.(jpe?g|png|webp)(\?|$)/i.test(candidate) ||
      /poster|image|cover|artwork/i.test(candidate)
    );
  });
}

function scoreRecord(
  record: unknown,
  title: string,
  year: number | null,
): number {
  const titleValues = valuesForKeys(record, [
    "title",
    "name",
    "movie",
    "film",
    "movie_title",
    "film_title",
  ]);

  const wanted = normalize(title);
  let score = 0;

  if (
    titleValues.some((value) => normalize(value) === wanted)
  ) {
    score += 100;
  } else if (
    titleValues.some((value) => normalize(value).includes(wanted))
  ) {
    score += 40;
  }

  if (year) {
    const yearValues = valuesForKeys(record, [
      "year",
      "release_year",
      "releaseYear",
    ]);

    if (yearValues.some((value) => value.includes(String(year)))) {
      score += 25;
    } else if (
      stringsDeep(record).some((value) =>
        value.includes(String(year)),
      )
    ) {
      score += 8;
    }
  }

  if (imageCandidates(record).length > 0) score += 10;
  return score;
}

export async function findPreservationNetworkPoster(
  title: string,
  year: number | null,
): Promise<string | null> {
  const params = new URLSearchParams({
    q: title,
    per_page: "20",
  });

  if (year) params.set("year", String(year));

  const response = await fetch(
    `${PRESERVATION_SEARCH}?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    // The public endpoint can be unavailable or return an HTML error page.
    // Treat that as a provider miss so Wikipedia/local artwork can continue.
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return null;

  const json = (await response.json()) as UnknownRecord;
  const rawResults = Array.isArray(json.results)
    ? json.results
    : [];

  const ranked = rawResults
    .map((record) => ({
      record,
      score: scoreRecord(record, title, year),
    }))
    .filter(({ score }) => score >= 50)
    .sort((a, b) => b.score - a.score);

  for (const { record } of ranked) {
    const images = imageCandidates(record);
    const preferred =
      images.find((url) => /poster|cover/i.test(url)) ??
      images[0];

    if (preferred) return preferred;
  }

  return null;
}

export async function syncMoviePosters(): Promise<MoviePosterSyncResult> {
  const movies = await db.mediaItems
    .where("type")
    .equals("movie")
    .toArray();

  const result: MoviePosterSyncResult = {
    checked: movies.length,
    preservationMatched: 0,
    preservationSaved: 0,
    wikipediaSaved: 0,
    noPoster: 0,
    failed: 0,
  };

  for (const movie of movies) {
    try {
      let posterUrl: string | null = null;

      try {
        posterUrl = await findPreservationNetworkPoster(
          movie.title,
          movie.year,
        );
      } catch {
        // Provider failure is non-fatal because Wikipedia is the fallback.
      }

      if (posterUrl) {
        result.preservationMatched += 1;

        await db.mediaItems.update(movie.id, {
          remotePosterUrl: posterUrl,
          metadataProvider: null,
          providerId: null,
          updatedAt: Date.now(),
        });

        result.preservationSaved += 1;
        continue;
      }

      const wikipedia = await findWikipediaMovie(
        movie.title,
        movie.year,
      );

      if (wikipedia?.posterUrl) {
        await db.mediaItems.update(movie.id, {
          overview: movie.overview || concisePlotSummary(wikipedia.overview),
          remotePosterUrl: wikipedia.posterUrl,
          metadataProvider: "wikipedia",
          providerId: wikipedia.pageId,
          updatedAt: Date.now(),
        });

        result.wikipediaSaved += 1;
        continue;
      }

      result.noPoster += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
