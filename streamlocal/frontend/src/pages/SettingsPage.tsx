import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiKeyVault } from "../components/settings/ApiKeyVault";
import { TvmazeProviderCard } from "../components/settings/TvmazeProviderCard";
import { MoviePosterProviderCard } from "../components/settings/MoviePosterProviderCard";
import { db, requestPersistentStorage } from "../db/streamlocalDb";
import {
  exportStreamLocalBackup,
  importStreamLocalBackup,
} from "../services/backup";
import {
  clearTimelinePreviewCache,
  clearUnreferencedArtwork,
  getCacheStats,
  getPlaybackSetting,
  setPlaybackSetting,
  type CacheStats,
} from "../services/maintenance";
import "../styles/settings.css";
import { useToast } from "../components/ui/Toast";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [seekInterval, setSeekInterval] = useState(5);
  const { showToast } = useToast();

  useEffect(() => {
    void getCacheStats().then(setCacheStats);
    void getPlaybackSetting("playback.seekInterval", 5).then(setSeekInterval);
  }, []);

  async function exportBackup() {
    try {
      const blob = await exportStreamLocalBackup();
      downloadBlob(blob, `StreamLocal-Backup-${new Date().toISOString().slice(0, 10)}.zip`);
      setStatus("Backup exported.");
      showToast("Backup exported successfully.", "success");
    } catch (value) {
      showToast(value instanceof Error ? value.message : "Backup export failed.", "error");
    }
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      await importStreamLocalBackup(file);
      setStatus("Backup imported. Select the original media folder in Library to reconnect it.");
      showToast("Backup imported. Your media is safe; reconnect the original folder in Library.", "success");
    } catch (value) {
      const message = value instanceof Error ? value.message : "Backup import failed.";
      setStatus(message);
      showToast(message, "error");
    }
  }

  async function persistence() {
    const granted = await requestPersistentStorage();

    const message =
      granted
        ? "Browser storage is protected. StreamLocal data is stored locally in IndexedDB and the browser marked it as persistent."
        : "Browser storage is active. StreamLocal data is stored locally in IndexedDB, but the browser did not mark it as protected from automatic cleanup. Use Export Library for important backups.";
    setStatus(message);
    showToast(message, granted ? "success" : "info");
  }

  async function clearLibrary() {
    if (
      !window.confirm(
        "Clear the StreamLocal browser database on this computer? Video files are not touched.",
      )
    ) {
      return;
    }

    await db.transaction(
      "rw",
      [
        db.librarySources,
        db.mediaFiles,
        db.mediaItems,
        db.series,
        db.artwork,
        db.settings,
        db.playbackProgress,
        db.timelinePreviews,
        db.mediaSegments,
      ],
      async () => {
        await Promise.all([
          db.librarySources.clear(),
          db.mediaFiles.clear(),
          db.mediaItems.clear(),
          db.series.clear(),
          db.artwork.clear(),
          db.settings.clear(),
          db.playbackProgress.clear(),
          db.timelinePreviews.clear(),
          db.mediaSegments.clear(),
        ]);
      },
    );

    setStatus("Local StreamLocal database cleared.");
    showToast("Local StreamLocal data cleared. Source video files were not touched.", "success");
  }

  async function refreshMaintenance() {
    setCacheStats(await getCacheStats());
  }

  async function saveSeekInterval(value: number) {
    setSeekInterval(value);
    await setPlaybackSetting("playback.seekInterval", value);
    setStatus("Playback seek interval saved.");
    showToast("Playback seek interval saved.", "success");
  }

  async function clearTimelineCache() {
    const count = await clearTimelinePreviewCache();
    await refreshMaintenance();
    setStatus(`Cleared ${count} timeline preview${count === 1 ? "" : "s"}.`);
    showToast(`Cleared ${count} timeline preview${count === 1 ? "" : "s"}.`, "success");
  }

  async function clearArtworkCache() {
    const count = await clearUnreferencedArtwork();
    await refreshMaintenance();
    setStatus(`Cleared ${count} unreferenced artwork record${count === 1 ? "" : "s"}.`);
    showToast(`Cleared ${count} unreferenced artwork record${count === 1 ? "" : "s"}.`, "success");
  }

  return (
    <div className="page settings-page">
      <p className="eyebrow">LOCAL DATA</p>
      <h1>Settings</h1>

      <p className="settings-intro">
        StreamLocal keeps your library local. Optional online artwork is used
        only when you explicitly request it.
      </p>

      {status && <div className="scan-summary">{status}</div>}

      <TvmazeProviderCard />
      <MoviePosterProviderCard />
      <ApiKeyVault />

      <section className="settings-card">
        <h2>Browser storage</h2>
        <p>
          IndexedDB still works even when the browser does not grant protected
          persistence.
        </p>
        <button className="secondary-button" onClick={persistence}>
          Check persistent storage
        </button>
      </section>

      <section className="settings-card">
        <h2>Playback and cache</h2>
        <label className="settings-field">
          Seek interval
          <select value={seekInterval} onChange={(event) => void saveSeekInterval(Number(event.target.value))}>
            <option value={5}>5 seconds</option>
            <option value={10}>10 seconds</option>
            <option value={15}>15 seconds</option>
            <option value={30}>30 seconds</option>
          </select>
        </label>
        {cacheStats && (
          <p className="vault-security-note">
            Timeline previews: {cacheStats.timelinePreviews} · Artwork: {cacheStats.artwork} ({(cacheStats.artworkBytes / 1024).toFixed(0)} KB)
          </p>
        )}
        <div className="settings-actions">
          <button className="secondary-button" onClick={() => void clearTimelineCache()}>Clear timeline cache</button>
          <button className="secondary-button" onClick={() => void clearArtworkCache()}>Clear unused artwork</button>
        </div>
      </section>

      <section className="settings-card">
        <h2>Move to another computer</h2>
        <div className="settings-actions">
          <button className="primary-button" onClick={exportBackup}>
            Export library
          </button>

          <label className="secondary-button file-button">
            Import library
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(event) =>
                importBackup(event.target.files?.[0])
              }
            />
          </label>
        </div>
        <p className="vault-security-note">
          A ZIP backup contains StreamLocal metadata and artwork, not the original video files.
          After import, reconnect the original media folder here:
          {" "}<Link to="/library">Open Library reconnect</Link>
        </p>
      </section>

      <section className="settings-card danger-zone">
        <h2>Clear local database</h2>
        <button className="danger-button" onClick={clearLibrary}>
          Clear StreamLocal data
        </button>
      </section>
    </div>
  );
}
