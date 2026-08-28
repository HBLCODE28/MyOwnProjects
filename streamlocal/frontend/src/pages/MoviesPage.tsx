import { useEffect, useMemo, useState } from "react";
import { HeroRail } from "../components/browse/HeroRail";
import { BrowseRail } from "../components/browse/BrowseRail";
import { MediaCard } from "../components/browse/MediaCard";
import { PlayerOverlay } from "../components/player/PlayerOverlay";
import type { MediaItem } from "../types/library";
import { loadBrowseData, type BrowseData } from "../services/browseData";
import {
  filterMovies,
  groupMoviesByGenre,
  sortMovies,
  type BrowseSort,
} from "../services/browseSelectors";
import { PLAYBACK_HISTORY_UPDATED_EVENT } from "../services/externalPlaybackHistory";
import "../styles/browse.css";
import { useToast } from "../components/ui/Toast";

export function MoviesPage() {
  const [data, setData] = useState<BrowseData | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<BrowseSort>("name-asc");
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
    () => sortMovies(filterMovies(data?.movies ?? [], query), sort),
    [data?.movies, query, sort],
  );

  const genreGroups = useMemo(
    () => groupMoviesByGenre(movies).map((group) => ({
      ...group,
      cards: sortMovies(group.cards, sort),
    })),
    [movies, sort],
  );

  if (!data) {
    return <div className="page browse-page movies-page"><div className="library-empty">Loading movies...</div></div>;
  }

  return (
    <div className="page browse-page movies-page">
      <HeroRail movies={data.movies} series={[]} onPlayMovie={setPlaying} />

      <section className="browse-toolbar">
        <div className="browse-toolbar-heading">
          <p className="eyebrow">MOVIES</p>
          <h2>{movies.length} local movie{movies.length === 1 ? "" : "s"}</h2>
        </div>

        <div className="browse-toolbar-controls">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search movies, years, genres or filenames"
            aria-label="Search movies"
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as BrowseSort)}
            aria-label="Sort movies"
            title="Sort movies"
          >
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="added-newest">Added newest</option>
            <option value="added-oldest">Added oldest</option>
            <option value="year-newest">Release year newest</option>
            <option value="year-oldest">Release year oldest</option>
            <option value="updated-newest">Recently updated</option>
          </select>
        </div>
      </section>

      {movies.length === 0 ? (
        <div className="library-empty movies-empty">
          No movies found. Use Library and Identify first.
        </div>
      ) : (
        <div className="movie-genre-rails">
          {genreGroups.map(({ genre, cards }) => (
            <section className="browse-section movie-genre-section" key={genre}>
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">{cards.length} TITLE{cards.length === 1 ? "" : "S"}</p>
                  <h2>{genre}</h2>
                </div>
              </div>

              <BrowseRail
                trackClassName="rail-grid movie-rail-grid"
                ariaLabel={`${genre} movies`}
              >
                {cards.map(({ item, file }) => (
                  <MediaCard
                    key={`${genre}-${item.id}`}
                    item={item}
                    file={file}
                    label="MOVIE"
                    progress={data.progressByItemId[item.id]}
                    onPlay={setPlaying}
                    onUnavailable={(entry) => showToast(`${entry.title} is unavailable. Reconnect its media folder in Library.`, "error")}
                  />
                ))}
              </BrowseRail>
            </section>
          ))}
        </div>
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
