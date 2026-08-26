import { db } from "../db/streamlocalDb";
import { clearAutoCachedArtwork } from "./artwork";
import {
  isRejectedLogoCandidateName,
  validateRemoteLogoUrl,
} from "./logoValidation";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

type CommonsMetadataValue = { value?: string };

type CommonsPage = {
  title: string;
  imageinfo?: Array<{
    thumburl?: string;
    url?: string;
    extmetadata?: Record<string, CommonsMetadataValue>;
  }>;
  categories?: Array<{ title?: string }>;
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

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, " and ")
    .replace(/&quot;|&#34;/gi, " ")
    .replace(/&#39;|&apos;/gi, " ");
}

function candidateEvidence(page: CommonsPage): string {
  const description = page.imageinfo?.[0]?.extmetadata?.ImageDescription?.value ?? "";
  const categories = (page.categories ?? [])
    .map((category) => category.title ?? "")
    .join(" ");
  return `${page.title} ${stripHtml(description)} ${categories}`;
}

function hasExplicitLogoEvidence(value: string): boolean {
  const normalized = normalize(value);
  return /(^|\s)(logo|logos|logotype|logotypes|wordmark|wordmarks|clearlogo|typography)(\s|$)/i.test(normalized) ||
    /(^|\s)title\s+(logo|card|treatment)(\s|$)/i.test(normalized);
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

  // Wikimedia Commons is a general image repository, not a logo database.
  // A filename that merely contains the title and "film"/year can still be a
  // premiere photo, press image, cast photo, screenshot, etc. Require an
  // explicit title-art descriptor before a Commons image may enter a logo slot.
  const normalizedCandidate = normalize(pageTitle.replace(/^file\s*:/i, ""));
  if (!hasExplicitLogoEvidence(normalizedCandidate)) return false;

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

function isContextCompatibleLogoPage(
  title: string,
  page: CommonsPage,
  context: LogoSearchContext,
): boolean {
  if (isRejectedLogoCandidateName(page.title)) return false;
  const qualifiers = candidateQualifiers(title, page.title);
  if (qualifiers == null) return false;

  const evidence = candidateEvidence(page);
  const normalizedEvidence = normalize(evidence);
  if (!hasExplicitLogoEvidence(normalizedEvidence)) return false;

  if (/\b(remaster|remastered|video game|game|soundtrack|album|book|novel|comic|musical|stage play|franchise)\b/i.test(qualifiers)) {
    return false;
  }
  if (/\b(company|companies|corporation|corp|inc|llc|ltd|technologies|technology|brand|product|software|application|website|agency|organisation|organization|publisher|record label)\b/i.test(qualifiers)) {
    return false;
  }

  if (context.kind === "series" && /\b(film|movie)\b/i.test(qualifiers)) return false;
  if (context.kind === "movie" && /\b(tv|television|series|episode|season)\b/i.test(qualifiers)) return false;

  const evidenceYears = [...normalizedEvidence.matchAll(/\b(19\d{2}|20\d{2})\b/g)]
    .map((match) => Number(match[1]));
  if (context.year && evidenceYears.length > 0 && !evidenceYears.includes(context.year)) {
    return false;
  }

  if (context.kind === "series") {
    const explicitWrongKind = /\b(film|movie)\b/i.test(normalizedEvidence) &&
      !/\b(tv|television)\s+(series|show|program|programme)\b/i.test(normalizedEvidence);
    if (explicitWrongKind) return false;
  }
  if (context.kind === "movie") {
    const hasMovieIdentity = /\b(film|movie)\b/i.test(normalizedEvidence);
    const hasRequestedYear = Boolean(context.year && evidenceYears.includes(context.year));
    if (!hasMovieIdentity && !hasRequestedYear) return false;
  }

  return true;
}

export function isContextCompatibleLogoCandidateWithEvidence(
  title: string,
  pageTitle: string,
  evidence: string,
  context: LogoSearchContext = {},
): boolean {
  return isContextCompatibleLogoPage(
    title,
    {
      title: pageTitle,
      imageinfo: [{ extmetadata: { ImageDescription: { value: evidence } } }],
    },
    context,
  );
}

function isStoredLogoFilenameContextCompatible(
  title: string,
  fileName: string,
  context: LogoSearchContext,
): boolean {
  if (isRejectedLogoCandidateName(fileName)) return false;
  const qualifiers = candidateQualifiers(title, fileName);
  if (qualifiers == null) return false;
  if (/\b(remaster|remastered|video game|game|soundtrack|album|book|novel|comic|musical|stage play|franchise)\b/i.test(qualifiers)) return false;
  if (/\b(company|companies|corporation|corp|inc|llc|ltd|technologies|technology|brand|product|software|application|website|agency|organisation|organization|publisher|record label)\b/i.test(qualifiers)) return false;
  if (context.kind === "series" && /\b(film|movie)\b/i.test(qualifiers)) return false;
  if (context.kind === "movie" && /\b(tv|television|series|episode|season)\b/i.test(qualifiers)) return false;

  const years = [...qualifiers.matchAll(/\b(19\d{2}|20\d{2})\b/g)]
    .map((match) => Number(match[1]));
  if (context.year && years.length > 0 && !years.includes(context.year)) return false;
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
  let host = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;
    fileName = decodeURIComponent(path.split("/").filter(Boolean).pop() ?? path);
  } catch {
    try {
      fileName = decodeURIComponent(url);
    } catch {
      fileName = url;
    }
  }

  const fileContainsTitle = normalize(fileName).includes(normalize(title));
  // Wikimedia upload URLs expose the actual Commons filename. If that filename
  // does not contain the requested title, it is a different work and must not
  // survive as a cached logo. Other providers can use opaque/hash filenames, so
  // those still rely on provider-ID matching plus pixel validation.
  if (!fileContainsTitle) {
    if (host.endsWith("wikimedia.org") || host.endsWith("wikipedia.org")) return false;
    return true;
  }
  return isStoredLogoFilenameContextCompatible(title, fileName, context);
}

function scoreCandidate(
  title: string,
  page: CommonsPage,
  context: LogoSearchContext,
): number {
  if (!isContextCompatibleLogoPage(title, page, context)) return 0;

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
    prop: "imageinfo|categories",
    iiprop: "url|extmetadata",
    iiextmetadatafilter: "ImageDescription",
    iiextmetadatalanguage: "en",
    cllimit: "max",
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
      // Provider logos are identified by their remote URL, while old versions also
      // cached them into logoArtworkId. Always discard only that generated cache
      // before validation so a stale photo/old logo cannot outrank a corrected URL.
      // Manually selected local logos are preserved by clearAutoCachedArtwork().
      await clearAutoCachedArtwork(originalMovie, "logo");
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
