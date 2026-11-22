import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  FileNode,
  Tab,
  ActivityBarTab,
  BottomPanelTab,
  EditorTheme,
  GitState,
  ExtensionItem,
  ProblemItem,
  LumiModule,
  SettingsCategory,
  SettingsSubSection,
  ModelItem,
  KnowledgeCollection,
  WorkflowNode,
  SystemMetrics,
  ChatMessage,
  ConversationThread,
  ChatAttachment,
  WorkplanApproval
} from '../types';
import {
  HardwareProfile,
  detectSystemHardware,
  DEFAULT_HARDWARE_PROFILE
} from '../services/hardwareDetector';
import { defaultWorkspaceFiles, detectLanguage } from '../services/defaultFiles';
import {
  findNodeByPath,
  addNode,
  renameNode as renameNodeHelper,
  deleteNode as deleteNodeHelper,
  updateFileContent as updateContentHelper,
  toggleFolder as toggleFolderHelper,
  openNativeDirectory,
  saveNativeFile,
  exportWorkspaceAsZip,
  downloadFile
} from '../services/fileSystem';

interface WorkspaceContextType {
  files: FileNode[];
  workspaceName: string;
  isNative: boolean;
  tabs: Tab[];
  activeTabId: string | null;
  activeFile: FileNode | null;
  activeBarTab: ActivityBarTab;
  setActiveBarTab: (tab: ActivityBarTab) => void;
  sidebarVisible: boolean;
  setSidebarVisible: (v: boolean) => void;
  toggleSidebar: () => void;
  panelVisible: boolean;
  setPanelVisible: (v: boolean) => void;
  togglePanel: () => void;
  panelTab: BottomPanelTab;
  setPanelTab: (tab: BottomPanelTab) => void;
  assistantVisible: boolean;
  setAssistantVisible: (v: boolean) => void;
  toggleAssistant: () => void;
  theme: EditorTheme;
  setTheme: (theme: EditorTheme) => void;

  // LUMI Navigation & Modules
  activeModule: LumiModule;
  setActiveModule: (module: LumiModule) => void;
  leftNavCollapsed: boolean;
  setLeftNavCollapsed: (v: boolean) => void;
  toggleLeftNav: () => void;
  rightContextOpen: boolean;
  setRightContextOpen: (v: boolean) => void;
  toggleRightContext: () => void;

  // Settings Sub-routing
  settingsCategory: SettingsCategory;
  setSettingsCategory: (cat: SettingsCategory) => void;
  settingsSubSection: SettingsSubSection;
  setSettingsSubSection: (sub: SettingsSubSection) => void;
  navigateToSettings: (cat?: SettingsCategory, sub?: SettingsSubSection) => void;

  // Telemetry & Hardware Models
  hardwareProfile: HardwareProfile;
  refreshHardware: () => Promise<void>;
  models: ModelItem[];
  loadModel: (id: string) => void;
  unloadModel: (id: string) => void;
  knowledgeCollections: KnowledgeCollection[];
  workflowNodes: WorkflowNode[];
  systemMetrics: SystemMetrics;

  // Conversation Threads & Chat-First Orchestration
  conversations: ConversationThread[];
  activeConversationId: string;
  activeConversation: ConversationThread | undefined;
  createConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, newTitle: string) => void;
  addMessageToActiveConversation: (msg: ChatMessage) => void;
  updateWorkplanStatus: (stepId: string, status: 'approved' | 'rejected' | 'modified') => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  commandPaletteMode: 'command' | 'file';
  setCommandPaletteMode: (mode: 'command' | 'file') => void;
  cursorPos: { line: number; col: number };
  setCursorPos: (pos: { line: number; col: number }) => void;
  gitState: GitState;
  extensions: ExtensionItem[];
  problems: ProblemItem[];

  // File Operations
  openFile: (path: string) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  saveCurrentFile: () => Promise<void>;
  updateFileContent: (path: string, content: string) => void;
  createFile: (parentPath: string | null, name: string, content?: string) => void;
  createFolder: (parentPath: string | null, name: string) => void;
  renameItem: (path: string, newName: string) => void;
  deleteItem: (path: string) => void;
  toggleFolder: (path: string) => void;
  openFolderFromDisk: () => Promise<void>;
  exportProjectZip: () => Promise<void>;
  downloadFileItem: (path: string) => void;

  // Git Operations
  stageFile: (path: string) => void;
  unstageFile: (path: string) => void;
  commitChanges: (message: string) => void;

  // Extension Operations
  toggleExtension: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

