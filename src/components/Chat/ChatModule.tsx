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
  AlertCircle
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  ChatMessage,
  ChatAttachment,
  GeneratedFilePreview
} from '../../types';

export const ChatModule: React.FC = () => {
  const {
    activeConversation,
    addMessageToActiveConversation,
    createFile,
    navigateToSettings
  } = useWorkspace();

  const [inputVal, setInputVal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<{ online: boolean; modelName: string }>({
    online: false,
    modelName: 'Runtime Offline'
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Probe runtime on mount
  useEffect(() => {
    let mounted = true;
    fetch('/api/models/audit')
      .then(res => res.json())
      .then(data => {
        if (!mounted) return;
        if (data.runtimeOnline) {
          const firstModel = data.installedModels[0]?.name || 'qwen2.5-coder:1.5b';
          setRuntimeStatus({ online: true, modelName: firstModel });
        } else {
          setRuntimeStatus({ online: false, modelName: 'Runtime Offline' });
        }
      })
      .catch(() => {
        if (mounted) {
          setRuntimeStatus({ online: false, modelName: 'Runtime Offline' });
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

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
  };

  const handleSend = async () => {
    const text = inputVal.trim();
    if ((!text && attachments.length === 0) || isGenerating) return;

    setErrorMessage(null);

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: text,
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };

    addMessageToActiveConversation(userMessage);
    setInputVal('');
    setAttachments([]);
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          model: runtimeStatus.online ? runtimeStatus.modelName : undefined
        }),
        signal: controller.signal
      });

      const data = await res.json();

      if (res.ok && data.content) {
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: data.content,
          citations: data.citations
        };
        addMessageToActiveConversation(assistantMsg);
      } else {
        const errMsg = data.error || 'Local inference service is unavailable.';
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: errMsg
        };
        addMessageToActiveConversation(assistantMsg);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: 'Generation cancelled.'
        };
        addMessageToActiveConversation(assistantMsg);
      } else {
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: 'Local inference service is unavailable. Ensure Ollama is running at http://127.0.0.1:11434 or configure a model in Settings.'
        };
        addMessageToActiveConversation(assistantMsg);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
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
      {/* 1. Header Bar: Real Model / Runtime Indicator */}
      <div className="h-12 px-4 border-b border-[#303030] flex items-center justify-between bg-[#080808] shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigateToSettings('workbench', 'model-manager')}
            title="Open Model Manager in Settings"
            className="px-2.5 py-1 rounded bg-[#191919] hover:bg-[#202020] border border-[#303030] text-xs font-mono text-[#F5F4F1] flex items-center space-x-2 transition-colors"
          >
            <Cpu className="w-3.5 h-3.5 text-[#987654]" />
            <span>{runtimeStatus.modelName}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${runtimeStatus.online ? 'bg-emerald-400' : 'bg-amber-500'}`} />
          </button>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-2 font-mono text-[11px] text-[#9C9C9C]">
          <span>Air-gapped</span>
          <span>•</span>
          <span className="text-[#987654]">127.0.0.1</span>
        </div>
      </div>

      {/* 2. Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 select-text">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Minimal Empty State */}
          {messages.length === 0 && (
            <div className="py-24 text-center space-y-3">
              <div className="font-mono text-xs uppercase tracking-widest text-[#987654]">
                LUMI
              </div>
              <p className="text-xs text-[#9C9C9C]">
                Enter a query or select an attachment to inspect the local workspace.
              </p>
            </div>
          )}

          {/* Render All Messages */}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col space-y-1 ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="text-[10px] font-mono text-[#9C9C9C] px-1">
                {msg.sender === 'user' ? 'You' : 'LUMI'} • {msg.timestamp}
              </div>

              <div
                className={`p-3.5 rounded text-xs leading-relaxed max-w-2xl space-y-2.5 ${
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
                        className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#080808] border border-[#303030] text-[10px] font-mono text-[#F5F4F1]"
                      >
                        {getFileIcon(att.type)}
                        <span>{att.name}</span>
                        <span className="text-[#9C9C9C]">({att.size})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct content ONLY */}
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Citations if available */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="pt-2 border-t border-[#262626] space-y-1">
                    <div className="text-[10px] font-mono text-[#987654]">Ground-truth citations:</div>
                    {msg.citations.map(cit => (
                      <div key={cit.id} className="text-[10px] font-mono text-[#9C9C9C]">
                        {cit.file} ({cit.section})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Real-time Generating Indicator with Stop Button */}
          {isGenerating && (
            <div className="flex items-center justify-between p-2.5 rounded bg-[#141414] border border-[#303030] text-xs font-mono text-[#987654] max-w-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full border border-[#987654] border-t-transparent animate-spin" />
                <span>Processing request...</span>
              </div>
              <button
                onClick={handleStopGeneration}
                className="px-2 py-0.5 rounded bg-[#080808] hover:bg-[#202020] text-red-400 border border-[#303030] text-[10px] flex items-center space-x-1"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 3. Composer Section */}
      <div className="p-4 border-t border-[#303030] bg-[#080808] shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* Active Attached Files Chips */}
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

          {/* Hidden File Picker Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept=".pdf,.docx,.pptx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
            className="hidden"
          />

          {/* Composer Card */}
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
              placeholder="Ask LUMI or query local workspace..."
              className="w-full bg-transparent border-none outline-none text-xs text-[#F5F4F1] placeholder-[#9C9C9C] resize-none font-sans leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2 border-t border-[#262626] text-xs">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach Document or Image"
                className="p-1 hover:text-[#F5F4F1] hover:bg-[#202020] rounded text-[#9C9C9C] transition-colors flex items-center space-x-1 text-[11px] font-mono"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Attach</span>
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
                    <span>Send</span>
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
