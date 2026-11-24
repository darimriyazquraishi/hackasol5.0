import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Copy,
  Check,
  CheckCircle2,
  Code,
  Layers,
  ChevronDown,
  ArrowUp,
  FileCode2,
  CheckCheck
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { AssistantMessage } from '../../types';
import { SendButton, LumiButton } from '../Common/Button';

export const AntigravityAssistant: React.FC = () => {
  const {
    assistantVisible,
    setAssistantVisible,
    activeFile,
    activeProjectId,
    activeProject,
    openFile,
    updateFileContent,
    saveCurrentFile
  } = useWorkspace();

  const [panelWidth, setPanelWidth] = useState(380);
  const isResizingRef = useRef(false);

  // Initial welcome message
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'welcome-agent',
      sender: 'assistant',
      timestamp: 'Ready',
      content: 'LUMI Local Coding Agent is connected to your isolated workspace. I analyze project files, explain functions, suggest bug fixes, and generate code with interactive diff approval before applying any modifications.'
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

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

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isThinking) return;

    const userMsg: AssistantMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: text
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsThinking(true);

    if (!activeProjectId) {
      setTimeout(() => {
        setIsThinking(false);
        setMessages(prev => [
          ...prev,
          {
            id: `msg-${Date.now() + 1}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: 'Please create or select an isolated user project in the File Explorer first so I can inspect project context.'
          }
        ]);
      }, 300);
      return;
    }

    try {
      const res = await fetch(`/api/ide/projects/${activeProjectId}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          activeFile: activeFile?.path,
          selectedCode: ''
        })
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: AssistantMessage = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: data.answer || 'Execution complete.',
          proposedDiff: data.proposedDiff
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages(prev => [
          ...prev,
          {
            id: `msg-${Date.now() + 1}`,
            sender: 'assistant',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: `Local coding agent encountered an error: ${errData.error || 'Request failed.'}`
          }
        ]);
      }
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          content: `Connection to local inference service failed: ${e.message}`
        }
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleApplyDiff = async (msgId: string, diff: NonNullable<AssistantMessage['proposedDiff']>) => {
    if (!activeProjectId) return;
    try {
      // Save modified content to project file via backend
      await fetch(`/api/ide/projects/${activeProjectId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: diff.filePath, content: diff.proposedCode })
      });

      // Update in-memory editor state
      updateFileContent(diff.filePath, diff.proposedCode);
      openFile(diff.filePath);

      // Mark applied in message
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId && m.proposedDiff
            ? { ...m, proposedDiff: { ...m.proposedDiff, applied: true } }
            : m
        )
      );
    } catch (e: any) {
      alert(`Failed to apply modification: ${e.message}`);
    }
  };

  const handleRejectDiff = (msgId: string) => {
    setMessages(prev =>
      prev.map(m =>
        m.id === msgId && m.proposedDiff
          ? { ...m, proposedDiff: undefined }
          : m
      )
    );
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

  return (
    <div
      style={{ width: `${panelWidth}px` }}
      className="bg-[#0c0c0c] border-l border-[#303030] flex flex-col h-full relative shrink-0 select-none overflow-hidden z-20 font-sans"
    >
      {/* Resizable handle on the left edge */}
      <div
        onMouseDown={e => {
          e.preventDefault();
          isResizingRef.current = true;
          document.body.style.cursor = 'col-resize';
        }}
        className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-[#987654] transition-colors z-30"
      />

      {/* Header */}
      <div className="h-10 px-3 bg-[#121212] border-b border-[#303030] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 flex items-center justify-center shrink-0 text-[#987654]">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-semibold text-xs tracking-wide text-[#F5F4F1] font-mono">
            LUMI Coding Agent
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#191919] text-[#987654] border border-[#303030] font-mono">
            qwen2.5:1.5b
          </span>
        </div>

        <button
          onClick={() => setAssistantVisible(false)}
          className="p-1 hover:bg-[#191919] rounded text-[#9C9C9C] hover:text-[#F5F4F1] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Project Context Pill */}
      <div className="px-3 py-1.5 bg-[#080808] border-b border-[#303030] flex items-center justify-between text-[11px] font-mono text-[#9C9C9C]">
        <div className="flex items-center space-x-1.5 truncate">
          <Layers className="w-3 h-3 text-[#987654] shrink-0" />
          <span className="text-[#D5D2CC] truncate">
            {activeProject ? activeProject.name : 'No project open'}
          </span>
        </div>
        {activeFile && (
          <span className="text-[#9C9C9C] text-[10px] truncate max-w-[120px]">
            {activeFile.name}
          </span>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 select-text">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col space-y-1 ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="text-[10px] text-[#9C9C9C] font-mono px-1">
              {msg.sender === 'user' ? 'You' : 'LUMI Agent'} • {msg.timestamp}
            </div>

            <div
              className={`p-3 rounded-xl text-xs leading-relaxed max-w-[92%] space-y-2.5 ${
                msg.sender === 'user'
                  ? 'bg-[#191919] text-[#F5F4F1] border border-[#303030]'
                  : 'bg-[#121212] text-[#D5D2CC] border border-[#303030] w-full'
              }`}
            >
              <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

              {/* Proposed Code Diff for Approval (Part 5.8) */}
              {msg.proposedDiff && (
                <div className="p-2.5 rounded-lg bg-[#080808] border border-[#987654]/50 space-y-2 font-mono">
                  <div className="flex items-center justify-between text-[11px] border-b border-[#303030] pb-1.5">
                    <div className="flex items-center space-x-1.5 text-[#987654] font-semibold">
                      <FileCode2 className="w-3.5 h-3.5" />
                      <span>{msg.proposedDiff.filePath}</span>
                    </div>
                    {msg.proposedDiff.applied && (
                      <span className="text-[#987654] text-xs flex items-center space-x-1">
                        <CheckCheck className="w-3 h-3" />
                        <span>Applied</span>
                      </span>
                    )}
                  </div>

                  <pre className="p-2 rounded bg-[#0c0c0c] border border-[#303030] text-[10px] text-[#D5D2CC] overflow-x-auto max-h-48">
                    <code>{msg.proposedDiff.proposedCode}</code>
                  </pre>

                  {!msg.proposedDiff.applied && (
                    <div className="flex items-center space-x-2 pt-1">
                      <LumiButton
                        variant="primary"
                        size="xs"
                        icon={<Check className="w-3 h-3" />}
                        onClick={() => handleApplyDiff(msg.id, msg.proposedDiff!)}
                      >
                        Apply Modification
                      </LumiButton>
                      <LumiButton
                        variant="secondary"
                        size="xs"
                        onClick={() => handleRejectDiff(msg.id)}
                      >
                        Discard
                      </LumiButton>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex items-center space-x-2 p-2.5 rounded-lg bg-[#121212] border border-[#303030] text-xs font-mono text-[#987654]">
            <div className="w-3 h-3 rounded-full border border-[#987654] border-t-transparent animate-spin" />
            <span>Analyzing project with local model...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Input */}
      <div className="p-3 border-t border-[#303030] bg-[#0c0c0c] shrink-0">
        <div className="relative bg-[#141414] border border-[#303030] focus-within:border-[#987654] rounded-xl p-2 transition-colors">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeProject ? "Ask coding agent about this project..." : "Create or open a project first..."}
            className="w-full bg-transparent border-none outline-none text-xs text-[#F5F4F1] placeholder-[#737373] resize-none font-sans leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1 border-t border-[#303030] text-xs">
            <span className="text-[10px] font-mono text-[#9C9C9C]">Enter to send, Shift+Enter for newline</span>
            <SendButton
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isThinking}
              isGenerating={isThinking}
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
