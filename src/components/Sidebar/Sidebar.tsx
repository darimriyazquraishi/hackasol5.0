import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Explorer } from './Explorer';
import { Search } from './Search';
import { SourceControl } from './SourceControl';
import { Extensions } from './Extensions';
import { PlayCircle, Bug } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeBarTab, sidebarVisible } = useWorkspace();

  // Resizable sidebar width
  const [width, setWidth] = useState(260);
  const isResizingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.max(180, Math.min(e.clientX - 48, 600));
      setWidth(newWidth);
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

  if (!sidebarVisible) return null;

  return (
    <div
      style={{ width: `${width}px` }}
      className="bg-[#1f1f1f] border-r border-[#2b2b2b] flex flex-col h-full relative shrink-0 select-none overflow-hidden"
    >
      {/* Dynamic Content based on active ActivityBar Tab */}
      {activeBarTab === 'explorer' && <Explorer />}
      {activeBarTab === 'search' && <Search />}
      {activeBarTab === 'git' && <SourceControl />}
      {activeBarTab === 'extensions' && <Extensions />}
      {activeBarTab === 'debug' && (
        <div className="flex-1 flex flex-col p-4 text-[#858585] text-xs">
          <div className="h-7 -mx-4 -mt-4 px-3 flex items-center justify-between text-[11px] font-bold text-[#bbbbbb] tracking-wider uppercase border-b border-[#2b2b2b] bg-[#1f1f1f] mb-4">
            <span>RUN AND DEBUG</span>
          </div>
          <div className="flex flex-col items-center justify-center h-48 text-center space-y-3">
            <Bug className="w-10 h-10 text-[#555555]" />
            <p className="text-[#858585]">To customize Run and Debug, open a folder and create a 'launch.json' file.</p>
            <button className="px-3 py-1.5 rounded bg-[#0078d4] text-white font-medium hover:bg-[#006bb3] transition-colors">
              Run and Debug (F5)
            </button>
          </div>
        </div>
      )}

      {/* Resize Handle */}
      <div
        onMouseDown={e => {
          e.preventDefault();
          isResizingRef.current = true;
          document.body.style.cursor = 'col-resize';
        }}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#007acc] transition-colors z-20"
      />
    </div>
  );
};
