import type { MediaItem } from "../types/library";
import { db } from "../db/streamlocalDb";
import { readSecret } from "./secretVault";
import { subtitleUrl } from "./localPlayback";

const API_ROOT = "https://api.opensubtitles.com/api/v1";
const USER_AGENT = "StreamLocal v0.3.0";

type FeatureDetails = {
  feature_type?: string;
  year?: number | string | null;
  title?: string;
  movie_name?: string;
  season_number?: number | null;
  episode_number?: number | null;
  parent_title?: string;
};

type OpenSubtitlesRow = {
  id: string;
  attributes?: {
    language?: string;
    hearing_impaired?: boolean;
    release?: string;
    download_count?: number;
    ratings?: number;
    from_trusted?: boolean;
    moviehash_match?: boolean;
    feature_details?: FeatureDetails;
    files?: Array<{ file_id?: number; file_name?: string | null }>;
  };
};

type OpenSubtitlesFeature = {
  id: string;
  attributes?: {
    feature_id?: number | string;
    feature_type?: string;
    year?: number | string | null;
    title?: string;
    original_title?: string | null;
    imdb_id?: number | string | null;
    tmdb_id?: number | string | null;
  };
};

type ResolvedFeature = {
  imdbId: string | null;
  tmdbId: string | null;
};

export type OpenSubtitleMatch = {
  id: string;
  fileId: number;
  language: string;
  label: string;
  hearingImpaired: boolean;
  featureTitle: string;
  score: number;
};

function headers(apiKey: string): HeadersInit {
  return {
    Accept: "application/json",
    "Api-Key": apiKey,
    "User-Agent": USER_AGENT,
  };
}

async function apiKey(): Promise<string> {
  const value = await readSecret("openSubtitlesApiKey");
  if (!value) throw new Error("Unlock the encrypted API key vault and save your OpenSubtitles API key in Settings first.");
  return value;
}

