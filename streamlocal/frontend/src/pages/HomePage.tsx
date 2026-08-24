import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { HeroRail } from "../components/browse/HeroRail";
import { MediaCard } from "../components/browse/MediaCard";
import { SeriesCard } from "../components/browse/SeriesCard";
import { SeriesHubOverlay } from "../components/browse/SeriesHubOverlay";
import { PlayerOverlay } from "../components/player/PlayerOverlay";
import type { MediaItem } from "../types/library";
import type { SeriesCard as SeriesCardModel } from "../services/browseSelectors";
import {
  loadBrowseData,
  type BrowseData,
} from "../services/browseData";
import "../styles/browse.css";
import { useToast } from "../components/ui/Toast";
import { syncWikimediaLogos } from "../services/wikimediaLogoProvider";
import { syncMoviePosters } from "../services/moviePosterProvider";

export function HomePage() {
  const [data, setData] = useState<BrowseData | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] =
    useState<string | null>(null);
  const [playing, setPlaying] = useState<MediaItem | null>(null);
  const { showToast } = useToast();
  const logoSyncStarted = useRef(false);
  const posterSyncStarted = useRef(false);

  async function refresh() {
    setData(await loadBrowseData());
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!data || logoSyncStarted.current) return;
    logoSyncStarted.current = true;
    void syncWikimediaLogos().then((result) => {
      if (result.updated > 0) void refresh();
    }).catch(() => undefined);
  }, [data]);

  useEffect(() => {
    if (!data || posterSyncStarted.current) return;
    posterSyncStarted.current = true;
    void syncMoviePosters().then((result) => {
      if (result.preservationSaved + result.wikipediaSaved + result.commonsSaved > 0) void refresh();
    }).catch(() => undefined);
  }, [data]);

  if (!data) {
    return (
      <div className="page browse-page">
        <div className="library-empty">Loading StreamLocal...</div>
      </div>
    );
  }

  const latestMovies = data.movies.slice(0, 10);
  const latestSeries = data.series.slice(0, 8);
  const selectedSeries =
    data.series.find(
      (card) => card.series.id === selectedSeriesId,
    ) ?? null;

  function openSeries(card: SeriesCardModel) {
    setSelectedSeriesId(card.series.id);
  }

  return (
    <div className="page browse-page">
      <HeroRail
        movies={data.movies}
        series={data.series}
        onOpenSeries={openSeries}
      />

      {data.continueWatching.length > 0 && (
        <section className="browse-section">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">RESUME</p>
              <h2>Continue Watching</h2>
            </div>
          </div>

          <div className="rail-grid">
            {data.continueWatching.map(
              ({ item, file, progress, reason }) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  file={file}
                  progress={progress}
                  label={item.type === "episode" ? "EPISODE" : "MOVIE"}
                  continueLabel={reason === "next_episode" ? "Next episode" : "Resume"}
                  onUnavailable={(entry) => showToast(`${entry.title} is unavailable. Reconnect its media folder in Library.`, "error")}
                  onPlay={setPlaying}
                />
              ),
            )}
          </div>
        </section>
      )}

      <section className="browse-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">LOCAL MOVIES</p>
            <h2>Movies</h2>
          </div>
          <Link className="secondary-button" to="/movies">
            View all
          </Link>
        </div>

        <div className="rail-grid">
          {latestMovies.map(({ item, file }) => (
            <MediaCard
              key={item.id}
              item={item}
              file={file}
              label="MOVIE"
              progress={data.progressByItemId[item.id]}
              onPlay={setPlaying}
              onUnavailable={(entry) => showToast(`${entry.title} is unavailable. Reconnect its media folder in Library.`, "error")}
            />
          ))}
        </div>
      </section>

      <section className="browse-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">LOCAL SERIES</p>
            <h2>Series</h2>
          </div>
          <Link className="secondary-button" to="/series">
            View all
          </Link>
        </div>

        <div className="series-grid compact">
          {latestSeries.map((card) => (
            <SeriesCard
              key={card.series.id}
              card={card}
              onOpen={openSeries}
            />
          ))}
        </div>
      </section>

      {selectedSeries && !playing && (
        <SeriesHubOverlay
          card={selectedSeries}
          progressByItemId={data.progressByItemId}
          onClose={() => setSelectedSeriesId(null)}
          onPlay={setPlaying}
          onProgressChanged={() => void refresh()}
          onUnavailable={(entry) => showToast(`${entry.title} is unavailable. Reconnect its media folder in Library.`, "error")}
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
