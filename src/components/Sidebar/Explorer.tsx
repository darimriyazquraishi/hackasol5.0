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
  MoreVertical,
  Play,
  Plus,
  Folder,
  Layers
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
    activeTabId,
    openFile,
    createFile,
    createFolder,
    renameItem,
    deleteItem,
    toggleFolder,
    exportProjectZip,
    downloadFileItem,
    userProjects,
    activeProjectId,
    activeProject,
    selectUserProject,
    createUserProject,
    deleteUserProject,
    runActiveProject
  } = useWorkspace();

  // Selected item path
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTemplate, setNewProjectTemplate] = useState('python');
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

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
                className="bg-[#141414] border border-[#987654] text-[#F5F4F1] px-1 py-0 h-5 text-xs outline-none rounded w-44"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="truncate flex-1 select-none">{node.name}</span>
            )}

            {/* Quick action buttons on hover */}
            <div className="hidden group-hover:flex items-center space-x-1 pr-1 text-[#9C9C9C]">
              {isFolder && (
                <>
                  <button
                    title="New File Inside"
                    onClick={e => {
                      e.stopPropagation();
                      setIsCreating({ type: 'file', parentPath: node.path });
                      if (!node.isOpen) toggleFolder(node.path);
                    }}
                    className="p-0.5 hover:text-[#F5F4F1] hover:bg-[#191919] rounded transition-colors"
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
                    className="p-0.5 hover:text-[#F5F4F1] hover:bg-[#191919] rounded transition-colors"
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
                className="bg-[#141414] border border-[#987654] text-[#F5F4F1] px-1 py-0 h-5 text-xs outline-none rounded w-44"
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
      {/* Explorer Workspace Header Bar with User Project Management */}
      <div className="p-2 border-b border-[#2b2b2b] bg-[#1a1a1a] space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-[#bbbbbb] tracking-wider uppercase">
          <div className="flex items-center space-x-1.5 min-w-0">
            <Layers className="w-3.5 h-3.5 text-[#987654] shrink-0" />
            <span className="truncate text-white font-mono text-xs">
              {activeProject ? activeProject.name : 'User Projects'}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            {activeProject && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  runActiveProject();
                }}
                title="Run Project in Sandboxed Environment"
                className="px-2 py-0.5 rounded bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1] flex items-center space-x-1 text-[11px] font-medium transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Run</span>
              </button>
            )}

            <button
              onClick={e => {
                e.stopPropagation();
                setIsCreatingProject(v => !v);
              }}
              title="Create New User Project"
              className="p-1 rounded hover:bg-[#333333] text-[#bbbbbb] hover:text-white"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Project Selector Dropdown if multiple projects exist */}
        {userProjects.length > 0 && (
          <div className="flex items-center justify-between text-[11px] pt-1">
            <select
              value={activeProjectId || ''}
              onChange={e => selectUserProject(e.target.value)}
              className="w-full bg-[#121212] text-[#D5D2CC] border border-[#303030] rounded px-2 py-1 text-xs outline-none font-mono"
            >
              {userProjects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.language})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Inline New Project Form */}
        {isCreatingProject && (
          <div className="p-2 rounded bg-[#121212] border border-[#987654] space-y-2 text-xs">
            <div className="font-mono text-[10px] uppercase text-[#987654] font-semibold">New Project</div>
            <input
              type="text"
              placeholder="Project Name"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              className="w-full bg-[#1c1c1c] text-white px-2 py-1 rounded border border-[#303030] outline-none text-xs"
              autoFocus
            />
            <div className="flex items-center space-x-1">
              <select
                value={newProjectTemplate}
                onChange={e => setNewProjectTemplate(e.target.value)}
                className="bg-[#1c1c1c] text-white px-2 py-1 rounded border border-[#303030] text-[11px] flex-1 outline-none"
              >
                <option value="python">Python Project</option>
                <option value="node">Node.js Project</option>
                <option value="c">C / C++ Project</option>
                <option value="web">Web (HTML/CSS/JS)</option>
                <option value="empty">Empty Project</option>
              </select>
              <button
                onClick={() => {
                  if (newProjectName.trim()) {
                    createUserProject(newProjectName.trim(), newProjectTemplate);
                    setNewProjectName('');
                    setIsCreatingProject(false);
                  }
                }}
                className="px-2.5 py-1 rounded bg-[#987654] hover:bg-[#765B43] text-white font-mono text-xs font-semibold"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {/* File Actions toolbar when project is active */}
        {activeProject && (
          <div className="flex items-center justify-between pt-1 border-t border-[#262626] text-[#858585] text-xs">
            <span className="text-[10px] uppercase font-mono text-[#737373]">{files.length} Files</span>
            <div className="flex items-center space-x-1">
              <button
                onClick={e => {
                  e.stopPropagation();
                  const parent = selectedPath && files.find(f => f.path === selectedPath)?.type === 'folder'
                    ? selectedPath
                    : null;
                  setIsCreating({ type: 'file', parentPath: parent });
                }}
                title="New File"
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
                title="New Folder"
                className="p-1 hover:text-white hover:bg-[#333333] rounded"
              >
                <FolderPlus className="w-3.5 h-3.5" />
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
        )}
      </div>

      {/* File Tree or Empty Project State */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {!activeProject || userProjects.length === 0 ? (
          <div className="p-4 space-y-3 text-center">
            <div className="w-10 h-10 rounded-full bg-[#1c1c1c] border border-[#303030] flex items-center justify-center mx-auto text-[#987654]">
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-white font-mono uppercase tracking-wide">No Project Active</h3>
              <p className="text-[11px] text-[#888888] leading-relaxed">
                Create an isolated user workspace to write, compile, and run code. LUMI internal files are strictly isolated.
              </p>
            </div>

            <div className="pt-2 space-y-1.5">
              {[
                { name: 'New Python Project', template: 'python' },
                { name: 'New Node.js Project', template: 'node' },
                { name: 'New C Project', template: 'c' },
                { name: 'New Web Project', template: 'web' }
              ].map(tpl => (
                <button
                  key={tpl.template}
                  onClick={() => createUserProject(tpl.name, tpl.template)}
                  className="w-full py-1.5 px-2 rounded bg-[#161616] hover:bg-[#202020] border border-[#2b2b2b] text-left text-xs font-mono text-[#D5D2CC] hover:text-white flex items-center space-x-2 transition-colors"
                >
                  <Plus className="w-3 h-3 text-[#987654]" />
                  <span>{tpl.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
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
              className="bg-[#141414] border border-[#987654] text-[#F5F4F1] px-1 py-0 h-5 text-xs outline-none rounded w-48"
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
          className="fixed bg-[#121212] border border-[#303030] rounded-lg shadow-2xl py-1 text-xs text-[#D5D2CC] z-50 min-w-[180px]"
        >
          {contextMenu.node.type === 'folder' && (
            <>
              <button
                onClick={() => {
                  setIsCreating({ type: 'file', parentPath: contextMenu.node.path });
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-[#191919] hover:text-[#F5F4F1] flex items-center space-x-2 transition-colors"
              >
                <FilePlus className="w-3.5 h-3.5 text-[#987654]" />
                <span>New File</span>
              </button>
              <button
                onClick={() => {
                  setIsCreating({ type: 'folder', parentPath: contextMenu.node.path });
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-[#191919] hover:text-[#F5F4F1] flex items-center space-x-2 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 text-[#987654]" />
                <span>New Folder</span>
              </button>
              <div className="my-1 border-t border-[#303030]" />
            </>
          )}

          <button
            onClick={() => {
              setRenamingPath(contextMenu.node.path);
              setRenameValue(contextMenu.node.name);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#191919] hover:text-[#F5F4F1] flex items-center justify-between transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Edit2 className="w-3.5 h-3.5 text-[#987654]" />
              <span>Rename</span>
            </div>
            <span className="text-[10px] text-[#9C9C9C] font-mono">F2</span>
          </button>

          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete '${contextMenu.node.name}'?`)) {
                deleteItem(contextMenu.node.path);
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-900/60 hover:text-white flex items-center justify-between transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Delete</span>
            </div>
            <span className="text-[10px] text-[#9C9C9C] font-mono">Del</span>
          </button>

          <div className="my-1 border-t border-[#303030]" />

          <button
            onClick={() => {
              navigator.clipboard?.writeText(contextMenu.node.path);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#191919] hover:text-[#F5F4F1] flex items-center space-x-2 transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-[#987654]" />
            <span>Copy Path</span>
          </button>

          {contextMenu.node.type === 'file' && (
            <button
              onClick={() => {
                downloadFileItem(contextMenu.node.path);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-[#191919] hover:text-[#F5F4F1] flex items-center space-x-2 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#987654]" />
              <span>Download File</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
