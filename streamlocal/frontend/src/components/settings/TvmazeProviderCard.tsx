import { useState } from "react";
import {
  syncSeriesPostersFromTvmaze,
  type TvmazePosterSyncResult,
} from "../../services/tvmazeProvider";

type Props = {
  onUpdated?: () => void;
};

export function TvmazeProviderCard({ onUpdated }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TvmazePosterSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const next = await syncSeriesPostersFromTvmaze();
      setResult(next);
      onUpdated?.();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "TVmaze poster sync failed.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="settings-card">
      <p className="eyebrow">OPTIONAL ONLINE METADATA</p>
      <h2>TVmaze series posters</h2>
      <p>
        TVmaze's public API does not require an account or API key. StreamLocal
        sends a series title only when you press the button below. Exact title
        matches can add a remote series poster and fill missing year, genres and
        overview fields.
      </p>

      <button
        className="primary-button"
        onClick={sync}
        disabled={running}
      >
        {running ? "Checking TVmaze..." : "Find series posters with TVmaze"}
      </button>

      {result && (
        <div className="scan-summary">
          Checked {result.checked} · Matched {result.matched} · Updated{" "}
          {result.updated} · No exact match {result.skipped} · Failed{" "}
          {result.failed}
        </div>
      )}

      {error && <div className="library-error">{error}</div>}

      <p className="vault-security-note">
        Series metadata and images provided by TVmaze under its API terms.
        StreamLocal does not send your video files or local paths.
      </p>
    </section>
  );
}
