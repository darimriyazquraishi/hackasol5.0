import React from 'react';
import {
  FilePlus,
  FolderOpen,
  FolderInput,
  Terminal,
  Search,
  BookOpen,
  Keyboard,
  Sparkles,
  GitBranch
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const WelcomeTab: React.FC = () => {
  const {
    openFile,
    createFile,
    openFolderFromDisk,
    exportProjectZip,
    setCommandPaletteOpen,
    setCommandPaletteMode,
    togglePanel,
    files
  } = useWorkspace();

  return (
    <div className="flex-1 bg-[#1e1e1e] text-[#cccccc] overflow-y-auto p-10 flex flex-col justify-center items-center select-none">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-16 h-16 text-[#007acc] shrink-0">
            <svg className="w-full h-full fill-current" viewBox="0 0 100 100">
              <path d="M96.7 15.6L72.4 2.8c-2.4-1.3-5.3-.8-7.1 1.2L28.1 36.3 12.3 24.2c-1.8-1.4-4.4-1.2-5.9.5L1.2 30.6c-1.6 1.8-1.6 4.5 0 6.3L19 50 .9 63.8c-1.6 1.8-1.6 4.5 0 6.3l5.2 5.9c1.6 1.8 4.1 2 5.9.5l15.9-12.1 37.1 32.3c1.8 1.6 4.5 2 6.7.9l24.9-12.7c2.4-1.2 3.9-3.7 3.9-6.4V22c0-2.7-1.5-5.2-3.8-6.4zM73.5 68.3L40.7 50l32.8-18.3v36.6z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-light text-white tracking-wide">
              Visual Studio Code
            </h1>
            <p className="text-sm text-[#858585] mt-1">
              Visual Studio Code environment with Monaco editor, browser directory access, and integrated shell.
            </p>
          </div>
        </div>

        {/* Grid sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Start column */}
          <div>
            <h2 className="text-sm font-semibold text-[#858585] uppercase tracking-wider mb-3">
              Start
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const name = prompt('Enter new file name:');
                  if (name) createFile(null, name);
                }}
                className="w-full p-2.5 rounded bg-[#252526] hover:bg-[#2d2d2d] flex items-center space-x-3 text-left transition-colors text-xs text-[#007acc] hover:text-[#3794ff]"
              >
                <FilePlus className="w-4 h-4 text-[#858585]" />
                <div>
                  <div className="font-medium text-white">New File...</div>
                  <div className="text-[11px] text-[#858585]">Create a new text or code file</div>
                </div>
              </button>

              <button
                onClick={() => openFolderFromDisk()}
                className="w-full p-2.5 rounded bg-[#252526] hover:bg-[#2d2d2d] flex items-center space-x-3 text-left transition-colors text-xs text-[#007acc] hover:text-[#3794ff]"
              >
                <FolderInput className="w-4 h-4 text-[#858585]" />
                <div>
                  <div className="font-medium text-white">Open Local Folder...</div>
                  <div className="text-[11px] text-[#858585]">Load any directory on your computer via File System API</div>
                </div>
              </button>

              <button
                onClick={() => exportProjectZip()}
                className="w-full p-2.5 rounded bg-[#252526] hover:bg-[#2d2d2d] flex items-center space-x-3 text-left transition-colors text-xs text-[#007acc] hover:text-[#3794ff]"
              >
                <FolderOpen className="w-4 h-4 text-[#858585]" />
                <div>
                  <div className="font-medium text-white">Export as ZIP</div>
                  <div className="text-[11px] text-[#858585]">Download all project files as a .zip package</div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick shortcuts & Features */}
          <div>
            <h2 className="text-sm font-semibold text-[#858585] uppercase tracking-wider mb-3">
              Keyboard Shortcuts
            </h2>
            <div className="bg-[#252526] rounded p-3 text-xs space-y-2.5 border border-[#333333]">
              <div className="flex items-center justify-between">
                <span className="text-[#858585]">Show All Commands</span>
                <kbd className="bg-[#1e1e1e] border border-[#3c3c3c] px-2 py-0.5 rounded text-[11px] font-mono text-white">
                  Ctrl+Shift+P
                </kbd>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#858585]">Quick Open File</span>
                <kbd className="bg-[#1e1e1e] border border-[#3c3c3c] px-2 py-0.5 rounded text-[11px] font-mono text-white">
                  Ctrl+P
                </kbd>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#858585]">Toggle Integrated Terminal</span>
                <kbd className="bg-[#1e1e1e] border border-[#3c3c3c] px-2 py-0.5 rounded text-[11px] font-mono text-white">
                  Ctrl+`
                </kbd>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#858585]">Toggle Primary Side Bar</span>
                <kbd className="bg-[#1e1e1e] border border-[#3c3c3c] px-2 py-0.5 rounded text-[11px] font-mono text-white">
                  Ctrl+B
                </kbd>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#858585]">Save File</span>
                <kbd className="bg-[#1e1e1e] border border-[#3c3c3c] px-2 py-0.5 rounded text-[11px] font-mono text-white">
                  Ctrl+S
                </kbd>
              </div>
            </div>

            {/* Quick Demo links */}
            <div className="mt-4 pt-3 border-t border-[#333333] flex items-center justify-between text-xs text-[#858585]">
              <span>Quick Start Files:</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => openFile('/src/App.tsx')}
                  className="text-[#007acc] hover:underline"
                >
                  App.tsx
                </button>
                <span>•</span>
                <button
                  onClick={() => openFile('/README.md')}
                  className="text-[#007acc] hover:underline"
                >
                  README.md
                </button>
                <span>•</span>
                <button
                  onClick={() => openFile('/demo.py')}
                  className="text-[#007acc] hover:underline"
                >
                  demo.py
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
