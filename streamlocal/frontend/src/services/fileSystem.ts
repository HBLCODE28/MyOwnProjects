import { nativeDesktopAvailable, pickNativeFolder } from "./nativeDesktop";

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
  handle: FileSystemDirectoryHandle | null;
  nativePath: string | null;
};

export async function chooseLibraryLocation(): Promise<ChosenLibraryLocation> {
  if (await nativeDesktopAvailable()) {
    const selected = await pickNativeFolder();
    return {
      name: selected.name,
      handle: null,
      nativePath: selected.path,
    };
  }

  if (!window.showDirectoryPicker) {
    throw new Error(
      "Folder access is unavailable in this browser. Use StreamLocal for Windows, or current Microsoft Edge / Google Chrome."
    );
  }

  const handle = await window.showDirectoryPicker({
    mode: "read",
    id: "streamlocal-library"
  });
  return { name: handle.name, handle, nativePath: null };
}

export async function chooseDirectory(): Promise<FileSystemDirectoryHandle> {
  const selected = await chooseLibraryLocation();
  if (!selected.handle) {
    throw new Error("This folder is connected through the StreamLocal Windows app, not the browser File System Access API.");
  }
  return selected.handle;
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
