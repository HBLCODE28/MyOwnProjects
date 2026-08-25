import { db } from "../db/streamlocalDb";
import type { MediaItem, Series } from "../types/library";
import { cacheRemoteArtwork } from "./artwork";
import { readSecret } from "./secretVault";

const FANART_API = "https://webservice.fanart.tv/v3.1";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

type UnknownRecord = Record<string, unknown>;

type FanartImage = { url?: string };

type FanartResponse = {
  movieposter?: FanartImage[];
  moviebackground?: FanartImage[];
  hdmovielogo?: FanartImage[];
  movielogo?: FanartImage[];
  tvposter?: FanartImage[];
  tvbackground?: FanartImage[];
  showbackground?: FanartImage[];
  clearlogo?: FanartImage[];
  hdtvlogo?: FanartImage[];
};

export type FanartSyncResult = {
  checked: number;
  matched: number;
  updated: number;
  skipped: number;
  failed: number;
  missingKey: boolean;
};

function firstUrl(...groups: Array<FanartImage[] | undefined>): string | null {
  for (const group of groups) {
    const url = group?.find((image) => typeof image.url === "string")?.url;
    if (url) return url;
  }
  return null;
}

export function chooseFanartArtwork(
  kind: "movie" | "tv",
  response: FanartResponse,
): { poster: string | null; backdrop: string | null; logo: string | null } {
  if (kind === "movie") {
    return {
      poster: firstUrl(response.movieposter),
      backdrop: firstUrl(response.moviebackground),
      logo: firstUrl(response.hdmovielogo, response.movielogo),
    };
  }

  return {
    poster: firstUrl(response.tvposter),
    backdrop: firstUrl(response.showbackground, response.tvbackground),
    logo: firstUrl(response.clearlogo, response.hdtvlogo),
  };
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function findWikidataEntity(title: string, year: number | null): Promise<UnknownRecord | null> {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    format: "json",
    origin: "*",
    language: "en",
    uselang: "en",
    limit: "8",
    search: title,
  });
  const response = await fetch(`${WIKIDATA_API}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;

  const search = (await response.json()) as { search?: Array<{ id: string; label?: string; description?: string }> };
  const wanted = normalize(title);
  const candidates = search.search ?? [];
  const ranked = candidates
    .map((candidate) => {
      const label = normalize(candidate.label ?? "");
      const description = normalize(candidate.description ?? "");
      let score = label === wanted ? 100 : label.includes(wanted) ? 60 : 0;
      if (description.includes("film") || description.includes("television series")) score += 20;
      if (year && description.includes(String(year))) score += 10;
      return { candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { candidate } of ranked) {
    const entityParams = new URLSearchParams({
      action: "wbgetentities",
      format: "json",
      origin: "*",
      ids: candidate.id,
      props: "claims",
    });
    const entityResponse = await fetch(`${WIKIDATA_API}?${entityParams.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!entityResponse.ok) continue;
    const json = (await entityResponse.json()) as { entities?: Record<string, UnknownRecord> };
    const entity = json.entities?.[candidate.id];
    if (entity) return entity;
  }

  return null;
}

