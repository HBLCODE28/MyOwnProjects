import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { MediaFile } from "../shared/types";

export async function importVlcHistory(files: MediaFile[]) {
  const path = process.platform === "win32" ? `${process.env.APPDATA}\\vlc\\vlc-qt-interface.ini` : "";
  if (!path || !existsSync(path)) return { imported: 0, message: "VLC history was not found." };
  const text = await readFile(path, "utf8"); const mrl = text.match(/RecentsMRL=(.+)/)?.[1] || "";
  const entries = mrl.split(" ").map((value) => { try { return fileURLToPath(value.replace(/%20/g, " ")); } catch { return ""; } }).filter(Boolean);
  const ids = new Set(entries.map((entry) => files.find((file) => file.path.toLowerCase() === entry.toLowerCase())?.id).filter(Boolean));
  return { imported: ids.size, ids: [...ids].filter((id): id is string => Boolean(id)) };
}
