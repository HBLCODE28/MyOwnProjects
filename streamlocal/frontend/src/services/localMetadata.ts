export type LocalMetadata = {
  title?: string;
  year?: number;
  overview?: string;
  genres?: string[];
  type?: "movie" | "episode";
  seriesTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
};

async function getParentDirectory(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<{ directory: FileSystemDirectoryHandle; stem: string } | null> {
  const parts = relativePath.split("/").filter(Boolean);
  if (!parts.length) return null;

  const fileName = parts.pop()!;
  const stem = fileName.replace(/\.[^.]+$/, "");
  let directory = root;

  try {
    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part);
    }
    return { directory, stem };
  } catch {
    return null;
  }
}

async function tryReadFile(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<string | null> {
  try {
    const handle = await directory.getFileHandle(name);
    return await (await handle.getFile()).text();
  } catch {
    return null;
  }
}

function normalizeJson(value: Record<string, unknown>): LocalMetadata {
  const genres = Array.isArray(value.genres)
    ? value.genres.map(String)
    : typeof value.genres === "string"
      ? value.genres.split(",").map((genre) => genre.trim()).filter(Boolean)
      : undefined;

  return {
    title: typeof value.title === "string" ? value.title : undefined,
    year: typeof value.year === "number" ? value.year : Number(value.year) || undefined,
    overview:
      typeof value.overview === "string"
        ? value.overview
        : typeof value.plot === "string"
          ? value.plot
          : undefined,
    genres,
    type: value.type === "movie" || value.type === "episode" ? value.type : undefined,
    seriesTitle:
      typeof value.seriesTitle === "string"
        ? value.seriesTitle
        : typeof value.showtitle === "string"
          ? value.showtitle
          : undefined,
    seasonNumber: Number(value.seasonNumber ?? value.season) || undefined,
    episodeNumber: Number(value.episodeNumber ?? value.episode) || undefined,
    episodeTitle: typeof value.episodeTitle === "string" ? value.episodeTitle : undefined,
  };
}

function textOf(root: Document, tag: string): string | undefined {
  const value = root.querySelector(tag)?.textContent?.trim();
  return value || undefined;
}

function parseNfo(xml: string): LocalMetadata | null {
  if (typeof DOMParser === "undefined") return null;
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) return null;

  const season = Number(textOf(document, "season"));
  const episode = Number(textOf(document, "episode"));
  const year = Number(textOf(document, "year"));
  const genres = [...document.querySelectorAll("genre")]
    .map((node) => node.textContent?.trim())
    .filter((value): value is string => Boolean(value));

  return {
    title: textOf(document, "title"),
    year: year || undefined,
    overview: textOf(document, "plot") ?? textOf(document, "outline"),
    genres: genres.length ? genres : undefined,
    type: season || episode ? "episode" : "movie",
    seriesTitle: textOf(document, "showtitle"),
    seasonNumber: season || undefined,
    episodeNumber: episode || undefined,
    episodeTitle: season || episode ? textOf(document, "title") : undefined,
  };
}

export async function readLocalMetadata(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<LocalMetadata | null> {
  const parent = await getParentDirectory(root, relativePath);
  if (!parent) return null;

  const jsonCandidates = [`${parent.stem}.json`, "movie.json", "episode.json"];
  for (const name of jsonCandidates) {
    const text = await tryReadFile(parent.directory, name);
    if (!text) continue;
    try {
      return normalizeJson(JSON.parse(text) as Record<string, unknown>);
    } catch {
      // Continue to other sidecars.
    }
  }

  const nfoCandidates = [`${parent.stem}.nfo`, "movie.nfo", "tvshow.nfo"];
  for (const name of nfoCandidates) {
    const text = await tryReadFile(parent.directory, name);
    if (!text) continue;
    const parsed = parseNfo(text);
    if (parsed) return parsed;
  }

  return null;
}


import { networkJoinRelative, networkParentPath, networkReadText } from "./networkBridge";

export async function readNetworkLocalMetadata(
  rootPath: string,
  relativePath: string,
): Promise<LocalMetadata | null> {
  const parent = networkParentPath(relativePath);
  if (!parent) return null;

  const jsonCandidates = [`${parent.stem}.json`, "movie.json", "episode.json"];
  for (const name of jsonCandidates) {
    const text = await networkReadText(rootPath, networkJoinRelative(parent.directory, name));
    if (!text) continue;
    try {
      return normalizeJson(JSON.parse(text) as Record<string, unknown>);
    } catch {
      // Continue to other sidecars.
    }
  }

  const nfoCandidates = [`${parent.stem}.nfo`, "movie.nfo", "tvshow.nfo"];
  for (const name of nfoCandidates) {
    const text = await networkReadText(rootPath, networkJoinRelative(parent.directory, name));
    if (!text) continue;
    const parsed = parseNfo(text);
    if (parsed) return parsed;
  }

  return null;
}
