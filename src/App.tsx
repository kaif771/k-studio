import React, { useState, useEffect } from 'react';
import { WelcomePage } from './components/WelcomePage';
import { MainEditor } from './components/Editor/MainEditor';

// Dynamic glob mapping to load newly injected components at runtime cleanly
const globComponents = import.meta.glob('./components/**/*.{js,jsx,ts,tsx}');

export default function GeminiArchitect() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [PreviewComponent, setPreviewComponent] = useState<React.ComponentType | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    // Intercept visual component preview request via query parameter '?preview=ComponentName'
    const params = new URLSearchParams(window.location.search);
    const previewCompName = params.get('preview');

    if (previewCompName) {
      console.log(`🔍 Isolated component preview activated: "${previewCompName}"`);
      
      let foundPath = '';
      for (const path in globComponents) {
        if (path.endsWith(`/${previewCompName}.jsx`) || path.endsWith(`/${previewCompName}.tsx`) || path.endsWith(`/${previewCompName}.js`)) {
          foundPath = path;
          break;
        }
      }

      if (foundPath) {
        globComponents[foundPath]()
          .then((module: any) => {
            const Component = module.default || module[previewCompName];
            if (Component) {
              setPreviewComponent(() => Component);
            } else {
              setPreviewError(`Component "${previewCompName}" has no default or matching named export.`);
            }
          })
          .catch((err) => {
            console.error('Failed to load preview component:', err);
            setPreviewError(`Error loading component: ${err.message}`);
          });
      } else {
        setPreviewError(`Component "${previewCompName}" not found. Verify file exists in src/components/ directory.`);
      }
    }
  }, []);

  const handleProjectSelect = (name: string, handle?: FileSystemDirectoryHandle) => {
    // Always reset both together so stale handle from previous project never bleeds in
    setDirectoryHandle(handle ?? null);
    setSelectedProject(name);
  };

  const handleBack = () => {
    setSelectedProject(null);
    setDirectoryHandle(null);
  };

  // Render isolated component preview mode
  if (PreviewComponent) {
    return (
      <div className="w-screen h-screen overflow-auto bg-slate-900 flex justify-center items-center p-4">
        <React.Suspense fallback={<div className="text-white font-mono text-xs tracking-wider animate-pulse uppercase">Compiling component...</div>}>
          <PreviewComponent />
        </React.Suspense>
      </div>
    );
  }

  // Render preview loader error boundary screen
  if (previewError) {
    return (
      <div className="w-screen h-screen bg-slate-950 text-red-500 font-mono p-8 flex flex-col justify-center items-center gap-4 text-center select-none">
        <span className="text-4xl animate-bounce">⚠️</span>
        <h2 className="text-sm font-bold tracking-widest uppercase text-red-500/80">Preview Compiler Refusal</h2>
        <p className="text-[11px] text-slate-400 max-w-md leading-relaxed">{previewError}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-5 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl hover:bg-slate-700 transition-all text-[10px] font-bold uppercase tracking-wider cursor-pointer"
        >
          Re-Source Compiler
        </button>
      </div>
    );
  }

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
