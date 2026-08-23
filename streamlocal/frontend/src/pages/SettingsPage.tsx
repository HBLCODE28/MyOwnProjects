import { useState } from "react";
import { ApiKeyVault } from "../components/settings/ApiKeyVault";
import { TvmazeProviderCard } from "../components/settings/TvmazeProviderCard";
import { MoviePosterProviderCard } from "../components/settings/MoviePosterProviderCard";
import { db, requestPersistentStorage } from "../db/streamlocalDb";
import {
  exportStreamLocalBackup,
  importStreamLocalBackup,
} from "../services/backup";
import "../styles/settings.css";

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

  async function exportBackup() {
    const blob = await exportStreamLocalBackup();
    downloadBlob(
      blob,
      `StreamLocal-Backup-${new Date().toISOString().slice(0, 10)}.zip`,
    );
    setStatus("Backup exported.");
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    await importStreamLocalBackup(file);
    setStatus(
      "Backup imported. Reconnect each media folder in Library.",
    );
  }

  async function persistence() {
    const granted = await requestPersistentStorage();

    setStatus(
      granted
        ? "Browser storage is protected. StreamLocal data is stored locally in IndexedDB and the browser marked it as persistent."
        : "Browser storage is active. StreamLocal data is stored locally in IndexedDB, but the browser did not mark it as protected from automatic cleanup. Use Export Library for important backups.",
    );
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
        ]);
      },
    );

    setStatus("Local StreamLocal database cleared.");
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
