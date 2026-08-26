import { db } from "../db/streamlocalDb";
import type { MediaItem, Series } from "../types/library";
import { cacheRemoteArtwork, clearAutoCachedArtwork, validateRemoteArtworkUrl } from "./artwork";
import { syncMoviePosters, type MoviePosterSyncResult } from "./moviePosterProvider";
import { syncWikimediaLogos, type LogoSyncResult } from "./wikimediaLogoProvider";
import { listSecretIds, readSecret, vaultExists, vaultIsUnlocked } from "./secretVault";
import { isRejectedLogoCandidateName, validateRemoteLogoUrl } from "./logoValidation";
import { isNamedLogoUrlContextCompatible } from "./wikimediaLogoProvider";
import { syncSeriesPostersFromTvmaze, type TvmazePosterSyncResult } from "./tvmazeProvider";

const FANART_API = "https://webservice.fanart.tv/v3.2";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

type UnknownRecord = Record<string, unknown>;

type FanartImage = { url?: string; lang?: string; likes?: string | number };

type FanartResponse = {
  name?: string;
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
  keyProblem?: string;
  postersSaved: number;
  backdropsSaved: number;
  logosSaved: number;
  rejectedLogos: number;
  missingArtwork: number;
};

export type AllArtworkSyncResult = {
  tvmaze: TvmazePosterSyncResult;
  fanart: FanartSyncResult;
  movies: MoviePosterSyncResult;
  logos: LogoSyncResult;
};

function rankedImages(group: FanartImage[] | undefined): FanartImage[] {
  return (group ?? []).slice().sort((left, right) => {
    const languageScore = (value: FanartImage) =>
      value.lang === "en" ? 3 : value.lang === "00" ? 2 : value.lang ? 0 : 1;
    const leftLikes = Number(left.likes ?? 0) || 0;
    const rightLikes = Number(right.likes ?? 0) || 0;
    return languageScore(right) - languageScore(left) || rightLikes - leftLikes;
  });
}

function firstUrl(...groups: Array<FanartImage[] | undefined>): string | null {
  for (const group of groups) {
    const url = rankedImages(group).find((image) => typeof image.url === "string")?.url;
    if (url) return url;
  }
  return null;
}

async function firstValidatedLogoUrl(
  groups: Array<FanartImage[] | undefined>,
): Promise<{ url: string | null; rejected: number }> {
  let rejected = 0;
  for (const group of groups) {
    for (const image of rankedImages(group)) {
      const url = typeof image.url === "string" ? image.url : null;
      if (!url) continue;
      let fileName = url;
      try {
        fileName = new URL(url).pathname.split("/").pop() ?? url;
      } catch {
        // Keep the original string when the provider returns a non-standard URL.
      }
      if (isRejectedLogoCandidateName(fileName) || !(await validateRemoteLogoUrl(url))) {
        rejected += 1;
        continue;
      }
      return { url, rejected };
    }
  }
  return { url: null, rejected };
}

