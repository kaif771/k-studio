import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, RefreshCw, Smartphone, Monitor, Laptop, X } from 'lucide-react';

interface PreviewPanelProps {
    onClose: () => void;
    externalUrl?: string | null;
    isLaunching?: boolean;
    framework?: string | null;
    status?: string | null;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ onClose, externalUrl, isLaunching, framework, status }) => {
    const [viewMode, setViewMode] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
    // `url` may be null when no preview is available. Avoid passing an empty string
    // to iframe src (causes browser warning). Use null to represent "no URL".
    const [url, setUrl] = useState<string | null>(null);
    const [key, setKey] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Sync external URL change to local state
    useEffect(() => {
        console.log("🖼️ PreviewPanel received:", { externalUrl, isLaunching, framework, status });
        if (externalUrl) {
            if (externalUrl !== url) {
                // Avoid synchronous setState in effects — defer to next macrotask
                setTimeout(() => {
                    setUrl(externalUrl);
                    setKey(prev => prev + 1);
                    setIsLoading(true);
                    console.log("🔄 PreviewPanel updating URL to:", externalUrl);
                }, 0);
            }
        } else if (status !== 'needs_install') {
            // Use null to explicitly represent "no preview URL". Avoid empty string.
            if (url !== null) {
                setTimeout(() => {
                    setUrl(null);
                    setIsLoading(false);
                }, 0);
            }
        }
    }, [externalUrl, url, isLaunching, framework, status]);

    const viewWidths = {
        mobile: 'w-[375px]',
        tablet: 'w-[768px]',
        desktop: 'w-full'
    };

    const handleRefresh = () => {
        setKey(prev => prev + 1);
        setIsLoading(true);
    };

    const handlePopOut = () => {
        if (!url) return;
        window.open(url, '_blank');
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleRefresh();
        }
    };

    const getFrameworkLabel = () => {
        if (!framework) return null;
        const labels: Record<string, string> = {
            nextjs: 'Next.js',
            vite: 'Vite',
            react: 'React',
            remix: 'Remix',
            nodejs: 'Node.js',
            vanilla: 'Static'
        };
        return labels[framework] || framework;
    };

    return (
        <div className="flex-1 flex flex-col bg-[#0a0a0a] border-l border-white/5 h-full overflow-hidden">
            {/* Toolbar */}
            <div className="h-10 bg-[#050505] border-b border-white/5 flex items-center justify-between px-2 sm:px-4">
                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    <div className="hidden md:flex bg-white/5 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('mobile')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'mobile' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
                        >
                            <Smartphone size={14} />
                        </button>
                        <button
                            onClick={() => setViewMode('tablet')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'tablet' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
                        >
                            <Laptop size={14} />
                        </button>
                        <button
                            onClick={() => setViewMode('desktop')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'desktop' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
                        >
                            <Monitor size={14} />
                        </button>
                    </div>
                    {framework && (
                        <div className="flex items-center px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                            <span className="text-[9px] font-black text-cyan-400 uppercase tracking-tighter">
                                {getFrameworkLabel()}
                            </span>
                        </div>
                    )}
                    <div className="hidden md:block h-4 w-px bg-white/5" />
                    <div className="flex items-center gap-1 sm:gap-2 bg-white/[0.02] border border-white/5 rounded-md px-2 sm:px-3 py-1 flex-1 md:flex-initial min-w-0">
                        <span className="text-[9px] sm:text-[10px] text-white/20 font-mono tracking-tight hidden sm:inline">URL</span>
                        <input
                            type="text"
                            value={url ?? ''}
                            onChange={handleUrlChange}
                            onKeyDown={handleKeyDown}
                            className="bg-transparent border-none outline-none text-[9px] sm:text-[10px] text-white/60 w-full md:w-48 font-mono"
                        />
                    </div>
                    {isLaunching && (
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
                            <span className="text-[10px] text-cyan-500 font-bold uppercase tracking-wider animate-pulse">
                                Starting {getFrameworkLabel()} Server...
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        className="p-1.5 hover:bg-white/5 rounded-md text-white/30 hover:text-white/60 transition-colors"
                        title="Refresh Preview"
                    >
                        <RefreshCw size={14} className={(isLoading || isLaunching) ? 'animate-spin text-cyan-500' : ''} />
                    </button>
                    <button
                        onClick={handlePopOut}
                        className="p-1.5 hover:bg-white/5 rounded-md text-white/30 hover:text-white/60 transition-colors"
                        title="Open in New Tab"
                    >
                        <ExternalLink size={14} />
                    </button>
                    <div className="h-4 w-px bg-white/5 mx-1" />
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/5 rounded-md text-white/30 hover:text-red-400 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-[#111] flex items-center justify-center p-8 overflow-hidden relative">
                <div className={`h-full shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden transition-all duration-500 ease-in-out ${viewWidths[viewMode]} relative bg-white`}>

                    {/* Missing node_modules Warning */}
                    {status === 'needs_install' ? (
                        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-6 text-center z-20">
                            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                                <span className="text-3xl">📦</span>
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">Dependencies Missing</h3>
                            <p className="text-white/40 text-sm max-w-sm mb-8 leading-relaxed">
                                We detected a <span className="text-cyan-400 font-bold">{getFrameworkLabel()}</span> project, but <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/90">node_modules</code> is missing.
                            </p>
                            <div className="w-full max-w-xs p-4 bg-black/40 border border-white/5 rounded-xl font-mono text-[11px] text-white/60 text-left mb-8">
                                <p className="text-white/30 mb-2"># Run this in your terminal:</p>
                                <p className="text-cyan-400 font-bold underline decoration-cyan-500/30 underline-offset-4">npm install</p>
                            </div>
                            <button
                                onClick={handleRefresh}
                                className="px-6 py-2.5 bg-white text-black font-black uppercase tracking-widest text-[11px] rounded-full hover:bg-cyan-500 hover:text-white transition-all active:scale-95"
                            >
                                I've installed them, Retry!
                            </button>
                        </div>
                    ) : (isLoading || isLaunching) && (
                        <div className="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center z-10 transition-opacity duration-300">
                            <div className="w-12 h-12 rounded-full bg-cyan-500/10 border-2 border-cyan-500/20 border-t-cyan-500 animate-spin mb-4" />
                            <h4 className="text-slate-900 font-bold text-[12px] uppercase tracking-widest">
                                {isLaunching ? `${getFrameworkLabel()} Vibe` : 'Architect Preview'}
                            </h4>
                            <p className="text-slate-400 text-[10px] font-medium mt-1">
                                {isLaunching ? 'Waking up the local instance...' : `Sourcing ${url}...`}
                            </p>
                        </div>
                    )}
                    {url ? (
                        <iframe
                            key={key}
                            ref={iframeRef}
                            src={url}
                            onLoad={() => {
                                console.log('✅ Iframe loaded successfully:', url);
                                setIsLoading(false);
                            }}
                            className="w-full h-full border-none bg-white"
                            title="Frontend Preview"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-center p-6">
                            <div className="text-slate-500">No preview available. Start the project to see a live preview.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
