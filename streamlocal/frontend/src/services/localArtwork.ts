import { db } from "../db/streamlocalDb";
import { attachArtworkToItem, storeArtwork } from "./artwork";

const POSTERS = ["poster.jpg", "poster.jpeg", "poster.png", "poster.webp", "folder.jpg", "cover.jpg"];
const BACKDROPS = ["backdrop.jpg", "backdrop.jpeg", "backdrop.png", "backdrop.webp", "fanart.jpg", "background.jpg"];
const LOGOS = ["logo.png", "logo.jpg", "logo.jpeg", "logo.webp", "clearlogo.png", "clearlogo.webp"];

async function parentDirectory(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<FileSystemDirectoryHandle | null> {
  const parts = relativePath.split("/").filter(Boolean);
  parts.pop();
  let directory = root;
  try {
    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part);
    }
    return directory;
  } catch {
    return null;
  }
}

async function firstExistingImage(
  directory: FileSystemDirectoryHandle,
  names: string[],
): Promise<File | null> {
  for (const name of names) {
    try {
      const handle = await directory.getFileHandle(name);
      return await handle.getFile();
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

export async function detectAndAttachLocalArtwork(
  itemId: string,
  sourceHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<void> {
  const item = await db.mediaItems.get(itemId);
  if (!item) return;

  const directory = await parentDirectory(sourceHandle, relativePath);
  if (!directory) return;

  if (!item.posterArtworkId) {
    const poster = await firstExistingImage(directory, POSTERS);
    if (poster) {
      const artworkId = await storeArtwork(poster, "poster");
      await attachArtworkToItem(itemId, artworkId, "poster", false);
    }
  }

  const refreshed = await db.mediaItems.get(itemId);
  if (!refreshed?.backdropArtworkId) {
    const backdrop = await firstExistingImage(directory, BACKDROPS);
    if (backdrop) {
      const artworkId = await storeArtwork(backdrop, "backdrop");
      await attachArtworkToItem(itemId, artworkId, "backdrop", false);
    }
  }

  const withLogo = await db.mediaItems.get(itemId);
  if (!withLogo?.logoArtworkId) {
    const logo = await firstExistingImage(directory, LOGOS);
    if (logo) {
      const artworkId = await storeArtwork(logo, "logo");
      await attachArtworkToItem(itemId, artworkId, "logo", false);
    }
  }
}
