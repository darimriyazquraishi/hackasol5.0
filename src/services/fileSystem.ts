import JSZip from 'jszip';
import { FileNode } from '../types';
import { detectLanguage } from './defaultFiles';

// Deep clone nodes
export const cloneNodes = (nodes: FileNode[]): FileNode[] => {
  return nodes.map(node => ({
    ...node,
    children: node.children ? cloneNodes(node.children) : undefined
  }));
};

// Find a node by path
export const findNodeByPath = (nodes: FileNode[], path: string): FileNode | null => {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
};

// Flatten all files for quick search or quick open
export const flattenFiles = (nodes: FileNode[]): FileNode[] => {
  const result: FileNode[] = [];
  const traverse = (items: FileNode[]) => {
    for (const item of items) {
      if (item.type === 'file') {
        result.push(item);
      }
      if (item.children) {
        traverse(item.children);
      }
    }
  };
  traverse(nodes);
  return result;
};

// Flatten all nodes (both files and folders)
export const flattenAllNodes = (nodes: FileNode[]): FileNode[] => {
  const result: FileNode[] = [];
  const traverse = (items: FileNode[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children) {
        traverse(item.children);
      }
    }
  };
  traverse(nodes);
  return result;
};

// Add a new node (file or folder) to a parent folder or root
export const addNode = (
  nodes: FileNode[],
  parentPath: string | null,
  newNode: FileNode
): FileNode[] => {
  const copy = cloneNodes(nodes);

  if (!parentPath || parentPath === '/' || parentPath === '') {
    // Add to root
    return [...copy, newNode].sort(sortNodes);
  }

  const insert = (items: FileNode[]): boolean => {
    for (const item of items) {
      if (item.path === parentPath && item.type === 'folder') {
        item.isOpen = true; // Auto open folder
        item.children = item.children || [];
        item.children = [...item.children, newNode].sort(sortNodes);
        return true;
      }
      if (item.children && insert(item.children)) {
        return true;
      }
    }
    return false;
  };

  insert(copy);
  return copy;
};

// Rename a node and update all descendant paths
export const renameNode = (
  nodes: FileNode[],
  oldPath: string,
  newName: string
): { updatedNodes: FileNode[]; newPath: string } => {
  const copy = cloneNodes(nodes);
  let finalNewPath = oldPath;

  const update = (items: FileNode[], parentPath: string): boolean => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.path === oldPath) {
        const pathPrefix = parentPath === '/' ? '' : parentPath;
        const newPath = `${pathPrefix}/${newName}`;
        finalNewPath = newPath;

        item.name = newName;
        item.path = newPath;
        if (item.type === 'file') {
          item.language = detectLanguage(newName);
        }

        // Recursively update children paths if folder
        if (item.children) {
          const updateChildPaths = (children: FileNode[], base: string) => {
            for (const child of children) {
              child.path = `${base}/${child.name}`;
              if (child.children) {
                updateChildPaths(child.children, child.path);
              }
            }
          };
          updateChildPaths(item.children, newPath);
        }

        items.sort(sortNodes);
        return true;
      }
      if (item.children && update(item.children, item.path)) {
        return true;
      }
    }
    return false;
  };

  update(copy, '');
  return { updatedNodes: copy, newPath: finalNewPath };
};

// Delete a node by path
export const deleteNode = (nodes: FileNode[], targetPath: string): FileNode[] => {
  const copy = cloneNodes(nodes);

  const remove = (items: FileNode[]): FileNode[] => {
    return items
      .filter(item => item.path !== targetPath)
      .map(item => {
        if (item.children) {
          return {
            ...item,
            children: remove(item.children)
          };
        }
        return item;
      });
  };

  return remove(copy);
};

// Update file content
export const updateFileContent = (
  nodes: FileNode[],
  path: string,
  content: string
): FileNode[] => {
  const copy = cloneNodes(nodes);

  const update = (items: FileNode[]): boolean => {
    for (const item of items) {
      if (item.path === path && item.type === 'file') {
        item.content = content;
        item.isDirty = false;
        return true;
      }
      if (item.children && update(item.children)) {
        return true;
      }
    }
    return false;
  };

  update(copy);
  return copy;
};

