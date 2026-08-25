import { useState } from "react";
import { syncFanartArtwork, type FanartSyncResult } from "../../services/fanartProvider";

export function FanartProviderCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FanartSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setRunning(true); setResult(null); setError(null);
    try { setResult(await syncFanartArtwork()); }
    catch (value) { setError(value instanceof Error ? value.message : "Fanart artwork lookup failed."); }
    finally { setRunning(false); }
  }

  return (
    <section className="settings-card">
      <p className="eyebrow">RECOMMENDED ARTWORK</p>
      <h2>Find posters, backdrops and logos with Fanart.tv</h2>
      <p>
        Add your Fanart.tv API key to the encrypted vault above, then run this
        lookup. StreamLocal sends only title/year metadata and keeps the key
        encrypted in this browser.
      </p>
      <button className="primary-button" onClick={() => void sync()} disabled={running}>
        {running ? "Finding Fanart artwork..." : "Find Fanart artwork"}
      </button>
      {result && (
        <div className="scan-summary">
          {result.missingKey ? "Add and save the Fanart.tv API key in the encrypted vault first." :
            `Checked ${result.checked} · Matched ${result.matched} · Updated ${result.updated} · Skipped ${result.skipped} · Failed ${result.failed}`}
        </div>
      )}
      {error && <div className="library-error">{error}</div>}
      <p className="vault-security-note">
        Fanart.tv artwork is used only as a remote fallback; local artwork remains higher priority.
      </p>
    </section>
  );
}
