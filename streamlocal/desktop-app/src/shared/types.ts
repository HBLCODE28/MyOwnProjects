export type MediaType = "movie" | "episode";
export type MediaFile = { id: string; sourceId: string; relativePath: string; fileName: string; path: string; size: number; modified: number; type: MediaType; title: string; year?: number; series?: string; season?: number; episode?: number; posterUrl?: string; backdropUrl?: string };
export type Source = { id: string; path: string; name: string; addedAt: number; lastScanAt?: number };
export type Progress = { position: number; duration: number; watched: boolean; lastPlayedAt: number };
export type LibraryState = { sources: Source[]; files: MediaFile[]; progress: Record<string, Progress>; settings: { onboardingDone: boolean }; encryptedSubtitleKey?: string; encryptedProviderKeys?: Record<string, string>; preferredSubtitles?: Record<string, { he?: string; en?: string }> };
export type ScanProgress = { scanned: number; found: number; current: string };
export type SubtitleResult = { id: string; fileName: string; language: string; downloadCount: number; release?: string };
