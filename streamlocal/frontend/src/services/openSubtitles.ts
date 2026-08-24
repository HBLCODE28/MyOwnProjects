import type { MediaItem } from "../types/library";
import { readSecret } from "./secretVault";
import { subtitleUrl } from "./localPlayback";

const API_ROOT = "https://api.opensubtitles.com/api/v1";
const USER_AGENT = "StreamLocal v0.3.0";

type OpenSubtitlesRow = {
  id: string;
  attributes?: {
    language?: string;
    hearing_impaired?: boolean;
    release?: string;
    files?: Array<{ file_id?: number; file_name?: string }>;
  };
};

export type OpenSubtitleMatch = {
  id: string;
  fileId: number;
  language: string;
  label: string;
  hearingImpaired: boolean;
};

function headers(apiKey: string): HeadersInit {
  return {
    Accept: "application/json",
    "Api-Key": apiKey,
    "User-Agent": USER_AGENT,
  };
}

async function apiKey(): Promise<string> {
  const value = await readSecret("openSubtitlesApiKey");
  if (!value) throw new Error("Unlock the encrypted API key vault and save your OpenSubtitles API key in Settings first.");
  return value;
}

export async function searchOpenSubtitles(item: MediaItem): Promise<OpenSubtitleMatch[]> {
  const key = await apiKey();
  const params = new URLSearchParams({
    query: item.title,
    languages: "en,he",
    order_by: "download_count",
    order_direction: "desc",
  });
  if (item.year) params.set("year", String(item.year));
  const response = await fetch(`${API_ROOT}/subtitles?${params.toString()}`, { headers: headers(key) });
  if (!response.ok) throw new Error(`OpenSubtitles search failed (${response.status}).`);
  const json = (await response.json()) as { data?: OpenSubtitlesRow[] };
  return (json.data ?? []).flatMap((row) => {
    const attributes = row.attributes;
    const file = attributes?.files?.[0];
    if (!file?.file_id) return [];
    const language = attributes?.language ?? "und";
    return [{
      id: row.id,
      fileId: file.file_id,
      language,
      label: `${language.toUpperCase()} · ${attributes?.release || "OpenSubtitles"}`,
      hearingImpaired: Boolean(attributes?.hearing_impaired),
    }];
  });
}

export async function downloadOpenSubtitle(match: OpenSubtitleMatch): Promise<{
  text: string;
  fileName: string;
  src: string;
}> {
  const key = await apiKey();
  const response = await fetch(`${API_ROOT}/download`, {
    method: "POST",
    headers: { ...headers(key), "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: match.fileId, sub_format: "srt" }),
  });
  if (!response.ok) throw new Error(`OpenSubtitles download failed (${response.status}).`);
  const json = (await response.json()) as { link?: string; file_name?: string };
  if (!json.link) throw new Error("OpenSubtitles did not return a subtitle download link.");
  const fileResponse = await fetch(json.link, { headers: { "User-Agent": USER_AGENT } });
  if (!fileResponse.ok) throw new Error("The OpenSubtitles file could not be downloaded.");
  const raw = await fileResponse.text();
  const text = `WEBVTT\n\n${raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/(\d{2}:\d{2}:\d{2}),([0-9]{3})/g, "$1.$2")}`;
  return { text, fileName: json.file_name ?? `opensubtitles-${match.fileId}.srt`, src: subtitleUrl(text) };
}
