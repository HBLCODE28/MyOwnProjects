import { useEffect, useMemo, useState } from "react";
import type { MovieCard, SeriesCard } from "../../services/browseSelectors";
import { ArtworkImage } from "./ArtworkImage";

type Props = {
  movies: MovieCard[];
  series: SeriesCard[];
  onOpenSeries?: (series: SeriesCard) => void;
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

  const availableMovie =
    movies.find(({ file }) => file?.available) ?? movies[0];

  if (featuredSeries) return { kind: "series", series: featuredSeries };
  if (availableMovie) return { kind: "movie", movie: availableMovie };
  return null;
}

export function HeroRail({ movies, series, onOpenSeries }: Props) {
  const [featuredSeriesIndex, setFeaturedSeriesIndex] = useState(0);
  const seriesPoolLength = useMemo(() => {
    const available = series.filter((card) => card.availableEpisodeCount > 0);
    const artwork = available.filter((card) => Boolean(
      card.series.logoArtworkId || card.series.backdropArtworkId ||
      card.series.posterArtworkId || card.series.remoteBackdropUrl ||
      card.series.remoteLogoUrl ||
      card.series.remotePosterUrl || card.seasons[0]?.episodes[0]?.item.posterArtworkId,
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
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [seriesPoolLength]);

  const featured = chooseFeatured(movies, series, featuredSeriesIndex);

  if (!featured) {
    return (
      <section className="browse-hero empty-hero">
        <p className="eyebrow">STREAMLOCAL</p>
        <h1>Your local player.</h1>
        <p>Add a folder in Library, then identify your media locally.</p>
      </section>
    );
  }

  if (featured.kind === "series") {
    const card = featured.series;
    const localBackdrop =
      card.series.backdropArtworkId ??
      card.series.posterArtworkId ??
      card.seasons[0]?.episodes[0]?.item.backdropArtworkId ??
      card.seasons[0]?.episodes[0]?.item.posterArtworkId ??
      null;

    return (
      <section className="browse-hero">
        <div className="browse-hero-bg">
          <ArtworkImage
            artworkId={localBackdrop}
            remoteUrl={
              card.series.remoteBackdropUrl ??
              card.series.remotePosterUrl ??
              null
            }
            label="FEATURED"
            fit="cover"
          />
        </div>

        <div className="browse-hero-content">
          <p className="eyebrow">FEATURED SERIES</p>
          {(card.series.logoArtworkId || card.series.remoteLogoUrl || card.seasons[0]?.episodes[0]?.item.logoArtworkId || card.seasons[0]?.episodes[0]?.item.remoteLogoUrl) ? (
            <ArtworkImage
              className="featured-logo"
              artworkId={card.series.logoArtworkId ?? card.seasons[0]?.episodes[0]?.item.logoArtworkId ?? null}
              remoteUrl={card.series.remoteLogoUrl ?? card.seasons[0]?.episodes[0]?.item.remoteLogoUrl ?? null}
              label={card.series.title}
              fit="contain"
              position="left center"
            />
          ) : (
            <h1>{card.series.title}</h1>
          )}
          <p>
            {[
              card.series.year,
              `${card.seasons.length} season${card.seasons.length === 1 ? "" : "s"}`,
              card.series.overview || null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {onOpenSeries && (
            <button
              className="primary-button hero-primary-action"
              onClick={() => onOpenSeries(card)}
            >
              View series
            </button>
          )}
        </div>
      </section>
    );
  }

  const { item } = featured.movie;
  const localArtwork =
    item.backdropArtworkId ?? item.posterArtworkId ?? null;

  return (
    <section className="browse-hero movie-featured-hero">
      <div className="browse-hero-bg movie-featured-art">
        <ArtworkImage
          artworkId={localArtwork}
          remoteUrl={item.remoteBackdropUrl ?? item.remotePosterUrl ?? null}
          label="FEATURED"
          fit={item.backdropArtworkId || item.remoteBackdropUrl ? "cover" : "contain"}
        />
      </div>

      <div className="browse-hero-content">
        <p className="eyebrow">FEATURED MOVIE</p>
        {item.logoArtworkId || item.remoteLogoUrl ? (
          <ArtworkImage
            className="featured-logo"
            artworkId={item.logoArtworkId ?? null}
            remoteUrl={item.remoteLogoUrl ?? null}
            label={item.title}
            fit="contain"
            position="left center"
          />
        ) : (
          <h1>{item.title}</h1>
        )}
        <p>
          {[item.year, "Movie", item.overview || null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </section>
  );
}
