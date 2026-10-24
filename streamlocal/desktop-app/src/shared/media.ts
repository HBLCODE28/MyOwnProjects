import { createHash } from "node:crypto";
import { basename, extname } from "node:path";
import type { MediaFile, MediaType } from "./types";

export const VIDEO_EXTENSIONS = new Set([".mkv", ".mp4", ".avi", ".mov", ".m4v", ".webm", ".wmv"]);
const clean = (value: string) => value.replace(/\.[^.]+$/, "").replace(/[._]/g, " ").replace(/\b(2160p|1080p|720p|web[- ]?dl|webrip|bluray|x26[45]|hevc|hdr|aac|dts|proper|repack)\b.*$/i, "").replace(/\s+/g, " ").trim();
export function classifyMedia(fileName: string, relativePath: string) {
  const stem = clean(fileName);
  const match = stem.match(/^(.*?)[\s.-]+(?:s(\d{1,2})[ ._-]*e(\d{1,3})|(\d{1,2})x(\d{1,3}))(?:\s|$)/i);
  if (match) return { type: "episode" as MediaType, title: clean(match[1]), series: clean(match[1]), season: Number(match[2] || match[4]), episode: Number(match[3] || match[5]) };
  const pathEpisode = stem.match(/^s(\d{1,2})e(\d{1,3})$/i);
  if (pathEpisode) {
    const parts = relativePath.split(/[\\/]/); const series = clean(parts[parts.length - 2] || "Unknown Series");
    return { type: "episode" as MediaType, title: series, series, season: Number(pathEpisode[1]), episode: Number(pathEpisode[2]) };
  }
  const year = stem.match(/\b((?:19|20)\d{2})\b/);
  return { type: "movie" as MediaType, title: clean(year ? stem.slice(0, year.index) : stem) || basename(fileName, extname(fileName)), year: year ? Number(year[1]) : undefined };
}
export function stableId(sourceId: string, relativePath: string, size: number, modified: number) { return createHash("sha256").update(`${sourceId}\0${relativePath}\0${size}\0${modified}`).digest("hex").slice(0, 24); }
export function makeMediaFile(sourceId: string, root: string, fullPath: string, relativePath: string, size: number, modified: number): MediaFile { const parsed = classifyMedia(basename(fullPath), relativePath); return { id: stableId(sourceId, relativePath, size, modified), sourceId, relativePath, fileName: basename(fullPath), path: fullPath, size, modified, ...parsed }; }