const DEFAULT_EXTENSIONS: ExtensionItem[] = [
  {
    id: 'esbenp.prettier-vscode',
    name: 'prettier-vscode',
    displayName: 'Prettier - Code formatter',
    publisher: 'Prettier',
    description: 'Code formatter using prettier for JS, TS, CSS, HTML, and more.',
    version: '10.4.1',
    downloads: '45.2M',
    rating: 4.8,
    icon: '✨',
    installed: true,
    category: 'Formatters'
  },
  {
    id: 'dbaeumer.vscode-eslint',
    name: 'vscode-eslint',
    displayName: 'ESLint',
    publisher: 'Microsoft',
    description: 'Integrates ESLint JavaScript into VS Code.',
    version: '3.0.10',
    downloads: '38.1M',
    rating: 4.7,
    icon: '🔍',
    installed: true,
    category: 'Linters'
  },
  {
    id: 'github.copilot',
    name: 'copilot',
    displayName: 'GitHub Copilot',
    publisher: 'GitHub',
    description: 'Your AI pair programmer directly in your editor.',
    version: '1.240.0',
    downloads: '21.5M',
    rating: 4.9,
    icon: '🤖',
    installed: true,
    category: 'AI'
  },
  {
    id: 'bradlc.vscode-tailwindcss',
    name: 'vscode-tailwindcss',
    displayName: 'Tailwind CSS IntelliSense',
    publisher: 'Tailwind Labs',
    description: 'Intelligent Tailwind CSS tooling for VS Code.',
    version: '0.12.7',
    downloads: '18.9M',
    rating: 4.9,
    icon: '🎨',
    installed: false,
    category: 'Other'
  },
  {
    id: 'ms-python.python',
    name: 'python',
    displayName: 'Python',
    publisher: 'Microsoft',
    description: 'IntelliSense, linting, debugging for Python.',
    version: '2024.18.0',
    downloads: '125M',
    rating: 4.6,
    icon: '🐍',
    installed: false,
    category: 'Programming Languages'
  },
  {
    id: 'eamodio.gitlens',
    name: 'gitlens',
    displayName: 'GitLens — Git supercharged',
    publisher: 'GitKraken',
    description: 'Supercharge Git within VS Code — Visualize code authorship at a glance.',
    version: '15.7.0',
    downloads: '34.2M',
    rating: 4.8,
    icon: '🔍',
    installed: true,
    category: 'SCM Providers'
  }
];

const INITIAL_PROBLEMS: ProblemItem[] = [
  {
    id: 'p-1',
    file: '/src/App.tsx',
    line: 14,
    col: 7,
    message: 'Fast Refresh had to perform a full reload due to state re-initialization.',
    severity: 'info',
    source: 'eslint'
  },
  {
    id: 'p-2',
    file: '/src/utils/math.ts',
    line: 19,
    col: 1,
    message: 'Unexpected console statement. (no-console)',
    severity: 'warning',
    source: 'eslint'
  }
];

