import { FileNode } from '../types';
import { findNodeByPath, flattenFiles, addNode, deleteNode } from './fileSystem';

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'info' | 'system';
  text: string;
}

export class TerminalEmulator {
  private currentPath: string = '/';
  private history: string[] = [];
  private historyIndex: number = -1;

  constructor() {}

  getCurrentPath(): string {
    return this.currentPath;
  }

  getPrompt(): string {
    const displayPath = this.currentPath === '/' ? '~' : `~${this.currentPath}`;
    return `developer@vscode-web:${displayPath}$ `;
  }

  execute(
    commandLine: string,
    files: FileNode[],
    callbacks: {
      onAddFile: (path: string, content?: string) => void;
      onAddFolder: (path: string) => void;
      onDelete: (path: string) => void;
      onClear: () => void;
      onExportZip: () => void;
    }
  ): TerminalLine[] {
    const trimmed = commandLine.trim();
    if (!trimmed) {
      return [];
    }

    this.history.push(trimmed);
    this.historyIndex = this.history.length;

    const parts = trimmed.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    const lines: TerminalLine[] = [];

    const resolvePath = (target: string): string => {
      if (!target) return this.currentPath;
      if (target.startsWith('/')) return target;
      if (target === '~') return '/';
      if (target === '.') return this.currentPath;
      if (target === '..') {
        if (this.currentPath === '/') return '/';
        const segments = this.currentPath.split('/').filter(Boolean);
        segments.pop();
        return segments.length === 0 ? '/' : `/${segments.join('/')}`;
      }
      return this.currentPath === '/' ? `/${target}` : `${this.currentPath}/${target}`;
    };

    switch (command) {
      case 'help':
        lines.push({
          id: Math.random().toString(),
          type: 'info',
          text: `VS Code Integrated Terminal - Supported Commands:
  ls, dir           - List files and folders in current directory
  cd <dir>          - Change current working directory
  pwd               - Print working directory
  cat <file>        - Display contents of a file
  touch <file>      - Create a new empty file
  mkdir <dir>       - Create a new directory
  rm <path>         - Remove a file or directory
  node <file>       - Run a JavaScript/TypeScript file in sandbox
  python <file>     - Execute a Python script
  git status        - Show git repository status
  git branch        - List or show current branch
  git commit -m     - Commit staged changes
  clear             - Clear terminal screen
  echo <message>    - Print text to terminal
  date              - Display current date and time
  whoami            - Display current user
  export-zip        - Export entire project as a ZIP file`
        });
        break;

      case 'clear':
      case 'cls':
        callbacks.onClear();
        return [];

      case 'pwd':
        lines.push({
          id: Math.random().toString(),
          type: 'output',
          text: this.currentPath === '/' ? '/workspace' : `/workspace${this.currentPath}`
        });
        break;

      case 'whoami':
        lines.push({
          id: Math.random().toString(),
          type: 'output',
          text: 'developer (Visual Studio Code Web Shell)'
        });
        break;

      case 'date':
        lines.push({
          id: Math.random().toString(),
          type: 'output',
          text: new Date().toString()
        });
        break;

      case 'echo':
        lines.push({
          id: Math.random().toString(),
          type: 'output',
          text: args.join(' ')
        });
        break;

      case 'ls':
      case 'dir': {
        const targetPath = args[0] ? resolvePath(args[0]) : this.currentPath;
        let items: FileNode[] = [];

        if (targetPath === '/') {
          items = files;
        } else {
          const folderNode = findNodeByPath(files, targetPath);
          if (!folderNode) {
            lines.push({
              id: Math.random().toString(),
              type: 'error',
              text: `ls: cannot access '${args[0]}': No such file or directory`
            });
            break;
          }
          if (folderNode.type !== 'folder') {
            lines.push({
              id: Math.random().toString(),
              type: 'output',
              text: folderNode.name
            });
            break;
          }
          items = folderNode.children || [];
        }

        if (items.length === 0) {
          lines.push({
            id: Math.random().toString(),
            type: 'info',
            text: '(directory is empty)'
          });
        } else {
          const formatted = items
            .map(item => {
              if (item.type === 'folder') {
                return `📁 \x1b[34m${item.name}/\x1b[0m`;
              }
              return `📄 ${item.name}`;
            })
            .join('    ');
          lines.push({
            id: Math.random().toString(),
            type: 'output',
            text: formatted
          });
        }
        break;
      }

      case 'cd': {
        const target = args[0] || '~';
        const targetPath = resolvePath(target);

        if (targetPath === '/') {
          this.currentPath = '/';
          break;
        }

        const node = findNodeByPath(files, targetPath);
        if (!node) {
          lines.push({
            id: Math.random().toString(),
            type: 'error',
            text: `cd: no such file or directory: ${args[0]}`
          });
        } else if (node.type !== 'folder') {
          lines.push({
            id: Math.random().toString(),
            type: 'error',
            text: `cd: not a directory: ${args[0]}`
          });
        } else {
          this.currentPath = targetPath;
        }
        break;
      }

      case 'cat': {
        if (!args[0]) {
          lines.push({
            id: Math.random().toString(),
            type: 'error',
            text: 'cat: missing filename'
          });
          break;
        }
        const targetPath = resolvePath(args[0]);
        const node = findNodeByPath(files, targetPath);
        if (!node) {
          lines.push({
            id: Math.random().toString(),
            type: 'error',
            text: `cat: ${args[0]}: No such file or directory`
          });
        } else if (node.type === 'folder') {
          lines.push({
            id: Math.random().toString(),
            type: 'error',
            text: `cat: ${args[0]}: Is a directory`
          });
        } else {
          lines.push({
            id: Math.random().toString(),
            type: 'output',
            text: node.content || ''
          });
        }
        break;
      }

      case 'touch': {
        if (!args[0]) {
          lines.push({
            id: Math.random().toString(),
            type: 'error',
            text: 'touch: missing file operand'
          });
          break;
        }
        const fileName = args[0];
        const fullPath = resolvePath(fileName);
        callbacks.onAddFile(fullPath, '');
        lines.push({
          id: Math.random().toString(),
          type: 'info',
          text: `Created file: ${fileName}`
        });
        break;
      }

      case 'mkdir': {
        if (!args[0]) {
          lines.push({
            id: Math.random().toString(),
            type: 'error',
            text: 'mkdir: missing directory name'
          });
          break;
        }
        const dirName = args[0];
        const fullPath = resolvePath(dirName);
        callbacks.onAddFolder(fullPath);
        lines.push({
          id: Math.random().toString(),
          type: 'info',
          text: `Created directory: ${dirName}`
        });
        break;
      }

      case 'rm':
      case 'rmdir': {
        if (!args[0]) {
          lines.push({
            id: Math.random().toString(),
            type: 'error',
            text: 'rm: missing operand'
          });
          break;
        }
        const targetPath = resolvePath(args[0]);
        const node = findNodeByPath(files, targetPath);
        if (!node) {
          lines.push({
            id: Math.random().toString(),
            type: 'error',
            text: `rm: cannot remove '${args[0]}': No such file or directory`
          });
        } else {
          callbacks.onDelete(targetPath);
          lines.push({
            id: Math.random().toString(),
            type: 'info',
            text: `Removed: ${args[0]}`
          });
        }
        break;
      }

      case 'node': {
        if (!args[0]) {
          lines.push({
            id: Math.random().toString(),
            type: 'output',
            text: 'Welcome to Node.js v20.10.0 (simulated).\nType ".exit" to exit.'
          });
          break;
        }

        let codeToRun = '';
        if (args[0] === '-e' && args[1]) {
          codeToRun = args.slice(1).join(' ').replace(/^["']|["']$/g, '');
        } else {
          const targetPath = resolvePath(args[0]);
          const node = findNodeByPath(files, targetPath);
          if (!node) {
            lines.push({
              id: Math.random().toString(),
              type: 'error',
              text: `Error: Cannot find module '${args[0]}'`
            });
            break;
          }
          codeToRun = node.content || '';
        }

        // Clean any typescript import/export for simple evaluation
        const transformedCode = codeToRun
          .replace(/import\s+.*?from\s+['"].*?['"];?/g, '')
          .replace(/export\s+(const|let|var|function|class|default)\s+/g, '$1 ')
          .replace(/:\s*[A-Za-z0-9_<>\[\]|]+/g, ''); // strip simple TS annotations

        try {
          const logs: string[] = [];
          const customConsole = {
            log: (...msgs: any[]) => logs.push(msgs.map(m => typeof m === 'object' ? JSON.stringify(m, null, 2) : String(m)).join(' ')),
            warn: (...msgs: any[]) => logs.push(`[WARN] ` + msgs.join(' ')),
            error: (...msgs: any[]) => logs.push(`[ERROR] ` + msgs.join(' ')),
            info: (...msgs: any[]) => logs.push(`[INFO] ` + msgs.join(' '))
          };

          const runner = new Function('console', transformedCode);
          runner(customConsole);

          if (logs.length > 0) {
            lines.push({
              id: Math.random().toString(),
              type: 'output',
              text: logs.join('\n')
            });
          } else {
            lines.push({
              id: Math.random().toString(),
              type: 'info',
              text: '(Script executed successfully with no output)'
            });
          }
        } catch (err: any) {
          lines.push({
            id: Math.random().toString(),
            type: 'error',
            text: `Runtime Error: ${err.message}`
          });
        }
        break;
      }

      case 'python':
      case 'python3': {
        if (!args[0]) {
          lines.push({
            id: Math.random().toString(),
            type: 'output',
            text: 'Python 3.11.5 (simulated). Type "help" for more information.'
          });
          break;
        }

        const targetPath = resolvePath(args[0]);
        const node = findNodeByPath(files, targetPath);
        if (!node) {
          lines.push({
            id: Math.random().toString(),
            type: 'error',
            text: `python: can't open file '${args[0]}': [Errno 2] No such file or directory`
          });
          break;
        }

        // Simple Python simulator parsing print() statements
        const content = node.content || '';
        const printRegex = /print\((.*?)\)/g;
        let match;
        const outputs: string[] = [];

        while ((match = printRegex.exec(content)) !== null) {
          let inner = match[1].trim();
          // Evaluate simple string prints
          if (inner.startsWith('f"') || inner.startsWith("f'")) {
            inner = inner.slice(2, -1);
          } else if (inner.startsWith('"') || inner.startsWith("'")) {
            inner = inner.slice(1, -1);
          }
          outputs.push(inner);
        }

        if (outputs.length > 0) {
          lines.push({
            id: Math.random().toString(),
            type: 'output',
            text: outputs.join('\n')
          });
        } else {
          lines.push({
            id: Math.random().toString(),
            type: 'info',
            text: `[Python script executed: ${node.name}]`
          });
        }
        break;
      }

      case 'git': {
        const sub = args[0]?.toLowerCase();
        if (sub === 'status') {
          lines.push({
            id: Math.random().toString(),
            type: 'output',
            text: `On branch main\nYour branch is up to date with 'origin/main'.\n\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n\tmodified:   src/App.tsx\n\nno changes added to commit (use "git add")`
          });
        } else if (sub === 'branch') {
          lines.push({
            id: Math.random().toString(),
            type: 'output',
            text: `* \x1b[32mmain\x1b[0m\n  feature/editor-improvements\n  dev`
          });
        } else if (sub === 'checkout') {
          lines.push({
            id: Math.random().toString(),
            type: 'output',
            text: `Switched to branch '${args[1] || 'main'}'`
          });
        } else if (sub === 'commit') {
          lines.push({
            id: Math.random().toString(),
            type: 'output',
            text: `[main 7f20c91] ${args.slice(1).join(' ') || 'commit changes'}\n 1 file changed, 4 insertions(+), 2 deletions(-)`
          });
        } else {
          lines.push({
            id: Math.random().toString(),
            type: 'info',
            text: `git version 2.43.0\nCommands: status, branch, checkout, commit, push, pull, log`
          });
        }
        break;
      }

      case 'export-zip':
      case 'zip':
        callbacks.onExportZip();
        lines.push({
          id: Math.random().toString(),
          type: 'info',
          text: 'Triggered project zip export...'
        });
        break;

      default:
        lines.push({
          id: Math.random().toString(),
          type: 'error',
          text: `bash: ${command}: command not found. Type 'help' to see available commands.`
        });
        break;
    }

    return lines;
  }
}
