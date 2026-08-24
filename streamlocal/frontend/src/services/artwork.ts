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
