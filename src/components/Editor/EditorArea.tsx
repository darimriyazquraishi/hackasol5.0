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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1e1e1e] select-none">
      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="h-9 bg-[#181818] border-b border-[#2b2b2b] flex items-center justify-between text-xs z-10 shrink-0">
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
                  className={`group h-full flex items-center px-3 space-x-2 border-r border-[#2b2b2b] cursor-pointer transition-colors shrink-0 max-w-[200px] border-t-2 select-none ${
                    isActive
                      ? 'bg-[#1e1e1e] text-white border-t-[#0078d4]'
                      : 'bg-[#181818] text-[#969696] hover:bg-[#1f1f1f] border-t-transparent hover:text-[#cccccc]'
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
                      <span className="w-2 h-2 rounded-full bg-white group-hover:hidden" />
                    ) : null}

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className={`p-0.5 rounded-sm hover:bg-[#3c3c3c] hover:text-white ${
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
          <div className="flex items-center space-x-1 px-2 text-[#858585] shrink-0 bg-[#181818]">
            <button
              onClick={() => {
                setPanelVisible(true);
                setPanelTab('terminal');
              }}
              title="Run Code in Terminal"
              className="p-1.5 hover:text-white hover:bg-[#2b2b2b] rounded flex items-center space-x-1 text-xs"
            >
              <Play className="w-3.5 h-3.5 text-green-400 fill-current" />
            </button>

            <button
              title="Split Editor Right"
              className="p-1.5 hover:text-white hover:bg-[#2b2b2b] rounded"
            >
              <Split className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => closeAllTabs()}
              title="Close All Tabs"
              className="p-1.5 hover:text-white hover:bg-[#2b2b2b] rounded"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Breadcrumbs Bar */}
      {activeFile && (
        <div className="h-6 px-4 bg-[#1e1e1e] border-b border-[#2b2b2b] flex items-center text-[11px] text-[#858585] space-x-1 shrink-0">
          <span className="hover:text-[#cccccc] cursor-pointer">workspace</span>
          {breadcrumbSegments.map((segment, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3 h-3 text-[#555555]" />
              <span
                className={`cursor-pointer hover:text-[#cccccc] ${
                  idx === breadcrumbSegments.length - 1 ? 'text-[#cccccc] font-medium' : ''
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
