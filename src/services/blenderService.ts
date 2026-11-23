/**
 * Frontend Service for LUMI 3D Studio & Blender Automation
 */

import {
  BlenderStatus,
  BlenderProjectSummary,
  BlenderProjectDetail,
  BlenderTaskState
} from '../types/blender';

const API_BASE = '/api/blender';

export async function fetchBlenderStatus(): Promise<BlenderStatus> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error(`Failed to fetch Blender status: ${res.statusText}`);
  return await res.json();
}

export async function fetchBlenderProjects(): Promise<BlenderProjectSummary[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.statusText}`);
  const data = await res.json();
  return data.projects || [];
}

export async function fetchBlenderProject(projectId: string): Promise<BlenderProjectDetail> {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}`);
  if (!res.ok) throw new Error(`Failed to fetch project ${projectId}: ${res.statusText}`);
  return await res.json();
}

export async function openInBlenderApp(projectId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/open`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.detail || 'Could not open Blender.');
  }
  return await res.json();
}

export async function submitGenerateRequest(params: {
  prompt: string;
  projectId?: string;
  isModification?: boolean;
  renderPreview?: boolean;
}): Promise<{ success: boolean; task_id: string; project_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || 'Generation request failed.');
  }
  return await res.json();
}

export async function submitExecutePlanRequest(params: {
  plan: any;
  projectId?: string;
  clearScene?: boolean;
  isModification?: boolean;
  renderPreview?: boolean;
}): Promise<{ success: boolean; task_id: string; project_id: string; status: string }> {
  const res = await fetch(`${API_BASE}/execute-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || 'Plan execution failed.');
  }
  return await res.json();
}

export async function fetchTaskStatus(taskId: string): Promise<BlenderTaskState> {
  const res = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}`);
  if (!res.ok) throw new Error(`Failed to fetch task: ${res.statusText}`);
  return await res.json();
}

export async function deleteBlenderProjectApi(projectId: string): Promise<{ success: boolean; project_id: string }> {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`Failed to delete project: ${res.statusText}`);
  return await res.json();
}

export async function inspectBlenderSceneApi(projectId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/inspect`);
  if (!res.ok) throw new Error(`Failed to inspect scene: ${res.statusText}`);
  return await res.json();
}
