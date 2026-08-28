import type { MediaFile, MediaItem, Series } from "../types/library";

export type MovieCard = {
  item: MediaItem;
  file: MediaFile | undefined;
};

export type EpisodeCard = {
  item: MediaItem;
  file: MediaFile | undefined;
};

export type GenreMovieGroup = {
  genre: string;
  cards: MovieCard[];
};

const MOVIE_GENRE_PRIORITY = [
  "Drama",
  "Comedy",
  "Action",
  "Thriller",
  "Crime",
  "Science-Fiction",
  "Adventure",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Animation",
  "Family",
  "Documentary",
];

export function groupMoviesByGenre(movieCards: MovieCard[]): GenreMovieGroup[] {
  const groups = new Map<string, GenreMovieGroup>();

  for (const card of movieCards) {
    const genres = Array.from(
      new Map(
        card.item.genres
          .map((genre) => genre.trim())
          .filter(Boolean)
          .map((genre) => [genre.toLowerCase(), genre] as const),
      ).values(),
    );

    const effectiveGenres = genres.length > 0 ? genres : ["Other"];
    for (const genre of effectiveGenres) {
      const key = genre.toLowerCase();
      const existing = groups.get(key);
      if (existing) existing.cards.push(card);
      else groups.set(key, { genre, cards: [card] });
    }
  }

  const priority = new Map(
    MOVIE_GENRE_PRIORITY.map((genre, index) => [genre.toLowerCase(), index]),
  );

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      cards: [...group.cards].sort((a, b) => a.item.title.localeCompare(b.item.title)),
    }))
    .sort((a, b) => {
      if (a.genre === "Other") return 1;
      if (b.genre === "Other") return -1;
      const aPriority = priority.get(a.genre.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      const bPriority = priority.get(b.genre.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.genre.localeCompare(b.genre);
    });
}


export type SeasonGroup = {
  seasonNumber: number;
  episodes: EpisodeCard[];
};

export type SeriesCard = {
  series: Series;
  seasons: SeasonGroup[];
  episodeCount: number;
  availableEpisodeCount: number;
};

export function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function filterMovies(movies: MovieCard[], query: string): MovieCard[] {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return movies;

  return movies.filter(({ item, file }) => {
    const haystack = normalizeSearch([
      item.title,
      item.year ?? "",
      item.genres.join(" "),
      file?.fileName ?? "",
      file?.relativePath ?? "",
    ].join(" "));
    return haystack.includes(normalizedQuery);
  });
}


export type BrowseSort =
  | "name-asc"
  | "name-desc"
  | "added-newest"
  | "added-oldest"
  | "year-newest"
  | "year-oldest"
  | "updated-newest";

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
}

function compareNullableYear(
  left: number | null,
  right: number | null,
  direction: "asc" | "desc",
): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return direction === "asc" ? left - right : right - left;
}

export function sortMovies(movieCards: MovieCard[], sort: BrowseSort): MovieCard[] {
  return [...movieCards].sort((left, right) => {
    const leftItem = left.item;
    const rightItem = right.item;
    switch (sort) {
      case "name-desc":
        return compareText(rightItem.title, leftItem.title);
      case "added-newest":
        return rightItem.createdAt - leftItem.createdAt || compareText(leftItem.title, rightItem.title);
      case "added-oldest":
        return leftItem.createdAt - rightItem.createdAt || compareText(leftItem.title, rightItem.title);
      case "year-newest":
        return compareNullableYear(leftItem.year, rightItem.year, "desc") || compareText(leftItem.title, rightItem.title);
      case "year-oldest":
        return compareNullableYear(leftItem.year, rightItem.year, "asc") || compareText(leftItem.title, rightItem.title);
      case "updated-newest":
        return rightItem.updatedAt - leftItem.updatedAt || compareText(leftItem.title, rightItem.title);
      case "name-asc":
      default:
        return compareText(leftItem.title, rightItem.title);
    }
  });
}

export function groupSeries(
  seriesRows: Series[],
  episodeItems: MediaItem[],
  files: MediaFile[],
): SeriesCard[] {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const episodesBySeries = new Map<string, EpisodeCard[]>();

  for (const item of episodeItems) {
    if (!item.seriesId) continue;
    const bucket = episodesBySeries.get(item.seriesId) ?? [];
    bucket.push({ item, file: fileById.get(item.mediaFileId) });
    episodesBySeries.set(item.seriesId, bucket);
  }

  const output: SeriesCard[] = seriesRows.map((series) => {
    const episodes = episodesBySeries.get(series.id) ?? [];
    episodes.sort((a, b) => {
      const seasonDelta = (a.item.seasonNumber ?? 0) - (b.item.seasonNumber ?? 0);
      if (seasonDelta !== 0) return seasonDelta;
      return (a.item.episodeNumber ?? 0) - (b.item.episodeNumber ?? 0);
    });

    const seasonsByNumber = new Map<number, EpisodeCard[]>();
    let availableEpisodeCount = 0;

    for (const episode of episodes) {
      const seasonNumber = episode.item.seasonNumber ?? 0;
      const seasonEpisodes = seasonsByNumber.get(seasonNumber) ?? [];
      seasonEpisodes.push(episode);
      seasonsByNumber.set(seasonNumber, seasonEpisodes);
      if (episode.file?.available) availableEpisodeCount += 1;
    }

    const seasons = Array.from(seasonsByNumber.entries())
      .sort(([a], [b]) => a - b)
      .map(([seasonNumber, seasonEpisodes]) => ({
        seasonNumber,
        episodes: seasonEpisodes,
      }));

    return {
      series,
      seasons,
      episodeCount: episodes.length,
      availableEpisodeCount,
    };
  });

  return output.sort((a, b) => a.series.title.localeCompare(b.series.title));
}


