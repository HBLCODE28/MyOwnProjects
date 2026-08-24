import { db } from "../db/streamlocalDb";
import type { LibrarySource, MediaFile } from "../types/library";
import { createId } from "../utils/id";
import { createFingerprint } from "./fingerprint";
import { verifyReadPermission } from "./fileSystem";
import { clearTimelinePreviews } from "./timelinePreview";

const VIDEO_EXTENSIONS = new Set(["mp4", "mkv"]);

type DiscoveredFile = {
  file: File;
  relativePath: string;
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
        files.push({ file, relativePath });
      }
    } else if (recursive) {
      files.push(
        ...(await walkDirectory(entry as FileSystemDirectoryHandle, relativePath, recursive)),
      );
    }
  }

  return files;
}

export type ScanSummary = {
  scanned: number;
  added: number;
  updated: number;
  unchanged: number;
  unavailable: number;
};

export async function scanLibrarySource(source: LibrarySource): Promise<ScanSummary> {
  if (!source.handle) {
    throw new Error("This folder is not connected on this computer.");
  }

  if (!(await verifyReadPermission(source.handle))) {
    throw new Error("Folder permission was not granted.");
  }

  const discovered = await walkDirectory(source.handle, "", source.recursive);
  const existing = await db.mediaFiles.where("sourceId").equals(source.id).toArray();

  const byPath = new Map(existing.map((file) => [file.relativePath.toLowerCase(), file]));
  const seenIds = new Set<string>();

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const discoveredFile of discovered) {
    const { file, relativePath } = discoveredFile;
    const pathKey = relativePath.toLowerCase();
    let stored = byPath.get(pathKey);

    if (
      stored &&
      stored.size === file.size &&
      stored.lastModified === file.lastModified
    ) {
      seenIds.add(stored.id);
      if (!stored.available) {
        await db.mediaFiles.update(stored.id, {
          available: true,
          lastSeenAt: Date.now(),
        });
        updated += 1;
      } else {
        await db.mediaFiles.update(stored.id, { lastSeenAt: Date.now() });
        unchanged += 1;
      }
      continue;
    }

    const fingerprint = await createFingerprint(file);

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

    const extension = file.name.includes(".")
      ? file.name.split(".").pop()!.toLowerCase()
      : "";

    if (stored) {
      await clearTimelinePreviews(stored.id);
      await db.mediaFiles.update(stored.id, {
        sourceId: source.id,
        relativePath,
        fileName: file.name,
        extension,
        size: file.size,
        lastModified: file.lastModified,
        fingerprint,
        available: true,
        lastSeenAt: Date.now(),
      });
      seenIds.add(stored.id);
      updated += 1;
    } else {
      const record: MediaFile = {
        id: createId("file"),
        sourceId: source.id,
        relativePath,
        fileName: file.name,
        extension,
        size: file.size,
        lastModified: file.lastModified,
        fingerprint,
        available: true,
        lastSeenAt: Date.now(),
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
    lastScanAt: Date.now(),
  });

  return {
    scanned: discovered.length,
    added,
    updated,
    unchanged,
    unavailable,
  };
}
