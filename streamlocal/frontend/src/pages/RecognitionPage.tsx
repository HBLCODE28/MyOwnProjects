import { useEffect, useMemo, useState } from "react";
import { db } from "../db/streamlocalDb";
import type { MediaFile, MediaItem, Series } from "../types/library";
import { identifyLibrary } from "../services/recognition";
import { MetadataEditor } from "../components/library/MetadataEditor";
import "../styles/recognition.css";

type Row = {
  item: MediaItem;
  file: MediaFile | undefined;
  series: Series | undefined;
};

export function RecognitionPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function refresh() {
    const [items, files, seriesRows] = await Promise.all([
      db.mediaItems.toArray(),
      db.mediaFiles.toArray(),
      db.series.toArray(),
    ]);
    setRows(items.map((item) => ({
      item,
      file: files.find((file) => file.id === item.mediaFileId),
      series: seriesRows.find((series) => series.id === item.seriesId),
    })));
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function run(force = false) {
    setBusy(true);
    try {
      const result = await identifyLibrary(force);
      setSummary(
        `${result.processed} processed · ${result.matched} matched · ${result.needsMatch} need review`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => ({
    matched: rows.filter((row) => row.item.matchStatus === "matched").length,
    needs: rows.filter((row) => row.item.matchStatus === "needs_match").length,
    movies: rows.filter((row) => row.item.type === "movie").length,
    episodes: rows.filter((row) => row.item.type === "episode").length,
  }), [rows]);

  return (
    <div className="page recognition-page">
      <section className="recognition-header">
        <div>
          <p className="eyebrow">100% LOCAL IDENTIFICATION</p>
          <h1>Identify your library.</h1>
          <p>
            Filenames and folder names are parsed entirely in your browser. No metadata
            is sent to any external service.
          </p>
        </div>
        <div className="recognition-actions">
          <button className="secondary-button" disabled={busy} onClick={() => run(true)}>
            Re-identify automatic items
          </button>
          <button className="primary-button" disabled={busy} onClick={() => run(false)}>
            {busy ? "Identifying..." : "Identify library"}
          </button>
        </div>
      </section>

      <section className="recognition-stats">
        <div><strong>{stats.matched}</strong><span>matched</span></div>
        <div><strong>{stats.needs}</strong><span>needs match</span></div>
        <div><strong>{stats.movies}</strong><span>movies</span></div>
        <div><strong>{stats.episodes}</strong><span>episodes</span></div>
      </section>

      {summary && <div className="scan-summary">{summary}</div>}

      <section className="recognition-list">
        {rows.length === 0 ? (
          <div className="library-empty">Scan a media folder in Library first.</div>
        ) : rows.map(({ item, file, series }) => (
          <article className="recognition-row" key={item.id}>
            <div className="recognition-art">
              {item.type === "episode" ? "TV" : item.type === "movie" ? "MOVIE" : "FILE"}
            </div>
            <div className="recognition-main">
              <div className="recognition-title">
                <h2>
                  {item.type === "episode" && series
                    ? `${series.title} · S${String(item.seasonNumber ?? 0).padStart(2, "0")}E${String(item.episodeNumber ?? 0).padStart(2, "0")}`
                    : item.title}
                </h2>
                <span>{item.year ?? ""}</span>
              </div>
              <p>{file?.relativePath ?? "File unavailable"}</p>
              <span className={item.matchStatus === "matched" ? "match-state matched" : "match-state needs-match"}>
                {item.matchStatus === "matched"
                  ? `${item.manuallyEdited ? "Manual" : "Automatic"} · ${item.confidence}`
                  : "Needs Match"}
              </span>
            </div>
            <button className="secondary-button" onClick={() => setSelected(item)}>
              Edit metadata
            </button>
          </article>
        ))}
      </section>

      {selected && (
        <MetadataEditor
          item={selected}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            setSelected(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
