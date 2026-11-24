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
    <div className="w-12 bg-[#080808] border-r border-[#303030] flex flex-col justify-between items-center py-2 select-none z-30 shrink-0">
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
                isActive ? 'text-[#F5F4F1]' : 'text-[#9C9C9C] hover:text-[#F5F4F1]'
              }`}
            >
              {/* Active left border indicator */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#987654]" />
              )}
              {item.icon}

              {/* Badge */}
              {item.badge !== undefined && (
                <span className="absolute bottom-1 right-2 min-w-4 h-4 px-1 rounded-full bg-[#987654] text-[10px] font-bold text-[#F5F4F1] flex items-center justify-center">
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
            assistantVisible ? 'text-[#F5F4F1]' : 'text-[#9C9C9C] hover:text-[#F5F4F1]'
          }`}
        >
          {assistantVisible && (
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#987654]" />
          )}
          <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
              fill={assistantVisible ? "#987654" : "currentColor"}
            />
          </svg>
        </button>

        <button
          title="Accounts"
          className="w-full h-11 flex items-center justify-center text-[#9C9C9C] hover:text-[#F5F4F1] transition-colors"
        >
          <User className="w-5 h-5" />
        </button>

        <button
          onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
          title="Manage"
          className={`w-full h-11 flex items-center justify-center transition-colors ${
            settingsMenuOpen ? 'text-[#F5F4F1] bg-[#191919]' : 'text-[#9C9C9C] hover:text-[#F5F4F1]'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
        </button>

        {/* Settings Popup Menu */}
        {settingsMenuOpen && (
          <div className="absolute bottom-12 left-12 w-64 bg-[#121212] border border-[#303030] rounded-lg shadow-2xl py-1.5 text-xs text-[#D5D2CC] z-50">
            <div className="px-3 py-1 font-semibold text-[10px] text-[#9C9C9C] uppercase tracking-wider">
              Color Themes
            </div>
            {themes.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  setSettingsMenuOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-[#191919] hover:text-[#F5F4F1] ${
                  theme === t.id ? 'text-[#987654] font-medium' : ''
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Palette className="w-3.5 h-3.5" />
                  <span>{t.name}</span>
                </div>
                {theme === t.id && <span>✓</span>}
              </button>
            ))}

            <div className="my-1 border-t border-[#303030]" />

            <button
              onClick={() => {
                setCommandPaletteMode('command');
                setCommandPaletteOpen(true);
                setSettingsMenuOpen(false);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-[#191919] hover:text-[#F5F4F1] flex items-center justify-between"
            >
              <span>Command Palette...</span>
              <span className="text-[10px] text-[#9C9C9C] font-mono">Ctrl+Shift+P</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
