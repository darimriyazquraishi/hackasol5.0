import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Copy,
  Check,
  FileText,
  Square,
  X,
  Download,
  Code2,
  FileSpreadsheet,
  FileImage,
  FileCode,
  File,
  Play,
  CheckCircle2,
  Layers,
  Edit3,
  PanelLeft,
  Presentation,
  Sparkles,
  Save,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  BookOpen
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { APP_CONFIG } from '../../config';
import { MarkdownContent } from './MarkdownContent';
import { SendButton, LumiButton } from '../Common/Button';
import {
  ChatMessage,
  ChatAttachment,
  GeneratedFilePreview,
  LumiWorkplan,
  LumiWorkflowStep,
  CompilationResult
} from '../../types';

interface ChatModuleProps {
  isLandingView?: boolean;
}

export const ChatModule: React.FC<ChatModuleProps> = () => {
  const {
    activeConversation,
    addMessageToActiveConversation,
    createConversation,
    deleteConversation,
    clearActiveConversation,
    createFile,
    toggleLeftNav,
    setActiveModule
  } = useWorkspace();

  const [inputVal, setInputVal] = useState('');
  const [selectedReasoningModel] = useState('qwen2.5:1.5b');
  const [isGenerating, setIsGenerating] = useState(false);
  const [executingPlanId, setExecutingPlanId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClearChat, setConfirmClearChat] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editedInterpretation, setEditedInterpretation] = useState('');
  const [editedDeliverables, setEditedDeliverables] = useState('');
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [editedSteps, setEditedSteps] = useState<LumiWorkflowStep[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const messages = activeConversation?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isGenerating]);

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
   * Stage 1: User message submission.
   * MANDATORY WORKPLAN: Every prompt, without exception, prepares a structured
   * workplan for review before any execution takes place (Part 1).
   */
  const handleSend = async (overrideText?: string) => {
    const text = (overrideText !== undefined ? overrideText : inputVal).trim();
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

    try {
      // Stage 2: Capability Analysis & Workplan Generation
      const historyItems = messages.slice(-10).map(m => ({
        sender: m.sender,
        content: m.content,
        originalPrompt: m.lumiWorkplan?.originalPrompt || m.lumiWorkplan?.taskInterpretation || m.content,
        generatedSubject: m.generatedImages?.[0]?.subject || (m.compiledResult?.files?.[0]?.name ? m.compiledResult.title : undefined),
        deliverableFormat: m.lumiWorkplan?.decomposition?.requestedOutputFormat
      }));

      const planPromise = fetch(APP_CONFIG.endpoints.orchestratePlan, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          attachments: currentAttachments,
          conversationHistory: historyItems,
          preferredReasoningModel: selectedReasoningModel
        }),
        signal: controller.signal
      });

      // Deliberate 1.5s thinking delay to show "LUMI is thinking..." state before revealing workplan
      const thinkingDelay = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 1500);
        controller.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

      const [res] = await Promise.all([planPromise, thinkingDelay]);

      if (res.ok) {
        const data = await res.json();
        const plan: LumiWorkplan = data.workplan;

        const planMessage: ChatMessage = {
          id: `plan-msg-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: '**Workplan Summary** — Key objectives & execution points:',
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
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addMessageToActiveConversation({
          id: `abort-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: 'Workplan analysis cancelled.'
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
      const historyItems = messages.slice(-10).map(m => ({
        sender: m.sender,
        content: m.content,
        originalPrompt: m.lumiWorkplan?.originalPrompt || m.lumiWorkplan?.taskInterpretation || m.content,
        generatedSubject: m.generatedImages?.[0]?.subject
      }));

      const res = await fetch(APP_CONFIG.endpoints.orchestrateExecute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workplan: plan,
          prompt: plan.originalPrompt || plan.taskInterpretation,
          attachments,
          conversationHistory: historyItems
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

  /**
   * Action: Reject Workplan
   */
  const handleRejectWorkplan = (planId: string) => {
    addMessageToActiveConversation({
      id: `reject-${Date.now()}`,
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: 'Execution cancelled. Workplan rejected by user.'
    });
  };

  const handleToggleStepExpand = (stepId: string) => {
    setExpandedStepId(prev => (prev === stepId ? null : stepId));
  };

  const handleUpdateStep = (stepId: string, updates: Partial<any>) => {
    setEditedSteps(prev => prev.map(s => (s.id === stepId ? { ...s, ...updates } : s)));
  };

  const handleAddStep = () => {
    const newId = `step-${Date.now()}`;
    setEditedSteps(prev => [
      ...prev,
      {
        id: newId,
        stageNumber: prev.length + 1,
        name: 'Custom Inspection Stage',
        agent: 'reasoning_synthesis',
        model: 'qwen2.5:1.5b',
        description: 'Execute custom verification and technical audit.',
        actions: ['Execute specific user-defined validation criteria.'],
        inputs: 'Preceding stage outputs.',
        dependencies: prev.length > 0 ? [prev[prev.length - 1].id] : [],
        expectedOutput: 'Verified operational deliverable.',
        validationCriteria: 'Verification checks passed.',
        status: 'pending'
      }
    ]);
  };

  const handleRemoveStep = (stepId: string) => {
    setEditedSteps(prev => prev.filter(s => s.id !== stepId));
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    setEditedSteps(prev => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  /**
   * Action: Save In-Place Edited Workplan & Execute
   */
  const handleSaveAndApproveEditedPlan = (originalPlan: LumiWorkplan) => {
    const modifiedPlan: LumiWorkplan = {
      ...originalPlan,
      taskInterpretation: editedInterpretation.trim() || originalPlan.taskInterpretation,
      executionSequence: editedSteps.length > 0 ? editedSteps : originalPlan.executionSequence,
      expectedDeliverables: editedDeliverables.trim()
        ? editedDeliverables.split(',').map(d => d.trim()).filter(Boolean)
        : originalPlan.expectedDeliverables
    };
    setEditingPlanId(null);
    handleApproveWorkplan(modifiedPlan);
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
    if (file.downloadUrl) {
      const a = document.createElement('a');
      a.href = file.downloadUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const binaryExts = ['pptx', 'xlsx', 'docx', 'pdf'];
    if (binaryExts.includes(file.type.toLowerCase())) {
      try {
        const cleanBase64 = file.content.replace(/^data:[^;]+;base64,/, '');
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const mimeMap: Record<string, string> = {
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          pdf: 'application/pdf'
        };
        const blob = new Blob([byteArray], { type: mimeMap[file.type.toLowerCase()] || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      } catch (e) {
        console.error('Binary decode failed, falling back to text blob:', e);
      }
    }

    const blob = new Blob([file.content], { type: file.type === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8' });
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
    setActiveModule('ide');
  };

  const getFileIcon = (ext: string) => {
    switch (ext.toLowerCase()) {
      case 'pptx':
      case 'ppt':
        return <Presentation className="w-4 h-4 text-amber-500" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
      case 'docx':
      case 'doc':
      case 'pdf':
      case 'txt':
        return <FileText className="w-4 h-4 text-[#987654]" />;
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080808] text-[#F5F4F1] font-sans overflow-hidden select-none">
      {/* 1. Conversational Header Bar (Persistent across empty and conversation states) */}
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
          <h1 className="text-xs font-display font-normal tracking-wide text-[#F5F4F1] truncate">
            {activeConversation?.title || 'Intelligence Chat'}
          </h1>
        </div>

        {/* Chat Control Actions: New Chat & Delete / Clear Chat */}
        <div className="flex items-center space-x-2">
          <button
            onClick={createConversation}
            title="Start New Conversation"
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded bg-[#191919] hover:bg-[#202020] text-[#F5F4F1] border border-[#303030] transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#987654]" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          {confirmClearChat ? (
            <div className="flex items-center space-x-1.5 bg-red-950/80 border border-red-800/80 rounded px-2 py-1">
              <span className="text-[11px] text-red-200">Delete chat?</span>
              <button
                onClick={() => {
                  if (activeConversation) {
                    deleteConversation(activeConversation.id);
                  } else {
                    clearActiveConversation();
                  }
                  setConfirmClearChat(false);
                }}
                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmClearChat(false)}
                className="px-1.5 py-0.5 text-[10px] rounded bg-[#202020] hover:bg-[#282828] text-[#9C9C9C] transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClearChat(true)}
              title="Delete or clear this conversation"
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded bg-[#191919] hover:bg-red-950/40 hover:text-red-300 text-[#9C9C9C] border border-[#303030] hover:border-red-900/60 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Delete Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Message Stream / Empty Welcome State */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 select-text">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Initial Welcome Hero when conversation has zero messages */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-10 pb-12 select-none text-center">
              <img
                src="/lumi-logo.jpg"
                alt="LUMI"
                className="h-32 sm:h-36 w-32 sm:w-36 object-contain pointer-events-none select-none transition-transform mb-3"
              />
              <h2 className="text-2xl font-display font-normal tracking-widest text-[#F5F4F1] uppercase">
                L U M I
              </h2>
              <p className="mt-1 text-xs text-[#9C9C9C] max-w-md leading-relaxed">
                Local multimodal intelligence workbench. Plan, verify, and run engineering workflows on local models.
              </p>
            </div>
          )}

          {/* Render All Messages in Conversation */}
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

                {/* Generated Authentic Images */}
                {msg.generatedImages && msg.generatedImages.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-[#262626]">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#987654] font-semibold flex items-center space-x-1.5">
                      <Sparkles className="w-3 h-3" />
                      <span>Generated Image Asset (1024×1024 Non-Empty PNG)</span>
                    </div>
                    {msg.generatedImages.map(img => (
                      <div key={img.id} className="p-3 rounded-xl bg-[#080808] border border-[#303030] space-y-2.5">
                        <div className="rounded-lg overflow-hidden border border-[#222222] bg-[#000]">
                          <img
                            src={img.imageUrl}
                            alt={img.subject}
                            className="w-full max-w-md h-auto max-h-96 object-contain mx-auto"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-[#D5D2CC]">{img.filename} ({img.width}×{img.height}, {img.sizeKb})</span>
                          <a
                            href={img.downloadUrl}
                            download={img.filename}
                            className="px-2.5 py-1 rounded bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1] flex items-center space-x-1 font-sans text-xs transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download PNG</span>
                          </a>
                        </div>
                        {img.visionDescription && (
                          <div className="p-2.5 rounded-lg bg-[#0e0e0e] border border-[#222222] text-xs space-y-1 font-sans">
                            <div className="text-[10px] text-[#9C9C9C] uppercase font-mono tracking-wider font-medium">
                              Visual Inspection
                            </div>
                            <p className="text-[#D5D2CC] text-xs leading-relaxed">
                              {img.visionDescription}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Generated Native Deliverables (PowerPoint, Excel, Word, PDF, CSV) */}
                {((msg.generatedFiles && msg.generatedFiles.length > 0) || (msg.compiledResult?.files && msg.compiledResult.files.length > 0)) && (
                  <div className="space-y-2 pt-3 border-t border-[#262626]">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#987654] font-semibold flex items-center space-x-1.5">
                      <Download className="w-3 h-3" />
                      <span>Generated Deliverables</span>
                    </div>
                    {(msg.generatedFiles || msg.compiledResult?.files || []).map(gen => (
                      <div
                        key={gen.id}
                        className="p-3 rounded-xl bg-[#080808] border border-[#303030] hover:border-[#987654]/60 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                          {getFileIcon(gen.type)}
                          <div className="min-w-0">
                            <div className="font-mono text-xs text-[#F5F4F1] font-medium truncate">{gen.name}</div>
                            <div className="text-[10px] text-[#9C9C9C]">{gen.size} • {gen.description || `${gen.type.toUpperCase()} Deliverable`}</div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          {['md', 'txt', 'csv', 'json', 'py', 'js', 'ts'].includes(gen.type.toLowerCase()) && (
                            <LumiButton
                              variant="secondary"
                              size="xs"
                              icon={<Code2 className="w-3 h-3 text-[#987654]" />}
                              onClick={() => handleOpenFileInIDE(gen)}
                            >
                              Edit in IDE
                            </LumiButton>
                          )}
                          <LumiButton
                            variant="primary"
                            size="xs"
                            icon={<Download className="w-3 h-3" />}
                            onClick={() => handleDownloadGeneratedFile(gen)}
                          >
                            Download {gen.type.toUpperCase()}
                          </LumiButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Stage 3: Human Approval of Workplan Interface (Part 1) */}
                {msg.lumiWorkplan && msg.isApprovalPrompt && (
                  <div className="mt-3 p-4 rounded-xl bg-[#0c0c0c] border border-[#262626] space-y-3.5 font-sans text-xs">
                    {/* Key Objectives & Scope in Points */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-[#D5D2CC] uppercase tracking-wider font-mono flex items-center justify-between">
                        <span>Task Objective & Scope</span>
                        <span className="text-[10px] text-[#987654] font-normal uppercase">Key Points</span>
                      </div>
                      {editingPlanId === msg.lumiWorkplan.id ? (
                        <textarea
                          rows={2}
                          value={editedInterpretation}
                          onChange={e => setEditedInterpretation(e.target.value)}
                          className="w-full text-xs text-[#F5F4F1] bg-[#141414] p-2.5 rounded border border-[#987654] outline-none"
                        />
                      ) : (
                        <div className="p-2.5 rounded-lg bg-[#141414] border border-[#262626] space-y-1.5 text-xs">
                          <div className="flex items-start space-x-2">
                            <span className="text-[#987654] font-bold">•</span>
                            <span className="text-[#F5F4F1] font-medium shrink-0">Goal:</span>
                            <span className="text-[#D5D2CC] flex-1">
                              {msg.lumiWorkplan.decomposition?.primaryObjective || msg.lumiWorkplan.taskInterpretation}
                            </span>
                          </div>
                          {msg.lumiWorkplan.decomposition?.parameters && msg.lumiWorkplan.decomposition.parameters.length > 0 && (
                            <div className="flex items-start space-x-2">
                              <span className="text-[#987654] font-bold">•</span>
                              <span className="text-[#F5F4F1] font-medium shrink-0">Parameters:</span>
                              <span className="text-[#9C9C9C] flex-1 font-mono text-[11px]">
                                {msg.lumiWorkplan.decomposition.parameters.map((p: any) => `${p.key || p.name}: ${p.value} ${p.unit || ''}`.trim()).join(' | ')}
                              </span>
                            </div>
                          )}
                          <div className="flex items-start space-x-2">
                            <span className="text-[#987654] font-bold">•</span>
                            <span className="text-[#F5F4F1] font-medium shrink-0">Deliverable:</span>
                            <span className="text-[#987654] font-mono text-[11px]">
                              {msg.lumiWorkplan.expectedDeliverables?.[0] || msg.lumiWorkplan.decomposition?.requestedOutputFormat?.toUpperCase() || 'Verified Result'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Knowledge Base Context in Points */}
                    {msg.lumiWorkplan.knowledgeMatches && msg.lumiWorkplan.knowledgeMatches.length > 0 ? (
                      <div className="p-2.5 rounded-lg bg-[#141414] border border-[#262626] space-y-1.5 text-xs">
                        <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-[#D5D2CC] uppercase tracking-wider font-mono">
                          <BookOpen className="w-3 h-3 text-[#987654]" />
                          <span>Referenced Knowledge & Guidelines</span>
                        </div>
                        <ul className="space-y-1 pt-1 text-[11px]">
                          {msg.lumiWorkplan.knowledgeMatches.map((km, kIdx) => (
                            <li key={kIdx} className="flex items-start space-x-2 text-[#D5D2CC]">
                              <span className="text-[#987654] font-bold">•</span>
                              <span>
                                <strong className="text-[#F5F4F1]">{km.docName}:</strong> {km.sections}
                                {km.keyRequirements && km.keyRequirements.length > 0 && ` (${km.keyRequirements.slice(0, 2).join('; ')})`}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {msg.lumiWorkplan.knowledgeContext?.conflictDetected && (
                          <div className="p-2 rounded bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 flex items-start space-x-1.5">
                            <span className="font-bold">• Note:</span>
                            <span>{msg.lumiWorkplan.knowledgeContext.conflictDetails}</span>
                          </div>
                        )}
                      </div>
                    ) : msg.lumiWorkplan.policyNotice ? (
                      <div className="p-2.5 rounded-lg bg-[#141414] border border-[#262626] text-xs space-y-1">
                        <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-[#987654] uppercase tracking-wider font-mono">
                          <BookOpen className="w-3 h-3" />
                          <span>Policy Context</span>
                        </div>
                        <div className="flex items-start space-x-2 text-[11px] text-[#9C9C9C]">
                          <span className="text-[#987654] font-bold">•</span>
                          <span>{msg.lumiWorkplan.policyNotice}</span>
                        </div>
                      </div>
                    ) : null}

                    {/* Execution Sequence in Points */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#D5D2CC] uppercase tracking-wider font-mono">
                        <span>Execution Sequence ({msg.lumiWorkplan.executionSequence.length} Steps)</span>
                        {editingPlanId === msg.lumiWorkplan.id && (
                          <button
                            onClick={handleAddStep}
                            className="text-[#987654] hover:text-[#b8956e] flex items-center space-x-1 lowercase font-mono text-[11px]"
                          >
                            <Plus className="w-3 h-3" />
                            <span>add step</span>
                          </button>
                        )}
                      </div>

                      {editingPlanId === msg.lumiWorkplan.id ? (
                        <div className="space-y-2">
                          {editedSteps.map((step, idx) => (
                            <div key={step.id} className="p-2.5 rounded bg-[#161616] border border-[#303030] space-y-1.5 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[#987654] font-bold text-xs">{idx + 1}.</span>
                                <input
                                  type="text"
                                  value={step.name}
                                  onChange={e => handleUpdateStep(step.id, { name: e.target.value })}
                                  placeholder="Step title"
                                  className="flex-1 bg-[#0c0c0c] border border-[#303030] p-1.5 rounded text-xs text-[#F5F4F1] outline-none"
                                />
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleMoveStep(idx, 'up')}
                                    disabled={idx === 0}
                                    className="p-1 rounded bg-[#202020] text-[#9C9C9C] hover:text-[#F5F4F1] disabled:opacity-30"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveStep(idx, 'down')}
                                    disabled={idx === editedSteps.length - 1}
                                    className="p-1 rounded bg-[#202020] text-[#9C9C9C] hover:text-[#F5F4F1] disabled:opacity-30"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveStep(step.id)}
                                    className="p-1 rounded bg-[#202020] text-red-400 hover:text-red-300"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <input
                                type="text"
                                value={step.description}
                                onChange={e => handleUpdateStep(step.id, { description: e.target.value })}
                                placeholder="Step description"
                                className="w-full bg-[#0c0c0c] border border-[#303030] p-1.5 rounded text-xs text-[#A0A0A0] outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {msg.lumiWorkplan.executionSequence.map((step, idx) => (
                            <div key={step.id} className="p-2 rounded-lg bg-[#141414] border border-[#222222] flex items-center space-x-2.5 text-xs">
                              <span className="font-mono text-[#987654] font-semibold w-4 text-right shrink-0">{idx + 1}.</span>
                              <div className="flex-1 min-w-0 flex items-center space-x-1.5 truncate">
                                <span className="font-medium text-[#F5F4F1] shrink-0">{step.name}:</span>
                                <span className="text-[#9C9C9C] truncate text-[11px]">{step.description}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Expected Deliverables */}
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] font-semibold text-[#D5D2CC] uppercase tracking-wider font-mono">
                        Deliverables
                      </div>
                      {editingPlanId === msg.lumiWorkplan.id ? (
                        <input
                          type="text"
                          value={editedDeliverables}
                          onChange={e => setEditedDeliverables(e.target.value)}
                          placeholder="Comma-separated deliverable names"
                          className="w-full text-xs text-[#F5F4F1] bg-[#141414] p-2 rounded border border-[#987654] outline-none"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.lumiWorkplan.expectedDeliverables.map(deliv => (
                            <span key={deliv} className="px-2.5 py-0.5 rounded bg-[#191919] border border-[#303030] text-[11px] font-mono text-[#E2E8F0]">
                              {deliv}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Controls: Exactly Three Buttons (Approve, Edit, Reject) */}
                    {executingPlanId !== msg.lumiWorkplan.id && (
                      <div className="flex items-center space-x-2.5 pt-2 border-t border-[#222222]">
                        {editingPlanId === msg.lumiWorkplan.id ? (
                          <>
                            <LumiButton
                              variant="primary"
                              size="sm"
                              icon={<Save className="w-3.5 h-3.5" />}
                              onClick={() => handleSaveAndApproveEditedPlan(msg.lumiWorkplan!)}
                              disabled={isGenerating}
                            >
                              Save & Execute
                            </LumiButton>
                            <LumiButton
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditingPlanId(null)}
                            >
                              Cancel
                            </LumiButton>
                          </>
                        ) : (
                          <>
                            <LumiButton
                              variant="primary"
                              size="sm"
                              icon={<Play className="w-3.5 h-3.5 fill-current" />}
                              onClick={() => handleApproveWorkplan(msg.lumiWorkplan!)}
                              disabled={isGenerating}
                            >
                              Approve & Execute
                            </LumiButton>

                            <LumiButton
                              variant="secondary"
                              size="sm"
                              icon={<Edit3 className="w-3.5 h-3.5" />}
                              onClick={() => {
                                setEditingPlanId(msg.lumiWorkplan!.id);
                                setEditedInterpretation(msg.lumiWorkplan!.decomposition?.primaryObjective || msg.lumiWorkplan!.taskInterpretation);
                                setEditedDeliverables(msg.lumiWorkplan!.expectedDeliverables.join(', '));
                                setEditedSteps(JSON.parse(JSON.stringify(msg.lumiWorkplan!.executionSequence)));
                              }}
                            >
                              Modify Steps
                            </LumiButton>

                            <LumiButton
                              variant="danger"
                              size="sm"
                              onClick={() => handleRejectWorkplan(msg.lumiWorkplan!.id)}
                            >
                              Reject
                            </LumiButton>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Stage 6 & 7: Compilation Deliverables & Validation Output */}
                {msg.compiledResult && (
                  <div className="mt-4 space-y-4">
                    {/* Validation Report */}
                    <div className="p-3 rounded-lg bg-[#141414] border border-[#262626] space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-[#262626] pb-2">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className={`w-4 h-4 ${msg.compiledResult.validation.passed ? 'text-[#987654]' : 'text-amber-400'}`} />
                          <span className="font-medium text-[#F5F4F1]">Quality & Fact Validation</span>
                        </div>
                        <span className={`text-xs font-medium ${
                          msg.compiledResult.validation.passed ? 'text-[#987654]' : 'text-amber-400'
                        }`}>
                          {msg.compiledResult.validation.passed ? 'Verified' : 'Review Required'}
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {msg.compiledResult.validation.checks.map(check => (
                          <div key={check.name} className="flex items-center justify-between text-[11px]">
                            <span className="text-[#D5D2CC]">{check.name}</span>
                            <span className={check.passed ? 'text-[#9C9C9C]' : 'text-amber-400'}>
                              {check.passed ? 'Passed' : 'Flagged'}
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
                                  className="text-[10px] px-2 py-0.5 rounded bg-[#191919] hover:bg-[#202020] text-[#D5D2CC] hover:text-[#F5F4F1] border border-[#303030] flex items-center space-x-1"
                                >
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                  <span>Execute in Sandbox</span>
                                </button>
                                <button
                                  onClick={() => copyToClipboard(cs.code, `code-${idx}`)}
                                  className="text-[10px] text-[#9C9C9C] hover:text-[#F5F4F1] flex items-center space-x-1"
                                >
                                  {copiedId === `code-${idx}` ? <Check className="w-3 h-3 text-[#987654]" /> : <Copy className="w-3 h-3" />}
                                  <span>Copy</span>
                                </button>
                              </div>
                            </div>
                            <pre className="p-3 font-mono text-[11px] text-[#F5F4F1] overflow-x-auto leading-relaxed">
                              <code>{cs.code}</code>
                            </pre>
                            {cs.executionResult && (
                              <div className="p-2.5 bg-[#141414] border-t border-[#262626] font-mono text-[10px] text-[#D5D2CC]">
                                Sandbox Output: {cs.executionResult}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Real-time Generating & Thinking Indicator */}
          {isGenerating && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#141414] border border-[#303030] text-xs font-mono text-[#D5D2CC] max-w-md shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="relative flex items-center justify-center w-4 h-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#987654] opacity-50" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#987654]" />
                </div>
                <div>
                  <div className="text-[#F5F4F1] font-semibold flex items-center space-x-2">
                    <span>LUMI is thinking...</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#987654] animate-pulse" />
                  </div>
                  <div className="text-[10px] text-[#9C9C9C] mt-0.5">
                    {executingPlanId ? 'Executing approved workplan & compiling results' : 'Analyzing task requirements & structuring workplan'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleStopGeneration}
                className="px-2.5 py-1 rounded bg-[#080808] hover:bg-[#202020] text-red-400 border border-[#303030] text-[11px] flex items-center space-x-1 transition-colors"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 3. Persistent Message Composer (Anchored at the bottom in ALL states) */}
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

          {/* Hidden File Input for Attachments */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp,.py,.js,.ts,.json"
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
              placeholder="Ask LUMI or enter an engineering prompt..."
              className="w-full bg-transparent border-none outline-none text-xs text-[#F5F4F1] placeholder-[#6e6e6e] resize-none font-sans leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#222222] text-xs">
              {/* Mandatory Always-Available Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach Document, Image or Dataset"
                className="px-2 py-1 hover:text-[#F5F4F1] hover:bg-[#202020] rounded-md text-[#9C9C9C] transition-all flex items-center space-x-1.5 text-xs font-sans cursor-pointer active:scale-95"
              >
                <Paperclip className="w-3.5 h-3.5 text-[#987654]" />
                <span>Attach File</span>
              </button>

              <div className="flex items-center space-x-2">
                <SendButton
                  onClick={() => handleSend()}
                  disabled={!inputVal.trim() && attachments.length === 0}
                  isGenerating={isGenerating}
                  onStop={handleStopGeneration}
                  size="md"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
