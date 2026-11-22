import React, { useState } from 'react';
import {
  Cpu,
  HardDrive,
  ShieldCheck,
  Server,
  Settings,
  Workflow,
  Database,
  Sliders,
  Activity,
  Lock,
  Layers,
  Terminal,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  Network,
  EyeOff,
  Flame,
  Shield,
  Clock,
  Check,
  ChevronRight,
  Gauge
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { SettingsCategory, SettingsSubSection } from '../../types';
import { ModelManagerModule } from '../ModelManager/ModelManagerModule';
import { KnowledgeBaseModule } from '../KnowledgeBase/KnowledgeBaseModule';
import { WorkflowModule } from '../Workflows/WorkflowModule';

export const SettingsModule: React.FC = () => {
  const {
    settingsCategory,
    setSettingsCategory,
    settingsSubSection,
    setSettingsSubSection,
    systemMetrics,
    models
  } = useWorkspace();

  // Model Config State
  const [contextLength, setContextLength] = useState(128);
  const [temperature, setTemperature] = useState(0.2);
  const [topP, setTopP] = useState(0.9);
  const [gpuLayers, setGpuLayers] = useState(64);
  const [flashAttention, setFlashAttention] = useState(true);

  // Security State
  const [airGappedEnforced, setAirGappedEnforced] = useState(true);
  const [localSocketOnly, setLocalSocketOnly] = useState(true);
  const [metadataSanitization, setMetadataSanitization] = useState(true);
  const [ephemeralSessions, setEphemeralSessions] = useState(false);
  const [activeProfile, setActiveProfile] = useState('max-perf');

  // Diagnostics runner
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnosticComplete, setDiagnosticComplete] = useState(false);

  // System Prompt State
  const [systemPrompt, setSystemPrompt] = useState(
    `You are LUMI, an air-gapped sovereign AI assistant running on dedicated private hardware.
Adhere strictly to technical specifications. Never invent unsupported APIs.
Perform symbolic verification on all generated code.`
  );
  const [savedPrompt, setSavedPrompt] = useState(false);

  const categories: Array<{ id: SettingsCategory; label: string; icon: React.ReactNode }> = [
    { id: 'workbench', label: 'AI Workbench', icon: <Cpu className="w-4 h-4" /> },
    { id: 'hardware', label: 'Hardware & Performance', icon: <Gauge className="w-4 h-4" /> },
    { id: 'security', label: 'Security & Privacy', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'system', label: 'System', icon: <Server className="w-4 h-4" /> }
  ];

  const subSectionsByCategory: Record<
    SettingsCategory,
    Array<{ id: SettingsSubSection; label: string }>
  > = {
    workbench: [
      { id: 'model-manager', label: 'Model Manager' },
      { id: 'model-config', label: 'Model Configuration' },
      { id: 'agent-management', label: 'Agent Management' },
      { id: 'routing', label: 'Intelligent Routing' },
      { id: 'rag-kb', label: 'RAG & Knowledge Base' },
      { id: 'embeddings', label: 'Embeddings & Retrieval' },
      { id: 'system-prompts', label: 'System Prompts' }
    ],
    hardware: [
      { id: 'hardware-detection', label: 'Hardware Detection' },
      { id: 'gpu-cpu', label: 'GPU & CPU Monitoring' },
      { id: 'ram-vram', label: 'RAM & VRAM Usage' },
      { id: 'model-memory', label: 'Model Memory Management' },
      { id: 'hardware-profiles', label: 'Hardware Profiles' },
      { id: 'optimization', label: 'Performance Optimization' }
    ],
    security: [
      { id: 'local-mode', label: 'Local-only Mode' },
      { id: 'air-gapped', label: 'Air-gapped Configuration' },
      { id: 'network-policies', label: 'Network Policies' },
      { id: 'metadata-sanitization', label: 'Metadata Sanitization' },
      { id: 'sandbox', label: 'Sandbox Security' },
      { id: 'data-retention', label: 'Data Storage & Retention' }
    ],
    system: [
      { id: 'system-health', label: 'System Health' },
      { id: 'dependencies', label: 'Dependencies' },
      { id: 'logs', label: 'Logs & Telemetry' },
      { id: 'diagnostics', label: 'Diagnostics' },
      { id: 'storage', label: 'Storage Management' },
      { id: 'updates', label: 'Application Updates' }
    ]
  };

  const handleRunDiagnostics = () => {
    setDiagnosticRunning(true);
    setDiagnosticComplete(false);
    setTimeout(() => {
      setDiagnosticRunning(false);
      setDiagnosticComplete(true);
    }, 1200);
  };

  const handleSavePrompt = () => {
    setSavedPrompt(true);
    setTimeout(() => setSavedPrompt(false), 2000);
  };

  return (
    <div className="flex-1 flex h-full bg-[#080808] text-[#F5F4F1] font-sans overflow-hidden select-none">
      {/* Left Sub-Sidebar for Settings Navigation */}
      <div className="w-64 border-r border-[#303030] bg-[#080808] flex flex-col shrink-0">
        <div className="h-12 px-4 border-b border-[#303030] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-[#987654]" />
            <span className="font-mono text-xs font-bold tracking-tight text-[#F5F4F1]">
              SETTINGS & WORKBENCH
            </span>
          </div>
        </div>

        {/* Scrollable category tree */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {categories.map(cat => (
            <div key={cat.id} className="space-y-1">
              <button
                onClick={() => setSettingsCategory(cat.id)}
                className={`w-full px-2.5 py-1.5 rounded flex items-center justify-between text-xs font-semibold font-mono tracking-wide transition-colors ${
                  settingsCategory === cat.id
                    ? 'text-[#F5F4F1] bg-[#191919] border border-[#303030]'
                    : 'text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919]/50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className={settingsCategory === cat.id ? 'text-[#987654]' : 'text-[#9C9C9C]'}>
                    {cat.icon}
                  </span>
                  <span>{cat.label}</span>
                </div>
              </button>

              {/* Subsection list */}
              {settingsCategory === cat.id && (
                <div className="pl-4 space-y-0.5 border-l border-[#303030] ml-3.5 my-1">
                  {subSectionsByCategory[cat.id].map(sub => {
                    const isSubActive = settingsSubSection === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => setSettingsSubSection(sub.id)}
                        className={`w-full px-2 py-1 rounded text-left text-xs transition-colors flex items-center justify-between ${
                          isSubActive
                            ? 'text-[#987654] font-medium bg-[#141414]'
                            : 'text-[#9C9C9C] hover:text-[#D5D2CC] hover:bg-[#141414]/50'
                        }`}
                      >
                        <span className="truncate">{sub.label}</span>
                        {isSubActive && <div className="w-1.5 h-1.5 rounded-full bg-[#987654]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom Status */}
        <div className="p-3 border-t border-[#303030] text-[10px] font-mono text-[#9C9C9C] bg-[#080808]">
          <div className="flex items-center justify-between">
            <span>Air-gap Status</span>
            <span className="text-emerald-400 font-bold">LOCKED</span>
          </div>
        </div>
      </div>

      {/* Main Settings Content Pane */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080808]">
        {/* Top breadcrumb bar */}
        <div className="h-12 px-6 border-b border-[#303030] flex items-center justify-between shrink-0 bg-[#080808]">
          <div className="flex items-center space-x-2 text-xs font-mono text-[#9C9C9C]">
            <span>Settings</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#D5D2CC] capitalize">
              {categories.find(c => c.id === settingsCategory)?.label}
            </span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#987654] font-semibold">
              {subSectionsByCategory[settingsCategory].find(s => s.id === settingsSubSection)?.label}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[11px] font-mono text-[#9C9C9C]">
            <span>Local Cluster</span>
            <span>•</span>
            <span className="text-[#987654]">RTX 6000 Ada</span>
          </div>
        </div>

        {/* Render Specific SubSection View */}
        <div className="flex-1 overflow-y-auto">
          {/* ==================== AI WORKBENCH CATEGORY ==================== */}
          {settingsSubSection === 'model-manager' && <ModelManagerModule />}

          {settingsSubSection === 'model-config' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">MODEL CONFIGURATION</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Configure local model hyper-parameters, context allocation, and acceleration layers.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-4 text-xs">
                {/* Context Window */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#F5F4F1]">Context Window Size</span>
                    <span className="font-mono text-[#987654]">{contextLength}K tokens</span>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={128}
                    step={16}
                    value={contextLength}
                    onChange={e => setContextLength(Number(e.target.value))}
                    className="w-full accent-[#987654]"
                  />
                  <span className="text-[10px] text-[#9C9C9C]">
                    Higher context windows increase KV cache memory consumption.
                  </span>
                </div>

                {/* Temperature */}
                <div className="space-y-1.5 pt-2 border-t border-[#262626]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#F5F4F1]">Sampling Temperature</span>
                    <span className="font-mono text-[#987654]">{temperature.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    value={temperature}
                    onChange={e => setTemperature(Number(e.target.value))}
                    className="w-full accent-[#987654]"
                  />
                  <span className="text-[10px] text-[#9C9C9C]">
                    Lower values produce deterministic, concise engineering outputs.
                  </span>
                </div>

                {/* Top P */}
                <div className="space-y-1.5 pt-2 border-t border-[#262626]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#F5F4F1]">Top_P Nucleus Cutoff</span>
                    <span className="font-mono text-[#987654]">{topP.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={topP}
                    onChange={e => setTopP(Number(e.target.value))}
                    className="w-full accent-[#987654]"
                  />
                </div>

                {/* GPU Offload Layers */}
                <div className="space-y-1.5 pt-2 border-t border-[#262626]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#F5F4F1]">GPU Offload Layers</span>
                    <span className="font-mono text-[#987654]">{gpuLayers} / 64 (100% CUDA)</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={64}
                    value={gpuLayers}
                    onChange={e => setGpuLayers(Number(e.target.value))}
                    className="w-full accent-[#987654]"
                  />
                </div>

                {/* FlashAttention-2 Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-[#262626]">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">FlashAttention-2 Kernel</div>
                    <div className="text-[11px] text-[#9C9C9C]">Fused tensor attention saving 40% memory bandwidth.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={flashAttention}
                    onChange={e => setFlashAttention(e.target.checked)}
                    className="w-4 h-4 accent-[#987654] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'agent-management' && <WorkflowModule />}

          {settingsSubSection === 'routing' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">INTELLIGENT ROUTING</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Automatic model dispatching and latency versus accuracy policy matrices.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-4 text-xs">
                <div className="space-y-3">
                  {[
                    { task: 'General Reasoning & Chat', defaultModel: 'LUMI-Core 70B', fallback: 'Mistral-Large-Instruct' },
                    { task: 'Code Synthesis & Refactoring', defaultModel: 'DeepSeek-Coder-V2', fallback: 'Qwen2.5-Coder-32B' },
                    { task: 'Document Chunk Embeddings', defaultModel: 'BGE-Large-EN-v1.5', fallback: 'None (Dedicated)' },
                    { task: 'AST Verification & Linter', defaultModel: 'Qwen2.5-Coder-32B', fallback: 'AVX-512 Host CPU' }
                  ].map(rule => (
                    <div key={rule.task} className="p-3 rounded bg-[#080808] border border-[#262626] flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[#F5F4F1]">{rule.task}</div>
                        <div className="text-[11px] text-[#9C9C9C] font-mono">
                          Primary: <span className="text-[#987654]">{rule.defaultModel}</span>
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-[#9C9C9C]">
                        Fallback: {rule.fallback}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'rag-kb' && <KnowledgeBaseModule />}

          {settingsSubSection === 'embeddings' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">EMBEDDINGS & RETRIEVAL</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Vector indexing parameters, chunking strategies, and HNSW distance metrics.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-4 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Chunk Size</div>
                    <div className="text-[11px] text-[#9C9C9C]">Tokens per semantic boundary.</div>
                  </div>
                  <span className="font-mono text-[#987654] bg-[#080808] px-2 py-1 rounded border border-[#303030]">
                    512 tokens
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Chunk Overlap</div>
                    <div className="text-[11px] text-[#9C9C9C]">Sliding window token overlap.</div>
                  </div>
                  <span className="font-mono text-[#987654] bg-[#080808] px-2 py-1 rounded border border-[#303030]">
                    64 tokens
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Distance Metric</div>
                    <div className="text-[11px] text-[#9C9C9C]">Vector similarity calculation method.</div>
                  </div>
                  <span className="font-mono text-[#F5F4F1] bg-[#080808] px-2 py-1 rounded border border-[#303030]">
                    Cosine Similarity (Normalized)
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Index Engine</div>
                    <div className="text-[11px] text-[#9C9C9C]">Local dense vector index library.</div>
                  </div>
                  <span className="font-mono text-emerald-400 bg-[#080808] px-2 py-1 rounded border border-[#303030]">
                    HNSW M=16 ef=200
                  </span>
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'system-prompts' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">SYSTEM PROMPTS</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Global instructions, sovereign enterprise guardrails, and role definitions.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3">
                <div className="text-xs font-semibold font-mono text-[#F5F4F1]">
                  Primary Sovereign Assistant Instruction
                </div>
                <textarea
                  rows={6}
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  className="w-full bg-[#080808] border border-[#303030] rounded p-3 text-xs font-mono text-[#F5F4F1] focus:border-[#987654] outline-none resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-[#9C9C9C] font-mono">
                    Injected into every local model invocation.
                  </span>
                  <button
                    onClick={handleSavePrompt}
                    className="px-3 py-1.5 rounded bg-[#987654] hover:bg-[#765B43] text-xs font-mono text-[#F5F4F1] transition-colors flex items-center space-x-1"
                  >
                    {savedPrompt ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{savedPrompt ? 'Saved' : 'Save System Prompt'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== HARDWARE & PERFORMANCE CATEGORY ==================== */}
          {settingsSubSection === 'hardware-detection' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">HARDWARE DETECTION</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Detected physical computing slots, PCIe topology, and acceleration accelerators.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-2">
                  <div className="text-[11px] font-mono uppercase text-[#9C9C9C]">Dedicated GPU 0</div>
                  <div className="text-base font-bold font-mono text-[#F5F4F1]">NVIDIA RTX 6000 Ada</div>
                  <div className="text-xs text-[#987654] font-mono">48 GB GDDR6 • PCIe 5.0 x16</div>
                  <div className="text-[10px] text-emerald-400 font-mono">Driver 560.35 • CUDA 12.6</div>
                </div>

                <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-2">
                  <div className="text-[11px] font-mono uppercase text-[#9C9C9C]">Dedicated GPU 1</div>
                  <div className="text-base font-bold font-mono text-[#F5F4F1]">NVIDIA RTX 6000 Ada</div>
                  <div className="text-xs text-[#987654] font-mono">48 GB GDDR6 • NVLink Linked</div>
                  <div className="text-[10px] text-emerald-400 font-mono">Total VRAM: 96 GB Cluster</div>
                </div>

                <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-2">
                  <div className="text-[11px] font-mono uppercase text-[#9C9C9C]">Host Processor</div>
                  <div className="text-base font-bold font-mono text-[#F5F4F1]">AMD EPYC 9654</div>
                  <div className="text-xs text-[#987654] font-mono">96 Cores • 192 Threads</div>
                  <div className="text-[10px] text-[#9C9C9C] font-mono">AVX-512 Hardware Flags Active</div>
                </div>

                <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-2">
                  <div className="text-[11px] font-mono uppercase text-[#9C9C9C]">System Memory</div>
                  <div className="text-base font-bold font-mono text-[#F5F4F1]">128 GB DDR5 ECC</div>
                  <div className="text-xs text-[#987654] font-mono">Octa-Channel 4800 MT/s</div>
                  <div className="text-[10px] text-emerald-400 font-mono">Zero Page Fault Residency</div>
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'gpu-cpu' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">GPU & CPU MONITORING</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Real-time compute telemetry, thermal states, and power dissipation.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded bg-[#191919] border border-[#303030] space-y-1">
                  <div className="text-[11px] font-mono text-[#9C9C9C]">GPU 0 COMPUTE</div>
                  <div className="text-xl font-bold font-mono text-[#F5F4F1]">{systemMetrics.gpuUtilization}%</div>
                  <div className="text-[10px] font-mono text-[#987654]">Temp: 48°C • Power: 210W</div>
                </div>

                <div className="p-3.5 rounded bg-[#191919] border border-[#303030] space-y-1">
                  <div className="text-[11px] font-mono text-[#9C9C9C]">GPU 1 COMPUTE</div>
                  <div className="text-xl font-bold font-mono text-[#F5F4F1]">46%</div>
                  <div className="text-[10px] font-mono text-[#987654]">Temp: 46°C • Power: 195W</div>
                </div>

                <div className="p-3.5 rounded bg-[#191919] border border-[#303030] space-y-1">
                  <div className="text-[11px] font-mono text-[#9C9C9C]">CPU LOAD</div>
                  <div className="text-xl font-bold font-mono text-[#F5F4F1]">{systemMetrics.cpuUtilization}%</div>
                  <div className="text-[10px] font-mono text-[#9C9C9C]">96 Cores Active</div>
                </div>

                <div className="p-3.5 rounded bg-[#191919] border border-[#303030] space-y-1">
                  <div className="text-[11px] font-mono text-[#9C9C9C]">THROUGHPUT</div>
                  <div className="text-xl font-bold font-mono text-emerald-400">38.4 tps</div>
                  <div className="text-[10px] font-mono text-[#9C9C9C]">70B Q4_K_M</div>
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'ram-vram' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">RAM & VRAM USAGE</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Allocation partitioning between dedicated graphics memory and host page caches.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#F5F4F1] font-semibold">Total Dedicated VRAM</span>
                    <span className="text-[#987654]">{systemMetrics.vramAllocated} / {systemMetrics.vramTotal} GB</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#080808] rounded-full overflow-hidden border border-[#303030]">
                    <div
                      className="h-full bg-[#987654] rounded-full"
                      style={{ width: `${(systemMetrics.vramAllocated / systemMetrics.vramTotal) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#262626]">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#F5F4F1] font-semibold">Host System RAM</span>
                    <span className="text-[#9C9C9C]">{systemMetrics.ramUsed} / {systemMetrics.ramTotal} GB</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#080808] rounded-full overflow-hidden border border-[#303030]">
                    <div
                      className="h-full bg-[#9C9C9C] rounded-full"
                      style={{ width: `${(systemMetrics.ramUsed / systemMetrics.ramTotal) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'model-memory' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">MODEL MEMORY MANAGEMENT</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  KV cache quantization, continuous batching, and dynamic offload parameters.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">KV Cache Quantization</div>
                    <div className="text-[11px] text-[#9C9C9C]">Compress attention keys and values to 4-bit precision.</div>
                  </div>
                  <span className="text-emerald-400 font-mono text-[11px] bg-[#080808] px-2 py-1 rounded border border-[#303030]">
                    FP8 ENABLED
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Auto-Eviction Timeout</div>
                    <div className="text-[11px] text-[#9C9C9C]">Unload idle weights when inactive for more than 30 minutes.</div>
                  </div>
                  <span className="font-mono text-[#987654] bg-[#080808] px-2 py-1 rounded border border-[#303030]">
                    30 mins
                  </span>
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'hardware-profiles' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">HARDWARE PROFILES</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Preset compute allocation targets designed for specific thermal and power requirements.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'max-perf', name: 'Maximum Compute (Multi-GPU)', desc: 'Full clocks, both RTX 6000 Ada linked over NVLink, zero power throttle.' },
                  { id: 'balanced', name: 'Balanced Workstation', desc: 'Standard acoustic curve with aggressive fan silencing during idle intervals.' },
                  { id: 'quiet', name: 'Low Power & Quiet', desc: 'Caps GPU power target to 150W per slot for completely silent operation.' },
                  { id: 'server', name: 'Headless Daemon', desc: 'Optimized for background daemon workflows with display output detached.' }
                ].map(prof => (
                  <div
                    key={prof.id}
                    onClick={() => setActiveProfile(prof.id)}
                    className={`p-3.5 rounded cursor-pointer border transition-colors flex items-center justify-between ${
                      activeProfile === prof.id
                        ? 'bg-[#191919] border-[#987654]'
                        : 'bg-[#121212] border-[#303030] hover:bg-[#191919]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs text-[#F5F4F1]">{prof.name}</div>
                      <div className="text-[11px] text-[#9C9C9C] mt-0.5">{prof.desc}</div>
                    </div>
                    {activeProfile === prof.id && (
                      <span className="text-[10px] font-mono text-[#987654] uppercase px-2 py-0.5 rounded bg-[#080808] border border-[#303030]">
                        Active
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {settingsSubSection === 'optimization' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">PERFORMANCE OPTIMIZATION</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Low-level compiler passes, asynchronous tensor memory operations, and NUMA node tuning.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">TensorRT-LLM Execution Engine</div>
                    <div className="text-[11px] text-[#9C9C9C]">Compiled static graph execution for 1.8x token speedup.</div>
                  </div>
                  <span className="text-emerald-400 font-mono text-[10px]">ACTIVE</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">NUMA Socket Affinity</div>
                    <div className="text-[11px] text-[#9C9C9C]">Pins inference worker processes directly to CPU Node 0.</div>
                  </div>
                  <span className="text-[#987654] font-mono text-[10px]">NODE 0 PINNED</span>
                </div>
              </div>
            </div>
          )}

          {/* ==================== SECURITY & PRIVACY CATEGORY ==================== */}
          {settingsSubSection === 'local-mode' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">LOCAL-ONLY MODE</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Strict zero-telemetry configuration guaranteeing zero packets escape to the internet.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-4 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Outbound Telemetry</div>
                    <div className="text-[11px] text-[#9C9C9C]">Hard-locked zero telemetry. Prompt data never leaves this machine.</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#080808] text-emerald-400 font-mono text-[10px] border border-[#303030]">
                    ENFORCED OFF
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Offline License Validation</div>
                    <div className="text-[11px] text-[#9C9C9C]">Hardware fingerprint signed cryptographically on device.</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#080808] text-[#987654] font-mono text-[10px] border border-[#303030]">
                    VALID LOCAL
                  </span>
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'air-gapped' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">AIR-GAPPED CONFIGURATION</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Network interface dropping and offline cryptographic verification parameters.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Interface Egress Firewall</div>
                    <div className="text-[11px] text-[#9C9C9C]">Kernel packet drop rule for any outbound socket requests.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={airGappedEnforced}
                    onChange={e => setAirGappedEnforced(e.target.checked)}
                    className="w-4 h-4 accent-[#987654] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">DNS Query Blackhole</div>
                    <div className="text-[11px] text-[#9C9C9C]">Rejects DNS requests immediately with empty records.</div>
                  </div>
                  <span className="text-emerald-400 font-mono text-[10px]">BLACKHOLED</span>
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'network-policies' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">NETWORK POLICIES</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Local socket endpoints, port bindings, and internal loopback authorizations.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Local Unix Socket Daemon</div>
                    <div className="text-[11px] text-[#9C9C9C]">Bind IPC communication strictly to /tmp/lumi-ipc.sock.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSocketOnly}
                    onChange={e => setLocalSocketOnly(e.target.checked)}
                    className="w-4 h-4 accent-[#987654] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Binding Interface</div>
                    <div className="text-[11px] text-[#9C9C9C]">Listening network address.</div>
                  </div>
                  <span className="font-mono text-[#987654] bg-[#080808] px-2 py-1 rounded border border-[#303030]">
                    127.0.0.1 (Loopback Only)
                  </span>
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'metadata-sanitization' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">METADATA SANITIZATION</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  PII redactors, EXIF metadata scrubbers, and author signature anonymization.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Strip Document Metadata</div>
                    <div className="text-[11px] text-[#9C9C9C]">Automatically strips author names, revisions, and EXIF dates.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={metadataSanitization}
                    onChange={e => setMetadataSanitization(e.target.checked)}
                    className="w-4 h-4 accent-[#987654] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">PII Token Masking</div>
                    <div className="text-[11px] text-[#9C9C9C]">Masks email addresses, IPs, and API tokens in inference logs.</div>
                  </div>
                  <span className="text-emerald-400 font-mono text-[10px]">ACTIVE</span>
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'sandbox' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">SANDBOX SECURITY</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Linux namespace boundaries, seccomp system call barriers, and process containment.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Seccomp-BPF Syscall Filter</div>
                    <div className="text-[11px] text-[#9C9C9C]">Blocks root execution and raw socket allocations.</div>
                  </div>
                  <span className="text-emerald-400 font-mono text-[10px]">ENFORCED</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Filesystem Jail Path</div>
                    <div className="text-[11px] text-[#9C9C9C]">Read-only view of host root filesystem.</div>
                  </div>
                  <span className="font-mono text-[#987654] bg-[#080808] px-2 py-1 rounded border border-[#303030]">
                    /var/run/lumi/jail
                  </span>
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'data-retention' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">DATA STORAGE & RETENTION</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Retention duration, ephemeral session modes, and local database mounting.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#262626]">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Ephemeral Session Mode</div>
                    <div className="text-[11px] text-[#9C9C9C]">Wipes chat transcripts and vector chunks from disk on application exit.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={ephemeralSessions}
                    onChange={e => setEphemeralSessions(e.target.checked)}
                    className="w-4 h-4 accent-[#987654] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-[#F5F4F1]">Model Weights Path</div>
                    <div className="text-[11px] text-[#9C9C9C]">Direct NVMe mount for LLM checkpoints.</div>
                  </div>
                  <span className="font-mono text-[#987654] bg-[#080808] px-2 py-1 rounded border border-[#303030]">
                    /opt/lumi/weights
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ==================== SYSTEM CATEGORY ==================== */}
          {settingsSubSection === 'system-health' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">SYSTEM HEALTH</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Overall status of inference workers, vector databases, and IDE services.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                {[
                  { name: 'CUDA Tensor Engine', status: 'Operational', ping: '1.2ms' },
                  { name: 'Vector DB (sqlite-vec)', status: 'Operational', ping: '0.4ms' },
                  { name: 'Local IPC Daemon', status: 'Operational', ping: '0.1ms' },
                  { name: 'Monaco Editor Runtime', status: 'Operational', ping: '16.6ms' }
                ].map(service => (
                  <div key={service.name} className="p-3.5 rounded bg-[#191919] border border-[#303030] flex items-center justify-between">
                    <div>
                      <div className="text-[#F5F4F1] font-medium">{service.name}</div>
                      <div className="text-[10px] text-[#9C9C9C]">Latency: {service.ping}</div>
                    </div>
                    <div className="flex items-center space-x-1.5 text-emerald-400 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{service.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {settingsSubSection === 'dependencies' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">DEPENDENCIES</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Installed binary versions and acceleration driver layers.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-2 font-mono text-xs">
                {[
                  { name: 'NVIDIA Driver', version: '560.35.03' },
                  { name: 'CUDA Toolkit', version: '12.6.2' },
                  { name: 'cuDNN Acceleration Library', version: '9.1.0' },
                  { name: 'llama.cpp Core Engine', version: 'b3650 (AVX-512 + CUDA)' },
                  { name: 'vLLM Sovereign Worker', version: '0.6.3' },
                  { name: 'Node.js Runtime', version: 'v20.18.0' }
                ].map(dep => (
                  <div key={dep.name} className="flex items-center justify-between py-2 border-b border-[#262626] last:border-b-0">
                    <span className="text-[#F5F4F1]">{dep.name}</span>
                    <span className="text-[#987654]">{dep.version}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {settingsSubSection === 'logs' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold font-mono text-[#F5F4F1]">LOGS & TELEMETRY</h2>
                  <p className="text-xs text-[#9C9C9C] mt-1">
                    Live local event stream. All logs reside exclusively on host memory.
                  </p>
                </div>
                <button
                  onClick={() => alert('Audit log exported to /tmp/lumi_audit.log')}
                  className="px-3 py-1.5 rounded bg-[#191919] hover:bg-[#202020] border border-[#303030] text-xs font-mono text-[#D5D2CC] transition-colors flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-[#987654]" />
                  <span>Export Audit Log</span>
                </button>
              </div>

              <div className="p-3 rounded bg-[#080808] border border-[#303030] font-mono text-[11px] text-[#9C9C9C] space-y-1.5 h-80 overflow-y-auto leading-relaxed">
                <div>[22:40:12.102] [INFO]  [DAEMON] LUMI Sovereign Worker initialized on Unix socket /tmp/lumi-ipc.sock</div>
                <div>[22:40:12.180] [INFO]  [CUDA]   GPU 0: NVIDIA RTX 6000 Ada (48 GB) bound to slot 0</div>
                <div>[22:40:12.182] [INFO]  [CUDA]   GPU 1: NVIDIA RTX 6000 Ada (48 GB) bound to slot 1 via NVLink</div>
                <div>[22:40:13.440] [INFO]  [WEIGHT] Loaded LUMI-Core 70B (Q4_K_M) - 42.1 GB VRAM resident</div>
                <div>[22:40:14.210] [INFO]  [VECTOR] HNSW index mounted: 3 collections, 12,480 chunks mapped</div>
                <div>[22:45:00.320] [INFO]  [ROUTER] Ingress request parsed: Security Evaluator assigned</div>
                <div>[22:45:01.810] [INFO]  [INFER]  Generation completed in 1.49s (38.4 tps)</div>
                <div>[22:46:10.040] [INFO]  [AIRGAP] Zero telemetry assertion verified: 0 outbound bytes</div>
              </div>
            </div>
          )}

          {settingsSubSection === 'diagnostics' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold font-mono text-[#F5F4F1]">SYSTEM DIAGNOSTICS</h2>
                  <p className="text-xs text-[#9C9C9C] mt-1">
                    Automated assertion test runner verifying system integrity and hardware guardrails.
                  </p>
                </div>
                <button
                  onClick={handleRunDiagnostics}
                  disabled={diagnosticRunning}
                  className="px-3.5 py-1.5 rounded bg-[#987654] hover:bg-[#765B43] text-xs font-mono font-medium text-[#F5F4F1] transition-colors flex items-center space-x-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${diagnosticRunning ? 'animate-spin' : ''}`} />
                  <span>{diagnosticRunning ? 'Running Tests...' : 'Run Diagnostics'}</span>
                </button>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3 font-mono text-xs">
                {[
                  { name: 'GPU NVLink Bandwidth (900 GB/s target)', result: 'PASSED (912 GB/s)' },
                  { name: 'VRAM Memory Fragmentation Ratio', result: 'PASSED (0.4% fragmentation)' },
                  { name: 'Local Socket Loopback Latency', result: 'PASSED (0.09ms roundtrip)' },
                  { name: 'Vector Index Cryptographic Checksum', result: 'PASSED (SHA-256 match)' },
                  { name: 'Zero Egress Firewall Enforcement', result: 'PASSED (100% blocked)' }
                ].map(diag => (
                  <div key={diag.name} className="flex items-center justify-between py-2 border-b border-[#262626] last:border-b-0">
                    <span className="text-[#F5F4F1]">{diag.name}</span>
                    <span className="text-emerald-400 font-semibold">{diag.result}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {settingsSubSection === 'storage' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">STORAGE MANAGEMENT</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Local NVMe disk allocation for model weights, vector embeddings, and temporary caches.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-4 text-xs font-mono">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[#F5F4F1]">
                    <span>NVMe Mount /opt/lumi</span>
                    <span className="text-[#987654]">164.4 GB / 2000 GB Used (8.2%)</span>
                  </div>
                  <div className="w-full h-2 bg-[#080808] rounded-full overflow-hidden border border-[#303030]">
                    <div className="h-full bg-[#987654] rounded-full" style={{ width: '8.2%' }} />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#262626] text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9C9C9C]">GGUF Model Weights (/opt/lumi/weights)</span>
                    <span className="text-[#F5F4F1]">142.1 GB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9C9C9C]">Vector Index Corpus (/opt/lumi/vectors)</span>
                    <span className="text-[#F5F4F1]">18.1 GB</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9C9C9C]">Compiler Cache & Logs</span>
                    <span className="text-[#F5F4F1]">4.2 GB</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => alert('Temporary caches purged successfully.')}
                    className="px-3 py-1.5 rounded bg-[#080808] hover:bg-[#202020] text-red-400 border border-[#303030] text-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purge Temporary Caches</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {settingsSubSection === 'updates' && (
            <div className="p-6 space-y-6 max-w-3xl">
              <div>
                <h2 className="text-base font-bold font-mono text-[#F5F4F1]">APPLICATION UPDATES</h2>
                <p className="text-xs text-[#9C9C9C] mt-1">
                  Air-gapped offline package installer and version integrity checker.
                </p>
              </div>

              <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-4 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-[#F5F4F1]">LUMI v13.5.0-sovereign</div>
                    <div className="text-[11px] text-[#9C9C9C] mt-0.5">Build Commit 9f3b12a • Production Release</div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-[#080808] text-emerald-400 border border-[#303030] text-[11px]">
                    UP TO DATE
                  </span>
                </div>

                <div className="pt-2 border-t border-[#262626]">
                  <p className="text-[11px] text-[#9C9C9C] leading-relaxed mb-3">
                    In air-gapped deployments, updates must be installed via offline signed bundle archives.
                  </p>
                  <button
                    onClick={() => alert('Select a verified .lumi-pkg update archive to proceed.')}
                    className="px-3 py-1.5 rounded bg-[#191919] hover:bg-[#202020] border border-[#303030] text-[#D5D2CC] hover:text-[#F5F4F1] text-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-[#987654]" />
                    <span>Install Offline Update Archive (.lumi-pkg)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
