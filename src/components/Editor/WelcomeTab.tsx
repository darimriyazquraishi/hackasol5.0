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
    <div className="flex-1 bg-[#080808] text-[#D5D2CC] overflow-y-auto p-10 flex flex-col justify-center items-center select-none">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="flex items-center space-x-5 mb-8">
          <div className="w-16 h-16 rounded-xl bg-[#121212] border border-[#303030] p-2.5 flex items-center justify-center shrink-0 shadow-lg">
            <img
              src="/lumi-logo.jpg"
              alt="LUMI"
              className="w-full h-full object-contain rounded"
            />
          </div>
          <div>
            <h1 className="text-3xl font-normal font-display text-[#F5F4F1] tracking-tight">
              LUMI IDE Studio
            </h1>
            <p className="text-sm text-[#9C9C9C] mt-1">
              Integrated developer environment with Monaco editor, local workspace management, and high-performance engineering terminal.
            </p>
          </div>
        </div>

        {/* Grid sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Start column */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#9C9C9C] mb-3">
              Start
            </h2>
            <div className="space-y-2.5">
              <button
                onClick={() => {
                  const name = prompt('Enter new file name:');
                  if (name) createFile(null, name);
                }}
                className="w-full p-3 rounded-lg bg-[#121212] hover:bg-[#191919] border border-[#303030] hover:border-[#987654] flex items-center space-x-3 text-left transition-all active:scale-[0.99] group cursor-pointer"
              >
                <FilePlus className="w-4 h-4 text-[#987654] group-hover:text-[#B89774] transition-colors" />
                <div>
                  <div className="font-medium text-xs text-[#F5F4F1]">New File...</div>
                  <div className="text-[11px] text-[#9C9C9C]">Create a text, script, or model file</div>
                </div>
              </button>

              <button
                onClick={() => openFolderFromDisk()}
                className="w-full p-3 rounded-lg bg-[#121212] hover:bg-[#191919] border border-[#303030] hover:border-[#987654] flex items-center space-x-3 text-left transition-all active:scale-[0.99] group cursor-pointer"
              >
                <FolderInput className="w-4 h-4 text-[#987654] group-hover:text-[#B89774] transition-colors" />
                <div>
                  <div className="font-medium text-xs text-[#F5F4F1]">Open Local Folder...</div>
                  <div className="text-[11px] text-[#9C9C9C]">Load a local project directory into the editor</div>
                </div>
              </button>

              <button
                onClick={() => exportProjectZip()}
                className="w-full p-3 rounded-lg bg-[#121212] hover:bg-[#191919] border border-[#303030] hover:border-[#987654] flex items-center space-x-3 text-left transition-all active:scale-[0.99] group cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-[#987654] group-hover:text-[#B89774] transition-colors" />
                <div>
                  <div className="font-medium text-xs text-[#F5F4F1]">Export as ZIP</div>
                  <div className="text-[11px] text-[#9C9C9C]">Package all workspace files into a .zip archive</div>
                </div>
              </button>
            </div>
          </div>

          {/* Quick shortcuts & Features */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#9C9C9C] mb-3">
              Keyboard Shortcuts
            </h2>
            <div className="bg-[#121212] rounded-lg p-3.5 text-xs space-y-2.5 border border-[#303030]">
              <div className="flex items-center justify-between">
                <span className="text-[#9C9C9C]">Show All Commands</span>
                <kbd className="bg-[#080808] border border-[#303030] px-2 py-0.5 rounded text-[11px] font-mono text-[#D5D2CC]">
                  Ctrl+Shift+P
                </kbd>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#9C9C9C]">Quick Open File</span>
                <kbd className="bg-[#080808] border border-[#303030] px-2 py-0.5 rounded text-[11px] font-mono text-[#D5D2CC]">
                  Ctrl+P
                </kbd>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#9C9C9C]">Toggle Integrated Terminal</span>
                <kbd className="bg-[#080808] border border-[#303030] px-2 py-0.5 rounded text-[11px] font-mono text-[#D5D2CC]">
                  Ctrl+`
                </kbd>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#9C9C9C]">Toggle Primary Side Bar</span>
                <kbd className="bg-[#080808] border border-[#303030] px-2 py-0.5 rounded text-[11px] font-mono text-[#D5D2CC]">
                  Ctrl+B
                </kbd>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#9C9C9C]">Save File</span>
                <kbd className="bg-[#080808] border border-[#303030] px-2 py-0.5 rounded text-[11px] font-mono text-[#D5D2CC]">
                  Ctrl+S
                </kbd>
              </div>
            </div>

            {/* Quick Demo links */}
            <div className="mt-4 pt-3 border-t border-[#303030] flex items-center justify-between text-xs text-[#9C9C9C]">
              <span>Quick Start Files:</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => openFile('/src/App.tsx')}
                  className="text-[#987654] hover:text-[#B89774] hover:underline font-mono"
                >
                  App.tsx
                </button>
                <span>•</span>
                <button
                  onClick={() => openFile('/README.md')}
                  className="text-[#987654] hover:text-[#B89774] hover:underline font-mono"
                >
                  README.md
                </button>
                <span>•</span>
                <button
                  onClick={() => openFile('/demo.py')}
                  className="text-[#987654] hover:text-[#B89774] hover:underline font-mono"
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
