import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiKeyVault } from "../components/settings/ApiKeyVault";
import { TvmazeProviderCard } from "../components/settings/TvmazeProviderCard";
import { FanartProviderCard } from "../components/settings/FanartProviderCard";
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
import {
  connectExternalHistoryBridge,
  connectVlcHistory,
  externalHistoryConnectionState,
  syncConnectedExternalHistories,
  type ExternalHistoryImportReport,
} from "../services/externalPlaybackHistory";

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
  const [externalConnections, setExternalConnections] = useState({ bridge: false, vlc: false, windowsMediaPlayer: false });
  const [externalReports, setExternalReports] = useState<ExternalHistoryImportReport[]>([]);
  const [externalSyncBusy, setExternalSyncBusy] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    void getCacheStats().then(setCacheStats);
    void getPlaybackSetting("playback.seekInterval", 5).then(setSeekInterval);
    void externalHistoryConnectionState().then(setExternalConnections);
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


  async function runExternalHistoryAction(action: () => Promise<ExternalHistoryImportReport | ExternalHistoryImportReport[]>) {
    setExternalSyncBusy(true);
    try {
      const result = await action();
      const reports = Array.isArray(result) ? result : [result];
      if (reports.length > 0) {
        setExternalReports(reports);
        setStatus(reports.map((report) => report.message).join(" "));
        showToast(reports.map((report) => report.message).join(" "), "success");
      } else {
        setStatus("External player history is already up to date.");
        showToast("External player history is already up to date.", "info");
      }
      setExternalConnections(await externalHistoryConnectionState());
    } catch (value) {
      if (value instanceof DOMException && value.name === "AbortError") return;
      const message = value instanceof Error ? value.message : "External player history sync failed.";
      setStatus(message);
      showToast(message, "error");
    } finally {
      setExternalSyncBusy(false);
    }
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
      <FanartProviderCard />
      <ApiKeyVault />


      <section className="settings-card external-history-card">
        <h2>External player history</h2>
        <p>
          Chromium blocks direct access to protected AppData files used by VLC and Windows Media Player.
          StreamLocal therefore uses a read-only local bridge: a small Windows helper mirrors only the history files into your Documents folder, and the browser reads that safe copy. Original player files and video files are never modified.
        </p>

        <div className="history-bridge-steps">
          <div>
            <strong>1. Start the history bridge</strong>
            <p className="vault-security-note">
              From the StreamLocal project folder, double-click <code>scripts\start-player-history-bridge.cmd</code>, or run:
            </p>
            <code className="history-command">powershell -ExecutionPolicy Bypass -File .\scripts\player-history-bridge.ps1</code>
            <p className="vault-security-note">
              Keep the helper window open while you want VLC or Windows Media Player activity mirrored. It refreshes the safe copy and checks the Windows playback timeline every 5 seconds.
            </p>
          </div>
          <div>
            <strong>2. Connect the safe bridge folder</strong>
            <p className="vault-security-note">
              Select <code>Documents\StreamLocal\ExternalPlayerHistory</code>. This folder is not a protected system location, so Chrome can remember read permission.
            </p>
            <button
              className="secondary-button"
              disabled={externalSyncBusy}
              onClick={() => void runExternalHistoryAction(connectExternalHistoryBridge)}
            >
              {externalConnections.bridge ? "Reconnect bridge folder" : "Connect bridge folder"}
            </button>
          </div>
        </div>

        <div className="external-history-sources">
          <div className="external-history-source">
            <div>
              <strong>VLC</strong>
              <span className={externalConnections.vlc ? "connection-state connected" : "connection-state optional"}>
                {externalConnections.vlc ? "Detected" : "Waiting for bridge"}
              </span>
              <p className="vault-security-note">
                VLC resume positions are imported when <code>vlc-qt-interface.ini</code> is available in the mirrored folder. On VLC versions that expose a Windows system playback timeline, the helper also imports live position and duration.
              </p>
              <button
                className="secondary-button"
                disabled={externalSyncBusy}
                onClick={() => void runExternalHistoryAction(connectVlcHistory)}
              >
                Connect VLC history file
              </button>
            </div>
          </div>

          <div className="external-history-source">
            <div>
              <strong>Windows Media Player</strong>
              <span className={externalConnections.windowsMediaPlayer ? "connection-state connected" : "connection-state optional"}>
                {externalConnections.windowsMediaPlayer ? "Detected" : "Optional"}
              </span>
              <p className="vault-security-note">
                Optional. The helper mirrors <code>MediaPlayer.db</code>, <code>MediaPlayer.db-wal</code> when present, and <code>AppState.json</code>. While Media Player is active, it also reads the Windows system playback timeline so StreamLocal can distinguish Started from completed playback. If Windows Media Player is not installed, VLC and StreamLocal continue normally.
              </p>
            </div>
          </div>
        </div>

        <div className="settings-actions external-history-actions">
          <button
            className="primary-button"
            disabled={externalSyncBusy || !externalConnections.bridge}
            onClick={() => void runExternalHistoryAction(() => syncConnectedExternalHistories({ requestPermission: true, force: true }))}
          >
            {externalSyncBusy ? "Syncing..." : "Sync player history now"}
          </button>
        </div>

        {externalReports.length > 0 && (
          <div className="external-history-report">
            {externalReports.map((report) => (
              <div key={report.source}>
                <strong>{report.source}</strong>
                <span>{report.matched}/{report.found} matched</span>
                <span>{report.watched} watched</span>
                <span>{report.started} updated</span>
                <span>{report.unmatched} unmatched</span>
              </div>
            ))}
          </div>
        )}
        <p className="vault-security-note">
          StreamLocal checks the connected bridge folder about once per minute while the site is open. The helper only copies history metadata from the players; it never writes to VLC, Windows Media Player, or your media files.
        </p>
      </section>

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
