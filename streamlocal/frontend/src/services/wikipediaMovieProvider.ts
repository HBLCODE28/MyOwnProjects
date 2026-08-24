import { db } from "../db/streamlocalDb";
import { concisePlotSummary } from "./plotSummary";
import { cacheRemoteArtwork } from "./artwork";

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

type WikiSearchResponse = {
  query?: {
    search?: Array<{ title: string }>;
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

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function queryPages(titles: string[]): Promise<WikiPage[]> {
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
    titles: titles.join("|"),
  });
  const response = await fetch(`${WIKIPEDIA_API}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Wikipedia request failed with HTTP ${response.status}.`);
  }
  const json = (await response.json()) as WikiQueryResponse;
  return Object.values(json.query?.pages ?? {}).filter((page) => !page.missing);
}

async function searchPageTitles(title: string, year: number | null): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    list: "search",
    srnamespace: "0",
    srlimit: "10",
    srsearch: `${title} film${year ? ` ${year}` : ""}`,
  });
  const response = await fetch(`${WIKIPEDIA_API}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return [];
  const json = (await response.json()) as WikiSearchResponse;
  return (json.query?.search ?? []).map((entry) => entry.title);
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
  let pages = await queryPages(candidateTitles(title, year));

  if (pages.length === 0) return null;

  if (!pages.some((page) => page.thumbnail?.source || page.original?.source)) {
    const searchTitles = await searchPageTitles(title, year);
    if (searchTitles.length > 0) pages = await queryPages(searchTitles);
  }

  const wanted = normalizeTitle(title);
  const chosen = pages
    .map((page) => {
      const normalized = normalizeTitle(page.title);
      let score = 0;
      if (normalized === wanted) score += 100;
      else if (normalized.includes(wanted) || wanted.includes(normalized)) score += 45;
      if (year && page.title.includes(String(year))) score += 30;
      if (page.thumbnail?.source || page.original?.source) score += 20;
      return { page, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.page;

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
      await cacheRemoteArtwork(movie.id, match.posterUrl, "poster").catch(() => false);

      result.updated += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
