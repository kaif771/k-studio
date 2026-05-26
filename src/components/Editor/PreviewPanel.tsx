import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    ExternalLink, 
    RefreshCw, 
    Smartphone, 
    Monitor, 
    Laptop, 
    X, 
    ChevronLeft, 
    ChevronRight, 
    Home, 
    Terminal,
    AlertCircle
} from 'lucide-react';
interface PreviewPanelProps {
    onClose: () => void;
    externalUrl?: string | null;
    isLaunching?: boolean;
    framework?: string | null;
    status?: string | null;
    shellLogs?: { id: string; text: string; type: 'input' | 'output' | 'error' | 'system' }[];
}
export const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
    onClose, 
    externalUrl, 
    isLaunching, 
    framework, 
    status,
    shellLogs = []
}) => {
    const [viewMode, setViewMode] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
    const [url, setUrl] = useState<string | null>(null);
    const [key, setKey] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    useEffect(() => {
        console.log("🖼️ PreviewPanel received:", { externalUrl, isLaunching, framework, status });
        if (externalUrl) {
            if (externalUrl !== url) {
                setTimeout(() => {
                    setUrl(externalUrl);
                    setKey(prev => prev + 1);
                    setIsLoading(true);
                    console.log("🔄 PreviewPanel updating URL to:", externalUrl);
                }, 0);
            }
        } else if (status !== 'needs_install') {
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
    // Advanced Browser toolbar navigation actions (with sandbox safety guards)
    const handleBack = () => {
        try {
            if (iframeRef.current && iframeRef.current.contentWindow) {
                iframeRef.current.contentWindow.history.back();
            }
        } catch (err) {
            console.warn("Cross-origin restriction: cannot navigate iframe history directly.");
            handleRefresh();
        }
    };
    const handleForward = () => {
        try {
            if (iframeRef.current && iframeRef.current.contentWindow) {
                iframeRef.current.contentWindow.history.forward();
            }
        } catch (err) {
            console.warn("Cross-origin restriction: cannot navigate iframe history directly.");
            handleRefresh();
        }
    };
    const handleHome = () => {
        if (externalUrl) {
            setUrl(externalUrl);
            setKey(prev => prev + 1);
            setIsLoading(true);
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
    // Filter and clean active stdout/stderr runner logs to stream to the visual live console drawer
    const filteredConsoleLogs = useMemo(() => {
        return shellLogs
            .filter(log => {
                const text = log.text;
                // Capture only server runtime or compiling output lines and errors
                return (
                    log.type === 'output' || 
                    log.type === 'error'
                ) && (
                    text.includes(':stdout') || 
                    text.includes(':stderr') ||
                    text.toLowerCase().includes('vite') ||
                    text.toLowerCase().includes('next') ||
                    text.toLowerCase().includes('compiled') ||
                    text.toLowerCase().includes('hot-reload') ||
                    text.toLowerCase().includes('hmr') ||
                    text.toLowerCase().includes('ready')
                );
            })
            .map(log => {
                // Strip process logging prefixes for high-fidelity presentation (e.g. "[real-estate:stdout]")
                const cleanText = log.text
                    .replace(/^\[[a-zA-Z0-9_-]+:(?:stdout|stderr)\]\s*/, '')
                    .trim();
                return {
                    ...log,
                    text: cleanText
                };
            })
            .filter(log => log.text.length > 0);
    }, [shellLogs]);
    const errorCount = useMemo(() => {
        return filteredConsoleLogs.filter(log => 
            log.type === 'error' || 
            log.text.toLowerCase().includes('error') || 
            log.text.toLowerCase().includes('failed')
        ).length;
    }, [filteredConsoleLogs]);
    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F8FAFC]/30 backdrop-blur-xl">
            {/* Toolbar */}
            <div className="h-10 bg-white/30 backdrop-blur-xl border-b border-white/40 flex items-center justify-between px-2 sm:px-4 shrink-0">
                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    {/* Browser-style back/forward/home controls */}
                    <div className="flex items-center bg-white/40 rounded-lg p-0.5 border border-white/30 shrink-0">
                        <button
                            onClick={handleBack}
                            className="p-1 rounded-md text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/50 transition-all cursor-pointer"
                            title="Back"
                        >
                            <ChevronLeft size={13} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={handleForward}
                            className="p-1 rounded-md text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/50 transition-all cursor-pointer"
                            title="Forward"
                        >
                            <ChevronRight size={13} strokeWidth={2.5} />
                        </button>
                        <button
                            onClick={handleHome}
                            className="p-1 rounded-md text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/50 transition-all cursor-pointer"
                            title="Home"
                        >
                            <Home size={13} strokeWidth={2.5} />
                        </button>
                    </div>
                    {/* Viewport size selectors */}
                    <div className="hidden md:flex bg-white/40 rounded-lg p-0.5 border border-white/30 shrink-0">
                        <button
                            onClick={() => setViewMode('mobile')}
                            className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'mobile' ? 'bg-white/70 text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
                            title="Mobile viewport (375px)"
                        >
                            <Smartphone size={13} />
                        </button>
                        <button
                            onClick={() => setViewMode('tablet')}
                            className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'tablet' ? 'bg-white/70 text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
                            title="Tablet viewport (768px)"
                        >
                            <Laptop size={13} />
                        </button>
                        <button
                            onClick={() => setViewMode('desktop')}
                            className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'desktop' ? 'bg-white/70 text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'}`}
                            title="Desktop viewport (100%)"
                        >
                            <Monitor size={13} />
                        </button>
                    </div>
                    {framework && (
                        <div className="flex items-center px-2 py-0.5 bg-white/50 border border-white/40 rounded-full shrink-0">
                            <span className="text-[9px] font-black text-[#1D1D1F] uppercase tracking-tighter">
                                {getFrameworkLabel()}
                            </span>
                        </div>
                    )}
                    <div className="hidden md:block h-4 w-px bg-white/30 shrink-0" />
                    
                    {/* URL Bar */}
                    <div className="flex items-center gap-1 sm:gap-2 bg-white/50 border border-white/30 rounded-md px-2 sm:px-3 py-1 flex-1 md:flex-initial min-w-0">
                        <span className="text-[9px] sm:text-[10px] text-[#86868B] font-mono tracking-tight hidden sm:inline">URL</span>
                        <input
                            type="text"
                            value={url ?? ''}
                            onChange={handleUrlChange}
                            onKeyDown={handleKeyDown}
                            className="bg-transparent border-none outline-none text-[9px] sm:text-[10px] text-[#1D1D1F] w-full md:w-48 font-mono"
                        />
                    </div>
                    {isLaunching && (
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="w-1.5 h-1.5 bg-[#4F46E5] rounded-full animate-pulse" />
                            <span className="text-[10px] text-[#4F46E5] font-bold uppercase tracking-wider animate-pulse">
                                Launching dev server...
                            </span>
                        </div>
                    )}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleRefresh}
                        className="p-1.5 hover:bg-[#EDE9FE]/70 rounded-md text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                        title="Refresh Preview"
                    >
                        <RefreshCw size={13} className={(isLoading || isLaunching) ? 'animate-spin text-[#1D1D1F]' : ''} />
                    </button>
                    <button
                        onClick={handlePopOut}
                        className="p-1.5 hover:bg-white/40 rounded-md text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                        title="Open in New Tab"
                    >
                        <ExternalLink size={13} />
                    </button>
                    <div className="h-4 w-px bg-white/30 mx-1" />
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/40 rounded-md text-[#86868B] hover:text-red-500 transition-colors cursor-pointer"
                        title="Close Live view"
                    >
                        <X size={13} />
                    </button>
                </div>
            </div>
            {/* Preview Viewport Canvas */}
            <div className="flex-1 bg-transparent flex items-center justify-center p-6 overflow-hidden relative min-h-0">
                <div className={`h-full shadow-[0_12px_40px_rgba(79,70,229,0.08)] rounded-xl overflow-hidden transition-all duration-500 ease-in-out ${viewWidths[viewMode]} relative bg-white/40 border border-white/30`}>
                    {status === 'needs_install' ? (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#EDE9FE] via-[#F4F5F9] to-[#DBEAFE] flex flex-col items-center justify-center p-6 text-center z-20">
                            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-6">
                                <span className="text-3xl">📦</span>
                            </div>
                            <h3 className="text-xl font-black text-[#1D1D1F] uppercase tracking-wider mb-2">Dependencies Missing</h3>
                            <p className="text-[#86868B] text-sm max-w-sm mb-8 leading-relaxed">
                                {getFrameworkLabel() ? (
                                    <>
                                        We detected a <span className="text-[#4F46E5] font-bold">{getFrameworkLabel()}</span> project, but <code className="bg-[#EDE9FE]/70 px-1.5 py-0.5 rounded text-[#1D1D1F] border border-[#4F46E5]/20">node_modules</code> is missing.
                                    </>
                                ) : (
                                    <>
                                        Dependencies are missing for this project. Please run <code className="bg-[#EDE9FE]/70 px-1.5 py-0.5 rounded text-[#1D1D1F] border border-[#4F46E5]/20">npm install</code> to install them.
                                    </>
                                )}
                            </p>
                            <div className="w-full max-w-xs p-4 bg-[#EDE9FE]/60 border border-[#4F46E5]/20 rounded-xl font-mono text-[11px] text-[#1D1D1F] text-left mb-8">
                                <p className="text-[#86868B] mb-2"># Run this in your terminal:</p>
                                <p className="text-[#4F46E5] font-bold underline decoration-[#4F46E5]/30 underline-offset-4">npm install</p>
                            </div>
                            <button
                                onClick={handleRefresh}
                                className="px-6 py-2.5 bg-[#1D1D1F] text-white font-black uppercase tracking-widest text-[11px] rounded-full hover:bg-[#4F46E5] transition-all active:scale-95"
                            >
                                I've installed them, Retry!
                            </button>
                        </div>
                    ) : (isLoading || isLaunching) && (
                        <div className="absolute inset-0 bg-[#F8FAFC]/90 flex flex-col items-center justify-center z-10 transition-opacity duration-300">
                            <div className="w-12 h-12 rounded-full bg-[#1D1D1F]/10 border-2 border-[#1D1D1F]/25 border-t-[#1D1D1F] animate-spin mb-4" />
                            <h4 className="text-[#1D1D1F] font-bold text-[12px] uppercase tracking-widest">
                                {isLaunching ? (getFrameworkLabel() || 'Project') + ' Vibe' : 'Architect Preview'}
                            </h4>
                            <p className="text-[#86868B] text-[10px] font-medium mt-1">
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
                            className="w-full h-full border-none bg-[#F4F5F9]"
                            title="Frontend Preview"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-center p-6 bg-gradient-to-br from-[#EDE9FE]/30 to-[#DBEAFE]/30">
                            <div className="text-[#1D1D1F] font-medium text-sm max-w-xs">
                                No preview available. Start the project to see a live preview.
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Collapsible Web View Live Console Logs Drawer */}
            <div className={`border-t border-white/40 bg-white/30 backdrop-blur-2xl transition-all duration-300 flex flex-col shrink-0 overflow-hidden ${isConsoleOpen ? 'h-52' : 'h-8'}`}>
                {/* Header */}
                <div 
                    onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                    className="h-8 flex items-center justify-between px-6 cursor-pointer select-none hover:bg-white/20 transition-all shrink-0"
                >
                    <div className="flex items-center gap-2">
                        <Terminal size={11} className="text-[#4F46E5]" />
                        <span className="text-[9px] font-bold font-mono tracking-widest text-[#1D1D1F]/70 uppercase">LIVE CONSOLE STREAM</span>
                        {errorCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-600 text-[8px] font-bold font-mono flex items-center gap-0.5 shrink-0">
                                <AlertCircle size={9} /> {errorCount} ERRORS
                            </span>
                        )}
                    </div>
                    <button className="text-[#86868B] hover:text-[#1D1D1F] text-[9px] font-bold font-mono uppercase cursor-pointer">
                        {isConsoleOpen ? 'COLLAPSE' : 'EXPAND'}
                    </button>
                </div>
                {/* Logs List */}
                {isConsoleOpen && (
                    <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] custom-scrollbar bg-black/5 flex flex-col gap-1.5 select-text">
                        {filteredConsoleLogs.length === 0 ? (
                            <div className="text-[#86868B] text-center py-8 font-sans italic text-[11px]">
                                No active console outputs detected. Start interacting with the app to stream logs.
                            </div>
                        ) : (
                            filteredConsoleLogs.map((log, idx) => {
                                const isErr = log.type === 'error' || log.text.toLowerCase().includes('error') || log.text.toLowerCase().includes('failed');
                                return (
                                    <div 
                                        key={idx} 
                                        className={`px-3 py-1.5 rounded-lg border leading-relaxed flex items-start gap-2 ${
                                            isErr 
                                                ? 'bg-red-500/5 border-red-500/20 text-red-700 shadow-sm shadow-red-500/5' 
                                                : 'bg-white/40 border-white/50 text-[#1D1D1F]/80'
                                        }`}
                                    >
                                        <span className="text-[9px] text-[#86868B]/60 font-sans select-none shrink-0 pt-0.5">
                                            [{new Date().toLocaleTimeString()}]
                                        </span>
                                        <span className="break-all">{log.text}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
