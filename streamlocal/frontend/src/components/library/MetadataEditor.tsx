import { useEffect, useState } from "react";
import { db } from "../../db/streamlocalDb";
import type { MediaItem } from "../../types/library";
import { attachArtworkToItem, storeArtwork } from "../../services/artwork";
import { resetToAutomatic, saveManualMediaItem } from "../../services/recognition";
import {
  getMediaSegments,
  replaceManualMediaSegments,
} from "../../services/mediaSegments";

type Props = {
  item: MediaItem;
  onClose: () => void;
  onSaved: () => void;
};

export function MetadataEditor({ item, onClose, onSaved }: Props) {
  const [type, setType] = useState<"movie" | "episode">(
    item.type === "episode" ? "episode" : "movie",
  );
  const [title, setTitle] = useState(item.title);
  const [year, setYear] = useState(item.year?.toString() ?? "");
  const [overview, setOverview] = useState(item.overview);
  const [genres, setGenres] = useState(item.genres.join(", "));
  const [seriesTitle, setSeriesTitle] = useState("");
  const [season, setSeason] = useState(item.seasonNumber?.toString() ?? "");
  const [episode, setEpisode] = useState(item.episodeNumber?.toString() ?? "");
  const [episodeTitle, setEpisodeTitle] = useState(item.episodeTitle ?? "");
  const [introStart, setIntroStart] = useState("");
  const [introEnd, setIntroEnd] = useState("");
  const [recapStart, setRecapStart] = useState("");
  const [recapEnd, setRecapEnd] = useState("");
  const [creditsStart, setCreditsStart] = useState("");
  const [creditsEnd, setCreditsEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item.seriesId) return;

    db.series.get(item.seriesId).then((series) => {
      if (series) {
        setSeriesTitle(series.title);
      }
    });
  }, [item.seriesId]);

  useEffect(() => {
    getMediaSegments(item.id).then((segments) => {
      for (const segment of segments) {
        const start = String(segment.startSeconds);
        const end = String(segment.endSeconds);
        if (segment.type === "intro") {
          setIntroStart(start);
          setIntroEnd(end);
        } else if (segment.type === "recap") {
          setRecapStart(start);
          setRecapEnd(end);
        } else {
          setCreditsStart(start);
          setCreditsEnd(end);
        }
      }
    });
  }, [item.id]);

  function segmentValue(start: string, end: string) {
    if (!start.trim() && !end.trim()) return undefined;
    return { startSeconds: Number(start), endSeconds: Number(end) };
  }

  async function save() {
    setError(null);

    try {
      await saveManualMediaItem(item.id, {
        type,
        title: type === "episode" ? seriesTitle : title,
        year: year ? Number(year) : null,
        overview,
        genres: genres
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        seriesTitle: type === "episode" ? seriesTitle : undefined,
        seasonNumber: season ? Number(season) : null,
        episodeNumber: episode ? Number(episode) : null,
        episodeTitle: episodeTitle || null,
      });

      await replaceManualMediaSegments(item.id, {
        intro: segmentValue(introStart, introEnd),
        recap: segmentValue(recapStart, recapEnd),
        credits: segmentValue(creditsStart, creditsEnd),
      });

      onSaved();
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Could not save metadata.",
      );
    }
  }

  async function selectArtwork(
    kind: "poster" | "backdrop",
    file: File | undefined,
  ) {
    if (!file) return;

    try {
      const artworkId = await storeArtwork(file, kind);
      await attachArtworkToItem(item.id, artworkId, kind);
      onSaved();
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Artwork could not be stored.",
      );
    }
  }

  async function reset() {
    await resetToAutomatic(item.id);
    onSaved();
  }

  return (
    <div className="match-modal-backdrop" onMouseDown={onClose}>
      <section
        className="metadata-editor"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="match-modal-heading">
          <div>
            <p className="eyebrow">LOCAL METADATA</p>
            <h2>Edit / Identify</h2>
          </div>
          <button className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <div className="library-error">{error}</div>}

        <div className="metadata-grid">
          <label>
            Type
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as "movie" | "episode")
              }
            >
              <option value="movie">Movie</option>
              <option value="episode">Episode</option>
            </select>
          </label>

          {type === "movie" ? (
            <label>
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
          ) : (
            <label>
              Series Title
              <input
                value={seriesTitle}
                onChange={(event) => setSeriesTitle(event.target.value)}
              />
            </label>
          )}

          <label>
            Year
            <input
              type="number"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
          </label>

          {type === "episode" && (
            <>
              <label>
                Season
                <input
                  type="number"
                  min="0"
                  value={season}
                  onChange={(event) => setSeason(event.target.value)}
                />
              </label>

              <label>
                Episode
                <input
                  type="number"
                  min="0"
                  value={episode}
                  onChange={(event) => setEpisode(event.target.value)}
                />
              </label>

              <label className="metadata-wide">
                Episode Title
                <input
                  value={episodeTitle}
                  onChange={(event) => setEpisodeTitle(event.target.value)}
                />
              </label>
            </>
          )}

          <label className="metadata-wide">
            Genres
            <input
              value={genres}
              onChange={(event) => setGenres(event.target.value)}
              placeholder="Drama, Sci-Fi"
            />
          </label>

          <label className="metadata-wide">
            Overview
            <textarea
              value={overview}
              onChange={(event) => setOverview(event.target.value)}
              rows={5}
            />
          </label>

          <div className="metadata-wide segment-editor">
            <div>
              <p className="eyebrow">OPTIONAL PLAYBACK SEGMENTS</p>
              <p className="segment-help">
                Enter seconds for manual Skip Intro, Skip Recap and Credits controls.
                Leave both fields empty to remove a segment.
              </p>
            </div>
            <div className="segment-grid">
              <label>Intro start<input type="number" min="0" step="0.1" value={introStart} onChange={(event) => setIntroStart(event.target.value)} /></label>
              <label>Intro end<input type="number" min="0" step="0.1" value={introEnd} onChange={(event) => setIntroEnd(event.target.value)} /></label>
              <label>Recap start<input type="number" min="0" step="0.1" value={recapStart} onChange={(event) => setRecapStart(event.target.value)} /></label>
              <label>Recap end<input type="number" min="0" step="0.1" value={recapEnd} onChange={(event) => setRecapEnd(event.target.value)} /></label>
              <label>Credits start<input type="number" min="0" step="0.1" value={creditsStart} onChange={(event) => setCreditsStart(event.target.value)} /></label>
              <label>Credits end<input type="number" min="0" step="0.1" value={creditsEnd} onChange={(event) => setCreditsEnd(event.target.value)} /></label>
            </div>
          </div>

          <label>
            Poster
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(event) =>
                selectArtwork("poster", event.target.files?.[0])
              }
            />
          </label>

          <label>
            Backdrop
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(event) =>
                selectArtwork("backdrop", event.target.files?.[0])
              }
            />
          </label>
        </div>

        <div className="metadata-footer">
          <button className="secondary-button" onClick={reset}>
            Reset to automatic
          </button>
          <button className="primary-button" onClick={save}>
            Save metadata
          </button>
        </div>
      </section>
    </div>
  );
}
