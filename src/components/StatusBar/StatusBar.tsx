import React, { useState } from 'react';
import {
  GitBranch,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  Radio
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const StatusBar: React.FC = () => {
  const {
    gitState,
    cursorPos,
    activeFile,
    problems,
    isBackendOnline,
    setPanelVisible,
    setPanelTab,
    setCommandPaletteMode,
    setCommandPaletteOpen
  } = useWorkspace();

  const [isSyncing, setIsSyncing] = useState(false);

  const errorCount = problems.filter(p => p.severity === 'error').length;
  const warningCount = problems.filter(p => p.severity === 'warning').length;

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1200);
  };

  // Human friendly language mode string
  const getLanguageLabel = (): string => {
    if (!activeFile) return 'Plain Text';
    const ext = activeFile.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx':
        return 'TypeScript React';
      case 'jsx':
        return 'JavaScript React';
      case 'ts':
        return 'TypeScript';
      case 'js':
        return 'JavaScript';
      case 'json':
        return 'JSON';
      case 'html':
        return 'HTML';
      case 'css':
        return 'CSS';
      case 'md':
        return 'Markdown';
      case 'py':
        return 'Python';
      default:
        return activeFile.language || 'Plain Text';
    }
  };

  return (
    <div className="h-[22px] bg-[#191919] border-t border-[#303030] text-[#D5D2CC] flex items-center justify-between px-2 text-[11px] select-none shrink-0 z-30 font-mono">
      {/* Left items */}
      <div className="flex items-center space-x-1 h-full">
        {/* Remote / Git branch */}
        <button
          onClick={handleSync}
          title="Git Branch (Click to synchronize)"
          className="flex items-center space-x-1 px-1.5 h-full hover:bg-[#202020] hover:text-[#F5F4F1] transition-colors"
        >
          <GitBranch className="w-3 h-3 text-[#987654]" />
          <span className="text-[#F5F4F1] font-medium">{gitState.branch}</span>
          <RefreshCw className={`w-2.5 h-2.5 ml-0.5 text-[#9C9C9C] ${isSyncing ? 'animate-spin' : ''}`} />
        </button>

        {/* Backend Heartbeat */}
        <div
          title={isBackendOnline ? 'LUMI Core Online' : 'Reconnecting to LUMI Core...'}
          className="flex items-center space-x-1.5 px-2 h-full cursor-default"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isBackendOnline ? 'bg-[#987654]' : 'bg-amber-400 animate-ping'}`} />
          <span className="text-[10px] text-[#9C9C9C]">
            {isBackendOnline ? 'LUMI Online' : 'Reconnecting...'}
          </span>
        </div>

        {/* Problems counter */}
        <button
          onClick={() => {
            setPanelVisible(true);
            setPanelTab('problems');
          }}
          title="Errors and Warnings"
          className="flex items-center space-x-1 px-1.5 h-full hover:bg-[#202020] hover:text-[#F5F4F1] transition-colors"
        >
          <AlertCircle className="w-3 h-3 text-red-400" />
          <span>{errorCount}</span>
          <AlertTriangle className="w-3 h-3 ml-1 text-amber-400" />
          <span>{warningCount}</span>
        </button>
      </div>

      {/* Right items */}
      <div className="flex items-center space-x-1 h-full">
        {/* Cursor Position */}
        <button className="px-1.5 h-full hover:bg-[#202020] hover:text-[#F5F4F1] transition-colors">
          Ln {cursorPos.line}, Col {cursorPos.col}
        </button>

        {/* Indentation */}
        <button className="px-1.5 h-full hover:bg-[#202020] hover:text-[#F5F4F1] transition-colors">
          Spaces: 2
        </button>

        {/* Encoding */}
        <button className="px-1.5 h-full hover:bg-[#202020] hover:text-[#F5F4F1] transition-colors">
          UTF-8
        </button>

        {/* Line sequence */}
        <button className="px-1.5 h-full hover:bg-[#202020] hover:text-[#F5F4F1] transition-colors">
          CRLF
        </button>

        {/* Language mode */}
        <button
          onClick={() => {
            setCommandPaletteMode('command');
            setCommandPaletteOpen(true);
          }}
          title="Select Language Mode"
          className="px-1.5 h-full hover:bg-[#202020] hover:text-[#F5F4F1] transition-colors font-medium text-[#987654]"
        >
          {getLanguageLabel()}
        </button>

        {/* Prettier */}
        <button title="Prettier is active" className="px-1.5 h-full hover:bg-[#202020] hover:text-[#F5F4F1] transition-colors flex items-center space-x-0.5">
          <Check className="w-3 h-3 text-[#987654]" />
          <span>Prettier</span>
        </button>

        {/* Notifications */}
        <button title="Notifications" className="px-1.5 h-full hover:bg-[#202020] hover:text-[#F5F4F1] transition-colors">
          <Bell className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
