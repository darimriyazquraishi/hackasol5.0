/**
 * LUMI 3D Studio & Blender Automation Engine
 *
 * Bridges LUMI's backend with the local PRJ Blender automation skill.
 * Supports:
 * - Blender 3.6+ detection and status check
 * - Natural language 3D generation (Parametric Models + ISA-5.1 P&ID Diagrams)
 * - Incremental scene editing and spatial reasoning
 * - Scene inspection (objects, hierarchy, bounding boxes, materials)
 * - EEVEE preview rendering and .blend artifact distribution
 * - Opening projects in the native Blender GUI
 */

import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { IncomingMessage, ServerResponse } from 'http';

export interface BlenderStatus {
  installed: boolean;
  version: string;
  executable: string;
  python: string;
  ollamaConnected: boolean;
  projectsCount: number;
}

export interface BlenderProjectItem {
  project_id: string;
  prompt: string;
  model: string;
  created_at: string;
  updated_at?: string;
  has_blend: boolean;
  has_preview: boolean;
  preview_url: string | null;
  blend_url: string | null;
  components: string[];
  total_objects: number;
  is_diagram?: boolean;
}

export interface BlenderProjectDetail extends BlenderProjectItem {
  plan?: any;
  scene_state?: {
    object_count: number;
    objects: Array<{
      id?: string;
      name: string;
      type?: string;
      group_name?: string;
      position?: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
      dimensions?: [number, number, number];
      bounding_box?: any;
      material?: {
        name: string;
        color?: [number, number, number, number];
        metallic?: number;
        roughness?: number;
      };
      collection?: string;
    }>;
  };
  stats?: any;
}

export interface BlenderTaskState {
  task_id: string;
  project_id: string;
  prompt: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  logs: string[];
  result?: any;
  error?: string;
  started_at: string;
  completed_at?: string;
}

// Directory configuration
const PRJ_ROOT = path.resolve(process.cwd(), 'server', 'prj_blender_skill', 'prj');
const BLENDER_SKILL_SCRIPT = path.join(PRJ_ROOT, 'blender_skill.py');
const PROJECTS_DIR = path.join(PRJ_ROOT, 'projects');
const TASKS_DIR = path.join(PRJ_ROOT, 'tasks');

// Active in-memory tasks tracker
const ACTIVE_TASKS = new Map<string, BlenderTaskState>();
let _cachedOllamaConnected = false;

// Ensure directories exist
try {
  if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });
} catch {
  // ignore
}

/**
 * Locate Blender 3.6+ binary across standard Windows and system locations
 */
