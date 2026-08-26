import JSZip from "jszip";
import { db } from "../db/streamlocalDb";
import type { Artwork } from "../types/library";

const FORMAT_VERSION = 3;
const PRIVATE_SETTING_KEYS = new Set([
  "encryptedSecretVault",
  "externalHistory.vlcHandle",
  "externalHistory.vlcSignature",
  "externalHistory.windowsHandles",
  "externalHistory.windowsSignature",
]);

type ExportSource = {
  id: string;
  name: string;
  createdAt: number;
  lastScanAt: number | null;
  enabled: boolean;
  recursive: boolean;
  handle: null;
};

export async function exportStreamLocalBackup(): Promise<Blob> {
  const zip = new JSZip();

  const [
    sources,
    mediaFiles,
    mediaItems,
    series,
    artwork,
    settings,
    playbackProgress,
    mediaSegments,
  ] = await Promise.all([
    db.librarySources.toArray(),
    db.mediaFiles.toArray(),
    db.mediaItems.toArray(),
    db.series.toArray(),
    db.artwork.toArray(),
    db.settings.toArray(),
    db.playbackProgress.toArray(),
    db.mediaSegments.toArray(),
  ]);

  const exportedSources: ExportSource[] = sources.map(
    ({ handle: _handle, ...source }) => ({
      ...source,
      handle: null,
    }),
  );

  const exportableSettings = settings.filter(
    (setting) => !PRIVATE_SETTING_KEYS.has(setting.key),
  );

  zip.file(
    "library.json",
    JSON.stringify(
      {
        format: "StreamLocal Backup",
        version: FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        librarySources: exportedSources,
        mediaFiles,
        mediaItems,
        series,
        settings: exportableSettings,
        playbackProgress,
        mediaSegments,
        artwork: artwork.map(({ blob: _blob, ...record }) => record),
      },
      null,
      2,
    ),
  );

  for (const record of artwork) {
    const extension =
      record.mimeType === "image/png"
        ? "png"
        : record.mimeType === "image/webp"
          ? "webp"
          : "jpg";

    zip.file(`artwork/${record.id}.${extension}`, record.blob);
  }

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function importStreamLocalBackup(file: File): Promise<void> {
  const zip = await JSZip.loadAsync(file);
  const libraryFile = zip.file("library.json");

  if (!libraryFile) {
    throw new Error("This is not a valid StreamLocal backup.");
  }

  const manifest = JSON.parse(await libraryFile.async("string"));

  if (
    manifest.format !== "StreamLocal Backup" ||
    ![1, 2, 3].includes(manifest.version)
  ) {
    throw new Error("Unsupported StreamLocal backup version.");
  }

  const privateSettings = (await db.settings.toArray()).filter((setting) =>
    PRIVATE_SETTING_KEYS.has(setting.key),
  );

  await db.transaction(
    "rw",
    [
      db.librarySources,
      db.mediaFiles,
      db.mediaItems,
      db.series,
      db.artwork,
      db.settings,
      db.playbackProgress,
      db.mediaSegments,
    ],
    async () => {
      await Promise.all([
        db.librarySources.clear(),
        db.mediaFiles.clear(),
        db.mediaItems.clear(),
        db.series.clear(),
        db.artwork.clear(),
        db.settings.clear(),
        db.playbackProgress.clear(),
        db.mediaSegments.clear(),
      ]);

      if (manifest.librarySources?.length) {
        await db.librarySources.bulkAdd(
          manifest.librarySources.map((source: ExportSource) => ({
            ...source,
            enabled: false,
            handle: null,
          })),
        );
      }

      if (manifest.mediaFiles?.length) {
        await db.mediaFiles.bulkAdd(
          manifest.mediaFiles.map((mediaFile: Record<string, unknown>) => ({
            ...mediaFile,
            available: false,
          })),
        );
      }

      if (manifest.mediaItems?.length) {
        await db.mediaItems.bulkAdd(manifest.mediaItems);
      }

      if (manifest.series?.length) {
        await db.series.bulkAdd(manifest.series);
      }

      if (manifest.playbackProgress?.length) {
        await db.playbackProgress.bulkAdd(manifest.playbackProgress);
      }

      if (manifest.mediaSegments?.length) {
        await db.mediaSegments.bulkAdd(manifest.mediaSegments);
      }

      const importedSettings = (manifest.settings ?? []).filter(
        (setting: { key: string }) =>
          !PRIVATE_SETTING_KEYS.has(setting.key),
      );

      if (importedSettings.length) {
        await db.settings.bulkAdd(importedSettings);
      }

      if (privateSettings.length) {
        await db.settings.bulkPut(privateSettings);
      }

      for (const artworkRecord of manifest.artwork ?? []) {
        const possibleNames = [
          `artwork/${artworkRecord.id}.jpg`,
          `artwork/${artworkRecord.id}.png`,
          `artwork/${artworkRecord.id}.webp`,
        ];

        const entry = possibleNames
          .map((name) => zip.file(name))
          .find(Boolean);

        if (!entry) continue;

        const blob = await entry.async("blob");
        const record: Artwork = {
          ...artworkRecord,
          blob,
        };

        await db.artwork.add(record);
      }
    },
  );
}
