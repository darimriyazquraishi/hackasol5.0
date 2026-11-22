import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Copy,
  Check,
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
  Edit3,
  PanelLeft,
  Plus
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { APP_CONFIG } from '../../config';
import { MarkdownContent } from './MarkdownContent';
import {
  ChatMessage,
  ChatAttachment,
  GeneratedFilePreview,
  LumiWorkplan,
  CompilationResult
} from '../../types';

interface ChatModuleProps {
  isLandingView?: boolean;
}

/**
 * Heuristic to classify whether a prompt is a simple conversational query
 * or requires multi-agent orchestration and workplan approval (Requirement 4).
 */
function isComplexOrchestrationTask(prompt: string, attachments: ChatAttachment[]): boolean {
  // If user attached assets, it inherently requires multimodal parsing/vision
  if (attachments && attachments.length > 0) return true;

  const p = prompt.toLowerCase().trim();

  // Simple greetings and identity queries
  const isGreetingOrIdentity = /^(hi|hello|hey|greetings|who are you|what is lumi|introduce yourself|help)(\s+.*|\?|!)?$/i.test(p);
  if (isGreetingOrIdentity) return false;

  // General questions, explanations, factual queries, and hardware lookups
  const isFactualOrExplain = /^(what is|explain|define|tell me about|how does|why is|what are my hardware specs|check gpu|system specs)/i.test(p);
  if (isFactualOrExplain && !/refactor|develop a|build an? (app|system)|sandbox|synthesize|multi-agent|generate an? image/i.test(p)) {
    return false;
  }

  // Explicit complex multi-step tasks
  const asksForRefactorOrBuild = /refactor|scaffold|full-stack|multi-step|develop a (full|complete)|architecture design|build an? (app|application|system)|unit tests? for/i.test(p);
  const asksForSandboxVerification = /run (in|inside) sandbox|execute (in|with) sandbox|validate execution/i.test(p);
  const asksForImageGen = /generate (an? )?image|create (an? )?(picture|image|graphic)|diffusion|flux|draw/i.test(p);
  const asksForMultiAgent = /multi-agent|orchestrate|compile (a )?deliverable|workplan|synthesize documents/i.test(p);

  return Boolean(asksForRefactorOrBuild || asksForSandboxVerification || asksForImageGen || asksForMultiAgent);
}

