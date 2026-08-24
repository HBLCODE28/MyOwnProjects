import { db } from "../db/streamlocalDb";
import { concisePlotSummary } from "./plotSummary";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";

type WikiPage = {
  pageid?: number;
  title: string;
  missing?: boolean;
  original?: {
    source: string;
    width: number;
    height: number;
  };
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  extract?: string;
};

type WikiQueryResponse = {
  query?: {
    pages?: Record<string, WikiPage>;
  };
};

export type WikipediaMovieSyncResult = {
  checked: number;
  matched: number;
  updated: number;
  skipped: number;
  noImage: number;
  failed: number;
};

function candidateTitles(title: string, year: number | null): string[] {
  return Array.from(
    new Set(
      [
        year ? `${title} (${year} film)` : null,
        `${title} (film)`,
        title,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

export async function findWikipediaMovie(
  title: string,
  year: number | null,
): Promise<{
  pageId: string;
  title: string;
  overview: string;
  posterUrl: string | null;
} | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    redirects: "1",
    prop: "pageimages|extracts",
    piprop: "thumbnail|original",
    pithumbsize: "1000",
    exintro: "1",
    explaintext: "1",
    titles: candidateTitles(title, year).join("|"),
  });

  const response = await fetch(`${WIKIPEDIA_API}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia request failed with HTTP ${response.status}.`);
  }

  const json = (await response.json()) as WikiQueryResponse;
  const pages = Object.values(json.query?.pages ?? {}).filter(
    (page) => !page.missing,
  );

  if (pages.length === 0) return null;

  const exactYearTitle = year
    ? `${title} (${year} film)`.toLowerCase()
    : null;

  const chosen =
    pages.find(
      (page) =>
        exactYearTitle &&
        page.title.toLowerCase() === exactYearTitle,
    ) ??
    pages.find(
      (page) =>
        page.title.toLowerCase() === `${title} (film)`.toLowerCase(),
    ) ??
    pages.find(
      (page) => page.title.toLowerCase() === title.toLowerCase(),
    ) ??
    pages[0];

  if (!chosen?.pageid) return null;

  return {
    pageId: String(chosen.pageid),
    title: chosen.title,
    overview: chosen.extract?.trim() ?? "",
    // Prefer the generated thumbnail because browsers handle it more reliably
    // than very large originals or unusual original formats.
    posterUrl:
      chosen.thumbnail?.source ??
      chosen.original?.source ??
      null,
  };
}

export async function syncMovieArtworkFromWikipedia(): Promise<WikipediaMovieSyncResult> {
  const movies = await db.mediaItems
    .where("type")
    .equals("movie")
    .toArray();

  const result: WikipediaMovieSyncResult = {
    checked: movies.length,
    matched: 0,
    updated: 0,
    skipped: 0,
    noImage: 0,
    failed: 0,
  };

  for (const movie of movies) {
    try {
      const match = await findWikipediaMovie(movie.title, movie.year);

      if (!match) {
        result.skipped += 1;
        continue;
      }

      result.matched += 1;

      if (!match.posterUrl) {
        result.noImage += 1;
        continue;
      }

      await db.mediaItems.update(movie.id, {
        overview: movie.overview || concisePlotSummary(match.overview),
        remotePosterUrl: match.posterUrl,
        metadataProvider: "wikipedia",
        providerId: match.pageId,
        updatedAt: Date.now(),
      });

      result.updated += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
