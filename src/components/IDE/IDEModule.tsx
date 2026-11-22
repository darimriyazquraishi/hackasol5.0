import React from 'react';
import { TitleBar } from '../TitleBar/TitleBar';
import { ActivityBar } from '../ActivityBar/ActivityBar';
import { Sidebar } from '../Sidebar/Sidebar';
import { EditorArea } from '../Editor/EditorArea';
import { BottomPanel } from '../Panel/BottomPanel';
import { StatusBar } from '../StatusBar/StatusBar';
import { AntigravityAssistant } from '../AntigravityAssistant/AntigravityAssistant';

export const IDEModule: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#080808] text-[#F5F4F1]">
      {/* IDE Top Bar / Menus */}
      <TitleBar />

      {/* Main IDE Workspace: Activity Bar + Sidebar + Editor/Panel + Assistant */}
      <div className="flex-1 flex overflow-hidden relative">
        <ActivityBar />
        <Sidebar />

        <div className="flex-1 flex flex-col overflow-hidden relative">
          <EditorArea />
          <BottomPanel />
        </div>

        <AntigravityAssistant />
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
};