async function chooseValidatedFanartArtwork(
  kind: "movie" | "tv",
  response: FanartResponse,
): Promise<{
  artwork: ReturnType<typeof chooseFanartArtwork>;
  rejectedLogos: number;
}> {
  const base = chooseFanartArtwork(kind, response);
  const logo = await firstValidatedLogoUrl(
    kind === "movie"
      ? [response.hdmovielogo, response.movielogo]
      : [response.clearlogo, response.hdtvlogo],
  );
  return {
    artwork: { ...base, logo: logo.url },
    rejectedLogos: logo.rejected,
  };
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
  const resource = kind === "movie" ? "movies" : "tv";
  const base = `${FANART_API}/${resource}/${encodeURIComponent(id)}`;

  async function request(parameter: "api_key" | "client_key"): Promise<Response> {
    const params = new URLSearchParams({ [parameter]: apiKey });
    return fetch(`${base}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
  }

  let response = await request("api_key");
  // Fanart's current API supports a personal key as client_key. Some users save
  // that key rather than a project key, so retry that authentication form before
  // reporting a missing/invalid provider response.
  if (response.status === 401 || response.status === 403) {
    response = await request("client_key");
  }

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Fanart.tv returned HTTP ${response.status}.`);
  return (await response.json()) as FanartResponse;
}

async function findTvmazeTvdbId(series: Series): Promise<string | null> {
  const candidateIds = series.metadataProvider === "tvmaze" && series.providerId
    ? [series.providerId]
    : [];
  if (candidateIds.length === 0) {
    const searchResponse = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(series.title)}`, { headers: { Accept: "application/json" } });
    if (searchResponse.ok) {
      const results = (await searchResponse.json()) as Array<{ show?: { id?: number; name?: string } }>;
      const wanted = normalize(series.title);
      const exact = results.find((entry) => normalize(entry.show?.name ?? "") === wanted)?.show?.id;
      if (exact) candidateIds.push(String(exact));
    }
  }
  for (const id of candidateIds) {
    const response = await fetch(`https://api.tvmaze.com/shows/${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) continue;
    const show = (await response.json()) as { externals?: { thetvdb?: number | null } };
    if (show.externals?.thetvdb) return String(show.externals.thetvdb);
  }
  return null;
}

async function saveMovieArtwork(
  movie: MediaItem | undefined,
  artwork: ReturnType<typeof chooseFanartArtwork>,
): Promise<{ updated: boolean; poster: number; backdrop: number; logo: number }> {
  if (!movie) return { updated: false, poster: 0, backdrop: 0, logo: 0 };
  const poster = movie.remotePosterUrl ? null : artwork.poster;
  const backdrop = movie.remoteBackdropUrl ? null : artwork.backdrop;
  const logo = artwork.logo && (!movie.remoteLogoUrl || movie.metadataProvider === "fanart")
    ? artwork.logo
    : null;
  if (!poster && !backdrop && !logo) {
    return { updated: false, poster: 0, backdrop: 0, logo: 0 };
  }

  // A previous provider version cached remote logos as local artwork. If a new,
  // identity-validated logo is about to replace it, remove only that generated
  // cache record. Manually selected local logos keep priority and are untouched.
  if (logo) await clearAutoCachedArtwork(movie, "logo");

  await db.mediaItems.update(movie.id, {
    remotePosterUrl: poster ?? movie.remotePosterUrl ?? null,
    remoteBackdropUrl: backdrop ?? movie.remoteBackdropUrl ?? null,
    remoteLogoUrl: logo ?? movie.remoteLogoUrl ?? null,
    metadataProvider: "fanart",
    updatedAt: Date.now(),
  });
  if (poster) await cacheRemoteArtwork(movie.id, poster, "poster").catch(() => false);
  if (backdrop) await cacheRemoteArtwork(movie.id, backdrop, "backdrop").catch(() => false);
  if (logo) await cacheRemoteArtwork(movie.id, logo, "logo").catch(() => false);
  return {
    updated: true,
    poster: poster ? 1 : 0,
    backdrop: backdrop ? 1 : 0,
    logo: logo ? 1 : 0,
  };
}

async function saveSeriesArtwork(
  series: Series | undefined,
  artwork: ReturnType<typeof chooseFanartArtwork>,
): Promise<{ updated: boolean; poster: number; backdrop: number; logo: number }> {
  if (!series) return { updated: false, poster: 0, backdrop: 0, logo: 0 };
  const poster = series.remotePosterUrl ? null : artwork.poster;
  const backdrop = series.remoteBackdropUrl ? null : artwork.backdrop;
  const logo = artwork.logo && (!series.remoteLogoUrl || series.metadataProvider === "fanart")
    ? artwork.logo
    : null;
  if (!poster && !backdrop && !logo) {
    return { updated: false, poster: 0, backdrop: 0, logo: 0 };
  }

  await db.series.update(series.id, {
    remotePosterUrl: poster ?? series.remotePosterUrl ?? null,
    remoteBackdropUrl: backdrop ?? series.remoteBackdropUrl ?? null,
    remoteLogoUrl: logo ?? series.remoteLogoUrl ?? null,
    metadataProvider: "fanart",
    updatedAt: Date.now(),
  });
  return {
    updated: true,
    poster: poster ? 1 : 0,
    backdrop: backdrop ? 1 : 0,
    logo: logo ? 1 : 0,
  };
}

