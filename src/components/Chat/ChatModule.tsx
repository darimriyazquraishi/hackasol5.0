import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Copy,
  Check,
  Cpu,
  ChevronDown,
  FileText,
  ArrowUp,
  Square,
  X,
  Download,
  Code2,
  FileSpreadsheet,
  FileImage,
  FileCode,
  File,
  AlertCircle,
  Play,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Edit3
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  ChatMessage,
  ChatAttachment,
  GeneratedFilePreview,
  LumiWorkplan,
  CompilationResult
} from '../../types';

export const ChatModule: React.FC = () => {
  const {
    activeConversation,
    addMessageToActiveConversation,
    createFile,
    navigateToSettings
  } = useWorkspace();

  const [inputVal, setInputVal] = useState('');
  const [selectedReasoningModel, setSelectedReasoningModel] = useState('qwen3:8b');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [executingPlanId, setExecutingPlanId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editedPlan, setEditedPlan] = useState<LumiWorkplan | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, isGenerating]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: ChatAttachment[] = Array.from(files).map((file, idx) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

      return {
        id: `att-${Date.now()}-${idx}`,
        name: file.name,
        size: sizeStr,
        type: ext
      };
    });

    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setExecutingPlanId(null);
  };

  /**
   * Stage 1 -> Stage 2: Submit task and generate Workplan
   */
  const handleSend = async () => {
    const text = inputVal.trim();
    if ((!text && attachments.length === 0) || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: text,
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };

    addMessageToActiveConversation(userMessage);
    setInputVal('');
    const currentAttachments = [...attachments];
    setAttachments([]);
    setIsGenerating(true);

    try {
      // Call Stage 2: Capability Analysis & Workplan Generation
      const res = await fetch('/api/orchestrate/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          attachments: currentAttachments,
          preferredReasoningModel: selectedReasoningModel
        })
      });

      if (res.ok) {
        const data = await res.json();
        const plan: LumiWorkplan = data.workplan;

        const planMessage: ChatMessage = {
          id: `plan-msg-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: 'LUMI has analyzed the capabilities required for this task and prepared a structured workplan for review.',
          lumiWorkplan: plan,
          isApprovalPrompt: true
        };
        addMessageToActiveConversation(planMessage);
      } else {
        const errData = await res.json().catch(() => ({}));
        addMessageToActiveConversation({
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: errData.error || 'Failed to analyze task capabilities.'
        });
      }
    } catch {
      addMessageToActiveConversation({
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: 'Unable to communicate with orchestration engine. Please ensure the backend server is running.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Stage 3: Human Approval -> Stage 5, 6, 7, 8: Execute Workplan
   */
  const handleApproveWorkplan = async (plan: LumiWorkplan) => {
    setIsGenerating(true);
    setExecutingPlanId(plan.id);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/orchestrate/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workplan: plan,
          prompt: plan.taskInterpretation,
          attachments
        }),
        signal: controller.signal
      });

      if (res.ok) {
        const data = await res.json();
        const deliverable: CompilationResult = data.deliverable;
        const updatedPlan: LumiWorkplan = data.executedWorkplan;

        const deliverableMessage: ChatMessage = {
          id: `deliv-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: deliverable.content,
          lumiWorkplan: updatedPlan,
          compiledResult: deliverable,
          citations: deliverable.citations,
          generatedFiles: deliverable.files
        };
        addMessageToActiveConversation(deliverableMessage);
      } else {
        const err = await res.json().catch(() => ({}));
        addMessageToActiveConversation({
          id: `err-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: `Execution validation halted: ${err.error || 'Execution encountered an unrecoverable state.'}`
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addMessageToActiveConversation({
          id: `abort-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: 'Workplan execution cancelled by user.'
        });
      } else {
        addMessageToActiveConversation({
          id: `err-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: `Execution failed: ${err.message}`
        });
      }
    } finally {
      setIsGenerating(false);
      setExecutingPlanId(null);
      abortControllerRef.current = null;
    }
  };

  const handleCancelWorkplan = (planId: string) => {
    addMessageToActiveConversation({
      id: `cancel-${Date.now()}`,
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: 'Execution cancelled. Workplan rejected by user.'
    });
  };

  const handleRunCodeInSandbox = async (code: string, language: string = 'javascript') => {
    try {
      const res = await fetch('/api/code/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language })
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Execution Result (Exit Code ${data.exitCode}, ${data.durationMs}ms):\n${data.stdout || data.stderr}`);
      }
    } catch (err: any) {
      alert(`Sandbox execution failed: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDownloadGeneratedFile = (file: GeneratedFilePreview) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenFileInIDE = (file: GeneratedFilePreview) => {
    createFile('/', file.name, file.content);
  };

  const getFileIcon = (ext: string) => {
    switch (ext.toLowerCase()) {
      case 'pdf':
      case 'docx':
      case 'txt':
        return <FileText className="w-4 h-4 text-[#987654]" />;
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
        return <FileImage className="w-4 h-4 text-sky-400" />;
      case 'ts':
      case 'tsx':
      case 'js':
      case 'json':
      case 'py':
        return <FileCode className="w-4 h-4 text-amber-400" />;
      default:
        return <File className="w-4 h-4 text-[#9C9C9C]" />;
    }
  };

  const messages = activeConversation?.messages || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080808] text-[#F5F4F1] font-sans overflow-hidden select-none">
      {/* 1. Header Bar: Model Selector Dropdown (Qwen3 Variants) */}
      <div className="h-12 px-4 border-b border-[#303030] flex items-center justify-between bg-[#080808] shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="px-2.5 py-1 rounded bg-[#191919] hover:bg-[#202020] border border-[#303030] text-xs font-mono text-[#F5F4F1] flex items-center space-x-2 transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-[#987654]" />
              <span>Reasoning: {selectedReasoningModel}</span>
              <ChevronDown className="w-3 h-3 text-[#9C9C9C]" />
            </button>

            {modelDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-[#191919] border border-[#303030] rounded shadow-2xl py-1 text-xs z-50">
                <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#9C9C9C] border-b border-[#262626]">
                  Configured Reasoning Models
                </div>
                {[
                  { id: 'qwen3:8b', label: 'Qwen3 8B (Default)' },
                  { id: 'qwen3:14b', label: 'Qwen3 14B (Mid-Tier)' },
                  { id: 'qwen3:32b', label: 'Qwen3 32B (High-Capacity)' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedReasoningModel(m.id);
                      setModelDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-[#202020] transition-colors ${
                      selectedReasoningModel === m.id ? 'text-[#987654] font-medium' : 'text-[#D5D2CC]'
                    }`}
                  >
                    <span>{m.label}</span>
                    {selectedReasoningModel === m.id && <Check className="w-3.5 h-3.5 text-[#987654]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-2 font-mono text-[11px] text-[#9C9C9C]">
          <span>Orchestrator</span>
          <span>•</span>
          <span className="text-[#987654]">127.0.0.1:3000</span>
        </div>
      </div>

      {/* 2. Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 select-text">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Minimal Empty State with Exact Supplied Logo */}
          {messages.length === 0 && (
            <div className="py-24 text-center space-y-4">
              <div className="flex justify-center">
                <img
                  src="/lumi-logo.jpg"
                  alt="LUMI"
                  className="h-14 object-contain"
                />
              </div>
              <p className="text-xs text-[#9C9C9C] max-w-sm mx-auto">
                Submit a task with text, code, or document attachments. LUMI will analyze capabilities and generate a workplan for your approval.
              </p>
            </div>
          )}

          {/* Render All Messages */}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col space-y-1.5 ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="text-[10px] font-mono text-[#9C9C9C] px-1">
                {msg.sender === 'user' ? 'You' : 'LUMI'} • {msg.timestamp}
              </div>

              <div
                className={`p-4 rounded text-xs leading-relaxed max-w-2xl space-y-3 ${
                  msg.sender === 'user'
                    ? 'bg-[#191919] text-[#F5F4F1] border border-[#303030]'
                    : 'bg-[#121212] text-[#D5D2CC] border border-[#262626] w-full'
                }`}
              >
                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-1">
                    {msg.attachments.map(att => (
                      <div
                        key={att.id}
                        className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#080808] border border-[#303030] text-[10px] font-mono text-[#F5F4F1]"
                      >
                        {getFileIcon(att.type)}
                        <span>{att.name}</span>
                        <span className="text-[#9C9C9C]">({att.size})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct content */}
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Stage 3: Human Approval of Workplan Interface */}
                {msg.lumiWorkplan && msg.isApprovalPrompt && (
                  <div className="mt-3 p-4 rounded bg-[#080808] border border-[#987654]/60 space-y-4 font-sans">
                    <div className="flex items-center justify-between border-b border-[#262626] pb-2.5">
                      <div className="flex items-center space-x-2">
                        <Layers className="w-4 h-4 text-[#987654]" />
                        <span className="font-mono text-xs font-bold text-[#F5F4F1]">
                          STAGE 2 WORKPLAN: HUMAN APPROVAL REQUIRED
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#191919] text-[#987654] border border-[#303030] uppercase">
                        {msg.lumiWorkplan.status}
                      </span>
                    </div>

                    {/* Task Interpretation */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono uppercase text-[#9C9C9C]">Task Interpretation</div>
                      <p className="text-xs text-[#F5F4F1] bg-[#141414] p-2.5 rounded border border-[#222222]">
                        {msg.lumiWorkplan.taskInterpretation}
                      </p>
                    </div>

                    {/* Selected Agents & Models */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-mono uppercase text-[#9C9C9C]">Selected Agents & Models</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.lumiWorkplan.selectedAgents.map(ag => (
                          <div key={ag} className="p-2 rounded bg-[#141414] border border-[#222222] flex items-center justify-between text-[11px] font-mono">
                            <span className="text-[#F5F4F1] font-medium capitalize">{ag.replace('_', ' ')}</span>
                            <span className="text-[#987654] text-[10px]">{msg.lumiWorkplan?.selectedModels[ag]}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Execution Sequence & Dependencies */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-mono uppercase text-[#9C9C9C]">Execution Sequence</div>
                      <div className="space-y-1.5">
                        {msg.lumiWorkplan.executionSequence.map((step, idx) => (
                          <div key={step.id} className="p-2.5 rounded bg-[#141414] border border-[#222222] space-y-1 text-xs">
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <div className="flex items-center space-x-2">
                                <span className="text-[#987654]">0{idx + 1}.</span>
                                <span className="font-semibold text-[#F5F4F1]">{step.name}</span>
                              </div>
                              <span className="text-[10px] text-[#9C9C9C] uppercase">{step.model}</span>
                            </div>
                            <p className="text-[11px] text-[#9C9C9C]">{step.description}</p>
                            {step.dependencies.length > 0 && (
                              <div className="text-[10px] font-mono text-[#987654]">
                                Depends on: {step.dependencies.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Expected Deliverables */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono uppercase text-[#9C9C9C]">Expected Deliverables</div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.lumiWorkplan.expectedDeliverables.map(deliv => (
                          <span key={deliv} className="px-2 py-0.5 rounded bg-[#191919] border border-[#303030] text-[10px] font-mono text-[#D5D2CC]">
                            {deliv}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Controls: Approve, Edit, Cancel */}
                    {executingPlanId !== msg.lumiWorkplan.id && (
                      <div className="flex items-center space-x-2.5 pt-2 border-t border-[#262626]">
                        <button
                          onClick={() => handleApproveWorkplan(msg.lumiWorkplan!)}
                          disabled={isGenerating}
                          className="px-4 py-2 rounded bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1] font-mono text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Approve Workplan</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingPlanId(msg.lumiWorkplan!.id);
                            setEditedPlan(JSON.parse(JSON.stringify(msg.lumiWorkplan)));
                          }}
                          className="px-3 py-2 rounded bg-[#191919] hover:bg-[#202020] text-[#D5D2CC] border border-[#303030] font-mono text-xs flex items-center space-x-1 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Workplan</span>
                        </button>

                        <button
                          onClick={() => handleCancelWorkplan(msg.lumiWorkplan!.id)}
                          className="px-3 py-2 rounded bg-[#191919] hover:bg-[#202020] text-[#9C9C9C] hover:text-red-400 border border-[#303030] font-mono text-xs transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Stage 6 & 7: Compilation Deliverables & Validation Output */}
                {msg.compiledResult && (
                  <div className="mt-4 space-y-4">
                    {/* Validation Report Banner */}
                    <div className="p-3.5 rounded bg-[#080808] border border-[#303030] space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between border-b border-[#262626] pb-2">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className={`w-4 h-4 ${msg.compiledResult.validation.passed ? 'text-emerald-400' : 'text-amber-400'}`} />
                          <span className="font-semibold text-[#F5F4F1]">STAGE 7 VALIDATION REPORT</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${
                          msg.compiledResult.validation.passed
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                            : 'bg-amber-950/60 text-amber-400 border-amber-800'
                        }`}>
                          {msg.compiledResult.validation.passed ? 'Validation Passed' : 'Validation Warnings'}
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {msg.compiledResult.validation.checks.map(check => (
                          <div key={check.name} className="flex items-center justify-between text-[11px]">
                            <span className="text-[#D5D2CC]">{check.name}</span>
                            <span className={check.passed ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                              {check.passed ? 'PASSED' : 'FLAGGED'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {msg.compiledResult.validation.errors.length > 0 && (
                        <div className="pt-2 border-t border-[#262626] text-amber-400 text-[10px] space-y-1">
                          {msg.compiledResult.validation.errors.map((e, idx) => (
                            <div key={idx}>• {e}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Code Snippets with Sandbox Run Action */}
                    {msg.compiledResult.codeSnippets && msg.compiledResult.codeSnippets.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono uppercase text-[#9C9C9C]">Verified Code Snippets</div>
                        {msg.compiledResult.codeSnippets.map((cs, idx) => (
                          <div key={idx} className="rounded bg-[#080808] border border-[#303030] overflow-hidden">
                            <div className="px-3 py-1.5 bg-[#141414] border-b border-[#303030] flex items-center justify-between font-mono text-[11px]">
                              <span className="text-[#987654]">{cs.language}</span>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleRunCodeInSandbox(cs.code, cs.language)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-[#191919] hover:bg-[#202020] text-emerald-400 border border-[#303030] flex items-center space-x-1"
                                >
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                  <span>Execute in Sandbox</span>
                                </button>
                                <button
                                  onClick={() => copyToClipboard(cs.code, `code-${idx}`)}
                                  className="text-[10px] text-[#9C9C9C] hover:text-[#F5F4F1] flex items-center space-x-1"
                                >
                                  {copiedId === `code-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  <span>Copy</span>
                                </button>
                              </div>
                            </div>
                            <pre className="p-3 font-mono text-[11px] text-[#F5F4F1] overflow-x-auto leading-relaxed">
                              <code>{cs.code}</code>
                            </pre>
                            {cs.executionResult && (
                              <div className="p-2.5 bg-[#141414] border-t border-[#262626] font-mono text-[10px] text-emerald-400">
                                Sandbox Output: {cs.executionResult}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Compiled Artifact Files */}
                    {msg.compiledResult.files && msg.compiledResult.files.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono uppercase text-[#9C9C9C]">Compiled Deliverable Files</div>
                        {msg.compiledResult.files.map(gen => (
                          <div
                            key={gen.id}
                            className="p-3 rounded bg-[#080808] border border-[#303030] flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                              {getFileIcon(gen.type)}
                              <div className="min-w-0">
                                <div className="font-mono text-xs text-[#F5F4F1] font-medium truncate">{gen.name}</div>
                                <div className="text-[10px] text-[#9C9C9C]">{gen.size} • {gen.description}</div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1.5 shrink-0">
                              <button
                                onClick={() => handleOpenFileInIDE(gen)}
                                className="px-2 py-1 rounded bg-[#191919] hover:bg-[#202020] border border-[#303030] text-[11px] font-mono text-[#D5D2CC] hover:text-[#F5F4F1] transition-colors flex items-center space-x-1"
                              >
                                <Code2 className="w-3 h-3 text-[#987654]" />
                                <span>Edit in IDE</span>
                              </button>
                              <button
                                onClick={() => handleDownloadGeneratedFile(gen)}
                                className="px-2 py-1 rounded bg-[#987654] hover:bg-[#765B43] text-[11px] font-mono text-[#F5F4F1] transition-colors flex items-center space-x-1"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Real-time Generating Indicator with Stop Button */}
          {isGenerating && (
            <div className="flex items-center justify-between p-3 rounded bg-[#141414] border border-[#303030] text-xs font-mono text-[#987654] max-w-sm">
              <div className="flex items-center space-x-2.5">
                <div className="w-3.5 h-3.5 rounded-full border border-[#987654] border-t-transparent animate-spin" />
                <span>Orchestrating agents...</span>
              </div>
              <button
                onClick={handleStopGeneration}
                className="px-2.5 py-1 rounded bg-[#080808] hover:bg-[#202020] text-red-400 border border-[#303030] text-[11px] flex items-center space-x-1"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 3. Stage 1 Interactive Composer Section */}
      <div className="p-4 border-t border-[#303030] bg-[#080808] shrink-0">
        <div className="max-w-3xl mx-auto">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map(att => (
                <div
                  key={att.id}
                  className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#191919] border border-[#303030] text-[11px] font-mono text-[#F5F4F1]"
                >
                  {getFileIcon(att.type)}
                  <span className="truncate max-w-[160px]">{att.name}</span>
                  <span className="text-[10px] text-[#9C9C9C]">({att.size})</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="p-0.5 rounded hover:bg-[#262626] text-[#9C9C9C] hover:text-[#F5F4F1]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
            className="hidden"
          />

          <div className="bg-[#191919] border border-[#303030] focus-within:border-[#987654] rounded p-2.5 transition-colors">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Submit task or upload images/code (Stage 1 Interactive Layer)..."
              className="w-full bg-transparent border-none outline-none text-xs text-[#F5F4F1] placeholder-[#9C9C9C] resize-none font-sans leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#262626] text-xs">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach Document or Image"
                className="p-1 hover:text-[#F5F4F1] hover:bg-[#202020] rounded text-[#9C9C9C] transition-colors flex items-center space-x-1 text-[11px] font-mono"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Attach Asset</span>
              </button>

              <div className="flex items-center space-x-2">
                {isGenerating ? (
                  <button
                    onClick={handleStopGeneration}
                    className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 flex items-center space-x-1 transition-colors"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!inputVal.trim() && attachments.length === 0}
                    className={`px-3 py-1 rounded text-xs font-medium font-mono flex items-center space-x-1 transition-colors ${
                      inputVal.trim() || attachments.length > 0
                        ? 'bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1]'
                        : 'bg-[#262626] text-[#9C9C9C] cursor-not-allowed'
                    }`}
                  >
                    <span>Analyze & Plan</span>
                    <ArrowUp className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
