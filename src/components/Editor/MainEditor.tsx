import React, { useCallback } from 'react';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useEditorState } from '../../hooks/useEditorState';
import { useProjectContext } from '../../hooks/useProjectContext';
import { EditorHeader } from './EditorHeader';
import { EditorFooter } from './EditorFooter';
import { FileExplorer } from './FileExplorer';
import { CodeEditor } from './CodeEditor';
import { AISidebar } from './AISidebar';
import { AIChatbot } from './AIChatbot';
import { PreviewPanel } from './PreviewPanel';
import { CommandPalette } from './CommandPalette';
import type { FileNode } from '../../types';

interface MainEditorProps {
    selectedProject: string;
    directoryHandle: FileSystemDirectoryHandle | null;
    onBack: () => void;
}

export const MainEditor: React.FC<MainEditorProps> = ({
    selectedProject,
    directoryHandle,
    onBack
}) => {
    const {
        fileTree,
        toggleFolder,
        saveFile,
        createFile,
        createFileAtPath
    } = useFileSystem(directoryHandle);

    const {
        activeFile,
        setActiveFile,
        activeFileHandle,
        setActiveFileHandle,
        code,
        setCode,
        isCommandOpen,
        setIsCommandOpen,
        isPreviewOpen,
        setIsPreviewOpen,
        isFileExplorerOpen,
        setIsFileExplorerOpen,
        isAISidebarOpen,
        setIsAISidebarOpen,
        prompt,
        setPrompt,
        image,
        setImage,
        isThinking,
        setIsThinking,
        pendingFiles,
        setPendingFiles
    } = useEditorState();

    const {
        context,
        scanProject,
        isScanning,
        cacheName,
        previewUrl,
        isLaunching,
        projectType,
        framework,
        projectStatus,
        stopProject
    } = useProjectContext(directoryHandle);

    // AI Response Parser Fallback
    const extractFilesFromMarkdown = (text: string) => {
        const files: { path: string, content: string }[] = [];
        // Catch ### filename.ext, **filename.ext**, File: filename.ext, etc.
        const fileHeaderRegex = /(?:###|##|#|File:?|Filename:?|\*\*)\s*(?:\d+\.?\s*)?[`*]?([a-zA-Z0-9._\-/ ]+\.[a-zA-Z0-9]+)[`*]?[\s\S]*?\n\s*```(?:[a-z]*)\n([\s\S]*?)```/gi;

        let match;
        while ((match = fileHeaderRegex.exec(text)) !== null) {
            files.push({
                path: match[1].trim(),
                content: match[2].trim()
            });
        }
        return files;
    };

    // Scan project when directoryHandle is available
    React.useEffect(() => {
        if (directoryHandle) {
            scanProject();
        }
        // Cleanup on project switch/unmount
        return () => {
            stopProject();
        };
    }, [directoryHandle, scanProject, stopProject]);

    const handleBack = useCallback(async () => {
        await stopProject();
        onBack();
    }, [stopProject, onBack]);

    const handleSave = useCallback(async () => {
        if (activeFileHandle) {
            await saveFile(activeFileHandle, code);
        }
    }, [activeFileHandle, code, saveFile]);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandOpen(true);
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave, setIsCommandOpen]);

    const handleFileSelect = (node: FileNode) => {
        if (node.kind === 'directory') {
            toggleFolder(node);
        } else {
            setActiveFile(node.name);
            setActiveFileHandle(node.handle as FileSystemFileHandle);
        }
    };

    const handleCreateFile = async (fileName: string) => {
        const handle = await createFile(fileName);
        if (handle) {
            setActiveFile(fileName);
            setActiveFileHandle(handle);
            setCode("");
        }
    };

    const handleArchitectRequest = async () => {
        if (!prompt.trim() && !image) return;
        setIsThinking(true);
        setIsCommandOpen(false);

        try {
            const response = await fetch('/api/architect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    projectContext: context,
                    image,
                    cacheName
                })
            });

            if (!response.ok) throw new Error("API request failed");

            const data = await response.json();
            console.log("Architect Response:", data);

            const thought = data.thought || "Processing...";
            const plan = data.plan || "";
            let files = data.files || [];

            // If files is empty but plan has code blocks, try to extract them
            if (files.length === 0 && plan) {
                console.log("No files in JSON, attempting markdown extraction...");
                files = extractFilesFromMarkdown(plan);
            }

            // Create the architect's thought/plan file first
            const planFileName = `Architect_Plan_${Date.now()}.md`;
            const planContent = `# Architect's Thought Process\n${thought}\n\n# Implementation Plan\n${plan}`;
            await createFileAtPath(planFileName, planContent);

            // Queue generated files for manual confirmation (User Activation)
            if (files && Array.isArray(files)) {
                console.log(`Queueing ${files.length} files for manual confirmation...`);
                setPendingFiles(prev => [...prev, ...files]);
            }

            // Set the plan as the active file for review
            setActiveFile(planFileName);
            setCode(planContent);

        } catch (error) {
            console.error("Architect failed:", error);
            alert("Architect failed to reason. Check console.");
        } finally {
            setIsThinking(false);
            setPrompt("");
            setImage(null);
        }
    };

    // Automatically open preview when an autonomous URL is detected
    // AND sync path for static projects
    const [finalUrl, setFinalUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        console.log("🔄 MainEditor: Preview effect triggered:", { previewUrl, projectType, activeFile, isLaunching });
        if (previewUrl) {
            setIsPreviewOpen(true);
            console.log("✅ MainEditor: Opening preview panel");

            // Handle framework-specific preview behavior.
            // For React-based dev servers (Vite, Next.js, CRA, Remix, Node dev servers)
            // the root preview URL is typically correct and supports client-side routing.
            const spaFrameworks = new Set(['vite', 'nextjs', 'react', 'remix', 'nodejs']);
            if (spaFrameworks.has(framework || '') || projectType !== 'static') {
                // Dev servers for these frameworks usually serve the app at the root.
                setFinalUrl(previewUrl.replace(/\/$/, ''));
                console.log("🌐 MainEditor: Dev/SPA project - Final URL:", previewUrl);
            } else {
                // Static projects (vanilla static sites) may need an explicit index.html entry.
                const entry = (activeFile && activeFile.endsWith('.html')) ? activeFile : 'index.html';
                const newUrl = `${previewUrl.replace(/\/$/, '')}/${entry}`;
                setFinalUrl(newUrl);
                console.log("📄 MainEditor: Static project - Final URL:", newUrl);
            }
        } else {
            console.log("⏳ MainEditor: No previewUrl, clearing finalUrl");
            setFinalUrl(null);
        }
    }, [previewUrl, projectType, activeFile, setIsPreviewOpen, framework, isLaunching]);

    const handleApplyPendingFiles = async () => {
        if (pendingFiles.length === 0) return;
        try {
            for (const file of pendingFiles) {
                await createFileAtPath(file.path, file.content);
            }
            setPendingFiles([]);
            alert("Architect's files applied successfully!");
        } catch (error) {
            console.error("Failed to apply architect files:", error);
            alert("Security Error: Please interact with the page or re-select the project folder.");
        }
    };

    return (
        <div className="h-screen w-full flex flex-col bg-[#000000] text-slate-300 overflow-hidden font-sans">
            <EditorHeader
                selectedProject={selectedProject}
                onBack={handleBack}
                isFileExplorerOpen={isFileExplorerOpen}
                onToggleFileExplorer={() => setIsFileExplorerOpen(!isFileExplorerOpen)}
                isAISidebarOpen={isAISidebarOpen}
                onToggleAISidebar={() => setIsAISidebarOpen(!isAISidebarOpen)}
            />

            <main className="flex flex-1 overflow-hidden relative">
                {isFileExplorerOpen && (
                    <div className="absolute inset-y-0 left-0 z-40 w-full sm:w-auto lg:relative lg:inset-auto">
                        <FileExplorer
                            activeFile={activeFile}
                            fileTree={fileTree}
                            onSelect={handleFileSelect}
                            onCreateFile={handleCreateFile}
                        />
                    </div>
                )}

                <div className="flex-1 flex flex-col min-w-0 relative">
                    <CodeEditor
                        activeFile={activeFile}
                        code={code}
                        setCode={setCode}
                    />
                    <AIChatbot
                        cacheName={cacheName}
                        createFileAtPath={createFileAtPath}
                        pendingFiles={pendingFiles}
                        setPendingFiles={setPendingFiles}
                    />

                    {/* Pending Files Notification for Architect */}
                    {pendingFiles.length > 0 && !isAISidebarOpen && (
                        <div className="absolute bottom-4 right-4 z-50 animate-bounce">
                            <button
                                onClick={handleApplyPendingFiles}
                                className="bg-cyan-500 text-black px-4 py-2 rounded-full font-black text-xs shadow-2xl"
                            >
                                APPLY {pendingFiles.length} CHANGES
                            </button>
                        </div>
                    )}

                    {/* Loading Overlay */}
                    {isThinking && (
                        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center flex-col gap-4 backdrop-blur-sm">
                            <div className="w-16 h-16 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin" />
                            <div className="text-cyan-400 font-mono animate-pulse">Gemini Architect is thinking...</div>
                        </div>
                    )}

                    {isPreviewOpen && (
                        <div className="absolute inset-0 z-50 bg-black">
                            <PreviewPanel
                                onClose={() => setIsPreviewOpen(false)}
                                externalUrl={finalUrl}
                                isLaunching={isLaunching}
                                framework={framework}
                                status={projectStatus}
                            />
                        </div>
                    )}
                </div>

                {isAISidebarOpen && (
                    <div className="absolute inset-y-0 right-0 z-40 w-full sm:w-auto lg:relative lg:inset-auto bg-[#0a0a0a] shadow-2xl lg:shadow-none">
                        <AISidebar projectContext={context} createFileAtPath={createFileAtPath} />
                    </div>
                )}

                <CommandPalette
                    isOpen={isCommandOpen}
                    setIsOpen={setIsCommandOpen}
                    prompt={prompt}
                    setPrompt={setPrompt}
                    image={image}
                    setImage={setImage}
                    onSubmit={handleArchitectRequest}
                    isScanning={isScanning}
                />
            </main>

            <EditorFooter
                isPreviewOpen={isPreviewOpen}
                onTogglePreview={() => setIsPreviewOpen(!isPreviewOpen)}
            />
        </div>
    );
};
