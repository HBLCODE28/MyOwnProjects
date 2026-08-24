declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: "read" | "readwrite";
      id?: string;
      startIn?: string;
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

export async function chooseDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) {
    throw new Error(
      "This browser does not support folder access. Use the current Microsoft Edge or Google Chrome on Windows."
    );
  }

  return window.showDirectoryPicker({
    mode: "read",
    id: "streamlocal-library"
  });
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
  relativePath: string
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
