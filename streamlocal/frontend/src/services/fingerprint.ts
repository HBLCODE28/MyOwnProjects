const CHUNK_SIZE = 1024 * 1024;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashBlob(blob: Blob): Promise<string> {
  const data = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export async function createFingerprint(file: File): Promise<string> {
  const first = file.slice(0, Math.min(CHUNK_SIZE, file.size));
  const lastStart = Math.max(0, file.size - CHUNK_SIZE);
  const last = file.slice(lastStart, file.size);
  const [firstHash, lastHash] = await Promise.all([hashBlob(first), hashBlob(last)]);
  return `${file.size}:${firstHash}:${lastHash}`;
}
