import { useEffect, useState } from "react";
import { artworkObjectUrl } from "../../services/artwork";

type Props = {
  artworkId: string | null;
  className?: string;
  label: string;
};

export function ArtworkImage({ artworkId, className, label }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

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

  if (!url) {
    return (
      <div className={className ? `${className} artwork-placeholder` : "artwork-placeholder"}>
        <span>{label}</span>
      </div>
    );
  }

  return <img className={className} src={url} alt="" loading="lazy" />;
}
