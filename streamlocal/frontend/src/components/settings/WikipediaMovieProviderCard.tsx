import { useState } from "react";
import {
  syncMovieArtworkFromWikipedia,
  type WikipediaMovieSyncResult,
} from "../../services/wikipediaMovieProvider";

export function WikipediaMovieProviderCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WikipediaMovieSyncResult | null>(null);
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
        No account or API key is required. StreamLocal sends only the movie title
        and year when you press the button. Wikipedia's lead image is used as a
        poster when a matching film page is found.
      </p>

      <button
        className="primary-button"
        onClick={sync}
        disabled={running}
      >
        {running ? "Checking Wikipedia..." : "Find movie posters with Wikipedia"}
      </button>

      {result && (
        <div className="scan-summary">
          Checked {result.checked} · Matched {result.matched} · Updated{" "}
          {result.updated} · No match {result.skipped} · Failed {result.failed}
        </div>
      )}

      {error && <div className="library-error">{error}</div>}

      <p className="vault-security-note">
        Availability depends on the image used by the matching Wikipedia article.
        Local artwork remains higher priority.
      </p>
    </section>
  );
}
