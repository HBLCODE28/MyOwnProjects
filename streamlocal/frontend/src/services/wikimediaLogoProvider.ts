import { db } from "../db/streamlocalDb";
import { clearAutoCachedArtwork } from "./artwork";
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

export type LogoSearchContext = {
  kind?: "movie" | "series";
  year?: number | null;
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

function candidateQualifiers(title: string, pageTitle: string): string | null {
  const wanted = normalize(title);
  const normalizedPage = normalize(pageTitle.replace(/^file\s*:/i, ""));
  const start = normalizedPage.indexOf(wanted);
  if (!wanted || start < 0) return null;
  return `${normalizedPage.slice(0, start)} ${normalizedPage.slice(start + wanted.length)}`
    .replace(/\s+/g, " ")
    .trim();
}

export function isContextCompatibleLogoCandidate(
  title: string,
  pageTitle: string,
  context: LogoSearchContext = {},
): boolean {
  if (isRejectedLogoCandidateName(pageTitle)) return false;
  const qualifiers = candidateQualifiers(title, pageTitle);
  if (qualifiers == null) return false;

  // These qualifiers identify another work/edition even when the base title is exact.
  // This prevents examples such as "The Last of Us Remastered" (video game) from
  // being accepted as the logo for "The Last of Us" (TV series).
  if (/\b(remaster|remastered|video game|game|soundtrack|album|book|novel|comic|musical|stage play|franchise)\b/i.test(qualifiers)) {
    return false;
  }

  // Commons search can return an unrelated company/product whose name merely
  // starts with the movie title. For example, "Interstellar Technologies logo"
  // is not artwork for the 2014 film. Reject explicit organization/product
  // qualifiers instead of trusting substring title similarity.
  if (/\b(company|companies|corporation|corp|inc|llc|ltd|technologies|technology|brand|product|software|application|website|agency|organisation|organization|publisher|record label)\b/i.test(qualifiers)) {
    return false;
  }

  if (context.kind === "series" && /\b(film|movie)\b/i.test(qualifiers)) {
    return false;
  }
  if (context.kind === "movie" && /\b(tv|television|series|episode|season)\b/i.test(qualifiers)) {
    return false;
  }

  const years = [...qualifiers.matchAll(/\b(19\d{2}|20\d{2})\b/g)]
    .map((match) => Number(match[1]));
  if (context.year && years.length > 0 && !years.includes(context.year)) {
    return false;
  }

  // Movie titles frequently overlap with companies, products and other works.
  // A Wikimedia filename must therefore carry explicit film identity (movie/film
  // or the requested release year). If it does not, use Fanart's ID-matched logo
  // or text fallback instead of risking a plausible-looking wrong wordmark.
  if (context.kind === "movie") {
    const hasMovieQualifier = /\b(film|movie)\b/i.test(qualifiers);
    const hasRequestedYear = Boolean(context.year && years.includes(context.year));
    if (!hasMovieQualifier && !hasRequestedYear) return false;
  }

  return true;
}

export function isNamedLogoUrlContextCompatible(
  title: string,
  url: string,
  context: LogoSearchContext = {},
): boolean {
  let fileName = url;
  try {
    const path = new URL(url).pathname;
    fileName = decodeURIComponent(path.split("/").filter(Boolean).pop() ?? path);
  } catch {
    try {
      fileName = decodeURIComponent(url);
    } catch {
      fileName = url;
    }
  }

  // Provider URLs that do not expose a human-readable title cannot be checked here;
  // their pixel validation and provider ID matching still apply.
  if (!normalize(fileName).includes(normalize(title))) return true;
  return isContextCompatibleLogoCandidate(title, fileName, context);
}

function scoreCandidate(
  title: string,
  page: CommonsPage,
  context: LogoSearchContext,
): number {
  if (!isContextCompatibleLogoCandidate(title, page.title, context)) return 0;

  const wanted = normalize(title);
  const pageTitle = normalize(page.title.replace(/^file\s*:/i, ""));
  let score = 100;

  if (pageTitle === wanted) score += 60;
  else if (pageTitle.startsWith(wanted)) score += 25;

  if (/(^|\s)(logo|wordmark|title|clearlogo)(\s|$)/i.test(pageTitle)) score += 35;
  if (/(white|light|transparent|svg)/i.test(pageTitle)) score += 8;

  if (context.kind === "series" && /\b(tv|television)\s+series\b/i.test(pageTitle)) score += 30;
  if (context.kind === "movie" && /\b(film|movie)\b/i.test(pageTitle)) score += 22;
  if (context.year && pageTitle.includes(String(context.year))) score += 24;
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

function searchQueries(title: string, context: LogoSearchContext): string[] {
  const year = context.year ? ` ${context.year}` : "";
  if (context.kind === "series") {
    return [
      `"${title}" television series logo`,
      `"${title}" TV series wordmark`,
      `"${title}" logo white`,
      `"${title}" logo transparent`,
    ];
  }
  if (context.kind === "movie") {
    return [
      `"${title}"${year} film logo`,
      `"${title}"${year} movie wordmark`,
      `"${title}" logo white`,
      `"${title}" logo transparent`,
    ];
  }
  return [
    `"${title}" logo`,
    `"${title}" wordmark`,
    `"${title}" logo white`,
    `"${title}" logo transparent`,
  ];
}

export async function findWikimediaLogoCandidates(
  title: string,
  excludedUrl?: string,
  context: LogoSearchContext = {},
): Promise<LogoCandidate[]> {
  const pages = (await Promise.all(searchQueries(title, context).map(searchCommons))).flat();
  const byUrl = new Map<string, LogoCandidate>();

  for (const page of pages) {
    const url = candidateUrl(page);
    if (!url || url === excludedUrl) continue;
    const score = scoreCandidate(title, page, context);
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
  context: LogoSearchContext = {},
): Promise<{ url: string | null; rejected: number }> {
  const candidates = await findWikimediaLogoCandidates(title, excludedUrl, context);
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
  context: LogoSearchContext = {},
): Promise<string | null> {
  return (await findValidatedWikimediaLogo(title, excludedUrl, context)).url;
}

export async function findAlternateWikimediaLogo(
  title: string,
  excludedUrl: string,
  context: LogoSearchContext = {},
): Promise<string | null> {
  return findWikimediaLogo(title, excludedUrl, context);
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
    const existingLogo = originalMovie.remoteLogoUrl ?? null;
    try {
      // Old StreamLocal versions cached provider logos into logoArtworkId. When
      // the corresponding remote URL is already gone, that cache has no identity
      // information left to validate. Remove only the generated cache so a stale
      // wrong logo cannot continue to outrank the corrected remote/text fallback.
      if (!existingLogo) await clearAutoCachedArtwork(originalMovie, "logo");
      if (
        existingLogo &&
        isNamedLogoUrlContextCompatible(
          originalMovie.title,
          existingLogo,
          { kind: "movie", year: originalMovie.year },
        ) &&
        await validateRemoteLogoUrl(existingLogo)
      ) continue;
      if (existingLogo) {
        result.rejected += 1;
        await clearAutoCachedArtwork(originalMovie, "logo");
        await db.mediaItems.update(originalMovie.id, { remoteLogoUrl: null, updatedAt: Date.now() });
      }
      const found = await findValidatedWikimediaLogo(
        originalMovie.title,
        existingLogo ?? undefined,
        { kind: "movie", year: originalMovie.year },
      );
      result.rejected += found.rejected;
      if (!found.url) {
        result.noLogo += 1;
        continue;
      }
      await clearAutoCachedArtwork(originalMovie, "logo");
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
    const existingLogo = originalShow.remoteLogoUrl ?? null;
    try {
      if (
        existingLogo &&
        isNamedLogoUrlContextCompatible(
          originalShow.title,
          existingLogo,
          { kind: "series", year: originalShow.year },
        ) &&
        await validateRemoteLogoUrl(existingLogo)
      ) continue;
      if (existingLogo) {
        result.rejected += 1;
        await db.series.update(originalShow.id, { remoteLogoUrl: null, updatedAt: Date.now() });
      }
      const found = await findValidatedWikimediaLogo(
        originalShow.title,
        existingLogo ?? undefined,
        { kind: "series", year: originalShow.year },
      );
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
