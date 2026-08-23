import { useEffect, useMemo, useState } from "react";
import { HeroRail } from "../components/browse/HeroRail";
import { MediaCard } from "../components/browse/MediaCard";
import { loadBrowseData, type BrowseData } from "../services/browseData";
import { filterMovies } from "../services/browseSelectors";
import "../styles/browse.css";

export function MoviesPage() {
  const [data, setData] = useState<BrowseData | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadBrowseData().then(setData);
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
      <HeroRail movies={data.movies} series={data.series} />

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

      {movies.length === 0 ? (
        <div className="library-empty">No movies found. Use Library and Identify first.</div>
      ) : (
        <section className="poster-grid">
          {movies.map(({ item, file }) => (
            <MediaCard key={item.id} item={item} file={file} label="MOVIE" />
          ))}
        </section>
      )}
    </div>
  );
}
