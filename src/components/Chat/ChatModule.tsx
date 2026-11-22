import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  RotateCcw,
  Copy,
  Check,
  Cpu,
  Bot,
  ChevronDown,
  FileText,
  Search,
  Sparkles,
  ArrowUp,
  Square,
  X,
  Download,
  Code2,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  FileSpreadsheet,
  FileImage,
  Layers,
  FileCode,
  File,
  Eye,
  Sliders
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  ChatMessage,
  ChatAttachment,
  WorkplanApproval,
  GeneratedFilePreview,
  ChatSourceCitation,
  AgentExecutionStage
} from '../../types';

export const ChatModule: React.FC = () => {
  const {
    models,
    activeConversation,
    addMessageToActiveConversation,
    updateWorkplanStatus,
    openFile,
    downloadFileItem,
    navigateToSettings,
    createFile
  } = useWorkspace();

  const [selectedModel, setSelectedModel] = useState('LUMI-Core 70B');
  const [selectedAgent, setSelectedAgent] = useState('Autonomous Orchestrator');
  const [modelDropdown, setModelDropdown] = useState(false);
  const [agentDropdown, setAgentDropdown] = useState(false);

  const [inputVal, setInputVal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [expandedCitationId, setExpandedCitationId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const generationTimerRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, isGenerating]);

  // Handle file attachment selection
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
    if (generationTimerRef.current) {
      clearTimeout(generationTimerRef.current);
      generationTimerRef.current = null;
    }
    setIsGenerating(false);
  };

  const handleSend = () => {
    const text = inputVal.trim();
    if ((!text && attachments.length === 0) || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: text || 'Please inspect attached documents and execute verification routines.',
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };

    addMessageToActiveConversation(userMessage);
    setInputVal('');
    setAttachments([]);
    setIsGenerating(true);

    // Simulate reactive local orchestration engine
    const promptLower = text.toLowerCase();

    generationTimerRef.current = setTimeout(() => {
      setIsGenerating(false);

      // Determine response type based on intent
      let assistantMsg: ChatMessage;

      if (promptLower.includes('refactor') || promptLower.includes('plan') || promptLower.includes('workflow')) {
        assistantMsg = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: selectedModel,
          agent: selectedAgent,
          tokens: 524,
          executionStages: [
            { id: 'es-1', name: 'Syntactic intent extraction', status: 'completed', duration: '110ms' },
            { id: 'es-2', name: 'AST boundary verification', status: 'completed', duration: '195ms' },
            { id: 'es-3', name: 'Multi-stage execution planning', status: 'completed', duration: '410ms' }
          ],
          content: `I analyzed the codebase topology and prepared an execution workplan.

Because this task involves multi-module refactoring across sandbox boundaries, user authorization is required before applying file modifications:`,
          workplan: {
            id: `wp-${Date.now()}`,
            title: 'Refactor Plan: Sandboxed IPC Buffer Stream',
            description: 'Apply non-blocking ring buffer queues to Monaco editor language client requests.',
            status: 'pending',
            steps: [
              { id: 's1', description: 'Introduce LockFreeQueue buffer in src/services/terminal.ts', status: 'completed' },
              { id: 's2', description: 'Throttle language server diagnostics emission rate to 60fps', status: 'in_progress' },
              { id: 's3', description: 'Validate zero regressions via TypeScript AST compiler pass', status: 'pending' }
            ]
          },
          generatedFiles: [
            {
              id: `gen-${Date.now()}-1`,
              name: 'lock_free_queue.ts',
              size: '4.2 KB',
              type: 'typescript',
              description: 'Zero-allocation ring buffer implementation for local IPC.',
              content: `export class LockFreeQueue<T> {\n  private buffer: Array<T | null>;\n  constructor(public readonly capacity: number) {\n    this.buffer = new Array(capacity).fill(null);\n  }\n}`
            }
          ]
        };
      } else if (promptLower.includes('spec') || promptLower.includes('document') || promptLower.includes('export')) {
        assistantMsg = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: selectedModel,
          agent: selectedAgent,
          tokens: 460,
          citations: [
            {
              id: 'cit-101',
              collection: 'Core System Architecture',
              file: 'system_architecture_spec.md',
              section: 'Section 4.1: Vector Index Storage',
              score: 0.95,
              snippet: 'Vector embeddings are committed to local NVMe storage using flat binary memory maps to maintain zero page fault latency.'
            }
          ],
          content: `Generated technical report based on current local repository state.

All parameters adhere to sovereign isolation guidelines:`,
          generatedFiles: [
            {
              id: `gen-${Date.now()}-doc`,
              name: 'lumi_system_spec.md',
              size: '8.4 KB',
              type: 'markdown',
              description: 'Architecture export detailing offline compute bindings and telemetry guardrails.',
              content: `# LUMI Sovereign Platform Specification\n\nGenerated: ${new Date().toISOString()}\nExecution Mode: 100% Offline Air-Gapped\nTelemetry: Enforced Off`
            }
          ]
        };
      } else {
        assistantMsg = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: selectedModel,
          agent: selectedAgent,
          tokens: 388,
          executionStages: [
            { id: 'es-1', name: 'Local model inference on GPU slot 0', status: 'completed', duration: '340ms' },
            { id: 'es-2', name: 'Deterministic output formatting', status: 'completed', duration: '60ms' }
          ],
          content: `Inference completed locally using **${selectedModel}** orchestrated by **${selectedAgent}**.

The system processed your prompt strictly within private host memory. No network packets were emitted outside the local loopback boundary.`,
          codeBlock: {
            language: 'typescript',
            code: `// Local orchestration verification
export function getRuntimeStatus() {
  return {
    engine: '${selectedModel}',
    hardwareSlot: 'CUDA:0',
    airGapped: true,
    telemetry: 'disabled'
  };
}`
          }
        };
      }

      addMessageToActiveConversation(assistantMsg);
    }, 1100);
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

  const agentOptions = [
    'Autonomous Orchestrator',
    'Research Agent',
    'Code Synthesizer',
    'Security Evaluator',
    'Document Intelligence Engine'
  ];

  const messages = activeConversation?.messages || [];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080808] text-[#F5F4F1] font-sans overflow-hidden select-none">
      {/* 1. Header Bar: Model Selector, Agent Selector, Air-gap Indicator */}
      <div className="h-12 px-4 border-b border-[#303030] flex items-center justify-between bg-[#080808] shrink-0 z-20">
        <div className="flex items-center space-x-3">
          {/* Model Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setModelDropdown(!modelDropdown);
                setAgentDropdown(false);
              }}
              className="px-2.5 py-1 rounded bg-[#191919] hover:bg-[#202020] border border-[#303030] text-xs font-mono text-[#F5F4F1] flex items-center space-x-2 transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-[#987654]" />
              <span>{selectedModel}</span>
              <ChevronDown className="w-3 h-3 text-[#9C9C9C]" />
            </button>

            {modelDropdown && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-[#191919] border border-[#303030] rounded shadow-2xl py-1 text-xs z-50">
                <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#9C9C9C] border-b border-[#262626]">
                  Local Models Loaded
                </div>
                {models.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.name);
                      setModelDropdown(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-[#202020] transition-colors ${
                      selectedModel === m.name ? 'text-[#987654] font-medium' : 'text-[#D5D2CC]'
                    }`}
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="text-[10px] text-[#9C9C9C] font-mono shrink-0 ml-2">
                      {m.quantization}
                    </span>
                  </button>
                ))}
                <div className="border-t border-[#262626] mt-1 pt-1 px-2">
                  <button
                    onClick={() => {
                      setModelDropdown(false);
                      navigateToSettings('workbench', 'model-manager');
                    }}
                    className="w-full py-1 text-center text-[10px] text-[#987654] hover:underline font-mono"
                  >
                    Manage weights in Settings →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Agent Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setAgentDropdown(!agentDropdown);
                setModelDropdown(false);
              }}
              className="px-2.5 py-1 rounded bg-[#191919] hover:bg-[#202020] border border-[#303030] text-xs font-mono text-[#F5F4F1] flex items-center space-x-2 transition-colors"
            >
              <Bot className="w-3.5 h-3.5 text-[#987654]" />
              <span>{selectedAgent}</span>
              <ChevronDown className="w-3 h-3 text-[#9C9C9C]" />
            </button>

            {agentDropdown && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-[#191919] border border-[#303030] rounded shadow-2xl py-1 text-xs z-50">
                <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#9C9C9C] border-b border-[#262626]">
                  Active Agent Archetype
                </div>
                {agentOptions.map(ag => (
                  <button
                    key={ag}
                    onClick={() => {
                      setSelectedAgent(ag);
                      setAgentDropdown(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left hover:bg-[#202020] transition-colors ${
                      selectedAgent === ag ? 'text-[#987654] font-medium' : 'text-[#D5D2CC]'
                    }`}
                  >
                    {ag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Air-gapped Sovereign Telemetry Pill */}
        <div className="flex items-center space-x-3 font-mono text-[11px] text-[#9C9C9C]">
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[#F5F4F1]">Sovereign Engine</span>
          </div>
          <span>•</span>
          <span className="text-[#987654]">128k Window</span>
        </div>
      </div>

      {/* 2. Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 select-text">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Welcome Card if Conversation is Empty */}
          {messages.length === 0 && (
            <div className="py-16 text-center space-y-4">
              <div className="inline-flex p-3 rounded-full bg-[#191919] border border-[#303030]">
                <Bot className="w-8 h-8 text-[#987654]" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-mono tracking-tight text-[#F5F4F1]">
                  LUMI SOVEREIGN WORKBENCH
                </h2>
                <p className="text-xs text-[#9C9C9C] mt-1 max-w-md mx-auto">
                  Local intelligence running directly on your dedicated hardware. No telemetry, no external API keys, 100% private.
                </p>
              </div>

              {/* Sample Prompts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-w-xl mx-auto pt-4 text-left">
                {[
                  'Audit VRAM memory residency across GPU slots',
                  'Synthesize isolated sandbox policy for IPC sockets',
                  'Analyze system architecture and propose multi-agent DAG',
                  'Inspect attached documents for compliance boundaries'
                ].map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInputVal(prompt);
                      textareaRef.current?.focus();
                    }}
                    className="p-3 rounded bg-[#191919] hover:bg-[#202020] border border-[#303030] text-xs text-[#D5D2CC] hover:text-[#F5F4F1] transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
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
              {/* Header Info */}
              <div className="flex items-center space-x-2 text-[11px] font-mono text-[#9C9C9C] px-1">
                <span>{msg.sender === 'user' ? 'You' : msg.model || 'LUMI'}</span>
                {msg.agent && (
                  <>
                    <span>•</span>
                    <span className="text-[#987654]">{msg.agent}</span>
                  </>
                )}
                <span>•</span>
                <span>{msg.timestamp}</span>
                {msg.tokens && (
                  <>
                    <span>•</span>
                    <span>{msg.tokens} tokens</span>
                  </>
                )}
              </div>

              {/* Main Message Container */}
              <div
                className={`p-4 rounded text-xs leading-relaxed max-w-3xl space-y-3 ${
                  msg.sender === 'user'
                    ? 'bg-[#191919] text-[#F5F4F1] border border-[#303030]'
                    : 'bg-[#121212] text-[#D5D2CC] border border-[#262626] w-full'
                }`}
              >
                {/* User Attachment Chips */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-1">
                    {msg.attachments.map(att => (
                      <div
                        key={att.id}
                        className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#080808] border border-[#303030] text-[11px] font-mono text-[#F5F4F1]"
                      >
                        {getFileIcon(att.type)}
                        <span>{att.name}</span>
                        <span className="text-[#9C9C9C]">({att.size})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Agent Multi-Stage Execution Status */}
                {msg.executionStages && msg.executionStages.length > 0 && (
                  <div className="p-2.5 rounded bg-[#080808] border border-[#262626] space-y-1.5 font-mono text-[11px]">
                    <div className="text-[10px] text-[#9C9C9C] uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center space-x-1.5">
                        <Layers className="w-3 h-3 text-[#987654]" />
                        <span>Execution Pipeline</span>
                      </span>
                      <span className="text-emerald-400">Verified Safe</span>
                    </div>
                    {msg.executionStages.map(stage => (
                      <div key={stage.id} className="flex items-center justify-between text-[#D5D2CC]">
                        <span className="flex items-center space-x-2">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>{stage.name}</span>
                        </span>
                        {stage.duration && (
                          <span className="text-[10px] text-[#9C9C9C]">{stage.duration}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Body Content */}
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Workplan Approval Interface (Requirement 1 & 5) */}
                {msg.workplan && (
                  <div className="p-3.5 rounded bg-[#080808] border border-[#987654]/40 space-y-3 font-sans">
                    <div className="flex items-center justify-between border-b border-[#262626] pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-[#987654]" />
                        <span className="font-mono text-xs font-semibold text-[#F5F4F1]">
                          {msg.workplan.title}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${
                          msg.workplan.status === 'approved'
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                            : msg.workplan.status === 'rejected'
                            ? 'bg-red-950/60 text-red-400 border-red-800'
                            : 'bg-[#191919] text-[#987654] border-[#303030]'
                        }`}
                      >
                        {msg.workplan.status === 'pending' ? 'Approval Required' : msg.workplan.status}
                      </span>
                    </div>

                    <p className="text-xs text-[#9C9C9C]">{msg.workplan.description}</p>

                    {/* Step-by-step review list */}
                    <div className="space-y-1.5 font-mono text-[11px]">
                      {msg.workplan.steps.map((st, idx) => (
                        <div
                          key={st.id}
                          className="flex items-center justify-between p-2 rounded bg-[#141414] border border-[#222222]"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-[#987654]">0{idx + 1}.</span>
                            <span className="text-[#F5F4F1]">{st.description}</span>
                          </div>
                          <span className="text-[10px] text-[#9C9C9C] uppercase">
                            {st.status}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Workplan Action Buttons */}
                    {msg.workplan.status === 'pending' ? (
                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          onClick={() => updateWorkplanStatus(msg.workplan!.id, 'approved')}
                          className="px-3 py-1.5 rounded bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1] text-xs font-mono font-medium transition-colors flex items-center space-x-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Plan</span>
                        </button>
                        <button
                          onClick={() => updateWorkplanStatus(msg.workplan!.id, 'rejected')}
                          className="px-3 py-1.5 rounded bg-[#191919] hover:bg-[#202020] text-[#9C9C9C] hover:text-red-400 border border-[#303030] text-xs font-mono transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] font-mono text-emerald-400 flex items-center space-x-1.5 pt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Execution plan approved. Tasks scheduled for background execution.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Generated File Previews and Download (Requirement 1 & 6) */}
                {msg.generatedFiles && msg.generatedFiles.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="text-[10px] font-mono uppercase text-[#9C9C9C]">
                      Generated Artifacts
                    </div>
                    {msg.generatedFiles.map(gen => (
                      <div
                        key={gen.id}
                        className="p-3 rounded bg-[#080808] border border-[#303030] flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                          {getFileIcon(gen.type)}
                          <div className="min-w-0">
                            <div className="font-mono text-xs text-[#F5F4F1] font-medium truncate">
                              {gen.name}
                            </div>
                            <div className="text-[10px] text-[#9C9C9C]">
                              {gen.size} • {gen.description || 'Generated code artifact'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            onClick={() => handleOpenFileInIDE(gen)}
                            title="Open in IDE Editor"
                            className="px-2 py-1 rounded bg-[#191919] hover:bg-[#202020] border border-[#303030] text-[11px] font-mono text-[#D5D2CC] hover:text-[#F5F4F1] transition-colors flex items-center space-x-1"
                          >
                            <Code2 className="w-3 h-3 text-[#987654]" />
                            <span>Edit in IDE</span>
                          </button>

                          <button
                            onClick={() => handleDownloadGeneratedFile(gen)}
                            title="Download artifact"
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

                {/* Code Block if Present */}
                {msg.codeBlock && (
                  <div className="rounded bg-[#080808] border border-[#303030] overflow-hidden">
                    <div className="px-3 py-1.5 bg-[#141414] border-b border-[#303030] flex items-center justify-between font-mono text-[11px] text-[#9C9C9C]">
                      <span>{msg.codeBlock.language}</span>
                      <button
                        onClick={() => copyToClipboard(msg.codeBlock!.code, msg.id)}
                        className="hover:text-[#F5F4F1] flex items-center space-x-1 text-[10px]"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3 font-mono text-[11px] text-[#F5F4F1] overflow-x-auto leading-relaxed">
                      <code>{msg.codeBlock.code}</code>
                    </pre>
                  </div>
                )}

                {/* Source Citations with expandable drawer (Requirement 1) */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="pt-2 border-t border-[#262626] space-y-2">
                    <div className="flex items-center space-x-2 text-[10px] font-mono text-[#9C9C9C]">
                      <span>Ground-truth RAG Citations:</span>
                      {msg.citations.map((cit, idx) => (
                        <button
                          key={cit.id}
                          onClick={() =>
                            setExpandedCitationId(
                              expandedCitationId === cit.id ? null : cit.id
                            )
                          }
                          className="px-2 py-0.5 rounded bg-[#191919] hover:bg-[#202020] text-[#987654] hover:text-[#F5F4F1] border border-[#303030] transition-colors"
                        >
                          [{idx + 1}] {cit.collection}
                        </button>
                      ))}
                    </div>

                    {/* Expanded Citation Preview */}
                    {expandedCitationId && (
                      <div className="p-3 rounded bg-[#080808] border border-[#303030] text-[11px] font-mono space-y-1">
                        {(() => {
                          const activeCit = msg.citations.find(c => c.id === expandedCitationId);
                          if (!activeCit) return null;
                          return (
                            <>
                              <div className="flex items-center justify-between text-[#987654]">
                                <span>{activeCit.file} ({activeCit.section})</span>
                                <span>Similarity: {(activeCit.score * 100).toFixed(1)}%</span>
                              </div>
                              <p className="text-[#D5D2CC] leading-relaxed pt-1">
                                "{activeCit.snippet}"
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Real-time Generating Indicator */}
          {isGenerating && (
            <div className="flex items-center justify-between p-3 rounded bg-[#141414] border border-[#303030] text-xs font-mono text-[#987654] max-w-xl">
              <div className="flex items-center space-x-2.5">
                <div className="w-3.5 h-3.5 rounded-full border border-[#987654] border-t-transparent animate-spin" />
                <span>Generating response with {selectedModel}...</span>
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

      {/* 3. Composer Section: File Attachment, Textarea, Send / Stop Controls */}
      <div className="p-4 border-t border-[#303030] bg-[#080808] shrink-0">
        <div className="max-w-4xl mx-auto">
          {/* Active Attached Files Chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map(att => (
                <div
                  key={att.id}
                  className="flex items-center space-x-2 px-2.5 py-1 rounded bg-[#191919] border border-[#303030] text-xs font-mono text-[#F5F4F1]"
                >
                  {getFileIcon(att.type)}
                  <span className="truncate max-w-[180px]">{att.name}</span>
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

          {/* Hidden File Picker Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
            className="hidden"
          />

          {/* Floating Composer Card with Taupe Focus Outline */}
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
              placeholder="Ask LUMI anything, press Enter to submit, Shift+Enter for newline..."
              className="w-full bg-transparent border-none outline-none text-xs text-[#F5F4F1] placeholder-[#9C9C9C] resize-none font-sans leading-relaxed"
            />

            {/* Composer Action Toolbar */}
            <div className="flex items-center justify-between pt-2 border-t border-[#262626] text-xs">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach File (PDF, DOCX, XLSX, CSV, Images, etc.)"
                  className="p-1.5 hover:text-[#F5F4F1] hover:bg-[#202020] rounded text-[#9C9C9C] transition-colors flex items-center space-x-1"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-mono">Attach</span>
                </button>

                <span className="text-[10px] font-mono text-[#9C9C9C]">
                  Supported: PDF, DOCX, XLSX, CSV, TXT, Images
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {isGenerating ? (
                  <button
                    onClick={handleStopGeneration}
                    className="px-3 py-1 rounded text-xs font-mono font-medium bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 flex items-center space-x-1.5 transition-colors"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!inputVal.trim() && attachments.length === 0}
                    className={`px-3 py-1 rounded text-xs font-medium font-mono flex items-center space-x-1.5 transition-colors ${
                      inputVal.trim() || attachments.length > 0
                        ? 'bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1]'
                        : 'bg-[#262626] text-[#9C9C9C] cursor-not-allowed'
                    }`}
                  >
                    <span>Send</span>
                    <ArrowUp className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-[#9C9C9C] mt-2 px-1">
            <span>Local Sovereign Model • Hardware Guardrails Active</span>
            <button
              onClick={() => navigateToSettings('workbench', 'model-manager')}
              className="hover:text-[#F5F4F1] underline"
            >
              Hardware & Model Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
