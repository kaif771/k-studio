import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paperclip, X } from 'lucide-react';

interface CommandPaletteProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    prompt: string;
    setPrompt: (prompt: string) => void;
    image: string | null;
    setImage: (image: string | null) => void;
    onSubmit: () => void;
    isScanning: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen,
    setIsOpen,
    prompt,
    setPrompt,
    image,
    setImage,
    onSubmit,
    isScanning
}) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Global KeyListener for Escape Key
    React.useEffect(() => {
        if (!isOpen) return;
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isOpen, setIsOpen]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <div 
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/20 backdrop-blur-sm cursor-pointer"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-[650px] bg-[#DBEAFE]/60 backdrop-blur-3xl border border-[#4F46E5]/25 rounded-2xl shadow-[0_25px_60px_rgba(79,70,229,0.15)] overflow-hidden cursor-default"
                        >
                            {/* Visual absolute close X button */}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/5 text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer z-[105]"
                                title="Close Panel"
                            >
                                <X size={14} strokeWidth={2.5} />
                            </button>

                            {image && (
                                <div className="px-8 pt-6">
                                    <div className="relative w-24 h-24 rounded-xl border border-[#4F46E5]/15 overflow-hidden group shadow-sm bg-[#EDE9FE]/60">
                                        <img src={image} alt="Blueprint" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => setImage(null)}
                                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                        >
                                            <X size={16} className="text-white" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-4 px-8 py-6 pr-12">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2.5 bg-[#EDE9FE]/70 border border-[#4F46E5]/15 rounded-xl hover:bg-[#DBEAFE]/60 transition-all text-[#86868B] hover:text-[#1D1D1F] shadow-sm cursor-pointer"
                                >
                                    <Paperclip size={20} />
                                </button>
                                <input
                                    autoFocus
                                    className="bg-transparent border-none outline-none text-[#1D1D1F] w-full text-lg placeholder-[#86868B]/40 font-medium"
                                    placeholder={isScanning ? "Scanning codebase..." : "Ask Gemini Architect..."}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Escape") setIsOpen(false);
                                        if (e.key === "Enter" && !isScanning) {
                                            onSubmit();
                                        }
                                    }}
                                    disabled={isScanning}
                                />
                                {isScanning && <div className="w-4 h-4 rounded-full border-2 border-[#1D1D1F]/20 border-t-[#1D1D1F] animate-spin" />}
                            </div>

                            <div className="px-8 py-4 border-t border-[#4F46E5]/15 flex justify-between bg-[#DBEAFE]/30 text-[10px] text-[#86868B] font-bold uppercase tracking-widest select-none">
                                <div className="flex gap-4">
                                    <button 
                                        onClick={onSubmit}
                                        disabled={isScanning || !prompt.trim()}
                                        className="hover:text-[#1D1D1F] transition-colors cursor-pointer uppercase disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-bold"
                                    >
                                        ENTER to Execute
                                    </button>
                                    <button 
                                        onClick={() => setIsOpen(false)}
                                        className="hover:text-[#1D1D1F] transition-colors cursor-pointer uppercase text-[10px] font-bold"
                                    >
                                        ESC to Exit
                                    </button>
                                </div>
                                <span className={isScanning ? "animate-pulse text-yellow-600 font-bold" : "text-[#4F46E5] font-bold"}>
                                    {isScanning ? "Reading Files..." : "Link Active"}
                                </span>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};
