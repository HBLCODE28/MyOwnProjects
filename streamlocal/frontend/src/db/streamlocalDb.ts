import Dexie, { type Table } from "dexie";
import type {
  AppSetting,
  Artwork,
  LibrarySource,
  MediaFile,
  MediaItem,
  PlaybackProgress,
  Series,
  TimelinePreview,
} from "../types/library";

export class StreamLocalDb extends Dexie {
  librarySources!: Table<LibrarySource, string>;
  mediaFiles!: Table<MediaFile, string>;
  mediaItems!: Table<MediaItem, string>;
  series!: Table<Series, string>;
  artwork!: Table<Artwork, string>;
  settings!: Table<AppSetting, string>;
  playbackProgress!: Table<PlaybackProgress, string>;
  timelinePreviews!: Table<TimelinePreview, string>;

  constructor() {
    super("StreamLocal");

    this.version(1).stores({
      librarySources: "id,name,createdAt,lastScanAt,enabled",
      mediaFiles:
        "id,sourceId,relativePath,fileName,fingerprint,available,lastSeenAt",
      mediaItems:
        "id,mediaFileId,type,title,year,seriesId,seasonNumber,episodeNumber,confidence,matchStatus,manuallyEdited,updatedAt",
      series: "id,normalizedTitle,title,year,updatedAt",
      artwork: "id,kind,createdAt",
      settings: "key",
    });

    this.version(2).stores({
      librarySources: "id,name,createdAt,lastScanAt,enabled",
      mediaFiles:
        "id,sourceId,relativePath,fileName,fingerprint,available,lastSeenAt",
      mediaItems:
        "id,mediaFileId,type,title,year,seriesId,seasonNumber,episodeNumber,confidence,matchStatus,manuallyEdited,updatedAt",
      series: "id,normalizedTitle,title,year,updatedAt",
      artwork: "id,kind,createdAt",
      settings: "key",
      playbackProgress: "mediaItemId,lastPlayedAt,watched,completedAt",
    });

    this.version(3).stores({
      librarySources: "id,name,createdAt,lastScanAt,enabled",
      mediaFiles:
        "id,sourceId,relativePath,fileName,fingerprint,available,lastSeenAt",
      mediaItems:
        "id,mediaFileId,type,title,year,seriesId,seasonNumber,episodeNumber,confidence,matchStatus,manuallyEdited,updatedAt",
      series: "id,normalizedTitle,title,year,updatedAt",
      artwork: "id,kind,createdAt",
      settings: "key",
      playbackProgress: "mediaItemId,lastPlayedAt,watched,completedAt",
      timelinePreviews: "id,mediaFileId,positionSeconds,createdAt",
    });

    this.version(4).stores({
      librarySources: "id,name,createdAt,lastScanAt,enabled",
      mediaFiles:
        "id,sourceId,relativePath,fileName,fingerprint,available,lastSeenAt",
      mediaItems:
        "id,mediaFileId,type,title,year,seriesId,seasonNumber,episodeNumber,confidence,matchStatus,manuallyEdited,updatedAt",
      series: "id,normalizedTitle,title,year,updatedAt",
      artwork: "id,kind,createdAt",
      settings: "key",
      playbackProgress: "mediaItemId,lastPlayedAt,watched,completedAt",
      timelinePreviews: "id,mediaFileId,positionSeconds,createdAt",
      mediaSegments: "id,mediaItemId,type,startSeconds,endSeconds,source,updatedAt",
    });
  }

  mediaSegments!: Table<import("../types/library").MediaSegment, string>;
}

export const db = new StreamLocalDb();

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
