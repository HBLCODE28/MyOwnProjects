import { useState } from "react";
import {
  syncMovieArtworkFromWikipedia,
  type WikipediaMovieSyncResult,
} from "../../services/wikipediaMovieProvider";

export function WikipediaMovieProviderCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] =
    useState<WikipediaMovieSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      setResult(await syncMovieArtworkFromWikipedia());
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Wikipedia movie artwork lookup failed.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="settings-card">
      <p className="eyebrow">OPTIONAL MOVIE ARTWORK</p>
      <h2>Wikipedia movie posters</h2>

      <p>
        No account or API key is required. StreamLocal sends only the movie
        title and year when you press the button.
      </p>

      <button
        className="primary-button"
        onClick={sync}
        disabled={running}
      >
        {running
          ? "Checking Wikipedia..."
          : "Find movie posters with Wikipedia"}
      </button>

      {result && (
        <div className="scan-summary">
          Checked {result.checked} · Matched pages {result.matched} · Posters
          saved {result.updated} · Matching page without image {result.noImage} ·
          No page {result.skipped} · Failed {result.failed}
        </div>
      )}

      {error && <div className="library-error">{error}</div>}

      <p className="vault-security-note">
        "Matched pages" is not counted as a poster update unless an actual image
        URL was received and saved.
      </p>
    </section>
  );
}
