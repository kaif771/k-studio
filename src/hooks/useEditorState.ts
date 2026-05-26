import { useState, useCallback } from 'react';

export interface Tab {
    id: string;
    fileName: string;
    isDirty: boolean;
    handle: FileSystemFileHandle;
}

export const useEditorState = () => {
    const [activeFile, setActiveFile] = useState<string | null>(null);
    const [activeFileHandle, setActiveFileHandle] = useState<FileSystemFileHandle | null>(null);
    const [code, setCode] = useState("// Select a file to view code...");
    const [isCommandOpen, setIsCommandOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(true);
    const [isAISidebarOpen, setIsAISidebarOpen] = useState(true);
    const [prompt, setPrompt] = useState("");
    const [image, setImage] = useState<string | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<{ path: string, content: string }[]>([]);

    // Multi-tab tracking states
    const [openTabs, setOpenTabs] = useState<Tab[]>([]);
    const [tabContents, setTabContents] = useState<Record<string, string>>({});

    const openTab = useCallback(async (fileName: string, handle: FileSystemFileHandle, initialContent?: string) => {
        const id = fileName;
        
        setActiveFile(fileName);
        setActiveFileHandle(handle);

        if (initialContent !== undefined) {
            setTabContents(prev => ({ ...prev, [id]: initialContent }));
            setCode(initialContent);
        } else if (tabContents[id] !== undefined) {
            setCode(tabContents[id]);
        } else {
            try {
                const file = await handle.getFile();
                const text = await file.text();
                setTabContents(prev => ({ ...prev, [id]: text }));
                setCode(text);
            } catch (err) {
                console.error("Error loading file:", err);
                setCode("// Error loading file contents.");
            }
        }

        setOpenTabs(prev => {
            if (prev.some(t => t.id === id)) return prev;
            return [...prev, { id, fileName, isDirty: false, handle }];
        });
    }, [tabContents]);

    const closeTab = useCallback((id: string) => {
        setOpenTabs(prev => {
            const nextTabs = prev.filter(t => t.id !== id);
            
            // If we closed the active tab
            if (activeFile === id) {
                if (nextTabs.length > 0) {
                    const lastTab = nextTabs[nextTabs.length - 1];
                    setActiveFile(lastTab.fileName);
                    setActiveFileHandle(lastTab.handle);
                    setCode(tabContents[lastTab.id] || "");
                } else {
                    setActiveFile(null);
                    setActiveFileHandle(null);
                    setCode("// Select a file to view code...");
                }
            }
            return nextTabs;
        });

        setTabContents(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, [activeFile, tabContents]);

    // Custom setCode that marks tab as dirty
    const handleCodeChange = useCallback((newVal: string | ((prev: string) => string)) => {
        setCode(prev => {
            const resolvedVal = typeof newVal === 'function' ? newVal(prev) : newVal;
            
            if (activeFile) {
                setTabContents(c => ({ ...c, [activeFile]: resolvedVal }));
                setOpenTabs(t => t.map(tab => {
                    if (tab.id === activeFile && !tab.isDirty) {
                        return { ...tab, isDirty: true };
                    }
                    return tab;
                }));
            }
            
            return resolvedVal;
        });
    }, [activeFile]);

    return {
        activeFile,
        setActiveFile,
        activeFileHandle,
        setActiveFileHandle,
        code,
        setCode: handleCodeChange, // Bind the custom code change handler
        isCommandOpen,
        setIsCommandOpen,
        isPreviewOpen,
        setIsPreviewOpen,
        isFileExplorerOpen,
        setIsFileExplorerOpen,
        isAISidebarOpen,
        setIsAISidebarOpen,
        prompt,
        setPrompt,
        image,
        setImage,
        isThinking,
        setIsThinking,
        pendingFiles,
        setPendingFiles,
        // Multi-tab outputs
        openTabs,
        setOpenTabs,
        openTab,
        closeTab
    };
};
