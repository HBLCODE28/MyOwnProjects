import { readdir, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { VIDEO_EXTENSIONS, makeMediaFile } from "../shared/media";
import type { MediaFile, ScanProgress, Source } from "../shared/types";

export async function scanSource(source: Source, report: (progress: ScanProgress) => void): Promise<MediaFile[]> {
  const files: MediaFile[] = []; let scanned = 0;
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name); scanned++;
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile() && VIDEO_EXTENSIONS.has(extname(entry.name).toLowerCase())) { const info = await stat(fullPath); files.push(makeMediaFile(source.id, source.path, fullPath, relative(source.path, fullPath), info.size, info.mtimeMs)); }
      if (scanned % 20 === 0) report({ scanned, found: files.length, current: entry.name });
    }
  }
  await walk(source.path); report({ scanned, found: files.length, current: "Complete" }); return files;
}
export function newSource(path: string, name: string): Source { return { id: randomUUID(), path, name, addedAt: Date.now() }; }
