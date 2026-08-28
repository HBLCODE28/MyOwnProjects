declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite";
      id?: string;
      startIn?: string;
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

export type ChosenLibraryLocation = {
  name: string;
  handle: FileSystemDirectoryHandle;
  nativePath: null;
};

/**
 * Browser-only folder selection.
 *
 * StreamLocal intentionally uses the File System Access API here instead of
 * depending on the retired Windows/native bridge. This keeps Library buttons
 * working in normal Chrome/Edge and preserves the browser-only architecture.
 */
export async function chooseLibraryLocation(): Promise<ChosenLibraryLocation> {
  if (!window.showDirectoryPicker) {
    throw new Error(
      "Folder access is unavailable in this browser. Open StreamLocal in a current Google Chrome or Microsoft Edge window over http://127.0.0.1 or HTTPS.",
    );
  }

  const handle = await window.showDirectoryPicker({
    mode: "read",
    id: "streamlocal-library",
  });

  return { name: handle.name, handle, nativePath: null };
}

export async function chooseDirectory(): Promise<FileSystemDirectoryHandle> {
  return (await chooseLibraryLocation()).handle;
}

export async function verifyReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const options = { mode: "read" as const };
  const query = await handle.queryPermission(options);
  if (query === "granted") return true;
  const request = await handle.requestPermission(options);
  return request === "granted";
}

export async function getFileFromRelativePath(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<File | null> {
  const parts = relativePath.split("/").filter(Boolean);
  if (!parts.length) return null;

  let directory = root;
  for (const part of parts.slice(0, -1)) {
    try {
      directory = await directory.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }

  try {
    const fileHandle = await directory.getFileHandle(parts[parts.length - 1]);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}
