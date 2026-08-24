import { db } from "../db/streamlocalDb";

export const TIMELINE_PREVIEW_INTERVAL = 5;

export function timelinePreviewPosition(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(seconds / TIMELINE_PREVIEW_INTERVAL) * TIMELINE_PREVIEW_INTERVAL;
}

function previewId(mediaFileId: string, positionSeconds: number): string {
  return `${mediaFileId}:${positionSeconds}`;
}

function createFrame(video: HTMLVideoElement): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  const sourceWidth = video.videoWidth || 320;
  const sourceHeight = video.videoHeight || 180;
  const width = 320;
  const height = Math.max(1, Math.round((sourceHeight / sourceWidth) * width));
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  context.drawImage(video, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.78);
  });
}

async function renderFrame(file: File, positionSeconds: number): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("Timeline preview timed out.")),
        8000,
      );
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(
          Math.max(0, positionSeconds),
          Math.max(0, (video.duration || positionSeconds) - 0.1),
        );
      };
      video.onseeked = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("This media cannot generate a timeline preview."));
      };
      video.load();
    });
    return await createFrame(video);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export async function getOrCreateTimelinePreview(
  mediaFileId: string,
  file: File,
  seconds: number,
): Promise<string | null> {
  const positionSeconds = timelinePreviewPosition(seconds);
  const id = previewId(mediaFileId, positionSeconds);
  const existing = await db.timelinePreviews.get(id);
  if (existing) return URL.createObjectURL(existing.blob);

  const blob = await renderFrame(file, positionSeconds);
  if (!blob) return null;

  await db.timelinePreviews.put({
    id,
    mediaFileId,
    positionSeconds,
    mimeType: blob.type || "image/jpeg",
    blob,
    createdAt: Date.now(),
  });
  return URL.createObjectURL(blob);
}

export async function clearTimelinePreviews(mediaFileId: string): Promise<void> {
  const rows = await db.timelinePreviews
    .where("mediaFileId")
    .equals(mediaFileId)
    .toArray();
  await db.timelinePreviews.bulkDelete(rows.map((row) => row.id));
}

export function timelinePreviewCacheId(mediaFileId: string, seconds: number): string {
  return previewId(mediaFileId, timelinePreviewPosition(seconds));
}
