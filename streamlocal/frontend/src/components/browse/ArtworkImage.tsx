import { useEffect, useState } from "react";
import { artworkObjectUrl } from "../../services/artwork";

type Props = {
  artworkId: string | null;
  remoteUrl?: string | null;
  className?: string;
  label: string;
};

export function ArtworkImage({
  artworkId,
  remoteUrl,
  className,
  label,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [remoteFailed, setRemoteFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    setRemoteFailed(false);

    if (!artworkId) {
      setUrl(null);
      return () => undefined;
    }

    artworkObjectUrl(artworkId).then((value) => {
      if (!active) {
        if (value) URL.revokeObjectURL(value);
        return;
      }

      objectUrl = value;
      setUrl(value);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [artworkId]);

  const displayUrl = url ?? (!remoteFailed ? remoteUrl ?? null : null);

  if (!displayUrl) {
    return (
      <div
        className={
          className
            ? `${className} artwork-placeholder`
            : "artwork-placeholder"
        }
      >
        <span>{label}</span>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={displayUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (!url) setRemoteFailed(true);
      }}
    />
  );
}
