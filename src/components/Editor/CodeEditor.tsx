import React from 'react';
import MonacoEditor from '@monaco-editor/react';
import { X } from 'lucide-react';
import type { Tab } from '../../hooks/useEditorState';
interface CodeEditorProps {
    activeFile: string | null;
    code: string;
    setCode: (code: string) => void;
    openTabs: Tab[];
    onSelectTab: (fileName: string, handle: FileSystemFileHandle) => void;
    onCloseTab: (id: string) => void;
    settings?: {
        fontSize: number;
        fontFamily: string;
        tabSize: number;
        lineNumbers: 'on' | 'off' | 'relative';
        cursorBlinking: 'smooth' | 'blink' | 'solid';
        smoothScrolling: boolean;
    };
}
export const CodeEditor: React.FC<CodeEditorProps> = ({
    activeFile,
    code,
    setCode,
    openTabs,
    onSelectTab,
    onCloseTab,
    settings
}) => {
    // Map file extension to Monaco Editor languages
    const getEditorLanguage = (fileName: string | null) => {
        if (!fileName) return 'javascript';
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'js':
            case 'jsx':
            case 'mjs':
                return 'javascript';
            case 'ts':
            case 'tsx':
                return 'typescript';
            case 'css':
                return 'css';
            case 'html':
                return 'html';
            case 'json':
                return 'json';
            case 'md':
                return 'markdown';
            case 'py':
            case 'pyw':
                return 'python';
            case 'go':
                return 'go';
            case 'rs':
                return 'rust';
            case 'cpp':
            case 'cc':
            case 'cxx':
            case 'h':
            case 'hpp':
                return 'cpp';
            case 'c':
                return 'c';
            case 'java':
                return 'java';
            case 'cs':
                return 'csharp';
            case 'sh':
            case 'bash':
            case 'zsh':
                return 'shell';
            case 'yaml':
            case 'yml':
                return 'yaml';
            case 'xml':
                return 'xml';
            case 'sql':
                return 'sql';
            case 'rb':
                return 'ruby';
            case 'php':
                return 'php';
            case 'swift':
                return 'swift';
            case 'kt':
            case 'kts':
                return 'kotlin';
            case 'dart':
                return 'dart';
            case 'bat':
            case 'cmd':
                return 'bat';
            case 'ps1':
                return 'powershell';
            case 'dockerfile':
                return 'dockerfile';
            default:
                return 'plaintext';
        }
    };
    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'js':
            case 'jsx':
            case 'mjs':
                return (
                    <svg className="w-3.5 h-3.5 text-yellow-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 3h18v18H3V3zm12.54 11.23c-.23-.84-.81-1.32-1.74-1.32-.98 0-1.52.54-1.52 1.55 0 1 .5 1.51 1.52 1.51.85 0 1.34-.41 1.57-.93l1.52.93c-.47.93-1.63 1.63-3.1 1.63-2.3 0-3.64-1.42-3.64-3.64 0-2.28 1.45-3.67 3.73-3.67 1.6 0 2.65.74 3.09 1.76l-1.42.92zm3.46 3.07c0 .66-.49 1.15-1.2 1.15-.69 0-1.18-.49-1.18-1.15V10.7h1.65v5.18c0 .24.11.39.38.39.26 0 .35-.15.35-.39V10.7h1.66v6.6c0 0-.66 0-.66 0z"/>
                    </svg>
                );
            case 'ts':
            case 'tsx':
                return (
                    <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 3h18v18H3V3zm11.5 8h-4v6h-1.5v-6h-4V9.5h9.5V11zm4.78 4.3c-.23-.84-.81-1.32-1.74-1.32-.98 0-1.52.54-1.52 1.55 0 1 .5 1.51 1.52 1.51.85 0 1.34-.41 1.57-.93l1.52.93c-.47.93-1.63 1.63-3.1 1.63-2.3 0-3.64-1.42-3.64-3.64 0-2.28 1.45-3.67 3.73-3.67 1.6 0 2.65.74 3.09 1.76l-1.42.92z"/>
                    </svg>
                );
            case 'css':
                return (
                    <svg className="w-3.5 h-3.5 text-purple-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                );
            case 'html':
                return (
                    <svg className="w-3.5 h-3.5 text-orange-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                    </svg>
                );
            case 'json':
                return (
                    <svg className="w-3.5 h-3.5 text-teal-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        <path d="M14 11a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.71 1.71" />
                    </svg>
                );
            case 'md':
                return (
                    <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="14" y1="2" x2="14" y2="8" />
                        <polyline points="14 2 20 8" />
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    </svg>
                );
        }
    };
    const handleEditorDidMount = (_editor: any, monaco: any) => {
        monaco.editor.defineTheme('k-studio-light', {
            base: 'vs',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '86868B', fontStyle: 'italic' },
                { token: 'keyword', foreground: '4F46E5', fontStyle: 'bold' },
                { token: 'string', foreground: '0D9488' },
                { token: 'number', foreground: 'D97706' },
            ],
            colors: {
                'editor.background': '#FFFFFFCD', // High translucency glass matching the main application wrapper
                'editor.lineHighlightBackground': '#F3F4F640',
                'editorLineNumber.foreground': '#86868B60',
                'editorLineNumber.activeForeground': '#4F46E5',
                'editor.inactiveSelectionBackground': '#4F46E515',
                'editor.selectionBackground': '#4F46E525',
                'editorGutter.background': '#FFFFFF00',
            }
        });
        monaco.editor.setTheme('k-studio-light');
    };
    const language = getEditorLanguage(activeFile);
    if (openTabs.length === 0 || !activeFile) {
        return (
            <section className="flex-1 flex flex-col h-full min-h-0 overflow-hidden font-sans justify-center items-center p-8 bg-white/25 backdrop-blur-xl border border-white/50 rounded-2xl shadow-lg">
                <div className="text-center max-w-md flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/60 border border-white/70 shadow-md flex items-center justify-center text-blue-600 animate-pulse">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-sm font-bold text-[#1D1D1F] uppercase tracking-wider font-mono">No Open Tabs</h3>
                    <p className="text-xs text-[#86868B] leading-relaxed">
                        Select a file from the explorer tree or create a new one to begin hacking.
                    </p>
                    <div className="mt-4 flex flex-col gap-2 w-full text-left font-mono text-[10px] text-[#1D1D1F]/70 bg-white/40 p-4 rounded-xl border border-white/40 shadow-inner">
                        <div className="flex justify-between">
                            <span>Open Command Palette</span>
                            <kbd className="px-1.5 py-0.5 bg-white/80 border rounded shadow-sm text-[9px] font-sans font-bold">Ctrl + K</kbd>
                        </div>
                        <div className="flex justify-between mt-1.5">
                            <span>Save Current File</span>
                            <kbd className="px-1.5 py-0.5 bg-white/80 border rounded shadow-sm text-[9px] font-sans font-bold">Ctrl + S</kbd>
                        </div>
                    </div>
                </div>
            </section>
        );
    }
    return (
        <section className="flex-1 flex flex-col h-full min-h-0 overflow-hidden font-sans">
            {/* Scrollable IDE Tab Row */}
            <div 
                className="flex items-center bg-white/20 backdrop-blur-md border border-white/40 rounded-t-xl h-10 w-full shrink-0 select-none overflow-x-auto overflow-y-hidden border-b-0"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {openTabs.map((tab) => {
                    const isActive = tab.id === activeFile;
                    return (
                        <div
                            key={tab.id}
                            onClick={() => onSelectTab(tab.fileName, tab.handle)}
                            className={`group relative flex items-center gap-2 px-4 h-full border-r border-white/20 cursor-pointer select-none transition-all duration-150 min-w-[120px] max-w-[200px] shrink-0 ${
                                isActive
                                    ? 'bg-white/85 text-[#1D1D1F] font-semibold border-b-2 border-b-blue-600'
                                    : 'text-[#1D1D1F]/60 hover:bg-white/40 hover:text-[#1D1D1F]'
                            }`}
                        >
                            {/* File Icon */}
                            {getFileIcon(tab.fileName)}
                            {/* File Name */}
                            <span className="font-mono text-[11px] truncate flex-1 leading-none pt-0.5">
                                {tab.fileName}
                            </span>
                            {/* Close Button / Dirty Indicator */}
                            <div className="flex items-center justify-center w-4 h-4 shrink-0">
                                {tab.isDirty ? (
                                    <>
                                        {/* Blue circle dot when dirty, hidden on hover */}
                                        <span className="w-2 h-2 bg-blue-500 rounded-full block group-hover:hidden animate-pulse" />
                                        {/* Close icon shown on hover */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCloseTab(tab.id);
                                            }}
                                            className="hidden group-hover:flex items-center justify-center p-0.5 rounded hover:bg-black/10 text-[#1D1D1F]/70 hover:text-[#1D1D1F] transition-all"
                                        >
                                            <X size={10} strokeWidth={2.5} />
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCloseTab(tab.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-0.5 rounded hover:bg-black/10 text-[#1D1D1F]/70 hover:text-[#1D1D1F] transition-all"
                                    >
                                        <X size={10} strokeWidth={2.5} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Solid Premium Off-White Paper Layout Sheet */}
            <div className="flex-1 bg-white/95 p-3 rounded-b-xl border border-white/40 shadow-sm h-full min-h-0 overflow-hidden">
                <MonacoEditor
                    height="100%"
                    language={language}
                    value={code}
                    onChange={(val) => setCode(val || '')}
                    onMount={handleEditorDidMount}
                    theme="vs-light"
                    options={{
                        fontSize: settings?.fontSize || 13,
                        fontFamily: settings?.fontFamily || 'JetBrains Mono, SF Mono, monospace',
                        tabSize: settings?.tabSize || 4,
                        lineNumbers: settings?.lineNumbers || 'on',
                        cursorBlinking: settings?.cursorBlinking || 'smooth',
                        smoothScrolling: settings?.smoothScrolling !== undefined ? settings.smoothScrolling : true,
                        minimap: { enabled: false },
                        wordWrap: 'on',
                        automaticLayout: true,
                        padding: { top: 16, bottom: 16 },
                        lineNumbersMinChars: 3,
                        glyphMargin: false,
                        folding: true,
                        scrollbar: {
                            vertical: 'auto',
                            horizontal: 'auto',
                            useShadows: false,
                            verticalScrollbarSize: 10,
                            horizontalScrollbarSize: 10
                        }
                    }}
                />
            </div>
        </section>
    );
};