import { useState, useEffect, useCallback } from 'react';
import type { FileNode } from '../types';

export const useFileSystem = (directoryHandle: FileSystemDirectoryHandle | null) => {
    const [fileTree, setFileTree] = useState<FileNode[]>([]);

    const buildFileTree = useCallback(async (handle: FileSystemDirectoryHandle, currentPath = ""): Promise<FileNode[]> => {
        const nodes: FileNode[] = [];
        try {
            // @ts-expect-error - File System Access API types might be missing in some environments
            for await (const entry of handle.values()) {
                const nodePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                if (entry.kind === 'file') {
                    nodes.push({ name: entry.name, kind: 'file', handle: entry, path: nodePath });
                } else if (entry.kind === 'directory') {
                    nodes.push({
                        name: entry.name,
                        kind: 'directory',
                        handle: entry,
                        path: nodePath,
                        children: [],
                        isOpen: false
                    });
                }
            }
        } catch (err) {
            console.error("Error building tree:", err);
        }
        
        // Native VS Code Sorting Protocol: Folders alphabetically at the top, files grouped at the bottom
        return nodes.sort((a, b) => {
            if (a.kind !== b.kind) {
                return a.kind === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
        });
    }, []);

    const refreshTree = useCallback(async () => {
        if (!directoryHandle) {
            console.log("⚠️ No directory handle available. Clearing tree visualization node.");
            setFileTree([]);
            return;
        }
        const tree = await buildFileTree(directoryHandle);
        setFileTree(tree);
    }, [directoryHandle, buildFileTree]);

    useEffect(() => {
        refreshTree();
    }, [refreshTree]);

    const toggleFolder = useCallback(async (node: FileNode) => {
        if (node.kind !== 'directory') return;

        const updateTree = async (nodes: FileNode[]): Promise<FileNode[]> => {
            return Promise.all(nodes.map(async (n) => {
                if (n.handle === node.handle) {
                    const isOpen = !n.isOpen;
                    let children = n.children;
                    if (isOpen && (!children || children.length === 0)) {
                        children = await buildFileTree(n.handle as FileSystemDirectoryHandle, n.path);
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
    }, [fileTree, buildFileTree]);

    const saveFile = useCallback(async (handle: FileSystemFileHandle, content: string) => {
        try {
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            console.log("File saved successfully");
        } catch (err) {
            console.error("Error saving file:", err);
            throw err;
        }
    }, []);

    // Create File - CRUD Integration
    const createFile = useCallback(async (name: string, parentNode?: FileNode): Promise<FileSystemFileHandle | null> => {
        if (!directoryHandle) return null;
        try {
            const parentDirHandle = parentNode ? (parentNode.handle as FileSystemDirectoryHandle) : directoryHandle;
            const newFileHandle = await parentDirHandle.getFileHandle(name, { create: true });
            
            // Sync with backend disk storage
            const targetPath = parentNode ? `${parentNode.path}/${name}` : name;
            await fetch('/api/fs/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: targetPath,
                    kind: 'file',
                    projectName: directoryHandle.name
                })
            }).catch(e => console.warn('Failed to sync file creation on server:', e));

            await refreshTree();
            return newFileHandle;
        } catch (err) {
            console.error("Error creating file:", err);
            return null;
        }
    }, [directoryHandle, refreshTree]);

    // Create Folder - CRUD Integration
    const createFolder = useCallback(async (name: string, parentNode?: FileNode): Promise<FileSystemDirectoryHandle | null> => {
        if (!directoryHandle) return null;
        try {
            const parentDirHandle = parentNode ? (parentNode.handle as FileSystemDirectoryHandle) : directoryHandle;
            const newDirHandle = await parentDirHandle.getDirectoryHandle(name, { create: true });
            
            // Sync with backend disk storage
            const targetPath = parentNode ? `${parentNode.path}/${name}` : name;
            await fetch('/api/fs/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: targetPath,
                    kind: 'directory',
                    projectName: directoryHandle.name
                })
            }).catch(e => console.warn('Failed to sync folder creation on server:', e));

            await refreshTree();
            return newDirHandle;
        } catch (err) {
            console.error("Error creating directory:", err);
            return null;
        }
    }, [directoryHandle, refreshTree]);

    // Rename file or directory - CRUD Integration
    const renameNode = useCallback(async (node: FileNode, newName: string, parentNode?: FileNode): Promise<boolean> => {
        if (!directoryHandle) return false;
        try {
            const parentDirHandle = parentNode ? (parentNode.handle as FileSystemDirectoryHandle) : directoryHandle;
            const handle = node.handle;
            
            // Web standard FileSystemHandle.move check (Chrome, Edge, etc.)
            // @ts-expect-error - move may not be fully typed in standard types
            if (typeof handle.move === 'function') {
                // @ts-expect-error - move standard API
                await handle.move(newName);
            } else {
                // Fallback for file renaming when move is unsupported
                if (node.kind === 'file') {
                    const file = await (handle as FileSystemFileHandle).getFile();
                    const text = await file.text();
                    const newFileHandle = await parentDirHandle.getFileHandle(newName, { create: true });
                    const writable = await newFileHandle.createWritable();
                    await writable.write(text);
                    await writable.close();
                    await parentDirHandle.removeEntry(node.name);
                } else {
                    throw new Error("Directory renaming not supported in this browser version.");
                }
            }

            // Sync with backend disk storage
            const oldPath = node.path;
            const dirPrefix = node.path.substring(0, node.path.lastIndexOf('/') + 1);
            const newPath = dirPrefix + newName;
            
            await fetch('/api/fs/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oldPath,
                    newPath,
                    projectName: directoryHandle.name
                })
            }).catch(e => console.warn('Failed to sync rename on server:', e));

            await refreshTree();
            return true;
        } catch (err) {
            console.error("Error renaming node:", err);
            return false;
        }
    }, [directoryHandle, refreshTree]);

    // Delete node - CRUD Integration
    const deleteNode = useCallback(async (node: FileNode, parentNode?: FileNode): Promise<boolean> => {
        if (!directoryHandle) return false;
        try {
            const parentDirHandle = parentNode ? (parentNode.handle as FileSystemDirectoryHandle) : directoryHandle;
            await parentDirHandle.removeEntry(node.name, { recursive: true });

            // Sync with backend disk storage
            await fetch('/api/fs/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: node.path,
                    projectName: directoryHandle.name
                })
            }).catch(e => console.warn('Failed to sync deletion on server:', e));

            await refreshTree();
            return true;
        } catch (err) {
            console.error("Error deleting file/directory:", err);
            return false;
        }
    }, [directoryHandle, refreshTree]);

    // Move node (Drag and Drop / Cut-Paste) - CRUD Integration
    const moveNode = useCallback(async (node: FileNode, targetParentNode?: FileNode, currentParentNode?: FileNode): Promise<boolean> => {
        if (!directoryHandle) return false;
        try {
            const sourceParentDirHandle = currentParentNode ? (currentParentNode.handle as FileSystemDirectoryHandle) : directoryHandle;
            const targetParentDirHandle = targetParentNode ? (targetParentNode.handle as FileSystemDirectoryHandle) : directoryHandle;
            
            const handle = node.handle;
            
            // Web standard FileSystemHandle.move check (Chrome, Edge, etc.)
            // @ts-expect-error - move may not be fully typed
            if (typeof handle.move === 'function') {
                // @ts-expect-error - move to target directory handle
                await handle.move(targetParentDirHandle, node.name);
            } else {
                // Fallback for file moves when .move is unsupported
                if (node.kind === 'file') {
                    const file = await (handle as FileSystemFileHandle).getFile();
                    const text = await file.text();
                    const newFileHandle = await targetParentDirHandle.getFileHandle(node.name, { create: true });
                    const writable = await newFileHandle.createWritable();
                    await writable.write(text);
                    await writable.close();
                    await sourceParentDirHandle.removeEntry(node.name);
                } else {
                    throw new Error("Folder moves not supported in this browser version.");
                }
            }

            // Sync with backend disk storage
            const sourcePath = node.path;
            const targetPath = targetParentNode ? `${targetParentNode.path}/${node.name}` : node.name;
            
            await fetch('/api/fs/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourcePath,
                    targetPath,
                    projectName: directoryHandle.name
                })
            }).catch(e => console.warn('Failed to sync move on server:', e));

            await refreshTree();
            return true;
        } catch (err) {
            console.error("Error moving node:", err);
            return false;
        }
    }, [directoryHandle, refreshTree]);

    // Copy node - Recursive Client + Server sync copy action
    const copyNode = useCallback(async (node: FileNode, targetParentNode?: FileNode): Promise<boolean> => {
        if (!directoryHandle) return false;
        try {
            const targetParentDirHandle = targetParentNode ? (targetParentNode.handle as FileSystemDirectoryHandle) : directoryHandle;
            
            const recursiveCopy = async (source: FileNode, destDir: FileSystemDirectoryHandle, currentDestPath: string) => {
                const name = source.name;
                const newPath = currentDestPath ? `${currentDestPath}/${name}` : name;
                
                if (source.kind === 'file') {
                    const file = await (source.handle as FileSystemFileHandle).getFile();
                    const text = await file.text();
                    const newFileHandle = await destDir.getFileHandle(name, { create: true });
                    const writable = await newFileHandle.createWritable();
                    await writable.write(text);
                    await writable.close();
                    
                    // Create and write to server disk path
                    await fetch('/api/fs/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: newPath, kind: 'file', projectName: directoryHandle.name })
                    });
                    await fetch('/api/workspace/sync-and-build', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ targetPath: newPath, code: text, projectName: directoryHandle.name })
                    });
                } else if (source.kind === 'directory') {
                    const newDirHandle = await destDir.getDirectoryHandle(name, { create: true });
                    
                    // Create directory on server
                    await fetch('/api/fs/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: newPath, kind: 'directory', projectName: directoryHandle.name })
                    });
                    
                    // Load children to copy recursively
                    let children = source.children;
                    if (!children || children.length === 0) {
                        children = await buildFileTree(source.handle as FileSystemDirectoryHandle, source.path);
                    }
                    for (const child of children) {
                        await recursiveCopy(child, newDirHandle, newPath);
                    }
                }
            };
            
            await recursiveCopy(node, targetParentDirHandle, targetParentNode ? targetParentNode.path : "");
            await refreshTree();
            return true;
        } catch (err) {
            console.error("Error copying node:", err);
            return false;
        }
    }, [directoryHandle, buildFileTree, refreshTree]);

    const createFileAtPath = useCallback(async (path: string, content: string): Promise<FileSystemFileHandle | null> => {
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
    }, [directoryHandle, saveFile, refreshTree]);

    return { 
        fileTree, 
        toggleFolder, 
        saveFile, 
        createFile, 
        createFolder,
        renameNode,
        deleteNode,
        moveNode,
        copyNode,
        createFileAtPath, 
        refreshTree 
    };
};
