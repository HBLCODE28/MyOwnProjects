import { TablerPlayerPlayIcon } from "../icons/TablerIcons";
import { useEffect, useMemo, useState } from "react";
import type { MediaItem } from "../../types/library";
import type { MovieCard, SeriesCard } from "../../services/browseSelectors";
import { ArtworkImage } from "./ArtworkImage";

type Props = {
  movies: MovieCard[];
  series: SeriesCard[];
  onOpenSeries?: (series: SeriesCard) => void;
  onPlayMovie?: (item: MediaItem) => void;
};

type Featured =
  | { kind: "movie"; movie: MovieCard }
  | { kind: "series"; series: SeriesCard };

function chooseFeatured(
  movies: MovieCard[],
  series: SeriesCard[],
  preferredSeriesIndex = 0,
): Featured | null {
  const availableSeries = series.filter((card) => card.availableEpisodeCount > 0);
  const artworkSeries = availableSeries.filter((card) =>
    Boolean(
      card.series.logoArtworkId ||
        card.series.backdropArtworkId ||
        card.series.posterArtworkId ||
        card.series.remoteLogoUrl ||
        card.series.remoteBackdropUrl ||
        card.series.remotePosterUrl ||
        card.seasons[0]?.episodes[0]?.item.posterArtworkId,
    ),
  );
  const seriesPool = artworkSeries.length > 0 ? artworkSeries : availableSeries;
  const availableFeaturedSeries = seriesPool.length > 0 ? seriesPool : series;
  const featuredSeries = availableFeaturedSeries.length > 0
    ? availableFeaturedSeries[preferredSeriesIndex % availableFeaturedSeries.length]
    : undefined;
  const availableMovie = movies.find(({ file }) => file?.available) ?? movies[0];

  if (featuredSeries) return { kind: "series", series: featuredSeries };
  if (availableMovie) return { kind: "movie", movie: availableMovie };
  return null;
}

export function HeroRail({ movies, series, onOpenSeries, onPlayMovie }: Props) {
  const [featuredSeriesIndex, setFeaturedSeriesIndex] = useState(0);
  const seriesPoolLength = useMemo(() => {
    const available = series.filter((card) => card.availableEpisodeCount > 0);
    const artwork = available.filter((card) => Boolean(
      card.series.logoArtworkId || card.series.backdropArtworkId ||
      card.series.posterArtworkId || card.series.remoteBackdropUrl ||
      card.series.remoteLogoUrl || card.series.remotePosterUrl ||
      card.seasons[0]?.episodes[0]?.item.posterArtworkId,
    ));
    return (artwork.length > 0 ? artwork : available).length || series.length;
  }, [series]);

  useEffect(() => {
    setFeaturedSeriesIndex((current) =>
      seriesPoolLength > 0 ? current % seriesPoolLength : 0,
    );
    if (seriesPoolLength < 2) return undefined;
    const timer = window.setInterval(() => {
      setFeaturedSeriesIndex((current) => (current + 1) % seriesPoolLength);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [seriesPoolLength]);

  const featured = chooseFeatured(movies, series, featuredSeriesIndex);

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
          {card.series.overview && <p className="hero-overview">{card.series.overview}</p>}
          {onOpenSeries && (
            <div className="hero-actions-row">
              <button className="hero-play-button" onClick={() => onOpenSeries(card)}>
                <TablerPlayerPlayIcon className="play-glyph" size={22} />
                View series
              </button>
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
        {item.overview && <p className="hero-overview">{item.overview}</p>}
        {canPlay && onPlayMovie && (
          <div className="hero-actions-row">
            <button className="hero-play-button" onClick={() => onPlayMovie(item)}>
              <TablerPlayerPlayIcon className="play-glyph" size={22} />
              Play
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
