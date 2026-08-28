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
  "photo",
  "photograph",
  "premiere",
  "press",
  "cast",
  "still",
  "scene",
];

export type LogoPixelAnalysis = {
  usable: boolean;
  visiblePixels: number;
  visibleRatio: number;
  averageLuminance: number;
  darkPixelRatio: number;
  highContrastPixelRatio: number;
  nearWhitePixelRatio: number;
  opaqueRatio: number;
  colorBinCount: number;
  strongEdgeRatio: number;
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
  let nearWhitePixels = 0;
  let opaquePixels = 0;
  let strongEdges = 0;
  let edgeComparisons = 0;
  const colorBins = new Set<number>();

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
    if (alpha >= 240) opaquePixels += 1;
    // Quantize to 4 bits per channel. Photographic images fill many more bins
    // than normal title logos while simple gradients and antialiasing remain compact.
    colorBins.add(((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4));
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
    if (minChannel >= 232 && chroma <= 18) nearWhitePixels += 1;

    const pixelNumber = index / 4;
    const x = pixelNumber % width;
    if (x > 0) {
      const left = index - 4;
      if (pixels[left + 3] >= 32) {
        edgeComparisons += 1;
        const difference = Math.max(
          Math.abs(red - pixels[left]),
          Math.abs(green - pixels[left + 1]),
          Math.abs(blue - pixels[left + 2]),
        );
        if (difference >= 42) strongEdges += 1;
      }
    }
    if (pixelNumber >= width) {
      const above = index - width * 4;
      if (pixels[above + 3] >= 32) {
        edgeComparisons += 1;
        const difference = Math.max(
          Math.abs(red - pixels[above]),
          Math.abs(green - pixels[above + 1]),
          Math.abs(blue - pixels[above + 2]),
        );
        if (difference >= 42) strongEdges += 1;
      }
    }
  }

  const visibleRatio = visiblePixels / totalPixels;
  const averageLuminance = visiblePixels > 0 ? luminanceSum / visiblePixels : 0;
  const darkPixelRatio = visiblePixels > 0 ? darkPixels / visiblePixels : 1;
  const highContrastPixelRatio = visiblePixels > 0
    ? highContrastPixels / visiblePixels
    : 0;
  const nearWhitePixelRatio = visiblePixels > 0 ? nearWhitePixels / visiblePixels : 0;
  const opaqueRatio = visiblePixels > 0 ? opaquePixels / visiblePixels : 0;
  const colorBinCount = colorBins.size;
  const strongEdgeRatio = edgeComparisons > 0 ? strongEdges / edgeComparisons : 0;

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
  // A fully opaque, color-complex rectangle is almost certainly a photo, poster,
  // frame or backdrop rather than a title logo. Reject it and fall back to text.
  // This specifically prevents cached provider photos from occupying logo slots.
  const photographicRectangle =
    visibleRatio >= 0.82 &&
    opaqueRatio >= 0.94 &&
    (
      colorBinCount >= 120 ||
      (colorBinCount >= 48 && strongEdgeRatio >= 0.12)
    );

  // Hero title logos are expected to be wordmarks/title treatments. A moderately
  // narrow, fully opaque and visually complex rectangle is much more likely to
  // be a press photo or still. Prefer the plain text title over a false positive.
  const opaquePhotoLikeTitleCard =
    visibleRatio >= 0.94 &&
    opaqueRatio >= 0.98 &&
    width / Math.max(1, height) < 1.9 &&
    colorBinCount >= 36 &&
    strongEdgeRatio >= 0.08;

  // A logo image with a large opaque white matte looks like a white rectangle on
  // top of StreamLocal. Transparent white wordmarks are not affected because
  // their visibleRatio is low. Reject the matte and let ArtworkImage use an
  // alternate transparent logo or the plain title fallback instead.
  const opaqueWhiteMatte =
    visibleRatio >= 0.9 &&
    opaqueRatio >= 0.96 &&
    nearWhitePixelRatio >= 0.58;

  return {
    usable:
      visiblePixels > 8 &&
      visibleRatio > 0.002 &&
      !unreadableOnDark &&
      !portraitLike &&
      !photographicRectangle &&
      !opaquePhotoLikeTitleCard &&
      !opaqueWhiteMatte,
    visiblePixels,
    visibleRatio,
    averageLuminance,
    darkPixelRatio,
    highContrastPixelRatio,
    nearWhitePixelRatio,
    opaqueRatio,
    colorBinCount,
    strongEdgeRatio,
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
