import React, { useCallback, useEffect, useState } from 'react';
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
import { Files, Sparkles, Settings, Play, X, Command } from 'lucide-react';

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
        createFileAtPath,
        refreshTree
    } = useFileSystem(directoryHandle);

    const {
        activeFile,
        activeFileHandle,
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
        setPendingFiles,
        openTabs,
        setOpenTabs,
        openTab,
        closeTab
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

    // Dynamic State Vectors for Hardware Accelerated Overlay aur Dual Switching Engine
    const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
    const [aiModel, setAiModel] = useState<'gemini-1.5-flash' | 'gemini-3.1-pro-preview'>('gemini-1.5-flash');
    const [finalUrl, setFinalUrl] = useState<string | null>(null);

    // Graphical Workspace Preferences Settings State (vscode.dev parity)
    const [settings, setSettings] = useState({
        fontSize: 13,
        fontFamily: 'JetBrains Mono, SF Mono, monospace',
        tabSize: 4,
        lineNumbers: 'on' as 'on' | 'off' | 'relative',
        cursorBlinking: 'smooth' as 'smooth' | 'blink' | 'solid',
        smoothScrolling: true,
    });
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // 🎯 CRITICAL RECENT WORKSPACE AUTO-RESET LOOP
    // Jab project switch ho ya handle reset ho, tab buffer khali karne ke liye hook
    useEffect(() => {
        console.log("🔄 Workspace Shift Detected For Project Target:", selectedProject);
        if (!directoryHandle) {
            console.warn("⚠️ Security Alert: Raw handle is null. Purging active text buffers.");
            if (typeof setOpenTabs === 'function') setOpenTabs([]);
            if (typeof setCode === 'function') setCode("");
        }
    }, [selectedProject, directoryHandle, setOpenTabs, setCode]);

    const refreshPreviewFrame = useCallback(() => {
        if (!previewUrl) return;
        const cleanUrl = previewUrl.replace(/([?&])t=\d+(&|$)/, '$1').replace(/[?&]$/, '');
        const separator = cleanUrl.includes('?') ? '&' : '?';
        setFinalUrl(`${cleanUrl}${separator}t=${Date.now()}`);
        console.log('🔁 Preview reload triggered with cache-busting token');
    }, [previewUrl]);

    const syncAndBuildWorkspace = useCallback(async (targetPath: string, content: string) => {
        const response = await fetch('/api/workspace/sync-and-build', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetPath, code: content, projectName: selectedProject })
        });

        if (!response.ok) {
            const message = await response.text().catch(() => 'Unknown error');
            throw new Error(message || 'Workspace sync and build request failed');
        }

        return response.json();
    }, [selectedProject]);

    // AI Response Parser Fallback
    const extractFilesFromMarkdown = (text: string) => {
        const files: { path: string, content: string }[] = [];
        try {
            const ticks = '`' + '`' + '`';
            const pattern = '(?:###|##|#|File:?|Filename:?|\\*\\*)\\s*(?:\\d+\\.?\\s*)?[`*]?([a-zA-Z0-9._\\-/ ]+\\.[a-zA-Z0-9]+)[`*]?[\\s\\S]*?\\n\\s*' + ticks + '[a-zA-Z0-9_-]*\\n([\\s\\S]*?)' + ticks;
            const fileHeaderRegex = new RegExp(pattern, 'gi');

            let match;
            while ((match = fileHeaderRegex.exec(text)) !== null) {
                files.push({
                    path: match[1].trim(),
                    content: match[2].trim()
                });
            }
        } catch (err) {
            console.error("Error parsing response markdown blocks:", err);
        }
        return files;
    };

    // DirectoryHandle active hone par project scan and initialization setup
    useEffect(() => {
        if (directoryHandle) {
            scanProject();
            const initSettings = async () => {
                try {
                    const settingsJson = JSON.stringify({
                        "workbench.iconTheme": "vs-seti",
                        "editor.fontSize": 13,
                        "editor.fontFamily": "JetBrains Mono, SF Mono, monospace",
                        "editor.smoothScrolling": true,
                        "editor.cursorBlinking": "smooth",
                        "terminal.integrated.fontSize": 12
                    }, null, 2);
                    await createFileAtPath('.vscode/settings.json', settingsJson);
                    console.log("✅ Auto-created .vscode/settings.json inside WORKSPACE_DIR");
                } catch (err) {
                    console.error("❌ Failed to auto-create settings.json:", err);
                }
            };
            initSettings();
        }
        return () => {
            stopProject();
        };
    }, [directoryHandle, scanProject, stopProject, createFileAtPath]);

    const handleBack = useCallback(async () => {
        await stopProject();
        onBack();
    }, [stopProject, onBack]);

    const handleSave = useCallback(async () => {
        if (!activeFileHandle || !activeFile) return;

        try {
            await saveFile(activeFileHandle, code);
            await syncAndBuildWorkspace(activeFile, code);
            refreshPreviewFrame();

            setOpenTabs(prev => prev.map(t => {
                if (t.id === activeFile) {
                    return { ...t, isDirty: false };
                }
                return t;
            }));

        } catch (error) {
            console.error('Failed to save and sync workspace:', error);
            alert(`Save failed: ${(error as Error).message || 'Unable to sync and build workspace.'}`);
        }
    }, [activeFileHandle, activeFile, code, saveFile, syncAndBuildWorkspace, refreshPreviewFrame, setOpenTabs]);

    useEffect(() => {
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

    const handleFileSelect = useCallback((node: FileNode) => {
        if (node.kind === 'directory') {
            toggleFolder(node);
        } else {
            openTab(node.name, node.handle as FileSystemFileHandle);
        }
    }, [toggleFolder, openTab]);

    const handleCreateFile = useCallback(async (fileName: string) => {
        const handle = await createFile(fileName);
        if (handle) {
            await openTab(fileName, handle, "");
        }
    }, [createFile, openTab]);

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
                    cacheName,
                    selectedModel: aiModel
                })
            });

            if (!response.ok) throw new Error("API request failed");

            const data = await response.json();
            console.log("Architect Response:", data);

            const thought = data.thought || "Processing...";
            const plan = data.plan || "";
            let files = data.files || [];

            if (files.length === 0 && plan) {
                files = extractFilesFromMarkdown(plan);
            }

            const planFileName = `Architect_Plan_${Date.now()}.md`;
            const planContent = `# Architect's Thought Process\n${thought}\n\n# Implementation Plan\n${plan}`;
            const planHandle = await createFileAtPath(planFileName, planContent);

            if (files && Array.isArray(files)) {
                setPendingFiles(prev => [...prev, ...files]);
            }

            if (planHandle) {
                await openTab(planFileName, planHandle, planContent);
            }

        } catch (error) {
            console.error("Architect failed:", error);
            alert("Architect failed to reason. Check console.");
        } finally {
            setIsThinking(false);
            setPrompt("");
            setImage(null);
        }
    };

    const loadSettings = useCallback(async () => {
        if (!directoryHandle) return;
        try {
            const dotVscode = await directoryHandle.getDirectoryHandle('.vscode');
            const settingsFile = await dotVscode.getFileHandle('settings.json');
            const file = await settingsFile.getFile();
            const text = await file.text();
            const data = JSON.parse(text);
            setSettings(prev => ({
                fontSize: Number(data["editor.fontSize"]) || prev.fontSize,
                fontFamily: data["editor.fontFamily"] || prev.fontFamily,
                tabSize: Number(data["editor.tabSize"]) || prev.tabSize,
                lineNumbers: data["editor.lineNumbers"] || prev.lineNumbers,
                cursorBlinking: data["editor.cursorBlinking"] || prev.cursorBlinking,
                smoothScrolling: data["editor.smoothScrolling"] !== undefined ? data["editor.smoothScrolling"] : prev.smoothScrolling,
            }));
            console.log("⚙️ Successfully loaded workspace settings.json preferences");
        } catch (err) {
            console.log("⚙️ Workspace settings.json not found, utilizing K-Studio default style tokens.");
        }
    }, [directoryHandle]);

    useEffect(() => {
        if (directoryHandle) {
            loadSettings();
        }
    }, [directoryHandle, loadSettings]);

    const handleUpdateSetting = async (key: string, value: any) => {
        const nextSettings = { ...settings, [key]: value };
        setSettings(nextSettings);

        try {
            const settingsJson = JSON.stringify({
                "workbench.iconTheme": "vs-seti",
                "editor.fontSize": nextSettings.fontSize,
                "editor.fontFamily": nextSettings.fontFamily,
                "editor.tabSize": nextSettings.tabSize,
                "editor.lineNumbers": nextSettings.lineNumbers,
                "editor.cursorBlinking": nextSettings.cursorBlinking,
                "editor.smoothScrolling": nextSettings.smoothScrolling,
                "terminal.integrated.fontSize": 12
            }, null, 2);
            await createFileAtPath('.vscode/settings.json', settingsJson);
            console.log("💾 Saved updated preferences directly to .vscode/settings.json");
        } catch (err) {
            console.error("❌ Failed to auto-save preferences:", err);
        }
    };

    // Static ya SPA live preview ke links mapping ke liye handler
    useEffect(() => {
        if (previewUrl) {
            const spaFrameworks = new Set(['vite', 'nextjs', 'react', 'remix', 'nodejs']);
            if (spaFrameworks.has(framework || '') || projectType !== 'static') {
                setFinalUrl(previewUrl.replace(/\/$/, ''));
                console.log("🌐 MainEditor: Dev/SPA project - Final URL:", previewUrl);
            } else {
                const entry = (activeFile && activeFile.endsWith('.html')) ? activeFile : 'index.html';
                const newUrl = `${previewUrl.replace(/\/$/, '')}/${entry}`;
                setFinalUrl(newUrl);
                console.log("📄 MainEditor: Static project - Final URL:", newUrl);
            }
        } else {
            setFinalUrl(null);
        }
    }, [previewUrl, projectType, activeFile, framework]);

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
        <div className="w-screen h-screen fixed overflow-hidden flex flex-col text-[#1D1D1F] font-sans antialiased bg-gradient-to-br from-[#E0F2FE] via-[#F3E8FF] to-[#FFEBEB]">
            <EditorHeader
                selectedProject={selectedProject}
                onBack={handleBack}
                isFileExplorerOpen={isFileExplorerOpen}
                onToggleFileExplorer={() => setIsFileExplorerOpen(!isFileExplorerOpen)}
                isAISidebarOpen={isAISidebarOpen}
                onToggleAISidebar={() => setIsAISidebarOpen(!isAISidebarOpen)}
            />

            {/* Workbench Viewport Area Layout */}
            <div className="flex flex-1 w-full min-h-0 overflow-hidden relative z-10">
                {/* 1. Activity Bar (Leftmost vertical strip) */}
                <div className="w-12 bg-white/40 backdrop-blur-3xl border-r border-white/50 flex flex-col items-center py-4 justify-between shrink-0 select-none shadow-lg">
                    {/* Top Group Tools */}
                    <div className="flex flex-col items-center gap-5 w-full">
                        {/* Files Explorer Trigger */}
                        <button
                            onClick={() => setIsFileExplorerOpen(!isFileExplorerOpen)}
                            className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${isFileExplorerOpen
                                    ? 'bg-white/60 text-[#4F46E5] shadow-sm border border-white/40 scale-105'
                                    : 'text-[#1D1D1F]/50 hover:text-[#1D1D1F] hover:bg-white/30'
                                }`}
                            title="Workspace File Explorer"
                        >
                            <Files size={18} strokeWidth={2.2} />
                        </button>

                        {/* Dedicated Command Palette Trigger */}
                        <button
                            onClick={() => setIsCommandOpen(true)}
                            className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${isCommandOpen
                                    ? 'bg-white/60 text-[#4F46E5] shadow-sm border border-white/40 scale-105'
                                    : 'text-[#1D1D1F]/50 hover:text-[#1D1D1F] hover:bg-white/30'
                                }`}
                            title="Open Command Palette (Ctrl+K)"
                        >
                            <Command size={18} strokeWidth={2.2} />
                        </button>

                        {/* AI Blueprint Actions Panel Trigger */}
                        <button
                            onClick={() => setIsAISidebarOpen(!isAISidebarOpen)}
                            className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${isAISidebarOpen
                                    ? 'bg-white/60 text-[#4F46E5] shadow-sm border border-white/40 scale-105'
                                    : 'text-[#1D1D1F]/50 hover:text-[#1D1D1F] hover:bg-white/30'
                                }`}
                            title="AI Actions Sidebar"
                        >
                            <Sparkles size={18} strokeWidth={2.2} />
                        </button>

                        {/* Preview Switch Trigger */}
                        <button
                            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
                            className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${isPreviewOpen
                                    ? 'bg-white/60 text-green-600 shadow-sm border border-white/40 scale-105'
                                    : 'text-[#1D1D1F]/50 hover:text-[#1D1D1F] hover:bg-white/30'
                                }`}
                            title="Live Code Preview"
                        >
                            <Play size={18} strokeWidth={2.2} />
                        </button>
                    </div>

                    {/* Bottom Group Settings */}
                    <div className="flex flex-col items-center">
                        <button
                            className="p-2 rounded-xl text-[#1D1D1F]/40 hover:text-[#1D1D1F] hover:bg-white/30 transition-all cursor-pointer"
                            title="Workspace Sync Settings"
                            onClick={() => setIsSettingsOpen(true)}
                        >
                            <Settings size={18} strokeWidth={2.2} />
                        </button>
                    </div>
                </div>

                {/* 2. Collapsible Workspace Sidebar (Explorer) */}
                {isFileExplorerOpen && (
                    <aside className="w-[260px] md:w-[280px] bg-white/40 backdrop-blur-3xl border-r border-white/50 flex flex-col shrink-0 min-h-0 overflow-hidden relative shadow-lg">
                        <div className="px-4 py-3 flex items-center justify-between border-b border-white/20 select-none shrink-0">
                            <span className="text-[10px] font-bold font-mono tracking-widest text-[#1D1D1F]/70 uppercase">
                                EXPLORER: {selectedProject.toUpperCase()}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <FileExplorer
                                activeFile={activeFile}
                                fileTree={fileTree}
                                onSelect={handleFileSelect}
                                onCreateFile={handleCreateFile}
                            />
                        </div>
                    </aside>
                )}

                {/* 3. Central Working Canvas Grid (Monaco Editor + Overlays) */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                    <div className="flex-1 flex flex-row gap-4 min-h-0 p-4 pb-2 relative">
                        <div className="flex-1 flex flex-col min-h-0 relative">
                            <CodeEditor
                                activeFile={activeFile}
                                code={code}
                                setCode={setCode}
                                openTabs={openTabs}
                                onSelectTab={openTab}
                                onCloseTab={closeTab}
                                settings={settings}
                            />

                            {/* Pending Files Notification overlay trigger */}
                            {pendingFiles.length > 0 && !isAISidebarOpen && (
                                <div className="absolute bottom-6 right-6 z-30 animate-bounce">
                                    <button
                                        onClick={handleApplyPendingFiles}
                                        className="bg-[#1D1D1F] hover:bg-[#2C2C2E] text-white px-4 py-2 rounded-full font-bold text-xs shadow-2xl cursor-pointer transition-all"
                                    >
                                        APPLY {pendingFiles.length} CHANGES
                                    </button>
                                </div>
                            )}

                            {/* Loading dynamic overlay logic */}
                            {isThinking && (
                                <div className="absolute inset-0 z-30 bg-[#DBEAFE]/80 flex items-center justify-center flex-col gap-4 backdrop-blur-sm rounded-2xl m-4">
                                    <div className="w-12 h-12 rounded-full border-4 border-[#1D1D1F] border-t-transparent animate-spin" />
                                    <div className="text-[#1D1D1F] font-mono text-xs uppercase tracking-wider animate-pulse">Gemini Architect is building...</div>
                                </div>
                            )}
                        </div>

                        {/* Live Server Preview Frame Overlay render segment */}
                        {isPreviewOpen && (
                            <div className="absolute inset-4 z-40 rounded-2xl overflow-hidden bg-[#F8FAFC]/45 backdrop-blur-2xl border border-white/50 shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
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
                </div>

                {/* 4. Collapsible Right AI Intelligence Sidebar */}
                {isAISidebarOpen && (
                    <aside className="w-[340px] md:w-[380px] bg-white/40 backdrop-blur-3xl border-l border-white/50 flex flex-col shrink-0 min-h-0 h-full overflow-hidden relative shadow-lg">
                        <div className="px-4 py-3 flex items-center justify-between border-b border-white/20 select-none shrink-0">
                            <span className="text-[10px] font-bold font-mono tracking-widest text-[#1D1D1F]/70 uppercase">
                                AI AGENT ACTION STACK
                            </span>
                            <button
                                onClick={() => setIsAISidebarOpen(false)}
                                className="text-[#86868B] hover:text-[#1D1D1F] p-0.5 rounded hover:bg-black/5 cursor-pointer"
                            >
                                <X size={12} strokeWidth={2.5} />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 pr-1 pb-6">
                            <AISidebar 
                                projectContext={context} 
                                createFileAtPath={createFileAtPath} 
                                onLaunchArchitect={() => setIsChatDrawerOpen(true)} 
                            />
                        </div>
                    </aside>
                )}
            </div>

            {/* Backdrop Dimmer overlay for premium floating panel layout stability */}
            {isChatDrawerOpen && (
                <div 
                    className="fixed inset-0 bg-black/15 backdrop-blur-xs z-[9998] transition-all duration-300 animate-in fade-in"
                    onClick={() => setIsChatDrawerOpen(false)}
                />
            )}

            {/* Premium Apple Style Floating Chatbot Drawer Interface */}
            <aside 
                className={`fixed inset-y-0 right-0 w-full sm:w-[460px] md:w-[520px] h-screen bg-white/75 backdrop-blur-2xl border-l border-white/30 shadow-2xl flex flex-col z-[9999] transition-transform duration-300 ease-in-out ${
                    isChatDrawerOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Drawer Control Area Headers */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-white/20 select-none shrink-0 bg-white/10">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-[11px] font-bold font-mono tracking-widest text-[#1D1D1F] uppercase">
                            AI ARCHITECT PLATFORM
                        </span>
                    </div>

                    {/* Model Switcher Configuration Hub */}
                    <div className="flex items-center gap-1 bg-black/5 p-1 rounded-lg border border-black/5 mr-2">
                        <button
                            type="button"
                            onClick={() => setAiModel('gemini-1.5-flash')}
                            className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider transition-all cursor-pointer ${
                                aiModel === 'gemini-1.5-flash' 
                                    ? 'bg-white text-neutral-900 shadow-xs' 
                                    : 'text-neutral-500 hover:text-neutral-900'
                            }`}
                        >
                            FLASH
                        </button>
                        <button
                            type="button"
                            onClick={() => setAiModel('gemini-3.1-pro-preview')}
                            className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider transition-all cursor-pointer ${
                                aiModel === 'gemini-3.1-pro-preview' 
                                    ? 'bg-white text-neutral-900 shadow-xs' 
                                    : 'text-neutral-500 hover:text-neutral-900'
                            }`}
                        >
                            PRO
                        </button>
                    </div>

                    <button
                        onClick={() => setIsChatDrawerOpen(false)}
                        className="text-[#86868B] hover:text-[#1D1D1F] p-1.5 rounded-full hover:bg-black/5 cursor-pointer transition-colors"
                    >
                        <X size={15} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Securely connected Context-Aware Chat Bot Component */}
                <div className="flex-1 min-h-0 overflow-hidden relative">
                    <AIChatbot
                        cacheName={cacheName}
                        createFileAtPath={createFileAtPath}
                        pendingFiles={pendingFiles}
                        setPendingFiles={setPendingFiles}
                        isDrawerMode={true}
                        projectContext={context}
                        selectedModel={aiModel}
                    />
                </div>
            </aside>

            {/* Global Utilities Palette search wrapper */}
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

            <EditorFooter
                isPreviewOpen={isPreviewOpen}
                onTogglePreview={() => setIsPreviewOpen(!isPreviewOpen)}
            />

            {/* 5. Premium Glassmorphic Settings Dialog Overlay */}
            {isSettingsOpen && (
                <div className="absolute inset-0 bg-black/15 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white/45 backdrop-blur-3xl border border-white/50 rounded-3xl shadow-2xl p-8 max-w-lg w-full flex flex-col gap-6 relative select-none animate-in fade-in zoom-in-95 duration-200">
                        <button
                            type="button"
                            onClick={() => setIsSettingsOpen(false)}
                            className="absolute top-4 right-4 text-[#86868B] hover:text-[#1D1D1F] p-1.5 rounded-full hover:bg-black/5 cursor-pointer transition-colors"
                        >
                            <X size={16} strokeWidth={2.5} />
                        </button>

                        <div className="flex items-center gap-3 border-b border-white/20 pb-4 shrink-0">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-md">
                                <Settings size={16} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-[#1D1D1F] tracking-wide uppercase font-mono leading-tight">Workspace Preferences</h3>
                                <p className="text-[10px] text-[#86868B] font-medium leading-normal mt-0.5">Configure and synchronize your K-Studio IDE runtime editor options</p>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col gap-5 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-[11px] font-bold font-mono tracking-wide text-[#1D1D1F]/70">
                                    <label htmlFor="pref-font-size" className="uppercase">Editor Font Size</label>
                                    <span className="bg-indigo-50 text-[#4F46E5] px-2 py-0.5 rounded-md border border-indigo-100/50">{settings.fontSize}px</span>
                                </div>
                                <input
                                    id="pref-font-size"
                                    type="range"
                                    min="10"
                                    max="24"
                                    value={settings.fontSize}
                                    onChange={(e) => handleUpdateSetting('fontSize', parseInt(e.target.value, 10))}
                                    className="w-full accent-[#4F46E5] h-1 bg-white/50 rounded-lg appearance-none cursor-pointer border border-white/30"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="pref-font-family" className="text-[11px] font-bold font-mono tracking-wide text-[#1D1D1F]/70 uppercase">Editor Font Family</label>
                                <select
                                    id="pref-font-family"
                                    value={settings.fontFamily}
                                    onChange={(e) => handleUpdateSetting('fontFamily', e.target.value)}
                                    className="w-full bg-white/40 border border-white/35 rounded-xl px-3 py-2 text-xs font-mono text-[#1D1D1F] outline-none shadow-sm focus:border-[#4F46E5]/40 transition-all cursor-pointer"
                                >
                                    <option value="JetBrains Mono, SF Mono, monospace">JetBrains Mono (Recommended)</option>
                                    <option value="Fira Code, SF Mono, monospace">Fira Code</option>
                                    <option value="SF Mono, Monaco, monospace">SF Mono</option>
                                    <option value="Courier New, Courier, monospace">Courier New</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold font-mono tracking-wide text-[#1D1D1F]/70 uppercase">Tab Size Spaces</span>
                                <div className="flex gap-2">
                                    {[2, 4, 8].map((size) => (
                                        <button
                                            key={size}
                                            type="button"
                                            onClick={() => handleUpdateSetting('tabSize', size)}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-xl border font-mono transition-all cursor-pointer ${settings.tabSize === size
                                                    ? 'bg-[#4F46E5] text-white border-[#4F46E5] shadow-sm'
                                                    : 'bg-white/40 text-[#1D1D1F]/60 border-white/35 hover:bg-white/60 hover:text-[#1D1D1F]'
                                                }`}
                                        >
                                            {size} Spaces
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold font-mono tracking-wide text-[#1D1D1F]/70 uppercase">Line Numbers Mode</span>
                                <div className="flex gap-2">
                                    {['on', 'off', 'relative'].map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => handleUpdateSetting('lineNumbers', mode as any)}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-xl border font-mono uppercase tracking-wider transition-all cursor-pointer ${settings.lineNumbers === mode
                                                    ? 'bg-[#4F46E5] text-white border-[#4F46E5] shadow-sm'
                                                    : 'bg-white/40 text-[#1D1D1F]/60 border-white/35 hover:bg-white/60 hover:text-[#1D1D1F]'
                                                }`}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-bold font-mono tracking-wide text-[#1D1D1F]/70 uppercase">Cursor Blinking Style</span>
                                <div className="flex gap-2">
                                    {['smooth', 'blink', 'solid'].map((style) => (
                                        <button
                                            key={style}
                                            type="button"
                                            onClick={() => handleUpdateSetting('cursorBlinking', style as any)}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-xl border font-mono uppercase tracking-wider transition-all cursor-pointer ${settings.cursorBlinking === style
                                                    ? 'bg-[#4F46E5] text-white border-[#4F46E5] shadow-sm'
                                                    : 'bg-white/40 text-[#1D1D1F]/60 border-white/35 hover:bg-white/60 hover:text-[#1D1D1F]'
                                                }`}
                                        >
                                            {style}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-1 cursor-pointer select-none" onClick={() => handleUpdateSetting('smoothScrolling', !settings.smoothScrolling)}>
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-bold font-mono tracking-wide text-[#1D1D1F]/70 uppercase">Smooth Editor Scrolling</span>
                                    <span className="text-[9px] text-[#86868B] font-medium leading-normal mt-0.5">Enables premium, fluid inertia-based scrolling tracks</span>
                                </div>
                                <button
                                    type="button"
                                    className={`w-10 h-5 rounded-full p-0.5 transition-all cursor-pointer duration-300 border ${settings.smoothScrolling
                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-500 border-indigo-500'
                                            : 'bg-white/30 border-white/40'
                                        }`}
                                >
                                    <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-300 ${settings.smoothScrolling ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>

                        <div className="border-t border-white/20 pt-4 flex items-center justify-between shrink-0 font-mono text-[9px] font-bold text-[#86868B]">
                            <span>PREFERENCES ENCRYPTED & LOCKED</span>
                            <button
                                type="button"
                                onClick={() => setIsSettingsOpen(false)}
                                className="bg-[#4F46E5] hover:bg-indigo-700 text-white font-bold text-xs uppercase px-5 py-2 rounded-xl transition-all cursor-pointer shadow-md hover:shadow-lg"
                            >
                                Apply changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};