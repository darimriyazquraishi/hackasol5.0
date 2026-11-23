import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Layers,
  Sparkles,
  Download,
  ExternalLink,
  Plus,
  Play,
  RotateCw,
  FolderOpen,
  Eye,
  Code,
  FileText,
  AlertCircle,
  CheckCircle2,
  Terminal,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronRight,
  ChevronDown,
  Activity,
  Sliders,
  Cpu,
  Workflow,
  Search,
  Check,
  RefreshCw,
  Trash2,
  Copy
} from 'lucide-react';
import {
  BlenderStatus,
  BlenderProjectSummary,
  BlenderProjectDetail,
  BlenderSceneObject,
  BlenderTaskState,
  BlenderViewportMode
} from '../../types/blender';
import {
  fetchBlenderStatus,
  fetchBlenderProjects,
  fetchBlenderProject,
  openInBlenderApp,
  submitGenerateRequest,
  submitExecutePlanRequest,
  fetchTaskStatus,
  deleteBlenderProjectApi,
  inspectBlenderSceneApi
} from '../../services/blenderService';

export const BlenderStudioModule: React.FC = () => {
  // Environment & Projects
  const [status, setStatus] = useState<BlenderStatus | null>(null);
  const [projects, setProjects] = useState<BlenderProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<BlenderProjectDetail | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);

  // Viewport
  const [viewportMode, setViewportMode] = useState<BlenderViewportMode>('rendered');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [previewKey, setPreviewKey] = useState<number>(Date.now());
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  // Prompt & Generation
  const [prompt, setPrompt] = useState('');
  const [isModification, setIsModification] = useState(false);
  const [isDiagramMode, setIsDiagramMode] = useState(false);
  const [activeTask, setActiveTask] = useState<BlenderTaskState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Side panels
  const [leftTab, setLeftTab] = useState<'hierarchy' | 'projects' | 'blueprints'>('hierarchy');
  const [logsExpanded, setLogsExpanded] = useState(true);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Show temporary toast notification
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Load initial status & projects
  const loadInitialData = useCallback(async () => {
    try {
      const [st, prjs] = await Promise.all([
        fetchBlenderStatus().catch(() => null),
        fetchBlenderProjects().catch(() => [])
      ]);
      setStatus(st);
      setProjects(prjs);

      if (prjs.length > 0 && !activeProjectId) {
        selectProject(prjs[0].project_id);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }, [activeProjectId]);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Select project and load full scene detail
  const selectProject = async (pId: string) => {
    try {
      setLoadingProject(true);
      setErrorMsg(null);
      const detail = await fetchBlenderProject(pId);
      setActiveProjectId(pId);
      setActiveProject(detail);
      setPreviewKey(Date.now());
      if (detail.prompt) {
        setPrompt(detail.prompt);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to load project: ${err.message}`);
    } finally {
      setLoadingProject(false);
    }
  };

  const [copiedLogs, setCopiedLogs] = useState(false);
  const handleCopyLogs = () => {
    if (!activeTask?.logs) return;
    navigator.clipboard.writeText(activeTask.logs.join('\n'));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleDeleteProject = async (e: React.MouseEvent, pId: string) => {
    e.stopPropagation();
    try {
      await deleteBlenderProjectApi(pId);
      showToast(`Deleted ${pId}`);
      const fresh = await fetchBlenderProjects();
      setProjects(fresh);
      if (activeProjectId === pId) {
        if (fresh.length > 0) {
          selectProject(fresh[0].project_id);
        } else {
          setActiveProjectId(null);
          setActiveProject(null);
        }
      }
    } catch (err: any) {
      setErrorMsg(`Failed to delete project: ${err.message}`);
    }
  };

  // Poll active task while running
  useEffect(() => {
    if (!activeTask || activeTask.status === 'COMPLETED' || activeTask.status === 'FAILED') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await fetchTaskStatus(activeTask.task_id);
        setActiveTask(updated);

        if (updated.status === 'COMPLETED') {
          setIsGenerating(false);
          showToast('Scene generated and rendered successfully!');
          // Refresh projects list & select the generated project
          const freshProjects = await fetchBlenderProjects();
          setProjects(freshProjects);
          if (updated.project_id) {
            selectProject(updated.project_id);
          }
        } else if (updated.status === 'FAILED') {
          setIsGenerating(false);
          setErrorMsg(updated.error || 'Blender generation failed.');
        }
      } catch {
        // ignore polling network errors
      }
    }, 800);

    return () => clearInterval(interval);
  }, [activeTask]);

  // Auto-scroll logs
  useEffect(() => {
    if (logEndRef.current && logsExpanded) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTask?.logs, logsExpanded]);

  // Handle generation submission
  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setErrorMsg(null);
    setIsGenerating(true);

    try {
      const finalPrompt = prompt.trim();

      const res = await submitGenerateRequest({
        prompt: finalPrompt,
        projectId: isModification && activeProjectId ? activeProjectId : undefined,
        isModification: isModification && Boolean(activeProjectId),
        renderPreview: true
      });

      setActiveTask({
        task_id: res.task_id,
        project_id: res.project_id,
        prompt: finalPrompt,
        status: 'QUEUED',
        progress: 10,
        logs: [`[${new Date().toLocaleTimeString()}] Submitting generation request to Blender 3D Studio...`],
        started_at: new Date().toISOString()
      });
    } catch (err: any) {
      setIsGenerating(false);
      setErrorMsg(err.message);
    }
  };

  // Launch in native Blender application GUI
  const handleOpenInBlender = async () => {
    if (!activeProjectId) return;
    try {
      const res = await openInBlenderApp(activeProjectId);
      showToast(res.message);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Filtered scene objects
  const sceneObjects = activeProject?.scene_state?.objects || [];
  const filteredObjects = sceneObjects.filter(obj => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      obj.name.toLowerCase().includes(q) ||
      (obj.group_name && obj.group_name.toLowerCase().includes(q)) ||
      (obj.type && obj.type.toLowerCase().includes(q)) ||
      (obj.collection && obj.collection.toLowerCase().includes(q))
    );
  });

  // Selected object info
  const selectedObject = sceneObjects.find(o => (o.id || o.name) === selectedObjectId);

  // Quick Starter Blueprints
  const starterBlueprints = [
    {
      title: 'Centrifugal Slurry Pump Skid',
      desc: '3D industrial pump with cast iron casing, motor coupling, and flanged pipe connections',
      prompt: 'Centrifugal slurry pump skid with electric induction motor, cast iron casing, vibration dampers, and inlet flange'
    },
    {
      title: 'Vertical Industrial Pressure Vessel',
      desc: 'Cylindrical pressure vessel with dished heads, 4 structural support legs, and nozzle flanges',
      prompt: 'Vertical cylindrical pressure vessel with dished heads, 4 structural support legs, top manway, and inlet nozzles'
    },
    {
      title: 'Piping Manifold & Valve Station',
      desc: 'Industrial pipe header assembly with flanged gate valves, check valve, and tee junctions',
      prompt: 'Industrial flanged piping manifold with inlet gate valve, non-return check valve, and branching distribution header'
    },
    {
      title: 'Heavy Duty Electric Motor & Gearbox',
      desc: 'Three-phase industrial induction motor with cooling fins, shaft coupling, and helical gearbox',
      prompt: 'Heavy duty 3-phase electric motor with radial cooling fins, shaft coupling, and mounted reduction gearbox'
    }
  ];

  return (
    <div className="h-full w-full flex flex-col bg-[#080808] text-[#F5F4F1] font-sans overflow-hidden select-none">
      {/* 1. Studio Top Navigation & Global Controls */}
      <header className="h-13 bg-[#121212] border-b border-[#303030] px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 rounded-lg bg-[#987654]/15 border border-[#987654]/30 text-[#987654]">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-semibold text-[#F5F4F1] tracking-wide" style={{ fontFamily: 'var(--font-display, serif)' }}>
                3D Studio
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[#191919] text-[#987654] border border-[#303030]">
                Blender Automation
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-[#9C9C9C]">
              {status?.installed ? (
                <span className="flex items-center space-x-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{status.version} Active</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-amber-400">
                  <AlertCircle className="w-3 h-3" />
                  <span>Blender Not Detected</span>
                </span>
              )}
              <span>•</span>
              <span className="truncate max-w-[280px]">
                {activeProject ? activeProject.prompt : 'No Active Scene'}
              </span>
            </div>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex items-center space-x-2">
          {activeProjectId && (
            <>
              {/* Open in Blender GUI */}
              <button
                onClick={handleOpenInBlender}
                title="Launch in installed Blender Application"
                className="px-2.5 py-1.5 rounded text-xs bg-[#191919] hover:bg-[#202020] text-[#F5F4F1] border border-[#303030] flex items-center space-x-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#987654]" />
                <span>Open in Blender</span>
              </button>

              {/* Download .blend */}
              <a
                href={`/api/blender/projects/${encodeURIComponent(activeProjectId)}/blend`}
                download={`${activeProjectId}.blend`}
                title="Download .blend project file"
                className="px-2.5 py-1.5 rounded text-xs bg-[#191919] hover:bg-[#202020] text-[#F5F4F1] border border-[#303030] flex items-center space-x-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#9C9C9C]" />
                <span>.blend</span>
              </a>

              {/* Re-render preview */}
              <button
                onClick={() => setPreviewKey(Date.now())}
                title="Refresh Viewport"
                className="p-1.5 rounded text-xs bg-[#191919] hover:bg-[#202020] text-[#9C9C9C] hover:text-[#F5F4F1] border border-[#303030] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* New Scene button */}
          <button
            onClick={() => {
              setActiveProjectId(null);
              setActiveProject(null);
              setPrompt('');
              setIsModification(false);
            }}
            className="px-3 py-1.5 rounded text-xs bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1] font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Scene</span>
          </button>
        </div>
      </header>

      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="absolute top-16 right-6 z-50 px-3.5 py-2 rounded-lg bg-[#191919] border border-[#987654]/60 text-xs text-[#F5F4F1] shadow-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-red-950/40 border-b border-red-500/30 px-4 py-2 text-xs text-red-200 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200 text-xs font-mono">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Project & Scene Explorer (Collapsible/Tabbed) */}
        <aside className="w-80 bg-[#0E0E0E] border-r border-[#303030] flex flex-col shrink-0 select-none">
          {/* Explorer Tabs */}
          <div className="flex items-center border-b border-[#303030] bg-[#121212] px-2 pt-1 text-xs">
            <button
              onClick={() => setLeftTab('hierarchy')}
              className={`px-3 py-2 border-b-2 font-medium transition-colors flex items-center space-x-1.5 ${leftTab === 'hierarchy'
                ? 'border-[#987654] text-[#F5F4F1]'
                : 'border-transparent text-[#9C9C9C] hover:text-[#F5F4F1]'
                }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Scene Objects</span>
              {sceneObjects.length > 0 && (
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-[#191919] text-[#987654] font-mono">
                  {sceneObjects.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setLeftTab('projects')}
              className={`px-3 py-2 border-b-2 font-medium transition-colors flex items-center space-x-1.5 ${leftTab === 'projects'
                ? 'border-[#987654] text-[#F5F4F1]'
                : 'border-transparent text-[#9C9C9C] hover:text-[#F5F4F1]'
                }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Projects</span>
              <span className="px-1 py-0.2 rounded-full text-[9px] bg-[#191919] text-[#9C9C9C] font-mono">
                {projects.length}
              </span>
            </button>
            <button
              onClick={() => setLeftTab('blueprints')}
              className={`px-3 py-2 border-b-2 font-medium transition-colors flex items-center space-x-1.5 ${leftTab === 'blueprints'
                ? 'border-[#987654] text-[#F5F4F1]'
                : 'border-transparent text-[#9C9C9C] hover:text-[#F5F4F1]'
                }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Blueprints</span>
            </button>
          </div>

          {/* TAB 1: Scene Hierarchy */}
          {leftTab === 'hierarchy' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Search Filter */}
              <div className="p-2 border-b border-[#303030]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#9C9C9C] absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={e => setFilterQuery(e.target.value)}
                    placeholder="Search objects, valves, tags..."
                    className="w-full bg-[#181818] border border-[#303030] rounded pl-8 pr-2 py-1.5 text-xs text-[#F5F4F1] placeholder-[#666] focus:outline-none focus:border-[#987654]"
                  />
                </div>
              </div>

              {/* Objects List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sceneObjects.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#9C9C9C]">
                    <Box className="w-8 h-8 text-[#303030] mx-auto mb-2" />
                    <span>No objects in scene</span>
                    <p className="text-[10px] text-[#666] mt-1">Generate a model or select a project</p>
                  </div>
                ) : (
                  filteredObjects.map(obj => {
                    const isSelected = (obj.id || obj.name) === selectedObjectId;
                    const colorHex = obj.material?.color
                      ? `rgba(${Math.round(obj.material.color[0] * 255)}, ${Math.round(obj.material.color[1] * 255)}, ${Math.round(obj.material.color[2] * 255)}, 1.0)`
                      : '#987654';

                    return (
                      <div
                        key={obj.id || obj.name}
                        onClick={() => setSelectedObjectId(obj.id || obj.name)}
                        className={`p-2 rounded text-xs cursor-pointer transition-colors border ${isSelected
                          ? 'bg-[#191919] border-[#987654] text-[#F5F4F1]'
                          : 'bg-[#121212]/50 border-transparent hover:bg-[#191919] text-[#CCCCCC]'
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                              style={{ backgroundColor: colorHex }}
                            />
                            <span className="font-mono text-xs truncate">{obj.name}</span>
                          </div>
                          <span className="text-[9px] font-mono text-[#9C9C9C] px-1 bg-[#181818] rounded shrink-0">
                            {obj.type || obj.collection || 'PRIMITIVE'}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-[#303030] text-[10px] font-mono text-[#9C9C9C] space-y-1">
                            {obj.position && (
                              <div>
                                Pos: [{obj.position.map(n => n.toFixed(2)).join(', ')}]
                              </div>
                            )}
                            {obj.dimensions && (
                              <div>
                                Dim: [{obj.dimensions.map(n => n.toFixed(2)).join(', ')}]
                              </div>
                            )}
                            {obj.material && (
                              <div className="text-[#987654]">
                                Mat: {obj.material.name} (r={obj.material.roughness || 0.4})
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Projects List */}
          {leftTab === 'projects' && (
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {projects.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#9C9C9C]">
                  <FolderOpen className="w-8 h-8 text-[#303030] mx-auto mb-2" />
                  <span>No saved projects yet</span>
                </div>
              ) : (
                projects.map(p => {
                  const isActive = p.project_id === activeProjectId;
                  return (
                    <div
                      key={p.project_id}
                      onClick={() => selectProject(p.project_id)}
                      className={`p-2 rounded-lg cursor-pointer transition-all border ${isActive
                        ? 'bg-[#191919] border-[#987654] shadow-sm'
                        : 'bg-[#121212]/60 border-[#262626] hover:bg-[#191919] hover:border-[#383838]'
                        }`}
                    >
                      <div className="flex items-start justify-between space-x-2">
                        <div className="flex items-start space-x-2 min-w-0 flex-1">
                          {p.has_preview ? (
                            <img
                              src={`/api/blender/projects/${encodeURIComponent(p.project_id)}/preview?t=${previewKey}`}
                              alt={p.prompt}
                              className="w-14 h-11 object-cover rounded bg-[#080808] border border-[#303030] shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-11 rounded bg-[#181818] border border-[#303030] flex items-center justify-center text-[#666] shrink-0">
                              <Box className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-[#F5F4F1] truncate">
                              {p.prompt}
                            </div>
                            <div className="flex items-center space-x-1.5 mt-1 text-[10px] font-mono text-[#9C9C9C]">
                              <span>{p.total_objects} objs</span>
                              <span>•</span>
                              <span>{new Date(p.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Delete project button */}
                        <button
                          onClick={e => handleDeleteProject(e, p.project_id)}
                          title="Delete project"
                          className="p-1 text-[#666] hover:text-red-400 hover:bg-[#202020] rounded transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: Starter Blueprints */}
          {leftTab === 'blueprints' && (
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              <div className="text-[11px] text-[#9C9C9C] px-1 mb-1">
                Click any blueprint to populate the natural language generator:
              </div>
              {starterBlueprints.map((bp, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setPrompt(bp.prompt);
                    setIsModification(false);
                  }}
                  className="p-2.5 rounded-lg bg-[#121212] border border-[#262626] hover:border-[#987654] cursor-pointer transition-all hover:bg-[#191919] group"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-[#F5F4F1] group-hover:text-[#987654]">
                    <span>{bp.title}</span>
                  </div>
                  <div className="text-[11px] text-[#9C9C9C] mt-1 leading-relaxed">
                    {bp.desc}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* CENTER COLUMN: 3D Viewport & Stage */}
        <section className="flex-1 flex flex-col bg-[#080808] overflow-hidden relative">
          {/* Viewport Control Bar */}
          <div className="h-10 bg-[#121212] border-b border-[#303030] px-3 flex items-center justify-between shrink-0 z-10 text-xs">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setViewportMode('rendered')}
                className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center space-x-1.5 ${viewportMode === 'rendered'
                  ? 'bg-[#987654] text-[#F5F4F1]'
                  : 'text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919]'
                  }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Rendered View</span>
              </button>
              <button
                onClick={() => setViewportMode('scene_tree')}
                className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center space-x-1.5 ${viewportMode === 'scene_tree'
                  ? 'bg-[#987654] text-[#F5F4F1]'
                  : 'text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919]'
                  }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Scene State (JSON)</span>
              </button>
              <button
                onClick={() => setViewportMode('plan')}
                className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center space-x-1.5 ${viewportMode === 'plan'
                  ? 'bg-[#987654] text-[#F5F4F1]'
                  : 'text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919]'
                  }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Modeling Plan</span>
              </button>
            </div>

            {/* Viewport zoom and fit controls */}
            <div className="flex items-center space-x-1 text-[#9C9C9C]">
              <button
                onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.2))}
                title="Zoom Out"
                className="p-1.5 hover:text-[#F5F4F1] hover:bg-[#191919] rounded"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[10px] w-10 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.2))}
                title="Zoom In"
                className="p-1.5 hover:text-[#F5F4F1] hover:bg-[#191919] rounded"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(1.0)}
                title="Reset Zoom"
                className="p-1.5 hover:text-[#F5F4F1] hover:bg-[#191919] rounded"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Central Stage Viewport */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative bg-[radial-gradient(#1c1c1c_1px,transparent_1px)] [background-size:24px_24px]">
            {loadingProject ? (
              <div className="text-center text-[#9C9C9C] text-xs space-y-2">
                <RefreshCw className="w-8 h-8 text-[#987654] animate-spin mx-auto" />
                <span>Loading 3D project...</span>
              </div>
            ) : viewportMode === 'rendered' ? (
              activeProjectId && activeProject?.has_preview ? (
                <div
                  className="transition-transform duration-150 relative shadow-2xl rounded-lg overflow-hidden border border-[#303030] bg-[#0c0c0c]"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <img
                    src={`/api/blender/projects/${encodeURIComponent(activeProjectId)}/preview?t=${previewKey}`}
                    alt={activeProject.prompt}
                    className="max-w-[960px] max-h-[640px] w-auto h-auto object-contain block select-none"
                  />

                  {/* Stage HUD Overlay */}
                  <div className="absolute top-3 left-3 flex items-center space-x-2 z-10 pointer-events-none">
                    <span className="px-2 py-1 rounded bg-[#080808]/85 backdrop-blur text-[10px] font-mono text-[#F5F4F1] border border-[#303030]">
                      EEVEE Engine • 960×640
                    </span>
                  </div>

                  <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-[#080808]/85 backdrop-blur text-[10px] font-mono text-[#9C9C9C] border border-[#303030] pointer-events-none">
                    {activeProject.total_objects} Objects Rendered
                  </div>
                </div>
              ) : (
                <div className="max-w-md text-center p-8 rounded-xl border border-dashed border-[#303030] bg-[#121212]/40">
                  <Box className="w-12 h-12 text-[#987654] mx-auto mb-3 opacity-60" />
                  <h3 className="text-sm font-semibold text-[#F5F4F1] mb-1">
                    No 3D Model Rendered Yet
                  </h3>
                  <p className="text-xs text-[#9C9C9C] mb-4">
                    Type a prompt below (e.g. &quot;Centrifugal slurry pump skid with electric induction motor&quot;) to generate your scene in Blender.
                  </p>
                  <button
                    onClick={() => {
                      setPrompt('Centrifugal slurry pump skid with electric induction motor, cast iron casing, and inlet flange');
                    }}
                    className="px-3 py-1.5 rounded text-xs bg-[#191919] hover:bg-[#222] text-[#987654] border border-[#987654]/40 transition-colors"
                  >
                    Load Sample 3D Model Prompt
                  </button>
                </div>
              )
            ) : viewportMode === 'scene_tree' ? (
              <div className="w-full h-full p-4 overflow-auto">
                <pre className="text-xs font-mono text-[#CCCCCC] bg-[#121212] p-4 rounded-lg border border-[#303030] overflow-auto max-h-full">
                  {JSON.stringify(activeProject?.scene_state || { message: 'No scene state recorded' }, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="w-full h-full p-4 overflow-auto">
                <pre className="text-xs font-mono text-[#CCCCCC] bg-[#121212] p-4 rounded-lg border border-[#303030] overflow-auto max-h-full">
                  {JSON.stringify(activeProject?.plan || { message: 'No plan record available' }, null, 2)}
                </pre>
              </div>
            )}
            {/* Floating Object Details HUD */}
            {selectedObject && (
              <div className="absolute bottom-6 left-6 z-30 p-3.5 rounded-lg bg-[#0e0e0e]/95 backdrop-blur-md border border-[#987654]/70 shadow-2xl max-w-sm text-xs space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                      style={{
                        backgroundColor: selectedObject.material?.color
                          ? `rgba(${Math.round(selectedObject.material.color[0] * 255)}, ${Math.round(selectedObject.material.color[1] * 255)}, ${Math.round(selectedObject.material.color[2] * 255)}, 1.0)`
                          : '#987654'
                      }}
                    />
                    <span className="font-mono font-semibold text-[#F5F4F1] truncate">
                      {selectedObject.name}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedObjectId(null)}
                    className="text-[#9C9C9C] hover:text-[#F5F4F1] p-0.5 rounded text-sm font-mono leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="text-[11px] font-mono text-[#9C9C9C] space-y-0.5">
                  <div>Type: <span className="text-[#F5F4F1]">{selectedObject.type || selectedObject.collection || 'PRIMITIVE'}</span></div>
                  {selectedObject.group_name && <div>Group: <span className="text-[#987654]">{selectedObject.group_name}</span></div>}
                  {selectedObject.position && (
                    <div>Pos: <span className="text-[#F5F4F1]">[{selectedObject.position.map(n => n.toFixed(2)).join(', ')}]</span></div>
                  )}
                  {selectedObject.dimensions && (
                    <div>Dim: <span className="text-[#F5F4F1]">[{selectedObject.dimensions.map(n => n.toFixed(2)).join(', ')}]</span></div>
                  )}
                  {selectedObject.material && (
                    <div>Mat: <span className="text-[#987654]">{selectedObject.material.name} (r={selectedObject.material.roughness ?? 0.4})</span></div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM CONSOLE: Natural Language Prompt & Execution Stream */}
          <footer className="border-t border-[#303030] bg-[#121212] shrink-0 z-20">
            {/* Live Task Progress Stream Bar (if active) */}
            {activeTask && (
              <div className="px-4 py-2 border-b border-[#303030] bg-[#161616]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[#987654] font-semibold">{activeTask.status}</span>
                    <span className="text-[#9C9C9C]">({activeTask.progress}%)</span>
                    <span className="text-[#CCCCCC] truncate max-w-md">• {activeTask.prompt}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopyLogs}
                      title="Copy logs to clipboard"
                      className="text-[11px] text-[#9C9C9C] hover:text-[#F5F4F1] flex items-center space-x-1 p-1 hover:bg-[#202020] rounded"
                    >
                      {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={() => setLogsExpanded(!logsExpanded)}
                      className="text-[11px] text-[#9C9C9C] hover:text-[#F5F4F1] flex items-center space-x-1"
                    >
                      <Terminal className="w-3 h-3" />
                      <span>{logsExpanded ? 'Hide' : 'Logs'}</span>
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${activeTask.status === 'FAILED'
                      ? 'bg-red-500'
                      : activeTask.status === 'COMPLETED'
                        ? 'bg-emerald-500'
                        : 'bg-[#987654]'
                      }`}
                    style={{ width: `${activeTask.progress}%` }}
                  />
                </div>

                {/* Collapsible Log Terminal */}
                {logsExpanded && (
                  <div className="mt-2 p-2 bg-[#080808] rounded border border-[#282828] max-h-28 overflow-y-auto font-mono text-[11px] text-[#9C9C9C] space-y-0.5">
                    {activeTask.logs.map((line, idx) => (
                      <div key={idx} className="leading-tight">
                        {line}
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            )}

            {/* Prompt Input Form */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2 text-xs text-[#9C9C9C]">
                {/* Generation Options */}
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDiagramMode}
                      onChange={e => setIsDiagramMode(e.target.checked)}
                      className="rounded border-[#303030] text-[#987654] focus:ring-0 bg-[#181818]"
                    />
                    <span className={isDiagramMode ? 'text-sky-400 font-medium' : ''}>
                      P&ID Technical Diagram Mode (ISA-5.1)
                    </span>
                  </label>

                  {activeProjectId && (
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isModification}
                        onChange={e => setIsModification(e.target.checked)}
                        className="rounded border-[#303030] text-[#987654] focus:ring-0 bg-[#181818]"
                      />
                      <span className={isModification ? 'text-[#987654] font-medium' : ''}>
                        Incremental Edit (Add to Scene)
                      </span>
                    </label>
                  )}
                </div>

                {/* Quick suggestions */}
                <div className="hidden lg:flex items-center space-x-2 text-[10px]">
                  <span className="text-[#666]">Try:</span>
                  <button
                    onClick={() => {
                      setPrompt('Industrial water pumping system P&ID diagram with duty/standby pumps');
                      setIsDiagramMode(true);
                    }}
                    className="hover:text-[#F5F4F1] hover:underline"
                  >
                    Water P&ID
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => {
                      setPrompt('Double-cylinder hydraulic pumping skid with control valves');
                      setIsDiagramMode(false);
                    }}
                    className="hover:text-[#F5F4F1] hover:underline"
                  >
                    Pump Skid
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => {
                      setPrompt('Vertical cylindrical storage vessel with level transmitter and relief valve');
                      setIsDiagramMode(true);
                    }}
                    className="hover:text-[#F5F4F1] hover:underline"
                  >
                    Storage Vessel
                  </button>
                </div>
              </div>

              {/* Input & Action Button */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                  disabled={isGenerating}
                  placeholder={
                    isModification
                      ? `Add to ${activeProjectId || 'scene'}... (e.g. 'Add a pressure gauge PT-102 after valve V-103')`
                      : isDiagramMode
                      ? 'Describe technical P&ID diagram... (e.g. "Industrial water pumping system P&ID diagram with duty and standby pumps")'
                      : 'Describe 3D model to generate... (e.g. "Centrifugal slurry pump skid with electric induction motor")'
                  }
                  className="flex-1 bg-[#181818] border border-[#303030] rounded-lg px-3.5 py-2.5 text-xs text-[#F5F4F1] placeholder-[#666] focus:outline-none focus:border-[#987654]"
                />

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className={`px-4 py-2.5 rounded-lg text-xs font-medium flex items-center space-x-2 transition-all shrink-0 ${isGenerating || !prompt.trim()
                    ? 'bg-[#191919] text-[#666] cursor-not-allowed border border-[#282828]'
                    : 'bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1] shadow-lg shadow-[#987654]/10 cursor-pointer'
                    }`}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Building in Blender...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>{isModification ? 'Update Scene' : 'Generate'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
};
