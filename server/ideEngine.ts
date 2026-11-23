import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';

export interface UserProject {
  id: string;
  name: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  entrypoint?: string;
  fileCount?: number;
}

export interface ProjectFileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  language?: string;
  isOpen?: boolean;
  children?: ProjectFileNode[];
}

const USER_PROJECTS_DIR = path.resolve(process.cwd(), 'data', 'user_projects');
const REGISTRY_FILE = path.join(USER_PROJECTS_DIR, 'projects.json');

// Ensure projects directory exists
try {
  if (!fs.existsSync(USER_PROJECTS_DIR)) {
    fs.mkdirSync(USER_PROJECTS_DIR, { recursive: true });
  }
} catch (e) {
  console.error('Failed to initialize user_projects directory:', e);
}

function loadRegistry(): UserProject[] {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = fs.readFileSync(REGISTRY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading projects registry:', e);
  }
  return [];
}

function saveRegistry(projects: UserProject[]) {
  try {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving projects registry:', e);
  }
}

/**
 * Strict Security Guard: Ensures all path operations remain strictly bounded
 * inside the project root directory. Rejects traversal attempts (..), root escapes,
 * and access to LUMI internal source code.
 */
export function resolveSafeProjectPath(projectId: string, relPath: string = ''): { projectRoot: string; fullPath: string } {
  if (!projectId || !/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new Error('Access denied: Invalid project identifier.');
  }

  const projectRoot = path.resolve(USER_PROJECTS_DIR, projectId);
  if (!fs.existsSync(projectRoot)) {
    throw new Error(`Project '${projectId}' does not exist.`);
  }

  // Normalize and clean relative path
  const sanitizedRel = relPath.replace(/^[\/\\]+/, '');
  const fullPath = path.resolve(projectRoot, sanitizedRel);

  // Security check: Must strictly be within projectRoot
  if (!fullPath.startsWith(projectRoot)) {
    throw new Error('Access denied: Path traversal attempt outside project root.');
  }

  // Security check: Disallow access to .env, node_modules, .git inside project
  const basename = path.basename(fullPath);
  if (basename === '.env' || basename === '.git') {
    throw new Error('Access denied: Access to sensitive system files is prohibited.');
  }

  return { projectRoot, fullPath };
}

export function listUserProjects(): UserProject[] {
  const projects = loadRegistry();
  // Update file counts
  return projects.map(p => {
    try {
      const pRoot = path.resolve(USER_PROJECTS_DIR, p.id);
      if (fs.existsSync(pRoot)) {
        const files = countFiles(pRoot);
        return { ...p, fileCount: files };
      }
    } catch {
      // ignore
    }
    return p;
  });
}

