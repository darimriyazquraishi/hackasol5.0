import React, { useState, useRef, useEffect } from 'react';
import {
  Files,
  Search,
  GitBranch,
  PlayCircle,
  LayoutGrid,
  User,
  Settings as SettingsIcon,
  Palette
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ActivityBarTab, EditorTheme } from '../../types';

export const ActivityBar: React.FC = () => {
  const {
    activeBarTab,
    setActiveBarTab,
    sidebarVisible,
    setSidebarVisible,
    assistantVisible,
    toggleAssistant,
    gitState,
    theme,
    setTheme,
    setCommandPaletteOpen,
    setCommandPaletteMode
  } = useWorkspace();

  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleTabClick = (tab: ActivityBarTab) => {
    if (activeBarTab === tab) {
      setSidebarVisible(!sidebarVisible);
    } else {
      setActiveBarTab(tab);
      setSidebarVisible(true);
    }
  };

  const changesCount = gitState.modifiedFiles.length + gitState.stagedFiles.length;

  const topItems: Array<{ id: ActivityBarTab; icon: React.ReactNode; label: string; badge?: number }> = [
    {
      id: 'explorer',
      icon: <Files className="w-5 h-5" />,
      label: 'Explorer (Ctrl+Shift+E)'
    },
    {
      id: 'search',
      icon: <Search className="w-5 h-5" />,
      label: 'Search (Ctrl+Shift+F)'
    },
    {
      id: 'git',
      icon: <GitBranch className="w-5 h-5" />,
      label: 'Source Control (Ctrl+Shift+G)',
      badge: changesCount > 0 ? changesCount : undefined
    },
    {
      id: 'debug',
      icon: <PlayCircle className="w-5 h-5" />,
      label: 'Run and Debug (Ctrl+Shift+D)'
    },
    {
      id: 'extensions',
      icon: <LayoutGrid className="w-5 h-5" />,
      label: 'Extensions (Ctrl+Shift+X)'
    }
  ];

  const themes: Array<{ id: EditorTheme; name: string }> = [
    { id: 'dark-modern', name: 'Dark Modern (Default)' },
    { id: 'vscode-dark', name: 'Dark+ (Classic)' },
    { id: 'monokai', name: 'Monokai' },
    { id: 'light-plus', name: 'Light+ (Visual Studio)' },
    { id: 'high-contrast', name: 'Dark High Contrast' }
  ];

  return (
    <div className="w-12 bg-[#181818] border-r border-[#2b2b2b] flex flex-col justify-between items-center py-2 select-none z-30 shrink-0">
      {/* Top Activity Icons */}
      <div className="flex flex-col space-y-1 w-full">
        {topItems.map(item => {
          const isActive = sidebarVisible && activeBarTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              title={item.label}
              className={`relative w-full h-11 flex items-center justify-center transition-colors group ${
                isActive ? 'text-white' : 'text-[#858585] hover:text-[#cccccc]'
              }`}
            >
              {/* Active left border indicator */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0078d4]" />
              )}
              {item.icon}

              {/* Badge */}
              {item.badge !== undefined && (
                <span className="absolute bottom-1 right-2 min-w-4 h-4 px-1 rounded-full bg-[#0078d4] text-[10px] font-bold text-white flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Icons: Antigravity AI, Accounts & Settings */}
      <div className="flex flex-col space-y-1 w-full relative" ref={settingsRef}>
        {/* Antigravity AI Assistant Toggle */}
        <button
          onClick={toggleAssistant}
          title="Antigravity AI Assistant (Ctrl+L)"
          className={`relative w-full h-11 flex items-center justify-center transition-colors group ${
            assistantVisible ? 'text-white' : 'text-[#858585] hover:text-[#cccccc]'
          }`}
        >
          {assistantVisible && (
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-[#4285F4] to-[#9B51E0]" />
          )}
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
              fill={assistantVisible ? "url(#antigravityGrad)" : "currentColor"}
            />
          </svg>
        </button>

        <button
          title="Accounts"
          className="w-full h-11 flex items-center justify-center text-[#858585] hover:text-[#cccccc] transition-colors"
        >
          <User className="w-5 h-5" />
        </button>

        <button
          onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
          title="Manage"
          className={`w-full h-11 flex items-center justify-center transition-colors ${
            settingsMenuOpen ? 'text-white bg-[#2d2d2d]' : 'text-[#858585] hover:text-[#cccccc]'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
        </button>

        {/* Settings Popup Menu */}
        {settingsMenuOpen && (
          <div className="absolute bottom-12 left-12 w-64 bg-[#252526] border border-[#454545] rounded-md shadow-2xl py-1 text-xs text-[#cccccc] z-50">
            <div className="px-3 py-1 font-semibold text-[11px] text-[#858585] uppercase tracking-wider">
              Color Themes
            </div>
            {themes.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  setSettingsMenuOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-[#094771] hover:text-white ${
                  theme === t.id ? 'text-[#0078d4] font-medium' : ''
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Palette className="w-3.5 h-3.5" />
                  <span>{t.name}</span>
                </div>
                {theme === t.id && <span>✓</span>}
              </button>
            ))}

            <div className="my-1 border-t border-[#3c3c3c]" />

            <button
              onClick={() => {
                setCommandPaletteMode('command');
                setCommandPaletteOpen(true);
                setSettingsMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-[#094771] hover:text-white flex items-center justify-between"
            >
              <span>Command Palette...</span>
              <span className="text-[10px] text-[#858585]">Ctrl+Shift+P</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
