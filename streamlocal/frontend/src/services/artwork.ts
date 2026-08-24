import { db } from "../db/streamlocalDb";
import type { Artwork } from "../types/library";
import { createId } from "../utils/id";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function storeArtwork(
  file: File,
  kind: "poster" | "backdrop",
): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Poster/backdrop must be JPG, PNG or WebP.");
  }

  const artwork: Artwork = {
    id: createId("art"),
    kind,
    mimeType: file.type,
    fileName: file.name,
    blob: file,
    createdAt: Date.now(),
  };
  await db.artwork.add(artwork);
  return artwork.id;
}

export async function attachArtworkToItem(
  itemId: string,
  artworkId: string,
  kind: "poster" | "backdrop",
  markManual = true,
): Promise<void> {
  await db.mediaItems.update(itemId, {
    ...(kind === "poster"
      ? { posterArtworkId: artworkId }
      : { backdropArtworkId: artworkId }),
    ...(markManual ? { manuallyEdited: true } : {}),
    updatedAt: Date.now(),
  });
}

export async function artworkObjectUrl(id: string | null): Promise<string | null> {
  if (!id) return null;
  const artwork = await db.artwork.get(id);
  return artwork ? URL.createObjectURL(artwork.blob) : null;
}

export async function cacheRemoteArtwork(
  itemId: string,
  remoteUrl: string,
  kind: "poster" | "backdrop",
): Promise<boolean> {
  const item = await db.mediaItems.get(itemId);
  if (!item) return false;
  if (kind === "poster" && item.posterArtworkId) return false;
  if (kind === "backdrop" && item.backdropArtworkId) return false;

  const response = await fetch(remoteUrl, { mode: "cors" });
  if (!response.ok) return false;
  const blob = await response.blob();
  if (!ALLOWED_TYPES.has(blob.type)) return false;

  const file = new File([blob], `${item.title}.${kind}.jpg`, {
    type: blob.type,
  });
  const artworkId = await storeArtwork(file, kind);
  await attachArtworkToItem(itemId, artworkId, kind, false);
  return true;
}
