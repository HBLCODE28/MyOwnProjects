import { db } from "../db/streamlocalDb";
import { getFileFromRelativePath, verifyReadPermission } from "./fileSystem";

export type SupportedLocalContainer = "mp4" | "mkv";

export type PlayableMedia = {
  url: string;
  file: File;
  fileName: string;
  extension: SupportedLocalContainer;
  subtitles: SubtitleTrack[];
};

export type SubtitleTrack = {
  id: string;
  label: string;
  language: string;
  source: "local" | "opensubtitles";
  fileName: string;
  text: string;
  src: string;
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

  const subtitles = await loadLocalSubtitles(source.handle, mediaFile.relativePath);

  return {
    url: URL.createObjectURL(file),
    file,
    fileName: mediaFile.fileName,
    extension,
    subtitles,
  };
}

export function releasePlayableMedia(media: PlayableMedia | null): void {
  if (media?.url) URL.revokeObjectURL(media.url);
  for (const subtitle of media?.subtitles ?? []) URL.revokeObjectURL(subtitle.src);
}

function toWebVtt(text: string, extension: string): string {
  if (extension === "vtt") return text.startsWith("WEBVTT") ? text : `WEBVTT\n\n${text}`;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return `WEBVTT\n\n${normalized.replace(/(\d{2}:\d{2}:\d{2}),([0-9]{3})/g, "$1.$2")}`;
}

function subtitleLabel(fileName: string): { label: string; language: string } {
  const language = fileName.match(/(?:^|[._-])(en|eng|he|heb|es|spa|fr|fre|de|deu)(?:[._-]|$)/i)?.[1]?.toLowerCase() ?? "und";
  const names: Record<string, string> = { en: "English", eng: "English", he: "Hebrew", heb: "Hebrew", es: "Spanish", spa: "Spanish", fr: "French", fre: "French", de: "German", deu: "German", und: "Unknown" };
  return { language, label: names[language] ?? language.toUpperCase() };
}

async function loadLocalSubtitles(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<SubtitleTrack[]> {
  const parts = relativePath.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return [];
  let directory = root;
  try {
    for (const part of parts) directory = await directory.getDirectoryHandle(part);
  } catch {
    return [];
  }

  const stem = fileName.replace(/\.[^.]+$/, "");
  const names = [`${stem}.vtt`, `${stem}.srt`, `${stem}.en.vtt`, `${stem}.en.srt`, `${stem}.he.vtt`, `${stem}.he.srt`];
  const tracks: SubtitleTrack[] = [];
  for (const candidate of names) {
    try {
      const subtitleFile = await directory.getFileHandle(candidate).then((handle) => handle.getFile());
      const extension = candidate.toLowerCase().endsWith(".vtt") ? "vtt" : "srt";
      const text = toWebVtt(await subtitleFile.text(), extension);
      const info = subtitleLabel(candidate);
      tracks.push({
        id: `local-${candidate}`,
        label: `${info.label} · Local`,
        language: info.language,
        source: "local",
        fileName: candidate,
        text,
        src: URL.createObjectURL(new Blob([text], { type: "text/vtt" })),
      });
    } catch {
      // A sidecar subtitle is optional.
    }
  }
  return tracks;
}

export function subtitleUrl(text: string): string {
  return URL.createObjectURL(new Blob([text], { type: "text/vtt" }));
}
