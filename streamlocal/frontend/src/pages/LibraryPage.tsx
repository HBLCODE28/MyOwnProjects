import { useEffect, useMemo, useState } from "react";
import { db, requestPersistentStorage } from "../db/streamlocalDb";
import type { LibrarySource, MediaFile } from "../types/library";
import { chooseDirectory } from "../services/fileSystem";
import { scanLibrarySource, type ScanSummary } from "../services/libraryScanner";
import { identifyLibrary } from "../services/recognition";
import { createId } from "../utils/id";
import "../styles/library.css";

export function LibraryPage() {
  const [sources, setSources] = useState<LibrarySource[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [sourceRows, fileRows] = await Promise.all([
      db.librarySources.toArray(),
      db.mediaFiles.toArray(),
    ]);
    setSources(sourceRows);
    setFiles(fileRows);
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
    } catch (value) {
      if (value instanceof DOMException && value.name === "AbortError") return;
      setError(value instanceof Error ? value.message : "Could not add folder.");
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
    } catch (value) {
      if (value instanceof DOMException && value.name === "AbortError") return;
      setError(value instanceof Error ? value.message : "Could not reconnect folder.");
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
    } catch (value) {
      setError(value instanceof Error ? value.message : "Scan failed.");
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

  const stats = useMemo(() => ({
    files: files.length,
    online: files.filter((file) => file.available).length,
    folders: sources.filter((source) => source.enabled).length,
  }), [files, sources]);

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
                      Reconnect
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
        </div>
        {files.length === 0 ? (
          <div className="library-empty">No MP4 or MKV files found yet.</div>
        ) : (
          <div className="media-table">
            <div className="media-table-header">
              <span>File</span><span>Folder</span><span>Size</span><span>Status</span>
            </div>
            {files.map((file) => {
              const source = sources.find((candidate) => candidate.id === file.sourceId);
              return (
                <div className="media-table-row" key={file.id}>
                  <div><strong>{file.fileName}</strong><span>{file.relativePath}</span></div>
                  <div><strong>{source?.name ?? "Unknown"}</strong><span>{file.extension.toUpperCase()}</span></div>
                  <div><strong>{(file.size / (1024 ** 3)).toFixed(2)} GB</strong></div>
                  <div>
                    <span className={file.available ? "file-status online" : "file-status offline"}>
                      {file.available ? "Available" : "Unavailable"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
