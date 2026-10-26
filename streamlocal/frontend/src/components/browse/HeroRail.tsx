import { TablerPlayerPlayIcon } from "../icons/TablerIcons";
import { useEffect, useMemo, useState } from "react";
import type { MediaItem } from "../../types/library";
import type { MovieCard, SeriesCard } from "../../services/browseSelectors";
import { ArtworkImage } from "./ArtworkImage";

type Props = {
  movies: MovieCard[];
  series: SeriesCard[];
  onOpenSeries?: (series: SeriesCard) => void;
  onPlaySeries?: (item: MediaItem) => void;
  onPlayMovie?: (item: MediaItem) => void;
};

type Featured =
  | { kind: "movie"; movie: MovieCard }
  | { kind: "series"; series: SeriesCard };

function chooseFeatured(
  movies: MovieCard[],
  series: SeriesCard[],
  index = 0,
): Featured | null {
  const playableSeries = series.filter((card) => card.availableEpisodeCount > 0);
  const playableMovies = movies.filter(({ file }) => file?.available);
  const entries: Featured[] = [
    ...playableSeries.map((entry) => ({ kind: "series" as const, series: entry })),
    ...playableMovies.map((entry) => ({ kind: "movie" as const, movie: entry })),
  ];
  return entries.length ? entries[index % entries.length] : null;
}

function firstPlayableEpisode(card: SeriesCard): MediaItem | null {
  for (const season of card.seasons) {
    for (const episode of season.episodes) {
      const extension = episode.file?.extension.toLowerCase();
      if (episode.file?.available && (extension === "mp4" || extension === "mkv")) {
        return episode.item;
      }
    }
  }
  return null;
}

