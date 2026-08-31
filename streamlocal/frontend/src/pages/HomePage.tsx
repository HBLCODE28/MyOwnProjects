import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BrowseRail } from "../components/browse/BrowseRail";
import { HeroRail } from "../components/browse/HeroRail";
import { MediaCard } from "../components/browse/MediaCard";
import { SeriesCard } from "../components/browse/SeriesCard";
import { SeriesHubOverlay } from "../components/browse/SeriesHubOverlay";
import { PlayerOverlay } from "../components/player/PlayerOverlay";
import type { MediaItem } from "../types/library";
import {
  groupMoviesByGenre,
  groupSeriesByGenre,
  type SeriesCard as SeriesCardModel,
} from "../services/browseSelectors";
import {
  loadBrowseData,
  type BrowseData,
} from "../services/browseData";
import { PLAYBACK_HISTORY_UPDATED_EVENT } from "../services/externalPlaybackHistory";
import "../styles/browse.css";
import { useToast } from "../components/ui/Toast";

const HOME_RAIL_LIMIT = 14;
const HOME_GENRE_RAILS = 4;

export function HomePage() {
  const [data, setData] = useState<BrowseData | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] =
    useState<string | null>(null);
  const [playing, setPlaying] = useState<MediaItem | null>(null);
  const { showToast } = useToast();

  async function refresh() {
    setData(await loadBrowseData());
  }

  useEffect(() => {
    void refresh();
    const onExternalHistoryUpdated = () => { void refresh(); };
    window.addEventListener(PLAYBACK_HISTORY_UPDATED_EVENT, onExternalHistoryUpdated);
    return () => window.removeEventListener(PLAYBACK_HISTORY_UPDATED_EVENT, onExternalHistoryUpdated);
  }, []);

  const homeRows = useMemo(() => {
    if (!data) return null;

    const recentMovies = [...data.movies]
      .sort((a, b) => b.item.createdAt - a.item.createdAt)
      .slice(0, HOME_RAIL_LIMIT);
    const recentSeries = [...data.series]
      .sort((a, b) => b.series.createdAt - a.series.createdAt)
      .slice(0, HOME_RAIL_LIMIT);

    const movieGenres = groupMoviesByGenre(data.movies)
      .slice(0, HOME_GENRE_RAILS);
    const seriesGenres = groupSeriesByGenre(data.series)
      .filter(({ cards }) => cards.length >= 2)
      .slice(0, HOME_GENRE_RAILS);

    return {
      recentMovies,
      recentSeries,
      movieGenres,
      seriesGenres,
    };
  }, [data]);

  if (!data || !homeRows) {
    return (
      <div className="page browse-page home-page">
        <div className="library-empty">Loading StreamLocal...</div>
      </div>
    );
  }

  const selectedSeries =
    data.series.find(
      (card) => card.series.id === selectedSeriesId,
    ) ?? null;

  function openSeries(card: SeriesCardModel) {
    setSelectedSeriesId(card.series.id);
  }

  function unavailable(entry: MediaItem) {
    showToast(`${entry.title} is unavailable. Reconnect its media folder in Library.`, "error");
  }

  return (
    <div className="page browse-page home-page">
      <HeroRail
        movies={data.movies}
        series={data.series}
        onOpenSeries={openSeries}
        onPlaySeries={setPlaying}
        onPlayMovie={setPlaying}
      />

      <div className="home-rails">
        {data.continueWatching.length > 0 && (
          <section className="browse-section home-rail-section home-first-rail">
            <div className="section-title-row">
              <div>
                <h2>Continue Watching</h2>
              </div>
            </div>

            <BrowseRail trackClassName="rail-grid home-media-rail" ariaLabel="Continue Watching">
              {data.continueWatching.map(
                ({ item, file, progress, reason, artworkId, remoteArtworkUrl }) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    file={file}
                    progress={progress}
                    label={item.type === "episode" ? "EPISODE" : "MOVIE"}
                    continueLabel={reason === "next_episode" ? "Next episode" : "Resume"}
                    artworkId={artworkId}
                    remoteArtworkUrl={remoteArtworkUrl}
                    onUnavailable={unavailable}
                    onPlay={setPlaying}
                  />
                ),
              )}
            </BrowseRail>
          </section>
        )}

        {homeRows.recentMovies.length > 0 && (
          <section className="browse-section home-rail-section">
            <div className="section-title-row">
              <div><h2>Recently Added Movies</h2></div>
              <Link className="secondary-button" to="/movies">View all</Link>
            </div>

            <BrowseRail trackClassName="rail-grid home-media-rail" ariaLabel="Recently Added Movies">
              {homeRows.recentMovies.map(({ item, file }) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  file={file}
                  label="MOVIE"
                  progress={data.progressByItemId[item.id]}
                  onPlay={setPlaying}
                  onUnavailable={unavailable}
                />
              ))}
            </BrowseRail>
          </section>
        )}

        {homeRows.recentSeries.length > 0 && (
          <section className="browse-section home-rail-section">
            <div className="section-title-row">
              <div><h2>Recently Added Series</h2></div>
              <Link className="secondary-button" to="/series">View all</Link>
            </div>

            <BrowseRail trackClassName="series-grid compact home-series-rail" ariaLabel="Recently Added Series">
              {homeRows.recentSeries.map((card) => (
                <SeriesCard key={card.series.id} card={card} onOpen={openSeries} />
              ))}
            </BrowseRail>
          </section>
        )}

        {homeRows.movieGenres.map(({ genre, cards }) => (
          <section className="browse-section home-rail-section" key={`movie-${genre}`}>
            <div className="section-title-row">
              <div><h2>{genre} Movies</h2></div>
            </div>
            <BrowseRail trackClassName="rail-grid home-media-rail" ariaLabel={`${genre} Movies`}>
              {cards.slice(0, HOME_RAIL_LIMIT).map(({ item, file }) => (
                <MediaCard
                  key={`${genre}-${item.id}`}
                  item={item}
                  file={file}
                  label="MOVIE"
                  progress={data.progressByItemId[item.id]}
                  onPlay={setPlaying}
                  onUnavailable={unavailable}
                />
              ))}
            </BrowseRail>
          </section>
        ))}

        {homeRows.seriesGenres.map(({ genre, cards }) => (
          <section className="browse-section home-rail-section" key={`series-${genre}`}>
            <div className="section-title-row">
              <div><h2>{genre} Series</h2></div>
            </div>
            <BrowseRail trackClassName="series-grid compact home-series-rail" ariaLabel={`${genre} Series`}>
              {cards.slice(0, HOME_RAIL_LIMIT).map((card) => (
                <SeriesCard key={`${genre}-${card.series.id}`} card={card} onOpen={openSeries} />
              ))}
            </BrowseRail>
          </section>
        ))}
      </div>

      {selectedSeries && !playing && (
        <SeriesHubOverlay
          card={selectedSeries}
          progressByItemId={data.progressByItemId}
          onClose={() => setSelectedSeriesId(null)}
          onPlay={setPlaying}
          onProgressChanged={() => void refresh()}
          onUnavailable={unavailable}
        />
      )}

      {playing && (
        <PlayerOverlay
          item={playing}
          onClose={() => setPlaying(null)}
          onProgressChanged={() => void refresh()}
        />
      )}
    </div>
  );
}
