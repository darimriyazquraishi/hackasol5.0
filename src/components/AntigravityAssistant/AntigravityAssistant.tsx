import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Plus,
  History,
  ChevronDown,
  ChevronRight,
  Send,
  Paperclip,
  Globe,
  CornerDownLeft,
  Copy,
  Check,
  CheckCircle2,
  Terminal,
  FileCode2,
  FileEdit,
  Code,
  Zap,
  Bot,
  Brain,
  SlidersHorizontal,
  ArrowUp,
  Maximize2
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { AssistantMessage, AssistantToolCall } from '../../types';

export const AntigravityAssistant: React.FC = () => {
  const {
    assistantVisible,
    setAssistantVisible,
    activeFile,
    workspaceName,
    openFile
  } = useWorkspace();

  const [panelWidth, setPanelWidth] = useState(380);
  const isResizingRef = useRef(false);

  // Model selection
  const [selectedModel, setSelectedModel] = useState('Gemini 3.8 Flash (High)');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // Web search toggle
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);

  // Chat messages
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'msg-1',
      sender: 'user',
      timestamp: 'Just now',
      content: 'Can you analyze this project structure and verify all VSCode features are working?'
    },
    {
      id: 'msg-2',
      sender: 'assistant',
      timestamp: 'Just now',
      thoughtDuration: '3.4s',
      thoughts: `1. Analyzed workspace files including src/App.tsx, Explorer, Monaco Editor, and Terminal integration.
2. Verified File System Access API hooks and native directory loading pipelines.
3. Verified compilation status via npm run build.
4. Confirmed Monaco Editor syntax services, minimap, status bar indicators, and breadcrumbs are fully synchronized.`,
      toolCalls: [
        {
          id: 'tool-1',
          tool: 'read_file',
          summary: 'Read src/App.tsx',
          status: 'completed',
          command: 'read_file({ Path: "d:/IIIT(2)/src/App.tsx" })',
          output: 'File loaded successfully (62 lines)'
        },
        {
          id: 'tool-2',
          tool: 'run_command',
          summary: 'Build project with TypeScript & Vite',
          status: 'completed',
          command: 'npm.cmd run build',
          output: '✓ 1623 modules transformed.\n✓ built in 4.04s\nExit code: 0'
        }
      ],
      content: `Workspace audit complete for **VSCode Web**:

- Monaco editor mounts with syntax coloring, bracket matching, minimap, and caret animation.
- File tree handles directory navigation, inline file and folder creation, F2 renaming, and deletion.
- Integrated terminal provides shell commands (\`ls\`, \`cat\`, \`touch\`, \`node\`, \`python\`, \`git\`) bound to the workspace tree.
- Status bar displays active cursor position, Git branch, language modes, and command palette triggers.`
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({ 'msg-2': false });
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, []);

  // Drag-to-resize panel width
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.max(300, Math.min(window.innerWidth - e.clientX, 750));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!assistantVisible) return null;

  const handleSendMessage = () => {
    const text = inputValue.trim();
    if (!text) return;

    const userMsg: AssistantMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      timestamp: 'Just now',
      content: text
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsThinking(true);

    // Simulate Antigravity reasoning and response
    setTimeout(() => {
      setIsThinking(false);

      let replyContent = '';
      if (text.startsWith('/plan')) {
        replyContent = `### Implementation Steps
1. Review editor buffer listeners and dirty state tracking.
2. Verify directory tree collapse and file resolution paths.
3. Check terminal execution context and return codes.
4. Run project build to confirm clean TypeScript compilation.`;
      } else if (text.startsWith('/boost')) {
        replyContent = `### Multi-Angle Analysis
- Editor: Minimap and syntax coloring stay within memory budget.
- Security: Local file interactions use standard File System Access API without escaping root.
- Consistency: Keybindings match standard VSCode shortcuts.`;
      } else {
        replyContent = `Inspected workspace \`${workspaceName}\`${
          activeFile ? ` at \`${activeFile.name}\`` : ''
        }.

All components are mounted and responsive.`;
      }

      const assistantMsg: AssistantMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp: 'Just now',
        thoughtDuration: '2.1s',
        thoughts: `Inspected user prompt: "${text}".
Referenced current context: ${activeFile?.name || 'Workspace root'}.
Formulated structured response with Antigravity design guidelines.`,
        toolCalls: [
          {
            id: `tool-${Date.now()}`,
            tool: 'read_file',
            summary: `Read ${activeFile ? activeFile.path : 'package.json'}`,
            status: 'completed',
            output: 'Content retrieved and analyzed.'
          }
        ],
        content: replyContent
      };

      setMessages(prev => [...prev, assistantMsg]);
    }, 1400);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyCode = (codeText: string, id: string) => {
    navigator.clipboard?.writeText(codeText);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 1500);
  };

  const models = [
    { name: 'Gemini 3.8 Flash (High)', desc: 'Ultra-fast & intelligent reasoning (Default)' },
    { name: 'Gemini 3.5 Pro', desc: 'Complex multi-step engineering & architecture' },
    { name: 'Claude 3.7 Sonnet (Thinking)', desc: 'Hybrid reasoning and deep analysis' },
    { name: 'GPT-4o', desc: 'General multimodal coding' }
  ];

  return (
    <div
      style={{ width: `${panelWidth}px` }}
      className="bg-[#18191c] border-l border-[#2e3035] flex flex-col h-full relative shrink-0 select-none overflow-hidden z-20 font-sans"
    >
      {/* Resizable handle on the left edge */}
      <div
        onMouseDown={e => {
          e.preventDefault();
          isResizingRef.current = true;
          document.body.style.cursor = 'col-resize';
        }}
        className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-[#4285f4] transition-colors z-30"
      />

      {/* Header */}
      <div className="h-10 px-3 bg-[#1e1f22] border-b border-[#2e3035] flex items-center justify-between shrink-0">
        {/* Antigravity Logo & Branding */}
        <div className="flex items-center space-x-2">
          {/* Antigravity Gradient Sparkle Icon */}
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="antigravityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4285F4" />
                  <stop offset="50%" stopColor="#9B51E0" />
                  <stop offset="100%" stopColor="#E91E63" />
                </linearGradient>
              </defs>
              <path
                d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
                fill="url(#antigravityGrad)"
              />
            </svg>
          </div>

          <span className="font-semibold text-xs tracking-wide text-white">
            Antigravity
          </span>

          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-400 border border-blue-500/30 font-medium">
            2.0
          </span>
        </div>

        {/* Model Selector Pill */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#26272b] hover:bg-[#323338] text-[11px] text-[#cccccc] border border-[#36383e] transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="max-w-[110px] truncate">{selectedModel}</span>
            <ChevronDown className="w-3 h-3 text-[#858585]" />
          </button>

          {modelDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-[#26272b] border border-[#3e4046] rounded-lg shadow-2xl py-1 text-xs z-50">
              <div className="px-3 py-1 text-[10px] font-semibold text-[#858585] uppercase tracking-wider">
                Select Model
              </div>
              {models.map(m => (
                <button
                  key={m.name}
                  onClick={() => {
                    setSelectedModel(m.name);
                    setModelDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-[#323338] transition-colors flex flex-col ${
                    selectedModel === m.name ? 'text-blue-400 font-medium bg-[#323338]/60' : 'text-[#cccccc]'
                  }`}
                >
                  <span className="text-xs">{m.name}</span>
                  <span className="text-[10px] text-[#858585]">{m.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-1 text-[#858585]">
          <button
            onClick={() => setMessages([])}
            title="New Chat Session"
            className="p-1 hover:text-white hover:bg-[#26272b] rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setAssistantVisible(false)}
            title="Close Assistant (Ctrl+L)"
            className="p-1 hover:text-white hover:bg-[#26272b] rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active Context Banner */}
      <div className="px-3 py-1.5 bg-[#141517] border-b border-[#26272b] flex items-center justify-between text-[11px] text-[#858585]">
        <div className="flex items-center space-x-1.5 truncate">
          <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#202124] text-blue-400 border border-blue-500/20 truncate">
            <span>@workspace</span>
          </span>
          {activeFile && (
            <span
              onClick={() => openFile(activeFile.path)}
              className="cursor-pointer hover:text-white flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#202124] text-[#cccccc] border border-[#33353a] truncate"
            >
              <span>@{activeFile.name}</span>
            </span>
          )}
        </div>
        <span className="text-[10px] text-[#6e7178] shrink-0 font-mono">1.2M ctx</span>
      </div>

      {/* Conversation Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs select-text">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center p-4 space-y-4 text-[#858585]">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600/20 via-purple-600/20 to-pink-600/20 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">How can I help you today?</h3>
              <p className="text-[11px] text-[#858585] mt-1 max-w-[240px]">
                Ask questions, generate components, refactor code, or run terminal tasks.
              </p>
            </div>

            {/* Quick Starter Chips */}
            <div className="w-full space-y-1.5 pt-2 text-left">
              <button
                onClick={() => {
                  setInputValue('/plan create an authentication flow with JWT');
                  textareaRef.current?.focus();
                }}
                className="w-full p-2 rounded-lg bg-[#202124] hover:bg-[#282a2e] border border-[#2e3035] text-[11px] text-[#cccccc] flex items-center space-x-2 transition-colors"
              >
                <span className="text-blue-400 font-mono">/plan</span>
                <span className="truncate">Create an auth flow with JWT</span>
              </button>

              <button
                onClick={() => {
                  setInputValue(`Explain the architecture of ${activeFile?.name || 'this project'}`);
                  textareaRef.current?.focus();
                }}
                className="w-full p-2 rounded-lg bg-[#202124] hover:bg-[#282a2e] border border-[#2e3035] text-[11px] text-[#cccccc] flex items-center space-x-2 transition-colors"
              >
                <span className="text-purple-400">🔍</span>
                <span className="truncate">Explain project architecture</span>
              </button>

              <button
                onClick={() => {
                  setInputValue('/boost optimize performance and memory usage');
                  textareaRef.current?.focus();
                }}
                className="w-full p-2 rounded-lg bg-[#202124] hover:bg-[#282a2e] border border-[#2e3035] text-[11px] text-[#cccccc] flex items-center space-x-2 transition-colors"
              >
                <span className="text-emerald-400 font-mono">/boost</span>
                <span className="truncate">Optimize performance & memory</span>
              </button>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="space-y-2">
              {/* User Message */}
              {msg.sender === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] bg-[#2b2d31] text-white px-3 py-2 rounded-2xl rounded-tr-sm text-xs leading-relaxed border border-[#3b3d43] shadow-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                /* Assistant Message */
                <div className="space-y-2">
                  {/* Header info */}
                  <div className="flex items-center space-x-1.5 text-[11px] text-[#858585]">
                    <div className="w-3.5 h-3.5 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
                          fill="url(#antigravityGrad)"
                        />
                      </svg>
                    </div>
                    <span className="font-medium text-[#cccccc]">Antigravity</span>
                    <span>•</span>
                    <span className="text-[10px]">{msg.timestamp}</span>
                  </div>

                  {/* Thinking Disclosure */}
                  {msg.thoughts && (
                    <div className="rounded-lg bg-[#141517] border border-[#26272b] overflow-hidden">
                      <button
                        onClick={() =>
                          setExpandedThoughts(prev => ({
                            ...prev,
                            [msg.id]: !prev[msg.id]
                          }))
                        }
                        className="w-full px-2.5 py-1.5 flex items-center justify-between text-[11px] text-[#858585] hover:text-[#cccccc] transition-colors"
                      >
                        <div className="flex items-center space-x-1.5">
                          <Brain className="w-3.5 h-3.5 text-purple-400" />
                          <span>Thought {msg.thoughtDuration ? `for ${msg.thoughtDuration}` : ''}</span>
                        </div>
                        {expandedThoughts[msg.id] ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>

                      {expandedThoughts[msg.id] && (
                        <div className="px-3 py-2 text-[11px] font-mono text-[#9da2ab] border-t border-[#26272b] whitespace-pre-line leading-relaxed bg-[#101113]">
                          {msg.thoughts}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tool Call Cards */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="space-y-1.5">
                      {msg.toolCalls.map(tool => (
                        <div
                          key={tool.id}
                          className="px-2.5 py-1.5 rounded-lg bg-[#1c1d21] border border-[#2e3035] text-[11px] flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2 truncate">
                            {tool.tool === 'run_command' && (
                              <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}
                            {tool.tool === 'read_file' && (
                              <FileCode2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            )}
                            {tool.tool === 'edit_file' && (
                              <FileEdit className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            )}
                            <span className="truncate text-[#cccccc] font-medium">
                              {tool.summary}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                            <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-mono">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Done</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="text-xs text-[#d1d5db] leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Thinking Indicator */}
        {isThinking && (
          <div className="flex items-center space-x-2 py-2 text-xs text-[#858585]">
            <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <span className="animate-pulse">Antigravity is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Deck */}
      <div className="p-3 bg-[#18191c] border-t border-[#2e3035] space-y-2">
        {/* Floating Input Card */}
        <div className="bg-[#202124] border border-[#33353b] focus-within:border-blue-500 rounded-xl p-2 transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Antigravity, @ to tag files, / for commands..."
            className="w-full bg-transparent border-none outline-none text-xs text-white placeholder-[#6e7178] resize-none font-sans leading-relaxed"
          />

          {/* Bottom Toolbar inside Input Card */}
          <div className="flex items-center justify-between pt-1 text-[11px] text-[#858585]">
            {/* Left buttons */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => {
                  setInputValue(prev => prev + '@workspace ');
                  textareaRef.current?.focus();
                }}
                className="px-1.5 py-0.5 rounded hover:bg-[#2b2d31] hover:text-[#cccccc] transition-colors flex items-center space-x-1 text-[10px]"
              >
                <span>@</span>
                <span>Context</span>
              </button>

              <button
                onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                title="Toggle Web Search"
                className={`px-1.5 py-0.5 rounded transition-colors flex items-center space-x-1 text-[10px] ${
                  webSearchEnabled
                    ? 'text-blue-400 bg-blue-500/10'
                    : 'hover:bg-[#2b2d31] text-[#6e7178]'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>Web</span>
              </button>
            </div>

            {/* Right: Send button */}
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isThinking}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                inputValue.trim() && !isThinking
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:scale-105'
                  : 'bg-[#2b2d31] text-[#555861] cursor-not-allowed'
              }`}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer Subtext */}
        <div className="text-center text-[10px] text-[#555861]">
          Antigravity 2.0 • Google DeepMind
        </div>
      </div>
    </div>
  );
};
