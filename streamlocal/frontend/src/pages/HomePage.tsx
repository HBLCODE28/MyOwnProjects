import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HeroRail } from "../components/browse/HeroRail";
import { MediaCard } from "../components/browse/MediaCard";
import { SeriesCard } from "../components/browse/SeriesCard";
import { SeriesHubOverlay } from "../components/browse/SeriesHubOverlay";
import { PlayerOverlay } from "../components/player/PlayerOverlay";
import type { MediaItem } from "../types/library";
import type { SeriesCard as SeriesCardModel } from "../services/browseSelectors";
import { loadBrowseData, type BrowseData } from "../services/browseData";
import "../styles/browse.css";

export function HomePage() {
  const [data, setData] = useState<BrowseData | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<SeriesCardModel | null>(null);
  const [playing, setPlaying] = useState<MediaItem | null>(null);

  async function refresh() {
    setData(await loadBrowseData());
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (!data) {
    return <div className="page browse-page"><div className="library-empty">Loading StreamLocal...</div></div>;
  }

  const latestMovies = data.movies.slice(0, 10);
  const latestSeries = data.series.slice(0, 8);

  return (
    <div className="page browse-page">
      <HeroRail
        movies={data.movies}
        series={data.series}
        onOpenSeries={setSelectedSeries}
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
            {data.continueWatching.map(({ item, file, progress }) => (
              <MediaCard
                key={item.id}
                item={item}
                file={file}
                progress={progress}
                onPlay={setPlaying}
              />
            ))}
          </div>
        </section>
      )}

      <section className="browse-metrics">
        <div><strong>{data.counts.movies}</strong><span>movies</span></div>
        <div><strong>{data.counts.episodes}</strong><span>episodes</span></div>
        <div><strong>{data.counts.availableItems}</strong><span>available</span></div>
        <div><strong>{data.counts.needsMatch}</strong><span>needs match</span></div>
      </section>

      <section className="browse-section">
        <div className="section-title-row">
          <div><p className="eyebrow">LOCAL MOVIES</p><h2>Movies</h2></div>
          <Link className="secondary-button" to="/movies">View all</Link>
        </div>

        {latestMovies.length === 0 ? (
          <div className="library-empty">Add and identify local movies to fill this row.</div>
        ) : (
          <div className="rail-grid">
            {latestMovies.map(({ item, file }) => (
              <MediaCard
                key={item.id}
                item={item}
                file={file}
                label="MOVIE"
                progress={data.progressByItemId[item.id]}
                onPlay={setPlaying}
              />
            ))}
          </div>
        )}
      </section>

      <section className="browse-section">
        <div className="section-title-row">
          <div><p className="eyebrow">LOCAL SERIES</p><h2>Series</h2></div>
          <Link className="secondary-button" to="/series">View all</Link>
        </div>

        <div className="series-grid compact">
          {latestSeries.map((card) => (
            <SeriesCard
              key={card.series.id}
              card={card}
              onOpen={setSelectedSeries}
            />
          ))}
        </div>
      </section>

      {selectedSeries && !playing && (
        <SeriesHubOverlay
          card={selectedSeries}
          onClose={() => setSelectedSeries(null)}
          onPlay={setPlaying}
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