function claimValue(entity: UnknownRecord | null, property: string): string | null {
  const claims = entity?.claims;
  if (!claims || typeof claims !== "object") return null;
  const propertyClaims = (claims as UnknownRecord)[property];
  if (!Array.isArray(propertyClaims)) return null;
  for (const claim of propertyClaims) {
    const mainsnak = (claim as UnknownRecord).mainsnak;
    const datavalue = mainsnak && typeof mainsnak === "object"
      ? (mainsnak as UnknownRecord).datavalue
      : null;
    const value = datavalue && typeof datavalue === "object"
      ? (datavalue as UnknownRecord).value
      : null;
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return null;
}

async function fetchFanart(kind: "movie" | "tv", id: string, apiKey: string): Promise<FanartResponse | null> {
  const response = await fetch(`${FANART_API}/${kind}/${encodeURIComponent(id)}?api_key=${encodeURIComponent(apiKey)}`, {
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Fanart.tv returned HTTP ${response.status}.`);
  return (await response.json()) as FanartResponse;
}

async function saveMovieArtwork(movie: MediaItem | undefined, artwork: ReturnType<typeof chooseFanartArtwork>): Promise<boolean> {
  if (!movie || (!artwork.poster && !artwork.backdrop && !artwork.logo)) return false;
  await db.mediaItems.update(movie.id, {
    remotePosterUrl: artwork.poster ?? movie.remotePosterUrl ?? null,
    remoteBackdropUrl: artwork.backdrop ?? movie.remoteBackdropUrl ?? null,
    remoteLogoUrl: artwork.logo ?? movie.remoteLogoUrl ?? null,
    metadataProvider: "fanart",
    updatedAt: Date.now(),
  });
  if (artwork.poster) await cacheRemoteArtwork(movie.id, artwork.poster, "poster").catch(() => false);
  if (artwork.backdrop) await cacheRemoteArtwork(movie.id, artwork.backdrop, "backdrop").catch(() => false);
  if (artwork.logo) await cacheRemoteArtwork(movie.id, artwork.logo, "logo").catch(() => false);
  return true;
}

async function saveSeriesArtwork(series: Series | undefined, artwork: ReturnType<typeof chooseFanartArtwork>): Promise<boolean> {
  if (!series || (!artwork.poster && !artwork.backdrop && !artwork.logo)) return false;
  await db.series.update(series.id, {
    remotePosterUrl: artwork.poster ?? series.remotePosterUrl ?? null,
    remoteBackdropUrl: artwork.backdrop ?? series.remoteBackdropUrl ?? null,
    remoteLogoUrl: artwork.logo ?? series.remoteLogoUrl ?? null,
    metadataProvider: "fanart",
    updatedAt: Date.now(),
  });
  return true;
}

export async function syncFanartArtwork(): Promise<FanartSyncResult> {
  const [movies, series] = await Promise.all([
    db.mediaItems.where("type").equals("movie").toArray(),
    db.series.toArray(),
  ]);
  const result: FanartSyncResult = { checked: movies.length + series.length, matched: 0, updated: 0, skipped: 0, failed: 0, missingKey: false };
  let apiKey: string | null;
  try {
    apiKey = (await readSecret("fanartApiKey"))?.trim() || null;
  } catch {
    result.missingKey = true;
    return result;
  }
  if (!apiKey) {
    result.missingKey = true;
    return result;
  }

  for (const movie of movies) {
    if (movie.remotePosterUrl && movie.remoteBackdropUrl && movie.remoteLogoUrl) {
      result.skipped += 1;
      continue;
    }
    try {
      const entity = await findWikidataEntity(movie.title, movie.year);
      const imdbId = claimValue(entity, "P345");
      if (!imdbId) { result.skipped += 1; continue; }
      const response = await fetchFanart("movie", imdbId, apiKey);
      if (!response) { result.skipped += 1; continue; }
      result.matched += 1;
      if (await saveMovieArtwork(movie, chooseFanartArtwork("movie", response))) result.updated += 1;
    } catch { result.failed += 1; }
  }

  for (const entry of series) {
    if (entry.remotePosterUrl && entry.remoteBackdropUrl && entry.remoteLogoUrl) {
      result.skipped += 1;
      continue;
    }
    try {
      const entity = await findWikidataEntity(entry.title, entry.year);
      const tvdbId = claimValue(entity, "P4835");
      if (!tvdbId) { result.skipped += 1; continue; }
      const response = await fetchFanart("tv", tvdbId, apiKey);
      if (!response) { result.skipped += 1; continue; }
      result.matched += 1;
      if (await saveSeriesArtwork(entry, chooseFanartArtwork("tv", response))) result.updated += 1;
    } catch { result.failed += 1; }
  }

  return result;
}
