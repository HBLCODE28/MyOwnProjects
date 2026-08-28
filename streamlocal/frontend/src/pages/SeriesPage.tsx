import { useEffect, useMemo, useState } from "react";
import { HeroRail } from "../components/browse/HeroRail";
import { BrowseRail } from "../components/browse/BrowseRail";
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
  groupSeriesByGenre,
  type SeriesCard as SeriesCardModel,
} from "../services/browseSelectors";
import { PLAYBACK_HISTORY_UPDATED_EVENT } from "../services/externalPlaybackHistory";
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
    const onExternalHistoryUpdated = () => { void refresh(); };
    window.addEventListener(PLAYBACK_HISTORY_UPDATED_EVENT, onExternalHistoryUpdated);
    return () => window.removeEventListener(PLAYBACK_HISTORY_UPDATED_EVENT, onExternalHistoryUpdated);
  }, []);

  const series = useMemo(
    () => filterSeries(data?.series ?? [], query),
    [data?.series, query],
  );

  const genreGroups = useMemo(
    () => groupSeriesByGenre(series),
    [series],
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
        <div className="series-genre-rails">
          {genreGroups.map(({ genre, cards }) => (
            <section className="browse-section" key={genre}>
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">{cards.length} TITLE{cards.length === 1 ? "" : "S"}</p>
                  <h2>{genre}</h2>
                </div>
              </div>

              <BrowseRail
                trackClassName="series-grid compact"
                ariaLabel={`${genre} series`}
              >
                {cards.map((card) => (
                  <SeriesCard
                    key={`${genre}-${card.series.id}`}
                    card={card}
                    onOpen={openSeries}
                  />
                ))}
              </BrowseRail>
            </section>
          ))}
        </div>
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
