import React from 'react';
import { Terminal } from 'lucide-react';

interface EditorFooterProps {
    isPreviewOpen: boolean;
    onTogglePreview: () => void;
}

export const EditorFooter: React.FC<EditorFooterProps> = ({ isPreviewOpen, onTogglePreview }) => (
    <footer className="bg-white/20 backdrop-blur-xl border-t border-white/30 w-full h-10 px-4 flex items-center justify-between text-xs font-mono z-10 select-none">
        <div className="font-bold tracking-tighter uppercase text-[#86868B]/40 hidden xs:block font-mono text-[9px]">
            K-STUDIO POWERED BY GEMINI 3.0
        </div>

        <div className="flex items-center gap-3">
            <button
                onClick={onTogglePreview}
                className={`flex items-center gap-1.5 px-3 py-0.5 rounded-full border transition-all duration-300 cursor-pointer text-[9px] ${isPreviewOpen
                    ? 'bg-white/70 border-white/50 text-[#1D1D1F] shadow-sm font-semibold'
                    : 'bg-white/40 border-white/30 text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/60 font-medium'
                    }`}
            >
                <div className={`w-1.5 h-1.5 rounded-full ${isPreviewOpen ? 'bg-green-500 animate-pulse' : 'bg-[#86868B]/30'}`} />
                <span className="font-bold uppercase tracking-tight">Preview</span>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-0.5 bg-white/40 border border-white/30 rounded-full text-[#86868B] font-bold uppercase tracking-tight text-[9px] shadow-sm">
                <Terminal size={10} className="text-[#86868B]/40 shrink-0" />
                <span className="truncate max-w-[80px] sm:max-w-none font-medium">status: connected</span>
            </div>
        </div>
    </footer>
);
