import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Paperclip, X, Sparkles, FileCode, CheckCircle } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
    image?: string;
    timestamp: Date;
}

interface AIChatbotProps {
    cacheName: string | null;
    createFileAtPath: (path: string, content: string) => Promise<FileSystemFileHandle | null>;
    pendingFiles?: { path: string, content: string }[];
    setPendingFiles?: (files: { path: string, content: string }[] | ((prev: { path: string, content: string }[]) => { path: string, content: string }[])) => void;
    isOpen?: boolean;
    onClose?: () => void;
    isDrawerMode?: boolean;
    projectContext?: string | null;
    selectedModel?: string;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({
    cacheName,
    createFileAtPath,
    pendingFiles = [], 
    setPendingFiles = () => {}, 
    isOpen = true,
    onClose,
    isDrawerMode = false,
    projectContext = null,
    selectedModel = 'gemini-1.5-flash'
}) => {
    const [input, setInput] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isCursorMode, setIsCursorMode] = useState(true); // Default to One-Shot Cursor mode to save user quota
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'ai',
            content: 'Welcome to Kaif Studio Assistant. Describe your project requirements, target stack, or database needs. I will compile a complete, high-end technical architecture blueprint and development hours estimate instantly.',
            timestamp: new Date(),
        }
    ]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSend = async () => {
        if ((!input.trim() && !selectedImage) || isSending) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            image: selectedImage as string | undefined,
            timestamp: new Date(),
        };

        setMessages((prev: Message[]) => [...prev, userMessage]);
        const currentInput = input;
        const currentImage = selectedImage;
        
        setInput('');
        setSelectedImage(null);
        setIsSending(true);

        try {
            const historyToSend = messages
                .filter((_: any, index: number) => index !== 0 || messages[0].role !== 'ai')
                .map((m: Message) => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.content }]
                }));

            // Direct custom prompt injection for complete full-app generation
            let finalMessageText = currentInput;
            if (isCursorMode) {
                finalMessageText = `${currentInput}\n\n[DIRECTIVE: ONE-SHOT CURSOR MODE ACTIVE. Please proactively generate all required files completely in single-turn blocks with no placeholders to save my API key quota.]`;
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: finalMessageText,
                    image: currentImage,
                    history: historyToSend,
                    cacheName,
                    projectContext: projectContext, 
                    model: selectedModel,
                    isCursorMode: isCursorMode
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || 'Network response was not ok');
            }

            const data = await response.json();

            const extractedFiles = extractFilesFromMarkdown(data.reply);
            if (extractedFiles.length > 0) {
                console.log("[K-Studio Engine] Nayi files workspace queue me add ho gayi hain:", extractedFiles);
                setPendingFiles((prev: any[]) => [...prev, ...extractedFiles]);
            }

            const aiMessage: Message = {
                id: Date.now().toString(),
                role: 'ai',
                content: data.reply,
                timestamp: new Date(),
            };

            setMessages((prev: Message[]) => [...prev, aiMessage]);
        } catch (error: any) {
            console.error("❌ Chat Dispatch Failure:", error);
            const errMsg = error?.message || 'Something went wrong during generation.';
            const errorMessage: Message = {
                id: Date.now().toString(),
                role: 'ai',
                content: `Error: ${errMsg}`,
                timestamp: new Date(),
            };
            setMessages((prev: Message[]) => [...prev, errorMessage]);
            
            setInput(currentInput);
            if (currentImage) setSelectedImage(currentImage);
        } finally {
            setIsSending(false);
        }
    };

    const handleApplyFiles = async () => {
        if (pendingFiles.length === 0) return;
        try {
            for (const file of pendingFiles) {
                await createFileAtPath(file.path, file.content);
            }
            setPendingFiles([]);
            alert("Success! All suggested file architectures built successfully.");
        } catch (error) {
            console.error("❌ Core File Commit Rejected:", error);
            alert("Security Handshake Timeout: Please re-select your workspace folder.");
        }
    };

    const extractFilesFromMarkdown = (text: string) => {
        const files: { path: string, content: string }[] = [];
        try {
            const ticks = '`' + '`' + '`';
            const pattern = '(?:###|##|#|File:?|Filename:?|\\*\\*)\\s*(?:\\d+\\.?\\s*)?[`*]?([a-zA-Z0-9._\\-/ ]+\\.[a-zA-Z0-9]+)[`*]?[\\s\\S]*?\\n\\s*' + ticks + '[a-zA-Z0-9_-]*\\n([\\s\\S]*?)' + ticks;
            const fileHeaderRegex = new RegExp(pattern, 'gi');

            let match;
            while ((match = fileHeaderRegex.exec(text)) !== null) {
                files.push({
                    path: match[1].trim(),
                    content: match[2].trim()
                });
            }
        } catch (err) {
            console.error("Error parsing response markdown blocks:", err);
        }
        return files;
    };

    const renderContent = (text: string) => {
        const lines = text.split('\n');
        return lines.map((line, idx) => {
            if (line.startsWith('### ')) {
                return <h4 key={idx} className="text-sm font-bold text-neutral-800 mt-2 mb-1">{line.replace('### ', '')}</h4>;
            }
            if (line.startsWith('## ')) {
                return <h3 key={idx} className="text-base font-bold text-neutral-900 mt-3 mb-1">{line.replace('## ', '')}</h3>;
            }
            if (line.startsWith('- ') || line.startsWith('* ')) {
                return <li key={idx} className="text-[12.5px] ml-4 list-disc text-neutral-700 leading-relaxed">{line.substring(2)}</li>;
            }
            return (
                <p key={idx} className="text-[13px] text-neutral-700 leading-relaxed min-h-[4px]">
                    {line}
                </p>
            );
        });
    };

    if (isDrawerMode) {
        return (
            <div className="h-full flex flex-col justify-between overflow-hidden bg-neutral-50/20 font-sans antialiased">
                {/* Chat Log Arena */}
                <div 
                    ref={scrollRef} 
                    className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 custom-scrollbar"
                >
                    {messages.map((msg: Message) => (
                        <div 
                            key={msg.id} 
                            className={`flex gap-3.5 max-w-[92%] p-4 rounded-2xl border transition-all ${
                                msg.role === 'ai' 
                                    ? 'bg-white border-neutral-200/70 shadow-sm align-self-start' 
                                    : 'bg-neutral-900 border-neutral-900 text-white shadow-sm ml-auto flex-row-reverse'
                            }`}
                        >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border text-[11px] font-bold ${
                                msg.role === 'ai' ? 'bg-neutral-50 border-neutral-200 text-neutral-800' : 'bg-neutral-800 border-neutral-700 text-white'
                            }`}>
                                {msg.role === 'ai' ? <Bot size={13} /> : <User size={13} />}
                            </div>
                            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${
                                    msg.role === 'ai' ? 'text-neutral-400' : 'text-neutral-500'
                                }`}>
                                    {msg.role === 'ai' ? 'Studio Brain' : 'You'}
                                </span>
                                {msg.image && (
                                    <img src={msg.image} alt="User upload" className="rounded-xl border border-neutral-200/50 max-h-40 object-cover shadow-xs w-fit" />
                                )}
                                <div className="space-y-1">
                                    {msg.role === 'ai' ? renderContent(msg.content) : (
                                        <p className="text-[13px] leading-relaxed font-medium whitespace-pre-wrap text-white">{msg.content}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isSending && (
                        <div className="flex gap-3.5 max-w-[90%] p-4 rounded-2xl border bg-white border-neutral-200/70 shadow-sm align-self-start animate-pulse">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border bg-neutral-50 border-neutral-200 text-neutral-800">
                                <Bot size={13} className="animate-spin" />
                            </div>
                            <div className="flex-1 flex flex-col gap-1.5">
                                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-neutral-400">Studio Brain</span>
                                <div className="flex items-center gap-1.5 py-1.5">
                                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Bottom Control Desk Panel Section */}
                <div className="border-t border-neutral-100 bg-white p-5 space-y-4 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.015)]">
                    {selectedImage && (
                        <div className="flex items-center gap-2 p-1.5 bg-neutral-50 border border-neutral-200 rounded-lg w-fit text-[#1D1D1F] shadow-xs animate-in fade-in duration-200">
                            <img src={selectedImage} alt="Preview" className="w-7 h-7 rounded-md object-cover" />
                            <span className="text-[10px] text-neutral-400 font-mono font-bold uppercase">Attached</span>
                            <button onClick={() => setSelectedImage(null)} className="text-neutral-400 hover:text-neutral-900 cursor-pointer">
                                <X size={11} />
                            </button>
                        </div>
                    )}

                    {pendingFiles.length > 0 && (
                        <div className="flex items-center justify-between p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-xs animate-in slide-in-from-bottom duration-300">
                            <div className="flex items-center gap-2 text-indigo-950 font-bold font-mono text-[9.5px] uppercase tracking-wider">
                                <FileCode size={13} className="text-indigo-600" />
                                <span>AI Suggested {pendingFiles.length} file drafts</span>
                            </div>
                            <button 
                                onClick={handleApplyFiles} 
                                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[9.5px] font-black uppercase tracking-widest rounded-lg transition-colors cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                            >
                                <CheckCircle size={11} />
                                <span>Apply Changes</span>
                            </button>
                        </div>
                    )}

                    {/* Glowing Premium One-Shot Cursor Mode Switch */}
                    <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/20 border border-indigo-100/50 rounded-xl transition-all duration-300">
                        <div 
                            className="flex items-center gap-2 cursor-pointer select-none" 
                            onClick={() => setIsCursorMode(!isCursorMode)}
                        >
                            <div className={`relative w-8 h-4 rounded-full transition-colors duration-300 shrink-0 ${isCursorMode ? 'bg-indigo-600' : 'bg-neutral-300'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-300 ${isCursorMode ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <span className="text-[10px] font-black font-mono tracking-wide text-neutral-700 flex items-center gap-1">
                                {isCursorMode ? '🚀 CURSOR ONE-SHOT ACTIVE' : '⚡ FAST CHAT MODE'}
                                {isCursorMode && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                            </span>
                        </div>
                        <span className="text-[8px] font-mono font-black uppercase text-indigo-700 bg-indigo-100/75 px-2 py-0.5 rounded-md tracking-wider">
                            Saves API Quotas
                        </span>
                    </div>

                    <div className="relative flex items-center bg-white border border-neutral-200 rounded-xl px-3 py-3 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer mr-2 shrink-0" 
                            title="Attach blueprint image"
                        >
                            <Paperclip size={16} />
                        </button>
                        
                        <input 
                            type="text" 
                            value={input} 
                            onChange={(e) => setInput(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                            placeholder="Type specs (e.g. build an ecommerce app)..." 
                            className="w-full bg-transparent border-none outline-none pr-10 text-[13px] text-neutral-900 placeholder-neutral-900/80 font-medium" 
                            disabled={isSending} 
                        />
                        
                        <button 
                            onClick={handleSend} 
                            disabled={(!input.trim() && !selectedImage) || isSending} 
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 bg-[#1D1D1F] text-white rounded-lg hover:bg-indigo-600 disabled:opacity-0 transition-all duration-300 cursor-pointer active:scale-95 flex items-center justify-center"
                        >
                            <Send size={11} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex justify-end font-sans antialiased">
            <div 
                className="absolute inset-0 bg-black/15 backdrop-blur-xs transition-opacity duration-300 cursor-pointer"
                onClick={onClose}
            />
            <aside className="relative w-full max-w-md h-full bg-white border-l border-neutral-200/60 shadow-[-20px_0_60px_rgba(0,0,0,0.08)] flex flex-col justify-between overflow-hidden z-10 animate-in slide-in-from-right duration-300">
                <div className="h-16 px-6 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
                    <div className="flex items-center gap-2">
                        <Sparkles size={15} className="text-indigo-600 animate-pulse" />
                        <h2 className="text-[11px] font-black uppercase tracking-widest text-neutral-800 font-mono">
                            Studio Assistant Drawer
                        </h2>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-all cursor-pointer font-bold text-sm"
                    >
                        ✕
                    </button>
                </div>

                <div 
                    ref={scrollRef} 
                    className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 custom-scrollbar bg-neutral-50/20"
                >
                    {messages.map((msg: Message) => (
                        <div 
                            key={msg.id} 
                            className={`flex gap-3.5 max-w-[92%] p-4 rounded-2xl border transition-all ${
                                msg.role === 'ai' 
                                    ? 'bg-white border-neutral-200/70 shadow-sm align-self-start' 
                                    : 'bg-neutral-900 border-neutral-900 text-white shadow-sm ml-auto flex-row-reverse'
                            }`}
                        >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border text-[11px] font-bold ${
                                msg.role === 'ai' ? 'bg-neutral-50 border-neutral-200 text-neutral-800' : 'bg-neutral-800 border-neutral-700 text-white'
                            }`}>
                                {msg.role === 'ai' ? <Bot size={13} /> : <User size={13} />}
                            </div>
                            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${
                                    msg.role === 'ai' ? 'text-neutral-400' : 'text-neutral-500'
                                }`}>
                                    {msg.role === 'ai' ? 'Studio Brain' : 'You'}
                                </span>
                                {msg.image && (
                                    <img src={msg.image} alt="User upload" className="rounded-xl border border-neutral-200/50 max-h-40 object-cover shadow-xs w-fit" />
                                )}
                                <div className="space-y-1">
                                    {msg.role === 'ai' ? renderContent(msg.content) : (
                                        <p className="text-[13px] leading-relaxed font-medium whitespace-pre-wrap text-white">{msg.content}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isSending && (
                        <div className="flex gap-3.5 max-w-[90%] p-4 rounded-2xl border bg-white border-neutral-200/70 shadow-sm align-self-start animate-pulse">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border bg-neutral-50 border-neutral-200 text-neutral-800">
                                <Bot size={13} className="animate-spin" />
                            </div>
                            <div className="flex-1 flex flex-col gap-1.5">
                                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-neutral-400">Studio Brain</span>
                                <div className="flex items-center gap-1.5 py-1.5">
                                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t border-neutral-100 bg-white p-5 space-y-4 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.015)]">
                    {selectedImage && (
                        <div className="flex items-center gap-2 p-1.5 bg-neutral-50 border border-neutral-200 rounded-lg w-fit text-[#1D1D1F] shadow-xs animate-in fade-in duration-200">
                            <img src={selectedImage} alt="Preview" className="w-7 h-7 rounded-md object-cover" />
                            <span className="text-[10px] text-neutral-400 font-mono font-bold uppercase">Attached</span>
                            <button onClick={() => setSelectedImage(null)} className="text-neutral-400 hover:text-neutral-900 cursor-pointer">
                                <X size={11} />
                            </button>
                        </div>
                    )}

                    {pendingFiles.length > 0 && (
                        <div className="flex items-center justify-between p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl shadow-xs animate-in slide-in-from-bottom duration-300">
                            <div className="flex items-center gap-2 text-indigo-950 font-bold font-mono text-[9.5px] uppercase tracking-wider">
                                <FileCode size={13} className="text-indigo-600" />
                                <span>AI Suggested {pendingFiles.length} file drafts</span>
                            </div>
                            <button 
                                onClick={handleApplyFiles} 
                                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[9.5px] font-black uppercase tracking-widest rounded-lg transition-colors cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                            >
                                <CheckCircle size={11} />
                                <span>Apply Changes</span>
                            </button>
                        </div>
                    )}

                    {/* Glowing Premium One-Shot Cursor Mode Switch */}
                    <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/20 border border-indigo-100/50 rounded-xl transition-all duration-300">
                        <div 
                            className="flex items-center gap-2 cursor-pointer select-none" 
                            onClick={() => setIsCursorMode(!isCursorMode)}
                        >
                            <div className={`relative w-8 h-4 rounded-full transition-colors duration-300 shrink-0 ${isCursorMode ? 'bg-indigo-600' : 'bg-neutral-300'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-300 ${isCursorMode ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <span className="text-[10px] font-black font-mono tracking-wide text-neutral-700 flex items-center gap-1">
                                {isCursorMode ? '🚀 CURSOR ONE-SHOT ACTIVE' : '⚡ FAST CHAT MODE'}
                                {isCursorMode && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                            </span>
                        </div>
                        <span className="text-[8px] font-mono font-black uppercase text-indigo-700 bg-indigo-100/75 px-2 py-0.5 rounded-md tracking-wider">
                            Saves API Quotas
                        </span>
                    </div>

                    <div className="relative flex items-center bg-white border border-neutral-200 rounded-xl px-3 py-3 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer mr-2 shrink-0" 
                            title="Attach blueprint image"
                        >
                            <Paperclip size={16} />
                        </button>
                        
                        <input 
                            type="text" 
                            value={input} 
                            onChange={(e) => setInput(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                            placeholder="Type specs (e.g. build an ecommerce app)..." 
                            className="w-full bg-transparent border-none outline-none pr-10 text-[13px] text-neutral-900 placeholder-neutral-900/80 font-medium" 
                            disabled={isSending} 
                        />
                        
                        <button 
                            onClick={handleSend} 
                            disabled={(!input.trim() && !selectedImage) || isSending} 
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 bg-[#1D1D1F] text-white rounded-lg hover:bg-indigo-600 disabled:opacity-0 transition-all duration-300 cursor-pointer active:scale-95 flex items-center justify-center"
                        >
                            <Send size={11} />
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
};

export default AIChatbot;