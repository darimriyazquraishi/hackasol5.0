import React, { useState } from 'react';
import {
  GitCommit as GitCommitIcon,
  Check,
  Plus,
  Minus,
  RotateCcw,
  GitBranch,
  History,
  FileCode
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getFileIcon } from '../../services/fileIcons';
import { LumiButton } from '../Common/Button';

export const SourceControl: React.FC = () => {
  const {
    gitState,
    stageFile,
    unstageFile,
    commitChanges,
    openFile
  } = useWorkspace();

  const [commitMessage, setCommitMessage] = useState('');

  const handleCommit = () => {
    if (!commitMessage.trim()) return;
    commitChanges(commitMessage);
    setCommitMessage('');
  };

  const hasChanges = gitState.modifiedFiles.length > 0 || gitState.stagedFiles.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="h-7 px-3 flex items-center justify-between text-[11px] font-bold text-[#D5D2CC] tracking-wider uppercase border-b border-[#303030] bg-[#0c0c0c]">
        <span>SOURCE CONTROL: GIT</span>
        <div className="flex items-center space-x-1 text-[#9C9C9C]">
          <span className="text-[10px] text-[#987654] flex items-center space-x-1">
            <GitBranch className="w-3 h-3" />
            <span>{gitState.branch}</span>
          </span>
        </div>
      </div>

      {/* Commit Input Area */}
      <div className="p-3 border-b border-[#303030] space-y-2">
        <textarea
          placeholder="Message (Ctrl+Enter to commit on 'main')"
          value={commitMessage}
          onChange={e => setCommitMessage(e.target.value)}
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              handleCommit();
            }
          }}
          rows={3}
          className="w-full bg-[#141414] border border-[#303030] focus:border-[#987654] text-xs text-[#F5F4F1] p-2 rounded outline-none resize-none font-sans transition-colors"
        />

        <LumiButton
          variant="primary"
          size="sm"
          icon={<Check className="w-3.5 h-3.5" />}
          onClick={handleCommit}
          disabled={!commitMessage.trim() || !hasChanges}
          className="w-full justify-center shadow-sm"
        >
          Commit
        </LumiButton>
      </div>

      {/* Changes Section */}
      <div className="flex-1 overflow-y-auto py-2 space-y-3">
        {/* Staged Changes */}
        {gitState.stagedFiles.length > 0 && (
          <div>
            <div className="px-3 py-1 flex items-center justify-between text-[11px] font-semibold text-[#858585] uppercase">
              <span>Staged Changes ({gitState.stagedFiles.length})</span>
            </div>
            {gitState.stagedFiles.map(path => {
              const name = path.split('/').pop() || path;
              return (
                <div
                  key={path}
                  onClick={() => openFile(path)}
                  className="flex items-center justify-between h-6 px-3 cursor-pointer hover:bg-[#2a2d2e] text-xs text-[#cccccc] group"
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    {getFileIcon({ name, className: 'w-4 h-4' })}
                    <span className="truncate">{name}</span>
                    <span className="text-[10px] text-[#858585] truncate">{path}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-green-500 font-bold text-xs">M</span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        unstageFile(path);
                      }}
                      title="Unstage Changes"
                      className="hidden group-hover:block p-0.5 hover:text-white rounded"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Changes */}
        <div>
          <div className="px-3 py-1 flex items-center justify-between text-[11px] font-semibold text-[#858585] uppercase">
            <span>Changes ({gitState.modifiedFiles.length})</span>
          </div>

          {gitState.modifiedFiles.length === 0 && gitState.stagedFiles.length === 0 ? (
            <div className="px-4 py-3 text-xs text-[#6e6e6e] text-center">
              No changes detected in working tree. Edit any file to see changes here.
            </div>
          ) : (
            gitState.modifiedFiles.map(path => {
              const name = path.split('/').pop() || path;
              return (
                <div
                  key={path}
                  onClick={() => openFile(path)}
                  className="flex items-center justify-between h-6 px-3 cursor-pointer hover:bg-[#2a2d2e] text-xs text-[#cccccc] group"
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    {getFileIcon({ name, className: 'w-4 h-4' })}
                    <span className="truncate">{name}</span>
                    <span className="text-[10px] text-[#858585] truncate">{path}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-[#e2c08d] font-bold text-xs">M</span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        stageFile(path);
                      }}
                      title="Stage Changes"
                      className="hidden group-hover:block p-0.5 hover:text-white rounded"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Commits History */}
        <div className="pt-2 border-t border-[#303030]">
          <div className="px-3 py-1 flex items-center justify-between text-[11px] font-semibold text-[#9C9C9C] uppercase">
            <span className="flex items-center space-x-1">
              <History className="w-3 h-3 text-[#987654]" />
              <span>Commit History ({gitState.commits.length})</span>
            </span>
          </div>
          {gitState.commits.map(commit => (
            <div key={commit.id} className="px-3 py-1.5 hover:bg-[#141414] cursor-pointer transition-colors">
              <div className="flex items-center justify-between text-xs text-[#D5D2CC]">
                <span className="truncate font-medium">{commit.message}</span>
                <span className="text-[10px] text-[#987654] font-mono shrink-0 ml-2">
                  {commit.id}
                </span>
              </div>
              <div className="text-[10px] text-[#9C9C9C] flex justify-between mt-0.5 font-mono">
                <span>{commit.author}</span>
                <span>{commit.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
