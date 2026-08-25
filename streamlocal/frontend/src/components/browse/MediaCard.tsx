import type {
  MediaFile,
  MediaItem,
  PlaybackProgress,
} from "../../types/library";
import { ArtworkImage } from "./ArtworkImage";

type Props = {
  item: MediaItem;
  file: MediaFile | undefined;
  label?: string;
  progress?: PlaybackProgress | null;
  continueLabel?: string;
  artworkId?: string | null;
  remoteArtworkUrl?: string | null;
  onUnavailable?: (item: MediaItem) => void;
  onPlay?: (item: MediaItem) => void;
};

export function MediaCard({
  item,
  file,
  label,
  progress,
  continueLabel,
  artworkId,
  remoteArtworkUrl,
  onUnavailable,
  onPlay,
}: Props) {
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
        else if (!canPlay) onUnavailable?.(item);
      }}
      onKeyDown={(event) => {
        if (
          (event.key === "Enter" || event.key === " ") &&
          canPlay &&
          onPlay
        ) {
          event.preventDefault();
          onPlay(item);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onUnavailable?.(item);
        }
      }}
      tabIndex={canPlay && onPlay || onUnavailable ? 0 : undefined}
      role={canPlay && onPlay || onUnavailable ? "button" : undefined}
    >
      <div className="media-card-art">
        <ArtworkImage
          artworkId={artworkId !== undefined ? artworkId : item.backdropArtworkId ?? item.posterArtworkId}
          remoteUrl={remoteArtworkUrl !== undefined ? remoteArtworkUrl : item.remoteBackdropUrl ?? item.remotePosterUrl ?? null}
          label={label ?? item.type.toUpperCase()}
          fit="cover"
        />

        {!file?.available && (
          <span className="card-unavailable">Unavailable</span>
        )}

        {progress?.watched && (
          <span className="card-watched">Watched</span>
        )}

        {canPlay && onPlay && <span className="card-play">{continueLabel ?? "Play"}</span>}

        {progress && progress.percent > 0 && !progress.watched && (
          <div className="card-progress-track">
            <div
              className="card-progress-value"
              style={{
                width: `${Math.max(2, Math.min(100, progress.percent * 100))}%`,
              }}
            />
          </div>
        )}
      </div>

      <div className="media-card-copy">
        {item.logoArtworkId || item.remoteLogoUrl ? (
          <ArtworkImage className="card-logo" artworkId={item.logoArtworkId ?? null} remoteUrl={item.remoteLogoUrl ?? null} label={item.title} fallbackText={item.title} fit="contain" position="left center" lightBackgroundForDark logoKind="movie" logoYear={item.year} />
        ) : <h3>{item.title}</h3>}
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