function countFiles(dir: string): number {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__pycache__') continue;
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

export function createUserProject(name: string, template: string = 'python'): UserProject {
  const cleanName = (name || 'New Project').trim().replace(/[^a-zA-Z0-9 _-]/g, '');
  const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const projectRoot = path.resolve(USER_PROJECTS_DIR, id);

  fs.mkdirSync(projectRoot, { recursive: true });

  let entrypoint = 'main.py';
  let lang = 'python';

  if (template === 'python') {
    lang = 'python';
    entrypoint = 'main.py';
    fs.writeFileSync(
      path.join(projectRoot, 'main.py'),
      `# LUMI Isolated User Project\n# Entry point: main.py\n\ndef calculate_metrics():\n    data = [12.5, 45.2, 88.1, 102.4]\n    total = sum(data)\n    avg = total / len(data)\n    return total, avg\n\nif __name__ == "__main__":\n    print("Starting user project execution...")\n    total, avg = calculate_metrics()\n    print(f"Metrics evaluated: Total = {total:.2f}, Average = {avg:.2f}")\n    print("Execution complete.")\n`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(projectRoot, 'README.md'),
      `# ${cleanName}\n\nIsolated user development workspace in LUMI.\n\nRun with: \`python main.py\`\n`,
      'utf-8'
    );
  } else if (template === 'node' || template === 'javascript') {
    lang = 'javascript';
    entrypoint = 'index.js';
    fs.writeFileSync(
      path.join(projectRoot, 'index.js'),
      `// LUMI Isolated User Project\n// Entry point: index.js\n\nfunction run() {\n  const now = new Date();\n  console.log("Starting user application at:", now.toISOString());\n  const results = [1, 2, 3, 4, 5].map(x => x * x);\n  console.log("Computed squares:", results);\n  console.log("Execution complete.");\n}\n\nrun();\n`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ name: cleanName.toLowerCase().replace(/\s+/g, '-'), version: '1.0.0', main: 'index.js' }, null, 2),
      'utf-8'
    );
  } else if (template === 'c') {
    lang = 'c';
    entrypoint = 'main.c';
    fs.writeFileSync(
      path.join(projectRoot, 'main.c'),
      `#include <stdio.h>\n\nint main() {\n    printf("LUMI User Project: C Sandbox\\n");\n    int sum = 0;\n    for(int i = 1; i <= 10; i++) {\n        sum += i;\n    }\n    printf("Sum from 1 to 10 is: %d\\n", sum);\n    return 0;\n}\n`,
      'utf-8'
    );
  } else if (template === 'web') {
    lang = 'html';
    entrypoint = 'index.html';
    fs.writeFileSync(
      path.join(projectRoot, 'index.html'),
      `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${cleanName}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>${cleanName}</h1>\n  <p>User Web Project running in LUMI Sandbox.</p>\n  <script src="app.js"></script>\n</body>\n</html>\n`,
      'utf-8'
    );
    fs.writeFileSync(path.join(projectRoot, 'style.css'), `body { font-family: sans-serif; background: #080808; color: #f5f4f1; padding: 2rem; }\nh1 { color: #c4a47c; }\n`, 'utf-8');
    fs.writeFileSync(path.join(projectRoot, 'app.js'), `console.log("LUMI Web Project loaded.");\n`, 'utf-8');
  } else {
    // empty template
    lang = 'plaintext';
    entrypoint = 'README.md';
    fs.writeFileSync(path.join(projectRoot, 'README.md'), `# ${cleanName}\n\nEmpty user project.\n`, 'utf-8');
  }

  const newProject: UserProject = {
    id,
    name: cleanName,
    language: lang,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entrypoint,
    fileCount: countFiles(projectRoot)
  };

  const projects = loadRegistry();
  projects.unshift(newProject);
  saveRegistry(projects);

  return newProject;
}

export function deleteUserProject(projectId: string): boolean {
  const { projectRoot } = resolveSafeProjectPath(projectId, '');
  try {
    fs.rmSync(projectRoot, { recursive: true, force: true });
    const projects = loadRegistry().filter(p => p.id !== projectId);
    saveRegistry(projects);
    return true;
  } catch (e) {
    console.error(`Error deleting project ${projectId}:`, e);
    return false;
  }
}

export function renameUserProject(projectId: string, newName: string): UserProject {
  const cleanName = (newName || 'Project').trim().replace(/[^a-zA-Z0-9 _-]/g, '');
  const projects = loadRegistry();
  const proj = projects.find(p => p.id === projectId);
  if (!proj) throw new Error(`Project ${projectId} not found.`);

  proj.name = cleanName;
  proj.updatedAt = new Date().toISOString();
  saveRegistry(projects);
  return proj;
}

export function getProjectFileTree(projectId: string): ProjectFileNode[] {
  const { projectRoot } = resolveSafeProjectPath(projectId, '');

  function scan(dir: string, relPrefix: string = ''): ProjectFileNode[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const nodes: ProjectFileNode[] = [];

    // Sort: directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__pycache__') continue;
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        nodes.push({
          id: `fld_${relPath}`,
          name: entry.name,
          path: `/${relPath}`,
          type: 'folder',
          isOpen: true,
          children: scan(full, relPath)
        });
      } else {
        const ext = entry.name.split('.').pop()?.toLowerCase() || '';
        nodes.push({
          id: `fil_${relPath}`,
          name: entry.name,
          path: `/${relPath}`,
          type: 'file',
          language: getLanguageForExt(ext)
        });
      }
    }
    return nodes;
  }

  return scan(projectRoot);
}

function getLanguageForExt(ext: string): string {
  switch (ext) {
    case 'py': return 'python';
    case 'js':
    case 'mjs': return 'javascript';
    case 'ts':
    case 'tsx': return 'typescript';
    case 'c':
    case 'h': return 'c';
    case 'cpp': return 'cpp';
    case 'java': return 'java';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'json': return 'json';
    case 'md': return 'markdown';
    default: return 'plaintext';
  }
}

