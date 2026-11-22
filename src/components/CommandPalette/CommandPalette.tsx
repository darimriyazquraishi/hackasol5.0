import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { flattenFiles } from '../../services/fileSystem';
import { getFileIcon } from '../../services/fileIcons';
import { EditorTheme } from '../../types';

interface CommandItem {
  id: string;
  title: string;
  category?: string;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    commandPaletteMode,
    files,
    openFile,
    saveCurrentFile,
    closeTab,
    activeTabId,
    closeAllTabs,
    createFile,
    createFolder,
    openFolderFromDisk,
    exportProjectZip,
    toggleSidebar,
    togglePanel,
    setPanelTab,
    setActiveBarTab,
    setTheme
  } = useWorkspace();

  const [inputVal, setInputVal] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCommandMode = commandPaletteMode === 'command' || inputVal.startsWith('>');

  useEffect(() => {
    if (commandPaletteOpen) {
      if (commandPaletteMode === 'command') {
        setInputVal('> ');
      } else {
        setInputVal('');
      }
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen, commandPaletteMode]);

  const allFiles = useMemo(() => flattenFiles(files), [files]);

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: 'view.terminal',
        category: 'View',
        title: 'Toggle Integrated Terminal',
        shortcut: 'Ctrl+`',
        action: () => togglePanel()
      },
      {
        id: 'view.sidebar',
        category: 'View',
        title: 'Toggle Primary Side Bar',
        shortcut: 'Ctrl+B',
        action: () => toggleSidebar()
      },
      {
        id: 'file.save',
        category: 'File',
        title: 'Save File',
        shortcut: 'Ctrl+S',
        action: () => saveCurrentFile()
      },
      {
        id: 'file.new',
        category: 'File',
        title: 'New File...',
        action: () => {
          const name = prompt('File name:');
          if (name) createFile(null, name);
        }
      },
      {
        id: 'folder.new',
        category: 'File',
        title: 'New Folder...',
        action: () => {
          const name = prompt('Folder name:');
          if (name) createFolder(null, name);
        }
      },
      {
        id: 'folder.open',
        category: 'File',
        title: 'Open Local Folder from Disk...',
        action: () => openFolderFromDisk()
      },
      {
        id: 'file.export',
        category: 'File',
        title: 'Export Workspace as ZIP',
        action: () => exportProjectZip()
      },
      {
        id: 'view.explorer',
        category: 'View',
        title: 'Show Explorer',
        shortcut: 'Ctrl+Shift+E',
        action: () => {
          setActiveBarTab('explorer');
        }
      },
      {
        id: 'view.search',
        category: 'View',
        title: 'Show Search',
        shortcut: 'Ctrl+Shift+F',
        action: () => {
          setActiveBarTab('search');
        }
      },
      {
        id: 'view.git',
        category: 'View',
        title: 'Show Source Control',
        shortcut: 'Ctrl+Shift+G',
        action: () => {
          setActiveBarTab('git');
        }
      },
      {
        id: 'view.extensions',
        category: 'View',
        title: 'Show Extensions',
        shortcut: 'Ctrl+Shift+X',
        action: () => {
          setActiveBarTab('extensions');
        }
      },
      {
        id: 'tabs.close',
        category: 'View',
        title: 'Close Active Tab',
        shortcut: 'Ctrl+W',
        action: () => {
          if (activeTabId) closeTab(activeTabId);
        }
      },
      {
        id: 'tabs.closeAll',
        category: 'View',
        title: 'Close All Tabs',
        action: () => closeAllTabs()
      },
      {
        id: 'theme.darkModern',
        category: 'Preferences',
        title: 'Color Theme: Dark Modern',
        action: () => setTheme('dark-modern')
      },
      {
        id: 'theme.vscodeDark',
        category: 'Preferences',
        title: 'Color Theme: Dark+ (default dark)',
        action: () => setTheme('vscode-dark')
      },
      {
        id: 'theme.monokai',
        category: 'Preferences',
        title: 'Color Theme: Monokai',
        action: () => setTheme('monokai')
      },
      {
        id: 'theme.light',
        category: 'Preferences',
        title: 'Color Theme: Light+ (default light)',
        action: () => setTheme('light-plus')
      },
      {
        id: 'theme.contrast',
        category: 'Preferences',
        title: 'Color Theme: Dark High Contrast',
        action: () => setTheme('high-contrast')
      }
    ],
    [
      togglePanel,
      toggleSidebar,
      saveCurrentFile,
      createFile,
      createFolder,
      openFolderFromDisk,
      exportProjectZip,
      setActiveBarTab,
      activeTabId,
      closeTab,
      closeAllTabs,
      setTheme
    ]
  );

  const cleanQuery = inputVal.startsWith('>') ? inputVal.slice(1).trim() : inputVal.trim();

  // Filtered results
  const filteredCommands = useMemo(() => {
    if (!cleanQuery) return commands;
    return commands.filter(c =>
      `${c.category || ''} ${c.title}`.toLowerCase().includes(cleanQuery.toLowerCase())
    );
  }, [commands, cleanQuery]);

  const filteredFiles = useMemo(() => {
    if (!cleanQuery) return allFiles;
    return allFiles.filter(
      f =>
        f.name.toLowerCase().includes(cleanQuery.toLowerCase()) ||
        f.path.toLowerCase().includes(cleanQuery.toLowerCase())
    );
  }, [allFiles, cleanQuery]);

  if (!commandPaletteOpen) return null;

  const currentListLength = isCommandMode ? filteredCommands.length : filteredFiles.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, currentListLength));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + currentListLength) % Math.max(1, currentListLength));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isCommandMode) {
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          cmd.action();
          setCommandPaletteOpen(false);
        }
      } else {
        const file = filteredFiles[selectedIndex];
        if (file) {
          openFile(file.path);
          setCommandPaletteOpen(false);
        }
      }
    } else if (e.key === 'Escape') {
      setCommandPaletteOpen(false);
    }
  };

  return (
    <div
      onClick={() => setCommandPaletteOpen(false)}
      className="fixed inset-0 bg-black/50 z-50 flex justify-center pt-8 select-none"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-[600px] max-h-[460px] bg-[#252526] border border-[#454545] rounded-md shadow-2xl flex flex-col overflow-hidden text-xs text-[#cccccc]"
      >
        {/* Input bar */}
        <div className="p-2 border-b border-[#3c3c3c]">
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={e => {
              setInputVal(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isCommandMode
                ? 'Type a command or > for options'
                : 'Search files by name (type > for commands)'
            }
            className="w-full bg-[#3c3c3c] border border-[#007acc] text-white text-xs px-3 py-1.5 rounded-sm outline-none placeholder-[#858585]"
          />
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto py-1">
          {isCommandMode ? (
            filteredCommands.length === 0 ? (
              <div className="px-4 py-3 text-[#858585] text-center">No matching commands found.</div>
            ) : (
              filteredCommands.map((cmd, idx) => (
                <div
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    setCommandPaletteOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                    selectedIndex === idx
                      ? 'bg-[#04395e] text-white'
                      : 'hover:bg-[#2a2d2e] text-[#cccccc]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {cmd.category && (
                      <span className="text-[#858585] text-[11px] font-semibold">
                        {cmd.category}:
                      </span>
                    )}
                    <span>{cmd.title}</span>
                  </div>

                  {cmd.shortcut && (
                    <span className="text-[10px] text-[#858585] font-mono ml-4">
                      {cmd.shortcut}
                    </span>
                  )}
                </div>
              ))
            )
          ) : filteredFiles.length === 0 ? (
            <div className="px-4 py-3 text-[#858585] text-center">No matching files found.</div>
          ) : (
            filteredFiles.map((file, idx) => (
              <div
                key={file.id}
                onClick={() => {
                  openFile(file.path);
                  setCommandPaletteOpen(false);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`px-3 py-1.5 flex items-center justify-between cursor-pointer transition-colors ${
                  selectedIndex === idx
                    ? 'bg-[#04395e] text-white'
                    : 'hover:bg-[#2a2d2e] text-[#cccccc]'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="flex items-center justify-center">
                    {getFileIcon({ name: file.name, className: 'w-4 h-4' })}
                  </span>
                  <span className="font-medium">{file.name}</span>
                </div>
                <span className="text-[10px] text-[#858585] font-mono">{file.path}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
