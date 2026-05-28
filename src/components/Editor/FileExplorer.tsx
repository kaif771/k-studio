import React, { useState, useRef, useEffect } from 'react';
import { 
    ChevronDown, 
    FileCode, 
    FolderPlus, 
    FilePlus, 
    Edit3, 
    Trash2, 
    Copy, 
    Scissors, 
    Clipboard,
    Plus,
    Folder
} from 'lucide-react';
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

interface ClipboardItem {
    node: FileNode;
    action: 'copy' | 'cut';
    parentNode?: FileNode;
}

interface FileTreeItemProps {
    node: FileNode;
    parentNode?: FileNode;
    level: number;
    activeFile: string | null;
    onSelect: (node: FileNode) => void;
    toggleFolder: (node: FileNode) => void;
    createFile: (name: string, parentNode?: FileNode) => Promise<any>;
    createFolder: (name: string, parentNode?: FileNode) => Promise<any>;
    renameNode: (node: FileNode, newName: string, parentNode?: FileNode) => Promise<any>;
    deleteNode: (node: FileNode, parentNode?: FileNode) => Promise<any>;
    moveNode: (node: FileNode, targetParent?: FileNode, currentParent?: FileNode) => Promise<any>;
    copyNode: (node: FileNode, targetParent?: FileNode) => Promise<any>;
    
    // Drag & Drop bindings
    draggedNode: { node: FileNode; parentNode?: FileNode } | null;
    setDraggedNode: (payload: { node: FileNode; parentNode?: FileNode } | null) => void;
    
