import React from 'react';
import { BrainCircuit, PanelLeft, PanelRight } from 'lucide-react';

interface EditorHeaderProps {
    selectedProject: string | null;
    onBack: () => void;
    isFileExplorerOpen: boolean;
    onToggleFileExplorer: () => void;
    isAISidebarOpen: boolean;
    onToggleAISidebar: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
    selectedProject,
    onBack,
    isFileExplorerOpen,
    onToggleFileExplorer,
    isAISidebarOpen,
    onToggleAISidebar
}) => (
    <header className="h-12 border-b border-white/5 bg-black flex items-center justify-between px-4 sm:px-6 z-50">
        <div className="flex items-center gap-3">
            <button
                onClick={onBack}
                className="flex items-center gap-2 p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-all border border-white/5 shrink-0 px-3"
                title="Open another folder"
            >
                <BrainCircuit size={18} className="text-white" />
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider hidden sm:inline">Switch Project</span>
            </button>
            <div className="flex flex-col min-w-0">
                <h1 className="text-[10px] sm:text-[11px] font-black tracking-[0.2em] sm:tracking-[0.3em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 leading-none uppercase truncate drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">
                    GEMINI ARCHITECT <span className="text-white/50 hidden xs:inline">3.0</span>
                </h1>
                <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-0.5 truncate max-w-[100px] sm:max-w-none">
                    {selectedProject}
                </span>
            </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 mr-2">
                <button
                    onClick={onToggleFileExplorer}
                    className={`p-1.5 rounded-md transition-all ${isFileExplorerOpen ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`}
                    title="Toggle Explorer"
                >
                    <PanelLeft size={16} />
                </button>
                <button
                    onClick={onToggleAISidebar}
                    className={`p-1.5 rounded-md transition-all ${isAISidebarOpen ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`}
                    title="Toggle Planner"
                >
                    <PanelRight size={16} />
                </button>
            </div>

            <div className="hidden xs:flex text-[9px] font-bold text-white/40 bg-white/5 px-3 py-1 rounded-full border border-white/10 uppercase tracking-tighter items-center gap-2">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                <span className="hidden sm:inline">Status:</span> Connected
            </div>
        </div>
    </header>
);
