import { useEffect, useMemo, useState } from "react";
import type {
  MediaItem,
  PlaybackProgress,
} from "../../types/library";
import type { SeriesCard } from "../../services/browseSelectors";
import { ArtworkImage } from "./ArtworkImage";
import {
  getSeriesViewingState,
  setSeriesLastWatchedEpisode,
  setSeriesNotWatched,
} from "../../services/seriesViewingState";
import "../../styles/seriesHub.css";
import { useToast } from "../ui/Toast";

type Props = {
  card: SeriesCard;
  progressByItemId?: Record<string, PlaybackProgress>;
  onClose: () => void;
  onPlay: (item: MediaItem) => void;
  onProgressChanged?: () => void;
};

export function SeriesHubOverlay({
  card,
  progressByItemId = {},
  onClose,
  onPlay,
  onProgressChanged,
}: Props) {
  const firstSeason = card.seasons[0]?.seasonNumber ?? 1;
  const [seasonNumber, setSeasonNumber] = useState(firstSeason);
  const [progressSeasonNumber, setProgressSeasonNumber] = useState(firstSeason);
  const [lastWatchedEpisodeId, setLastWatchedEpisodeId] = useState("");
  const [viewingMessage, setViewingMessage] = useState<string | null>(null);
  const [progressAnswered, setProgressAnswered] = useState(false);
  const { showToast } = useToast();

  const allEpisodes = useMemo(
    () => card.seasons.flatMap((entry) => entry.episodes).map(({ item }) => item),
    [card.seasons],
  );
  const availableEpisodeIds = useMemo(
    () => new Set(card.seasons.flatMap((entry) => entry.episodes)
      .filter(({ file }) => file?.available)
      .map(({ item }) => item.id)),
    [card.seasons],
  );

  useEffect(() => {
    void getSeriesViewingState(card.series.id).then((state) => {
      setLastWatchedEpisodeId(state?.lastWatchedEpisodeId ?? "");
      setProgressAnswered(Boolean(state));
      const remembered = allEpisodes.find((episode) => episode.id === state?.lastWatchedEpisodeId);
      if (remembered?.seasonNumber != null) setProgressSeasonNumber(remembered.seasonNumber);
    });
  }, [allEpisodes, card.series.id]);

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

  const nextEpisode = allEpisodes.find(
    (episode) =>
      availableEpisodeIds.has(episode.id) &&
      progressByItemId[episode.id]?.started &&
      !progressByItemId[episode.id]?.watched,
  ) ?? allEpisodes.find(
    (episode) =>
      availableEpisodeIds.has(episode.id) &&
      !progressByItemId[episode.id]?.watched &&
      episode.id !== lastWatchedEpisodeId,
  );

  async function markLastWatched() {
    const episode = allEpisodes.find((item) => item.id === lastWatchedEpisodeId);
    if (!episode) return;
    await setSeriesLastWatchedEpisode(card.series.id, episode, allEpisodes);
    setViewingMessage(
      `Marked through S${String(episode.seasonNumber ?? 0).padStart(2, "0")}E${String(episode.episodeNumber ?? 0).padStart(2, "0")}.`,
    );
    showToast("Series progress saved. Continue Watching will use the next episode.", "success");
    setProgressAnswered(true);
    onProgressChanged?.();
  }

  async function markNotWatched() {
    await setSeriesNotWatched(card.series.id, allEpisodes);
    setLastWatchedEpisodeId("");
    setViewingMessage("This series is marked as not watched.");
    showToast("Series marked as not watched.", "success");
    setProgressAnswered(true);
    onProgressChanged?.();
  }

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
            {(card.series.logoArtworkId || card.series.remoteLogoUrl || season?.episodes[0]?.item.logoArtworkId || season?.episodes[0]?.item.remoteLogoUrl) ? (
              <ArtworkImage
                className="series-hub-logo"
                artworkId={card.series.logoArtworkId ?? season?.episodes[0]?.item.logoArtworkId ?? null}
                remoteUrl={card.series.remoteLogoUrl ?? season?.episodes[0]?.item.remoteLogoUrl ?? null}
                label={card.series.title}
                fit="contain"
                position="left center"
              />
            ) : (
              <h2>{card.series.title}</h2>
            )}

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

            <div className="series-hub-actions">
              {nextEpisode && (
                <button className="primary-button" onClick={() => onPlay(nextEpisode)}>
                  Continue with S{String(nextEpisode.seasonNumber ?? 0).padStart(2, "0")}E{String(nextEpisode.episodeNumber ?? 0).padStart(2, "0")}
                </button>
              )}
              <button className="secondary-button" onClick={() => setSeasonNumber(nextEpisode?.seasonNumber ?? firstSeason)}>
                Browse episodes
              </button>
            </div>
          </div>
        </div>

        <div className="series-hub-body">
          {!progressAnswered && <div className="series-viewing-panel">
            <div>
              <p className="eyebrow">YOUR PROGRESS</p>
              <strong>Where did you stop watching?</strong>
              <p>Use this if StreamLocal has no playback record for the series.</p>
            </div>
            <div className="series-viewing-controls">
              <select
                aria-label="Last watched season"
                value={progressSeasonNumber}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setProgressSeasonNumber(value);
                  const firstEpisode = allEpisodes.find((episode) => episode.seasonNumber === value);
                  setLastWatchedEpisodeId(firstEpisode?.id ?? "");
                }}
              >
                {card.seasons.map((seasonEntry) => (
                  <option key={seasonEntry.seasonNumber} value={seasonEntry.seasonNumber}>Season {seasonEntry.seasonNumber}</option>
                ))}
              </select>
              <select
                aria-label="Last watched episode"
                value={lastWatchedEpisodeId}
                onChange={(event) => setLastWatchedEpisodeId(event.target.value)}
              >
                <option value="">Select episode</option>
                {allEpisodes.filter((episode) => episode.seasonNumber === progressSeasonNumber).map((episode) => (
                  <option key={episode.id} value={episode.id}>
                    S{String(episode.seasonNumber ?? 0).padStart(2, "0")}E{String(episode.episodeNumber ?? 0).padStart(2, "0")} · {episode.episodeTitle || episode.title}
                  </option>
                ))}
              </select>
              <button className="secondary-button" disabled={!lastWatchedEpisodeId} onClick={() => void markLastWatched()}>
                Save last episode
              </button>
              <button className="text-button" onClick={() => void markNotWatched()}>
                I haven’t watched this series
              </button>
            </div>
            {viewingMessage && <span className="series-viewing-message">{viewingMessage}</span>}
          </div>}

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
