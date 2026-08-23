import type { SeriesCard as SeriesCardModel } from "../../services/browseSelectors";
import { ArtworkImage } from "./ArtworkImage";

type Props = {
  card: SeriesCardModel;
};

export function SeriesCard({ card }: Props) {
  const latestSeason = card.seasons.at(-1);
  const firstEpisode = latestSeason?.episodes[0]?.item;

  return (
    <article className="series-card">
      <div className="series-card-art">
        <ArtworkImage artworkId={card.series.posterArtworkId ?? firstEpisode?.posterArtworkId ?? null} label="SERIES" />
      </div>

      <div className="series-card-copy">
        <h3>{card.series.title}</h3>
        <p>
          {card.seasons.length} season{card.seasons.length === 1 ? "" : "s"} ·{" "}
          {card.availableEpisodeCount}/{card.episodeCount} available
        </p>
        <div className="season-strip">
          {card.seasons.slice(0, 4).map((season) => (
            <span key={season.seasonNumber}>
              S{String(season.seasonNumber).padStart(2, "0")} · {season.episodes.length}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
