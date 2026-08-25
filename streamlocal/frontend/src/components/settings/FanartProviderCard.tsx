import { useState } from "react";
import { syncAllArtwork, type AllArtworkSyncResult } from "../../services/fanartProvider";

export function FanartProviderCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AllArtworkSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setRunning(true); setResult(null); setError(null);
    try { setResult(await syncAllArtwork()); }
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
        {result.fanart.missingKey ? `${result.fanart.keyProblem ?? "Fanart.tv API key is unavailable."} Save the Fanart.tv key in this same StreamLocal browser address, then unlock the vault.` :
            `Movies: ${result.movies.preservationSaved + result.movies.wikipediaSaved + result.movies.commonsSaved} saved · Logos: ${result.logos.updated} saved · Fanart: ${result.fanart.updated} saved · Failed: ${result.movies.failed + result.logos.failed + result.fanart.failed}`}
        </div>
      )}
      {error && <div className="library-error">{error}</div>}
      <p className="vault-security-note">
        Fanart.tv artwork is used only as a remote fallback; local artwork remains higher priority.
      </p>
    </section>
  );
}
