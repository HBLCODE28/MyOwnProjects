import { useEffect, useMemo, useRef, useState } from "react";
import { artworkObjectSource, isAutoCachedArtworkFileName } from "../../services/artwork";
import { analyzeLogoImageElement } from "../../services/logoValidation";
import {
  findAlternateWikimediaLogo,
  isNamedLogoUrlContextCompatible,
  type LogoSearchContext,
} from "../../services/wikimediaLogoProvider";

type Props = {
  artworkId: string | null;
  remoteUrl?: string | null;
  className?: string;
  label: string;
  fallbackText?: string;
  fit?: "cover" | "contain";
  position?: string;
  lightBackgroundForDark?: boolean;
  logoKind?: LogoSearchContext["kind"];
  logoYear?: number | null;
  artworkOwnerId?: string;
};

export function ArtworkImage({
  artworkId,
  remoteUrl,
  className,
  label,
  fallbackText,
  fit = "cover",
  position = "center",
  lightBackgroundForDark = false,
  logoKind,
  logoYear = null,
  artworkOwnerId,
}: Props) {
  const [localSource, setLocalSource] = useState<{ url: string; fileName: string } | null>(null);
  const [alternateUrl, setAlternateUrl] = useState<string | null>(null);
  const [rejectedUrls, setRejectedUrls] = useState<Set<string>>(() => new Set());
  const alternateLookupInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    setAlternateUrl(null);
    setRejectedUrls(new Set());
    alternateLookupInFlight.current = false;

    if (!artworkId) {
      setLocalSource(null);
      return () => undefined;
    }

    void artworkObjectSource(artworkId).then((value) => {
      if (!active) {
        if (value?.url) URL.revokeObjectURL(value.url);
        return;
      }
      objectUrl = value?.url ?? null;
      setLocalSource(value);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [artworkId]);

  const localIsGeneratedLogoCache = Boolean(
    lightBackgroundForDark &&
    artworkOwnerId &&
    localSource &&
    (
      isAutoCachedArtworkFileName(localSource.fileName, artworkOwnerId, "logo") ||
      Boolean(remoteUrl && localSource.fileName === `${label}.logo.jpg`)
    ),
  );

  const displayUrl = useMemo(
    () => [
      localIsGeneratedLogoCache ? null : localSource?.url ?? null,
      remoteUrl ?? null,
      alternateUrl,
    ].find((candidate) => candidate && !rejectedUrls.has(candidate)) ?? null,
    [alternateUrl, localIsGeneratedLogoCache, localSource, rejectedUrls, remoteUrl],
  );

  function reject(url: string) {
    setRejectedUrls((current) => {
      if (current.has(url)) return current;
      const next = new Set(current);
      next.add(url);
      return next;
    });

    if (!lightBackgroundForDark || alternateLookupInFlight.current) return;
    const remoteStillAvailable = remoteUrl && remoteUrl !== url && !rejectedUrls.has(remoteUrl);
    if (remoteStillAvailable) return;

    alternateLookupInFlight.current = true;
    void findAlternateWikimediaLogo(label, url, { kind: logoKind, year: logoYear })
      .then((alternative) => {
        if (alternative && !rejectedUrls.has(alternative)) setAlternateUrl(alternative);
      })
      .catch(() => undefined)
      .finally(() => {
        alternateLookupInFlight.current = false;
      });
  }

  if (!displayUrl) {
    if (fallbackText) {
      return (
        <div
          className={`${className ?? ""} artwork-title-fallback`.trim()}
          aria-label={label}
        >
          {fallbackText}
        </div>
      );
    }
    return (
      <div
        className={className ? `${className} artwork-empty` : "artwork-empty"}
        aria-label={label}
      />
    );
  }

  return (
    <img
      className={className}
      src={displayUrl}
      alt=""
      loading="lazy"
      crossOrigin={lightBackgroundForDark && !displayUrl.startsWith("blob:") ? "anonymous" : undefined}
      referrerPolicy="no-referrer"
      style={{ objectFit: fit, objectPosition: position }}
      onError={() => reject(displayUrl)}
      onLoad={(event) => {
        if (!lightBackgroundForDark) return;
        if (!isNamedLogoUrlContextCompatible(label, displayUrl, { kind: logoKind, year: logoYear })) {
          reject(displayUrl);
          return;
        }
        const analysis = analyzeLogoImageElement(event.currentTarget);
        if (analysis && !analysis.usable) reject(displayUrl);
      }}
    />
  );
}
