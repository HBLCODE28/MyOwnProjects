import { useState } from "react";
import {
  syncMoviePosters,
  type MoviePosterSyncResult,
} from "../../services/moviePosterProvider";

export function MoviePosterProviderCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] =
    useState<MoviePosterSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      setResult(await syncMoviePosters());
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Movie poster lookup failed.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="settings-card">
      <p className="eyebrow">MOVIE ARTWORK</p>
      <h2>Find movie posters</h2>

      <p>
        StreamLocal first checks The Movie Posters Database / Preservation
        Network public search, then falls back to Wikipedia. No StreamLocal
        account or API key is required for the basic search.
      </p>

      <button
        className="primary-button"
        onClick={sync}
        disabled={running}
      >
        {running ? "Finding posters..." : "Find movie posters"}
      </button>

      {result && (
        <div className="scan-summary">
          Checked {result.checked} · Poster DB saved{" "}
          {result.preservationSaved} · Wikipedia saved{" "}
          {result.wikipediaSaved} · Commons saved {result.commonsSaved} · No poster {result.noPoster} · Failed {result.failed}
        </div>
      )}

      {error && <div className="library-error">{error}</div>}

      <p className="vault-security-note">
        Only movie title/year are used for poster matching. Local artwork
        remains higher priority.
      </p>
    </section>
  );
}
