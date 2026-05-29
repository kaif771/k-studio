import React from 'react';
import { BrainCircuit } from 'lucide-react';

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
    <header className="mx-2 mt-2 sm:mx-6 sm:mt-6 h-12 bg-white/20 backdrop-blur-3xl border border-white/30 rounded-2xl shadow-[0_12px_40px_rgba(31,38,135,0.04)] px-3 sm:px-6 flex items-center justify-between shrink-0 z-50 select-none relative">
        <div className="flex items-center gap-4">
            <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-[#1D1D1F] hover:text-[#4F46E5] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer text-[10px] font-mono uppercase tracking-wider font-bold"
                title="Open another folder"
            >
                <BrainCircuit size={14} />
                <span>Switch</span>
            </button>
            <span className="text-[#E8E8ED] text-[12px] font-light select-none">|</span>
            <div className="flex flex-col min-w-0">
                <h1 className="text-[12px] font-black tracking-tight text-[#1D1D1F] leading-none uppercase font-mono">
                    K-Studio // startup node
                  </h1>
                <span className="text-[8px] text-[#86868B] font-mono uppercase tracking-widest mt-0.5 truncate">
                    system_verified v3.0 &bull; {selectedProject}
                </span>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                <button
                    onClick={onToggleFileExplorer}
                    className={`p-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer hover:text-[#4F46E5] hover:scale-105 active:scale-95 ${isFileExplorerOpen ? 'text-[#1D1D1F] font-bold' : 'text-[#86868B]'}`}
                    title="Toggle Explorer"
                >
                    FileTree
                </button>
                <span className="text-[#E8E8ED] text-[12px] font-light select-none">|</span>
                <button
                    onClick={onToggleAISidebar}
                    className={`p-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer hover:text-[#4F46E5] hover:scale-105 active:scale-95 ${isAISidebarOpen ? 'text-[#1D1D1F] font-bold' : 'text-[#86868B]'}`}
                    title="Toggle Planner"
                >
                    AI Stack
                </button>
            </div>

            <span className="text-[#E8E8ED] text-[12px] font-light select-none">|</span>

            <div className="hidden xs:flex text-[8px] font-mono font-bold text-[#86868B] uppercase tracking-wider items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span>Verified</span>
            </div>
        </div>
    </header>
);
