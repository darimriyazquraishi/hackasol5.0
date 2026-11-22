import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FilePlus,
  FolderPlus,
  RefreshCw,
  FolderInput,
  FolderArchive,
  Download,
  Trash2,
  Edit2,
  Copy,
  MoreVertical
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { FileNode } from '../../types';
import { getFileIcon } from '../../services/fileIcons';

interface ContextMenuState {
  x: number;
  y: number;
  node: FileNode;
}

export const Explorer: React.FC = () => {
  const {
    files,
    workspaceName,
    activeTabId,
    openFile,
    createFile,
    createFolder,
    renameItem,
    deleteItem,
    toggleFolder,
    openFolderFromDisk,
    exportProjectZip,
    downloadFileItem
  } = useWorkspace();

  // Selected item path
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Creating new item inline state
  const [isCreating, setIsCreating] = useState<{
    type: 'file' | 'folder';
    parentPath: string | null;
  } | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // Renaming inline state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // Focus inputs
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPath]);

  // Close context menu on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, []);

  // Handle submit new item
  const handleSubmitNewItem = () => {
    if (!isCreating || !newItemName.trim()) {
      setIsCreating(null);
      setNewItemName('');
      return;
    }
    if (isCreating.type === 'file') {
      createFile(isCreating.parentPath, newItemName.trim());
    } else {
      createFolder(isCreating.parentPath, newItemName.trim());
    }
    setIsCreating(null);
    setNewItemName('');
  };

  // Handle submit rename
  const handleSubmitRename = () => {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    renameItem(renamingPath, renameValue.trim());
    setRenamingPath(null);
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPath(node.path);
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 180),
      y: Math.min(e.clientY, window.innerHeight - 220),
      node
    });
  };

  // Render tree node recursively
  const renderTree = (nodes: FileNode[], depth: number = 0) => {
    return nodes.map(node => {
      const isFolder = node.type === 'folder';
      const isSelected = selectedPath === node.path;
      const isActiveFile = activeTabId === node.id;
      const isRenaming = renamingPath === node.path;

      return (
        <div key={node.id} className="w-full">
          {/* Node item row */}
          <div
            onClick={e => {
              e.stopPropagation();
              setSelectedPath(node.path);
              if (isFolder) {
                toggleFolder(node.path);
              } else {
                openFile(node.path);
              }
            }}
            onContextMenu={e => handleContextMenu(e, node)}
            className={`flex items-center h-6 px-1 cursor-pointer transition-colors text-[13px] relative group ${
              isActiveFile
                ? 'bg-[#37373d] text-white font-medium'
                : isSelected
                ? 'bg-[#04395e]/60 text-white'
                : 'hover:bg-[#2a2d2e] text-[#cccccc]'
            }`}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
          >
            {/* Arrow chevron for folders */}
            {isFolder ? (
              <span className="w-4 h-4 flex items-center justify-center mr-1 text-[#c5c5c5]">
                {node.isOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
            ) : (
              <span className="w-4 h-4 mr-1" />
            )}

            {/* Icon */}
            <span className="mr-1.5 flex items-center justify-center">
              {getFileIcon({
                name: node.name,
                isFolder,
                isOpen: node.isOpen,
                className: 'w-4 h-4'
              })}
            </span>

            {/* Renaming inline or regular text */}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleSubmitRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSubmitRename();
                  if (e.key === 'Escape') setRenamingPath(null);
                }}
                className="bg-[#3c3c3c] border border-[#007acc] text-white px-1 py-0 h-5 text-xs outline-none rounded-none w-44"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="truncate flex-1 select-none">{node.name}</span>
            )}

            {/* Quick action buttons on hover */}
            <div className="hidden group-hover:flex items-center space-x-1 pr-1 text-[#858585]">
              {isFolder && (
                <>
                  <button
                    title="New File Inside"
                    onClick={e => {
                      e.stopPropagation();
                      setIsCreating({ type: 'file', parentPath: node.path });
                      if (!node.isOpen) toggleFolder(node.path);
                    }}
                    className="p-0.5 hover:text-white hover:bg-[#3c3c3c] rounded"
                  >
                    <FilePlus className="w-3 h-3" />
                  </button>
                  <button
                    title="New Folder Inside"
                    onClick={e => {
                      e.stopPropagation();
                      setIsCreating({ type: 'folder', parentPath: node.path });
                      if (!node.isOpen) toggleFolder(node.path);
                    }}
                    className="p-0.5 hover:text-white hover:bg-[#3c3c3c] rounded"
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Inline creation input inside this folder */}
          {isFolder && node.isOpen && isCreating && isCreating.parentPath === node.path && (
            <div
              className="flex items-center h-6 px-1 bg-[#37373d]"
              style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
            >
              <span className="w-4 h-4 mr-1" />
              <span className="mr-1.5 flex items-center justify-center">
                {getFileIcon({
                  name: newItemName || (isCreating.type === 'folder' ? 'folder' : 'file.ts'),
                  isFolder: isCreating.type === 'folder',
                  isOpen: true,
                  className: 'w-4 h-4'
                })}
              </span>
              <input
                ref={inputRef}
                type="text"
                placeholder={isCreating.type === 'file' ? 'filename.ext' : 'folder name'}
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onBlur={handleSubmitNewItem}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSubmitNewItem();
                  if (e.key === 'Escape') setIsCreating(null);
                }}
                className="bg-[#3c3c3c] border border-[#007acc] text-white px-1 py-0 h-5 text-xs outline-none rounded-none w-44"
              />
            </div>
          )}

          {/* Children */}
          {isFolder && node.isOpen && node.children && (
            <div>{renderTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden select-none"
      onClick={() => {
        setSelectedPath(null);
        setContextMenu(null);
      }}
    >
      {/* Explorer Workspace Header Bar */}
      <div className="h-7 px-3 flex items-center justify-between text-[11px] font-bold text-[#bbbbbb] tracking-wider uppercase border-b border-[#2b2b2b] bg-[#1f1f1f]">
        <span className="truncate">{workspaceName}</span>
        <div className="flex items-center space-x-1 text-[#858585]">
          <button
            onClick={e => {
              e.stopPropagation();
              const parent = selectedPath && files.find(f => f.path === selectedPath)?.type === 'folder'
                ? selectedPath
                : null;
              setIsCreating({ type: 'file', parentPath: parent });
            }}
            title="New File..."
            className="p-1 hover:text-white hover:bg-[#333333] rounded"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              const parent = selectedPath && files.find(f => f.path === selectedPath)?.type === 'folder'
                ? selectedPath
                : null;
              setIsCreating({ type: 'folder', parentPath: parent });
            }}
            title="New Folder..."
            className="p-1 hover:text-white hover:bg-[#333333] rounded"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              openFolderFromDisk();
            }}
            title="Open Local Folder From Disk..."
            className="p-1 hover:text-white hover:bg-[#333333] rounded"
          >
            <FolderInput className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => {
              e.stopPropagation();
              exportProjectZip();
            }}
            title="Export Project as ZIP"
            className="p-1 hover:text-white hover:bg-[#333333] rounded"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* File Tree Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {/* Inline input for root creation */}
        {isCreating && isCreating.parentPath === null && (
          <div className="flex items-center h-6 px-3 bg-[#37373d]">
            <span className="w-4 h-4 mr-1" />
            <span className="mr-1.5 flex items-center justify-center">
              {getFileIcon({
                name: newItemName || (isCreating.type === 'folder' ? 'folder' : 'file.ts'),
                isFolder: isCreating.type === 'folder',
                isOpen: true,
                className: 'w-4 h-4'
              })}
            </span>
            <input
              ref={inputRef}
              type="text"
              placeholder={isCreating.type === 'file' ? 'filename.ext' : 'folder name'}
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onBlur={handleSubmitNewItem}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSubmitNewItem();
                if (e.key === 'Escape') setIsCreating(null);
              }}
              className="bg-[#3c3c3c] border border-[#007acc] text-white px-1 py-0 h-5 text-xs outline-none rounded-none w-48"
            />
          </div>
        )}

        {renderTree(files)}
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed bg-[#252526] border border-[#454545] rounded shadow-2xl py-1 text-xs text-[#cccccc] z-50 min-w-[180px]"
        >
          {contextMenu.node.type === 'folder' && (
            <>
              <button
                onClick={() => {
                  setIsCreating({ type: 'file', parentPath: contextMenu.node.path });
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-[#094771] hover:text-white flex items-center space-x-2"
              >
                <FilePlus className="w-3.5 h-3.5" />
                <span>New File</span>
              </button>
              <button
                onClick={() => {
                  setIsCreating({ type: 'folder', parentPath: contextMenu.node.path });
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-[#094771] hover:text-white flex items-center space-x-2"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Folder</span>
              </button>
              <div className="my-1 border-t border-[#3c3c3c]" />
            </>
          )}

          <button
            onClick={() => {
              setRenamingPath(contextMenu.node.path);
              setRenameValue(contextMenu.node.name);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#094771] hover:text-white flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <Edit2 className="w-3.5 h-3.5" />
              <span>Rename</span>
            </div>
            <span className="text-[10px] text-[#858585]">F2</span>
          </button>

          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete '${contextMenu.node.name}'?`)) {
                deleteItem(contextMenu.node.path);
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#e81123] hover:text-white flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </div>
            <span className="text-[10px] text-[#858585]">Del</span>
          </button>

          <div className="my-1 border-t border-[#3c3c3c]" />

          <button
            onClick={() => {
              navigator.clipboard?.writeText(contextMenu.node.path);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#094771] hover:text-white flex items-center space-x-2"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Path</span>
          </button>

          {contextMenu.node.type === 'file' && (
            <button
              onClick={() => {
                downloadFileItem(contextMenu.node.path);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-[#094771] hover:text-white flex items-center space-x-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
