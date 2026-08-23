import type { MediaFile, MediaItem } from "../../types/library";
import { ArtworkImage } from "./ArtworkImage";

type Props = {
  item: MediaItem;
  file: MediaFile | undefined;
  label?: string;
};

export function MediaCard({ item, file, label }: Props) {
  const status = file?.available ? "Available" : "Unavailable";

  return (
    <article className="media-card">
      <div className="media-card-art">
        <ArtworkImage artworkId={item.posterArtworkId} label={label ?? item.type.toUpperCase()} />
        {!file?.available && <span className="card-unavailable">Unavailable</span>}
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
