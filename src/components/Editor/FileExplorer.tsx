import React from 'react';
import { ChevronDown, FileCode } from 'lucide-react';
import type { FileNode } from '../../types';

const FileTreeItem = ({ node, level, activeFile, onSelect }: {
    node: FileNode;
    level: number;
    activeFile: string | null;
    onSelect: (node: FileNode) => void
}) => {
    return (
        <div>
            <div
                onClick={() => onSelect(node)}
                style={{ paddingLeft: `${(level * 12) + 24}px` }}
                className={`flex items-center gap-2 py-1.5 cursor-pointer transition-all text-[11px] font-bold border-r-2 ${activeFile === node.name && node.kind === 'file'
                    ? 'bg-white/5 text-white border-white/50'
                    : 'text-white/40 border-transparent hover:bg-white/5 hover:text-white/70'
                    }`}
            >
                {node.kind === 'directory' ? (
                    <ChevronDown size={14} className={`transition-transform ${node.isOpen ? '' : '-rotate-90'} text-white/20`} />
                ) : (
                    <FileCode size={14} className="text-white/20" />
                )}
                <span className="truncate">{node.name}</span>
            </div>
            {node.kind === 'directory' && node.isOpen && node.children && (
                <div className="flex flex-col">
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
        <div className="w-full sm:w-64 md:w-72 lg:w-80 bg-[#080808] border-r border-white/5 h-full py-4 sm:py-6 flex flex-col">
            <div className="px-4 sm:px-6 mb-4 sm:mb-6 flex items-center justify-between text-[10px] sm:text-[11px] font-black text-white/40 uppercase tracking-[0.15em] sm:tracking-[0.2em] group">
                <div className="flex items-center gap-2">
                    <ChevronDown size={14} className="text-white/20" /> Workspace
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="bg-white/[0.03] hover:bg-white/[0.08] transition-all p-1.5 px-2.5 rounded-lg border border-white/5 flex items-center gap-1.5 group/btn"
                    title="New File"
                >
                    <span className="text-[12px] font-medium text-white/20 group-hover/btn:text-white/60 transition-colors">+</span>
                    <FileCode size={14} className="text-white/20 group-hover/btn:text-white/60 transition-colors" />
                </button>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar">
                {isCreating && (
                    <div className="px-6 py-1 mb-1">
                        <form onSubmit={handleSubmit} className="flex items-center gap-2">
                            <FileCode size={14} className="text-white/40 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onBlur={handleCancel}
                                onKeyDown={(e) => e.key === 'Escape' && handleCancel()}
                                className="bg-white/5 border border-white/10 rounded px-2 py-0.5 text-[11px] text-white outline-none w-full font-bold"
                                placeholder="file.tsx"
                            />
                        </form>
                    </div>
                )}

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
                    <div className="px-6 py-4 text-[10px] text-white/10 italic">
                        No files found.
                    </div>
                )}
            </div>
        </div>
    );
};
