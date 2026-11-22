import React, { useState } from 'react';
import {
  Cpu,
  HardDrive,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  Layers,
  CheckCircle2,
  AlertCircle,
  Play
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const ModelManagerModule: React.FC = () => {
  const { models, loadModel, unloadModel, systemMetrics } = useWorkspace();
  const [filter, setFilter] = useState<'all' | 'loaded' | 'unloaded'>('all');

  const filteredModels = models.filter(m => {
    if (filter === 'loaded') return m.status === 'loaded';
    if (filter === 'unloaded') return m.status === 'unloaded';
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#080808] text-[#F5F4F1] font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#303030] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold font-mono tracking-tight text-[#F5F4F1]">
              MODEL MANAGER
            </h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#191919] text-[#987654] border border-[#303030]">
              LOCAL WEIGHTS
            </span>
          </div>
          <p className="text-xs text-[#9C9C9C] mt-1">
            Manage local LLMs, embeddings, and vision weights stored on NVMe storage.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button className="px-3 py-1.5 rounded text-xs font-mono bg-[#191919] hover:bg-[#202020] text-[#D5D2CC] border border-[#303030] transition-colors flex items-center space-x-1.5">
            <Download className="w-3.5 h-3.5 text-[#987654]" />
            <span>Pull GGUF Model</span>
          </button>
        </div>
      </div>

      {/* Memory Utilization Gauge */}
      <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-4 h-4 text-[#987654]" />
            <span className="font-semibold text-[#F5F4F1]">Dedicated VRAM Residency</span>
          </div>
          <span className="text-[#987654]">
            {systemMetrics.vramAllocated} GB / {systemMetrics.vramTotal} GB ({Math.round((systemMetrics.vramAllocated / systemMetrics.vramTotal) * 100)}%)
          </span>
        </div>

        <div className="w-full h-2 bg-[#080808] rounded-full overflow-hidden border border-[#303030]">
          <div
            className="h-full bg-[#987654] rounded-full transition-all"
            style={{ width: `${(systemMetrics.vramAllocated / systemMetrics.vramTotal) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-[#9C9C9C]">
          <span>Free Memory: {(systemMetrics.vramTotal - systemMetrics.vramAllocated).toFixed(1)} GB</span>
          <span>Compute Backend: CUDA 12.6 • FlashAttention-2</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex space-x-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              filter === 'all'
                ? 'bg-[#191919] text-[#F5F4F1] border border-[#303030]'
                : 'text-[#9C9C9C] hover:text-[#D5D2CC]'
            }`}
          >
            All Models ({models.length})
          </button>
          <button
            onClick={() => setFilter('loaded')}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              filter === 'loaded'
                ? 'bg-[#191919] text-[#F5F4F1] border border-[#303030]'
                : 'text-[#9C9C9C] hover:text-[#D5D2CC]'
            }`}
          >
            Loaded in VRAM ({models.filter(m => m.status === 'loaded').length})
          </button>
          <button
            onClick={() => setFilter('unloaded')}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              filter === 'unloaded'
                ? 'bg-[#191919] text-[#F5F4F1] border border-[#303030]'
                : 'text-[#9C9C9C] hover:text-[#D5D2CC]'
            }`}
          >
            Idle on Disk ({models.filter(m => m.status === 'unloaded').length})
          </button>
        </div>
      </div>

      {/* Models Table */}
      <div className="rounded bg-[#191919] border border-[#303030] overflow-hidden text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#303030] text-[10px] font-mono uppercase text-[#9C9C9C] bg-[#141414]">
              <th className="py-2.5 px-4">Model Identifier</th>
              <th className="py-2.5 px-4">Family</th>
              <th className="py-2.5 px-4">Parameters</th>
              <th className="py-2.5 px-4">Quantization</th>
              <th className="py-2.5 px-4">Context</th>
              <th className="py-2.5 px-4">VRAM Footprint</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Execution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#303030] font-mono text-[11px]">
            {filteredModels.map(model => (
              <tr key={model.id} className="hover:bg-[#202020] transition-colors">
                <td className="py-3 px-4 font-semibold text-[#F5F4F1]">
                  {model.name}
                </td>
                <td className="py-3 px-4 text-[#9C9C9C]">{model.family}</td>
                <td className="py-3 px-4 text-[#D5D2CC]">{model.parameterSize}</td>
                <td className="py-3 px-4 text-[#D5D2CC]">{model.quantization}</td>
                <td className="py-3 px-4 text-[#9C9C9C]">{model.contextWindow}</td>
                <td className="py-3 px-4 text-[#987654] font-medium">{model.vramRequired}</td>
                <td className="py-3 px-4">
                  {model.status === 'loaded' ? (
                    <span className="inline-flex items-center space-x-1.5 text-emerald-400 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>IN VRAM</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1.5 text-[#9C9C9C] text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9C9C9C]" />
                      <span>ON DISK</span>
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  {model.status === 'loaded' ? (
                    <button
                      onClick={() => unloadModel(model.id)}
                      className="px-2.5 py-1 rounded text-[11px] text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#303030] border border-[#303030] transition-colors"
                    >
                      Unload
                    </button>
                  ) : (
                    <button
                      onClick={() => loadModel(model.id)}
                      className="px-2.5 py-1 rounded text-[11px] text-[#F5F4F1] bg-[#987654] hover:bg-[#765B43] font-medium transition-colors"
                    >
                      Allocate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
