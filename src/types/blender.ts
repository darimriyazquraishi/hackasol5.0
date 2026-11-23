/**
 * Types for LUMI 3D Studio & Blender Workspace
 */

export interface BlenderStatus {
  installed: boolean;
  version: string;
  executable: string;
  python: string;
  ollamaConnected: boolean;
  projectsCount: number;
}

export interface BlenderProjectSummary {
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

export interface BlenderSceneObject {
  id?: string;
  name: string;
  type?: string;
  group_name?: string;
  is_root?: boolean;
  parent?: string | null;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  dimensions?: [number, number, number];
  bounding_box?: {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
    size: [number, number, number];
  };
  material?: {
    name: string;
    color?: [number, number, number, number];
    metallic?: number;
    roughness?: number;
  };
  collection?: string;
}

export interface BlenderSceneState {
  object_count: number;
  objects: BlenderSceneObject[];
}

export interface BlenderProjectDetail extends BlenderProjectSummary {
  plan?: any;
  scene_state?: BlenderSceneState;
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

export type BlenderViewportMode = 'rendered' | 'wireframe' | 'scene_tree' | 'plan';
