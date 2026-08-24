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
): Featured | null {
  const availableSeries =
    series.find((card) => card.availableEpisodeCount > 0) ?? series[0];

  const availableMovie =
    movies.find(({ file }) => file?.available) ?? movies[0];

  if (availableSeries) return { kind: "series", series: availableSeries };
  if (availableMovie) return { kind: "movie", movie: availableMovie };
  return null;
}

export function HeroRail({ movies, series, onOpenSeries }: Props) {
  const featured = chooseFeatured(movies, series);

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
          {(card.series.logoArtworkId || card.seasons[0]?.episodes[0]?.item.logoArtworkId) ? (
            <ArtworkImage
              className="featured-logo"
              artworkId={card.series.logoArtworkId ?? card.seasons[0]?.episodes[0]?.item.logoArtworkId ?? null}
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
        {item.logoArtworkId ? (
          <ArtworkImage
            className="featured-logo"
            artworkId={item.logoArtworkId}
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
