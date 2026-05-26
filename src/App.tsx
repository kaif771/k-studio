import { useState } from 'react';
import { WelcomePage } from './components/WelcomePage';
import { MainEditor } from './components/Editor/MainEditor';

export default function GeminiArchitect() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const handleProjectSelect = (name: string, handle?: FileSystemDirectoryHandle) => {
    // Always reset both together so stale handle from previous project never bleeds in
    setDirectoryHandle(handle ?? null);
    setSelectedProject(name);
  };

  const handleBack = () => {
    setSelectedProject(null);
    setDirectoryHandle(null);
  };

  if (!selectedProject) {
    return <WelcomePage onProjectSelect={handleProjectSelect} />;
  }

  return (
    <MainEditor
      selectedProject={selectedProject}
      directoryHandle={directoryHandle}
      onBack={handleBack}
    />
  );
}
