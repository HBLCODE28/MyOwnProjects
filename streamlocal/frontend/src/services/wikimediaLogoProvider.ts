import { db } from "../db/streamlocalDb";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

type CommonsPage = {
  title: string;
  imageinfo?: Array<{ thumburl?: string; url?: string }>;
};

export type LogoSyncResult = {
  checked: number;
  updated: number;
  noLogo: number;
  failed: number;
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function findWikimediaLogo(title: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "20",
    gsrsearch: `${title} logo`,
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "1200",
  });
  const response = await fetch(`${COMMONS_API}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { query?: { pages?: Record<string, CommonsPage> } };
  const wanted = normalize(title);
  const ranked = Object.values(json.query?.pages ?? [])
    .map((page) => {
      const pageTitle = normalize(page.title.replace(/^file\s*:/, ""));
      let score = 0;
      if (pageTitle.includes("logo")) score += 25;
      if (pageTitle.includes(wanted)) score += 100;
      if (pageTitle.startsWith(wanted)) score += 30;
      if (page.imageinfo?.[0]?.thumburl) score += 10;
      return { page, score };
    })
    .filter(({ score }) => score >= 110)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.page.imageinfo?.[0]?.thumburl ?? ranked[0]?.page.imageinfo?.[0]?.url ?? null;
}

export async function syncWikimediaLogos(): Promise<LogoSyncResult> {
  const [movies, series] = await Promise.all([
    db.mediaItems.where("type").equals("movie").toArray(),
    db.series.toArray(),
  ]);
  const result: LogoSyncResult = { checked: movies.length + series.length, updated: 0, noLogo: 0, failed: 0 };
  for (const movie of movies.filter((entry) => !entry.remoteLogoUrl)) {
    try {
      const logo = await findWikimediaLogo(movie.title);
      if (!logo) { result.noLogo += 1; continue; }
      await db.mediaItems.update(movie.id, { remoteLogoUrl: logo, updatedAt: Date.now() });
      result.updated += 1;
    } catch { result.failed += 1; }
  }
  for (const show of series.filter((entry) => !entry.remoteLogoUrl)) {
    try {
      const logo = await findWikimediaLogo(show.title);
      if (!logo) { result.noLogo += 1; continue; }
      await db.series.update(show.id, { remoteLogoUrl: logo, updatedAt: Date.now() });
      result.updated += 1;
    } catch { result.failed += 1; }
  }
  return result;
}
