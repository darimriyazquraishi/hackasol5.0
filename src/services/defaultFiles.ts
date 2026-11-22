import { FileNode } from '../types';

export const detectLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'scss':
    case 'sass':
      return 'scss';
    case 'less':
      return 'less';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'py':
      return 'python';
    case 'cpp':
    case 'cxx':
    case 'cc':
      return 'cpp';
    case 'c':
    case 'h':
      return 'c';
    case 'java':
      return 'java';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'php':
      return 'php';
    case 'rb':
      return 'ruby';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'sql':
      return 'sql';
    case 'xml':
    case 'svg':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'plaintext';
  }
};

export const defaultWorkspaceFiles: FileNode[] = [
  {
    id: 'folder-src',
    name: 'src',
    path: '/src',
    type: 'folder',
    isOpen: true,
    children: [
      {
        id: 'folder-components',
        name: 'components',
        path: '/src/components',
        type: 'folder',
        isOpen: true,
        children: [
          {
            id: 'file-navbar',
            name: 'Navbar.tsx',
            path: '/src/components/Navbar.tsx',
            type: 'file',
            language: 'typescript',
            content: `import React from 'react';

interface NavbarProps {
  title: string;
  version?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ title, version = '1.0.0' }) => {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 text-white">
      <div className="flex items-center space-x-3">
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold">
          ⚡
        </div>
        <h1 className="text-lg font-semibold tracking-wide">{title}</h1>
        <span className="text-xs bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-full border border-blue-700/50">
          v{version}
        </span>
      </div>
      <nav className="flex items-center space-x-6 text-sm text-slate-300">
        <a href="#features" className="hover:text-white transition-colors">Features</a>
        <a href="#docs" className="hover:text-white transition-colors">Documentation</a>
        <a href="#terminal" className="hover:text-white transition-colors">Terminal</a>
        <button className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 font-medium text-white transition-all shadow-sm">
          Run App
        </button>
      </nav>
    </header>
  );
};
`
          },
          {
            id: 'file-card',
            name: 'Card.tsx',
            path: '/src/components/Card.tsx',
            type: 'file',
            language: 'typescript',
            content: `import React from 'react';

interface CardProps {
  title: string;
  description: string;
  badge?: string;
}

export const Card: React.FC<CardProps> = ({ title, description, badge }) => {
  return (
    <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-blue-500 transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
};
`
          }
        ]
      },
      {
        id: 'folder-utils',
        name: 'utils',
        path: '/src/utils',
        type: 'folder',
        isOpen: false,
        children: [
          {
            id: 'file-math',
            name: 'math.ts',
            path: '/src/utils/math.ts',
            type: 'file',
            language: 'typescript',
            content: `/**
 * Simple utility math helpers for testing execution in our built-in terminal
 */

export const add = (a: number, b: number): number => a + b;

export const multiply = (a: number, b: number): number => a * b;

export const fibonacci = (n: number): number[] => {
  const seq: number[] = [0, 1];
  for (let i = 2; i < n; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
  }
  return seq.slice(0, n);
};

// Try running: node src/utils/math.ts in the terminal!
console.log("Calculated Fibonacci(8):", fibonacci(8));
`
          }
        ]
      },
      {
        id: 'file-app',
        name: 'App.tsx',
        path: '/src/App.tsx',
        type: 'file',
        language: 'typescript',
        content: `import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Card } from './components/Card';

export function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Navbar title="Visual Studio Code Web" version="1.95.0" />

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Workspace Preview
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
            React and TypeScript running alongside Monaco Editor, local file system tools, and integrated terminal.
          </p>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => setCount((c) => c + 1)}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 font-medium text-sm text-white transition-colors"
            >
              Increment ({count})
            </button>
            <button
              onClick={() => setCount(0)}
              className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 font-medium text-sm border border-slate-700 text-slate-300 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            title="Monaco Editor"
            description="High-performance code editing with syntax highlighting, autocomplete, and bracket matching."
            badge="Core"
          />
          <Card
            title="Integrated Terminal"
            description="Run command-line utilities, evaluate JavaScript, manipulate files, and check git status."
            badge="Interactive"
          />
          <Card
            title="Local File Access"
            description="Open any directory on your local machine using modern Web File System API."
            badge="Native"
          />
        </div>
      </main>
    </div>
  );
}

export default App;
`
      },
      {
        id: 'file-main',
        name: 'main.tsx',
        path: '/src/main.tsx',
        type: 'file',
        language: 'typescript',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`
      },
      {
        id: 'file-index-css',
        name: 'index.css',
        path: '/src/index.css',
        type: 'file',
        language: 'css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

body {
  margin: 0;
  padding: 0;
  user-select: none;
  background-color: #1e1e1e;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
`
      }
    ]
  },
  {
    id: 'file-package-json',
    name: 'package.json',
    path: '/package.json',
    type: 'file',
    language: 'json',
    content: `{
  "name": "vscode-web-workspace",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.475.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.3",
    "vite": "^6.2.0"
  }
}
`
  },
  {
    id: 'file-readme',
    name: 'README.md',
    path: '/README.md',
    type: 'file',
    language: 'markdown',
    content: `# Visual Studio Code Web

Browser-based development environment built with React, TypeScript, and Monaco Editor.

## Capabilities

- Monaco Editor with syntax highlighting, minimap, bracket pairing, and code formatting
- File management supporting native directory mounts via File System Access API
- Inline file creation, folder organization, F2 renaming, and deletion
- Integrated shell terminal with commands for file manipulation, Node evaluation, and Git state
- Full-text search and replace across workspace files with regular expression support
- Source control viewer tracking working tree diffs and commit records
- Command palette and quick file navigation

## Keyboard Shortcuts

- \`Ctrl + S\`: Save active file
- \`Ctrl + P\`: Quick open file
- \`Ctrl + Shift + P\` / \`F1\`: Command palette
- \`Ctrl + \`\`: Toggle terminal panel
- \`Ctrl + B\`: Toggle primary sidebar
- \`Ctrl + L\`: Toggle Antigravity assistant
- \`Ctrl + Shift + F\`: Focus global search
`
  },
  {
    id: 'file-demo-py',
    name: 'demo.py',
    path: '/demo.py',
    type: 'file',
    language: 'python',
    content: `# Python Demo Script
import sys

def greet(name: str) -> str:
    return f"Hello, {name}! Welcome to VS Code Clone."

def calculate_factorial(n: int) -> int:
    if n <= 1:
        return 1
    return n * calculate_factorial(n - 1)

if __name__ == "__main__":
    print(greet("Developer"))
    print("Factorial of 5 is:", calculate_factorial(5))
`
  }
];
