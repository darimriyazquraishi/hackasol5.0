import React, { useRef } from 'react';
import {
  X,
  Split,
  MoreHorizontal,
  Play,
  ChevronRight
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { CodeEditor } from './CodeEditor';
import { WelcomeTab } from './WelcomeTab';
import { getFileIcon } from '../../services/fileIcons';

export const EditorArea: React.FC = () => {
  const {
    tabs,
    activeTabId,
    activeFile,
    openFile,
    closeTab,
    closeAllTabs,
    setPanelVisible,
    setPanelTab
  } = useWorkspace();

  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // Compute breadcrumbs for active file
  const breadcrumbSegments = activeFile
    ? activeFile.path.split('/').filter(Boolean)
    : [];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080808] select-none">
      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="h-9 bg-[#0c0c0c] border-b border-[#303030] flex items-center justify-between text-xs z-10 shrink-0">
          {/* Scrollable Tabs */}
          <div
            ref={tabsScrollRef}
            className="flex-1 flex items-center overflow-x-auto no-scrollbar h-full"
          >
            {tabs.map(tab => {
              const isActive = activeTabId === tab.id;

              return (
                <div
                  key={tab.id}
                  onClick={() => openFile(tab.path)}
                  onAuxClick={e => {
                    // Middle click closes tab
                    if (e.button === 1) {
                      e.preventDefault();
                      closeTab(tab.id);
                    }
                  }}
                  className={`group h-full flex items-center px-3 space-x-2 border-r border-[#303030] cursor-pointer transition-colors shrink-0 max-w-[200px] border-t-2 select-none ${
                    isActive
                      ? 'bg-[#080808] text-[#F5F4F1] border-t-[#987654]'
                      : 'bg-[#0e0e0e] text-[#9C9C9C] hover:bg-[#141414] border-t-transparent hover:text-[#F5F4F1]'
                  }`}
                >
                  <span className="flex items-center justify-center shrink-0">
                    {getFileIcon({ name: tab.name, className: 'w-3.5 h-3.5' })}
                  </span>

                  <span className={`truncate text-xs ${tab.isDirty ? 'italic' : ''}`}>
                    {tab.name}
                  </span>

                  {/* Dirty indicator or close button */}
                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    {tab.isDirty ? (
                      <span className="w-2 h-2 rounded-full bg-[#987654] group-hover:hidden" />
                    ) : null}

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className={`p-0.5 rounded-sm hover:bg-[#191919] hover:text-[#F5F4F1] ${
                        tab.isDirty ? 'hidden group-hover:block' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Editor Actions */}
          <div className="flex items-center space-x-1 px-2 text-[#9C9C9C] shrink-0 bg-[#0c0c0c]">
            <button
              onClick={() => {
                setPanelVisible(true);
                setPanelTab('terminal');
              }}
              title="Run Code in Terminal"
              className="p-1.5 hover:text-[#F5F4F1] hover:bg-[#191919] rounded flex items-center space-x-1 text-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
            </button>

            <button
              title="Split Editor Right"
              className="p-1.5 hover:text-[#F5F4F1] hover:bg-[#191919] rounded transition-colors"
            >
              <Split className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => closeAllTabs()}
              title="Close All Tabs"
              className="p-1.5 hover:text-[#F5F4F1] hover:bg-[#191919] rounded transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Breadcrumbs Bar */}
      {activeFile && (
        <div className="h-6 px-4 bg-[#080808] border-b border-[#303030] flex items-center text-[11px] text-[#9C9C9C] space-x-1 shrink-0">
          <span className="hover:text-[#F5F4F1] cursor-pointer">workspace</span>
          {breadcrumbSegments.map((segment, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3 h-3 text-[#4a4a4a]" />
              <span
                className={`cursor-pointer hover:text-[#F5F4F1] ${
                  idx === breadcrumbSegments.length - 1 ? 'text-[#F5F4F1] font-medium' : ''
                }`}
              >
                {segment}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        {tabs.length > 0 && activeFile ? <CodeEditor /> : <WelcomeTab />}
      </div>
    </div>
  );
};
