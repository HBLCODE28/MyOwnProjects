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
import { useToast } from "../components/ui/Toast";

export function SeriesPage() {
  const [data, setData] = useState<BrowseData | null>(null);
  const [query, setQuery] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] =
    useState<string | null>(null);
  const [playing, setPlaying] = useState<MediaItem | null>(null);
  const { showToast } = useToast();

  async function refresh() {
    setData(await loadBrowseData());
  }

  useEffect(() => {
    void refresh();
  }, []);

  const series = useMemo(
    () => filterSeries(data?.series ?? [], query),
    [data?.series, query],
  );

  const selectedSeries =
    data?.series.find(
      (card) => card.series.id === selectedSeriesId,
    ) ?? null;

  function openSeries(card: SeriesCardModel) {
    setSelectedSeriesId(card.series.id);
  }

  function nextEpisodeAfter(item: MediaItem): MediaItem | null {
    const card = data?.series.find((candidate) => candidate.series.id === item.seriesId);
    if (!card) return null;
    const episodes = card.seasons
      .flatMap((season) => season.episodes)
      .filter(({ file }) => file?.available)
      .map(({ item: episode }) => episode);
    const index = episodes.findIndex((episode) => episode.id === item.id);
    return index >= 0 ? episodes[index + 1] ?? null : null;
  }

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
        onOpenSeries={openSeries}
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
              onOpen={openSeries}
            />
          ))}
        </section>
      )}

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
          onNextEpisode={() => {
            const next = nextEpisodeAfter(playing);
            if (next) setPlaying(next);
          }}
        />
      )}
    </div>
  );
}
