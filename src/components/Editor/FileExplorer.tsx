import React from 'react';
import { ChevronDown, FileCode } from 'lucide-react';
import type { FileNode } from '../../types';

const PANEL_LABEL = 'font-mono text-[10px] font-bold tracking-widest text-[#1D1D1F] uppercase';

const getFileIcon = (fileName: string, isActiveFile = false) => {
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
                <svg className={`w-3.5 h-3.5 shrink-0 ${isActiveFile ? 'text-white' : 'text-purple-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
            );
        case 'html':
            return (
                <svg className={`w-3.5 h-3.5 shrink-0 ${isActiveFile ? 'text-white' : 'text-orange-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                </svg>
            );
        case 'json':
            return (
                <svg className={`w-3.5 h-3.5 shrink-0 ${isActiveFile ? 'text-white' : 'text-teal-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    <path d="M14 11a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.71 1.71" />
                </svg>
            );
        case 'md':
            return (
                <svg className={`w-3.5 h-3.5 shrink-0 ${isActiveFile ? 'text-white' : 'text-indigo-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
            );
        default:
            return (
                <svg className={`w-3.5 h-3.5 shrink-0 ${isActiveFile ? 'text-white' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="14" y1="2" x2="14" y2="8" />
                    <polyline points="14 2 20 8" />
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                </svg>
            );
    }
};

const FileTreeItem = ({ node, level, activeFile, onSelect }: {
    node: FileNode;
    level: number;
    activeFile: string | null;
    onSelect: (node: FileNode) => void
}) => {
    const isActiveFile = activeFile === node.name && node.kind === 'file';

    return (
        <div className="min-w-0 w-full overflow-hidden">
            <div
                onClick={() => onSelect(node)}
                style={{ paddingLeft: `${(level * 12) + 12}px` }}
                className={`flex items-center gap-2 py-1.5 pr-2 min-w-0 max-w-full cursor-pointer transition-all duration-200 text-[13px] font-medium tracking-tight ${
                    isActiveFile
                        ? 'bg-[#4F46E5] text-white rounded-lg shadow-sm'
                        : 'text-[#1D1D1F] hover:bg-[#4F46E5]/10 hover:text-[#4F46E5] rounded-lg'
                }`}
            >
                {node.kind === 'directory' ? (
                    <ChevronDown size={14} className={`shrink-0 transition-transform ${node.isOpen ? '' : '-rotate-90'} ${isActiveFile ? 'text-white/80' : 'text-[#86868B]'}`} />
                ) : (
                    getFileIcon(node.name, isActiveFile)
                )}
                <span className="truncate min-w-0">{node.name}</span>
            </div>
            {node.kind === 'directory' && node.isOpen && node.children && (
                <div className="flex flex-col space-y-0.5 mt-0.5 min-w-0 overflow-hidden">
                    {node.children.map((child, i) => (
                        <FileTreeItem
                            key={`${child.name}-${i}`}
                            node={child}
                            level={level + 1}
                            activeFile={activeFile}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

interface FileExplorerProps {
    activeFile: string | null;
    fileTree: FileNode[];
    onSelect: (node: FileNode) => void;
    onCreateFile: (name: string) => Promise<void>;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ activeFile, fileTree, onSelect, onCreateFile }) => {
    const [isCreating, setIsCreating] = React.useState(false);
    const [newName, setNewName] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isCreating) {
            inputRef.current?.focus();
        }
    }, [isCreating]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (newName.trim()) {
            await onCreateFile(newName.trim());
            setNewName('');
            setIsCreating(false);
        }
    };

    const handleCancel = () => {
        setIsCreating(false);
        setNewName('');
    };

    return (
        <div className="w-full h-full flex flex-col min-h-0 overflow-hidden shrink-0 select-none font-sans">
            <div className={`h-8 bg-white/10 border-b border-white/20 flex items-center justify-between px-4 shrink-0 rounded-t-lg ${PANEL_LABEL}`}>
                <span>01 / FILE_TREE_INDEX</span>
                <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="text-[#1D1D1F] hover:text-[#4F46E5] transition-colors cursor-pointer text-[13px] font-bold flex items-center normal-case tracking-normal"
                    title="New File"
                >
                    +
                </button>
            </div>

            {/* Strict Scroll Containment Inner Wrapper */}
            <div className="flex-1 flex flex-col min-h-0 py-2 space-y-0.5 overflow-hidden">
                {isCreating && (
                    <div className="px-3 py-1 mb-1 min-w-0 shrink-0">
                        <form onSubmit={handleSubmit} className="flex items-center gap-2 min-w-0">
                            <FileCode size={14} className="text-[#86868B] shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onBlur={handleCancel}
                                onKeyDown={(e) => e.key === 'Escape' && handleCancel()}
                                className="bg-white/40 border border-white/30 rounded px-2 py-0.5 text-[13px] font-medium tracking-tight text-[#1D1D1F] outline-none w-full min-w-0 shadow-sm focus:border-white/50"
                                placeholder="file.tsx"
                            />
                        </form>
                    </div>
                )}

                {/* Bounded Scroll Track */}
                <div className="flex-1 overflow-y-auto max-h-[calc(100vh-180px)] pr-2 custom-scrollbar space-y-0.5">
                    {fileTree.map((node, i) => (
                        <FileTreeItem
                            key={`${node.name}-${i}`}
                            node={node}
                            level={0}
                            activeFile={activeFile}
                            onSelect={onSelect}
                        />
                    ))}

                    {fileTree.length === 0 && !isCreating && (
                        <div className="px-4 py-4 text-[13px] font-medium tracking-tight text-[#86868B] italic">
                            No files found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
