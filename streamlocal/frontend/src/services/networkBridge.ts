export type NetworkPickedFolder = {
  path: string;
  name: string;
};

export type NetworkScannedFile = {
  relativePath: string;
  fileName: string;
  extension: string;
  size: number;
  lastModified: number;
  fingerprint?: string;
};

export type NetworkScanResult = {
  files: NetworkScannedFile[];
};

const NETWORK_PREFIX = "/__streamlocal_network";
let availability: Promise<boolean> | null = null;

function sameOriginUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  }
  return url.toString();
}

async function networkFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(sameOriginUrl(`${NETWORK_PREFIX}${path}`), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    if (contentType.includes("application/json")) {
      try {
        const body = await response.json() as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // Keep the HTTP status when malformed JSON is returned.
      }
    }
    throw new Error(message);
  }
  if (!contentType.includes("application/json")) {
    throw new Error(
      "The StreamLocal local server returned HTML instead of JSON. Close old StreamLocal server processes and start this Portable again with Start StreamLocal.cmd.",
    );
  }
  return response;
}

export function isWebsitePortableOrigin(): boolean {
  return window.location.hostname === "127.0.0.1" && window.location.port === "17836";
}

export async function networkBridgeAvailable(): Promise<boolean> {
  if (!isWebsitePortableOrigin()) return false;
  if (!availability) {
    availability = fetch(sameOriginUrl(`${NETWORK_PREFIX}/status`), {
      headers: { Accept: "application/json" },
    })
      .then((response) =>
        response.ok && (response.headers.get("content-type")?.toLowerCase().includes("application/json") ?? false),
      )
      .catch(() => false);
  }
  return availability;
}

export async function validateNetworkFolder(path: string): Promise<NetworkPickedFolder> {
  const response = await networkFetch(`/validate-root?root=${encodeURIComponent(path)}`);
  return response.json() as Promise<NetworkPickedFolder>;
}

export async function scanNetworkFolder(root: string, recursive: boolean): Promise<NetworkScanResult> {
  const response = await networkFetch(`/scan?root=${encodeURIComponent(root)}&recursive=${recursive ? "1" : "0"}`);
  return response.json() as Promise<NetworkScanResult>;
}

export async function networkFingerprint(root: string, relativePath: string): Promise<string> {
  const response = await networkFetch(`/fingerprint?root=${encodeURIComponent(root)}&relative=${encodeURIComponent(relativePath)}`);
  const body = await response.json() as { fingerprint: string };
  return body.fingerprint;
}

export function networkMediaUrl(root: string, relativePath: string): string {
  return sameOriginUrl(`${NETWORK_PREFIX}/media`, { root, relative: relativePath });
}

export function networkFileUrl(root: string, relativePath: string): string {
  return sameOriginUrl(`${NETWORK_PREFIX}/file`, { root, relative: relativePath });
}

export async function networkReadText(root: string, relativePath: string): Promise<string | null> {
  const response = await fetch(sameOriginUrl(`${NETWORK_PREFIX}/text`, { root, relative: relativePath }), {
    headers: { Accept: "text/plain" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not read ${relativePath}.`);
  return response.text();
}

export async function networkReadFile(root: string, relativePath: string): Promise<File | null> {
  const response = await fetch(networkFileUrl(root, relativePath));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not read ${relativePath}.`);
  const blob = await response.blob();
  const fileName = relativePath.split("/").pop() ?? "file";
  return new File([blob], fileName, { type: blob.type, lastModified: Date.now() });
}

export function networkParentPath(relativePath: string): { directory: string; stem: string } | null {
  const parts = relativePath.split("/").filter(Boolean);
  if (!parts.length) return null;
  const fileName = parts.pop()!;
  return {
    directory: parts.join("/"),
    stem: fileName.replace(/\.[^.]+$/, ""),
  };
}

export function networkJoinRelative(directory: string, name: string): string {
  return directory ? `${directory}/${name}` : name;
}