    // Clipboard Matrix bindings
    clipboard: ClipboardItem | null;
    setClipboard: (item: ClipboardItem | null) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ 
    node, 
    parentNode,
    level, 
    activeFile, 
    onSelect,
    toggleFolder,
    createFile,
    createFolder,
    renameNode,
    deleteNode,
    moveNode,
    copyNode,
    draggedNode,
    setDraggedNode,
    clipboard,
    setClipboard
}) => {
    const isActiveFile = activeFile === node.name && node.kind === 'file';
    const isCut = clipboard?.node.path === node.path && clipboard.action === 'cut';

    // Local Interactive States
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameVal, setRenameVal] = useState(node.name);
    const [activeInputMode, setActiveInputMode] = useState<'file' | 'folder' | null>(null);
    const [newChildName, setNewChildName] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);

    const editInputRef = useRef<HTMLInputElement>(null);
    const childInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isRenaming) {
            editInputRef.current?.focus();
            editInputRef.current?.select();
        }
    }, [isRenaming]);

    useEffect(() => {
        if (activeInputMode) {
            childInputRef.current?.focus();
        }
    }, [activeInputMode]);

    // Rename submit handler
    const handleRenameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = renameVal.trim();
        if (trimmed && trimmed !== node.name) {
            await renameNode(node, trimmed, parentNode);
        }
        setIsRenaming(false);
    };

    // New child creation submit handler
    const handleChildSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newChildName.trim();
        if (name) {
            if (activeInputMode === 'file') {
                await createFile(name, node);
            } else if (activeInputMode === 'folder') {
                await createFolder(name, node);
            }
            if (!node.isOpen) {
                toggleFolder(node);
            }
        }
        setActiveInputMode(null);
        setNewChildName('');
    };

    // Drag & Drop Handlers
    const handleDragStart = (e: React.DragEvent) => {
        e.stopPropagation();
        setDraggedNode({ node, parentNode });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', node.path);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (node.kind === 'directory' && draggedNode?.node.path !== node.path) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (!draggedNode) return;
        
        // Prevent dropping folder inside itself or its children
        if (node.kind === 'directory' && !node.path.startsWith(draggedNode.node.path) && node.path !== draggedNode.node.path) {
            await moveNode(draggedNode.node, node, draggedNode.parentNode);
        }
        setDraggedNode(null);
    };

    // Clipboard Handlers
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        setClipboard({ node, action: 'copy', parentNode });
    };

    const handleCut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setClipboard({ node, action: 'cut', parentNode });
    };

    const handlePaste = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!clipboard) return;
        
        if (clipboard.action === 'cut') {
            await moveNode(clipboard.node, node, clipboard.parentNode);
            setClipboard(null); // Clear clipboard after cut-paste
        } else if (clipboard.action === 'copy') {
            await copyNode(clipboard.node, node);
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete ${node.name}?`)) {
            await deleteNode(node, parentNode);
        }
    };

    return (
        <div className="min-w-0 w-full overflow-hidden select-none">
            {/* Tree Node Wrapper */}
            <div
                draggable
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => {
                    if (isRenaming) return;
                    if (node.kind === 'directory') {
                        toggleFolder(node);
                    } else {
                        onSelect(node);
                    }
                }}
                style={{ paddingLeft: `${(level * 12) + 12}px` }}
                className={`group flex items-center justify-between py-1.5 pr-2 min-w-0 max-w-full cursor-pointer transition-all duration-150 rounded-lg text-[13px] font-medium tracking-tight ${
                    isActiveFile
                        ? 'bg-[#4F46E5] text-white shadow-sm'
                        : isDragOver
                            ? 'bg-[#4F46E5]/20 border border-dashed border-[#4F46E5]/40 text-[#4F46E5]'
                            : 'text-[#1D1D1F] hover:bg-[#4F46E5]/10 hover:text-[#4F46E5]'
                } ${isCut ? 'opacity-50 grayscale-[30%]' : ''}`}
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {node.kind === 'directory' ? (
                        <ChevronDown size={14} className={`shrink-0 transition-transform ${node.isOpen ? '' : '-rotate-90'} ${isActiveFile ? 'text-white/80' : 'text-[#86868B]'}`} />
                    ) : (
                        getFileIcon(node.name, isActiveFile)
                    )}
                    
                    {isRenaming ? (
                        <form onSubmit={handleRenameSubmit} className="flex-1 min-w-0 mr-2" onClick={e => e.stopPropagation()}>
                            <input
                                ref={editInputRef}
                                type="text"
                                value={renameVal}
                                onChange={e => setRenameVal(e.target.value)}
                                onBlur={() => setIsRenaming(false)}
                                onKeyDown={e => e.key === 'Escape' && setIsRenaming(false)}
                                className="w-full bg-white/60 border border-indigo-500 rounded px-1.5 py-0 outline-none text-xs font-medium text-neutral-900 shadow-inner"
                            />
                        </form>
                    ) : (
                        <span className="truncate min-w-0">{node.name}</span>
                    )}
                </div>

                {/* VS Code Hover Actions */}
                {!isRenaming && (
                    <div className="hidden group-hover:flex items-center gap-1.5 ml-2 shrink-0 select-none">
                        {node.kind === 'directory' && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveInputMode('file'); }}
                                    className={`p-0.5 rounded-md hover:bg-white/50 transition-all ${isActiveFile ? 'text-white hover:text-indigo-200' : 'text-[#86868B] hover:text-[#4F46E5]'}`}
                                    title="New File"
                                >
                                    <FilePlus size={12} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveInputMode('folder'); }}
                                    className={`p-0.5 rounded-md hover:bg-white/50 transition-all ${isActiveFile ? 'text-white hover:text-indigo-200' : 'text-[#86868B] hover:text-[#4F46E5]'}`}
                                    title="New Folder"
                                >
                                    <FolderPlus size={12} />
                                </button>
                            </>
                        )}
                        <button
                            onClick={handleCopy}
                            className={`p-0.5 rounded-md hover:bg-white/50 transition-all ${isActiveFile ? 'text-white hover:text-indigo-200' : 'text-[#86868B] hover:text-[#4F46E5]'}`}
                            title="Copy File"
                        >
                            <Copy size={12} />
                        </button>
                        <button
                            onClick={handleCut}
                            className={`p-0.5 rounded-md hover:bg-white/50 transition-all ${isActiveFile ? 'text-white hover:text-indigo-200' : 'text-[#86868B] hover:text-[#4F46E5]'}`}
                            title="Cut File"
                        >
                            <Scissors size={12} />
                        </button>
                        {node.kind === 'directory' && clipboard && (
                            <button
                                onClick={handlePaste}
                                className={`p-0.5 rounded-md hover:bg-white/50 transition-all ${isActiveFile ? 'text-white hover:text-indigo-200' : 'text-[#86868B] hover:text-[#4F46E5]'}`}
                                title="Paste File"
                            >
                                <Clipboard size={12} />
                            </button>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}
                            className={`p-0.5 rounded-md hover:bg-white/50 transition-all ${isActiveFile ? 'text-white hover:text-indigo-200' : 'text-[#86868B] hover:text-[#4F46E5]'}`}
                            title="Rename"
                        >
                            <Edit3 size={12} />
                        </button>
                        <button
                            onClick={handleDelete}
                            className={`p-0.5 rounded-md hover:bg-white/50 transition-all ${isActiveFile ? 'text-white hover:text-red-200' : 'text-[#86868B] hover:text-red-500'}`}
                            title="Delete"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}
            </div>

            {/* Render Inline Input underneath the parent directory when creating a child */}
            {node.kind === 'directory' && activeInputMode && (
                <div style={{ paddingLeft: `${((level + 1) * 12) + 12}px` }} className="py-1 pr-2">
                    <form onSubmit={handleChildSubmit} className="flex items-center gap-2 min-w-0" onClick={e => e.stopPropagation()}>
                        {activeInputMode === 'folder' ? (
                            <Folder size={14} className="text-[#86868B] shrink-0" />
                        ) : (
                            <FileCode size={14} className="text-[#86868B] shrink-0" />
                        )}
                        <input
                            ref={childInputRef}
                            type="text"
                            value={newChildName}
                            onChange={e => setNewChildName(e.target.value)}
                            onBlur={() => setActiveInputMode(null)}
                            onKeyDown={e => e.key === 'Escape' && setActiveInputMode(null)}
                            className="w-full bg-white/60 border border-indigo-500 rounded px-1.5 py-0.5 outline-none text-xs font-medium text-neutral-900 shadow-inner"
                            placeholder={activeInputMode === 'folder' ? 'folder_name' : 'file.jsx'}
                        />
                    </form>
                </div>
            )}

            {/* Folder Children List */}
            {node.kind === 'directory' && node.isOpen && node.children && (
                <div className="flex flex-col space-y-0.5 mt-0.5 min-w-0 overflow-hidden">
                    {node.children.map((child, i) => (
                        <FileTreeItem
                            key={`${child.path}-${i}`}
                            node={child}
                            parentNode={node}
                            level={level + 1}
                            activeFile={activeFile}
                            onSelect={onSelect}
                            toggleFolder={toggleFolder}
                            createFile={createFile}
                            createFolder={createFolder}
                            renameNode={renameNode}
                            deleteNode={deleteNode}
                            moveNode={moveNode}
                            copyNode={copyNode}
                            draggedNode={draggedNode}
                            setDraggedNode={setDraggedNode}
                            clipboard={clipboard}
                            setClipboard={setClipboard}
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
    onCreateFile: (name: string, parentNode?: FileNode) => Promise<any>;
    
    // Upgraded full-stack filesystem bindings
    createFolder: (name: string, parentNode?: FileNode) => Promise<any>;
    renameNode: (node: FileNode, newName: string, parentNode?: FileNode) => Promise<any>;
    deleteNode: (node: FileNode, parentNode?: FileNode) => Promise<any>;
    moveNode: (node: FileNode, targetParent?: FileNode, currentParent?: FileNode) => Promise<any>;
    copyNode: (node: FileNode, targetParent?: FileNode) => Promise<any>;
    toggleFolder: (node: FileNode) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ 
    activeFile, 
    fileTree, 
    onSelect, 
    onCreateFile,
    createFolder,
    renameNode,
    deleteNode,
    moveNode,
    copyNode,
    toggleFolder
}) => {
    // Root level creation states
    const [isCreatingType, setIsCreatingType] = useState<'file' | 'folder' | null>(null);
    const [rootInputVal, setRootInputVal] = useState('');
    const rootInputRef = useRef<HTMLInputElement>(null);

    // Global drag node sharing
    const [draggedNode, setDraggedNode] = useState<{ node: FileNode; parentNode?: FileNode } | null>(null);

    // Global Clipboard Context Matrix
    const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);

    useEffect(() => {
        if (isCreatingType) {
            rootInputRef.current?.focus();
        }
    }, [isCreatingType]);

    const handleRootSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = rootInputVal.trim();
        if (trimmed) {
            if (isCreatingType === 'file') {
                await onCreateFile(trimmed);
            } else if (isCreatingType === 'folder') {
                await createFolder(trimmed);
            }
        }
        setIsCreatingType(null);
        setRootInputVal('');
    };

    // Root-level drag drop handlers (to allow dropping elements onto the root workspace empty track)
    const handleRootDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleRootDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        if (draggedNode && draggedNode.parentNode !== undefined) {
            // Drop onto undefined targetParent moves the file/folder to workspace root
            await moveNode(draggedNode.node, undefined, draggedNode.parentNode);
        }
        setDraggedNode(null);
    };

    const handlePasteAtRoot = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!clipboard) return;
        
        if (clipboard.action === 'cut') {
            await moveNode(clipboard.node, undefined, clipboard.parentNode);
            setClipboard(null);
        } else if (clipboard.action === 'copy') {
            await copyNode(clipboard.node, undefined);
        }
    };

    return (
        <div 
            onDragOver={handleRootDragOver}
            onDrop={handleRootDrop}
            className="w-full h-full flex flex-col min-h-0 overflow-hidden shrink-0 select-none font-sans"
        >
            {/* Header Control Palette Toolbar */}
            <div className={`h-10 bg-white/10 border-b border-white/20 flex items-center justify-between px-4 shrink-0 rounded-t-lg ${PANEL_LABEL}`}>
                <span>01 / FILE_TREE_INDEX</span>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsCreatingType('file')}
                        className="text-[#1D1D1F]/60 hover:text-[#4F46E5] hover:scale-110 transition-all cursor-pointer font-bold text-xs"
                        title="New File at Root"
                    >
                        <Plus size={14} strokeWidth={2.5} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsCreatingType('folder')}
                        className="text-[#1D1D1F]/60 hover:text-[#4F46E5] hover:scale-110 transition-all cursor-pointer font-bold text-xs"
                        title="New Folder at Root"
                    >
                        <FolderPlus size={14} />
                    </button>
                    {clipboard && (
                        <button
                            type="button"
                            onClick={handlePasteAtRoot}
                            className="text-[#1D1D1F]/60 hover:text-[#4F46E5] hover:scale-110 transition-all cursor-pointer font-bold text-xs"
                            title="Paste at Workspace Root"
                        >
                            <Clipboard size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Scroll Containment Panel Track */}
            <div className="flex-1 flex flex-col min-h-0 py-2 space-y-0.5 overflow-hidden">
                {/* Inline input for root-level node creation */}
                {isCreatingType && (
                    <div className="px-3 py-1 mb-1 min-w-0 shrink-0">
                        <form onSubmit={handleRootSubmit} className="flex items-center gap-2 min-w-0">
                            {isCreatingType === 'folder' ? (
                                <Folder size={14} className="text-[#86868B] shrink-0" />
                            ) : (
                                <FileCode size={14} className="text-[#86868B] shrink-0" />
                            )}
                            <input
                                ref={rootInputRef}
                                type="text"
                                value={rootInputVal}
                                onChange={(e) => setRootInputVal(e.target.value)}
                                onBlur={() => setIsCreatingType(null)}
                                onKeyDown={(e) => e.key === 'Escape' && setIsCreatingType(null)}
                                className="bg-white/40 border border-indigo-500 rounded px-2 py-0.5 text-[13px] font-medium tracking-tight text-[#1D1D1F] outline-none w-full min-w-0 shadow-sm"
                                placeholder={isCreatingType === 'folder' ? 'folder_name' : 'file.tsx'}
                            />
                        </form>
                    </div>
                )}

                {/* Bounded Scroll List container */}
                <div className="flex-1 overflow-y-auto max-h-[calc(100vh-180px)] pr-2 custom-scrollbar space-y-0.5 px-2">
                    {fileTree.map((node, i) => (
                        <FileTreeItem
                            key={`${node.path}-${i}`}
                            node={node}
                            parentNode={undefined}
                            level={0}
                            activeFile={activeFile}
                            onSelect={onSelect}
                            toggleFolder={toggleFolder}
                            createFile={onCreateFile}
                            createFolder={createFolder}
                            renameNode={renameNode}
                            deleteNode={deleteNode}
                            moveNode={moveNode}
                            copyNode={copyNode}
                            draggedNode={draggedNode}
                            setDraggedNode={setDraggedNode}
                            clipboard={clipboard}
                            setClipboard={setClipboard}
                        />
                    ))}

                    {fileTree.length === 0 && !isCreatingType && (
                        <div className="px-4 py-4 text-[13px] font-medium tracking-tight text-[#86868B] italic">
                            No files found. Drag folders or click '+' to create elements.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
