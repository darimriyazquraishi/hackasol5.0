import React from 'react';
import {
  Cpu,
  HardDrive,
  Activity,
  Plus,
  Code2,
  Database,
  Workflow,
  Shield,
  Layers,
  ArrowUpRight,
  Clock,
  Play
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const DashboardModule: React.FC = () => {
  const {
    setActiveModule,
    systemMetrics,
    models,
    loadModel,
    unloadModel,
    knowledgeCollections,
    workflowNodes,
    openFile
  } = useWorkspace();

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#080808] text-[#F5F4F1] font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#303030] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-[#F5F4F1] font-mono">
              LUMI WORKBENCH
            </h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#191919] text-[#987654] border border-[#303030]">
              SOVEREIGN DESKTOP AI
            </span>
          </div>
          <p className="text-xs text-[#9C9C9C] mt-1">
            Isolated local intelligence environment with hardware-accelerated inference and developer IDE.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveModule('chat')}
            className="px-3 py-1.5 rounded text-xs font-medium bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1] transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
          <button
            onClick={() => setActiveModule('ide')}
            className="px-3 py-1.5 rounded text-xs font-medium bg-[#191919] hover:bg-[#202020] text-[#D5D2CC] border border-[#303030] transition-colors flex items-center space-x-1.5"
          >
            <Code2 className="w-3.5 h-3.5 text-[#987654]" />
            <span>Open IDE</span>
          </button>
        </div>
      </div>

      {/* Hardware Telemetry Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* GPU Utilization */}
        <div className="p-3.5 rounded bg-[#191919] border border-[#303030] space-y-1.5">
          <div className="flex items-center justify-between text-[#9C9C9C] text-[11px] font-mono">
            <span>GPU COMPUTE</span>
            <Activity className="w-3.5 h-3.5 text-[#987654]" />
          </div>
          <div className="text-lg font-bold font-mono text-[#F5F4F1]">
            {systemMetrics.gpuUtilization}%
          </div>
          <div className="w-full h-1 bg-[#080808] rounded-full overflow-hidden border border-[#303030]">
            <div className="h-full bg-[#987654] rounded-full" style={{ width: `${systemMetrics.gpuUtilization}%` }} />
          </div>
          <span className="text-[10px] text-[#9C9C9C] font-mono">NVIDIA RTX 6000 Ada</span>
        </div>

        {/* VRAM Allocation */}
        <div className="p-3.5 rounded bg-[#191919] border border-[#303030] space-y-1.5">
          <div className="flex items-center justify-between text-[#9C9C9C] text-[11px] font-mono">
            <span>VRAM ALLOCATED</span>
            <HardDrive className="w-3.5 h-3.5 text-[#987654]" />
          </div>
          <div className="text-lg font-bold font-mono text-[#F5F4F1]">
            {systemMetrics.vramAllocated} <span className="text-xs text-[#9C9C9C]">/ {systemMetrics.vramTotal} GB</span>
          </div>
          <div className="w-full h-1 bg-[#080808] rounded-full overflow-hidden border border-[#303030]">
            <div
              className="h-full bg-[#987654] rounded-full"
              style={{ width: `${(systemMetrics.vramAllocated / systemMetrics.vramTotal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-[#9C9C9C] font-mono">80.9% Dedicated Memory</span>
        </div>

        {/* CPU Load */}
        <div className="p-3.5 rounded bg-[#191919] border border-[#303030] space-y-1.5">
          <div className="flex items-center justify-between text-[#9C9C9C] text-[11px] font-mono">
            <span>SYSTEM CPU</span>
            <Cpu className="w-3.5 h-3.5 text-[#9C9C9C]" />
          </div>
          <div className="text-lg font-bold font-mono text-[#F5F4F1]">
            {systemMetrics.cpuUtilization}%
          </div>
          <div className="w-full h-1 bg-[#080808] rounded-full overflow-hidden border border-[#303030]">
            <div className="h-full bg-[#9C9C9C] rounded-full" style={{ width: `${systemMetrics.cpuUtilization}%` }} />
          </div>
          <span className="text-[10px] text-[#9C9C9C] font-mono">32 Cores • Host Load</span>
        </div>

        {/* Inference Rate */}
        <div className="p-3.5 rounded bg-[#191919] border border-[#303030] space-y-1.5">
          <div className="flex items-center justify-between text-[#9C9C9C] text-[11px] font-mono">
            <span>THROUGHPUT</span>
            <Layers className="w-3.5 h-3.5 text-[#987654]" />
          </div>
          <div className="text-lg font-bold font-mono text-[#987654]">
            {systemMetrics.tokensPerSec} <span className="text-xs text-[#9C9C9C]">tok/s</span>
          </div>
          <div className="w-full h-1 bg-[#080808] rounded-full overflow-hidden border border-[#303030]">
            <div className="h-full bg-[#987654] rounded-full" style={{ width: '68%' }} />
          </div>
          <span className="text-[10px] text-[#9C9C9C] font-mono">FlashAttention-2 Active</span>
        </div>
      </div>

      {/* Main Grid: Active Models & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Active Models */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#9C9C9C] font-semibold">
              Host Model Registry
            </h2>
            <button
              onClick={() => setActiveModule('models')}
              className="text-xs text-[#987654] hover:underline flex items-center space-x-1 font-mono"
            >
              <span>Manage Models</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="rounded bg-[#191919] border border-[#303030] overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#303030] text-[10px] font-mono uppercase text-[#9C9C9C] bg-[#141414]">
                  <th className="py-2 px-3">Model</th>
                  <th className="py-2 px-3">Family</th>
                  <th className="py-2 px-3">Quant</th>
                  <th className="py-2 px-3">VRAM</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#303030] font-mono text-[11px]">
                {models.slice(0, 4).map(model => (
                  <tr key={model.id} className="hover:bg-[#202020] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-[#F5F4F1]">
                      {model.name}
                    </td>
                    <td className="py-2.5 px-3 text-[#9C9C9C]">{model.family}</td>
                    <td className="py-2.5 px-3 text-[#D5D2CC]">{model.quantization}</td>
                    <td className="py-2.5 px-3 text-[#987654]">{model.vramRequired}</td>
                    <td className="py-2.5 px-3">
                      {model.status === 'loaded' ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-400 text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>LOADED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-[#9C9C9C] text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#9C9C9C]" />
                          <span>IDLE</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {model.status === 'loaded' ? (
                        <button
                          onClick={() => unloadModel(model.id)}
                          className="px-2 py-0.5 rounded text-[10px] text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#303030] transition-colors"
                        >
                          Unload
                        </button>
                      ) : (
                        <button
                          onClick={() => loadModel(model.id)}
                          className="px-2 py-0.5 rounded text-[10px] text-[#F5F4F1] bg-[#987654] hover:bg-[#765B43] transition-colors"
                        >
                          Load
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Multi-Agent Pipeline Status */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#9C9C9C] font-semibold">
                Autonomous Workflow Execution
              </h2>
              <button
                onClick={() => setActiveModule('workflows')}
                className="text-xs text-[#987654] hover:underline flex items-center space-x-1 font-mono"
              >
                <span>Inspect Pipeline</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {workflowNodes.map((node, idx) => (
                <div
                  key={node.id}
                  className="p-2.5 rounded bg-[#191919] border border-[#303030] space-y-1 text-left relative overflow-hidden"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#9C9C9C]">
                    <span>0{idx + 1}</span>
                    {node.status === 'completed' && <span className="text-emerald-400">DONE</span>}
                    {node.status === 'running' && <span className="text-[#987654] animate-pulse">RUNNING</span>}
                    {node.status === 'idle' && <span className="text-[#9C9C9C]">WAIT</span>}
                  </div>
                  <div className="font-medium text-[11px] text-[#F5F4F1] truncate">
                    {node.name}
                  </div>
                  <div className="text-[9px] text-[#9C9C9C] font-mono uppercase truncate">
                    {node.type}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Quick Launch & Knowledge Collections */}
        <div className="space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[#9C9C9C] font-semibold">
            Quick Action Launcher
          </h2>

          <div className="space-y-2">
            <button
              onClick={() => setActiveModule('chat')}
              className="w-full p-3 rounded bg-[#191919] hover:bg-[#202020] border border-[#303030] text-left transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded bg-[#080808] border border-[#303030] text-[#987654]">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-medium text-[#F5F4F1]">Start Reasoning Session</div>
                  <div className="text-[11px] text-[#9C9C9C]">Execute private prompt against 70B core</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#9C9C9C] group-hover:text-[#F5F4F1] transition-colors" />
            </button>

            <button
              onClick={() => setActiveModule('ide')}
              className="w-full p-3 rounded bg-[#191919] hover:bg-[#202020] border border-[#303030] text-left transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded bg-[#080808] border border-[#303030] text-[#987654]">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-medium text-[#F5F4F1]">Open Developer Workspace</div>
                  <div className="text-[11px] text-[#9C9C9C]">Monaco editor, terminal & local filesystem</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#9C9C9C] group-hover:text-[#F5F4F1] transition-colors" />
            </button>

            <button
              onClick={() => setActiveModule('knowledge')}
              className="w-full p-3 rounded bg-[#191919] hover:bg-[#202020] border border-[#303030] text-left transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded bg-[#080808] border border-[#303030] text-[#987654]">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-medium text-[#F5F4F1]">Query Vector Knowledge</div>
                  <div className="text-[11px] text-[#9C9C9C]">12,480 chunks across 3 collections</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[#9C9C9C] group-hover:text-[#F5F4F1] transition-colors" />
            </button>
          </div>

          {/* Privacy Guarantee Card */}
          <div className="p-3.5 rounded bg-[#191919] border border-[#303030] space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-[#F5F4F1]">
              <Shield className="w-4 h-4 text-[#987654]" />
              <span>Sovereignty & Privacy Guarantee</span>
            </div>
            <p className="text-[11px] text-[#9C9C9C] leading-relaxed">
              LUMI runs fully detached from third-party APIs. Model weights reside on local NVMe storage and compute stays inside hardware boundaries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