export const ChatModule: React.FC<ChatModuleProps> = ({ isLandingView }) => {
  const {
    activeConversation,
    addMessageToActiveConversation,
    createFile,
    createConversation,
    toggleLeftNav
  } = useWorkspace();

  const [inputVal, setInputVal] = useState('');
  const [selectedReasoningModel] = useState('qwen3:8b');
  const [isGenerating, setIsGenerating] = useState(false);
  const [executingPlanId, setExecutingPlanId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editedPlan, setEditedPlan] = useState<LumiWorkplan | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const landingInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const messages = activeConversation?.messages || [];
  const showLanding = isLandingView !== undefined ? isLandingView : (messages.length === 0);

  useEffect(() => {
    if (!showLanding) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isGenerating, showLanding]);

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
   * Handle user message submission.
   * Simple queries route directly to /api/chat without workplans.
   * Complex tasks route to /api/orchestrate/plan for structured approval.
   */
  const handleSend = async () => {
    const text = inputVal.trim();
    if ((!text && attachments.length === 0) || isGenerating) return;

    const currentAttachments = [...attachments];
    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: text,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined
    };

    addMessageToActiveConversation(userMessage);
    setInputVal('');
    setAttachments([]);
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isComplex = isComplexOrchestrationTask(text, currentAttachments);

    try {
      if (!isComplex) {
        // Simple conversational route -> direct natural response
        const res = await fetch(APP_CONFIG.endpoints.chat, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: text,
            model: selectedReasoningModel
          }),
          signal: controller.signal
        });

        if (res.ok) {
          const data = await res.json();
          addMessageToActiveConversation({
            id: `asst-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: data.content || data.response || 'No response returned from model.',
            citations: data.citations
          });
        } else {
          const errData = await res.json().catch(() => ({}));
          addMessageToActiveConversation({
            id: `asst-${Date.now()}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: errData.content || errData.error || 'Failed to process message.'
          });
        }
      } else {
        // Complex multi-step task -> Stage 2 Workplan requiring approval
        const res = await fetch(APP_CONFIG.endpoints.orchestratePlan, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: text,
            attachments: currentAttachments,
            preferredReasoningModel: selectedReasoningModel
          }),
          signal: controller.signal
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
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addMessageToActiveConversation({
          id: `abort-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: 'Response generation cancelled.'
        });
      } else {
        addMessageToActiveConversation({
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: 'Unable to communicate with LUMI service. Please ensure the backend is running.'
        });
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  /**
   * Stage 3: Human Approval -> Stage 5, 6, 7: Execute Workplan
   */
  const handleApproveWorkplan = async (plan: LumiWorkplan) => {
    setIsGenerating(true);
    setExecutingPlanId(plan.id);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(APP_CONFIG.endpoints.orchestrateExecute, {
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
      const res = await fetch(APP_CONFIG.endpoints.codeExecute, {
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

  // ==========================================
  // 1. EXACT IMAGE 1 LANDING PAGE IMPLEMENTATION
  // ==========================================
  if (showLanding) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center relative overflow-hidden select-none">
        {/* Prominently centered LUMI Logo + L U M I wordmark matching Image 1 */}
        <div className="flex flex-col items-center justify-center -mt-10 sm:-mt-14 w-full max-w-4xl px-4">
          <img
            src="/lumi-logo.jpg"
            alt="LUMI"
            className="h-64 sm:h-72 md:h-80 lg:h-[300px] w-auto object-contain pointer-events-none select-none transition-transform"
          />

          {/* Centered Single Prompt Input Box matching Image 1 exactly */}
          <div className="w-[704px] max-w-[92vw] mt-10 sm:mt-12">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSend();
              }}
              className="relative w-full flex items-center h-[56px] bg-[#141414]/90 border border-[#2e2e2e] focus-within:border-[#3d3d3d] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] px-5 transition-colors"
            >
              <input
                ref={landingInputRef}
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder="Ask Lumi anything..."
                className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 text-[#F5F4F1] placeholder-[#737373] text-[15px] font-sans pr-14 caret-[#F5F4F1]"
                autoFocus
              />

              <button
                type="submit"
                disabled={isGenerating}
                className="absolute right-3 w-10 h-10 rounded-xl bg-[#c4a47c] hover:bg-[#b89569] active:scale-95 flex items-center justify-center text-[#141414] transition-all cursor-pointer shadow-sm shrink-0"
                title="Send message"
              >
                <Send className="w-4 h-4 text-[#141414]" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. CONVERSATION INTERFACE
  // ==========================================
  return (
    <div className="flex-1 flex flex-col h-full bg-[#080808] text-[#F5F4F1] font-sans overflow-hidden select-none">
      {/* Conversational Header Bar */}
      <div className="h-12 px-4 border-b border-[#303030] flex items-center justify-between bg-[#080808] shrink-0 z-20">
        <div className="flex items-center space-x-2.5 min-w-0">
          <button
            onClick={toggleLeftNav}
            title="Toggle Sidebar"
            className="p-1 rounded text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919] transition-colors"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <div className="w-2 h-2 rounded-full bg-[#987654] shrink-0" />
          <h1 className="text-xs font-mono font-semibold tracking-wide text-[#F5F4F1] truncate">
            {activeConversation?.title || 'Intelligence Chat'}
          </h1>
        </div>

        <button
          onClick={createConversation}
          title="New Conversation (Reset to landing screen)"
          className="px-2.5 py-1 rounded bg-[#191919] hover:bg-[#222222] text-[#D5D2CC] hover:text-[#F5F4F1] border border-[#303030] text-xs font-mono flex items-center space-x-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-[#987654]" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 select-text">
        <div className="max-w-3xl mx-auto space-y-6">
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
                className={`p-4 rounded-xl text-xs leading-relaxed max-w-2xl space-y-3 ${
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

                {/* Markdown Answer Rendering */}
                <MarkdownContent content={msg.content} onExecuteCode={handleRunCodeInSandbox} />

                {/* Citations if available */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="pt-2 border-t border-[#262626] space-y-1 font-mono text-[11px]">
                    <div className="text-[10px] uppercase text-[#987654] font-semibold">Source Citations</div>
                    {msg.citations.map(c => (
                      <div key={c.id} className="p-2 rounded bg-[#080808] border border-[#262626] text-[#9C9C9C]">
                        <span className="text-[#F5F4F1] font-medium">{c.file}</span> ({c.section}) — {c.snippet}
                      </div>
                    ))}
                  </div>
                )}

                {/* Stage 3: Human Approval of Workplan Interface */}
                {msg.lumiWorkplan && msg.isApprovalPrompt && (
                  <div className="mt-3 p-4 rounded-xl bg-[#080808] border border-[#987654]/60 space-y-4 font-sans">
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
                    <div className="p-3.5 rounded-xl bg-[#080808] border border-[#303030] space-y-2 font-mono text-xs">
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
                          <div key={idx} className="rounded-lg bg-[#080808] border border-[#303030] overflow-hidden">
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
                            className="p-3 rounded-xl bg-[#080808] border border-[#303030] flex items-center justify-between"
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
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#141414] border border-[#303030] text-xs font-mono text-[#987654] max-w-sm">
              <div className="flex items-center space-x-2.5">
                <div className="w-3.5 h-3.5 rounded-full border border-[#987654] border-t-transparent animate-spin" />
                <span>Processing with LUMI...</span>
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

      {/* Stage 1 Interactive Composer Section (In Conversation View) */}
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

          <div className="bg-[#141414]/90 border border-[#2a2a2a] focus-within:border-[#3d3d3d] rounded-2xl p-3 shadow-lg transition-colors">
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
              placeholder="Ask Lumi anything..."
              className="w-full bg-transparent border-none outline-none text-xs text-[#F5F4F1] placeholder-[#6e6e6e] resize-none font-sans leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#222222] text-xs">
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
                    className={`px-3 py-1 rounded-xl text-xs font-medium font-sans flex items-center space-x-1.5 transition-colors ${
                      inputVal.trim() || attachments.length > 0
                        ? 'bg-[#c4a47c] hover:bg-[#b89569] text-[#141414]'
                        : 'bg-[#222222] text-[#6e6e6e] cursor-not-allowed'
                    }`}
                  >
                    <span>Send</span>
                    <Send className="w-3 h-3 text-[#141414]" />
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
