import { db } from "../db/streamlocalDb";
import type { MediaFile, MediaItem, Series } from "../types/library";
import { createId } from "../utils/id";
import { parseMediaName } from "./filenameParser";
import { readLocalMetadata } from "./localMetadata";
import { detectAndAttachLocalArtwork } from "./localArtwork";

function normalizeSeriesTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getOrCreateSeries(
  title: string,
  year: number | null,
): Promise<Series> {
  const normalizedTitle = normalizeSeriesTitle(title);
  const existing = await db.series
    .where("normalizedTitle")
    .equals(normalizedTitle)
    .first();

  if (existing) return existing;

  const series: Series = {
    id: createId("series"),
    normalizedTitle,
    title,
    year,
    overview: "",
    genres: [],
    posterArtworkId: null,
    backdropArtworkId: null,
    logoArtworkId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.series.add(series);
  return series;
}

async function sourceFor(file: MediaFile) {
  return db.librarySources.get(file.sourceId);
}

export type RecognitionSummary = {
  processed: number;
  matched: number;
  needsMatch: number;
  movies: number;
  episodes: number;
};

export async function recognizeFile(file: MediaFile): Promise<MediaItem> {
  const existing = await db.mediaItems
    .where("mediaFileId")
    .equals(file.id)
    .first();

  if (existing?.manuallyEdited) return existing;

  const parsed = parseMediaName(file.fileName, file.relativePath);
  const source = await sourceFor(file);
  const rootHandle = source?.handle ?? null;
  const sidecar = rootHandle
    ? await readLocalMetadata(rootHandle, file.relativePath)
    : null;

  const type = sidecar?.type ?? parsed.type;
  const seriesTitle = sidecar?.seriesTitle ?? parsed.title;
  const seasonNumber = sidecar?.seasonNumber ?? parsed.seasonNumber;
  const episodeNumber = sidecar?.episodeNumber ?? parsed.episodeNumber;
  const year = sidecar?.year ?? parsed.year;

  const title =
    type === "episode"
      ? sidecar?.episodeTitle ?? sidecar?.title ?? parsed.title
      : sidecar?.title ?? parsed.title;

  let seriesId: string | null = null;

  if (type === "episode") {
    const series = await getOrCreateSeries(seriesTitle, year);
    seriesId = series.id;
  }

  const confidence = sidecar ? "high" : parsed.confidence;
  const matchStatus =
    confidence === "low" || parsed.title.startsWith("Unknown")
      ? "needs_match"
      : "matched";

  const now = Date.now();
  let item: MediaItem;

  if (existing) {
    const updates: Partial<MediaItem> = {
      type,
      title,
      year,
      overview: sidecar?.overview ?? existing.overview,
      genres: sidecar?.genres ?? existing.genres,
      seriesId,
      seasonNumber: type === "episode" ? seasonNumber : null,
      episodeNumber: type === "episode" ? episodeNumber : null,
      episodeTitle:
        type === "episode"
          ? sidecar?.episodeTitle ?? existing.episodeTitle
          : null,
      confidence,
      matchStatus,
      updatedAt: now,
    };

    await db.mediaItems.update(existing.id, updates);
    item = { ...existing, ...updates } as MediaItem;
  } else {
    item = {
      id: createId("item"),
      mediaFileId: file.id,
      type,
      title,
      year,
      overview: sidecar?.overview ?? "",
      genres: sidecar?.genres ?? [],
      seriesId,
      seasonNumber: type === "episode" ? seasonNumber : null,
      episodeNumber: type === "episode" ? episodeNumber : null,
      episodeTitle:
        type === "episode" ? sidecar?.episodeTitle ?? null : null,
      confidence,
      matchStatus,
      manuallyEdited: false,
      posterArtworkId: null,
      backdropArtworkId: null,
      logoArtworkId: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.mediaItems.add(item);
  }

  if (rootHandle) {
    await detectAndAttachLocalArtwork(
      item.id,
      rootHandle,
      file.relativePath,
    );
    item = (await db.mediaItems.get(item.id)) ?? item;
  }

  return item;
}

export async function identifyLibrary(
  _force = false,
): Promise<RecognitionSummary> {
  const files = await db.mediaFiles.toArray();

  let matched = 0;
  let needsMatch = 0;
  let movies = 0;
  let episodes = 0;

  for (const file of files) {
    const item = await recognizeFile(file);

    if (item.matchStatus === "matched") matched += 1;
    else needsMatch += 1;

    if (item.type === "movie") movies += 1;
    if (item.type === "episode") episodes += 1;
  }

  return {
    processed: files.length,
    matched,
    needsMatch,
    movies,
    episodes,
  };
}

export async function saveManualMediaItem(
  itemId: string,
  updates: {
    type: "movie" | "episode";
    title: string;
    year: number | null;
    overview: string;
    genres: string[];
    seriesTitle?: string;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    episodeTitle?: string | null;
  },
): Promise<void> {
  const item = await db.mediaItems.get(itemId);
  if (!item) {
    throw new Error("Media item was not found.");
  }

  let seriesId: string | null = null;

  if (updates.type === "episode") {
    const seriesTitle = updates.seriesTitle?.trim();

    if (!seriesTitle) {
      throw new Error("Series title is required for an episode.");
    }

    /*
     * When editing an existing episode, rename its current Series record
     * instead of only changing MediaItem.title. That Series.title is what
     * the Identify and later Series screens display.
     */
    if (item.seriesId) {
      const currentSeries = await db.series.get(item.seriesId);

      if (currentSeries) {
        const normalizedTitle = normalizeSeriesTitle(seriesTitle);

        const conflictingSeries = await db.series
          .where("normalizedTitle")
          .equals(normalizedTitle)
          .first();

        if (
          conflictingSeries &&
          conflictingSeries.id !== currentSeries.id
        ) {
          /*
           * If the requested name already belongs to another series,
           * attach this episode to that series rather than creating
           * duplicate series records.
           */
          seriesId = conflictingSeries.id;
        } else {
          await db.series.update(currentSeries.id, {
            title: seriesTitle,
            normalizedTitle,
            year: updates.year ?? currentSeries.year,
            updatedAt: Date.now(),
          });
          seriesId = currentSeries.id;
        }
      }
    }

    if (!seriesId) {
      const series = await getOrCreateSeries(seriesTitle, updates.year);
      seriesId = series.id;
    }
  }

  await db.mediaItems.update(itemId, {
    type: updates.type,
    title:
      updates.type === "episode"
        ? updates.episodeTitle?.trim() || updates.title.trim()
        : updates.title.trim() || item.title,
    year: updates.year,
    overview: updates.overview,
    genres: updates.genres,
    seriesId,
    seasonNumber:
      updates.type === "episode"
        ? updates.seasonNumber ?? null
        : null,
    episodeNumber:
      updates.type === "episode"
        ? updates.episodeNumber ?? null
        : null,
    episodeTitle:
      updates.type === "episode"
        ? updates.episodeTitle?.trim() || null
        : null,
    confidence: "high",
    matchStatus: "matched",
    manuallyEdited: true,
    updatedAt: Date.now(),
  });
}

export async function resetToAutomatic(itemId: string): Promise<void> {
  const item = await db.mediaItems.get(itemId);
  if (!item) {
    throw new Error("Media item was not found.");
  }

  await db.mediaItems.update(itemId, {
    manuallyEdited: false,
  });

  const file = await db.mediaFiles.get(item.mediaFileId);
  if (file) {
    await recognizeFile(file);
  }
}
