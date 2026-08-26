import { db } from "../db/streamlocalDb";
import type { Artwork, MediaItem } from "../types/library";
import { createId } from "../utils/id";
import { validateRemoteLogoUrl } from "./logoValidation";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function storeArtwork(
  file: File,
  kind: "poster" | "backdrop" | "logo",
): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Artwork must be JPG, PNG or WebP.");
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
  kind: "poster" | "backdrop" | "logo",
  markManual = true,
): Promise<void> {
  await db.mediaItems.update(itemId, {
    ...(kind === "poster"
      ? { posterArtworkId: artworkId }
      : kind === "backdrop"
        ? { backdropArtworkId: artworkId }
        : { logoArtworkId: artworkId }),
    ...(markManual ? { manuallyEdited: true } : {}),
    updatedAt: Date.now(),
  });
}

export type ArtworkObjectSource = {
  url: string;
  fileName: string;
};

export async function artworkObjectSource(id: string | null): Promise<ArtworkObjectSource | null> {
  if (!id) return null;
  const artwork = await db.artwork.get(id);
  return artwork
    ? { url: URL.createObjectURL(artwork.blob), fileName: artwork.fileName }
    : null;
}

export async function artworkObjectUrl(id: string | null): Promise<string | null> {
  return (await artworkObjectSource(id))?.url ?? null;
}

export function isAutoCachedArtworkFileName(
  fileName: string,
  ownerId: string,
  kind: "poster" | "backdrop" | "logo",
): boolean {
  return fileName === `streamlocal-remote-${ownerId}-${kind}.jpg`;
}

export async function cacheRemoteArtwork(
  itemId: string,
  remoteUrl: string,
  kind: "poster" | "backdrop" | "logo",
): Promise<boolean> {
  const item = await db.mediaItems.get(itemId);
  if (!item) return false;
  if (kind === "poster" && item.posterArtworkId) return false;
  if (kind === "backdrop" && item.backdropArtworkId) return false;
  if (kind === "logo" && item.logoArtworkId) return false;
  if (kind === "logo" && !(await validateRemoteLogoUrl(remoteUrl))) return false;

  const response = await fetch(remoteUrl, { mode: "cors" });
  if (!response.ok) return false;
  const blob = await response.blob();
  if (!ALLOWED_TYPES.has(blob.type)) return false;

  const file = new File([blob], `streamlocal-remote-${item.id}-${kind}.jpg`, {
    type: blob.type,
  });
  const artworkId = await storeArtwork(file, kind);
  await attachArtworkToItem(itemId, artworkId, kind, false);
  return true;
}

export async function clearAutoCachedArtwork(
  item: MediaItem,
  kind: "poster" | "backdrop" | "logo",
): Promise<boolean> {
  const artworkId = kind === "poster"
    ? item.posterArtworkId
    : kind === "backdrop"
      ? item.backdropArtworkId
      : item.logoArtworkId;
  if (!artworkId) return false;

  const artwork = await db.artwork.get(artworkId);
  if (!artwork || artwork.kind !== kind) return false;

  const legacyCacheName = `${item.title}.${kind}.jpg`;
  const currentCacheName = `streamlocal-remote-${item.id}-${kind}.jpg`;
  if (artwork.fileName !== legacyCacheName && artwork.fileName !== currentCacheName) {
    return false;
  }

  await db.transaction("rw", db.mediaItems, db.artwork, async () => {
    await db.mediaItems.update(item.id, {
      ...(kind === "poster"
        ? { posterArtworkId: null }
        : kind === "backdrop"
          ? { backdropArtworkId: null }
          : { logoArtworkId: null }),
      updatedAt: Date.now(),
    });
    await db.artwork.delete(artworkId);
  });
  return true;
}


export async function validateRemoteArtworkUrl(
  url: string,
  kind: "poster" | "backdrop",
): Promise<boolean> {
  if (typeof Image === "undefined") return true;

  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(value);
    };
    // A slow provider should not make an existing working URL disappear. Only an
    // explicit image load failure or an obviously wrong aspect ratio is rejected.
    const timeoutId = window.setTimeout(() => finish(true), 8000);
    image.referrerPolicy = "no-referrer";
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) {
        finish(false);
        return;
      }
      const validShape = kind === "poster"
        ? height >= width * 1.12
        : width >= height * 1.18;
      finish(validShape);
    };
    image.onerror = () => finish(false);
    image.src = url;
  });
}
