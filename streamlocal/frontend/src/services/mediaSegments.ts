import { db } from "../db/streamlocalDb";
import type { MediaSegment, MediaSegmentType } from "../types/library";
import { createId } from "../utils/id";

export async function getMediaSegments(mediaItemId: string): Promise<MediaSegment[]> {
  return db.mediaSegments
    .where("mediaItemId")
    .equals(mediaItemId)
    .sortBy("startSeconds");
}

export function activeMediaSegment(
  segments: MediaSegment[],
  positionSeconds: number,
): MediaSegment | null {
  return segments.find(
    (segment) =>
      positionSeconds >= segment.startSeconds &&
      positionSeconds < segment.endSeconds,
  ) ?? null;
}

export async function replaceManualMediaSegments(
  mediaItemId: string,
  values: Partial<Record<MediaSegmentType, { startSeconds: number; endSeconds: number }>>,
): Promise<void> {
  const existing = await getMediaSegments(mediaItemId);
  await db.mediaSegments.bulkDelete(
    existing.filter((segment) => segment.source === "manual").map((segment) => segment.id),
  );

  const now = Date.now();
  const next: MediaSegment[] = [];
  for (const type of ["intro", "recap", "credits"] as const) {
    const value = values[type];
    if (!value) continue;
    if (
      !Number.isFinite(value.startSeconds) ||
      !Number.isFinite(value.endSeconds) ||
      value.startSeconds < 0 ||
      value.endSeconds <= value.startSeconds
    ) {
      throw new Error(`${type} segment times are invalid.`);
    }
    next.push({
      id: createId("segment"),
      mediaItemId,
      type,
      startSeconds: value.startSeconds,
      endSeconds: value.endSeconds,
      source: "manual",
      createdAt: now,
      updatedAt: now,
    });
  }
  if (next.length > 0) await db.mediaSegments.bulkAdd(next);
}

export async function deleteMediaSegments(mediaItemId: string): Promise<void> {
  const rows = await getMediaSegments(mediaItemId);
  await db.mediaSegments.bulkDelete(rows.map((row) => row.id));
}
