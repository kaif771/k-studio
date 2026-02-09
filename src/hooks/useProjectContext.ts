import { useState, useCallback } from 'react';

export const useProjectContext = (directoryHandle: FileSystemDirectoryHandle | null) => {
    const [context, setContext] = useState<string>("");
    const [isScanning, setIsScanning] = useState(false);
    const [cacheName, setCacheName] = useState<string | null>(null);
    const [isCaching, setIsCaching] = useState(false);
    const [projectType, setProjectType] = useState<string | null>(null);
    const [framework, setFramework] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isLaunching, setIsLaunching] = useState(false);
    const [projectStatus, setProjectStatus] = useState<string | null>(null);

    const detectAndRunProject = useCallback(async (fileNames: string[], projectContext: string | null = null) => {
        if (!directoryHandle) return;
        setIsLaunching(true);
        console.log("🚀 Starting autonomous runner for:", directoryHandle.name);
        try {
            // 1. Detect project type
            const detectRes = await fetch('/api/detect-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderName: directoryHandle.name,
                    files: fileNames,
                    projectContext
                })
            });
            if (!detectRes.ok) {
                const errText = await detectRes.text().catch(() => null);
                console.error('detect-project failed:', detectRes.status, errText);
                return;
            }
            const projectInfo = await detectRes.json();
            setProjectType(projectInfo.type);
            setFramework(projectInfo.framework);
            console.log("📦 Detected project:", projectInfo.type, "Framework:", projectInfo.framework, "Port:", projectInfo.port);

            // 2. Run the project
            const runRes = await fetch('/api/run-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectName: directoryHandle.name,
                    projectType: projectInfo.type,
                    port: projectInfo.port
                })
            });
            if (!runRes.ok) {
                const errText = await runRes.text().catch(() => null);
                console.error('run-project failed:', runRes.status, errText);
                return;
            }
            const runInfo = await runRes.json();
            console.log("🎯 Run response:", runInfo);
            setProjectStatus(runInfo.status);

            if (runInfo.url) {
                setPreviewUrl(runInfo.url);
                console.log("✅ Autonomous runner started project at:", runInfo.url);
            } else {
                console.error("❌ No URL returned from run-project", runInfo.message);
            }
        } catch (error) {
            // Network errors will be caught here (e.g., backend not running). Make the
            // message clearer for developers while avoiding uncaught rejections.
            console.error("❌ Autonomous Project Runner Failed (network or server error):", error);
        } finally {
            console.log("🏁 Setting isLaunching to false");
            setIsLaunching(false);
        }
    }, [directoryHandle]);

    const stopProject = useCallback(async () => {
        if (!directoryHandle) return;
        try {
            await fetch('/api/stop-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectName: directoryHandle.name })
            });
            console.log("Autonomous runner stopped project:", directoryHandle.name);
            // Only clear preview when stop succeeded.
            setPreviewUrl(null);
            setProjectType(null);
            setFramework(null);
            setProjectStatus(null);
        } catch (error) {
            console.error("Failed to stop project (is the local runner running?):", error);
        }
    }, [directoryHandle]);

    const createCache = useCallback(async (projectContext: string) => {
        setIsCaching(true);
        try {
            const response = await fetch('/api/cache-codebase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectFiles: projectContext })
            });
            if (!response.ok) {
                const body = await response.text().catch(() => null);
                console.error('cache-codebase failed:', response.status, body);
            } else {
                const data = await response.json();
                if (data.cacheName) {
                    setCacheName(data.cacheName);
                    console.log("Cache created:", data.cacheName);
                }
            }
        } catch (error) {
            console.error("Failed to create cache (network or server error):", error);
        } finally {
            setIsCaching(false);
        }
    }, []);

    const scanProject = useCallback(async () => {
        if (!directoryHandle) {
            console.log("📂 scanProject: No directory handle available.");
            return;
        }
        setIsScanning(true);
        // Reset preview state for new project
        setPreviewUrl(null);
        setProjectType(null);
        setFramework(null);
        setProjectStatus(null);

        console.log("📂 scanProject: Starting scan for:", directoryHandle.name);

        let fullContext = "";
        const fileNames: string[] = [];

        const processHandle = async (handle: FileSystemDirectoryHandle | FileSystemFileHandle, currentPath: string = "") => {
            const name = handle.name;
            const fullPath = currentPath ? `${currentPath}/${name}` : name;

            if (handle.kind === 'file') {
                fileNames.push(name);
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
            console.log(`📂 scanProject: Scan complete. Found ${fileNames.length} files.`);
            setContext(fullContext);

            // Trigger autonomous detection and running (include project context for better detection)
            console.log("📂 scanProject: Triggering detectAndRunProject...");
            detectAndRunProject(fileNames, fullContext);

            if (fullContext) {
                createCache(fullContext);
            }
        } catch (error) {
            console.error("Failed to scan project:", error);
        } finally {
            setIsScanning(false);
        }
    }, [directoryHandle, createCache, detectAndRunProject]);

    return {
        context,
        scanProject,
        isScanning,
        cacheName,
        isCaching,
        projectType,
        framework,
        projectStatus,
        previewUrl,
        isLaunching,
        stopProject
    };
};