export async function syncFanartArtwork(): Promise<FanartSyncResult> {
  const [movies, series] = await Promise.all([
    db.mediaItems.where("type").equals("movie").toArray(),
    db.series.toArray(),
  ]);
  const result: FanartSyncResult = { checked: movies.length + series.length, matched: 0, updated: 0, skipped: 0, failed: 0, missingKey: false, postersSaved: 0, backdropsSaved: 0, logosSaved: 0, rejectedLogos: 0, missingArtwork: 0 };
  let apiKey: string | null;
  if (!(await vaultExists())) {
    result.missingKey = true;
    result.keyProblem = "The encrypted API key vault has not been created on this StreamLocal origin.";
    return result;
  }
  if (!vaultIsUnlocked()) {
    result.missingKey = true;
    result.keyProblem = "The encrypted API key vault is locked in this browser session.";
    return result;
  }
  if (!(await listSecretIds()).includes("fanartApiKey")) {
    result.missingKey = true;
    result.keyProblem = "No Fanart.tv key is saved for this StreamLocal origin and port.";
    return result;
  }
  try {
    apiKey = (await readSecret("fanartApiKey"))?.trim() || null;
  } catch (error) {
    result.missingKey = true;
    result.keyProblem = error instanceof Error ? error.message : "The Fanart.tv key could not be decrypted.";
    return result;
  }
  if (!apiKey) {
    result.missingKey = true;
    result.keyProblem = "The saved Fanart.tv key is empty.";
    return result;
  }

  for (const originalMovie of movies) {
    let movie = originalMovie;
    if (movie.remotePosterUrl && !(await validateRemoteArtworkUrl(movie.remotePosterUrl, "poster"))) {
      await db.mediaItems.update(movie.id, { remotePosterUrl: null, updatedAt: Date.now() });
      movie = { ...movie, remotePosterUrl: null };
    }
    if (movie.remoteBackdropUrl && !(await validateRemoteArtworkUrl(movie.remoteBackdropUrl, "backdrop"))) {
      await db.mediaItems.update(movie.id, { remoteBackdropUrl: null, updatedAt: Date.now() });
      movie = { ...movie, remoteBackdropUrl: null };
    }
    if (movie.remoteLogoUrl) {
      try {
        const correctTitle = isNamedLogoUrlContextCompatible(
          movie.title,
          movie.remoteLogoUrl,
          { kind: "movie", year: movie.year },
        );
        if (!correctTitle || !(await validateRemoteLogoUrl(movie.remoteLogoUrl))) {
          result.rejectedLogos += 1;
          await clearAutoCachedArtwork(movie, "logo");
          await db.mediaItems.update(movie.id, { remoteLogoUrl: null, updatedAt: Date.now() });
          movie = { ...movie, remoteLogoUrl: null, logoArtworkId: null };
        }
      } catch {
        result.rejectedLogos += 1;
        await clearAutoCachedArtwork(movie, "logo");
        await db.mediaItems.update(movie.id, { remoteLogoUrl: null, updatedAt: Date.now() });
        movie = { ...movie, remoteLogoUrl: null, logoArtworkId: null };
      }
    }
    if (
      movie.remotePosterUrl &&
      movie.remoteBackdropUrl &&
      movie.remoteLogoUrl &&
      movie.metadataProvider !== "fanart"
    ) {
      result.skipped += 1;
      continue;
    }
    try {
      const entity = await findWikidataEntity(movie.title, movie.year);
      const imdbId = claimValue(entity, "P345");
      if (!imdbId) { result.skipped += 1; continue; }
      const response = await fetchFanart("movie", imdbId, apiKey);
      if (!response) { result.skipped += 1; continue; }
      if (response.name && normalize(response.name) !== normalize(movie.title)) {
        result.skipped += 1;
        continue;
      }
      result.matched += 1;
      const validated = await chooseValidatedFanartArtwork("movie", response);
      result.rejectedLogos += validated.rejectedLogos;
      const saved = await saveMovieArtwork(movie, validated.artwork);
      if (saved.updated) result.updated += 1;
      result.postersSaved += saved.poster;
      result.backdropsSaved += saved.backdrop;
      result.logosSaved += saved.logo;
      if (!saved.updated) result.missingArtwork += 1;
    } catch { result.failed += 1; }
  }

  for (const originalEntry of series) {
    let entry = originalEntry;
    if (entry.remotePosterUrl && !(await validateRemoteArtworkUrl(entry.remotePosterUrl, "poster"))) {
      await db.series.update(entry.id, { remotePosterUrl: null, updatedAt: Date.now() });
      entry = { ...entry, remotePosterUrl: null };
    }
    if (entry.remoteBackdropUrl && !(await validateRemoteArtworkUrl(entry.remoteBackdropUrl, "backdrop"))) {
      await db.series.update(entry.id, { remoteBackdropUrl: null, updatedAt: Date.now() });
      entry = { ...entry, remoteBackdropUrl: null };
    }
    if (entry.remoteLogoUrl) {
      try {
        if (!(await validateRemoteLogoUrl(entry.remoteLogoUrl))) {
          result.rejectedLogos += 1;
          await db.series.update(entry.id, { remoteLogoUrl: null, updatedAt: Date.now() });
          entry = { ...entry, remoteLogoUrl: null };
        }
      } catch {
        result.rejectedLogos += 1;
        await db.series.update(entry.id, { remoteLogoUrl: null, updatedAt: Date.now() });
        entry = { ...entry, remoteLogoUrl: null };
      }
    }
    if (
      entry.remotePosterUrl &&
      entry.remoteBackdropUrl &&
      entry.remoteLogoUrl &&
      entry.metadataProvider !== "fanart"
    ) {
      result.skipped += 1;
      continue;
    }
    try {
      const entity = await findWikidataEntity(entry.title, entry.year);
      const tvdbId = await findTvmazeTvdbId(entry) ?? claimValue(entity, "P4835");
      if (!tvdbId) { result.skipped += 1; continue; }
      const response = await fetchFanart("tv", tvdbId, apiKey);
      if (!response) { result.skipped += 1; continue; }
      if (response.name && normalize(response.name) !== normalize(entry.title)) {
        result.skipped += 1;
        continue;
      }
      result.matched += 1;
      const validated = await chooseValidatedFanartArtwork("tv", response);
      result.rejectedLogos += validated.rejectedLogos;
      const saved = await saveSeriesArtwork(entry, validated.artwork);
      if (saved.updated) result.updated += 1;
      result.postersSaved += saved.poster;
      result.backdropsSaved += saved.backdrop;
      result.logosSaved += saved.logo;
      if (!saved.updated) result.missingArtwork += 1;
    } catch { result.failed += 1; }
  }

  return result;
}

export async function syncAllArtwork(): Promise<AllArtworkSyncResult> {
  // TVmaze runs first so series provider IDs and episode-specific stills are
  // available even when Fanart.tv is not configured.
  const tvmaze = await syncSeriesPostersFromTvmaze();
  const fanart = await syncFanartArtwork();
  const movies = await syncMoviePosters();
  const logos = await syncWikimediaLogos();
  return { tvmaze, movies, logos, fanart };
}
