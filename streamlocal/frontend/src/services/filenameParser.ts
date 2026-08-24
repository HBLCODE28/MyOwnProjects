import type { Confidence, ParsedMediaName } from "../types/library";

const VIDEO_NOISE = [
  "2160p", "1080p", "720p", "480p",
  "web-dl", "webdl", "webrip", "web-rip",
  "bluray", "blu-ray", "brrip", "dvdrip", "hdtv",
  "remux", "hdr", "hdr10", "dolby vision", "dv",
  "x264", "x265", "h264", "h265", "hevc", "av1",
  "aac", "ac3", "eac3", "ddp", "dts", "truehd", "atmos",
  "10bit", "8bit"
];

const EPISODE_PATTERNS = [
  /^(.*?)[ ._\-\[\(]+s(\d{1,2})e(\d{1,3})(?:\D|$)/i,
  /^(.*?)[ ._\-\[\(]+(\d{1,2})x(\d{1,3})(?:\D|$)/i,
  /^(.*?)[ ._\-\[\(]+season[ ._-]*(\d{1,2})[ ._-]*episode[ ._-]*(\d{1,3})(?:\D|$)/i
];

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function cleanSeparators(value: string): string {
  return value
    .replace(/[._]+/g, " ")
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeNoise(value: string): string {
  let output = value;
  for (const token of VIDEO_NOISE) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  }

  output = output
    .replace(/\b(?:proper|repack|extended|unrated|limited|internal|multi|dual|dubbed)\b/gi, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*(?:1080|2160|720|x26|hevc|web|bluray|hdr)[^)]*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return output;
}

function titleCaseWords(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function cleanTitle(value: string): string {
  const cleaned = cleanSeparators(removeNoise(cleanSeparators(value)))
    .replace(/\b(?:19|20)\d{2}\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return titleCaseWords(cleaned);
}

function parseYear(value: string): number | null {
  const years = [...value.matchAll(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/g)];
  if (!years.length) return null;
  const year = Number(years[years.length - 1][1]);
  return year >= 1900 && year <= new Date().getFullYear() + 1 ? year : null;
}

function folderSeriesCandidate(relativePath: string): string | null {
  const parts = relativePath.split(/[\\/]/).filter(Boolean);
  if (parts.length < 2) return null;

  const parentCandidates = parts.slice(0, -1).reverse();
  for (const part of parentCandidates) {
    if (/^season\s*\d+$/i.test(part)) continue;
    if (/^s\d{1,2}$/i.test(part)) continue;
    if (/^(tv|shows|tv shows|series|media)$/i.test(part)) continue;
    const cleaned = cleanTitle(part);
    if (cleaned) return cleaned;
  }
  return null;
}

export function parseMediaName(fileName: string, relativePath = fileName): ParsedMediaName {
  const stem = stripExtension(fileName);
  const normalized = cleanSeparators(stem);

  for (const pattern of EPISODE_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      const titleFromFile = cleanTitle(match[1] ?? "");
      const titleFromFolder = folderSeriesCandidate(relativePath);
      const title = titleFromFile || titleFromFolder || "Unknown Series";

      return {
        type: "episode",
        title,
        year: parseYear(normalized),
        seasonNumber: Number(match[2]),
        episodeNumber: Number(match[3]),
        confidence: title !== "Unknown Series" ? "high" : "medium"
      };
    }
  }

  const onlyEpisode = normalized.match(/^(?:s)?(\d{1,2})e(\d{1,3})$/i);
  if (onlyEpisode) {
    const folderTitle = folderSeriesCandidate(relativePath);
    return {
      type: "episode",
      title: folderTitle || "Unknown Series",
      year: null,
      seasonNumber: Number(onlyEpisode[1]),
      episodeNumber: Number(onlyEpisode[2]),
      confidence: folderTitle ? "medium" : "low"
    };
  }

  const year = parseYear(normalized);
  const titleBeforeYear = year
    ? normalized.slice(0, Math.max(0, normalized.lastIndexOf(String(year))))
    : normalized;
  const title = cleanTitle(titleBeforeYear || normalized);

  return {
    type: "movie",
    title: title || "Unknown Movie",
    year,
    seasonNumber: null,
    episodeNumber: null,
    confidence: title && year ? "high" : title ? "medium" : "low"
  };
}
