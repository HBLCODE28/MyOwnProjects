import { db } from "../db/streamlocalDb";
import type { LibrarySource, MediaFile } from "../types/library";
import { createId } from "../utils/id";
import { createFingerprint } from "./fingerprint";
import { verifyReadPermission } from "./fileSystem";
import { clearTimelinePreviews } from "./timelinePreview";
import { networkFingerprint, scanNetworkFolder } from "./networkBridge";

const VIDEO_EXTENSIONS = new Set(["mp4", "mkv"]);

type DiscoveredFile = {
  relativePath: string;
  fileName: string;
  extension: string;
  size: number;
  lastModified: number;
  fingerprint?: string;
  file?: File;
};

async function walkDirectory(
  handle: FileSystemDirectoryHandle,
  prefix = "",
  recursive = true,
): Promise<DiscoveredFile[]> {
  const files: DiscoveredFile[] = [];

  for await (const [name, entry] of handle.entries()) {
    const relativePath = prefix ? `${prefix}/${name}` : name;

    if (entry.kind === "file") {
      const extension = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
      if (VIDEO_EXTENSIONS.has(extension)) {
        const file = await (entry as FileSystemFileHandle).getFile();
        files.push({
          file,
          relativePath,
          fileName: file.name,
          extension,
          size: file.size,
          lastModified: file.lastModified,
        });
      }
    } else if (recursive) {
      files.push(
        ...(await walkDirectory(entry as FileSystemDirectoryHandle, relativePath, recursive)),
      );
    }
  }

  return files;
}

async function discoverSource(source: LibrarySource): Promise<DiscoveredFile[]> {
  if (source.nativePath) {
    const result = await scanNetworkFolder(source.nativePath, source.recursive);
    return result.files.map((file) => ({ ...file }));
  }

  if (!source.handle) {
    throw new Error("This folder is not connected on this computer.");
  }

  if (!(await verifyReadPermission(source.handle))) {
    throw new Error("Folder permission was not granted.");
  }

  return walkDirectory(source.handle, "", source.recursive);
}

export type ScanSummary = {
  scanned: number;
  added: number;
  updated: number;
  unchanged: number;
  unavailable: number;
};

export async function scanLibrarySource(source: LibrarySource): Promise<ScanSummary> {
  const discovered = await discoverSource(source);
  const existing = await db.mediaFiles.where("sourceId").equals(source.id).toArray();

  const byPath = new Map(existing.map((file) => [file.relativePath.toLowerCase(), file]));
  const seenIds = new Set<string>();
  const scanTimestamp = Date.now();

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const discoveredFile of discovered) {
    const { relativePath, fileName, extension, size, lastModified } = discoveredFile;
    const pathKey = relativePath.toLowerCase();
    let stored = byPath.get(pathKey);

    if (
      stored &&
      stored.size === size &&
      stored.lastModified === lastModified
    ) {
      seenIds.add(stored.id);
      if (!stored.available) {
        await db.mediaFiles.update(stored.id, {
          available: true,
          lastSeenAt: scanTimestamp,
        });
        updated += 1;
      } else {
        // Avoid one IndexedDB write for every unchanged file. Large libraries
        // can contain tens of thousands of videos, and source.lastScanAt already
        // records when a successful full scan completed.
        unchanged += 1;
      }
      continue;
    }

    const fingerprint = discoveredFile.fingerprint
      ?? (discoveredFile.file
        ? await createFingerprint(discoveredFile.file)
        : source.nativePath
          ? await networkFingerprint(source.nativePath, relativePath)
          : "");
    if (!fingerprint) throw new Error(`Could not fingerprint ${relativePath}.`);

    if (!stored) {
      const fingerprintMatches = await db.mediaFiles
        .where("fingerprint")
        .equals(fingerprint)
        .toArray();

      stored =
        fingerprintMatches.find((candidate) => !candidate.available && !seenIds.has(candidate.id)) ??
        fingerprintMatches.find(
          (candidate) => candidate.sourceId === source.id && !seenIds.has(candidate.id),
        );
    }

    if (stored) {
      await clearTimelinePreviews(stored.id);
      await db.mediaFiles.update(stored.id, {
        sourceId: source.id,
        relativePath,
        fileName,
        extension,
        size,
        lastModified,
        fingerprint,
        available: true,
        lastSeenAt: scanTimestamp,
      });
      seenIds.add(stored.id);
      updated += 1;
    } else {
      const record: MediaFile = {
        id: createId("file"),
        sourceId: source.id,
        relativePath,
        fileName,
        extension,
        size,
        lastModified,
        fingerprint,
        available: true,
        lastSeenAt: scanTimestamp,
      };
      await db.mediaFiles.add(record);
      seenIds.add(record.id);
      added += 1;
    }
  }

  let unavailable = 0;
  for (const file of existing) {
    if (!seenIds.has(file.id) && file.available) {
      await db.mediaFiles.update(file.id, {
        available: false,
      });
      unavailable += 1;
    }
  }

  await db.librarySources.update(source.id, {
    lastScanAt: scanTimestamp,
  });

  return {
    scanned: discovered.length,
    added,
    updated,
    unchanged,
    unavailable,
  };
}
