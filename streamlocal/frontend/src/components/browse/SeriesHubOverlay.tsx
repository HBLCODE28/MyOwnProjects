import { useMemo, useState } from "react";
import type {
  MediaItem,
  PlaybackProgress,
} from "../../types/library";
import type { SeriesCard } from "../../services/browseSelectors";
import { ArtworkImage } from "./ArtworkImage";
import "../../styles/seriesHub.css";

type Props = {
  card: SeriesCard;
  progressByItemId?: Record<string, PlaybackProgress>;
  onClose: () => void;
  onPlay: (item: MediaItem) => void;
};

export function SeriesHubOverlay({
  card,
  progressByItemId = {},
  onClose,
  onPlay,
}: Props) {
  const firstSeason = card.seasons[0]?.seasonNumber ?? 1;
  const [seasonNumber, setSeasonNumber] = useState(firstSeason);

  const season = useMemo(
    () =>
      card.seasons.find(
        (entry) => entry.seasonNumber === seasonNumber,
      ) ?? card.seasons[0],
    [card.seasons, seasonNumber],
  );

  const heroArtwork =
    card.series.backdropArtworkId ??
    season?.episodes[0]?.item.backdropArtworkId ??
    card.series.posterArtworkId ??
    season?.episodes[0]?.item.posterArtworkId ??
    null;

  const remoteArtwork =
    card.series.remoteBackdropUrl ??
    card.series.remotePosterUrl ??
    null;

  return (
    <div className="series-hub-backdrop" onMouseDown={onClose}>
      <section
        className="series-hub"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="series-hub-hero">
          <div className="series-hub-art">
            <ArtworkImage
              artworkId={heroArtwork}
              remoteUrl={remoteArtwork}
              label="SERIES"
              fit="contain"
              position="center"
            />
          </div>

          <div className="series-hub-gradient" />

          <button
            className="series-hub-close"
            onClick={onClose}
            aria-label="Close series"
            title="Close"
          >
            ×
          </button>

          <div className="series-hub-copy">
            <p className="eyebrow">SERIES</p>
            <h2>{card.series.title}</h2>

            <p className="series-hub-meta">
              {[
                card.series.year,
                `${card.seasons.length} season${card.seasons.length === 1 ? "" : "s"}`,
                `${card.episodeCount} episodes`,
                card.series.genres.join(", ") || null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>

            {card.series.overview && (
              <p className="series-hub-overview">
                {card.series.overview}
              </p>
            )}
          </div>
        </div>

        <div className="series-hub-body">
          <div className="series-hub-toolbar">
            <div className="series-season-heading">
              <h3>
                Season {season?.seasonNumber ?? seasonNumber}
              </h3>
              <span className="series-episodes-label">EPISODES</span>
            </div>

            <label className="series-season-select">
              Season
              <select
                value={season?.seasonNumber ?? seasonNumber}
                onChange={(event) =>
                  setSeasonNumber(Number(event.target.value))
                }
              >
                {card.seasons.map((entry) => (
                  <option
                    key={entry.seasonNumber}
                    value={entry.seasonNumber}
                  >
                    Season {entry.seasonNumber}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="episode-list">
            {season?.episodes.map(({ item, file }) => {
              const canPlay =
                Boolean(file?.available) &&
                ["mp4", "mkv"].includes(
                  file?.extension.toLowerCase() ?? "",
                );

              const progress = progressByItemId[item.id];
              const state = progress?.watched
                ? "Watched"
                : progress?.started
                  ? "Started"
                  : null;

              return (
                <article
                  className={`episode-row ${
                    progress?.watched
                      ? "episode-row-watched"
                      : progress?.started
                        ? "episode-row-started"
                        : ""
                  }`}
                  key={item.id}
                >
                  <div className="episode-number">
                    {item.episodeNumber ?? "-"}
                  </div>

                  <div className="episode-thumbnail">
                    <ArtworkImage
                      artworkId={
                        item.backdropArtworkId ??
                        item.posterArtworkId ??
                        card.series.backdropArtworkId ??
                        null
                      }
                      remoteUrl={
                        card.series.remoteBackdropUrl ??
                        card.series.remotePosterUrl ??
                        null
                      }
                      label={`S${String(item.seasonNumber ?? 0).padStart(2, "0")}E${String(item.episodeNumber ?? 0).padStart(2, "0")}`}
                      fit="cover"
                    />

                    {state && (
                      <span
                        className={
                          progress?.watched
                            ? "episode-state watched"
                            : "episode-state started"
                        }
                      >
                        {state}
                      </span>
                    )}

                    {progress &&
                      progress.percent > 0 &&
                      !progress.watched && (
                        <div className="episode-progress-track">
                          <div
                            className="episode-progress-value"
                            style={{
                              width: `${Math.max(
                                2,
                                Math.min(100, progress.percent * 100),
                              )}%`,
                            }}
                          />
                        </div>
                      )}
                  </div>

                  <div className="episode-copy">
                    <div className="episode-title-row">
                      <h4>
                        {item.episodeTitle ||
                          item.title ||
                          `Episode ${item.episodeNumber ?? ""}`}
                      </h4>

                      <span>
                        S{String(item.seasonNumber ?? 0).padStart(2, "0")}
                        E{String(item.episodeNumber ?? 0).padStart(2, "0")}
                      </span>
                    </div>

                    {item.overview && <p>{item.overview}</p>}

                    <div className="episode-file-meta">
                      {file?.fileName ?? "File unavailable"}
                    </div>
                  </div>

                  <div className="episode-actions">
                    {canPlay ? (
                      <button
                        className="primary-button"
                        onClick={() => onPlay(item)}
                      >
                        {progress?.started && !progress.watched
                          ? "Resume"
                          : progress?.watched
                            ? "Play again"
                            : "Play"}
                      </button>
                    ) : (
                      <span className="episode-unavailable">
                        Unavailable
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
