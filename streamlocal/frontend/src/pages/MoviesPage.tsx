import { useEffect, useMemo, useRef, useState } from "react";
import { HeroRail } from "../components/browse/HeroRail";
import { MediaCard } from "../components/browse/MediaCard";
import { PlayerOverlay } from "../components/player/PlayerOverlay";
import type { MediaItem } from "../types/library";
import { loadBrowseData, type BrowseData } from "../services/browseData";
import { filterMovies } from "../services/browseSelectors";
import "../styles/browse.css";
import { useToast } from "../components/ui/Toast";
import { syncWikimediaLogos } from "../services/wikimediaLogoProvider";
import { syncMoviePosters } from "../services/moviePosterProvider";

export function MoviesPage() {
  const [data, setData] = useState<BrowseData | null>(null);
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<MediaItem | null>(null);
  const { showToast } = useToast();
  const logoSyncStarted = useRef(false);
  const posterSyncStarted = useRef(false);

  async function refresh() {
    setData(await loadBrowseData());
  }

  useEffect(() => { void refresh(); }, []);

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

  const movies = useMemo(
    () => filterMovies(data?.movies ?? [], query),
    [data?.movies, query],
  );

  if (!data) {
    return <div className="page browse-page"><div className="library-empty">Loading movies...</div></div>;
  }

  return (
    <div className="page browse-page">
      <HeroRail movies={data.movies} series={[]} />

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
