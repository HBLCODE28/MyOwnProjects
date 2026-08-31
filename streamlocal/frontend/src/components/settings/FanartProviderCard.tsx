import { useState } from "react";
import { syncAllArtwork, type AllArtworkSyncResult } from "../../services/fanartProvider";

export function FanartProviderCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AllArtworkSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      setResult(await syncAllArtwork());
    } catch (value) {
      setError(value instanceof Error ? value.message : "Artwork lookup failed.");
    } finally {
      setRunning(false);
    }
  }

  const summary = result ? {
    posters:
      result.tvmaze.postersSaved +
      result.fanart.postersSaved +
      result.movies.preservationSaved +
      result.movies.wikipediaSaved +
      result.movies.commonsSaved,
    backdrops: result.tvmaze.backdropsSaved + result.fanart.backdropsSaved,
    logos: result.tvmaze.logosSaved + result.fanart.logosSaved + result.logos.updated,
    episodeStills: result.tvmaze.episodeStillsSaved,
    rejectedLogos: result.fanart.rejectedLogos + result.logos.rejected,
    missing: result.fanart.missingArtwork + result.movies.noPoster + result.logos.noLogo,
    failed: result.tvmaze.failed + result.fanart.failed + result.movies.failed + result.logos.failed,
  } : null;

  return (
    <section className="settings-card artwork-provider-card">
      <p className="eyebrow">ARTWORK</p>
      <h2>Find all artwork</h2>
      <p>
        Runs the full poster, backdrop, episode-still and title-logo pipeline. TVmaze provides
        episode images when available. Fanart.tv is used
        when its encrypted key is available, with public fallbacks where appropriate.
        Logo candidates are checked before they are accepted.
      </p>
      <div className="artwork-sync-action">
        <button className="primary-button" onClick={() => void sync()} disabled={running}>
          {running ? "Finding artwork..." : "Find all artwork"}
        </button>
        {running && (
          <span className="artwork-sync-process">
            Checking TVmaze episodes, posters, backdrops, and logos.
          </span>
        )}
      </div>

      {summary && result && (
        <div className="artwork-scan-report">
          <div><strong>{summary.posters}</strong><span>Posters saved</span></div>
          <div><strong>{summary.backdrops}</strong><span>Backdrops saved</span></div>
          <div><strong>{summary.logos}</strong><span>Valid logos</span></div>
          <div><strong>{summary.episodeStills}</strong><span>Episode stills</span></div>
          <div><strong>{summary.rejectedLogos}</strong><span>Rejected logos</span></div>
          <div><strong>{summary.missing}</strong><span>Missing artwork</span></div>
          <div><strong>{summary.failed}</strong><span>Provider failures</span></div>
          {result.fanart.missingKey && (
            <p className="artwork-key-state">
              Fanart.tv was skipped: {result.fanart.keyProblem ?? "No key is available on this origin."}
              {" "}Public artwork fallbacks still ran.
            </p>
          )}
        </div>
      )}

      {error && <div className="library-error">{error}</div>}
      <p className="vault-security-note">
        This lookup sends only title/year identifiers. Original media files are never uploaded or modified.
      </p>
    </section>
  );
}