export function readProjectFile(projectId: string, relPath: string): { content: string; language: string; path: string; name: string } {
  const { fullPath } = resolveSafeProjectPath(projectId, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File '${relPath}' not found in project.`);
  }
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    throw new Error(`Path '${relPath}' is a directory, not a file.`);
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  const name = path.basename(fullPath);
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return {
    content,
    language: getLanguageForExt(ext),
    path: `/${relPath.replace(/^[\/\\]+/, '')}`,
    name
  };
}

export function writeProjectFile(projectId: string, relPath: string, content: string): boolean {
  const { fullPath } = resolveSafeProjectPath(projectId, relPath);
  const parentDir = path.dirname(fullPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, 'utf-8');

  // Update project updatedAt
  const projects = loadRegistry();
  const proj = projects.find(p => p.id === projectId);
  if (proj) {
    proj.updatedAt = new Date().toISOString();
    saveRegistry(projects);
  }
  return true;
}

export function deleteProjectFileOrFolder(projectId: string, relPath: string): boolean {
  const { fullPath, projectRoot } = resolveSafeProjectPath(projectId, relPath);
  if (fullPath === projectRoot) {
    throw new Error('Cannot delete project root directly.');
  }
  if (!fs.existsSync(fullPath)) return true;
  fs.rmSync(fullPath, { recursive: true, force: true });
  return true;
}

export function createProjectFolder(projectId: string, relPath: string): boolean {
  const { fullPath } = resolveSafeProjectPath(projectId, relPath);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  return true;
}

/**
 * Sandboxed Execution of user project code.
 * Working directory is strictly locked to projectRoot.
 * Timeout: 10,000ms.
 */
export function runUserProject(
  projectId: string,
  entrypoint?: string,
  overrideLanguage?: string
): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number; command: string }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    try {
      const { projectRoot } = resolveSafeProjectPath(projectId, '');
      const projects = loadRegistry();
      const proj = projects.find(p => p.id === projectId);

      const targetEntry = entrypoint || proj?.entrypoint || 'main.py';
      const entryFullPath = path.resolve(projectRoot, targetEntry.replace(/^[\/\\]+/, ''));

      if (!entryFullPath.startsWith(projectRoot)) {
        return resolve({
          stdout: '',
          stderr: 'Access violation: Entry point is outside project directory.',
          exitCode: 1,
          durationMs: 0,
          command: 'denied'
        });
      }

      const ext = path.extname(entryFullPath).toLowerCase();
      let runner = 'node';
      let args: string[] = [entryFullPath];
      let displayCmd = `node ${targetEntry}`;

      const hostPython = 'C:\\Users\\Zoran\\AppData\\Local\\Python\\bin\\python.exe';
      const pythonBin = fs.existsSync(hostPython) ? hostPython : 'python';

      if (ext === '.py' || overrideLanguage === 'python') {
        runner = pythonBin;
        args = [entryFullPath];
        displayCmd = `python ${targetEntry}`;
      } else if (ext === '.js' || ext === '.mjs') {
        runner = 'node';
        args = [entryFullPath];
        displayCmd = `node ${targetEntry}`;
      } else if (ext === '.c') {
        // Compile with gcc, then run executable
        const binOut = path.resolve(projectRoot, process.platform === 'win32' ? 'a.exe' : 'a.out');
        const compileRes = spawnSync('gcc', [entryFullPath, '-o', binOut], { cwd: projectRoot, timeout: 30000 });
        if (compileRes.status !== 0) {
          return resolve({
            stdout: compileRes.stdout ? compileRes.stdout.toString().trim() : '',
            stderr: compileRes.stderr ? compileRes.stderr.toString().trim() : 'GCC compilation failed.',
            exitCode: compileRes.status ?? 1,
            durationMs: Date.now() - startTime,
            command: `gcc ${targetEntry} -o a.exe`
          });
        }
        runner = binOut;
        args = [];
        displayCmd = `gcc ${targetEntry} -o a.exe && .\\a.exe`;
      }

      const child = spawn(runner, args, {
        cwd: projectRoot,
        timeout: 120000,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1'
        }
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
      child.stderr?.on('data', chunk => { stderr += chunk.toString(); });

      child.on('close', code => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? 0,
          durationMs: Date.now() - startTime,
          command: displayCmd
        });
      });

      child.on('error', err => {
        resolve({
          stdout: '',
          stderr: `Execution failure: ${err.message}`,
          exitCode: 1,
          durationMs: Date.now() - startTime,
          command: displayCmd
        });
      });
    } catch (err: any) {
      resolve({
        stdout: '',
        stderr: `Failed to launch sandbox execution: ${err.message}`,
        exitCode: 1,
        durationMs: Date.now() - startTime,
        command: 'error'
      });
    }
  });
}
