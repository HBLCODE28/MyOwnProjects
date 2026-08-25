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
  highContrastPixelRatio: number;
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
  let highContrastPixels = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 32) continue;

    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);
    const chroma = maxChannel - minChannel;

    visiblePixels += 1;
    const luminance =
      red * 0.2126 +
      green * 0.7152 +
      blue * 0.0722;
    luminanceSum += luminance;

    // Count pixels that would visually disappear on StreamLocal's near-black UI.
    // Saturated colors are intentionally not treated as black merely because their
    // mathematical luminance is low (for example, the normal red Stranger Things logo).
    const nearBlack =
      maxChannel < 54 ||
      (maxChannel < 82 && chroma < 24);
    if (nearBlack) darkPixels += 1;

    // White/light pixels and strongly saturated colors remain readable on the dark UI.
    if (maxChannel >= 116 || chroma >= 72) highContrastPixels += 1;
  }

  const visibleRatio = visiblePixels / totalPixels;
  const averageLuminance = visiblePixels > 0 ? luminanceSum / visiblePixels : 0;
  const darkPixelRatio = visiblePixels > 0 ? darkPixels / visiblePixels : 1;
  const highContrastPixelRatio = visiblePixels > 0
    ? highContrastPixels / visiblePixels
    : 0;

  // Reject logos whose actual visible artwork is dominated by near-black pixels.
  // This catches variants such as a mostly-black wordmark with only a small bright
  // subtitle, while retaining normal white, colored and transparent logos.
  const unreadableOnDark =
    visiblePixels > 8 &&
    (
      darkPixelRatio >= 0.78 ||
      (darkPixelRatio >= 0.66 && highContrastPixelRatio < 0.2)
    );
  const portraitLike = height > width * 1.08;

  return {
    usable:
      visiblePixels > 8 &&
      visibleRatio > 0.002 &&
      !unreadableOnDark &&
      !portraitLike,
    visiblePixels,
    visibleRatio,
    averageLuminance,
    darkPixelRatio,
    highContrastPixelRatio,
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
