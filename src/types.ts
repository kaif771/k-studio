export type FileNode = {
    name: string;
    kind: 'file' | 'directory';
    handle: FileSystemFileHandle | FileSystemDirectoryHandle;
    children?: FileNode[];
    isOpen?: boolean;
}

export type RecentProject = {
    name: string;
    path: string;
}
