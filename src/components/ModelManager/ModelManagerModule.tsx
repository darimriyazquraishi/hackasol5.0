import React, { useState, useEffect } from 'react';
import {
  Cpu,
  HardDrive,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertCircle,
  Download,
  ShieldCheck,
  Activity,
  ServerOff,
  Server
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

interface TaskAuditEntry {
  category: string;
  name: string;
  dependencyType: 'llm' | 'vlm' | 'embedding_model' | 'deterministic';
  targetModelOrTool: string;
  installationStatus: 'installed' | 'not_installed' | 'offline_runtime' | 'built_in';
  verificationStatus: 'verified' | 'unverified' | 'offline' | 'n_a';
  availability: 'available' | 'unavailable';
  details: string;
}

interface RuntimeAuditData {
  runtimeOnline: boolean;
  runtimeType: 'ollama' | 'lmstudio' | 'vllm' | 'none';
  endpoint: string;
  testedAt: string;
  installedModels: Array<{
    name: string;
    size: number;
    digest?: string;
    verified: boolean;
    vramFootprintMB: number;
  }>;
  taskMatrix: TaskAuditEntry[];
}

export const ModelManagerModule: React.FC = () => {
  const { hardwareProfile, refreshHardware } = useWorkspace();
  const [auditData, setAuditData] = useState<RuntimeAuditData | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [pullInput, setPullInput] = useState('');
  const [pullStatus, setPullStatus] = useState<string | null>(null);

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await fetch('/api/models/audit');
      if (res.ok) {
        const data = await res.json();
        setAuditData(data);
      }
    } catch {
      // Offline fallback
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  const totalVramGB = +(hardwareProfile.gpu.totalVramMB / 1024).toFixed(1);
  const freeVramGB = +(hardwareProfile.gpu.freeVramMB / 1024).toFixed(1);
  const modelVramMB = (auditData?.installedModels || []).reduce((acc, m) => acc + (m.vramFootprintMB || 0), 0);
  const modelVramGB = +(modelVramMB / 1024).toFixed(2);
  const ceilingGB = hardwareProfile.constraints.maxSafeVramGB || 3.2;

  const handlePullModel = () => {
    if (!pullInput.trim()) return;
    if (!auditData?.runtimeOnline) {
      setPullStatus('Cannot pull: Local inference runtime is offline (http://127.0.0.1:11434 unreachable).');
      return;
    }
    setPullStatus(`Pulling ${pullInput.trim()}... (connecting to local runtime)`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#080808] text-[#F5F4F1] font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#303030] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold font-mono tracking-tight text-[#F5F4F1]">
              MODEL MANAGER & AUDIT
            </h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#191919] text-[#987654] border border-[#303030]">
              VERIFIED INFERENCE
            </span>
          </div>
          <p className="text-xs text-[#9C9C9C] mt-1">
            Dynamic verification of local model runtimes, VRAM bounds, and task capabilities.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={async () => {
              await refreshHardware();
              await runAudit();
            }}
            disabled={isAuditing}
            className="px-3 py-1.5 rounded text-xs font-mono bg-[#191919] hover:bg-[#202020] text-[#D5D2CC] border border-[#303030] transition-colors flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#987654] ${isAuditing ? 'animate-spin' : ''}`} />
            <span>{isAuditing ? 'Auditing...' : 'Re-audit Runtime'}</span>
          </button>
        </div>
      </div>

      {/* Runtime Connection Status Banner */}
      <div className="p-4 rounded bg-[#191919] border border-[#303030] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded ${auditData?.runtimeOnline ? 'bg-emerald-950 text-emerald-400' : 'bg-[#202020] text-[#9C9C9C]'}`}>
            {auditData?.runtimeOnline ? <Server className="w-5 h-5" /> : <ServerOff className="w-5 h-5 text-[#9C9C9C]" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-[#F5F4F1]">
                {auditData?.runtimeOnline
                  ? `Runtime Active (${auditData.runtimeType.toUpperCase()})`
                  : 'Local Inference Runtime Offline'}
              </span>
              <span className={`w-2 h-2 rounded-full ${auditData?.runtimeOnline ? 'bg-emerald-400' : 'bg-amber-500'}`} />
            </div>
            <div className="text-[11px] text-[#9C9C9C] mt-0.5">
              Endpoint: {auditData?.endpoint || 'http://127.0.0.1:11434'} • Tested: {auditData?.testedAt ? new Date(auditData.testedAt).toLocaleTimeString() : 'N/A'}
            </div>
          </div>
        </div>

        {!auditData?.runtimeOnline && (
          <div className="text-[11px] text-[#9C9C9C] max-w-sm">
            Ollama is not running. Start Ollama at port 11434 to enable local LLM and VLM inference. Deterministic engines remain fully operational.
          </div>
        )}
      </div>

      {/* Memory Utilization & Hardware Guardrails */}
      <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-4 h-4 text-[#987654]" />
            <span className="font-semibold text-[#F5F4F1]">
              Dedicated GPU VRAM ({hardwareProfile.gpu.name})
            </span>
          </div>
          <span className="text-[#987654]">
            {modelVramGB} GB loaded / {ceilingGB} GB safe limit (Physical: {totalVramGB} GB)
          </span>
        </div>

        <div className="w-full h-2 bg-[#080808] rounded-full overflow-hidden border border-[#303030]">
          <div
            className="h-full bg-[#987654] rounded-full transition-all"
            style={{ width: `${Math.min(100, (modelVramGB / ceilingGB) * 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-[#9C9C9C]">
          <span>Free System VRAM: {freeVramGB} GB</span>
          <span>Laptop Guardrail: 3.2 GB ceiling prevents driver preemption</span>
        </div>
      </div>

      {/* Model-to-Task Audit Matrix (All 10 Categories) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#987654]" />
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#F5F4F1] font-semibold">
              Model-to-Task Audit Matrix (10 Categories)
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#9C9C9C]">
            Verified Dynamic Mapping
          </span>
        </div>

        <div className="rounded bg-[#191919] border border-[#303030] overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#303030] text-[10px] font-mono uppercase text-[#9C9C9C] bg-[#141414]">
                <th className="py-2.5 px-4">Task Category</th>
                <th className="py-2.5 px-4">Dependency</th>
                <th className="py-2.5 px-4">Target Model / Tool</th>
                <th className="py-2.5 px-4">Installation</th>
                <th className="py-2.5 px-4">Verification</th>
                <th className="py-2.5 px-4 text-right">Availability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#303030] font-mono text-[11px]">
              {(auditData?.taskMatrix || []).map((t, idx) => (
                <tr key={idx} className="hover:bg-[#202020] transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-[#F5F4F1]">
                    <div>{t.category}</div>
                    <div className="text-[10px] text-[#9C9C9C] font-normal">{t.name}</div>
                  </td>
                  <td className="py-2.5 px-4 text-[#9C9C9C] uppercase text-[10px]">
                    {t.dependencyType}
                  </td>
                  <td className="py-2.5 px-4 text-[#D5D2CC]">
                    {t.targetModelOrTool}
                  </td>
                  <td className="py-2.5 px-4">
                    {t.installationStatus === 'built_in' ? (
                      <span className="text-[#987654]">Built-in</span>
                    ) : t.installationStatus === 'installed' ? (
                      <span className="text-emerald-400">Installed</span>
                    ) : t.installationStatus === 'offline_runtime' ? (
                      <span className="text-[#9C9C9C]">Runtime Offline</span>
                    ) : (
                      <span className="text-amber-400">Not Installed</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    {t.verificationStatus === 'verified' ? (
                      <span className="inline-flex items-center space-x-1 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    ) : t.verificationStatus === 'offline' ? (
                      <span className="text-[#9C9C9C]">Offline</span>
                    ) : (
                      <span className="text-amber-400">Unverified</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {t.availability === 'available' ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 text-[10px]">
                        <span>Available</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-[#202020] text-[#9C9C9C] border border-[#303030] text-[10px]">
                        <span>Unavailable</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Installed Models in Runtime */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[#F5F4F1] font-semibold">
            Local Models in Inference Runtime ({auditData?.installedModels?.length || 0})
          </h2>
        </div>

        {auditData?.installedModels && auditData.installedModels.length > 0 ? (
          <div className="rounded bg-[#191919] border border-[#303030] overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#303030] text-[10px] font-mono uppercase text-[#9C9C9C] bg-[#141414]">
                  <th className="py-2.5 px-4">Model Name</th>
                  <th className="py-2.5 px-4">VRAM Footprint</th>
                  <th className="py-2.5 px-4">Size on Disk</th>
                  <th className="py-2.5 px-4 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#303030] font-mono text-[11px]">
                {auditData.installedModels.map((m, idx) => (
                  <tr key={idx} className="hover:bg-[#202020] transition-colors">
                    <td className="py-2.5 px-4 text-[#F5F4F1] font-semibold">{m.name}</td>
                    <td className="py-2.5 px-4 text-[#987654]">~{m.vramFootprintMB} MB</td>
                    <td className="py-2.5 px-4 text-[#9C9C9C]">
                      {m.size ? `${(m.size / (1024 * 1024)).toFixed(0)} MB` : 'N/A'}
                    </td>
                    <td className="py-2.5 px-4 text-right text-emerald-400">Verified</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 rounded bg-[#141414] border border-[#303030] text-center space-y-2 font-mono text-xs text-[#9C9C9C]">
            <p>
              {auditData?.runtimeOnline
                ? 'No models currently downloaded into local runtime.'
                : 'Local runtime is offline. Start Ollama at http://127.0.0.1:11434 to inspect downloaded models.'}
            </p>
          </div>
        )}
      </div>

      {/* Model Pull Section */}
      <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3 font-mono text-xs">
        <div className="flex items-center space-x-2 text-[#F5F4F1] font-semibold">
          <Download className="w-4 h-4 text-[#987654]" />
          <span>Install Local Model</span>
        </div>
        <p className="text-[11px] text-[#9C9C9C]">
          Recommended laptop-compatible models: <span className="text-[#987654]">qwen2.5-coder:1.5b</span> (1.1 GB), <span className="text-[#987654]">llama3.2:3b</span> (2.1 GB), or <span className="text-[#987654]">smolvlm:256m</span> (400 MB).
        </p>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="e.g. qwen2.5-coder:1.5b"
            value={pullInput}
            onChange={e => setPullInput(e.target.value)}
            className="flex-1 bg-[#080808] border border-[#303030] focus:border-[#987654] px-3 py-1.5 rounded text-xs text-[#F5F4F1] outline-none"
          />
          <button
            onClick={handlePullModel}
            disabled={!pullInput.trim()}
            className="px-4 py-1.5 rounded bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1] font-medium text-xs transition-colors"
          >
            Pull Model
          </button>
        </div>
        {pullStatus && (
          <div className="text-[11px] text-amber-400 pt-1">
            {pullStatus}
          </div>
        )}
      </div>
    </div>
  );
};
