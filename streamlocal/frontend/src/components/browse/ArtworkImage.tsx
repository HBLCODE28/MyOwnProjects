import { useEffect, useRef, useState } from "react";
import { artworkObjectUrl } from "../../services/artwork";
import { findAlternateWikimediaLogo } from "../../services/wikimediaLogoProvider";

type Props = {
  artworkId: string | null;
  remoteUrl?: string | null;
  className?: string;
  label: string;
  fit?: "cover" | "contain";
  position?: string;
  lightBackgroundForDark?: boolean;
};

export function ArtworkImage({
  artworkId,
  remoteUrl,
  className,
  label,
  fit = "cover",
  position = "center",
  lightBackgroundForDark = false,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [alternateUrl, setAlternateUrl] = useState<string | null>(null);
  const attemptedAlternateUrls = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    setRemoteFailed(false);
    setAlternateUrl(null);
    attemptedAlternateUrls.current.clear();

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

  const displayUrl = url ?? alternateUrl ?? (!remoteFailed ? remoteUrl ?? null : null);

  if (!displayUrl) {
    return <div className={className ? `${className} artwork-empty` : "artwork-empty"} aria-label={label} />;
  }

  return (
    <img
      className={className}
      src={displayUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      style={{
        objectFit: fit,
        objectPosition: position,
      }}
      onError={() => {
        if (!url) setRemoteFailed(true);
      }}
      onLoad={(event) => {
        if (!lightBackgroundForDark) return;
        try {
          const image = event.currentTarget;
          const canvas = document.createElement("canvas");
          canvas.width = 32;
          canvas.height = 32;
          const context = canvas.getContext("2d");
          if (!context) return;
          context.clearRect(0, 0, 32, 32);
          context.drawImage(image, 0, 0, 32, 32);
          const pixels = context.getImageData(0, 0, 32, 32).data;
          let visible = 0;
          let luminance = 0;
          for (let index = 0; index < pixels.length; index += 4) {
            if (pixels[index + 3] < 40) continue;
            visible += 1;
            luminance += (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722);
          }
          const isFullyDark = visible > 8 && luminance / visible < 35;
          if (isFullyDark && !attemptedAlternateUrls.current.has(displayUrl)) {
            attemptedAlternateUrls.current.add(displayUrl);
            void findAlternateWikimediaLogo(label, displayUrl).then((alternative) => {
              if (alternative) {
                setAlternateUrl(alternative);
              }
            }).catch(() => undefined);
          }
        } catch {
        }
      }}
    />
  );
}
