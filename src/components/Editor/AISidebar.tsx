import React, { useState } from 'react';

interface AISidebarProps {
    projectContext?: string | null;
    createFileAtPath?: (path: string, content: string) => Promise<FileSystemFileHandle | null>;
}

export const AISidebar: React.FC<AISidebarProps> = ({ projectContext = '', createFileAtPath }) => {
    const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);
    const [schemaResult, setSchemaResult] = useState<string | null>(null);
    const [schemaCountdown, setSchemaCountdown] = useState<number | null>(null);
    const [isGeneratingAuth, setIsGeneratingAuth] = useState(false);
    const [authResult, setAuthResult] = useState<string | null>(null);
    const [authCountdown, setAuthCountdown] = useState<number | null>(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const API_BASE = (import.meta.env && (import.meta.env.VITE_API_URL as string)) || (window && (window as any).__API_BASE__) || 'http://localhost:5000';

    const handleGenerateSchema = async () => {
        setIsGeneratingSchema(true);
        setSchemaResult(null);
    setSchemaCountdown(null);
        try {
            const res = await fetch(`${API_BASE}/api/generate-mongo-schema`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectContext: projectContext || '' }) });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'unknown' }));
                // If server provided retryAfterSeconds, start countdown UI
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
            const res = await fetch(`${API_BASE}/api/generate-auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectContext: projectContext || '' }) });
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

    // Countdown effects for schema retry
    React.useEffect(() => {
        if (schemaCountdown && schemaCountdown > 0) {
            const id = setInterval(() => {
                setSchemaCountdown((s) => (s && s > 0 ? s - 1 : 0));
            }, 1000);
            return () => clearInterval(id);
        }
        if (schemaCountdown === 0) {
            setSchemaCountdown(null);
        }
        return;
    }, [schemaCountdown]);

    // Countdown effects for auth retry
    React.useEffect(() => {
        if (authCountdown && authCountdown > 0) {
            const id = setInterval(() => {
                setAuthCountdown((s) => (s && s > 0 ? s - 1 : 0));
            }, 1000);
            return () => clearInterval(id);
        }
        if (authCountdown === 0) {
            setAuthCountdown(null);
        }
        return;
    }, [authCountdown]);

    const handleSaveToDisk = async (content: string, defaultName: string) => {
        try {
            // Prefer File System Access API when available
            // showSaveFilePicker may exist in secure contexts; narrow at runtime
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (window && (window as any).showSaveFilePicker) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const opts = { suggestedName: defaultName, types: [{ accept: { 'text/markdown': ['.md'], 'text/plain': ['.txt'] } }] };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const handle = await (window as any).showSaveFilePicker(opts);
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
                return true;
            }

            // Fallback: download as blob
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
        <aside className="w-full sm:w-80 md:w-96 lg:w-[380px] bg-[#080808] p-4 sm:p-6 flex flex-col space-y-6 sm:space-y-8 border-l border-white/5 relative overflow-hidden">
            {/* Ambient Glow (kept for visual consistency) */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 space-y-6">
                <div>
                    <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em] mb-6">AI Actions</h3>

                    <div className="space-y-4">
                        <div className="p-5 rounded-2xl glass-panel group transition-all hover:border-cyan-500/30">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Generate MongoDB Schema</span>
                            </div>
                            <p className="text-[12px] text-white/30 leading-relaxed font-medium mb-3">
                                Click to generate a suggested MongoDB schema (collections, example documents, and indexes) using the AI.
                            </p>
                            <div className="flex gap-2">
                                <button onClick={handleGenerateSchema} disabled={isGeneratingSchema} className="px-3 py-2 bg-cyan-500 text-black rounded font-bold">
                                    {isGeneratingSchema ? 'Generating...' : 'Generate Schema'}
                                </button>
                                <button onClick={() => { setSchemaResult(null); }} className="px-3 py-2 bg-white/5 text-white rounded">Clear</button>
                            </div>
                            {schemaResult && (
                                <div>
                                    <div className="mt-3 flex gap-2">
                                        <button onClick={async () => { await handleSaveToDisk(schemaResult, 'generated_schema.md'); }} className="px-2 py-1 bg-white/5 text-white rounded text-xs">Save to disk</button>
                                        <button onClick={async () => { await handleAddToProject(schemaResult, 'generated_schema.md'); }} className="px-2 py-1 bg-white/5 text-white rounded text-xs">Add to project</button>
                                        <button onClick={() => { navigator.clipboard?.writeText(schemaResult); }} className="px-2 py-1 bg-white/5 text-white rounded text-xs">Copy</button>
                                    </div>
                                    <pre className="mt-3 p-3 bg-black/40 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">{schemaResult}</pre>
                                </div>
                            )}
                        </div>

                        <div className="p-5 rounded-2xl glass-panel group transition-all hover:border-pink-500/30">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Generate Auth Scaffold</span>
                            </div>
                            <p className="text-[12px] text-white/30 leading-relaxed font-medium mb-3">
                                Click to generate an authentication scaffold (Express + MongoDB + JWT) using the AI.
                            </p>
                            <div className="flex gap-2">
                                <button onClick={handleGenerateAuth} disabled={isGeneratingAuth} className="px-3 py-2 bg-pink-500 text-black rounded font-bold">
                                    {isGeneratingAuth ? 'Generating...' : 'Generate Auth'}
                                </button>
                                <button onClick={() => { setAuthResult(null); }} className="px-3 py-2 bg-white/5 text-white rounded">Clear</button>
                            </div>
                            {authResult && (
                                <div>
                                    <div className="mt-3 flex gap-2">
                                        <button onClick={async () => { await handleSaveToDisk(authResult, 'auth_scaffold.md'); }} className="px-2 py-1 bg-white/5 text-white rounded text-xs">Save to disk</button>
                                        <button onClick={async () => { await handleAddToProject(authResult, 'auth_scaffold.md'); }} className="px-2 py-1 bg-white/5 text-white rounded text-xs">Add to project</button>
                                        <button onClick={() => { navigator.clipboard?.writeText(authResult); }} className="px-2 py-1 bg-white/5 text-white rounded text-xs">Copy</button>
                                    </div>
                                    <pre className="mt-3 p-3 bg-black/40 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">{authResult}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};
