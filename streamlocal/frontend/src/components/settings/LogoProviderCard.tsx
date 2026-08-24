import { useState } from "react";
import { syncWikimediaLogos, type LogoSyncResult } from "../../services/wikimediaLogoProvider";

export function LogoProviderCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<LogoSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setRunning(true); setResult(null); setError(null);
    try { setResult(await syncWikimediaLogos()); }
    catch (value) { setError(value instanceof Error ? value.message : "Logo search failed."); }
    finally { setRunning(false); }
  }

  return (
    <section className="settings-card">
      <p className="eyebrow">TITLE ARTWORK</p>
      <h2>Find series and movie logos</h2>
      <p>Uses Wikimedia Commons public images, including logos such as the Breaking Bad periodic-table title. No API key is required.</p>
      <button className="primary-button" onClick={() => void sync()} disabled={running}>
        {running ? "Finding logos..." : "Find logos"}
      </button>
      {result && <div className="scan-summary">Checked {result.checked} · Updated {result.updated} · No logo {result.noLogo} · Failed {result.failed}</div>}
      {error && <div className="library-error">{error}</div>}
    </section>
  );
}
