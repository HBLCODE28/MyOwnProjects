import { useEffect, useMemo, useState } from "react";
import { HeroRail } from "../components/browse/HeroRail";
import { MediaCard } from "../components/browse/MediaCard";
import { PlayerOverlay } from "../components/player/PlayerOverlay";
import type { MediaItem } from "../types/library";
import { loadBrowseData, type BrowseData } from "../services/browseData";
import { filterMovies } from "../services/browseSelectors";
import { PLAYBACK_HISTORY_UPDATED_EVENT } from "../services/externalPlaybackHistory";
import "../styles/browse.css";
import { useToast } from "../components/ui/Toast";

export function MoviesPage() {
  const [data, setData] = useState<BrowseData | null>(null);
  const [query, setQuery] = useState("");
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

  const movies = useMemo(
    () => filterMovies(data?.movies ?? [], query),
    [data?.movies, query],
  );

  if (!data) {
    return <div className="page browse-page"><div className="library-empty">Loading movies...</div></div>;
  }

  return (
    <div className="page browse-page">
      <HeroRail movies={data.movies} series={[]} onPlayMovie={setPlaying} />

      <section className="browse-toolbar">
        <div>
          <p className="eyebrow">MOVIES</p>
          <h2>{movies.length} local movie{movies.length === 1 ? "" : "s"}</h2>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search movies, years, genres or filenames"
          aria-label="Search movies"
        />
      </section>

      <section className="poster-grid">
        {movies.map(({ item, file }) => (
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
      </section>

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