function normalizeTitle(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function titleEquals(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  return Boolean(a && b && a === b);
}

function featureType(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

function numericYear(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedId(value: number | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return String(value).replace(/^tt/i, "").replace(/^0+/, "") || "0";
}

const RELEASE_NOISE = new Set([
  "1080p", "2160p", "720p", "480p", "web", "webdl", "webrip", "bluray", "brrip", "dvdrip",
  "remux", "hdr", "dv", "x264", "x265", "h264", "h265", "hevc", "aac", "ac3", "eac3", "dts",
  "truehd", "atmos", "10bit", "proper", "repack", "extended", "multi", "mkv", "mp4", "srt", "vtt",
]);

function releaseTokens(value: string | null | undefined): Set<string> {
  const normalized = (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return new Set(normalized.split(/\s+/).filter((token) => token.length > 1 && !RELEASE_NOISE.has(token)));
}

function releaseSimilarity(videoFileName: string | null | undefined, ...candidateNames: Array<string | null | undefined>): number {
  const video = releaseTokens(videoFileName);
  if (!video.size) return 0;
  let best = 0;
  for (const candidateName of candidateNames) {
    const candidate = releaseTokens(candidateName);
    if (!candidate.size) continue;
    let overlap = 0;
    for (const token of video) if (candidate.has(token)) overlap += 1;
    best = Math.max(best, overlap / Math.max(video.size, candidate.size));
  }
  return best;
}

function episodeIdentityMatches(item: MediaItem, seriesTitle: string, details: FeatureDetails | undefined): boolean {
  if (!details || featureType(details.feature_type) !== "episode") return false;
  if (!titleEquals(details.parent_title, seriesTitle)) return false;
  if (item.seasonNumber != null && details.season_number !== item.seasonNumber) return false;
  if (item.episodeNumber != null && details.episode_number !== item.episodeNumber) return false;
  return true;
}

function movieIdentityMatches(item: MediaItem, details: FeatureDetails | undefined): boolean {
  if (!details || featureType(details.feature_type) !== "movie") return false;
  if (!titleEquals(details.title, item.title)) return false;
  const resultYear = numericYear(details.year);
  if (item.year != null && resultYear != null && item.year !== resultYear) return false;
  return true;
}

function scoreRow(item: MediaItem, videoFileName: string | null, row: OpenSubtitlesRow): number {
  const attributes = row.attributes;
  const details = attributes?.feature_details;
  const fileName = attributes?.files?.[0]?.file_name;
  let score = 1000;

  if (attributes?.moviehash_match) score += 600;
  if (item.type === "movie" && item.year != null && numericYear(details?.year) === item.year) score += 160;
  if (item.type === "episode") {
    if (item.seasonNumber != null && details?.season_number === item.seasonNumber) score += 120;
    if (item.episodeNumber != null && details?.episode_number === item.episodeNumber) score += 160;
    if (item.episodeTitle && titleEquals(details?.title, item.episodeTitle)) score += 40;
  }

  score += Math.round(releaseSimilarity(videoFileName, attributes?.release, fileName) * 300);
  if (attributes?.from_trusted) score += 45;
  score += Math.min(50, Math.max(0, Number(attributes?.ratings ?? 0)) * 5);
  score += Math.min(80, Math.log10(Math.max(1, Number(attributes?.download_count ?? 0))) * 20);
  if (attributes?.hearing_impaired) score -= 5;
  return score;
}

function displayFeatureTitle(item: MediaItem, details: FeatureDetails | undefined): string {
  if (item.type === "episode") {
    const parent = details?.parent_title || item.title;
    const season = details?.season_number ?? item.seasonNumber;
    const episode = details?.episode_number ?? item.episodeNumber;
    if (season != null && episode != null) {
      return `${parent} · S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
    }
    return parent;
  }
  const year = numericYear(details?.year) ?? item.year;
  return `${details?.title || item.title}${year ? ` (${year})` : ""}`;
}

export async function buildOpenSubtitlesFeatureParams(item: MediaItem): Promise<URLSearchParams> {
  const series = item.type === "episode" && item.seriesId ? await db.series.get(item.seriesId) : null;
  const title = item.type === "episode" ? (series?.title || item.title) : item.title;
  const params = new URLSearchParams({
    query: title.toLowerCase(),
    query_match: "exact",
    full_search: "true",
    type: item.type === "episode" ? "tvshow" : "movie",
  });
  const year = item.type === "episode" ? series?.year : item.year;
  if (year) params.set("year", String(year));
  return params;
}

export async function buildOpenSubtitlesSearchParams(item: MediaItem): Promise<URLSearchParams> {
  const params = new URLSearchParams({
    languages: "en,he",
    order_by: "download_count",
    order_direction: "desc",
  });

  if (item.type === "episode") {
    const series = item.seriesId ? await db.series.get(item.seriesId) : null;
    params.set("query", (series?.title || item.title).toLowerCase());
    params.set("type", "episode");
    if (item.seasonNumber != null) params.set("season_number", String(item.seasonNumber));
    if (item.episodeNumber != null) params.set("episode_number", String(item.episodeNumber));
  } else {
    params.set("query", item.title.toLowerCase());
    params.set("type", "movie");
    if (item.year) params.set("year", String(item.year));
  }

  return params;
}

async function resolveExactFeature(item: MediaItem, key: string): Promise<ResolvedFeature | null> {
  const params = await buildOpenSubtitlesFeatureParams(item);
  const response = await fetch(`${API_ROOT}/features?${params.toString()}`, { headers: headers(key) });
  if (!response.ok) return null;
  const json = (await response.json()) as { data?: OpenSubtitlesFeature[] };
  const series = item.type === "episode" && item.seriesId ? await db.series.get(item.seriesId) : null;
  const expectedTitle = item.type === "episode" ? (series?.title || item.title) : item.title;
  const expectedType = item.type === "episode" ? "tvshow" : "movie";
  const expectedYear = item.type === "episode" ? series?.year : item.year;

  const exact = (json.data ?? []).filter((row) => {
    const attributes = row.attributes;
    if (featureType(attributes?.feature_type) !== expectedType) return false;
    if (!titleEquals(attributes?.title, expectedTitle) && !titleEquals(attributes?.original_title, expectedTitle)) return false;
    const year = numericYear(attributes?.year);
    if (expectedYear != null && year != null && year !== expectedYear) return false;
    return true;
  });

  if (!exact.length) return null;
  if (expectedYear == null && exact.length > 1) {
    const distinctIds = new Set(exact.map((row) => `${normalizedId(row.attributes?.imdb_id)}:${normalizedId(row.attributes?.tmdb_id)}`));
    if (distinctIds.size > 1) return null;
  }

  const selected = exact[0]?.attributes;
  return {
    imdbId: normalizedId(selected?.imdb_id),
    tmdbId: normalizedId(selected?.tmdb_id),
  };
}

async function buildPreciseSubtitleParams(item: MediaItem, key: string): Promise<URLSearchParams> {
  const params = await buildOpenSubtitlesSearchParams(item);
  const feature = await resolveExactFeature(item, key);
  if (!feature) return params;

  params.delete("query");
  params.delete("year");
  if (item.type === "episode") {
    if (feature.imdbId) params.set("parent_imdb_id", feature.imdbId);
    else if (feature.tmdbId) params.set("parent_tmdb_id", feature.tmdbId);
  } else {
    if (feature.imdbId) params.set("imdb_id", feature.imdbId);
    else if (feature.tmdbId) params.set("tmdb_id", feature.tmdbId);
  }
  return params;
}

export async function searchOpenSubtitles(item: MediaItem): Promise<OpenSubtitleMatch[]> {
  const key = await apiKey();
  const params = await buildPreciseSubtitleParams(item, key);
  const [response, mediaFile, series] = await Promise.all([
    fetch(`${API_ROOT}/subtitles?${params.toString()}`, { headers: headers(key) }),
    db.mediaFiles.get(item.mediaFileId),
    item.type === "episode" && item.seriesId ? db.series.get(item.seriesId) : Promise.resolve(undefined),
  ]);
  if (!response.ok) throw new Error(`OpenSubtitles search failed (${response.status}).`);
  const json = (await response.json()) as { data?: OpenSubtitlesRow[] };
  const expectedSeriesTitle = series?.title || item.title;

  return (json.data ?? [])
    .flatMap((row): OpenSubtitleMatch[] => {
      const attributes = row.attributes;
      const details = attributes?.feature_details;
      const matchesIdentity = item.type === "episode"
        ? episodeIdentityMatches(item, expectedSeriesTitle, details)
        : movieIdentityMatches(item, details);
      if (!matchesIdentity) return [];

      const file = attributes?.files?.[0];
      if (!file?.file_id) return [];
      const language = attributes?.language ?? "und";
      const featureTitle = displayFeatureTitle(item, details);
      const release = attributes?.release || file.file_name || "OpenSubtitles";
      const score = scoreRow(item, mediaFile?.fileName ?? null, row);
      return [{
        id: row.id,
        fileId: file.file_id,
        language,
        label: `${language.toUpperCase()} · ${featureTitle} · ${release}`,
        hearingImpaired: Boolean(attributes?.hearing_impaired),
        featureTitle,
        score,
      }];
    })
    .sort((a, b) => b.score - a.score || a.language.localeCompare(b.language));
}

export async function downloadOpenSubtitle(match: OpenSubtitleMatch): Promise<{
  text: string;
  fileName: string;
  src: string;
}> {
  const key = await apiKey();
  const response = await fetch(`${API_ROOT}/download`, {
    method: "POST",
    headers: { ...headers(key), "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: match.fileId, sub_format: "srt" }),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("OpenSubtitles rejected the API key (401). Re-enter the key in Settings.");
    throw new Error(`OpenSubtitles download failed (${response.status}).`);
  }
  const json = (await response.json()) as { link?: string; file_name?: string };
  if (!json.link) throw new Error("OpenSubtitles did not return a subtitle download link.");
  const fileResponse = await fetch(json.link, { headers: { "User-Agent": USER_AGENT } });
  if (!fileResponse.ok) throw new Error("The OpenSubtitles file could not be downloaded.");
  const raw = await fileResponse.text();
  const text = `WEBVTT\n\n${raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/(\d{2}:\d{2}:\d{2}),([0-9]{3})/g, "$1.$2")}`;
  return { text, fileName: json.file_name ?? `opensubtitles-${match.fileId}.srt`, src: subtitleUrl(text) };
}