export function HeroRail({ movies, series, onOpenSeries, onPlaySeries, onPlayMovie }: Props) {
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [expandedOverviewKey, setExpandedOverviewKey] = useState<string | null>(null);
  const featuredCount = useMemo(
    () => series.filter((card) => card.availableEpisodeCount > 0).length + movies.filter(({ file }) => file?.available).length,
    [movies, series],
  );

  useEffect(() => {
    setFeaturedIndex((current) =>
      featuredCount > 0 ? current % featuredCount : 0,
    );
    if (featuredCount < 2) return undefined;
    const timer = window.setInterval(() => {
      setFeaturedIndex((current) => (current + 1) % featuredCount);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [featuredCount]);

  const featured = chooseFeatured(movies, series, featuredIndex);
  const featuredKey = featured
    ? featured.kind === "series"
      ? `series-${featured.series.series.id}`
      : `movie-${featured.movie.item.id}`
    : "empty";
  const overviewExpanded = expandedOverviewKey === featuredKey;

  useEffect(() => {
    setExpandedOverviewKey(null);
  }, [featuredKey]);

  if (!featured) {
    return (
      <section className="browse-hero empty-hero">
        <div className="browse-hero-content">
          <p className="hero-kicker">STREAMLOCAL</p>
          <h1>Your local player.</h1>
          <p className="hero-overview">Add a folder in Library, then identify your media locally.</p>
        </div>
      </section>
    );
  }

  if (featured.kind === "series") {
    const card = featured.series;
    const firstEpisode = card.seasons[0]?.episodes[0]?.item;
    const playableEpisode = firstPlayableEpisode(card);
    const localBackdrop =
      card.series.backdropArtworkId ??
      firstEpisode?.backdropArtworkId ??
      card.series.posterArtworkId ??
      firstEpisode?.posterArtworkId ??
      null;

    return (
      <section key={`featured-${card.series.id}`} className="browse-hero browse-hero-transition">
        <div className="browse-hero-bg">
          <ArtworkImage
            artworkId={localBackdrop}
            remoteUrl={card.series.remoteBackdropUrl ?? card.series.remotePosterUrl ?? null}
            label="FEATURED"
            fit="cover"
          />
        </div>
        <div className="browse-hero-content">
          <p className="hero-kicker">FEATURED SERIES</p>
          {(card.series.logoArtworkId || card.series.remoteLogoUrl || firstEpisode?.logoArtworkId || firstEpisode?.remoteLogoUrl) ? (
            <ArtworkImage
              className="featured-logo"
              artworkId={card.series.logoArtworkId ?? firstEpisode?.logoArtworkId ?? null}
              remoteUrl={card.series.remoteLogoUrl ?? firstEpisode?.remoteLogoUrl ?? null}
              label={card.series.title}
              fallbackText={card.series.title}
              fit="contain"
              position="left center"
              lightBackgroundForDark
              logoKind="series"
              logoYear={card.series.year}
              artworkOwnerId={card.series.logoArtworkId ? card.series.id : firstEpisode?.id}
            />
          ) : (
            <h1>{card.series.title}</h1>
          )}
          <div className="hero-meta">
            {card.series.year && <span>{card.series.year}</span>}
            <span>{card.seasons.length} season{card.seasons.length === 1 ? "" : "s"}</span>
            {card.series.genres.slice(0, 2).map((genre) => <span key={genre}>{genre}</span>)}
          </div>
          {card.series.overview && (
            <p className={`hero-overview ${overviewExpanded ? "hero-overview-expanded" : ""}`}>
              {card.series.overview}
            </p>
          )}
          {(playableEpisode && onPlaySeries || onOpenSeries) && (
            <div className="hero-actions-row">
              {playableEpisode && onPlaySeries && (
                <button className="hero-play-button" onClick={() => onPlaySeries(playableEpisode)}>
                  <TablerPlayerPlayIcon className="play-glyph" size={22} />
                  Play
                </button>
              )}
              {onOpenSeries && (
                <button
                  className="hero-info-button"
                  aria-expanded={card.series.overview ? overviewExpanded : undefined}
                  onClick={() => {
                    if (card.series.overview && !overviewExpanded) {
                      setExpandedOverviewKey(featuredKey);
                      return;
                    }
                    onOpenSeries(card);
                  }}
                >
                  {overviewExpanded ? "View episodes" : "More info"}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  const { item, file } = featured.movie;
  const localArtwork = item.backdropArtworkId ?? item.posterArtworkId ?? null;
  const canPlay = Boolean(file?.available && ["mp4", "mkv"].includes(file.extension.toLowerCase()));

  return (
    <section key={`featured-movie-${item.id}`} className="browse-hero movie-featured-hero browse-hero-transition">
      <div className="browse-hero-bg movie-featured-art">
        <ArtworkImage
          artworkId={localArtwork}
          remoteUrl={item.remoteBackdropUrl ?? item.remotePosterUrl ?? null}
          label="FEATURED"
          fit={item.backdropArtworkId || item.remoteBackdropUrl ? "cover" : "contain"}
        />
      </div>
      <div className="browse-hero-content">
        <p className="hero-kicker">FEATURED MOVIE</p>
        {item.logoArtworkId || item.remoteLogoUrl ? (
          <ArtworkImage
            className="featured-logo"
            artworkId={item.logoArtworkId ?? null}
            remoteUrl={item.remoteLogoUrl ?? null}
            label={item.title}
            fallbackText={item.title}
            fit="contain"
            position="left center"
            lightBackgroundForDark
            logoKind="movie"
            logoYear={item.year}
            artworkOwnerId={item.id}
          />
        ) : (
          <h1>{item.title}</h1>
        )}
        <div className="hero-meta">
          {item.year && <span>{item.year}</span>}
          <span>Movie</span>
          {item.genres.slice(0, 2).map((genre) => <span key={genre}>{genre}</span>)}
        </div>
        {item.overview && (
          <p className={`hero-overview ${overviewExpanded ? "hero-overview-expanded" : ""}`}>
            {item.overview}
          </p>
        )}
        {(canPlay && onPlayMovie || item.overview) && (
          <div className="hero-actions-row">
            {canPlay && onPlayMovie && (
              <button className="hero-play-button" onClick={() => onPlayMovie(item)}>
                <TablerPlayerPlayIcon className="play-glyph" size={22} />
                Play
              </button>
            )}
            {item.overview && (
              <button
                className="hero-info-button"
                aria-expanded={overviewExpanded}
                onClick={() => setExpandedOverviewKey(overviewExpanded ? null : featuredKey)}
              >
                {overviewExpanded ? "Less info" : "More info"}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
