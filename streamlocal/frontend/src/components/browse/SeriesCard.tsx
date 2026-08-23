import type { MediaItem } from "../../types/library";
import type { SeriesCard as SeriesCardModel } from "../../services/browseSelectors";
import { ArtworkImage } from "./ArtworkImage";

type Props = {
  card: SeriesCardModel;
  onPlay?: (item: MediaItem) => void;
};

export function SeriesCard({ card, onPlay }: Props) {
  const latestSeason = card.seasons.at(-1);
  const firstEpisode = latestSeason?.episodes[0]?.item;

  const playable = card.seasons
    .flatMap((season) => season.episodes)
    .find(
      ({ file }) =>
        file?.available &&
        (file.extension.toLowerCase() === "mp4" ||
          file.extension.toLowerCase() === "mkv"),
    )?.item;

  return (
    <article
      className={`series-card ${playable && onPlay ? "playable-card" : ""}`}
      onClick={() => {
        if (playable && onPlay) onPlay(playable);
      }}
      onKeyDown={(event) => {
        if (
          (event.key === "Enter" || event.key === " ") &&
          playable &&
          onPlay
        ) {
          event.preventDefault();
          onPlay(playable);
        }
      }}
      tabIndex={playable && onPlay ? 0 : undefined}
      role={playable && onPlay ? "button" : undefined}
    >
      <div className="series-card-art">
        <ArtworkImage
          artworkId={
            card.series.posterArtworkId ??
            firstEpisode?.posterArtworkId ??
            null
          }
          remoteUrl={card.series.remotePosterUrl ?? null}
          label="SERIES"
        />
        {playable && onPlay && (
          <span className="card-play">Play first available</span>
        )}
      </div>

      <div className="series-card-copy">
        <h3>{card.series.title}</h3>
        <p>
          {card.seasons.length} season
          {card.seasons.length === 1 ? "" : "s"} ·{" "}
          {card.availableEpisodeCount}/{card.episodeCount} available
        </p>

        <div className="season-strip">
          {card.seasons.slice(0, 4).map((season) => (
            <span key={season.seasonNumber}>
              S{String(season.seasonNumber).padStart(2, "0")} ·{" "}
              {season.episodes.length}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
