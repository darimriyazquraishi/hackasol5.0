import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Code2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShieldCheck,
  Trash2,
  MessagesSquare,
  Check,
  Database,
  Box
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { LumiLogo } from '../Branding/LumiLogo';
import { formatConversationAge } from '../../services/timeUtils';

export const LeftSidebar: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    leftNavCollapsed,
    toggleLeftNav,
    conversations,
    activeConversationId,
    selectConversation,
    createConversation,
    deleteConversation
  } = useWorkspace();

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConversation(id);
  };

  // Live timer tick so conversation creation ages update periodically without full page reload
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Shortcut to quickly start a new conversation (Alt+N or Ctrl+Shift+N)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && e.key.toLowerCase() === 'n') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n')
      ) {
        e.preventDefault();
        createConversation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createConversation]);

  return (
    <aside
      className={`h-full bg-[#080808] border-r border-[#303030] flex flex-col justify-between select-none z-30 transition-[width] duration-150 shrink-0 ${
        leftNavCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Header & Branding */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* Logo and Collapse Toggle */}
        <div className="h-16 px-3.5 border-b border-[#303030] flex items-center justify-between shrink-0">
          <LumiLogo collapsed={leftNavCollapsed} size={leftNavCollapsed ? 'sm' : 'md'} />
          <button
            onClick={toggleLeftNav}
            title={leftNavCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="p-1.5 rounded text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919] transition-colors"
          >
            {leftNavCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Quick New Conversation Action */}
        <div className="p-2.5 border-b border-[#303030] shrink-0">
          {leftNavCollapsed ? (
            <button
              onClick={createConversation}
              title="Start New Conversation (Alt+N)"
              className="group relative w-10 h-10 mx-auto rounded-xl bg-[#121212] hover:bg-[#181818] border border-[#2c2c2c] hover:border-[#987654] text-[#987654] hover:text-[#F5F4F1] flex items-center justify-center transition-all duration-200 active:scale-95 shadow-sm hover:shadow-[0_2px_10px_rgba(152,118,84,0.18)] cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.2] transition-transform duration-300 group-hover:rotate-90 text-[#987654] group-hover:text-[#F5F4F1]" />
            </button>
          ) : (
            <button
              onClick={createConversation}
              title="Start New Conversation (Alt+N)"
              className="group relative w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#121212] hover:bg-[#191919] border border-[#2c2c2c] hover:border-[#987654]/70 transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-[0_2px_12px_rgba(152,118,84,0.12)] cursor-pointer overflow-hidden"
            >
              {/* Subtle top hairline highlight */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#987654]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-5 h-5 rounded-md bg-[#987654]/15 border border-[#987654]/30 flex items-center justify-center text-[#987654] group-hover:bg-[#987654] group-hover:text-[#F5F4F1] group-hover:border-[#987654] transition-all duration-200 shadow-sm shrink-0">
                  <Plus className="w-3.5 h-3.5 stroke-[2.4] transition-transform duration-300 group-hover:rotate-90" />
                </div>
                <span className="text-xs font-medium text-[#F5F4F1] tracking-wide truncate">
                  New Conversation
                </span>
              </div>

              <kbd className="text-[10px] font-mono text-[#9C9C9C]/60 px-1.5 py-0.5 rounded bg-[#080808] border border-[#242424] group-hover:border-[#383838] group-hover:text-[#D5D2CC] transition-colors shrink-0">
                Alt+N
              </kbd>
            </button>
          )}
        </div>

        {/* Conversation History Section */}
        {!leftNavCollapsed ? (
          <div className="flex-1 flex flex-col min-h-0 border-b border-[#303030]">
            <div className="px-3 pt-3 pb-1.5 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[#9C9C9C]">
              <span className="flex items-center space-x-1.5">
                <MessagesSquare className="w-3 h-3 text-[#987654]" />
                <span>Conversations</span>
              </span>
              <span>{conversations.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-1">
              {conversations.map(conv => {
                const isActive = activeModule === 'chat' && activeConversationId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => selectConversation(conv.id)}
                    className={`w-full group px-2.5 py-2 rounded text-xs text-left cursor-pointer transition-colors relative flex items-center justify-between ${
                      isActive
                        ? 'bg-[#191919] text-[#F5F4F1] font-medium border border-[#303030]'
                        : 'text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919]/60'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#987654] rounded-r" />
                    )}

                    <div className="min-w-0 pr-1 flex-1">
                      <div className="truncate text-xs text-[#F5F4F1]">{conv.title}</div>
                      <div
                        className="text-[10px] text-[#9C9C9C] font-mono mt-0.5"
                        title={conv.createdAt ? `Created ${new Date(conv.createdAt).toLocaleString()}` : undefined}
                      >
                        {formatConversationAge(conv)}
                      </div>
                    </div>

                    <button
                      onClick={e => handleDelete(e, conv.id)}
                      title="Delete conversation"
                      className="p-1 rounded transition-colors shrink-0 text-[#9C9C9C]/50 hover:text-red-400 hover:bg-[#202020]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 border-b border-[#303030] py-2 flex flex-col items-center space-y-2">
            <button
              onClick={() => setActiveModule('chat')}
              title="View Conversations"
              className={`p-2 rounded text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919] ${
                activeModule === 'chat' ? 'text-[#987654] bg-[#191919]' : ''
              }`}
            >
              <MessagesSquare className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Primary Platform Workspaces Navigation */}
        <div className="p-2 space-y-1 shrink-0">
          {/* AI Chat Primary */}
          <button
            onClick={() => setActiveModule('chat')}
            title={leftNavCollapsed ? 'AI Chat Workspace' : undefined}
            className={`w-full h-8 rounded px-2.5 flex items-center justify-between text-xs transition-colors relative ${
              activeModule === 'chat'
                ? 'bg-[#191919] text-[#F5F4F1] font-medium border border-[#303030]'
                : 'text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919]/60'
            }`}
          >
            {activeModule === 'chat' && (
              <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#987654] rounded-r" />
            )}
            <div className="flex items-center space-x-2.5 min-w-0">
              <MessageSquare
                className={`w-4 h-4 ${activeModule === 'chat' ? 'text-[#987654]' : 'text-[#9C9C9C]'}`}
              />
              {!leftNavCollapsed && <span>AI Chat</span>}
            </div>
          </button>

          {/* IDE / Developer Workspace */}
          <button
            onClick={() => setActiveModule('ide')}
            title={leftNavCollapsed ? 'IDE Coding Workspace' : undefined}
            className={`w-full h-8 rounded px-2.5 flex items-center justify-between text-xs transition-colors relative ${
              activeModule === 'ide'
                ? 'bg-[#191919] text-[#F5F4F1] font-medium border border-[#303030]'
                : 'text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919]/60'
            }`}
          >
            {activeModule === 'ide' && (
              <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#987654] rounded-r" />
            )}
            <div className="flex items-center space-x-2.5 min-w-0">
              <Code2
                className={`w-4 h-4 ${activeModule === 'ide' ? 'text-[#987654]' : 'text-[#9C9C9C]'}`}
              />
              {!leftNavCollapsed && <span>IDE Workspace</span>}
            </div>
          </button>

          {/* 3D Studio (Blender Automation Workspace) */}
          <button
            onClick={() => setActiveModule('studio')}
            title={leftNavCollapsed ? '3D Studio (Blender)' : undefined}
            className={`w-full h-8 rounded px-2.5 flex items-center justify-between text-xs transition-colors relative ${
              activeModule === 'studio'
                ? 'bg-[#191919] text-[#F5F4F1] font-medium border border-[#303030]'
                : 'text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919]/60'
            }`}
          >
            {activeModule === 'studio' && (
              <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#987654] rounded-r" />
            )}
            <div className="flex items-center space-x-2.5 min-w-0">
              <Box
                className={`w-4 h-4 ${activeModule === 'studio' ? 'text-[#987654]' : 'text-[#9C9C9C]'}`}
              />
              {!leftNavCollapsed && <span>3D Studio</span>}
            </div>
          </button>

          {/* RAG / Knowledge Base Workspace */}
          <button
            onClick={() => setActiveModule('knowledge')}
            title={leftNavCollapsed ? 'RAG & Knowledge Base' : undefined}
            className={`w-full h-8 rounded px-2.5 flex items-center justify-between text-xs transition-colors relative ${
              activeModule === 'knowledge'
                ? 'bg-[#191919] text-[#F5F4F1] font-medium border border-[#303030]'
                : 'text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919]/60'
            }`}
          >
            {activeModule === 'knowledge' && (
              <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#987654] rounded-r" />
            )}
            <div className="flex items-center space-x-2.5 min-w-0">
              <Database
                className={`w-4 h-4 ${activeModule === 'knowledge' ? 'text-[#987654]' : 'text-[#9C9C9C]'}`}
              />
              {!leftNavCollapsed && <span>Knowledge Base</span>}
            </div>
          </button>

          {/* Settings & AI Workbench */}
          <button
            onClick={() => setActiveModule('settings')}
            title={leftNavCollapsed ? 'Settings & AI Workbench' : undefined}
            className={`w-full h-8 rounded px-2.5 flex items-center justify-between text-xs transition-colors relative ${
              activeModule === 'settings'
                ? 'bg-[#191919] text-[#F5F4F1] font-medium border border-[#303030]'
                : 'text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919]/60'
            }`}
          >
            {activeModule === 'settings' && (
              <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#987654] rounded-r" />
            )}
            <div className="flex items-center space-x-2.5 min-w-0">
              <Settings
                className={`w-4 h-4 ${activeModule === 'settings' ? 'text-[#987654]' : 'text-[#9C9C9C]'}`}
              />
              {!leftNavCollapsed && <span>Settings</span>}
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="p-2.5 border-t border-[#303030] text-[10px] font-mono text-[#9C9C9C] bg-[#080808] shrink-0">
        {!leftNavCollapsed ? (
          <div className="flex items-center justify-between px-1 text-[10px] text-[#9C9C9C]">
            <span>LUMI Platform</span>
            <span className="text-[#987654]">v1.0</span>
          </div>
        ) : (
          <div className="flex justify-center text-[10px] text-[#987654]">
            v1.0
          </div>
        )}
      </div>
    </aside>
  );
};
