import { useEffect, useMemo, useState } from "react";
import { db, requestPersistentStorage } from "../db/streamlocalDb";
import type { LibrarySource, MediaFile, MediaItem, PlaybackProgress } from "../types/library";
import { chooseDirectory } from "../services/fileSystem";
import { scanLibrarySource, type ScanSummary } from "../services/libraryScanner";
import { identifyLibrary } from "../services/recognition";
import { removeUnavailableEntries } from "../services/libraryCleanup";
import { createId } from "../utils/id";
import { MetadataEditor } from "../components/library/MetadataEditor";
import { removeMediaFileFromLibrary, setWatchedState } from "../services/libraryManagement";
import "../styles/library.css";
import { useToast } from "../components/ui/Toast";
import { importStreamLocalBackup } from "../services/backup";

export function LibraryPage() {
  const [sources, setSources] = useState<LibrarySource[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [progressByItemId, setProgressByItemId] = useState<Record<string, PlaybackProgress>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const { showToast } = useToast();

  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      setError(null);
      await importStreamLocalBackup(file);
      await refresh();
      showToast("Backup imported. Now choose the original video folder with Reconnect folder.", "success");
    } catch (value) {
      const message = value instanceof Error ? value.message : "Backup import failed.";
      setError(message);
      showToast(message, "error");
    }
  }

  async function refresh() {
    const [sourceRows, fileRows, itemRows, progressRows] = await Promise.all([
      db.librarySources.toArray(),
      db.mediaFiles.toArray(),
      db.mediaItems.toArray(),
      db.playbackProgress.toArray(),
    ]);
    setSources(sourceRows);
    setFiles(fileRows);
    setItems(itemRows);
    setProgressByItemId(Object.fromEntries(progressRows.map((row) => [row.mediaItemId, row])));
  }

  useEffect(() => {
    void requestPersistentStorage();
    void refresh();
  }, []);

  async function addFolder() {
    setError(null);
    try {
      const handle = await chooseDirectory();
      const existing = sources.find((source) => source.name === handle.name);

      if (existing && !existing.handle) {
        await db.librarySources.update(existing.id, {
          handle,
          enabled: true,
        });
        const updated = await db.librarySources.get(existing.id);
        if (updated) await scan(updated);
        showToast(`Reconnected ${handle.name}.`, "success");
        return;
      }

      const source: LibrarySource = {
        id: createId("source"),
        name: handle.name,
        createdAt: Date.now(),
        lastScanAt: null,
        enabled: true,
        recursive: true,
        handle,
      };
      await db.librarySources.add(source);
      await refresh();
      await scan(source);
      showToast(`Added and scanned ${handle.name}.`, "success");
    } catch (value) {
      if (value instanceof DOMException && value.name === "AbortError") return;
      setError(value instanceof Error ? value.message : "Could not add folder.");
      showToast(value instanceof Error ? value.message : "Could not add folder.", "error");
    }
  }

  async function reconnect(source: LibrarySource) {
    setError(null);
    try {
      const handle = await chooseDirectory();
      await db.librarySources.update(source.id, {
        handle,
        name: handle.name,
        enabled: true,
      });
      const updated = await db.librarySources.get(source.id);
      if (updated) await scan(updated);
      showToast(`Reconnected ${handle.name}.`, "success");
    } catch (value) {
      if (value instanceof DOMException && value.name === "AbortError") return;
      setError(value instanceof Error ? value.message : "Could not reconnect folder.");
      showToast(value instanceof Error ? value.message : "Could not reconnect folder.", "error");
    }
  }

  async function scan(source: LibrarySource) {
    setBusy(source.id);
    setError(null);
    try {
      const result = await scanLibrarySource(source);
      setSummary(result);
      await identifyLibrary(false);
      await refresh();
      showToast(`Scan complete: ${result.scanned} files checked, ${result.added} added.`, "success");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Scan failed.");
      showToast(value instanceof Error ? value.message : "Scan failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function removeSource(source: LibrarySource) {
    if (!window.confirm("Disconnect this folder? No video file will be deleted.")) return;

    const sourceFiles = await db.mediaFiles.where("sourceId").equals(source.id).toArray();
    for (const file of sourceFiles) {
      await db.mediaFiles.update(file.id, { available: false });
    }
    await db.librarySources.update(source.id, {
      enabled: false,
      handle: null,
    });
    await refresh();
  }

  async function cleanupUnavailable() {
    const unavailableCount = files.filter((file) => !file.available).length;
    if (unavailableCount === 0) return;

    if (!window.confirm(
      `Remove ${unavailableCount} unavailable entr${unavailableCount === 1 ? "y" : "ies"} from StreamLocal? Original video files will not be touched.`,
    )) {
      return;
    }

    setError(null);
    try {
      const result = await removeUnavailableEntries();
      await refresh();
      setSummary({
        scanned: 0,
        added: 0,
        updated: 0,
        unchanged: 0,
        unavailable: result.unavailableFiles,
      });
      showToast(`Removed ${result.removedItems} unavailable library entr${result.removedItems === 1 ? "y" : "ies"}.`, "success");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Cleanup failed.");
    }
  }

  async function removeEntry(file: MediaFile) {
    if (!window.confirm(`Remove "${file.fileName}" from StreamLocal? The original file will not be deleted.`)) return;
    await removeMediaFileFromLibrary(file.id);
    await refresh();
  }

  async function toggleWatched(item: MediaItem, watched: boolean) {
    await setWatchedState(item, watched);
    await refresh();
  }

  const stats = useMemo(() => ({
    files: files.length,
    online: files.filter((file) => file.available).length,
    unavailable: files.filter((file) => !file.available).length,
    folders: sources.filter((source) => source.enabled).length,
  }), [files, sources]);

  const itemByFileId = new Map(items.map((item) => [item.mediaFileId, item]));

  return (
    <div className="page library-page">
      <section className="library-heading">
        <div>
          <p className="eyebrow">BROWSER-ONLY LIBRARY</p>
          <h1>Library</h1>
          <p>
            Your library lives in this browser. StreamLocal receives read-only access
            only to folders you explicitly choose.
          </p>
        </div>
        <button type="button" className="primary-button" onClick={addFolder}>
          Add folder
        </button>
      </section>

      <section className="library-stats">
        <div><strong>{stats.folders}</strong><span>folders</span></div>
        <div><strong>{stats.files}</strong><span>files</span></div>
        <div><strong>{stats.online}</strong><span>available</span></div>
        <div><strong>{stats.unavailable}</strong><span>unavailable</span></div>
      </section>

      {error && <div className="library-error">{error}</div>}
      {summary && (
        <div className="scan-summary">
          {summary.scanned} scanned · {summary.added} added · {summary.updated} updated ·{" "}
          {summary.unchanged} unchanged · {summary.unavailable} unavailable
        </div>
      )}

      <section className="library-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">LOCAL FOLDERS</p><h2>Sources</h2></div>
          <label className="secondary-button file-button">
            Import backup ZIP
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => void importBackup(event.target.files?.[0])}
            />
          </label>
        </div>

        {sources.length === 0 ? (
          <div className="library-empty">Choose a folder containing MP4 or MKV files.</div>
        ) : (
          <div className="source-list">
            {sources.map((source) => (
              <article className="source-row" key={source.id}>
                <div className="source-main">
                  <strong>{source.name}</strong>
                  <span>
                    {source.handle ? "Connected" : "Needs reconnect"}
                    {source.lastScanAt ? ` · ${new Date(source.lastScanAt).toLocaleString()}` : ""}
                  </span>
                </div>
                <div className="source-actions">
                  {!source.handle && (
                    <button className="secondary-button" onClick={() => reconnect(source)}>
                      Reconnect folder
                    </button>
                  )}
                  {source.handle && (
                    <button
                      className="secondary-button"
                      disabled={busy === source.id}
                      onClick={() => scan(source)}
                    >
                      {busy === source.id ? "Scanning..." : "Rescan"}
                    </button>
                  )}
                  <button className="danger-button" onClick={() => removeSource(source)}>
                    Disconnect
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="library-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">DISCOVERED MEDIA</p><h2>Files</h2></div>
          <button
            type="button"
            className="danger-button"
            disabled={stats.unavailable === 0}
            onClick={() => void cleanupUnavailable()}
          >
            Remove unavailable entries
          </button>
        </div>
        {files.length === 0 ? (
          <div className="library-empty">No MP4 or MKV files found yet.</div>
        ) : (
          <div className="media-table">
            <div className="media-table-header">
              <span>File / metadata</span><span>Folder</span><span>Size</span><span>Status / actions</span>
            </div>
            {files.map((file) => {
              const source = sources.find((candidate) => candidate.id === file.sourceId);
              const item = itemByFileId.get(file.id);
              const progress = item ? progressByItemId[item.id] : undefined;
              return (
                <div className="media-table-row" key={file.id}>
                  <div><strong>{item?.title ?? "Needs identification"}</strong><span>{file.fileName} · {file.relativePath}</span></div>
                  <div><strong>{source?.name ?? "Unknown"}</strong><span>{file.extension.toUpperCase()}</span></div>
                  <div><strong>{(file.size / (1024 ** 3)).toFixed(2)} GB</strong></div>
                  <div>
                    <span className={file.available ? "file-status online" : "file-status offline"}>
                      {file.available ? "Available" : "Unavailable"}
                    </span>
                    {item && <span>{item.type} · {progress?.watched ? "Watched" : "Unwatched"}</span>}
                    <div className="media-row-actions">
                      {item && (
                        <>
                          <button type="button" className="secondary-button compact-button" onClick={() => setEditingItemId(item.id)}>Edit</button>
                          <button type="button" className="secondary-button compact-button" onClick={() => void toggleWatched(item, !progress?.watched)}>
                            {progress?.watched ? "Mark unwatched" : "Mark watched"}
                          </button>
                        </>
                      )}
                      <button type="button" className="danger-button compact-button" onClick={() => void removeEntry(file)}>Remove record</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {editingItemId && (() => {
        const item = items.find((candidate) => candidate.id === editingItemId);
        if (!item) return null;
        return (
          <MetadataEditor
            item={item}
            onClose={() => setEditingItemId(null)}
            onSaved={() => {
              setEditingItemId(null);
              void refresh();
            }}
          />
        );
      })()}
    </div>
  );
}
