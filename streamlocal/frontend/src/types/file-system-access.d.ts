interface FileSystemHandle {
  queryPermission(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission(descriptor?: { mode?: "read" | "readwrite" }): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<
    [string, FileSystemFileHandle | FileSystemDirectoryHandle]
  >;
}

interface Window {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
    id?: string;
    startIn?: string;
  }) => Promise<FileSystemDirectoryHandle>;
  showOpenFilePicker?: (options?: {
    id?: string;
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle[]>;
}