export function findBlenderExecutable(): string {
  const envPath = process.env.BLENDER_EXE?.trim();
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidates = [
    'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 5.3\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender\\blender.exe',
    '/usr/bin/blender',
    '/usr/local/bin/blender',
    '/Applications/Blender.app/Contents/MacOS/Blender'
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // Scan Windows Program Files for Blender Foundation
  const bfDir = 'C:\\Program Files\\Blender Foundation';
  if (fs.existsSync(bfDir)) {
    try {
      const subs = fs.readdirSync(bfDir);
      for (const sub of subs) {
        const exe = path.join(bfDir, sub, 'blender.exe');
        if (fs.existsSync(exe)) return exe;
      }
    } catch {
      // ignore
    }
  }

  return '';
}

/**
 * Locate Python executable compatible with Blender runner
 */
export function findBlenderPython(): string {
  // 1. Blender 4.2 bundled python
  const blenderPy42 = 'C:\\Program Files\\Blender Foundation\\Blender 4.2\\4.2\\python\\bin\\python.exe';
  if (fs.existsSync(blenderPy42)) return blenderPy42;

  // 2. Blender 5.3 bundled python
  const blenderPy53 = 'C:\\Program Files\\Blender Foundation\\Blender 5.3\\5.3\\python\\bin\\python.exe';
  if (fs.existsSync(blenderPy53)) return blenderPy53;

  // 3. Scan Blender Foundation
  const bfDir = 'C:\\Program Files\\Blender Foundation';
  if (fs.existsSync(bfDir)) {
    try {
      const subs = fs.readdirSync(bfDir);
      for (const sub of subs) {
        const vMatch = sub.match(/\d+\.\d+/);
        if (vMatch) {
          const py = path.join(bfDir, sub, vMatch[0], 'python', 'bin', 'python.exe');
          if (fs.existsSync(py)) return py;
        }
      }
    } catch {
      // ignore
    }
  }

  // 4. Fallback system python
  const py315 = 'C:\\Users\\Zoran\\AppData\\Local\\Python\\pythoncore-3.15-64\\python.exe';
  if (fs.existsSync(py315)) return py315;

  return 'python';
}

/**
 * Check live Blender & 3D Studio environment state
 */
export function getBlenderStatus(): BlenderStatus {
  const blenderExe = findBlenderExecutable();
  const pythonBin = findBlenderPython();
  const installed = Boolean(blenderExe && fs.existsSync(blenderExe));

  let version = 'Not Detected';
  if (installed) {
    if (blenderExe.includes('4.2')) version = 'Blender 4.2';
    else if (blenderExe.includes('5.3')) version = 'Blender 5.3';
    else if (blenderExe.includes('3.6')) version = 'Blender 3.6';
    else version = 'Blender 3.6+';
  }

  let projectsCount = 0;
  if (fs.existsSync(PROJECTS_DIR)) {
    try {
      projectsCount = fs.readdirSync(PROJECTS_DIR).filter(d => {
        return fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory();
      }).length;
    } catch {
      projectsCount = 0;
    }
  }

  return {
    installed,
    version,
    executable: blenderExe,
    python: pythonBin,
    ollamaConnected: _cachedOllamaConnected,
    projectsCount
  };
}

/**
 * Check live environment state with asynchronous Ollama probe
 */
export async function getBlenderStatusAsync(): Promise<BlenderStatus> {
  const base = getBlenderStatus();
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(1200) });
    if (res.ok) {
      _cachedOllamaConnected = true;
      base.ollamaConnected = true;
    } else {
      _cachedOllamaConnected = false;
      base.ollamaConnected = false;
    }
  } catch {
    _cachedOllamaConnected = false;
    base.ollamaConnected = false;
  }
  return base;
}

/**
 * List all saved 3D Studio projects with metadata
 */
export function listBlenderProjects(): BlenderProjectItem[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  const projects: BlenderProjectItem[] = [];
  try {
    const dirs = fs.readdirSync(PROJECTS_DIR);
    for (const d of dirs) {
      const pDir = path.join(PROJECTS_DIR, d);
      if (!fs.statSync(pDir).isDirectory()) continue;

      const metaPath = path.join(pDir, 'metadata.json');
      const hasBlend = fs.existsSync(path.join(pDir, 'model.blend'));
      const hasPreview = fs.existsSync(path.join(pDir, 'preview.png'));

      let prompt = d;
      let model = 'Blender Engine';
      let createdAt = new Date().toISOString();
      let updatedAt: string | undefined;
      let components: string[] = [];
      let totalObjects = 0;
      let isDiagram = false;

      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          prompt = meta.prompt || prompt;
          model = meta.model || model;
          createdAt = meta.created_at || createdAt;
          updatedAt = meta.updated_at;
          components = meta.components || [];
          totalObjects = meta.stats?.total_objects || meta.scene_state?.object_count || components.length || 0;
          isDiagram = Boolean(meta.plan?.is_diagram || meta.plan?.category === 'DIAGRAM' || /p&id|pid|diagram|piping/i.test(prompt));
        } catch {
          // ignore
        }
      }

      projects.push({
        project_id: d,
        prompt,
        model,
        created_at: createdAt,
        updated_at: updatedAt,
        has_blend: hasBlend,
        has_preview: hasPreview,
        preview_url: hasPreview ? `/api/blender/projects/${d}/preview` : null,
        blend_url: hasBlend ? `/api/blender/projects/${d}/blend` : null,
        components,
        total_objects: totalObjects,
        is_diagram: isDiagram
      });
    }
  } catch {
    // ignore
  }

  // Sort latest first
  projects.sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at));
  return projects;
}

