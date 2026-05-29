import React, { useState, useEffect } from 'react';
import { WelcomePage } from './components/WelcomePage';
import { MainEditor } from './components/Editor/MainEditor';

// Dynamic glob mapping to load newly injected components at runtime cleanly
const globComponents = import.meta.glob('./components/**/*.{js,jsx,ts,tsx}');

// Custom ErrorBoundary to intercept rendering/compilation crashes and show a glassmorphic fallback
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("AppErrorBoundary caught crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="w-screen h-screen bg-slate-950/90 backdrop-blur-md flex flex-col justify-center items-center gap-4 text-center font-mono text-[#1D1D1F] select-none p-6 relative overflow-hidden">
          <div className="absolute top-[-10%] left-[-5%] w-[45vh] h-[45vh] bg-gradient-to-br from-[#FFECD2] to-[#FCB69F] opacity-20 filter blur-[60px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[5%] w-[50vh] h-[50vh] bg-gradient-to-bl from-[#FF0844] to-[#FFB199] opacity-15 filter blur-[60px] rounded-full pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4 shadow-xl backdrop-blur-xl animate-pulse">
            <span className="text-3xl">⚙️</span>
          </div>
          
          <h3 className="text-white text-sm font-bold tracking-widest uppercase animate-pulse">Compiling Vector Engine...</h3>
          <p className="text-[10px] text-slate-400 max-w-sm leading-relaxed mt-2">
            Self-healing compiler is binding import paths. Standby while matrix registers component injections.
          </p>
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-left max-w-md w-full">
            <p className="text-[10px] text-red-400 font-bold uppercase mb-1">Diagnostic Log:</p>
            <p className="text-[9px] text-red-300/80 break-words leading-relaxed font-sans">{this.state.error.message || String(this.state.error)}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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

  // Render isolated component preview mode inside safe ErrorBoundary
  if (PreviewComponent) {
    return (
      <AppErrorBoundary>
        <div className="w-screen h-screen overflow-auto bg-slate-900 flex justify-center items-center p-4">
          <React.Suspense fallback={<div className="text-white font-mono text-xs tracking-wider animate-pulse uppercase">Compiling component...</div>}>
            <PreviewComponent />
          </React.Suspense>
        </div>
      </AppErrorBoundary>
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
