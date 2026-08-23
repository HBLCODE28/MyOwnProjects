import type { MediaFile, MediaItem } from "../../types/library";
import { ArtworkImage } from "./ArtworkImage";

type Props = {
  item: MediaItem;
  file: MediaFile | undefined;
  label?: string;
  onPlay?: (item: MediaItem) => void;
};

export function MediaCard({ item, file, label, onPlay }: Props) {
  const playableContainer =
    file?.extension.toLowerCase() === "mp4" ||
    file?.extension.toLowerCase() === "mkv";
  const canPlay = Boolean(file?.available && playableContainer);
  const status = file?.available
    ? `${file.extension.toUpperCase()} · Available`
    : "Unavailable";

  return (
    <article
      className={`media-card ${canPlay && onPlay ? "playable-card" : ""}`}
      onClick={() => {
        if (canPlay && onPlay) onPlay(item);
      }}
      onKeyDown={(event) => {
        if (
          (event.key === "Enter" || event.key === " ") &&
          canPlay &&
          onPlay
        ) {
          event.preventDefault();
          onPlay(item);
        }
      }}
      tabIndex={canPlay && onPlay ? 0 : undefined}
      role={canPlay && onPlay ? "button" : undefined}
    >
      <div className="media-card-art">
        <ArtworkImage
          artworkId={item.posterArtworkId}
          label={label ?? item.type.toUpperCase()}
        />
        {!file?.available && (
          <span className="card-unavailable">Unavailable</span>
        )}
        {canPlay && onPlay && <span className="card-play">Play</span>}
      </div>

      <div className="media-card-copy">
        <h3>{item.title}</h3>
        <p>
          {[item.year, item.genres.slice(0, 2).join(", "), item.confidence]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <span>{status}</span>
      </div>
    </article>
  );
}
