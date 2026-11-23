import React, { useState } from 'react';
import {
  X,
  Cpu,
  Layers,
  FileText,
  Activity,
  Terminal,
  Lock
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const RightContextPanel: React.FC = () => {
  const {
    rightContextOpen,
    setRightContextOpen,
    models,
    knowledgeCollections,
    activeFile,
    hardwareProfile
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'context' | 'model' | 'logs'>('context');

  if (!rightContextOpen) return null;

  const loadedModel = models.find(m => m.status === 'loaded') || models[0] || {
    name: 'Local Model Engine',
    family: 'Local Inference Runtime',
    parameterSize: 'Dynamic',
    quantization: 'Native',
    vramRequired: 'Adaptive',
    tps: 0
  };

  return (
    <aside className="w-80 h-full bg-[#080808] border-l border-[#303030] flex flex-col justify-between shrink-0 select-none z-20 font-sans">
      {/* Top Header */}
      <div className="h-10 px-3 border-b border-[#303030] flex items-center justify-between text-xs bg-[#080808]">
        <div className="flex items-center space-x-1.5 font-medium text-[#F5F4F1]">
          <Activity className="w-3.5 h-3.5 text-[#987654]" />
          <span className="font-mono text-[11px] tracking-wider uppercase">Context & Telemetry</span>
        </div>

        <button
          onClick={() => setRightContextOpen(false)}
          title="Close Context Panel"
          className="p-1 rounded text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="h-8 border-b border-[#303030] flex items-center px-2 bg-[#191919]/40 text-xs">
        <button
          onClick={() => setActiveTab('context')}
          className={`flex-1 h-full border-b-2 text-[11px] font-mono uppercase tracking-wider transition-colors ${
            activeTab === 'context'
              ? 'border-[#987654] text-[#F5F4F1] font-semibold'
              : 'border-transparent text-[#9C9C9C] hover:text-[#D5D2CC]'
          }`}
        >
          Context
        </button>
        <button
          onClick={() => setActiveTab('model')}
          className={`flex-1 h-full border-b-2 text-[11px] font-mono uppercase tracking-wider transition-colors ${
            activeTab === 'model'
              ? 'border-[#987654] text-[#F5F4F1] font-semibold'
              : 'border-transparent text-[#9C9C9C] hover:text-[#D5D2CC]'
          }`}
        >
          Model
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 h-full border-b-2 text-[11px] font-mono uppercase tracking-wider transition-colors ${
            activeTab === 'logs'
              ? 'border-[#987654] text-[#F5F4F1] font-semibold'
              : 'border-transparent text-[#9C9C9C] hover:text-[#D5D2CC]'
          }`}
        >
          Telemetry
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {activeTab === 'context' && (
          <div className="space-y-4">
            {/* Active Document */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#9C9C9C] font-semibold">
                Active Editor Document
              </span>
              <div className="p-2.5 rounded bg-[#191919] border border-[#303030] flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#F5F4F1] truncate">
                  {activeFile ? activeFile.path : 'No active document'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#080808] text-[#9C9C9C] border border-[#303030] font-mono">
                  {activeFile?.language || 'plain'}
                </span>
              </div>
            </div>

            {/* Attached Sources */}
            {knowledgeCollections.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#9C9C9C] font-semibold">
                  Indexed Knowledge Documents ({knowledgeCollections.length})
                </span>
                <div className="space-y-1.5">
                  {knowledgeCollections.map(col => (
                    <div
                      key={col.id}
                      className="p-2 rounded bg-[#191919] border border-[#303030] flex items-start justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium text-[#F5F4F1] text-[11px] truncate">
                          {col.name}
                        </div>
                        <div className="text-[10px] text-[#9C9C9C] font-mono mt-0.5">
                          {col.chunkCount} chunk(s)
                        </div>
                      </div>
                      <span className="text-[11px] text-[#9C9C9C] shrink-0">
                        Indexed
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'model' && (
          <div className="space-y-3">
            <div className="p-3 rounded bg-[#191919] border border-[#303030] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F5F4F1]">
                  {loadedModel.name}
                </span>
                <span className="text-xs text-[#987654] font-medium">
                  {loadedModel.status === 'loaded' ? 'Active' : 'Configured'}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono text-[#D5D2CC] pt-1 border-t border-[#303030]">
                <div className="flex justify-between">
                  <span className="text-[#9C9C9C]">Family:</span>
                  <span>{loadedModel.family}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9C9C9C]">Parameters:</span>
                  <span>{loadedModel.parameterSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9C9C9C]">Quantization:</span>
                  <span>{loadedModel.quantization}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9C9C9C]">Footprint:</span>
                  <span className="text-[#987654]">{loadedModel.vramRequired}</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#191919] border border-[#303030] text-[10px] font-mono text-[#9C9C9C] space-y-1">
              <div className="flex items-center space-x-1.5 text-[#F5F4F1] font-semibold">
                <Lock className="w-3 h-3 text-[#987654]" />
                <span>Local GPU Residency</span>
              </div>
              <p className="leading-relaxed">
                Maximum safe allocation ceiling: {hardwareProfile.constraints.maxSafeVramGB || 3.2} GB on {hardwareProfile.gpu.name}.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="h-full font-mono text-[11px] text-[#9C9C9C] space-y-1.5 select-text">
            <div><span className="text-[#987654]">[SYSTEM]</span> Host: {hardwareProfile.os.platform} ({hardwareProfile.os.arch})</div>
            <div><span className="text-[#D5D2CC]">[GPU]</span> {hardwareProfile.gpu.name} ({hardwareProfile.gpu.totalVramMB} MB VRAM)</div>
            <div><span className="text-[#9C9C9C]">[CPU]</span> {hardwareProfile.cpu.model} ({hardwareProfile.cpu.cores}C/{hardwareProfile.cpu.threads}T)</div>
            <div><span className="text-[#987654]">[RAM]</span> {hardwareProfile.ram.totalGB} GB total ({hardwareProfile.ram.freeGB} GB free)</div>
            <div><span className="text-[#987654]">[IPC]</span> Local loopback socket active</div>
          </div>
        )}
      </div>

      {/* Bottom Footer Status */}
      <div className="p-2.5 border-t border-[#303030] text-[10px] font-mono text-[#9C9C9C] flex items-center justify-between bg-[#080808]">
        <span>Hardware Guard: Active</span>
        <span className="text-[#987654]">{hardwareProfile.tierLabel}</span>
      </div>
    </aside>
  );
};
