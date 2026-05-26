import React from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, BrainCircuit, ShieldAlert } from 'lucide-react';

interface WelcomePageProps {
    onProjectSelect: (name: string, handle?: FileSystemDirectoryHandle) => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onProjectSelect }) => {

    const handleOpenFolder = async () => {
        try {
            if ('showDirectoryPicker' in window) {
                const w = window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> };
                if (w.showDirectoryPicker) {
                    const directoryHandle = await w.showDirectoryPicker();
                    onProjectSelect(directoryHandle.name, directoryHandle);
                }
            } else {
                alert('Your browser does not support the File System Access API.');
            }
        } catch (err: any) {
            console.error('Folder selection error:', err);
            if (err.name !== 'AbortError') {
                alert(`Error selecting folder: ${err.message || 'Unknown error'}. Please try again.`);
            }
        }
    };

    return (
        <div className="w-screen h-screen fixed overflow-hidden flex flex-col justify-between font-sans antialiased text-[#1D1D1F] selection:bg-[#4F46E5]/20 bg-[#F8FAFC]">
            
            {/* High-Saturation Geometric Glow Layout Nodes */}
            <div className="absolute top-[-10%] left-[-5%] w-[45vh] h-[45vh] bg-gradient-to-br from-[#FFECD2] to-[#FCB69F] opacity-70 filter blur-[60px] rounded-full pointer-events-none -z-10" />
            <div className="absolute top-[20%] right-[-10%] w-[60vh] h-[60vh] bg-gradient-to-tr from-[#A1C4FD] to-[#C2E9FB] opacity-65 filter blur-[70px] rounded-full pointer-events-none -z-10" />
            <div className="absolute bottom-[-10%] right-[5%] w-[50vh] h-[50vh] bg-gradient-to-bl from-[#FF0844] to-[#FFB199] opacity-45 filter blur-[60px] rounded-full pointer-events-none -z-10" />

            {/* Premium Header */}
            <header className="w-full px-8 py-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-2 text-[#1D1D1F]">
                    <BrainCircuit size={20} strokeWidth={1.75} />
                    <span className="text-[15px] font-semibold tracking-tight">K-Studio</span>
                </div>
                <button
                    type="button"
                    className="text-[13px] font-medium text-[#4F46E5] hover:text-[#3730A3] transition-colors cursor-pointer"
                >
                    Sign in
                </button>
            </header>

            {/* 🎯 Master Centered Completely Transparent Panel */}
            <main className="flex-1 flex flex-col justify-center items-center text-center px-8 sm:px-16 z-0 w-full max-w-xl mx-auto">
                {/* 🚨 FIXED: Removed all container backgrounds, paddings, borders, and shadows */}
                <section className="flex flex-col items-center w-full">
                    
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.4 }}
                        className="w-12 h-12 flex items-center justify-center text-[#1D1D1F] mb-5"
                    >
                        <BrainCircuit size={40} className="stroke-[1.5]" />
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.4 }}
                        className="text-4xl sm:text-5xl font-bold tracking-tight text-[#1D1D1F] leading-tight"
                    >
                        K-Studio
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="text-[14px] sm:text-[15px] text-[#48484A] font-medium mt-3 max-w-sm leading-relaxed"
                    >
                        Cloud Workspace Powered by Gemini 3.0
                    </motion.p>

                    {/* Central Interactive Launch Trigger */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="mt-8 w-full flex justify-center"
                    >
                        <button
                            type="button"
                            onClick={handleOpenFolder}
                            className="group flex items-center justify-center gap-2.5 py-3.5 px-8 bg-[#1D1D1F] hover:bg-[#4F46E5] text-white rounded-full font-semibold text-[14px] cursor-pointer transition-all duration-300 shadow-md hover:shadow-[0_12px_25px_rgba(79,70,229,0.25)] active:scale-[0.97]"
                        >
                            <FolderOpen size={16} className="group-hover:-translate-y-0.5 transition-transform" />
                            <span>Open Local Directory</span>
                        </button>
                    </motion.div>
                    
                </section>
            </main>

            {/* Global Workspace Security Shield Footer */}
            <footer className="w-full px-8 py-5 flex flex-col sm:flex-row items-center justify-between text-[#48484A] text-[11px] font-normal gap-3 sm:gap-0 z-10 text-center sm:text-left">
                <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                    <ShieldAlert size={12} className="text-[#86868B] shrink-0" />
                    <span>Secure local file workspace access. Your folders are kept private.</span>
                </div>
                <div className="text-[#86868B]">
                    <span>K-Studio &copy; 2026. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
};

export default WelcomePage;