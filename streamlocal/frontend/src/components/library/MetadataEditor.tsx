import { useEffect, useState } from "react";
import { db } from "../../db/streamlocalDb";
import type { MediaItem } from "../../types/library";
import { attachArtworkToItem, storeArtwork } from "../../services/artwork";
import { resetToAutomatic, saveManualMediaItem } from "../../services/recognition";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item.seriesId) return;

    db.series.get(item.seriesId).then((series) => {
      if (series) {
        setSeriesTitle(series.title);
      }
    });
  }, [item.seriesId]);

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
