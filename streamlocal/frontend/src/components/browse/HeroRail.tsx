import type { MovieCard, SeriesCard } from "../../services/browseSelectors";
import { ArtworkImage } from "./ArtworkImage";

type Props = {
  movies: MovieCard[];
  series: SeriesCard[];
};

export function HeroRail({ movies, series }: Props) {
  const featuredMovie =
    movies.find(({ file }) => file?.available) ?? movies[0];
  const featuredSeries =
    series.find((card) => card.availableEpisodeCount > 0) ?? series[0];

  if (!featuredMovie && !featuredSeries) {
    return (
      <section className="browse-hero empty-hero">
        <p className="eyebrow">STREAMLOCAL</p>
        <h1>Build your local streaming shelf.</h1>
        <p>Add a folder in Library, then identify your media locally.</p>
      </section>
    );
  }

  const title =
    featuredMovie?.item.title ??
    featuredSeries?.series.title ??
    "StreamLocal";
  const year =
    featuredMovie?.item.year ?? featuredSeries?.series.year;
  const overview =
    featuredMovie?.item.overview || featuredSeries?.series.overview;

  const backdrop =
    featuredMovie?.item.backdropArtworkId ??
    featuredMovie?.item.posterArtworkId ??
    featuredSeries?.series.backdropArtworkId ??
    featuredSeries?.series.posterArtworkId ??
    null;

  const remoteArtwork =
    !featuredMovie && featuredSeries
      ? featuredSeries.series.remotePosterUrl ?? null
      : null;

  return (
    <section className="browse-hero">
      <div className="browse-hero-bg">
        <ArtworkImage
          artworkId={backdrop}
          remoteUrl={remoteArtwork}
          label="FEATURED"
        />
      </div>

      <div className="browse-hero-content">
        <p className="eyebrow">FEATURED LOCAL TITLE</p>
        <h1>{title}</h1>
        <p>
          {[
            year,
            featuredMovie ? "Movie" : "Series",
            overview ? overview : "Local metadata",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </section>
  );
}
