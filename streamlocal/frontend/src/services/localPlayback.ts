import { db } from "../db/streamlocalDb";
import { getFileFromRelativePath, verifyReadPermission } from "./fileSystem";

export type SupportedLocalContainer = "mp4" | "mkv";

export type PlayableMedia = {
  url: string;
  file: File;
  fileName: string;
  extension: SupportedLocalContainer;
};

export function isSupportedLocalContainer(extension: string): extension is SupportedLocalContainer {
  return extension.toLowerCase() === "mp4" || extension.toLowerCase() === "mkv";
}

export function browserContainerHint(extension: SupportedLocalContainer): string {
  if (extension === "mp4") return "video/mp4";
  return "video/x-matroska";
}

export async function createPlayableMedia(mediaFileId: string): Promise<PlayableMedia> {
  const mediaFile = await db.mediaFiles.get(mediaFileId);
  if (!mediaFile) throw new Error("Media file record was not found.");
  if (!mediaFile.available) throw new Error("This media file is currently unavailable.");

  const extension = mediaFile.extension.toLowerCase();
  if (!isSupportedLocalContainer(extension)) {
    throw new Error(`Unsupported local container: .${extension}`);
  }

  const source = await db.librarySources.get(mediaFile.sourceId);
  if (!source?.handle) {
    throw new Error("The media folder must be reconnected in Library.");
  }

  if (!(await verifyReadPermission(source.handle))) {
    throw new Error("Read permission for this media folder was not granted.");
  }

  const file = await getFileFromRelativePath(source.handle, mediaFile.relativePath);
  if (!file) {
    throw new Error("The local media file could not be opened.");
  }

  return {
    url: URL.createObjectURL(file),
    file,
    fileName: mediaFile.fileName,
    extension,
  };
}

export function releasePlayableMedia(media: PlayableMedia | null): void {
  if (media?.url) URL.revokeObjectURL(media.url);
}
