import { useState, useEffect, useCallback } from 'react';

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

    const loadFile = useCallback(async (handle: FileSystemFileHandle) => {
        try {
            const file = await handle.getFile();
            const text = await file.text();
            setCode(text);
        } catch (err) {
            console.error("Error loading file:", err);
            setCode("// Error loading file contents.");
        }
    }, []);

    useEffect(() => {
        if (activeFileHandle) {
            loadFile(activeFileHandle);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFileHandle]);

    return {
        activeFile,
        setActiveFile,
        activeFileHandle,
        setActiveFileHandle,
        code,
        setCode,
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
        setPendingFiles
    };
};
