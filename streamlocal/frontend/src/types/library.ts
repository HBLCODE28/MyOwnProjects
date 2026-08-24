export type MediaKind = "movie" | "episode" | "unmatched";
export type MatchStatus = "matched" | "needs_match";
export type Confidence = "high" | "medium" | "low";

export type LibrarySource = {
  id: string;
  name: string;
  createdAt: number;
  lastScanAt: number | null;
  enabled: boolean;
  recursive: boolean;
  handle: FileSystemDirectoryHandle | null;
};

export type MediaFile = {
  id: string;
  sourceId: string;
  relativePath: string;
  fileName: string;
  extension: string;
  size: number;
  lastModified: number;
  fingerprint: string;
  available: boolean;
  lastSeenAt: number;
};

export type MediaItem = {
  id: string;
  mediaFileId: string;
  type: MediaKind;
  title: string;
  year: number | null;
  overview: string;
  genres: string[];
  seriesId: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  confidence: Confidence;
  matchStatus: MatchStatus;
  manuallyEdited: boolean;
  posterArtworkId: string | null;
  backdropArtworkId: string | null;
  remotePosterUrl?: string | null;
  remoteBackdropUrl?: string | null;
  metadataProvider?: "wikipedia" | null;
  providerId?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Series = {
  id: string;
  normalizedTitle: string;
  title: string;
  year: number | null;
  overview: string;
  genres: string[];
  posterArtworkId: string | null;
  backdropArtworkId: string | null;
  remotePosterUrl?: string | null;
  remoteBackdropUrl?: string | null;
  metadataProvider?: "tvmaze" | null;
  providerId?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Artwork = {
  id: string;
  kind: "poster" | "backdrop";
  mimeType: string;
  fileName: string;
  blob: Blob;
  createdAt: number;
};

export type TimelinePreview = {
  id: string;
  mediaFileId: string;
  positionSeconds: number;
  mimeType: string;
  blob: Blob;
  createdAt: number;
};

export type MediaSegmentType = "intro" | "recap" | "credits";
export type MediaSegmentSource = "manual" | "detected";

export type MediaSegment = {
  id: string;
  mediaItemId: string;
  type: MediaSegmentType;
  startSeconds: number;
  endSeconds: number;
  source: MediaSegmentSource;
  createdAt: number;
  updatedAt: number;
};

export type PlaybackProgress = {
  mediaItemId: string;
  positionSeconds: number;
  durationSeconds: number;
  percent: number;
  started: boolean;
  firstPlayedAt: number | null;
  watched: boolean;
  lastPlayedAt: number;
  completedAt: number | null;
};

export type AppSetting = {
  key: string;
  value: unknown;
};

export type ParsedMediaName = {
  type: MediaKind;
  title: string;
  year: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  confidence: Confidence;
};