// Toggle folder open/closed
export const toggleFolder = (nodes: FileNode[], folderPath: string): FileNode[] => {
  const copy = cloneNodes(nodes);

  const toggle = (items: FileNode[]): boolean => {
    for (const item of items) {
      if (item.path === folderPath && item.type === 'folder') {
        item.isOpen = !item.isOpen;
        return true;
      }
      if (item.children && toggle(item.children)) {
        return true;
      }
    }
    return false;
  };

  toggle(copy);
  return copy;
};

// Helper sort: folders first alphabetically, then files alphabetically
export const sortNodes = (a: FileNode, b: FileNode): number => {
  if (a.type !== b.type) {
    return a.type === 'folder' ? -1 : 1;
  }
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
};

// ----------------- Real File System Access API -----------------

export const canUseFileSystemAccess = (): boolean => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

// Open a local directory from user's hard drive
export const openNativeDirectory = async (): Promise<{
  files: FileNode[];
  rootName: string;
  rootHandle: any;
} | null> => {
  try {
    if (!canUseFileSystemAccess()) {
      alert("Your browser does not support the File System Access API. Please use a Chromium-based browser like Chrome or Edge.");
      return null;
    }

    const dirHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite'
    });

    const rootName = dirHandle.name;

    const readDirectory = async (
      handle: any,
      parentPath: string
    ): Promise<FileNode[]> => {
      const nodes: FileNode[] = [];

      for await (const entry of handle.values()) {
        const currentPath = `${parentPath}/${entry.name}`;

        // Skip ignored directories
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.vscode') {
          continue;
        }

        if (entry.kind === 'directory') {
          const children = await readDirectory(entry, currentPath);
          nodes.push({
            id: `native-dir-${currentPath}`,
            name: entry.name,
            path: currentPath,
            type: 'folder',
            isOpen: false,
            children: children.sort(sortNodes),
            handle: entry,
            isNative: true
          });
        } else if (entry.kind === 'file') {
          try {
            const file = await entry.getFile();
            // Don't read huge binary files into text memory
            let content = '';
            if (file.size < 5 * 1024 * 1024) {
              content = await file.text();
            } else {
              content = `// File exceeds 5MB - preview disabled`;
            }

            nodes.push({
              id: `native-file-${currentPath}`,
              name: entry.name,
              path: currentPath,
              type: 'file',
              language: detectLanguage(entry.name),
              content,
              handle: entry,
              isNative: true
            });
          } catch (e) {
            console.warn(`Could not read file ${entry.name}`, e);
          }
        }
      }

      return nodes.sort(sortNodes);
    };

    const files = await readDirectory(dirHandle, '');
    return { files, rootName, rootHandle: dirHandle };
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.error('Failed to open directory:', err);
    }
    return null;
  }
};

// Save native file to disk directly!
export const saveNativeFile = async (handle: any, content: string): Promise<boolean> => {
  if (!handle || typeof handle.createWritable !== 'function') return false;
  try {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch (err) {
    console.error('Failed to write native file:', err);
    return false;
  }
};

// ----------------- Export as ZIP -----------------

export const exportWorkspaceAsZip = async (nodes: FileNode[], projectName: string = 'workspace') => {
  const zip = new JSZip();

  const addToZip = (items: FileNode[], currentZipFolder: JSZip) => {
    for (const item of items) {
      if (item.type === 'folder') {
        const newFolder = currentZipFolder.folder(item.name);
        if (newFolder && item.children) {
          addToZip(item.children, newFolder);
        }
      } else if (item.type === 'file') {
        currentZipFolder.file(item.name, item.content || '');
      }
    }
  };

  addToZip(nodes, zip);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ----------------- Download Single File -----------------

export const downloadFile = (name: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
