import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

interface AISidebarProps {
    projectContext?: string | null;
    createFileAtPath?: (path: string, content: string) => Promise<FileSystemFileHandle | null>;
    onLaunchArchitect?: () => void;
}

export const AISidebar: React.FC<AISidebarProps> = ({ 
    projectContext = '', 
    createFileAtPath, 
    onLaunchArchitect 
}) => {
    const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);
    const [schemaResult, setSchemaResult] = useState<string | null>(null);
    const [schemaCountdown, setSchemaCountdown] = useState<number | null>(null);
    const [isGeneratingAuth, setIsGeneratingAuth] = useState(false);
    const [authResult, setAuthResult] = useState<string | null>(null);
    const [authCountdown, setAuthCountdown] = useState<number | null>(null);

    // Safely fallback to window configurations to support strict ES2015 target builds without warning
    const API_BASE = (window && (window as any).__API_BASE__) || '';

    const handleGenerateSchema = async () => {
        setIsGeneratingSchema(true);
        setSchemaResult(null);
        setSchemaCountdown(null);
        try {
            const res = await fetch(`${API_BASE}/api/generate-mongo-schema`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ projectContext: projectContext || '' }) 
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'unknown' }));
                if (err && typeof err.retryAfterSeconds === 'number') {
                    setSchemaCountdown(err.retryAfterSeconds);
                    setSchemaResult(`Rate limit reached. Retry in ${err.retryAfterSeconds}s`);
                } else {
                    setSchemaResult(`Error: ${err.error || 'generation failed'}`);
                }
            } else {
                const data = await res.json();
                setSchemaResult(data.schema || 'No schema returned');
            }
        } catch (e) {
            setSchemaResult(`Network error: ${String(e)}`);
        } finally {
            setIsGeneratingSchema(false);
        }
    };

    const handleGenerateAuth = async () => {
        setIsGeneratingAuth(true);
        setAuthResult(null);
        setAuthCountdown(null);
        try {
            const res = await fetch(`${API_BASE}/api/generate-auth`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ projectContext: projectContext || '' }) 
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'unknown' }));
                if (err && typeof err.retryAfterSeconds === 'number') {
                    setAuthCountdown(err.retryAfterSeconds);
                    setAuthResult(`Rate limit reached. Retry in ${err.retryAfterSeconds}s`);
                } else {
                    setAuthResult(`Error: ${err.error || 'generation failed'}`);
                }
            } else {
                const data = await res.json();
                setAuthResult(data.auth || 'No auth scaffold returned');
            }
        } catch (e) {
            setAuthResult(`Network error: ${String(e)}`);
        } finally {
            setIsGeneratingAuth(false);
        }
    };

    React.useEffect(() => {
        if (schemaCountdown && schemaCountdown > 0) {
            const id = setInterval(() => {
                setSchemaCountdown((s) => (s && s > 0 ? s - 1 : 0));
            }, 1000);
            return () => clearInterval(id);
        }
        if (schemaCountdown === 0) setSchemaCountdown(null);
        return;
    }, [schemaCountdown]);

    React.useEffect(() => {
        if (authCountdown && authCountdown > 0) {
            const id = setInterval(() => {
                setAuthCountdown((s) => (s && s > 0 ? s - 1 : 0));
            }, 1000);
            return () => clearInterval(id);
        }
        if (authCountdown === 0) setAuthCountdown(null);
        return;
    }, [authCountdown]);

    const handleSaveToDisk = async (content: string, defaultName: string) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (window && (window as any).showSaveFilePicker) {
                const opts = { suggestedName: defaultName, types: [{ accept: { 'text/markdown': ['.md'], 'text/plain': ['.txt'] } }] };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const handle = await (window as any).showSaveFilePicker(opts);
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
                return true;
            }
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = defaultName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            return true;
        } catch (e) {
            console.error('Save to disk failed:', e);
            return false;
        }
    };

    const handleAddToProject = async (content: string, defaultPath: string) => {
        if (!createFileAtPath) {
            alert('Project write helper not available.');
            return false;
        }
        try {
            await createFileAtPath(defaultPath, content);
            alert(`Created ${defaultPath} in project.`);
            return true;
        } catch (e) {
            console.error('Add to project failed:', e);
            alert('Failed to add file to project.');
            return false;
        }
    };

    return (
        <div className="w-full bg-transparent flex flex-col space-y-6 relative overflow-hidden text-[#1D1D1F]">
            <div className="relative z-10 space-y-6">
                <div>
                    <h3 className="font-mono text-[10px] font-bold tracking-widest text-[#1D1D1F] uppercase mb-6">AI Actions</h3>

                    <div className="space-y-4">
                        {/* MongoDB Schema Builder */}
                        <div className="p-5 bg-white/10 border border-white/20 rounded-2xl shadow-[0_4px_12px_rgba(31,38,135,0.02)] group hover:bg-white/20 hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[11px] font-mono font-bold text-[#1D1D1F] uppercase tracking-wider">Execute Schema Build</span>
                            </div>
                            <p className="text-[12px] text-[#2C2C2E] leading-relaxed font-medium mb-4">
                                Click to generate a suggested MongoDB schema (collections, example documents, and indexes) using the AI.
                            </p>
                            <div className="flex gap-2">
                                <button 
                                    type="button"
                                    onClick={handleGenerateSchema} 
                                    disabled={isGeneratingSchema} 
                                    className="px-4 py-2 bg-[#1D1D1F] hover:bg-[#2C2C2E] text-white rounded-md text-[11px] font-mono tracking-wider cursor-pointer shadow-sm active:scale-[0.98] transition-all duration-200 uppercase"
                                >
                                    {isGeneratingSchema ? 'Building...' : 'Execute Schema Build'}
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setSchemaResult(null)} 
                                    className="px-4 py-2 bg-white/35 hover:bg-white/55 border border-white/30 text-[#1D1D1F] rounded-md text-[11px] font-mono tracking-wider cursor-pointer transition-all duration-200 uppercase"
                                >
                                    Clear
                                </button>
                            </div>
                            {schemaResult && (
                                <div>
                                    <div className="mt-3 flex gap-1.5 flex-wrap">
                                        <button type="button" onClick={() => handleSaveToDisk(schemaResult, 'generated_schema.md')} className="px-2.5 py-1 bg-white/35 hover:bg-white/55 border border-white/30 text-[#1D1D1F] rounded-lg text-[10px] font-semibold cursor-pointer transition-all">Save to disk</button>
                                        <button type="button" onClick={() => handleAddToProject(schemaResult, 'generated_schema.md')} className="px-2.5 py-1 bg-white/35 hover:bg-white/55 border border-white/30 text-[#1D1D1F] rounded-lg text-[10px] font-semibold cursor-pointer transition-all">Add to project</button>
                                        <button type="button" onClick={() => navigator.clipboard?.writeText(schemaResult)} className="px-2.5 py-1 bg-white/35 hover:bg-white/55 border border-white/30 text-[#1D1D1F] rounded-lg text-[10px] font-semibold cursor-pointer transition-all">Copy</button>
                                    </div>
                                    <pre className="mt-3 p-3 bg-white/30 border border-white/20 rounded-lg text-xs text-[#1D1D1F] font-mono overflow-auto max-h-48 whitespace-pre-wrap">{schemaResult}</pre>
                                </div>
                            )}
                        </div>

                        {/* Auth Scaffold Generator */}
                        <div className="p-5 bg-white/10 border border-white/20 rounded-2xl shadow-[0_4px_12px_rgba(31,38,135,0.02)] group hover:bg-white/20 hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[11px] font-mono font-bold text-[#1D1D1F] uppercase tracking-wider">Inject Auth Scaffold</span>
                            </div>
                            <p className="text-[12px] text-[#2C2C2E] leading-relaxed font-medium mb-4">
                                Click to generate an authentication scaffold (Express + MongoDB + JWT) using the AI.
                            </p>
                            <div className="flex gap-2">
                                <button 
                                    type="button"
                                    onClick={handleGenerateAuth} 
                                    disabled={isGeneratingAuth} 
                                    className="px-4 py-2 bg-[#1D1D1F] hover:bg-[#2C2C2E] text-white rounded-md text-[11px] font-mono tracking-wider cursor-pointer shadow-sm active:scale-[0.98] transition-all duration-200 uppercase"
                                >
                                    {isGeneratingAuth ? 'Injecting...' : 'Inject Auth Scaffold'}
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setAuthResult(null)} 
                                    className="px-4 py-2 bg-white/35 hover:bg-white/55 border border-white/30 text-[#1D1D1F] rounded-md text-[11px] font-mono tracking-wider cursor-pointer transition-all duration-200 uppercase"
                                >
                                    Clear
                                </button>
                            </div>
                            {authResult && (
                                <div>
                                    <div className="mt-3 flex gap-1.5 flex-wrap">
                                        <button type="button" onClick={() => handleSaveToDisk(authResult, 'auth_scaffold.md')} className="px-2.5 py-1 bg-white/35 hover:bg-white/55 border border-white/30 text-[#1D1D1F] rounded-lg text-[10px] font-semibold cursor-pointer transition-all">Save to disk</button>
                                        <button type="button" onClick={() => handleAddToProject(authResult, 'auth_scaffold.md')} className="px-2.5 py-1 bg-white/35 hover:bg-white/55 border border-white/30 text-[#1D1D1F] rounded-lg text-[10px] font-semibold cursor-pointer transition-all">Add to project</button>
                                        <button type="button" onClick={() => navigator.clipboard?.writeText(authResult)} className="px-2.5 py-1 bg-white/35 hover:bg-white/55 border border-white/30 text-[#1D1D1F] rounded-lg text-[10px] font-semibold cursor-pointer transition-all">Copy</button>
                                    </div>
                                    <pre className="mt-3 p-3 bg-white/30 border border-white/20 rounded-lg text-xs text-[#1D1D1F] font-mono overflow-auto max-h-48 whitespace-pre-wrap">{authResult}</pre>
                                </div>
                            )}
                        </div>

                        {/* AI Architect Chatbot Drawer Trigger */}
                        <div className="p-5 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border border-[#4F46E5]/20 rounded-2xl shadow-[0_4px_20px_rgba(79,70,229,0.05)] group hover:from-indigo-50/80 hover:to-purple-50/80 hover:shadow-lg hover:border-[#4F46E5]/30 transition-all duration-300">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={14} className="text-[#4F46E5] animate-pulse" />
                                <span className="text-[11px] font-mono font-bold text-[#4F46E5] uppercase tracking-wider">AI Architect</span>
                            </div>
                            <p className="text-[12px] text-[#2C2C2E] leading-relaxed font-medium mb-4">
                                Launch the full-screen premium AI Architect chatbot. Design, discuss, and auto-inject complete code scaffolds directly into your project.
                            </p>
                            <button 
                                type="button"
                                onClick={onLaunchArchitect} 
                                className="w-full px-4 py-2.5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white rounded-xl text-[11px] font-mono font-bold tracking-wider cursor-pointer shadow-[0_4px_12px_rgba(79,70,229,0.25)] active:scale-[0.98] hover:scale-[1.01] transition-all duration-200 uppercase flex items-center justify-center gap-2"
                            >
                                <Sparkles size={12} className="text-white" />
                                LAUNCH ARCHITECT
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};