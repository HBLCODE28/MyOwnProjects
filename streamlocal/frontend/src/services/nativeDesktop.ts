export type NativePickedFolder = {
  path: string;
  name: string;
};

export type NativeScannedFile = {
  relativePath: string;
  fileName: string;
  extension: string;
  size: number;
  lastModified: number;
  fingerprint?: string;
};

export type NativeScanResult = {
  files: NativeScannedFile[];
};

const NATIVE_PREFIX = "/__streamlocal_native";
let desktopAvailability: Promise<boolean> | null = null;

function sameOriginUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  }
  return url.toString();
}

async function nativeFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(sameOriginUrl(`${NATIVE_PREFIX}${path}`), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the HTTP status when the response is not JSON.
    }
    throw new Error(message);
  }
  return response;
}

export function isNativeDesktopOrigin(): boolean {
  return window.location.hostname === "127.0.0.1" && window.location.port === "17836";
}


export function startNativeDesktopHeartbeat(): () => void {
  if (!isNativeDesktopOrigin()) return () => {};
  const ping = () => {
    void fetch(sameOriginUrl(`${NATIVE_PREFIX}/heartbeat`), { method: "POST" }).catch(() => {});
  };
  ping();
  const timer = window.setInterval(ping, 7000);
  return () => window.clearInterval(timer);
}

export async function nativeDesktopAvailable(): Promise<boolean> {
  if (!isNativeDesktopOrigin()) return false;
  if (!desktopAvailability) {
    desktopAvailability = fetch(sameOriginUrl(`${NATIVE_PREFIX}/status`), {
      headers: { Accept: "application/json" },
    })
      .then((response) => response.ok)
      .catch(() => false);
  }
  return desktopAvailability;
}

export async function pickNativeFolder(): Promise<NativePickedFolder> {
  const response = await nativeFetch("/pick-folder", { method: "POST" });
  return response.json() as Promise<NativePickedFolder>;
}


export async function validateNativeFolder(path: string): Promise<NativePickedFolder> {
  const response = await nativeFetch(`/validate-root?root=${encodeURIComponent(path)}`);
  return response.json() as Promise<NativePickedFolder>;
}

export async function scanNativeFolder(root: string, recursive: boolean): Promise<NativeScanResult> {
  const response = await nativeFetch(`/scan?root=${encodeURIComponent(root)}&recursive=${recursive ? "1" : "0"}`);
  return response.json() as Promise<NativeScanResult>;
}


export async function nativeFingerprint(root: string, relativePath: string): Promise<string> {
  const response = await nativeFetch(`/fingerprint?root=${encodeURIComponent(root)}&relative=${encodeURIComponent(relativePath)}`);
  const body = await response.json() as { fingerprint: string };
  return body.fingerprint;
}

export function nativeMediaUrl(root: string, relativePath: string): string {
  return sameOriginUrl(`${NATIVE_PREFIX}/media`, { root, relative: relativePath });
}

export function nativeFileUrl(root: string, relativePath: string): string {
  return sameOriginUrl(`${NATIVE_PREFIX}/file`, { root, relative: relativePath });
}

export async function nativeReadText(root: string, relativePath: string): Promise<string | null> {
  const response = await fetch(sameOriginUrl(`${NATIVE_PREFIX}/text`, { root, relative: relativePath }), {
    headers: { Accept: "text/plain" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not read ${relativePath}.`);
  return response.text();
}

export async function nativeReadFile(root: string, relativePath: string): Promise<File | null> {
  const response = await fetch(nativeFileUrl(root, relativePath));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not read ${relativePath}.`);
  const blob = await response.blob();
  const fileName = relativePath.split("/").pop() ?? "file";
  return new File([blob], fileName, { type: blob.type, lastModified: Date.now() });
}

export function nativeParentPath(relativePath: string): { directory: string; stem: string } | null {
  const parts = relativePath.split("/").filter(Boolean);
  if (!parts.length) return null;
  const fileName = parts.pop()!;
  return {
    directory: parts.join("/"),
    stem: fileName.replace(/\.[^.]+$/, ""),
  };
}

export function nativeJoinRelative(directory: string, name: string): string {
  return directory ? `${directory}/${name}` : name;
}
