import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  PanelLeft,
  PanelBottom,
  PanelRight,
  Sparkles,
  Minus,
  Square,
  X,
  Code2,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Save,
  Download,
  Terminal as TerminalIcon,
  HelpCircle,
  Settings
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const TitleBar: React.FC = () => {
  const {
    workspaceName,
    activeFile,
    toggleSidebar,
    togglePanel,
    toggleAssistant,
    assistantVisible,
    setCommandPaletteOpen,
    setCommandPaletteMode,
    createFile,
    createFolder,
    saveCurrentFile,
    openFolderFromDisk,
    exportProjectZip,
    closeAllTabs,
    setPanelTab,
    setPanelVisible,
    setTheme
  } = useWorkspace();

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menus: Record<string, Array<{ label: string; shortcut?: string; action: () => void; divider?: boolean }>> = {
    File: [
      {
        label: 'New Text File',
        shortcut: 'Ctrl+N',
        action: () => {
          const name = prompt('Enter new file name:');
          if (name) createFile(null, name);
        }
      },
      {
        label: 'New Folder',
        action: () => {
          const name = prompt('Enter new folder name:');
          if (name) createFolder(null, name);
        }
      },
      {
        label: 'Open Folder from Local Disk...',
        shortcut: 'Ctrl+O',
        action: () => openFolderFromDisk(),
        divider: true
      },
      {
        label: 'Save',
        shortcut: 'Ctrl+S',
        action: () => saveCurrentFile()
      },
      {
        label: 'Export Workspace as ZIP',
        action: () => exportProjectZip(),
        divider: true
      },
      {
        label: 'Close All Tabs',
        action: () => closeAllTabs()
      }
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
      { label: 'Redo', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo'), divider: true },
      { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
      { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
      { label: 'Paste', shortcut: 'Ctrl+V', action: () => {} }
    ],
    Selection: [
      { label: 'Select All', shortcut: 'Ctrl+A', action: () => document.execCommand('selectAll') },
      { label: 'Expand Selection', shortcut: 'Shift+Alt+Right', action: () => {} },
      { label: 'Shrink Selection', shortcut: 'Shift+Alt+Left', action: () => {} }
    ],
    View: [
      {
        label: 'Command Palette...',
        shortcut: 'Ctrl+Shift+P',
        action: () => {
          setCommandPaletteMode('command');
          setCommandPaletteOpen(true);
        }
      },
      {
        label: 'Toggle Primary Side Bar',
        shortcut: 'Ctrl+B',
        action: () => toggleSidebar()
      },
      {
        label: 'Toggle Terminal Panel',
        shortcut: 'Ctrl+`',
        action: () => togglePanel()
      },
      {
        label: 'Toggle Antigravity Assistant',
        shortcut: 'Ctrl+L',
        action: () => toggleAssistant()
      }
    ],
    Go: [
      {
        label: 'Go to File...',
        shortcut: 'Ctrl+P',
        action: () => {
          setCommandPaletteMode('file');
          setCommandPaletteOpen(true);
        }
      }
    ],
    Run: [
      {
        label: 'Start Debugging',
        shortcut: 'F5',
        action: () => {
          setPanelVisible(true);
          setPanelTab('terminal');
        }
      },
      {
        label: 'Run Without Debugging',
        shortcut: 'Ctrl+F5',
        action: () => {
          setPanelVisible(true);
          setPanelTab('terminal');
        }
      }
    ],
    Terminal: [
      {
        label: 'New Terminal',
        shortcut: 'Ctrl+Shift+`',
        action: () => {
          setPanelVisible(true);
          setPanelTab('terminal');
        }
      }
    ],
    Help: [
      {
        label: 'Welcome / Getting Started',
        action: () => closeAllTabs()
      },
      {
        label: 'Documentation',
        action: () => window.open('https://code.visualstudio.com/docs', '_blank')
      },
      {
        label: 'Keyboard Shortcuts Reference',
        shortcut: 'Ctrl+K Ctrl+S',
        action: () => {
          setCommandPaletteMode('command');
          setCommandPaletteOpen(true);
        }
      },
      {
        label: 'About LUMI IDE',
        action: () => {
          alert('LUMI IDE Studio\nVersion: 2.5.0\nIntegrated Engineering & Development Workspace');
        }
      }
    ]
  };

  return (
    <div className="h-8 bg-[#080808] border-b border-[#303030] flex items-center justify-between px-2 text-xs select-none text-[#D5D2CC] relative z-40 font-mono">
      {/* Left: App Logo & Menus */}
      <div className="flex items-center space-x-1" ref={menuRef}>
        <div className="w-5 h-5 flex items-center justify-center mr-1 shrink-0">
          <img
            src="/lumi-logo.jpg"
            alt="LUMI"
            className="w-4 h-4 object-contain rounded-sm"
          />
        </div>

        {Object.keys(menus).map(menuName => (
          <div key={menuName} className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === menuName ? null : menuName)}
              onMouseEnter={() => {
                if (openMenu) setOpenMenu(menuName);
              }}
              className={`px-2 py-0.5 rounded text-[11px] hover:bg-[#191919] transition-colors ${
                openMenu === menuName ? 'bg-[#191919] text-[#F5F4F1]' : 'text-[#D5D2CC]'
              }`}
            >
              {menuName}
            </button>

            {openMenu === menuName && (
              <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-[#191919] border border-[#303030] rounded shadow-2xl py-1 text-xs text-[#D5D2CC] z-50">
                {menus[menuName].map((item, idx) => (
                  <React.Fragment key={idx}>
                    <button
                      onClick={() => {
                        item.action();
                        setOpenMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-[#765B43] hover:text-[#F5F4F1] flex items-center justify-between group"
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="text-[10px] text-[#9C9C9C] group-hover:text-[#F5F4F1] font-mono ml-4">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                    {item.divider && <div className="my-1 border-t border-[#303030]" />}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Center: Search / Command Palette Bar */}
      <button
        onClick={() => {
          setCommandPaletteMode('file');
          setCommandPaletteOpen(true);
        }}
        className="flex items-center justify-center space-x-2 bg-[#191919] hover:bg-[#202020] border border-[#303030] hover:border-[#987654] rounded px-4 py-0.5 text-xs text-[#9C9C9C] hover:text-[#F5F4F1] transition-colors max-w-sm w-full mx-4"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="truncate">
          {activeFile ? `${activeFile.name} — ${workspaceName}` : `${workspaceName}`}
        </span>
        <span className="text-[10px] bg-[#080808] border border-[#303030] rounded px-1.5 py-0 text-[#9C9C9C]">
          Ctrl+P
        </span>
      </button>

      {/* Right: Layout buttons & Window controls */}
      <div className="flex items-center space-x-1">
        <button
          onClick={toggleSidebar}
          title="Toggle Primary Side Bar (Ctrl+B)"
          className="p-1 hover:bg-[#191919] rounded text-[#9C9C9C] hover:text-[#F5F4F1] transition-colors"
        >
          <PanelLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={togglePanel}
          title="Toggle Panel (Ctrl+`)"
          className="p-1 hover:bg-[#191919] rounded text-[#9C9C9C] hover:text-[#F5F4F1] transition-colors"
        >
          <PanelBottom className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={toggleAssistant}
          title="Toggle Assistant (Ctrl+L)"
          className={`p-1 hover:bg-[#191919] rounded transition-colors ${
            assistantVisible ? 'text-[#987654] bg-[#191919]' : 'text-[#9C9C9C] hover:text-[#F5F4F1]'
          }`}
        >
          <PanelRight className="w-3.5 h-3.5" />
        </button>

        {/* Window controls */}
        <div className="flex items-center ml-2 border-l border-[#303030] pl-1">
          <button className="h-6 w-8 flex items-center justify-center hover:bg-[#191919] text-[#9C9C9C] hover:text-[#F5F4F1] transition-colors">
            <Minus className="w-3 h-3" />
          </button>
          <button className="h-6 w-8 flex items-center justify-center hover:bg-[#191919] text-[#9C9C9C] hover:text-[#F5F4F1] transition-colors">
            <Square className="w-2.5 h-2.5" />
          </button>
          <button className="h-6 w-8 flex items-center justify-center hover:bg-[#765B43] text-[#9C9C9C] hover:text-[#F5F4F1] transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
