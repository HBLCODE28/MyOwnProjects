import { useCallback, useEffect, useMemo, useState } from "react";
import { libraryApi, type LibraryMedia, type LibrarySource, type ScanJob, type SourceType } from "../api/library";
import "../styles/library.css";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unit]}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "Unknown duration";
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function LibraryPage() {
  const [sources, setSources] = useState<LibrarySource[]>([]);
  const [media, setMedia] = useState<LibraryMedia[]>([]);
  const [path, setPath] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("automatic");
  const [recursive, setRecursive] = useState(true);
  const [busySource, setBusySource] = useState<number | null>(null);
  const [lastScan, setLastScan] = useState<ScanJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [sourceData, mediaData] = await Promise.all([libraryApi.listSources(), libraryApi.listMedia()]);
    setSources(sourceData.filter((source) => source.enabled));
    setMedia(mediaData);
  }, []);

  useEffect(() => {
    refresh().catch((value: unknown) => {
      setError(value instanceof Error ? value.message : "Library could not be loaded.");
    });
  }, [refresh]);

  const totals = useMemo(() => {
    const files = media.flatMap((item) => item.files);
    return { items: media.length, files: files.length, online: files.filter((file) => file.online).length };
  }, [media]);

  async function browseFolder() {
    setError(null);
    try {
      const result = await libraryApi.browseFolder();
      if (result.path) setPath(result.path);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Folder picker failed.");
    }
  }

  async function scan(sourceId: number) {
    setBusySource(sourceId);
    setError(null);
    try {
      const job = await libraryApi.scanSource(sourceId);
      setLastScan(job);
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Scan failed.");
    } finally {
      setBusySource(null);
    }
  }

  async function addSource() {
    if (!path.trim()) return;
    setError(null);
    try {
      const created = await libraryApi.addSource({ path: path.trim(), source_type: sourceType, recursive });
      setPath("");
      await refresh();
      await scan(created.id);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Source could not be added.");
    }
  }

  async function removeSource(sourceId: number) {
    if (!window.confirm("Remove this folder from StreamLocal? Video files will not be deleted.")) return;
    try {
      await libraryApi.removeSource(sourceId);
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Source could not be removed.");
    }
  }

  return (
    <div className="page library-page">
      <section className="library-heading">
        <div>
          <p className="eyebrow">PERSISTENT MEDIA LIBRARY</p>
          <h1>Library</h1>
          <p>Add permanent Windows folders. StreamLocal tracks MP4 and MKV files without moving or modifying them.</p>
        </div>
        <div className="library-stats">
          <div><strong>{totals.items}</strong><span>items</span></div>
          <div><strong>{totals.files}</strong><span>files</span></div>
          <div><strong>{totals.online}</strong><span>online</span></div>
        </div>
      </section>

      {error && <div className="library-error" role="alert">{error}</div>}

      <section className="library-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">MEDIA SOURCES</p><h2>Add a folder</h2></div>
          <button type="button" className="secondary-button" onClick={browseFolder}>Browse Windows</button>
        </div>
        <div className="source-form">
          <input value={path} onChange={(event) => setPath(event.target.value)} placeholder={"D:\\Movies or E:\\Media"} />
          <select value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceType)}>
            <option value="automatic">Automatic</option>
            <option value="movies">Movies</option>
            <option value="tv">TV</option>
          </select>
          <label className="check-control">
            <input type="checkbox" checked={recursive} onChange={(event) => setRecursive(event.target.checked)} />
            Include subfolders
          </label>
          <button type="button" className="primary-button" onClick={addSource}>Add source</button>
        </div>
      </section>

      <section className="library-panel">
        <div className="panel-heading"><div><p className="eyebrow">PERSISTENT SOURCES</p><h2>Folders</h2></div></div>
        {sources.length === 0 ? <div className="library-empty">Add a media folder to start building your StreamLocal library.</div> :
          <div className="source-list">
            {sources.map((source) => (
              <article className="source-row" key={source.id}>
                <div className="source-main">
                  <strong>{source.path}</strong>
                  <span>{source.source_type} · {source.online_file_count}/{source.file_count} online
                    {source.last_scan_at ? ` · scanned ${new Date(source.last_scan_at).toLocaleString()}` : " · not scanned yet"}
                  </span>
                </div>
                <div className="source-actions">
                  <button className="secondary-button" disabled={busySource === source.id} onClick={() => scan(source.id)}>
                    {busySource === source.id ? "Scanning..." : "Rescan"}
                  </button>
                  <button className="danger-button" onClick={() => removeSource(source.id)}>Remove</button>
                </div>
              </article>
            ))}
          </div>}
      </section>

      {lastScan && <section className="scan-summary">
        Last scan: {lastScan.files_scanned} scanned · {lastScan.files_added} added · {lastScan.files_updated} updated · {lastScan.errors_count} errors
      </section>}

      <section className="library-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">DISCOVERED FILES</p><h2>Imported media</h2></div>
          <span className="stage-note">Movie/series recognition begins in Stage 3</span>
        </div>
        {media.length === 0 ? <div className="library-empty">No MP4 or MKV files have been imported yet.</div> :
          <div className="media-table">
            <div className="media-table-header"><span>Title</span><span>File</span><span>Technical</span><span>Status</span></div>
            {media.flatMap((item) => item.files.map((file) => (
              <div className="media-table-row" key={file.id}>
                <div><strong>{item.title}</strong><span>{item.media_type}</span></div>
                <div title={file.absolute_path}><strong>{file.absolute_path.split(/[\\/]/).pop()}</strong><span>{formatBytes(file.file_size)}</span></div>
                <div>
                  <strong>{file.width && file.height ? `${file.width}×${file.height}` : "Pending probe"}</strong>
                  <span>{[file.video_codec, file.container, formatDuration(file.duration_seconds)].filter(Boolean).join(" · ")}</span>
                </div>
                <div><span className={file.online ? "file-status online" : "file-status offline"}>{file.online ? "Online" : "Unavailable"}</span></div>
              </div>
            )))}
          </div>}
      </section>
    </div>
  );
}
