import { useEffect, useMemo, useState } from "react";
import { db, requestPersistentStorage } from "../db/streamlocalDb";
import type { LibrarySource, MediaFile, MediaItem, PlaybackProgress } from "../types/library";
import { chooseLibraryLocation } from "../services/fileSystem";
import { scanLibrarySource, type ScanSummary } from "../services/libraryScanner";
import { identifyLibrary } from "../services/recognition";
import { removeUnavailableEntries } from "../services/libraryCleanup";
import { createId } from "../utils/id";
import { MetadataEditor } from "../components/library/MetadataEditor";
import { removeMediaFileFromLibrary, setWatchedState } from "../services/libraryManagement";
import "../styles/library.css";
import { useToast } from "../components/ui/Toast";
import { importStreamLocalBackup } from "../services/backup";
import { networkBridgeAvailable, validateNetworkFolder } from "../services/networkBridge";

const FILES_PER_PAGE = 150;

export function LibraryPage() {
  const [sources, setSources] = useState<LibrarySource[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [progressByItemId, setProgressByItemId] = useState<Record<string, PlaybackProgress>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [networkMode, setNetworkMode] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [filePage, setFilePage] = useState(1);
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
    void networkBridgeAvailable().then(setNetworkMode);
  }, []);

  async function addFolder() {
    setError(null);
    try {
      const location = await chooseLibraryLocation();
      const existing = sources.find((source) => source.name === location.name);

      if (existing && !existing.handle) {
        await db.librarySources.update(existing.id, {
          handle: location.handle,
          nativePath: null,
          name: location.name,
          enabled: true,
        });
        const updated = await db.librarySources.get(existing.id);
        if (updated) await scan(updated);
        showToast(`Reconnected ${location.name}.`, "success");
        return;
      }

      const source: LibrarySource = {
        id: createId("source"),
        name: location.name,
        createdAt: Date.now(),
        lastScanAt: null,
        enabled: true,
        recursive: true,
        handle: location.handle,
        nativePath: null,
      };
      await db.librarySources.add(source);
      await refresh();
      await scan(source);
      showToast(`Added and scanned ${location.name}.`, "success");
    } catch (value) {
      if (value instanceof DOMException && value.name === "AbortError") return;
      setError(value instanceof Error ? value.message : "Could not add folder.");
      showToast(value instanceof Error ? value.message : "Could not add folder.", "error");
    }
  }

  async function addNetworkPath(existingSource?: LibrarySource) {
    const initial = existingSource?.nativePath ?? "\\\\SERVER\\Share\\Movies";
    const entered = window.prompt("Enter the network share path (UNC). Example: \\\\SERVER\\Movies", initial);
    if (!entered?.trim()) return;
    setError(null);
    try {
      if (!(await networkBridgeAvailable())) {
        throw new Error("Network folders require StreamLocal Website Portable on http://127.0.0.1:17836.");
      }
      const selected = await validateNetworkFolder(entered.trim());
      const byPath = sources.find((source) => source.nativePath?.toLowerCase() === selected.path.toLowerCase());
      const target = existingSource ?? byPath;
      if (target) {
        await db.librarySources.update(target.id, {
          enabled: true,
          handle: null,
          nativePath: selected.path,
          name: selected.name,
        });
        const updated = await db.librarySources.get(target.id);
        if (updated) await scan(updated);
        showToast(`Connected network folder ${selected.name}.`, "success");
        return;
      }
      const source: LibrarySource = {
        id: createId("source"),
        name: selected.name,
        createdAt: Date.now(),
        lastScanAt: null,
        enabled: true,
        recursive: true,
        handle: null,
        nativePath: selected.path,
      };
      await db.librarySources.add(source);
      await refresh();
      await scan(source);
      showToast(`Added and scanned ${selected.name}.`, "success");
    } catch (value) {
      const message = value instanceof Error ? value.message : "Could not open network folder.";
      setError(message);
      showToast(message, "error");
    }
  }

  async function reconnect(source: LibrarySource) {
    if (source.nativePath) {
      await addNetworkPath(source);
      return;
    }
    setError(null);
    try {
      const location = await chooseLibraryLocation();
      await db.librarySources.update(source.id, {
        handle: location.handle,
        nativePath: null,
        name: location.name,
        enabled: true,
      });
      const updated = await db.librarySources.get(source.id);
      if (updated) await scan(updated);
      showToast(`Reconnected ${location.name}.`, "success");
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
      nativePath: null,
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

  const itemByFileId = useMemo(
    () => new Map(items.map((item) => [item.mediaFileId, item])),
    [items],
  );
  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );

  const filteredFiles = useMemo(() => {
    const normalized = fileQuery.trim().toLowerCase();
    if (!normalized) return files;

    return files.filter((file) => {
      const item = itemByFileId.get(file.id);
      const source = sourceById.get(file.sourceId);
      const searchable = [
        item?.title ?? "",
        file.fileName,
        file.relativePath,
        source?.name ?? "",
        file.extension,
        file.available ? "available online" : "unavailable offline",
      ].join(" ").toLowerCase();
      return searchable.includes(normalized);
    });
  }, [fileQuery, files, itemByFileId, sourceById]);

  const filePageCount = Math.max(1, Math.ceil(filteredFiles.length / FILES_PER_PAGE));
  const safeFilePage = Math.min(filePage, filePageCount);
  const visibleFiles = useMemo(() => {
    const start = (safeFilePage - 1) * FILES_PER_PAGE;
    return filteredFiles.slice(start, start + FILES_PER_PAGE);
  }, [filteredFiles, safeFilePage]);

  useEffect(() => {
    if (filePage > filePageCount) setFilePage(filePageCount);
  }, [filePage, filePageCount]);

  return (
    <div className="page library-page">
      <section className="library-heading">
        <div>
          <p className="eyebrow">LOCAL LIBRARY</p>
          <h1>Library</h1>
          <p>
            StreamLocal reads only folders you explicitly choose. Local folders use Chrome/Edge permissions.
            Website Portable can also read a direct Windows network path such as \\\\NAS\\Movies without mapping a drive.
          </p>
        </div>
        <div className="library-heading-actions">
          <button type="button" className="secondary-button" onClick={() => void addNetworkPath()}>
            Add network path
          </button>
          <button type="button" className="primary-button" onClick={addFolder}>
            Add folder
          </button>
        </div>
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
                    {source.enabled && (source.handle || (source.nativePath && networkMode)) ? "Connected" : "Needs reconnect"}
                    {source.nativePath ? ` · ${source.nativePath}` : ""}
                    {source.lastScanAt ? ` · ${new Date(source.lastScanAt).toLocaleString()}` : ""}
                  </span>
                </div>
                <div className="source-actions">
                  {(!source.enabled || (!source.handle && !(source.nativePath && networkMode))) && (
                    <button className="secondary-button" onClick={() => reconnect(source)}>
                      Reconnect folder
                    </button>
                  )}
                  {source.enabled && (source.handle || (source.nativePath && networkMode)) && (
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
        {files.length > 0 && (
          <div className="library-file-toolbar">
            <input
              type="search"
              value={fileQuery}
              onChange={(event) => {
                setFileQuery(event.target.value);
                setFilePage(1);
              }}
              placeholder="Search title, filename, path or folder"
              aria-label="Search discovered media"
            />
            <div className="library-file-page-controls">
              <span>
                {filteredFiles.length.toLocaleString()} result{filteredFiles.length === 1 ? "" : "s"}
                {filteredFiles.length > FILES_PER_PAGE ? ` · page ${safeFilePage} of ${filePageCount}` : ""}
              </span>
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={safeFilePage <= 1}
                onClick={() => setFilePage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={safeFilePage >= filePageCount}
                onClick={() => setFilePage((current) => Math.min(filePageCount, current + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
        {files.length === 0 ? (
          <div className="library-empty">No MP4 or MKV files found yet.</div>
        ) : filteredFiles.length === 0 ? (
          <div className="library-empty">No files match this search.</div>
        ) : (
          <div className="media-table">
            <div className="media-table-header">
              <span>File / metadata</span><span>Folder</span><span>Size</span><span>Status / actions</span>
            </div>
            {visibleFiles.map((file) => {
              const source = sourceById.get(file.sourceId);
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
