import { db } from "../db/streamlocalDb";
import { concisePlotSummary } from "./plotSummary";

const TVMAZE_SEARCH_URL = "https://api.tvmaze.com/search/shows";

type TvmazeShow = {
  id: number;
  name: string;
  premiered: string | null;
  genres: string[];
  summary: string | null;
  image: {
    medium: string;
    original: string;
  } | null;
};

type TvmazeSearchResult = {
  score: number;
  show: TvmazeShow;
};

type TvmazeImage = {
  id: number;
  type: "poster" | "banner" | "background" | "typography" | string;
  main: boolean;
  resolutions: {
    original?: { url: string; width: number; height: number };
    medium?: { url: string; width: number; height: number };
  };
};

export type TvmazePosterSyncResult = {
  checked: number;
  matched: number;
  updated: number;
  skipped: number;
  failed: number;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchTvmazeSeriesExact(
  title: string,
): Promise<TvmazeShow | null> {
  const response = await fetch(
    `${TVMAZE_SEARCH_URL}?q=${encodeURIComponent(title)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error(`TVmaze search failed with HTTP ${response.status}.`);
  }

  const results = (await response.json()) as TvmazeSearchResult[];
  const wanted = normalize(title);

  return (
    results.find(({ show }) => normalize(show.name) === wanted)?.show ??
    null
  );
}

export async function getTvmazeSeriesArtwork(
  showId: number,
): Promise<{ poster: string | null; backdrop: string | null }> {
  const response = await fetch(`https://api.tvmaze.com/shows/${showId}/images`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return { poster: null, backdrop: null };
  }

  const images = (await response.json()) as TvmazeImage[];

  function best(type: string): string | null {
    const candidates = images.filter((image) => image.type === type);
    const chosen =
      candidates.find((image) => image.main) ??
      candidates
        .slice()
        .sort((a, b) => {
          const aArea =
            (a.resolutions.original?.width ?? 0) *
            (a.resolutions.original?.height ?? 0);
          const bArea =
            (b.resolutions.original?.width ?? 0) *
            (b.resolutions.original?.height ?? 0);
          return bArea - aArea;
        })[0];

    return (
      chosen?.resolutions.original?.url ??
      chosen?.resolutions.medium?.url ??
      null
    );
  }

  return {
    poster: best("poster"),
    backdrop: best("background") ?? best("banner"),
  };
}

export async function syncSeriesPostersFromTvmaze(): Promise<TvmazePosterSyncResult> {
  const rows = await db.series.toArray();

  const result: TvmazePosterSyncResult = {
    checked: rows.length,
    matched: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const series of rows) {
    try {
      const match = await searchTvmazeSeriesExact(series.title);

      if (!match) {
        result.skipped += 1;
        continue;
      }

      result.matched += 1;

      const artwork = await getTvmazeSeriesArtwork(match.id);
      const year = match.premiered
        ? Number(match.premiered.slice(0, 4))
        : null;

      await db.series.update(series.id, {
        year: series.year ?? (Number.isFinite(year) ? year : null),
        overview: series.overview || concisePlotSummary(match.summary),
        genres: series.genres.length > 0 ? series.genres : match.genres,
        remotePosterUrl:
          artwork.poster ??
          match.image?.original ??
          match.image?.medium ??
          null,
        remoteBackdropUrl: artwork.backdrop,
        metadataProvider: "tvmaze",
        providerId: String(match.id),
        updatedAt: Date.now(),
      });

      result.updated += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
