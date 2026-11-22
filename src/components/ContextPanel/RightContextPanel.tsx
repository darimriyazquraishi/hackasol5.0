import React, { useState } from 'react';
import {
  X,
  Cpu,
  Layers,
  FileText,
  Activity,
  Terminal,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Lock,
  ExternalLink
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const RightContextPanel: React.FC = () => {
  const {
    rightContextOpen,
    setRightContextOpen,
    models,
    knowledgeCollections,
    activeFile
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'context' | 'model' | 'logs'>('context');

  if (!rightContextOpen) return null;

  const loadedModel = models.find(m => m.status === 'loaded') || models[0];

  return (
    <aside className="w-80 h-full bg-[#080808] border-l border-[#303030] flex flex-col justify-between shrink-0 select-none z-20 font-sans">
      {/* Top Header */}
      <div className="h-10 px-3 border-b border-[#303030] flex items-center justify-between text-xs bg-[#080808]">
        <div className="flex items-center space-x-1.5 font-medium text-[#F5F4F1]">
          <Activity className="w-3.5 h-3.5 text-[#987654]" />
          <span className="font-mono text-[11px] tracking-wider uppercase">Context & Model</span>
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
          Logs
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {activeTab === 'context' && (
          <div className="space-y-4">
            {/* Token Budget Gauge */}
            <div className="p-2.5 rounded bg-[#191919] border border-[#303030] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#9C9C9C] font-mono">Context Budget</span>
                <span className="text-[#987654] font-mono font-medium">
                  14,280 / 128,000 (11.1%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#080808] rounded-full overflow-hidden border border-[#303030]">
                <div className="h-full bg-[#987654] rounded-full" style={{ width: '11.1%' }} />
              </div>
              <div className="flex justify-between text-[10px] text-[#9C9C9C] font-mono pt-0.5">
                <span>Free: 113,720 tokens</span>
                <span>Limit: 128k</span>
              </div>
            </div>

            {/* Attached Sources */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#9C9C9C] font-semibold">
                Active Sources ({knowledgeCollections.length})
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
                        {col.chunkCount} chunks • {col.embeddingModel}
                      </div>
                    </div>
                    <span className="text-[10px] text-[#987654] font-mono shrink-0">
                      94% match
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Workspace File */}
            <div className="space-y-1.5 pt-2 border-t border-[#303030]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#9C9C9C] font-semibold">
                Editor Document
              </span>
              <div className="p-2 rounded bg-[#191919] border border-[#303030] flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#F5F4F1] truncate">
                  {activeFile ? activeFile.path : 'No file loaded'}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#080808] text-[#9C9C9C] border border-[#303030] font-mono">
                  {activeFile?.language || 'plaintext'}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'model' && (
          <div className="space-y-3">
            <div className="p-3 rounded bg-[#191919] border border-[#303030] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F5F4F1]">
                  {loadedModel.name}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#080808] text-[#987654] border border-[#303030]">
                  ACTIVE
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono text-[#D5D2CC] pt-1 border-t border-[#303030]">
                <div className="flex justify-between">
                  <span className="text-[#9C9C9C]">Architecture:</span>
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
                  <span className="text-[#9C9C9C]">VRAM Allocated:</span>
                  <span className="text-[#987654]">{loadedModel.vramRequired}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9C9C9C]">Throughput:</span>
                  <span>{loadedModel.tps} tokens/s</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded bg-[#191919] border border-[#303030] text-[10px] font-mono text-[#9C9C9C] space-y-1">
              <div className="flex items-center space-x-1.5 text-[#F5F4F1] font-semibold">
                <Lock className="w-3 h-3 text-[#987654]" />
                <span>Isolated Compute Guarantee</span>
              </div>
              <p className="leading-relaxed">
                Inference runs entirely within local GPU memory boundaries. Zero telemetry or network egress.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="h-full font-mono text-[11px] text-[#9C9C9C] space-y-1 select-text">
            <div>[22:50:11.412] <span className="text-[#987654]">INIT</span> LUMI sovereign runtime initialized</div>
            <div>[22:50:12.019] <span className="text-[#D5D2CC]">LOAD</span> Model LUMI-Core 70B allocated to VRAM</div>
            <div>[22:50:14.288] <span className="text-[#9C9C9C]">EMBED</span> Loaded BGE-Large-EN vector pipeline</div>
            <div>[22:51:02.104] <span className="text-emerald-500">READY</span> All 5 agent nodes ready for dispatch</div>
            <div>[22:53:18.992] <span className="text-[#987654]">AUDIT</span> Hallmark verification clean: 0 FAIL</div>
          </div>
        )}
      </div>

      {/* Bottom Footer Status */}
      <div className="p-2.5 border-t border-[#303030] text-[10px] font-mono text-[#9C9C9C] flex items-center justify-between bg-[#080808]">
        <span>Status: Nominal</span>
        <span className="text-[#987654]">38.4 tokens/s</span>
      </div>
    </aside>
  );
};
