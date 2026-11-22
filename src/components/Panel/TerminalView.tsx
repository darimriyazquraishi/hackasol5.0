import React, { useState, useRef, useEffect } from 'react';
import { TerminalEmulator, TerminalLine } from '../../services/terminal';
import { useWorkspace } from '../../context/WorkspaceContext';
import { flattenFiles } from '../../services/fileSystem';

export const TerminalView: React.FC = () => {
  const {
    files,
    createFile,
    createFolder,
    deleteItem,
    exportProjectZip
  } = useWorkspace();

  const [emulator] = useState(() => new TerminalEmulator());
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome-1',
      type: 'info',
      text: 'Visual Studio Code Integrated Terminal Shell [Version 1.95.0]'
    },
    {
      id: 'welcome-2',
      type: 'system',
      text: 'Type "help" to see all available commands (ls, cat, touch, mkdir, node, python, git, clear, etc.)\n'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  // Focus terminal input when clicking inside
  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const command = inputVal;
      setInputVal('');

      if (!command.trim()) return;

      // Add to local history
      setCommandHistory(prev => [...prev, command]);
      setHistoryIndex(-1);

      // Add user input line
      const userLine: TerminalLine = {
        id: Math.random().toString(),
        type: 'input',
        text: `${emulator.getPrompt()}${command}`
      };

      // Execute command
      const outputLines = emulator.execute(command, files, {
        onAddFile: (path, content) => {
          const parts = path.split('/').filter(Boolean);
          const name = parts.pop() || 'untitled.txt';
          const parent = parts.length > 0 ? `/${parts.join('/')}` : null;
          createFile(parent, name, content || '');
        },
        onAddFolder: (path) => {
          const parts = path.split('/').filter(Boolean);
          const name = parts.pop() || 'new-folder';
          const parent = parts.length > 0 ? `/${parts.join('/')}` : null;
          createFolder(parent, name);
        },
        onDelete: (path) => {
          deleteItem(path);
        },
        onClear: () => {
          setLines([]);
        },
        onExportZip: () => {
          exportProjectZip();
        }
      });

      if (command.trim().toLowerCase() !== 'clear' && command.trim().toLowerCase() !== 'cls') {
        setLines(prev => [...prev, userLine, ...outputLines]);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputVal(commandHistory[nextIndex] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (commandHistory.length === 0 || historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setInputVal('');
      } else {
        setHistoryIndex(nextIndex);
        setInputVal(commandHistory[nextIndex] || '');
      }
    } else if (e.key === 'Tab') {
      // Auto complete file / folder name
      e.preventDefault();
      const parts = inputVal.split(' ');
      const lastWord = parts[parts.length - 1];
      if (lastWord) {
        const all = flattenFiles(files);
        const match = all.find(f => f.name.toLowerCase().startsWith(lastWord.toLowerCase()));
        if (match) {
          parts[parts.length - 1] = match.name;
          setInputVal(parts.join(' '));
        }
      }
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className="flex-1 bg-[#181818] text-[#cccccc] font-mono text-[13px] p-3 overflow-y-auto cursor-text select-text h-full flex flex-col space-y-1"
    >
      {lines.map(line => {
        let textColor = 'text-[#cccccc]';
        if (line.type === 'input') textColor = 'text-[#ffffff] font-semibold';
        if (line.type === 'error') textColor = 'text-[#f48771]';
        if (line.type === 'info') textColor = 'text-[#75beff]';
        if (line.type === 'system') textColor = 'text-[#858585]';

        return (
          <div key={line.id} className={`whitespace-pre-wrap leading-relaxed ${textColor}`}>
            {line.text}
          </div>
        );
      })}

      {/* Input Prompt Row */}
      <div className="flex items-center space-x-1 pt-1">
        <span className="text-[#4ec9b0] font-semibold select-none">
          {emulator.getPrompt()}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="flex-1 bg-transparent border-none outline-none text-white font-mono text-[13px] p-0 m-0"
        />
      </div>

      <div ref={bottomRef} />
    </div>
  );
};