const INITIAL_CONVERSATIONS: ConversationThread[] = [
  {
    id: 'conv-1',
    title: 'New Conversation',
    lastUpdated: 'Just now',
    messages: []
  }
];

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Try to load persisted files from localStorage if available
  const [files, setFiles] = useState<FileNode[]>(() => {
    try {
      const saved = localStorage.getItem('vscode_clone_files');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not load files from localStorage', e);
    }
    return defaultWorkspaceFiles;
  });

  const [workspaceName, setWorkspaceName] = useState<string>('vscode-web-workspace');
  const [isNative, setIsNative] = useState<boolean>(false);
  const [rootNativeHandle, setRootNativeHandle] = useState<any>(null);

  // Tabs for IDE
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: 'file-app',
      name: 'App.tsx',
      path: '/src/App.tsx',
      language: 'typescript',
      isDirty: false
    },
    {
      id: 'file-readme',
      name: 'README.md',
      path: '/README.md',
      language: 'markdown',
      isDirty: false
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>('file-app');

  // URL Hash Synchronisation for Refresh Resilience (Requirement 12)
  const parseHash = (): { module: LumiModule; cat: SettingsCategory; sub: SettingsSubSection } => {
    try {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash === 'ide') {
        return { module: 'ide', cat: 'workbench', sub: 'model-manager' };
      }
      if (hash.startsWith('settings')) {
        const parts = hash.split('/');
        const cat = (parts[1] as SettingsCategory) || 'workbench';
        const sub = (parts[2] as SettingsSubSection) || 'model-manager';
        return { module: 'settings', cat, sub };
      }
    } catch (e) {
      // fallback
    }
    return { module: 'chat', cat: 'workbench', sub: 'model-manager' };
  };

  const initialHash = parseHash();

  // Primary Landing Page is explicitly 'chat' (Requirement 1)
  const [activeModule, setActiveModuleState] = useState<LumiModule>(initialHash.module || 'chat');
  const [settingsCategory, setSettingsCategoryState] = useState<SettingsCategory>(initialHash.cat || 'workbench');
  const [settingsSubSection, setSettingsSubSectionState] = useState<SettingsSubSection>(initialHash.sub || 'model-manager');

  // Listen to hashchange events for browser history and direct navigation
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHash();
      setActiveModuleState(parsed.module);
      setSettingsCategoryState(parsed.cat);
      setSettingsSubSectionState(parsed.sub);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [leftNavCollapsed, setLeftNavCollapsed] = useState<boolean>(false);
  const [rightContextOpen, setRightContextOpen] = useState<boolean>(false);
  const [activeBarTab, setActiveBarTab] = useState<ActivityBarTab>('explorer');
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(true);
  const [panelVisible, setPanelVisible] = useState<boolean>(false);
  const [panelTab, setPanelTab] = useState<BottomPanelTab>('terminal');
  const [assistantVisible, setAssistantVisible] = useState<boolean>(true);
  const [theme, setTheme] = useState<EditorTheme>('dark-modern');

  // Synchronize hash on module / settings change
  const setActiveModule = useCallback((mod: LumiModule) => {
    setActiveModuleState(mod);
    if (mod === 'chat') {
      window.location.hash = 'chat';
    } else if (mod === 'ide') {
      window.location.hash = 'ide';
    } else if (mod === 'settings') {
      window.location.hash = `settings/${settingsCategory}/${settingsSubSection}`;
    }
  }, [settingsCategory, settingsSubSection]);

  const setSettingsCategory = useCallback((cat: SettingsCategory) => {
    setSettingsCategoryState(cat);
    // select first subsection of this category
    const defaultSub: Record<SettingsCategory, SettingsSubSection> = {
      workbench: 'model-manager',
      hardware: 'hardware-detection',
      security: 'local-mode',
      system: 'system-health'
    };
    const sub = defaultSub[cat];
    setSettingsSubSectionState(sub);
    window.location.hash = `settings/${cat}/${sub}`;
  }, []);

  const setSettingsSubSection = useCallback((sub: SettingsSubSection) => {
    setSettingsSubSectionState(sub);
    window.location.hash = `settings/${settingsCategory}/${sub}`;
  }, [settingsCategory]);

  const navigateToSettings = useCallback((cat?: SettingsCategory, sub?: SettingsSubSection) => {
    const targetCat = cat || 'workbench';
    const targetSub = sub || 'model-manager';
    setSettingsCategoryState(targetCat);
    setSettingsSubSectionState(targetSub);
    setActiveModuleState('settings');
    window.location.hash = `settings/${targetCat}/${targetSub}`;
  }, []);

  // Conversations State: Ensure initial launch opens to a fresh clean conversation (Requirement 1 & 3)
  const [conversations, setConversations] = useState<ConversationThread[]>(() => {
    try {
      const saved = localStorage.getItem('lumi_conversations');
      if (saved) {
        const parsed: ConversationThread[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Check if there is already a clean empty conversation at the start
          if (parsed[0].messages.length === 0) {
            return parsed;
          }
          // Otherwise prepend a fresh empty conversation so initial screen is clean Image 1
          const freshConv: ConversationThread = {
            id: `conv-${Date.now()}`,
            title: 'New Conversation',
            lastUpdated: 'Just now',
            messages: []
          };
          return [freshConv, ...parsed];
        }
      }
    } catch (e) {
      // fallback
    }
    return INITIAL_CONVERSATIONS;
  });

  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('lumi_conversations');
      if (saved) {
        const parsed: ConversationThread[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].messages.length === 0) {
          return parsed[0].id;
        }
      }
    } catch (e) {
      // ignore
    }
    return INITIAL_CONVERSATIONS[0].id;
  });

  useEffect(() => {
    try {
      localStorage.setItem('lumi_conversations', JSON.stringify(conversations));
    } catch (e) {
      // ignore
    }
  }, [conversations]);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const createConversation = useCallback(() => {
    const newId = `conv-${Date.now()}`;
    const newConv: ConversationThread = {
      id: newId,
      title: 'New Conversation',
      lastUpdated: 'Just now',
      messages: []
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newId);
    setActiveModule('chat');
  }, [setActiveModule]);

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setActiveModule('chat');
  }, [setActiveModule]);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const remaining = prev.filter(c => c.id !== id);
      if (activeConversationId === id) {
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
        } else {
          const freshId = `conv-${Date.now()}`;
          setActiveConversationId(freshId);
          return [
            {
              id: freshId,
              title: 'New Conversation',
              lastUpdated: 'Just now',
              messages: []
            }
          ];
        }
      }
      return remaining;
    });
  }, [activeConversationId]);

  const renameConversation = useCallback((id: string, newTitle: string) => {
    const clean = newTitle.trim();
    if (!clean) return;
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, title: clean } : c))
    );
  }, []);

  const addMessageToActiveConversation = useCallback((msg: ChatMessage) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id === activeConversationId) {
          const isFirstUserMessage = c.messages.length === 0 && msg.sender === 'user';
          const newTitle = isFirstUserMessage
            ? msg.content.slice(0, 36) + (msg.content.length > 36 ? '...' : '')
            : c.title;

          return {
            ...c,
            title: newTitle,
            lastUpdated: 'Just now',
            messages: [...c.messages, msg]
          };
        }
        return c;
      })
    );
  }, [activeConversationId]);

  const updateWorkplanStatus = useCallback((stepId: string, status: 'approved' | 'rejected' | 'modified') => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            messages: c.messages.map(m => {
              if (m.workplan) {
                return {
                  ...m,
                  workplan: {
                    ...m.workplan,
                    status
                  }
                };
              }
              return m;
            })
          };
        }
        return c;
      })
    );
  }, [activeConversationId]);

  // Dynamic LUMI Model Registry populated from inference runtime audit
  const [models, setModels] = useState<ModelItem[]>([]);

  // LUMI Authoritative Knowledge Collections (populated dynamically from uploaded documents)
  const [knowledgeCollections, setKnowledgeCollections] = useState<KnowledgeCollection[]>([]);

  // LUMI Authoritative Multi-Agent Workflow Pipeline Nodes
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([
    {
      id: 'node-rag',
      name: 'Vector RAG Agent',
      type: 'retrieval',
      status: 'idle',
      inputs: ['User Query', 'Document Indexes'],
      outputs: ['Verified Citations', 'Ground Truth Chunks'],
      description: 'Dense vector retrieval using nomic-embed-text over local knowledge collections.'
    },
    {
      id: 'node-vision',
      name: 'Vision Agent',
      type: 'agent',
      status: 'idle',
      inputs: ['Image Assets', 'Inspection Queries'],
      outputs: ['Extracted Text', 'Visual Finding Records'],
      description: 'Multimodal image inspection using Qwen2.5-VL 7B.'
    },
    {
      id: 'node-imagegen',
      name: 'Image Generation Agent',
      type: 'tool',
      status: 'idle',
      inputs: ['Visual Prompt', 'Aspect Bounds'],
      outputs: ['Diffusion Image File'],
      description: 'Generative image synthesis using flux1-schnell.'
    },
    {
      id: 'node-code',
      name: 'Math & Code Agent',
      type: 'tool',
      status: 'idle',
      inputs: ['Mathematical Expressions', 'Code Specifications'],
      outputs: ['Verified Code Blocks', 'Sandbox Output Logs'],
      description: 'Code synthesis and computational sandboxed execution via Qwen2.5-Coder 7B.'
    },
    {
      id: 'node-synthesis',
      name: 'Reasoning & Synthesis Agent',
      type: 'llm',
      status: 'idle',
      inputs: ['Multi-Agent Findings', 'Citations', 'Sandbox Results'],
      outputs: ['Compiled Markdown Deliverable'],
      description: 'Orchestrates multi-agent findings and synthesizes final answer via Qwen3.'
    }
  ]);

  // System Hardware Profile & Real Laptop Adaptive Telemetry
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile>(DEFAULT_HARDWARE_PROFILE);

  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    gpuUtilization: 0,
    vramAllocated: 0,
    vramTotal: 4.0,
    cpuUtilization: 5,
    ramUsed: 0,
    ramTotal: 16.0,
    tokensPerSec: 0,
    gpuName: 'NVIDIA GeForce GTX 1650',
    cpuName: 'AMD Ryzen 5 4600H',
    hardwareTier: 'Mid-Range Laptop (4GB VRAM, 16GB RAM)'
  });

  const refreshModels = useCallback(async () => {
    try {
      const res = await fetch('/api/models/audit');
      if (res.ok) {
        const audit = await res.json();
        const installed: ModelItem[] = (audit.installedModels || []).map((m: any, idx: number) => ({
          id: `inst-${idx}`,
          name: m.name,
          family: m.details?.family || 'Local Runtime Model',
          parameterSize: m.details?.parameter_size || `${Math.round(m.size / (1024 * 1024))} MB`,
          quantization: m.details?.quantization_level || 'Native',
          status: 'loaded' as const,
          vramRequired: `${(m.vramFootprintMB / 1024).toFixed(2)} GB`,
          vramUsed: `${(m.vramFootprintMB / 1024).toFixed(2)} GB`,
          contextWindow: '32K',
          tps: 0
        }));

        if (installed.length > 0) {
          setModels(installed);
        } else {
          // Present configured models with uninstalled/unconnected status
          const configuredList: ModelItem[] = [
            {
              id: 'cfg-qwen3-8b',
              name: 'Qwen3 8B',
              family: 'Qwen3',
              parameterSize: '8.2B',
              quantization: 'Q4_K_M',
              status: 'unloaded',
              vramRequired: '2.8 GB',
              contextWindow: '32K',
              tps: 0
            },
            {
              id: 'cfg-qwen-coder',
              name: 'Qwen2.5-Coder 7B',
              family: 'Qwen',
              parameterSize: '7.6B',
              quantization: 'Q4_K_M',
              status: 'unloaded',
              vramRequired: '2.6 GB',
              contextWindow: '32K',
              tps: 0
            },
            {
              id: 'cfg-qwen-vl',
              name: 'Qwen2.5-VL 7B',
              family: 'Qwen',
              parameterSize: '7.8B',
              quantization: 'Q4_K_M',
              status: 'unloaded',
              vramRequired: '2.9 GB',
              contextWindow: '8K',
              tps: 0
            },
            {
              id: 'cfg-nomic-embed',
              name: 'Nomic Embed Text',
              family: 'Nomic',
              parameterSize: '137M',
              quantization: 'F16',
              status: 'loaded',
              vramRequired: '0.28 GB',
              vramUsed: '0.28 GB',
              contextWindow: '8K',
              tps: 0
            }
          ];
          setModels(configuredList);
        }
      }
    } catch {
      // offline
    }
  }, []);

  const refreshHardware = useCallback(async () => {
    const detected = await detectSystemHardware();
    setHardwareProfile(detected);
    setSystemMetrics(prev => ({
      ...prev,
      gpuName: detected.gpu.detected ? `${detected.gpu.name}` : 'Integrated CPU',
      cpuName: detected.cpu.model,
      ramTotal: detected.ram.totalGB,
      ramUsed: detected.ram.usedGB,
      vramTotal: +(detected.gpu.totalVramMB / 1024).toFixed(1),
      hardwareTier: detected.tierLabel
    }));
    await refreshModels();
  }, [refreshModels]);

  useEffect(() => {
    refreshHardware();
  }, [refreshHardware]);

  const loadModel = (id: string) => {
    const target = models.find(m => m.id === id);
    if (!target) return;

    const targetVramGB = parseFloat(target.vramRequired);
    const currentlyAllocated = models
      .filter(m => m.status === 'loaded' && m.id !== id)
      .reduce((sum, m) => sum + parseFloat(m.vramRequired), 0);

    const safeCeiling = hardwareProfile.constraints.maxSafeVramGB; // 3.2 GB

    if (currentlyAllocated + targetVramGB > safeCeiling) {
      alert(
        `Hardware Guardrail Enforced:\nLoading ${target.name} (${target.vramRequired}) would exceed the safe ${safeCeiling} GB VRAM limit for your ${hardwareProfile.gpu.name}.\n\nPlease unload an active model first to prevent GPU memory crashes.`
      );
      return;
    }

    setModels(prev =>
      prev.map(m => (m.id === id ? { ...m, status: 'loaded', vramUsed: m.vramRequired } : m))
    );

    const newTotal = +(currentlyAllocated + targetVramGB).toFixed(2);
    setSystemMetrics(prev => ({
      ...prev,
      vramAllocated: newTotal,
      gpuUtilization: Math.min(85, Math.round((newTotal / 4.0) * 100))
    }));
  };

  const unloadModel = (id: string) => {
    setModels(prev =>
      prev.map(m => (m.id === id ? { ...m, status: 'unloaded', vramUsed: undefined } : m))
    );

    const target = models.find(m => m.id === id);
    const targetVramGB = target ? parseFloat(target.vramRequired) : 0;
    setSystemMetrics(prev => ({
      ...prev,
      vramAllocated: Math.max(0, +(prev.vramAllocated - targetVramGB).toFixed(2)),
      gpuUtilization: Math.max(8, prev.gpuUtilization - 20)
    }));
  };

  const toggleLeftNav = () => setLeftNavCollapsed(v => !v);
  const toggleRightContext = () => setRightContextOpen(v => !v);

  // Command Palette
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [commandPaletteMode, setCommandPaletteMode] = useState<'command' | 'file'>('command');

  // Editor cursor & status
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  // Git State
  const [gitState, setGitState] = useState<GitState>({
    branch: 'main',
    modifiedFiles: [],
    stagedFiles: [],
    commits: [
      {
        id: '9f3b12a',
        message: 'Initial project setup with Monaco Editor and workspace clone',
        date: '2 hours ago',
        author: 'developer <dev@vscode-web.io>',
        files: ['package.json', 'src/App.tsx', 'README.md']
      }
    ]
  });

  // Extensions & Problems
  const [extensions, setExtensions] = useState<ExtensionItem[]>(DEFAULT_EXTENSIONS);
  const [problems, setProblems] = useState<ProblemItem[]>(INITIAL_PROBLEMS);

  // Persist files changes to localStorage if not a native filesystem handle
  useEffect(() => {
    if (!isNative) {
      try {
        localStorage.setItem('vscode_clone_files', JSON.stringify(files));
      } catch (e) {
        // quota exceeded or circular structure
      }
    }
  }, [files, isNative]);

  // Derive active file node from activeTabId
  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeFile = activeTab ? findNodeByPath(files, activeTab.path) : null;

  // Toggle helpers
  const toggleSidebar = () => setSidebarVisible(v => !v);
  const togglePanel = () => setPanelVisible(v => !v);
  const toggleAssistant = () => setAssistantVisible(v => !v);

  // Open File
  const openFile = useCallback((path: string) => {
    const node = findNodeByPath(files, path);
    if (!node || node.type !== 'file') return;

    setTabs(currentTabs => {
      const existing = currentTabs.find(t => t.path === path);
      if (existing) {
        setActiveTabId(existing.id);
        return currentTabs;
      }
      const newTab: Tab = {
        id: node.id,
        name: node.name,
        path: node.path,
        language: node.language || detectLanguage(node.name),
        isDirty: false
      };
      setActiveTabId(newTab.id);
      return [...currentTabs, newTab];
    });
  }, [files]);

  // Close Tab
  const closeTab = useCallback((id: string) => {
    setTabs(currentTabs => {
      const index = currentTabs.findIndex(t => t.id === id);
      if (index === -1) return currentTabs;

      const nextTabs = currentTabs.filter(t => t.id !== id);

      if (activeTabId === id) {
        if (nextTabs.length > 0) {
          const nextIndex = Math.min(index, nextTabs.length - 1);
          setActiveTabId(nextTabs[nextIndex].id);
        } else {
          setActiveTabId(null);
        }
      }
      return nextTabs;
    });
  }, [activeTabId]);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  // Update File Content (called as user types)
  const updateFileContent = useCallback((path: string, content: string) => {
    setFiles(prev => updateContentHelper(prev, path, content));

    // Mark tab dirty
    setTabs(prev =>
      prev.map(tab => (tab.path === path ? { ...tab, isDirty: true } : tab))
    );

    // Track in git
    setGitState(prev => {
      if (!prev.modifiedFiles.includes(path)) {
        return {
          ...prev,
          modifiedFiles: [...prev.modifiedFiles, path]
        };
      }
      return prev;
    });
  }, []);

  // Save current active file
  const saveCurrentFile = useCallback(async () => {
    if (!activeTab || !activeFile) return;

    // Clear dirty flag in tab
    setTabs(prev =>
      prev.map(t => (t.id === activeTab.id ? { ...t, isDirty: false } : t))
    );

    // If native file on disk, write to disk!
    if (activeFile.isNative && activeFile.handle) {
      await saveNativeFile(activeFile.handle, activeFile.content || '');
    }
  }, [activeTab, activeFile]);

  // Create File
  const createFile = useCallback((parentPath: string | null, name: string, content: string = '') => {
    const cleanName = name.trim();
    if (!cleanName) return;

    const basePath = parentPath && parentPath !== '/' ? parentPath : '';
    const fullPath = `${basePath}/${cleanName}`;

    // If duplicate exists, update content and open
    const existing = findNodeByPath(files, fullPath);
    if (existing) {
      if (content && existing.content !== content) {
        setFiles(prev => updateContentHelper(prev, fullPath, content));
      }
      openFile(fullPath);
      return;
    }

    const newNode: FileNode = {
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: cleanName,
      path: fullPath,
      type: 'file',
      content,
      language: detectLanguage(cleanName),
      isDirty: false
    };

    setFiles(prev => addNode(prev, parentPath, newNode));
    // Immediately open newly created file
    openFile(fullPath);
  }, [files, openFile]);

  // Create Folder
  const createFolder = useCallback((parentPath: string | null, name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;

    const basePath = parentPath && parentPath !== '/' ? parentPath : '';
    const fullPath = `${basePath}/${cleanName}`;

    if (findNodeByPath(files, fullPath)) {
      alert(`A file or folder with the name "${cleanName}" already exists.`);
      return;
    }

    const newFolder: FileNode = {
      id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: cleanName,
      path: fullPath,
      type: 'folder',
      isOpen: true,
      children: []
    };

    setFiles(prev => addNode(prev, parentPath, newFolder));
  }, [files]);

  // Rename File or Folder
  const renameItem = useCallback((path: string, newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName) return;

    const { updatedNodes, newPath } = renameNodeHelper(files, path, cleanName);
    setFiles(updatedNodes);

    // Update active tab path if open
    setTabs(prev =>
      prev.map(tab => {
        if (tab.path === path) {
          return {
            ...tab,
            name: cleanName,
            path: newPath,
            language: detectLanguage(cleanName)
          };
        }
        if (tab.path.startsWith(path + '/')) {
          const childSub = tab.path.substring(path.length);
          return {
            ...tab,
            path: `${newPath}${childSub}`
          };
        }
        return tab;
      })
    );
  }, [files]);

  // Delete File or Folder
  const deleteItem = useCallback((path: string) => {
    const target = findNodeByPath(files, path);
    if (!target) return;

    setFiles(prev => deleteNodeHelper(prev, path));

    // Close any tabs associated with the deleted item
    setTabs(prev => {
      const remaining = prev.filter(tab => tab.path !== path && !tab.path.startsWith(path + '/'));
      if (activeTabId && !remaining.find(t => t.id === activeTabId)) {
        setActiveTabId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  }, [files, activeTabId]);

  // Toggle Folder open/closed
  const toggleFolder = useCallback((path: string) => {
    setFiles(prev => toggleFolderHelper(prev, path));
  }, []);

  // Open real directory from hard drive using File System Access API
  const openFolderFromDisk = useCallback(async () => {
    const res = await openNativeDirectory();
    if (res) {
      setFiles(res.files);
      setWorkspaceName(res.rootName);
      setIsNative(true);
      setRootNativeHandle(res.rootHandle);
      // Close tabs from previous workspace
      setTabs([]);
      setActiveTabId(null);
    }
  }, []);

  // Export workspace as ZIP
  const exportProjectZip = useCallback(async () => {
    await exportWorkspaceAsZip(files, workspaceName);
  }, [files, workspaceName]);

  // Download single file
  const downloadFileItem = useCallback((path: string) => {
    const node = findNodeByPath(files, path);
    if (node && node.type === 'file') {
      downloadFile(node.name, node.content || '');
    }
  }, [files]);

  // Git staging & commit
  const stageFile = useCallback((path: string) => {
    setGitState(prev => ({
      ...prev,
      modifiedFiles: prev.modifiedFiles.filter(p => p !== path),
      stagedFiles: [...new Set([...prev.stagedFiles, path])]
    }));
  }, []);

  const unstageFile = useCallback((path: string) => {
    setGitState(prev => ({
      ...prev,
      stagedFiles: prev.stagedFiles.filter(p => p !== path),
      modifiedFiles: [...new Set([...prev.modifiedFiles, path])]
    }));
  }, []);

  const commitChanges = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setGitState(prev => ({
      ...prev,
      commits: [
        {
          id: Math.random().toString(16).substr(2, 7),
          message: trimmed,
          date: 'Just now',
          author: 'developer <dev@vscode-web.io>',
          files: [...prev.stagedFiles, ...prev.modifiedFiles]
        },
        ...prev.commits
      ],
      stagedFiles: [],
      modifiedFiles: []
    }));
  }, []);

  // Toggle Extension
  const toggleExtension = useCallback((id: string) => {
    setExtensions(prev =>
      prev.map(ext => (ext.id === id ? { ...ext, installed: !ext.installed } : ext))
    );
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S: Save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrentFile();
      }

      // Ctrl+P or Cmd+P: Quick Open File
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault();
        setCommandPaletteMode('file');
        setCommandPaletteOpen(true);
      }

      // Ctrl+Shift+P or Cmd+Shift+P or F1: Command Palette
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') ||
        e.key === 'F1'
      ) {
        e.preventDefault();
        setCommandPaletteMode('command');
        setCommandPaletteOpen(true);
      }

      // Ctrl+` or Cmd+`: Toggle Terminal Panel
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setPanelVisible(v => !v);
        setPanelTab('terminal');
      }

      // Ctrl+B or Cmd+B: Toggle Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarVisible(v => !v);
      }

      // Ctrl+L or Cmd+L: Toggle Antigravity Assistant
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setAssistantVisible(v => !v);
      }

      // Ctrl+W: Close active tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
      }

      // Escape: close command palette
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveCurrentFile, activeTabId, closeTab]);

  return (
    <WorkspaceContext.Provider
      value={{
        files,
        workspaceName,
        isNative,
        tabs,
        activeTabId,
        activeFile,
        activeBarTab,
        setActiveBarTab,
        sidebarVisible,
        setSidebarVisible,
        toggleSidebar,
        panelVisible,
        setPanelVisible,
        togglePanel,
        panelTab,
        setPanelTab,
        assistantVisible,
        setAssistantVisible,
        toggleAssistant,
        theme,
        setTheme,

        activeModule,
        setActiveModule,
        leftNavCollapsed,
        setLeftNavCollapsed,
        toggleLeftNav,
        rightContextOpen,
        setRightContextOpen,
        toggleRightContext,

        settingsCategory,
        setSettingsCategory,
        settingsSubSection,
        setSettingsSubSection,
        navigateToSettings,

        hardwareProfile,
        refreshHardware,
        models,
        loadModel,
        unloadModel,
        knowledgeCollections,
        workflowNodes,
        systemMetrics,

        conversations,
        activeConversationId,
        activeConversation,
        createConversation,
        selectConversation,
        deleteConversation,
        renameConversation,
        addMessageToActiveConversation,
        updateWorkplanStatus,

        commandPaletteOpen,
        setCommandPaletteOpen,
        commandPaletteMode,
        setCommandPaletteMode,
        cursorPos,
        setCursorPos,
        gitState,
        extensions,
        problems,

        openFile,
        closeTab,
        closeAllTabs,
        saveCurrentFile,
        updateFileContent,
        createFile,
        createFolder,
        renameItem,
        deleteItem,
        toggleFolder,
        openFolderFromDisk,
        exportProjectZip,
        downloadFileItem,

        stageFile,
        unstageFile,
        commitChanges,

        toggleExtension
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
