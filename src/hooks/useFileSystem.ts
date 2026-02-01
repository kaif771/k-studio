import { useState, useEffect, useCallback } from 'react';
import type { FileNode } from '../types';

export const useFileSystem = (directoryHandle: FileSystemDirectoryHandle | null) => {
    const [fileTree, setFileTree] = useState<FileNode[]>([]);

    const buildFileTree = useCallback(async (handle: FileSystemDirectoryHandle): Promise<FileNode[]> => {
        const nodes: FileNode[] = [];
        try {
            // @ts-expect-error - File System Access API types might be missing in some environments
            for await (const entry of handle.values()) {
                if (entry.kind === 'file') {
                    nodes.push({ name: entry.name, kind: 'file', handle: entry });
                } else if (entry.kind === 'directory') {
                    nodes.push({
                        name: entry.name,
                        kind: 'directory',
                        handle: entry,
                        children: [],
                        isOpen: false
                    });
                }
            }
        } catch (err) {
            console.error("Error building tree:", err);
        }
        return nodes.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1));
    }, []);

    const refreshTree = useCallback(async () => {
        if (!directoryHandle) {
            setFileTree([]);
            return;
        }
        const tree = await buildFileTree(directoryHandle);
        setFileTree(tree);
    }, [directoryHandle, buildFileTree]);

    useEffect(() => {
        refreshTree();
    }, [refreshTree]);

    const toggleFolder = async (node: FileNode) => {
        if (node.kind !== 'directory') return;

        const updateTree = async (nodes: FileNode[]): Promise<FileNode[]> => {
            return Promise.all(nodes.map(async (n) => {
                if (n.handle === node.handle) {
                    const isOpen = !n.isOpen;
                    let children = n.children;
                    if (isOpen && (!children || children.length === 0)) {
                        children = await buildFileTree(n.handle as FileSystemDirectoryHandle);
                    }
                    return { ...n, isOpen, children };
                }
                if (n.children) {
                    return { ...n, children: await updateTree(n.children) };
                }
                return n;
            }));
        };

        const newTree = await updateTree(fileTree);
        setFileTree(newTree);
    };

    const saveFile = async (handle: FileSystemFileHandle, content: string) => {
        try {

            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            console.log("File saved successfully");
        } catch (err) {
            console.error("Error saving file:", err);
            throw err;
        }
    };

    const createFile = async (name: string): Promise<FileSystemFileHandle | null> => {
        if (!directoryHandle) return null;
        try {
            const handle = await directoryHandle.getFileHandle(name, { create: true });
            await refreshTree();
            return handle;
        } catch (err) {
            console.error("Error creating file:", err);
            return null;
        }
    };

    const createFileAtPath = async (path: string, content: string): Promise<FileSystemFileHandle | null> => {
        if (!directoryHandle) return null;
        try {
            const parts = path.split('/').filter(p => p);
            const fileName = parts.pop()!;
            let currentDir = directoryHandle;

            for (const part of parts) {
                currentDir = await currentDir.getDirectoryHandle(part, { create: true });
            }

            const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
            await saveFile(fileHandle, content);
            await refreshTree();
            return fileHandle;
        } catch (err) {
            console.error(`Error creating file at path ${path}:`, err);
            return null;
        }
    };

    return { fileTree, toggleFolder, saveFile, createFile, createFileAtPath, refreshTree };
};
