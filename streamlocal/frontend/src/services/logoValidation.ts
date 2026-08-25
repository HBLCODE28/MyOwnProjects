const REJECTED_ARTWORK_TERMS = [
  "poster",
  "cover",
  "backdrop",
  "background",
  "screenshot",
  "season",
  "episode",
  "dvd",
  "thumbnail",
  "frame",
  "fanart",
];

export type LogoPixelAnalysis = {
  usable: boolean;
  visiblePixels: number;
  visibleRatio: number;
  averageLuminance: number;
  darkPixelRatio: number;
};

export function isRejectedLogoCandidateName(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[_+.-]+/g, " ");
  return REJECTED_ARTWORK_TERMS.some((term) =>
    new RegExp(`(^|\\s)${term}(\\s|$)`, "i").test(normalized),
  );
}

export function analyzeLogoPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): LogoPixelAnalysis {
  const totalPixels = Math.max(1, width * height);
  let visiblePixels = 0;
  let luminanceSum = 0;
  let darkPixels = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 32) continue;

    visiblePixels += 1;
    const luminance =
      pixels[index] * 0.2126 +
      pixels[index + 1] * 0.7152 +
      pixels[index + 2] * 0.0722;
    luminanceSum += luminance;
    if (luminance < 42) darkPixels += 1;
  }

  const visibleRatio = visiblePixels / totalPixels;
  const averageLuminance = visiblePixels > 0 ? luminanceSum / visiblePixels : 0;
  const darkPixelRatio = visiblePixels > 0 ? darkPixels / visiblePixels : 1;

  const overwhelminglyBlack =
    visiblePixels > 8 &&
    averageLuminance < 38 &&
    darkPixelRatio > 0.9;
  const portraitLike = height > width * 1.08;

  return {
    usable:
      visiblePixels > 8 &&
      visibleRatio > 0.002 &&
      !overwhelminglyBlack &&
      !portraitLike,
    visiblePixels,
    visibleRatio,
    averageLuminance,
    darkPixelRatio,
  };
}

export function analyzeLogoImageElement(image: HTMLImageElement): LogoPixelAnalysis | null {
  try {
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    if (!naturalWidth || !naturalHeight) return null;

    const maxDimension = 160;
    const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return analyzeLogoPixels(context.getImageData(0, 0, width, height).data, width, height);
  } catch {
    return null;
  }
}

export async function validateRemoteLogoUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => {
      const analysis = analyzeLogoImageElement(image);
      resolve(analysis?.usable ?? false);
    };
    image.onerror = () => resolve(false);
    image.src = url;
  });
}
