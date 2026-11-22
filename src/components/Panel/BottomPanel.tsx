import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ChevronUp,
  Maximize2,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  Terminal as TerminalIcon
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { BottomPanelTab } from '../../types';
import { TerminalView } from './TerminalView';

export const BottomPanel: React.FC = () => {
  const {
    panelVisible,
    setPanelVisible,
    panelTab,
    setPanelTab,
    problems,
    openFile
  } = useWorkspace();

  const [height, setHeight] = useState(240);
  const [isMaximized, setIsMaximized] = useState(false);
  const isResizingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newHeight = Math.max(120, Math.min(window.innerHeight - e.clientY, window.innerHeight - 100));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!panelVisible) return null;

  const tabs: Array<{ id: BottomPanelTab; label: string; badge?: number }> = [
    { id: 'problems', label: 'PROBLEMS', badge: problems.length },
    { id: 'output', label: 'OUTPUT' },
    { id: 'terminal', label: 'TERMINAL' },
    { id: 'debug-console', label: 'DEBUG CONSOLE' }
  ];

  return (
    <div
      style={{ height: isMaximized ? '85%' : `${height}px` }}
      className="bg-[#181818] border-t border-[#2b2b2b] flex flex-col w-full relative shrink-0 select-none z-20"
    >
      {/* Top resize border */}
      {!isMaximized && (
        <div
          onMouseDown={e => {
            e.preventDefault();
            isResizingRef.current = true;
            document.body.style.cursor = 'row-resize';
          }}
          className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-[#007acc] transition-colors z-30"
        />
      )}

      {/* Panel Tab Header */}
      <div className="h-8 bg-[#181818] border-b border-[#2b2b2b] flex items-center justify-between px-3 text-xs select-none">
        {/* Tabs */}
        <div className="flex items-center space-x-4 h-full">
          {tabs.map(tab => {
            const isActive = panelTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setPanelTab(tab.id)}
                className={`h-full flex items-center space-x-1.5 border-b-2 text-[11px] font-semibold tracking-wider transition-colors uppercase ${
                  isActive
                    ? 'text-white border-[#0078d4]'
                    : 'text-[#858585] border-transparent hover:text-[#cccccc]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#3c3c3c] text-[#cccccc]">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center space-x-2 text-[#858585]">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore Panel Size' : 'Maximize Panel Size'}
            className="p-1 hover:text-white hover:bg-[#2b2b2b] rounded"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPanelVisible(false)}
            title="Close Panel (Ctrl+`)"
            className="p-1 hover:text-white hover:bg-[#2b2b2b] rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Panel Content Body */}
      <div className="flex-1 overflow-hidden relative">
        {panelTab === 'terminal' && <TerminalView />}

        {panelTab === 'problems' && (
          <div className="p-3 overflow-y-auto h-full text-xs space-y-1">
            {problems.length === 0 ? (
              <div className="text-[#858585]">No problems have been detected in the workspace.</div>
            ) : (
              problems.map(prob => (
                <div
                  key={prob.id}
                  onClick={() => openFile(prob.file)}
                  className="flex items-center space-x-2 py-1 px-2 rounded hover:bg-[#2a2d2e] cursor-pointer text-[#cccccc]"
                >
                  {prob.severity === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                  {prob.severity === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                  {prob.severity === 'info' && <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  <span className="truncate">{prob.message}</span>
                  <span className="text-[#858585] text-[11px] font-mono shrink-0">
                    [{prob.file} {prob.line}:{prob.col}]
                  </span>
                  <span className="text-[10px] text-[#555555] shrink-0 font-mono">
                    {prob.source}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {panelTab === 'output' && (
          <div className="p-3 font-mono text-xs text-[#858585] overflow-y-auto h-full space-y-1 select-text">
            <div>[Extensions] Extension Host initialized successfully.</div>
            <div>[Prettier] Loaded configuration from .prettierrc.</div>
            <div>[TypeScript] Language service initialized (TypeScript v5.7.3).</div>
            <div>[Git] Found 1 working repository.</div>
            <div className="text-green-400">[Ready] Workspace compiled and ready for development.</div>
          </div>
        )}

        {panelTab === 'debug-console' && (
          <div className="p-3 font-mono text-xs text-[#858585] overflow-y-auto h-full select-text">
            <div>Debug Console is ready. Start debugging session with F5.</div>
          </div>
        )}
      </div>
    </div>
  );
};
