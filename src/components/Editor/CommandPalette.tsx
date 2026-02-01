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
                    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            className="w-[650px] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        >
                            {image && (
                                <div className="px-8 pt-6">
                                    <div className="relative w-24 h-24 rounded-xl border border-white/10 overflow-hidden group">
                                        <img src={image} alt="Blueprint" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => setImage(null)}
                                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={16} className="text-white" />
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-4 px-8 py-6">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 bg-gradient-to-br from-pink-500/10 to-blue-500/10 border border-white/5 rounded-xl hover:bg-white/10 transition-all text-white/40 hover:text-white"
                                >
                                    <Paperclip size={24} />
                                </button>
                                <input
                                    autoFocus
                                    className="bg-transparent border-none outline-none text-white w-full text-lg placeholder-white/10 font-medium"
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
                                {isScanning && <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />}
                            </div>
                            <div className="px-8 py-4 border-t border-white/5 flex justify-between bg-white/[0.02] text-[10px] text-white/20 font-bold uppercase tracking-widest">
                                <div className="flex gap-4">
                                    <span>ENTER to Execute</span>
                                    <span>ESC to Exit</span>
                                </div>
                                <span className={isScanning ? "animate-pulse text-yellow-500/50" : "text-cyan-500/50"}>
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
