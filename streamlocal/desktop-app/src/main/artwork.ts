import type { MediaFile } from "../shared/types";

type TvmazeShow = { name?: string; image?: { medium?: string; original?: string } | null };
type WikiPage = { title?: string; thumbnail?: { source?: string } };

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

async function seriesArtwork(title: string): Promise<Pick<MediaFile, "posterUrl" | "backdropUrl"> | null> {
  const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const matches = (await response.json()) as Array<{ show?: TvmazeShow }>;
  const show = matches.find((item) => normalize(item.show?.name || "") === normalize(title))?.show;
  const poster = show?.image?.original || show?.image?.medium;
  return poster ? { posterUrl: poster } : null;
}

async function commonsMovieArtwork(title: string): Promise<string | null> {
  const params = new URLSearchParams({ action: "query", generator: "search", gsrsearch: `${title} film poster`, gsrnamespace: "6", gsrlimit: "10", prop: "imageinfo", iiprop: "url", iiurlwidth: "600", format: "json", origin: "*" });
  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const pages = Object.values(((await response.json()) as { query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ thumburl?: string }> }> } }).query?.pages || {});
    return pages.find((page) => /poster|cover/i.test(page.title || ""))?.imageinfo?.[0]?.thumburl || null;
  } catch { return null; }
}

async function movieArtwork(title: string): Promise<Pick<MediaFile, "posterUrl"> | null> {
  const commonsPoster = await commonsMovieArtwork(title);
  if (commonsPoster) return { posterUrl: commonsPoster };
  const params = new URLSearchParams({ action: "query", titles: `${title} (film)|${title}`, redirects: "1", prop: "pageimages", piprop: "thumbnail", pithumbsize: "600", format: "json" });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const pages = Object.values(((await response.json()) as { query?: { pages?: Record<string, WikiPage> } }).query?.pages || {});
  const wanted = normalize(title);
  const poster = pages.find((page) => normalize(page.title || "").replace("film", "") === wanted && page.thumbnail?.source)?.thumbnail?.source;
  return poster ? { posterUrl: poster } : null;
}

/** Public providers: TVmaze for series and Wikimedia/Wikipedia for films; no TMDb key required. */
export async function artworkFor(file: MediaFile): Promise<Pick<MediaFile, "posterUrl" | "backdropUrl"> | null> {
  return file.type === "episode" ? seriesArtwork(file.series || file.title) : movieArtwork(file.title);
}
