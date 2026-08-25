import { db } from "../db/streamlocalDb";
import { concisePlotSummary } from "./plotSummary";
import { validateRemoteLogoUrl } from "./logoValidation";

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
  postersSaved: number;
  backdropsSaved: number;
  logosSaved: number;
  episodeStillsSaved: number;
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
): Promise<{ poster: string | null; backdrop: string | null; logo: string | null }> {
  const response = await fetch(`https://api.tvmaze.com/shows/${showId}/images`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return { poster: null, backdrop: null, logo: null };
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

  const logoCandidate = best("typography");
  const logo = logoCandidate && await validateRemoteLogoUrl(logoCandidate)
    ? logoCandidate
    : null;

  return {
    poster: best("poster"),
    backdrop: best("background") ?? best("banner"),
    logo,
  };
}



type TvmazeEpisode = {
  id: number;
  season: number;
  number: number | null;
  image: {
    medium: string | null;
    original: string | null;
  } | null;
};

export async function getTvmazeEpisodeStills(
  showId: number,
): Promise<Map<string, string>> {
  const response = await fetch(`https://api.tvmaze.com/shows/${showId}/episodes`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) return new Map();

  const episodes = (await response.json()) as TvmazeEpisode[];
  const stills = new Map<string, string>();

  for (const episode of episodes) {
    if (!Number.isFinite(episode.season) || episode.number == null) continue;
    const url = episode.image?.original ?? episode.image?.medium ?? null;
    if (!url) continue;
    stills.set(`${episode.season}:${episode.number}`, url);
  }

  return stills;
}

export async function syncSeriesPostersFromTvmaze(): Promise<TvmazePosterSyncResult> {
  const rows = await db.series.toArray();

  const result: TvmazePosterSyncResult = {
    checked: rows.length,
    matched: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    postersSaved: 0,
    backdropsSaved: 0,
    logosSaved: 0,
    episodeStillsSaved: 0,
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

      const nextPoster =
        artwork.poster ??
        match.image?.original ??
        match.image?.medium ??
        series.remotePosterUrl ??
        null;
      const nextBackdrop = artwork.backdrop ?? series.remoteBackdropUrl ?? null;
      const nextLogo = artwork.logo ?? series.remoteLogoUrl ?? null;

      await db.series.update(series.id, {
        year: series.year ?? (Number.isFinite(year) ? year : null),
        overview: series.overview || concisePlotSummary(match.summary),
        genres: series.genres.length > 0 ? series.genres : match.genres,
        remotePosterUrl: nextPoster,
        remoteBackdropUrl: nextBackdrop,
        remoteLogoUrl: nextLogo,
        metadataProvider: "tvmaze",
        providerId: String(match.id),
        updatedAt: Date.now(),
      });

      if (!series.remotePosterUrl && nextPoster) result.postersSaved += 1;
      if (!series.remoteBackdropUrl && nextBackdrop) result.backdropsSaved += 1;
      if (!series.remoteLogoUrl && nextLogo) result.logosSaved += 1;

      const [stills, episodeItems] = await Promise.all([
        getTvmazeEpisodeStills(match.id),
        db.mediaItems.where("seriesId").equals(series.id).toArray(),
      ]);

      for (const episode of episodeItems) {
        if (episode.type !== "episode" || episode.seasonNumber == null || episode.episodeNumber == null) {
          continue;
        }
        const stillUrl = stills.get(`${episode.seasonNumber}:${episode.episodeNumber}`);
        if (!stillUrl || episode.remoteEpisodeStillUrl === stillUrl) continue;
        await db.mediaItems.update(episode.id, {
          remoteEpisodeStillUrl: stillUrl,
          updatedAt: Date.now(),
        });
        result.episodeStillsSaved += 1;
      }

      result.updated += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
