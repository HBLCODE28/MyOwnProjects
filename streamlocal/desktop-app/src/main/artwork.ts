import type { MediaFile } from "../shared/types";
import { providerKey } from "./store";

type TmdbResult = { poster_path?: string | null; backdrop_path?: string | null };

/** Uses the user's own TMDb key; no media names or API secrets are persisted outside the device. */
export async function artworkFor(file: MediaFile): Promise<Pick<MediaFile, "posterUrl" | "backdropUrl"> | null> {
  const key = providerKey("tmdb");
  if (!key) return null;
  const kind = file.type === "episode" ? "tv" : "movie";
  const query = file.type === "episode" ? file.series || file.title : file.title;
  const params = new URLSearchParams({ query });
  if (file.type === "movie" && file.year) params.set("year", String(file.year));
  let response = await fetch(`https://api.themoviedb.org/3/search/${kind}?${params}`, { headers: { Accept: "application/json", Authorization: `Bearer ${key}` } });
  if (!response.ok && (response.status === 401 || response.status === 403)) response = await fetch(`https://api.themoviedb.org/3/search/${kind}?${params}&api_key=${encodeURIComponent(key)}`, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const result = ((await response.json()) as { results?: TmdbResult[] }).results?.[0];
  if (!result?.poster_path && !result?.backdrop_path) return null;
  const image = (path?: string | null, size = "w780") => path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;
  return { posterUrl: image(result.poster_path, "w500"), backdropUrl: image(result.backdrop_path) };
}
