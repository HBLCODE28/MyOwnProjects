const PRODUCTION_SENTENCE = /\b(?:directed|written|produced|starring|cast|released|filmed|filming|box office|critical reception|awards?|created|developed|production|premiered|screenplay|executive producer)\b/i;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value: string): string {
  return decodeEntities(value)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function concisePlotSummary(
  value: string | null | undefined,
  maxCharacters = 420,
): string {
  if (!value || maxCharacters <= 0) return "";

  const sentences = cleanText(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !PRODUCTION_SENTENCE.test(sentence));

  if (sentences.length === 0) return "";

  let result = "";
  for (const sentence of sentences.slice(0, 3)) {
    const candidate = result ? `${result} ${sentence}` : sentence;
    if (candidate.length > maxCharacters) break;
    result = candidate;
  }

  if (result) return result;

  const clipped = sentences[0].slice(0, maxCharacters).trimEnd();
  return clipped.length < sentences[0].length ? `${clipped}…` : clipped;
}
