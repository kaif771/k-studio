import React from 'react';
import { Zap, Database, ShieldCheck } from 'lucide-react';

export const AISidebar: React.FC = () => (
    <aside className="w-full sm:w-80 md:w-96 lg:w-[380px] bg-[#080808] p-4 sm:p-6 flex flex-col space-y-6 sm:space-y-8 border-l border-white/5 relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 space-y-6">
            <div>
                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                    <Zap size={14} className="text-pink-500" /> Architecture Plan
                </h3>
                <div className="space-y-4">
                    <div className="p-5 rounded-2xl glass-panel group transition-all hover:border-cyan-500/30">
                        <div className="flex items-center gap-2 mb-3">
                            <Database className="text-cyan-400" size={16} />
                            <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider group-hover:neon-text-blue transition-all">MongoDB Schema</span>
                        </div>
                        <p className="text-[12px] text-white/30 leading-relaxed font-medium">
                            Waiting for architect instructions...
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl glass-panel group transition-all hover:border-pink-500/30">
                        <div className="flex items-center gap-2 mb-3">
                            <ShieldCheck className="text-pink-500" size={16} />
                            <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider group-hover:neon-text-pink transition-all">Security Layer</span>
                        </div>
                        <p className="text-[12px] text-white/30 leading-relaxed font-medium">
                            Auth logic pending analysis...
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </aside>
);