/**
 * Retrieve comprehensive details, scene state, and plan for a project
 */
export function getBlenderProject(projectId: string): BlenderProjectDetail | null {
  const pDir = path.join(PROJECTS_DIR, projectId);
  if (!fs.existsSync(pDir)) return null;

  const metaPath = path.join(pDir, 'metadata.json');
  const statePath = path.join(pDir, 'scene_state.json');
  const hasBlend = fs.existsSync(path.join(pDir, 'model.blend'));
  const hasPreview = fs.existsSync(path.join(pDir, 'preview.png'));

  let meta: any = {};
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      meta = {};
    }
  }

  let sceneState: any = meta.scene_state;
  if (!sceneState && fs.existsSync(statePath)) {
    try {
      sceneState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch {
      sceneState = null;
    }
  }

  const prompt = meta.prompt || projectId;
  const isDiagram = Boolean(meta.plan?.is_diagram || meta.plan?.category === 'DIAGRAM' || /p&id|pid|diagram|piping/i.test(prompt));

  return {
    project_id: projectId,
    prompt,
    model: meta.model || 'Blender Engine',
    created_at: meta.created_at || new Date().toISOString(),
    updated_at: meta.updated_at,
    has_blend: hasBlend,
    has_preview: hasPreview,
    preview_url: hasPreview ? `/api/blender/projects/${projectId}/preview` : null,
    blend_url: hasBlend ? `/api/blender/projects/${projectId}/blend` : null,
    components: meta.components || [],
    total_objects: meta.stats?.total_objects || sceneState?.object_count || meta.components?.length || 0,
    is_diagram: isDiagram,
    plan: meta.plan,
    scene_state: sceneState,
    stats: meta.stats
  };
}

/**
 * Get filesystem path to rendered preview PNG
 */
export function getProjectPreviewPath(projectId: string): string | null {
  const imgPath = path.join(PROJECTS_DIR, projectId, 'preview.png');
  return fs.existsSync(imgPath) ? imgPath : null;
}

/**
 * Get filesystem path to generated .blend file
 */
export function getProjectBlendPath(projectId: string): string | null {
  const blendPath = path.join(PROJECTS_DIR, projectId, 'model.blend');
  return fs.existsSync(blendPath) ? blendPath : null;
}

/**
 * Open project visibly in local Blender application
 */
