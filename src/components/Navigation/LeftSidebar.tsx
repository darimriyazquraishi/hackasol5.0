import React, { useState } from 'react';
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
  Check
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { LumiLogo } from '../Branding/LumiLogo';

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

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      deleteConversation(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  return (
    <aside
      className={`h-full bg-[#080808] border-r border-[#303030] flex flex-col justify-between select-none z-30 transition-[width] duration-150 shrink-0 ${
        leftNavCollapsed ? 'w-14' : 'w-64'
      }`}
    >
      {/* Top Header & Branding */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* Logo and Collapse Toggle */}
        <div className="h-12 px-3.5 border-b border-[#303030] flex items-center justify-between shrink-0">
          <LumiLogo collapsed={leftNavCollapsed} />
          <button
            onClick={toggleLeftNav}
            title={leftNavCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="p-1 rounded text-[#9C9C9C] hover:text-[#F5F4F1] hover:bg-[#191919] transition-colors"
          >
            {leftNavCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Quick New Conversation Action */}
        <div className="p-2 border-b border-[#303030] shrink-0">
          <button
            onClick={createConversation}
            title="Start New Conversation"
            className={`w-full py-2 rounded flex items-center justify-center space-x-2 text-xs font-medium transition-colors ${
              leftNavCollapsed
                ? 'bg-[#191919] hover:bg-[#202020] text-[#F5F4F1] border border-[#303030]'
                : 'bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            {!leftNavCollapsed && <span>New Conversation</span>}
          </button>
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
                const isConfirming = confirmDeleteId === conv.id;

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
                      <div className="text-[10px] text-[#9C9C9C] font-mono mt-0.5">
                        {conv.lastUpdated}
                      </div>
                    </div>

                    <button
                      onClick={e => handleDelete(e, conv.id)}
                      title={isConfirming ? 'Click again to confirm delete' : 'Delete conversation'}
                      className={`p-1 rounded transition-colors shrink-0 ${
                        isConfirming
                          ? 'bg-red-950 text-red-300'
                          : 'opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-[#202020]'
                      }`}
                    >
                      {isConfirming ? (
                        <Check className="w-3 h-3 text-red-400" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
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
            {!leftNavCollapsed && (
              <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-[#080808] text-[#987654] border border-[#303030]">
                PRO
              </span>
            )}
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

      {/* Bottom Sovereignty Badge */}
      <div className="p-2 border-t border-[#303030] text-[10px] font-mono text-[#9C9C9C] bg-[#080808] shrink-0">
        {!leftNavCollapsed ? (
          <div className="flex items-center justify-between px-1 py-1 text-[9px] text-[#9C9C9C]">
            <span className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#987654]" />
              <span>Zero Telemetry</span>
            </span>
            <span className="text-emerald-500 font-bold">100% LOCAL</span>
          </div>
        ) : (
          <div className="flex flex-col items-center py-1 text-center" title="Zero Telemetry Local Mode">
            <ShieldCheck className="w-4 h-4 text-[#987654]" />
          </div>
        )}
      </div>
    </aside>
  );
};
