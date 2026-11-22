import React from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { LeftSidebar } from './components/Navigation/LeftSidebar';
import { RightContextPanel } from './components/ContextPanel/RightContextPanel';
import { ChatModule } from './components/Chat/ChatModule';
import { IDEModule } from './components/IDE/IDEModule';
import { KnowledgeBaseModule } from './components/KnowledgeBase/KnowledgeBaseModule';
import { SettingsModule } from './components/Settings/SettingsModule';
import { CommandPalette } from './components/CommandPalette/CommandPalette';

const MainLayout: React.FC = () => {
  const { activeModule, activeConversation } = useWorkspace();

  // Initial landing page condition: active module is chat and there are zero messages.
  // In accordance with Image 1, absolutely NO sidebars, headers, context panels,
  // or extraneous elements may be rendered on the initial screen.
  const isLandingView =
    activeModule === 'chat' &&
    (!activeConversation || activeConversation.messages.length === 0);

  if (isLandingView) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-black text-[#F5F4F1] font-sans">
        <ChatModule isLandingView={true} />
        <CommandPalette />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#080808] text-[#F5F4F1] font-sans">
      {/* 1. Persistent Collapsible Left Navigation (Only in conversation or IDE/Settings views) */}
      <LeftSidebar />

      {/* 2. Main Module Workspace: Chat-first by default, IDE, and Settings containing the entire AI Workbench */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {activeModule === 'chat' && <ChatModule isLandingView={false} />}
        {activeModule === 'ide' && <IDEModule />}
        {activeModule === 'knowledge' && <KnowledgeBaseModule />}
        {activeModule === 'settings' && <SettingsModule />}
        {activeModule !== 'chat' && activeModule !== 'ide' && activeModule !== 'knowledge' && activeModule !== 'settings' && (
          <ChatModule isLandingView={false} />
        )}
      </main>

      {/* 3. Collapsible Right Context Panel */}
      {activeModule !== 'ide' && <RightContextPanel />}

      {/* 4. Global Command Palette */}
      <CommandPalette />
    </div>
  );
};

export function App() {
  return (
    <WorkspaceProvider>
      <MainLayout />
    </WorkspaceProvider>
  );
}

export default App;
