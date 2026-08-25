import { db } from "../db/streamlocalDb";
import {
  isRejectedLogoCandidateName,
  validateRemoteLogoUrl,
} from "./logoValidation";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

type CommonsPage = {
  title: string;
  imageinfo?: Array<{ thumburl?: string; url?: string }>;
};

export type LogoSyncResult = {
  checked: number;
  updated: number;
  rejected: number;
  noLogo: number;
  failed: number;
};

type LogoCandidate = {
  title: string;
  url: string;
  score: number;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateUrl(page: CommonsPage): string | null {
  return page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url ?? null;
}

function scoreCandidate(title: string, page: CommonsPage): number {
  const wanted = normalize(title);
  const pageTitle = normalize(page.title.replace(/^file\s*:/i, ""));
  if (!wanted || !pageTitle.includes(wanted)) return 0;
  if (isRejectedLogoCandidateName(page.title)) return 0;

  let score = 100;
  if (pageTitle.startsWith(wanted)) score += 25;
  if (/(^|\s)(logo|wordmark|title|clearlogo)(\s|$)/i.test(pageTitle)) score += 35;
  if (/(white|light|transparent|svg)/i.test(pageTitle)) score += 8;
  if (candidateUrl(page)) score += 10;
  return score;
}

async function searchCommons(query: string): Promise<CommonsPage[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "30",
    gsrsearch: query,
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "1200",
  });
  const response = await fetch(`${COMMONS_API}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return [];
  const json = (await response.json()) as {
    query?: { pages?: Record<string, CommonsPage> };
  };
  return Object.values(json.query?.pages ?? {});
}

export async function findWikimediaLogoCandidates(
  title: string,
  excludedUrl?: string,
): Promise<LogoCandidate[]> {
  const searches = [
    `${title} logo`,
    `${title} wordmark`,
    `${title} logo white`,
    `${title} logo transparent`,
  ];
  const pages = (await Promise.all(searches.map(searchCommons))).flat();
  const byUrl = new Map<string, LogoCandidate>();

  for (const page of pages) {
    const url = candidateUrl(page);
    if (!url || url === excludedUrl) continue;
    const score = scoreCandidate(title, page);
    if (score < 130) continue;
    const candidate = { title: page.title, url, score };
    const existing = byUrl.get(url);
    if (!existing || candidate.score > existing.score) byUrl.set(url, candidate);
  }

  return [...byUrl.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, 16);
}

async function findValidatedWikimediaLogo(
  title: string,
  excludedUrl?: string,
): Promise<{ url: string | null; rejected: number }> {
  const candidates = await findWikimediaLogoCandidates(title, excludedUrl);
  let rejected = 0;
  for (const candidate of candidates) {
    if (await validateRemoteLogoUrl(candidate.url)) {
      return { url: candidate.url, rejected };
    }
    rejected += 1;
  }
  return { url: null, rejected };
}

export async function findWikimediaLogo(
  title: string,
  excludedUrl?: string,
): Promise<string | null> {
  return (await findValidatedWikimediaLogo(title, excludedUrl)).url;
}

export async function findAlternateWikimediaLogo(
  title: string,
  excludedUrl: string,
): Promise<string | null> {
  return findWikimediaLogo(title, excludedUrl);
}

export async function syncWikimediaLogos(): Promise<LogoSyncResult> {
  const [movies, series] = await Promise.all([
    db.mediaItems.where("type").equals("movie").toArray(),
    db.series.toArray(),
  ]);
  const result: LogoSyncResult = {
    checked: movies.length + series.length,
    updated: 0,
    rejected: 0,
    noLogo: 0,
    failed: 0,
  };

  for (const originalMovie of movies) {
    let existingLogo = originalMovie.remoteLogoUrl ?? null;
    try {
      if (existingLogo && await validateRemoteLogoUrl(existingLogo)) continue;
      if (existingLogo) {
        result.rejected += 1;
        await db.mediaItems.update(originalMovie.id, { remoteLogoUrl: null, updatedAt: Date.now() });
      }
      const found = await findValidatedWikimediaLogo(originalMovie.title, existingLogo ?? undefined);
      result.rejected += found.rejected;
      if (!found.url) {
        result.noLogo += 1;
        continue;
      }
      await db.mediaItems.update(originalMovie.id, {
        remoteLogoUrl: found.url,
        updatedAt: Date.now(),
      });
      result.updated += 1;
    } catch {
      result.failed += 1;
    }
  }

  for (const originalShow of series) {
    let existingLogo = originalShow.remoteLogoUrl ?? null;
    try {
      if (existingLogo && await validateRemoteLogoUrl(existingLogo)) continue;
      if (existingLogo) {
        result.rejected += 1;
        await db.series.update(originalShow.id, { remoteLogoUrl: null, updatedAt: Date.now() });
      }
      const found = await findValidatedWikimediaLogo(originalShow.title, existingLogo ?? undefined);
      result.rejected += found.rejected;
      if (!found.url) {
        result.noLogo += 1;
        continue;
      }
      await db.series.update(originalShow.id, {
        remoteLogoUrl: found.url,
        updatedAt: Date.now(),
      });
      result.updated += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
