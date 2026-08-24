import type { MediaFile, MediaItem, Series } from "../types/library";

export type MovieCard = {
  item: MediaItem;
  file: MediaFile | undefined;
};

export type EpisodeCard = {
  item: MediaItem;
  file: MediaFile | undefined;
};

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

export function groupSeries(
  seriesRows: Series[],
  episodeItems: MediaItem[],
  files: MediaFile[],
): SeriesCard[] {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const output: SeriesCard[] = [];

  for (const series of seriesRows) {
    const episodes = episodeItems
      .filter((item) => item.seriesId === series.id)
      .map((item) => ({
        item,
        file: fileById.get(item.mediaFileId),
      }))
      .sort((a, b) => {
        const seasonDelta = (a.item.seasonNumber ?? 0) - (b.item.seasonNumber ?? 0);
        if (seasonDelta !== 0) return seasonDelta;
        return (a.item.episodeNumber ?? 0) - (b.item.episodeNumber ?? 0);
      });

    const seasonNumbers = Array.from(
      new Set(episodes.map(({ item }) => item.seasonNumber ?? 0)),
    ).sort((a, b) => a - b);

    output.push({
      series,
      seasons: seasonNumbers.map((seasonNumber) => ({
        seasonNumber,
        episodes: episodes.filter(
          ({ item }) => (item.seasonNumber ?? 0) === seasonNumber,
        ),
      })),
      episodeCount: episodes.length,
      availableEpisodeCount: episodes.filter(({ file }) => file?.available).length,
    });
  }

  return output.sort((a, b) => a.series.title.localeCompare(b.series.title));
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