export function openInBlenderGui(projectId: string): { success: boolean; message: string } {
  const blenderExe = findBlenderExecutable();
  if (!blenderExe || !fs.existsSync(blenderExe)) {
    return { success: false, message: 'Blender executable not found on system.' };
  }

  const blendPath = getProjectBlendPath(projectId);
  try {
    const args = blendPath ? [blendPath] : [];
    const child = spawn(blenderExe, args, {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return { success: true, message: `Opened ${blendPath ? projectId : 'empty Blender'} in Blender GUI.` };
  } catch (err: any) {
    return { success: false, message: `Failed to launch Blender GUI: ${err.message}` };
  }
}

/**
 * Permanently delete a project folder and its cached outputs
 */
export function deleteBlenderProject(projectId: string): boolean {
  const pDir = path.join(PROJECTS_DIR, projectId);
  if (fs.existsSync(pDir)) {
    try {
      fs.rmSync(pDir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Inspect live scene state, hierarchy, and bounding boxes
 */
export function inspectBlenderScene(projectId: string): any {
  const project = getBlenderProject(projectId);
  if (!project) return { success: false, error: 'Project not found' };
  return {
    success: true,
    project_id: projectId,
    total_objects: project.total_objects,
    components: project.components,
    scene_state: project.scene_state,
    plan: project.plan
  };
}

/**
 * Submit an asynchronous 3D generation or plan execution job
 */
export function submitBlenderTask(params: {
  prompt?: string;
  plan?: any;
  projectId?: string;
  isModification?: boolean;
  clearScene?: boolean;
  renderPreview?: boolean;
}): { taskId: string; projectId: string; task: BlenderTaskState } {
  const now = Date.now();
  const taskId = `task_${now}`;
  const projectId = params.projectId || `prj_${now}`;
  const prompt = params.prompt || params.plan?.project_name || 'AI Modeling Task';

  const task: BlenderTaskState = {
    task_id: taskId,
    project_id: projectId,
    prompt,
    status: 'QUEUED',
    progress: 10,
    logs: [
      `[${new Date().toLocaleTimeString()}] Task queued for project: ${projectId}`,
      `[${new Date().toLocaleTimeString()}] Prompt: "${prompt}"`
    ],
    started_at: new Date().toISOString()
  };

  ACTIVE_TASKS.set(taskId, task);

  // Run asynchronously
  setImmediate(() => {
    runBlenderTaskAsync(taskId, params).catch(err => {
      task.status = 'FAILED';
      task.progress = 100;
      task.error = err.message;
      task.logs.push(`[${new Date().toLocaleTimeString()}] Error: ${err.message}`);
      task.completed_at = new Date().toISOString();
    });
  });

  return { taskId, projectId, task };
}

/**
 * Asynchronous worker executing blender_skill.py
 */
async function runBlenderTaskAsync(taskId: string, params: {
  prompt?: string;
  plan?: any;
  projectId?: string;
  isModification?: boolean;
  clearScene?: boolean;
  renderPreview?: boolean;
}) {
  const task = ACTIVE_TASKS.get(taskId);
  if (!task) return;

  const pythonBin = findBlenderPython();
  const blenderExe = findBlenderExecutable();

  if (!blenderExe || !fs.existsSync(blenderExe)) {
    throw new Error('Blender executable not found on system. Please ensure Blender 3.6+ is installed.');
  }

  task.status = 'RUNNING';
  task.progress = 25;
  task.logs.push(`[${new Date().toLocaleTimeString()}] Initializing Blender runtime...`);
  task.logs.push(`[${new Date().toLocaleTimeString()}] Runtime executable: ${blenderExe}`);

  const args: string[] = [BLENDER_SKILL_SCRIPT];

  if (params.plan) {
    task.logs.push(`[${new Date().toLocaleTimeString()}] Preparing structured modeling plan...`);
    const planFile = path.join(TASKS_DIR, `${taskId}_plan.json`);
    const normalizedPlan = { ...params.plan };
    if (params.clearScene !== undefined) {
      normalizedPlan.clear_scene = params.clearScene;
    }
    fs.writeFileSync(planFile, JSON.stringify(normalizedPlan, null, 2), 'utf8');
    args.push('execute-plan');
    args.push('--project-id', task.project_id);
    args.push('--plan-file', planFile);
  } else {
    task.logs.push(`[${new Date().toLocaleTimeString()}] Generating scene from prompt via planner...`);
    args.push('generate');
    const safePrompt = task.prompt.replace(/"/g, "'");
    args.push('--prompt', safePrompt);
    args.push('--project-id', task.project_id);

    if (params.isModification) {
      args.push('--is-modification');
      task.logs.push(`[${new Date().toLocaleTimeString()}] Mode: Incremental Scene Modification`);
    }

    // If prompt is a diagram request, use the ISA-5.1 diagram engine deterministically
    const isDiagram = /p&id|pid|diagram|schematic|piping\s*(?:and|&)\s*instrumentation/i.test(task.prompt);
    if (isDiagram) {
      args.push('--no-ollama');
      task.logs.push(`[${new Date().toLocaleTimeString()}] Mode: ISA-5.1 P&ID Technical Diagram Engine`);
    } else {
      const status = await getBlenderStatusAsync();
      if (!status.ollamaConnected) {
        args.push('--no-ollama');
        task.logs.push(`[${new Date().toLocaleTimeString()}] Mode: Procedural Parametric 3D Engine (Offline / Blueprint)`);
      } else {
        args.push('--model', 'qwen2.5:3b');
        task.logs.push(`[${new Date().toLocaleTimeString()}] Mode: Local AI Modeling Planner (Ollama qwen2.5:3b)`);
      }
    }
  }

  if (params.renderPreview !== false) {
    // Default renders preview
  } else {
    args.push('--no-render');
  }

  task.progress = 45;
  task.logs.push(`[${new Date().toLocaleTimeString()}] Spawning background Blender worker...`);

  return new Promise<void>((resolve, reject) => {
    const child = spawn(pythonBin, args, {
      cwd: PRJ_ROOT,
      env: {
        ...process.env,
        BLENDER_EXE: blenderExe,
        PYTHONUNBUFFERED: '1'
      }
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', chunk => {
      const txt = chunk.toString();
      stdoutData += txt;
      const lines = txt.split('\n').filter((l: string) => l.trim().length > 0);
      for (const line of lines) {
        if (!line.startsWith('{') && !line.startsWith('}') && line.length < 200) {
          task.logs.push(`[Blender] ${line.trim()}`);
        }
      }
      task.progress = Math.min(85, task.progress + 5);
    });

    child.stderr.on('data', chunk => {
      stderrData += chunk.toString();
    });

    child.on('close', code => {
      task.progress = 100;
      task.completed_at = new Date().toISOString();

      if (code === 0) {
        try {
          const parsed = JSON.parse(stdoutData.trim());
          task.result = parsed;
          task.status = 'COMPLETED';
          task.logs.push(`[${new Date().toLocaleTimeString()}] Successfully completed scene build.`);
          task.logs.push(`[${new Date().toLocaleTimeString()}] Generated: ${parsed.blend_path || 'model.blend'}`);
          if (parsed.render_path) {
            task.logs.push(`[${new Date().toLocaleTimeString()}] Rendered preview: ${parsed.render_path}`);
          }
          resolve();
        } catch {
          // If stdout had preamble before JSON, extract JSON block
          const jsonMatch = stdoutData.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              task.result = parsed;
              task.status = 'COMPLETED';
              task.logs.push(`[${new Date().toLocaleTimeString()}] Scene generated successfully.`);
              resolve();
              return;
            } catch {
              // ignore
            }
          }
          task.status = 'COMPLETED';
          resolve();
        }
      } else {
        task.status = 'FAILED';
        task.error = `Blender exited with code ${code}. ${stderrData.slice(-400)}`;
        task.logs.push(`[${new Date().toLocaleTimeString()}] Blender failure (code ${code})`);
        reject(new Error(task.error));
      }
    });

    child.on('error', err => {
      task.status = 'FAILED';
      task.error = err.message;
      reject(err);
    });
  });
}

/**
 * Retrieve current state and logs of a background task
 */
export function getTaskState(taskId: string): BlenderTaskState | null {
  return ACTIVE_TASKS.get(taskId) || null;
}

/**
 * Handle HTTP API requests under /api/blender/*
 */
export function handleBlenderApiRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const rawUrl = req.url || '';
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const pathname = parsedUrl.pathname;

  if (!pathname.startsWith('/api/blender')) {
    return false;
  }

  // Helper for JSON responses
  const sendJson = (data: any, statusCode: number = 200) => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end(JSON.stringify(data));
  };

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
    return true;
  }

  // 1. GET /api/blender/status
  if (pathname === '/api/blender/status' && req.method === 'GET') {
    getBlenderStatusAsync()
      .then(st => sendJson(st))
      .catch(() => sendJson(getBlenderStatus()));
    return true;
  }

  // 2. GET /api/blender/projects
  if (pathname === '/api/blender/projects' && req.method === 'GET') {
    const projects = listBlenderProjects();
    sendJson({ projects });
    return true;
  }

  // 3. GET /api/blender/projects/:id/preview
  const previewMatch = pathname.match(/^\/api\/blender\/projects\/([^/]+)\/preview$/);
  if (previewMatch && req.method === 'GET') {
    const projectId = decodeURIComponent(previewMatch[1]);
    const imgPath = getProjectPreviewPath(projectId);
    if (!imgPath) {
      sendJson({ error: 'Preview image not found.' }, 404);
      return true;
    }
    try {
      const imgBuffer = fs.readFileSync(imgPath);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.end(imgBuffer);
    } catch (err: any) {
      sendJson({ error: err.message }, 500);
    }
    return true;
  }

  // 3b. GET /api/blender/projects/:id/inspect
  const inspectMatch = pathname.match(/^\/api\/blender\/projects\/([^/]+)\/inspect$/);
  if (inspectMatch && req.method === 'GET') {
    const projectId = decodeURIComponent(inspectMatch[1]);
    const result = inspectBlenderScene(projectId);
    sendJson(result, result.success ? 200 : 404);
    return true;
  }

  // 3c. DELETE /api/blender/projects/:id
  const deleteMatch = pathname.match(/^\/api\/blender\/projects\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const projectId = decodeURIComponent(deleteMatch[1]);
    const success = deleteBlenderProject(projectId);
    sendJson({ success, project_id: projectId });
    return true;
  }

  // 4. GET /api/blender/projects/:id/blend
  const blendMatch = pathname.match(/^\/api\/blender\/projects\/([^/]+)\/blend$/);
  if (blendMatch && req.method === 'GET') {
    const projectId = decodeURIComponent(blendMatch[1]);
    const blendPath = getProjectBlendPath(projectId);
    if (!blendPath) {
      sendJson({ error: 'Blend file not found.' }, 404);
      return true;
    }
    try {
      const blendBuffer = fs.readFileSync(blendPath);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/x-blender');
      res.setHeader('Content-Disposition', `attachment; filename="${projectId}.blend"`);
      res.end(blendBuffer);
    } catch (err: any) {
      sendJson({ error: err.message }, 500);
    }
    return true;
  }

  // 5. POST /api/blender/projects/:id/open
  const openMatch = pathname.match(/^\/api\/blender\/projects\/([^/]+)\/open$/);
  if (openMatch && req.method === 'POST') {
    const projectId = decodeURIComponent(openMatch[1]);
    const result = openInBlenderGui(projectId);
    sendJson(result, result.success ? 200 : 400);
    return true;
  }

  // 6. GET /api/blender/projects/:id
  const projectMatch = pathname.match(/^\/api\/blender\/projects\/([^/]+)$/);
  if (projectMatch && req.method === 'GET') {
    const projectId = decodeURIComponent(projectMatch[1]);
    const project = getBlenderProject(projectId);
    if (!project) {
      sendJson({ error: 'Project not found.' }, 404);
      return true;
    }
    sendJson(project);
    return true;
  }

  // 7. POST /api/blender/generate (natural language prompt)
  if (pathname === '/api/blender/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!payload.prompt || !payload.prompt.trim()) {
          sendJson({ error: 'Prompt is required.' }, 400);
          return;
        }

        const taskInfo = submitBlenderTask({
          prompt: payload.prompt.trim(),
          projectId: payload.projectId || payload.project_id,
          isModification: Boolean(payload.isModification || payload.is_modification),
          renderPreview: payload.renderPreview !== false
        });

        sendJson({
          success: true,
          task_id: taskInfo.taskId,
          project_id: taskInfo.projectId,
          status: 'QUEUED'
        });
      } catch (err: any) {
        sendJson({ error: err.message }, 400);
      }
    });
    return true;
  }

  // 8. POST /api/blender/execute-plan (structured plan execution)
  if (pathname === '/api/blender/execute-plan' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!payload.plan) {
          sendJson({ error: 'Plan is required.' }, 400);
          return;
        }

        const taskInfo = submitBlenderTask({
          plan: payload.plan,
          projectId: payload.projectId || payload.project_id,
          clearScene: payload.clearScene ?? payload.clear_scene,
          isModification: Boolean(payload.isModification || payload.is_modification),
          renderPreview: payload.renderPreview !== false
        });

        sendJson({
          success: true,
          task_id: taskInfo.taskId,
          project_id: taskInfo.projectId,
          status: 'QUEUED'
        });
      } catch (err: any) {
        sendJson({ error: err.message }, 400);
      }
    });
    return true;
  }

  // 9. GET /api/blender/tasks/:taskId
  const taskMatch = pathname.match(/^\/api\/blender\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === 'GET') {
    const taskId = decodeURIComponent(taskMatch[1]);
    const task = getTaskState(taskId);
    if (!task) {
      sendJson({ error: 'Task not found.' }, 404);
      return true;
    }
    sendJson(task);
    return true;
  }

  return false;
}