export type GenreSeriesGroup = {
  genre: string;
  cards: SeriesCard[];
};

const SERIES_GENRE_PRIORITY = [
  "Drama",
  "Comedy",
  "Action",
  "Crime",
  "Thriller",
  "Mystery",
  "Science-Fiction",
  "Fantasy",
  "Horror",
  "Romance",
  "Adventure",
  "Animation",
  "Family",
  "Documentary",
];

export function groupSeriesByGenre(seriesCards: SeriesCard[]): GenreSeriesGroup[] {
  const groups = new Map<string, GenreSeriesGroup>();

  for (const card of seriesCards) {
    const genres = Array.from(
      new Map(
        card.series.genres
          .map((genre) => genre.trim())
          .filter(Boolean)
          .map((genre) => [genre.toLowerCase(), genre] as const),
      ).values(),
    );

    const effectiveGenres = genres.length > 0 ? genres : ["Other"];
    for (const genre of effectiveGenres) {
      const key = genre.toLowerCase();
      const existing = groups.get(key);
      if (existing) {
        existing.cards.push(card);
      } else {
        groups.set(key, { genre, cards: [card] });
      }
    }
  }

  const priority = new Map(
    SERIES_GENRE_PRIORITY.map((genre, index) => [genre.toLowerCase(), index]),
  );

  return Array.from(groups.values()).sort((a, b) => {
    if (a.genre === "Other") return 1;
    if (b.genre === "Other") return -1;

    const aPriority = priority.get(a.genre.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const bPriority = priority.get(b.genre.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.genre.localeCompare(b.genre);
  });
}

export function filterSeries(seriesCards: SeriesCard[], query: string): SeriesCard[] {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return seriesCards;

  return seriesCards.filter((card) => {
    const episodeText = card.seasons
      .flatMap((season) => season.episodes)
      .map(({ item, file }) => [
        item.title,
        item.episodeTitle ?? "",
        item.seasonNumber ?? "",
        item.episodeNumber ?? "",
        file?.fileName ?? "",
      ].join(" "))
      .join(" ");

    const haystack = normalizeSearch([
      card.series.title,
      card.series.year ?? "",
      card.series.genres.join(" "),
      episodeText,
    ].join(" "));

    return haystack.includes(normalizedQuery);
  });
}


export function sortSeries(seriesCards: SeriesCard[], sort: BrowseSort): SeriesCard[] {
  return [...seriesCards].sort((left, right) => {
    const leftSeries = left.series;
    const rightSeries = right.series;
    switch (sort) {
      case "name-desc":
        return compareText(rightSeries.title, leftSeries.title);
      case "added-newest":
        return rightSeries.createdAt - leftSeries.createdAt || compareText(leftSeries.title, rightSeries.title);
      case "added-oldest":
        return leftSeries.createdAt - rightSeries.createdAt || compareText(leftSeries.title, rightSeries.title);
      case "year-newest":
        return compareNullableYear(leftSeries.year, rightSeries.year, "desc") || compareText(leftSeries.title, rightSeries.title);
      case "year-oldest":
        return compareNullableYear(leftSeries.year, rightSeries.year, "asc") || compareText(leftSeries.title, rightSeries.title);
      case "updated-newest":
        return rightSeries.updatedAt - leftSeries.updatedAt || compareText(leftSeries.title, rightSeries.title);
      case "name-asc":
      default:
        return compareText(leftSeries.title, rightSeries.title);
    }
  });
}

export function libraryCounts(items: MediaItem[], files: MediaFile[]) {
  const availableFileIds = new Set(
    files.filter((file) => file.available).map((file) => file.id),
  );

  return {
    movies: items.filter((item) => item.type === "movie").length,
    episodes: items.filter((item) => item.type === "episode").length,
    availableItems: items.filter((item) => availableFileIds.has(item.mediaFileId)).length,
    needsMatch: items.filter((item) => item.matchStatus === "needs_match").length,
  };
}
