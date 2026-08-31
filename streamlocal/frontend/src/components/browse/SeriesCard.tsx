import { TablerListDetailsIcon } from "../icons/TablerIcons";
import type { SeriesCard as SeriesCardModel } from "../../services/browseSelectors";
import { ArtworkImage } from "./ArtworkImage";

type Props = {
  card: SeriesCardModel;
  onOpen?: (card: SeriesCardModel) => void;
};

export function SeriesCard({ card, onOpen }: Props) {
  const firstEpisode = card.seasons[0]?.episodes[0]?.item;

  return (
    <article
      className={`series-card ${onOpen ? "playable-card" : ""}`}
      onClick={() => onOpen?.(card)}
      onKeyDown={(event) => {
        if (
          (event.key === "Enter" || event.key === " ") &&
          onOpen
        ) {
          event.preventDefault();
          onOpen(card);
        }
      }}
      tabIndex={onOpen ? 0 : undefined}
      role={onOpen ? "button" : undefined}
    >
      <div className="series-card-art">
        <ArtworkImage
          artworkId={
            card.series.backdropArtworkId ??
            firstEpisode?.backdropArtworkId ??
            card.series.posterArtworkId ??
            firstEpisode?.posterArtworkId ??
            null
          }
          remoteUrl={
            card.series.remoteBackdropUrl ??
            card.series.remotePosterUrl ??
            null
          }
          label="SERIES"
        />

        {onOpen && (
          <span className="card-play card-play-series">
            <TablerListDetailsIcon size={15} />
            View episodes
          </span>
        )}
      </div>

      <div className="series-card-copy">
        {card.series.logoArtworkId || card.series.remoteLogoUrl ? (
          <ArtworkImage className="card-logo" artworkId={card.series.logoArtworkId ?? null} remoteUrl={card.series.remoteLogoUrl ?? null} label={card.series.title} fallbackText={card.series.title} fit="contain" position="left center" lightBackgroundForDark logoKind="series" logoYear={card.series.year} artworkOwnerId={card.series.id} />
        ) : <h3>{card.series.title}</h3>}
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
