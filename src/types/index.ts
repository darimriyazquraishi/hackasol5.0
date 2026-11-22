export type NodeType = 'file' | 'folder';

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: NodeType;
  content?: string;
  children?: FileNode[];
  isOpen?: boolean;
  language?: string;
  isDirty?: boolean;
  handle?: any; // Native FileSystemHandle if loaded from disk
  isNative?: boolean;
}

export interface Tab {
  id: string;
  name: string;
  path: string;
  content?: string;
  isDirty?: boolean;
  language?: string;
}

export type ActivityBarTab = 'explorer' | 'search' | 'git' | 'debug' | 'extensions';

export type BottomPanelTab = 'problems' | 'output' | 'terminal' | 'debug-console';

export type EditorTheme = 'dark-modern' | 'vscode-dark' | 'monokai' | 'light-plus' | 'high-contrast';

export interface GitCommit {
  id: string;
  message: string;
  date: string;
  author: string;
  files: string[];
}

export interface GitState {
  branch: string;
  modifiedFiles: string[];
  stagedFiles: string[];
  commits: GitCommit[];
}

export interface ExtensionItem {
  id: string;
  name: string;
  displayName: string;
  publisher: string;
  description: string;
  version: string;
  downloads: string;
  rating: number;
  icon: string;
  installed: boolean;
  category: string;
}

export interface ProblemItem {
  id: string;
  file: string;
  line: number;
  col: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  source: string;
}

export interface AssistantToolCall {
  id: string;
  tool: string;
  summary: string;
  status: 'running' | 'completed' | 'error';
  command?: string;
  output?: string;
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: string;
  content: string;
  thoughts?: string;
  thoughtDuration?: string;
  toolCalls?: AssistantToolCall[];
}

// Navigation Modules
export type LumiModule = 'chat' | 'ide' | 'settings' | 'dashboard' | 'knowledge' | 'models' | 'workflows' | 'documents' | 'audio';

// Settings Categories and Subsections
export type SettingsCategory = 'workbench' | 'hardware' | 'security' | 'system';

export type SettingsSubSection =
  // AI Workbench
  | 'model-manager'
  | 'model-config'
  | 'agent-management'
  | 'routing'
  | 'rag-kb'
  | 'embeddings'
  | 'system-prompts'
  // Hardware & Performance
  | 'hardware-detection'
  | 'gpu-cpu'
  | 'ram-vram'
  | 'model-memory'
  | 'hardware-profiles'
  | 'optimization'
  // Security & Privacy
  | 'local-mode'
  | 'air-gapped'
  | 'network-policies'
  | 'metadata-sanitization'
  | 'sandbox'
  | 'data-retention'
  // System
  | 'system-health'
  | 'dependencies'
  | 'logs'
  | 'diagnostics'
  | 'storage'
  | 'updates';

export interface ModelItem {
  id: string;
  name: string;
  family: string;
  parameterSize: string;
  quantization: string;
  status: 'loaded' | 'unloaded' | 'running';
  vramRequired: string;
  vramUsed?: string;
  contextWindow: string;
  tps?: number;
}

export interface KnowledgeCollection {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  chunkCount: number;
  embeddingModel: string;
  lastUpdated: string;
  size: string;
}

export interface WorkflowNode {
  id: string;
  name: string;
  type: 'agent' | 'retrieval' | 'llm' | 'evaluator' | 'tool';
  status: 'idle' | 'running' | 'completed' | 'failed';
  inputs: string[];
  outputs: string[];
  description: string;
}

export interface SystemMetrics {
  gpuUtilization: number;
  vramAllocated: number;
  vramTotal: number;
  cpuUtilization: number;
  ramUsed: number;
  ramTotal: number;
  tokensPerSec: number;
  gpuName?: string;
  cpuName?: string;
  hardwareTier?: string;
}

// Chat First Types
export interface ChatAttachment {
  id: string;
  name: string;
  size: string;
  type: string; // pdf, docx, pptx, xlsx, csv, txt, image
  data?: string;
}

export interface AgentExecutionStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: string;
}

export interface WorkplanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface WorkplanApproval {
  id: string;
  title: string;
  description: string;
  steps: WorkplanStep[];
  status: 'pending' | 'approved' | 'rejected' | 'modified';
}

export interface GeneratedFilePreview {
  id: string;
  name: string;
  size: string;
  type: string;
  content: string;
  description?: string;
}

export interface ChatSourceCitation {
  id: string;
  collection: string;
  file: string;
  section: string;
  score: number;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  content: string;
  model?: string;
  agent?: string;
  tokens?: number;
  attachments?: ChatAttachment[];
  executionStages?: AgentExecutionStage[];
  workplan?: WorkplanApproval;
  generatedFiles?: GeneratedFilePreview[];
  citations?: ChatSourceCitation[];
  codeBlock?: {
    language: string;
    code: string;
  };
}

export interface ConversationThread {
  id: string;
  title: string;
  lastUpdated: string;
  messages: ChatMessage[];
}
