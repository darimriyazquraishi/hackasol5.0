import React, { useState } from 'react';
import {
  Workflow,
  Play,
  Square,
  RefreshCw,
  Sliders,
  Terminal,
  CheckCircle2,
  Clock,
  ArrowRight,
  Layers,
  Bot
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const WorkflowModule: React.FC = () => {
  const { workflowNodes } = useWorkspace();
  const [selectedNodeId, setSelectedNodeId] = useState(workflowNodes[2]?.id || workflowNodes[0]?.id);
  const [isRunning, setIsRunning] = useState(true);

  const activeNode = workflowNodes.find(n => n.id === selectedNodeId) || workflowNodes[0];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#080808] text-[#F5F4F1] font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#303030] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold font-mono tracking-tight text-[#F5F4F1]">
              AGENT WORKFLOW GRAPH
            </h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#191919] text-[#987654] border border-[#303030]">
              DAG PIPELINE
            </span>
          </div>
          <p className="text-xs text-[#9C9C9C] mt-1">
            Visual multi-agent coordination, intermediate artifact inspection, and verification bounds.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isRunning ? (
            <button
              onClick={() => setIsRunning(false)}
              className="px-3 py-1.5 rounded text-xs font-mono bg-[#191919] hover:bg-[#202020] text-[#D5D2CC] border border-[#303030] transition-colors flex items-center space-x-1.5"
            >
              <Square className="w-3.5 h-3.5 text-amber-500 fill-current" />
              <span>Halt Execution</span>
            </button>
          ) : (
            <button
              onClick={() => setIsRunning(true)}
              className="px-3 py-1.5 rounded text-xs font-mono bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1] transition-colors flex items-center space-x-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume Run</span>
            </button>
          )}
        </div>
      </div>

      {/* Visual Execution Graph (DAG Flow) */}
      <div className="p-6 rounded bg-[#121212] border border-[#303030] space-y-4">
        <div className="text-xs font-mono uppercase text-[#9C9C9C] flex items-center justify-between">
          <span>Pipeline Nodes</span>
          <span className="text-[#987654]">Pipeline Status: {isRunning ? 'Active Step 3/5' : 'Suspended'}</span>
        </div>

        {/* Nodes flow */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 overflow-x-auto py-4">
          {workflowNodes.map((node, idx) => {
            const isSelected = node.id === selectedNodeId;
            return (
              <React.Fragment key={node.id}>
                <div
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`w-full md:w-48 p-3 rounded cursor-pointer border transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-[#191919] border-[#987654] shadow-md'
                      : 'bg-[#191919] border-[#303030] hover:border-[#9C9C9C]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                    <span className="text-[#9C9C9C]">Node 0{idx + 1}</span>
                    {node.status === 'completed' && <span className="text-emerald-400 font-semibold">DONE</span>}
                    {node.status === 'running' && <span className="text-[#987654] font-semibold animate-pulse">RUNNING</span>}
                    {node.status === 'idle' && <span className="text-[#9C9C9C]">IDLE</span>}
                  </div>

                  <div className="font-semibold text-xs text-[#F5F4F1] truncate">
                    {node.name}
                  </div>

                  <div className="text-[10px] text-[#987654] font-mono uppercase mt-1">
                    {node.type}
                  </div>
                </div>

                {idx < workflowNodes.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-[#9C9C9C] shrink-0 hidden md:block" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Selected Node Details & Execution Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Node IO Inspector */}
        <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-4">
          <div className="flex items-center justify-between border-b border-[#303030] pb-2">
            <div>
              <h2 className="text-xs font-mono uppercase text-[#F5F4F1] font-semibold">
                {activeNode.name}
              </h2>
              <span className="text-[10px] font-mono text-[#987654] uppercase">
                {activeNode.type} Node
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400">Status: {activeNode.status}</span>
          </div>

          <p className="text-xs text-[#D5D2CC] leading-relaxed">
            {activeNode.description}
          </p>

          <div className="space-y-3 pt-2 text-xs font-mono">
            <div>
              <span className="text-[10px] text-[#9C9C9C] uppercase tracking-wider">Inputs</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {activeNode.inputs.map(inp => (
                  <span
                    key={inp}
                    className="px-2 py-0.5 rounded bg-[#080808] border border-[#303030] text-[11px] text-[#D5D2CC]"
                  >
                    {inp}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[#9C9C9C] uppercase tracking-wider">Outputs</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {activeNode.outputs.map(out => (
                  <span
                    key={out}
                    className="px-2 py-0.5 rounded bg-[#080808] border border-[#303030] text-[11px] text-[#987654]"
                  >
                    {out}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Node Execution Logs */}
        <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3 font-mono text-xs">
          <h2 className="text-xs uppercase text-[#9C9C9C] font-semibold flex items-center space-x-2">
            <Terminal className="w-3.5 h-3.5 text-[#987654]" />
            <span>Execution Telemetry</span>
          </h2>

          <div className="p-3 rounded bg-[#080808] border border-[#262626] h-48 overflow-y-auto space-y-1 text-[11px] text-[#9C9C9C] select-text">
            <div>[00:01.02] Dispatching input tensor to GPU slot #0</div>
            <div>[00:01.45] Cross-attention matrix calculated (12,480 tokens)</div>
            <div>[00:02.10] <span className="text-[#987654]">INSPECT</span> Generating candidate code solutions</div>
            <div>[00:02.89] Intermediate draft verified against unit test harness</div>
            <div>[00:03.12] Zero assertion failures detected</div>
            <div className="text-emerald-400">[00:03.40] Ready for downstream synthesizer handover</div>
          </div>
        </div>
      </div>
    </div>
  );
};
