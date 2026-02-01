import { useState, useCallback } from 'react';

export const useProjectContext = (directoryHandle: FileSystemDirectoryHandle | null) => {
    const [context, setContext] = useState<string>("");
    const [isScanning, setIsScanning] = useState(false);
    const [cacheName, setCacheName] = useState<string | null>(null);
    const [isCaching, setIsCaching] = useState(false);

    const createCache = useCallback(async (projectContext: string) => {
        setIsCaching(true);
        try {
            const response = await fetch('http://localhost:5000/api/cache-codebase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectFiles: projectContext })
            });
            const data = await response.json();
            if (data.cacheName) {
                setCacheName(data.cacheName);
                console.log("Cache created:", data.cacheName);
            }
        } catch (error) {
            console.error("Failed to create cache:", error);
        } finally {
            setIsCaching(false);
        }
    }, []);

    const scanProject = useCallback(async () => {
        if (!directoryHandle) return;
        setIsScanning(true);
        let fullContext = "";

        const processHandle = async (handle: FileSystemDirectoryHandle | FileSystemFileHandle, currentPath: string = "") => {
            const name = handle.name;
            const fullPath = currentPath ? `${currentPath}/${name}` : name;

            if (handle.kind === 'file') {
                if (name.match(/\.(tsx|ts|js|jsx|css|json|html|md)$/) &&
                    !fullPath.includes('node_modules') &&
                    !fullPath.includes('dist') &&
                    !name.startsWith('.')) {

                    try {
                        const file = await (handle as FileSystemFileHandle).getFile();
                        const text = await file.text();
                        fullContext += `\n// File: ${fullPath}\n${text}\n`;
                    } catch (e) {
                        console.error(`Failed to read file ${fullPath}:`, e);
                    }
                }
            } else if (handle.kind === 'directory') {
                if (name === 'node_modules' || name === '.git' || name === 'dist') return;

                // @ts-expect-error - Async iterator standard
                for await (const entry of (handle as FileSystemDirectoryHandle).values()) {
                    await processHandle(entry, fullPath);
                }
            }
        };

        try {
            await processHandle(directoryHandle);
            setContext(fullContext);
            console.log("Project context scanned:", fullContext.length, "characters");

            // Automatically create cache after scanning
            if (fullContext) {
                createCache(fullContext);
            }
        } catch (error) {
            console.error("Failed to scan project:", error);
        } finally {
            setIsScanning(false);
        }
    }, [directoryHandle, createCache]);

    return { context, scanProject, isScanning, cacheName, isCaching };
};
