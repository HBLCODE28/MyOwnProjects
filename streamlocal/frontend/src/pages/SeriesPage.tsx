import { useEffect, useMemo, useState } from "react";
import { HeroRail } from "../components/browse/HeroRail";
import { SeriesCard } from "../components/browse/SeriesCard";
import { SeriesHubOverlay } from "../components/browse/SeriesHubOverlay";
import { PlayerOverlay } from "../components/player/PlayerOverlay";
import type { MediaItem } from "../types/library";
import {
  loadBrowseData,
  type BrowseData,
} from "../services/browseData";
import {
  filterSeries,
  type SeriesCard as SeriesCardModel,
} from "../services/browseSelectors";
import "../styles/browse.css";

export function SeriesPage() {
  const [data, setData] = useState<BrowseData | null>(null);
  const [query, setQuery] = useState("");
  const [selectedSeries, setSelectedSeries] =
    useState<SeriesCardModel | null>(null);
  const [playing, setPlaying] = useState<MediaItem | null>(null);

  useEffect(() => {
    loadBrowseData().then(setData);
  }, []);

  const series = useMemo(
    () => filterSeries(data?.series ?? [], query),
    [data?.series, query],
  );

  if (!data) {
    return (
      <div className="page browse-page">
        <div className="library-empty">Loading series...</div>
      </div>
    );
  }

  return (
    <div className="page browse-page">
      <HeroRail
        movies={data.movies}
        series={data.series}
        onOpenSeries={setSelectedSeries}
      />

      <section className="browse-toolbar">
        <div>
          <p className="eyebrow">SERIES</p>
          <h2>{series.length} local series</h2>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search series, seasons, episodes or filenames"
          aria-label="Search series"
        />
      </section>

      {series.length === 0 ? (
        <div className="library-empty">
          No series found. Use Library and Identify first.
        </div>
      ) : (
        <section className="series-grid">
          {series.map((card) => (
            <SeriesCard
              key={card.series.id}
              card={card}
              onOpen={setSelectedSeries}
            />
          ))}
        </section>
      )}

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
        />
      )}
    </div>
  );
}
