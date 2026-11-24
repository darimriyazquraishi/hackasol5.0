import React, { useState, useMemo } from 'react';
import {
  Search as SearchIcon,
  Replace,
  ChevronRight,
  ChevronDown,
  CaseSensitive,
  WholeWord,
  Regex
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { flattenFiles } from '../../services/fileSystem';
import { getFileIcon } from '../../services/fileIcons';

interface SearchMatch {
  lineNumber: number;
  lineText: string;
  matchIndex: number;
}

interface FileSearchResult {
  filePath: string;
  fileName: string;
  matches: SearchMatch[];
}

export const Search: React.FC = () => {
  const { files, openFile } = useWorkspace();

  const [query, setQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [matchWord, setMatchWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});

  const allFiles = useMemo(() => flattenFiles(files), [files]);

  // Perform search across files
  const searchResults: FileSearchResult[] = useMemo(() => {
    if (!query.trim()) return [];

    const results: FileSearchResult[] = [];

    let pattern: RegExp;
    try {
      let flags = 'g';
      if (!matchCase) flags += 'i';

      let cleanPattern = query;
      if (!useRegex) {
        cleanPattern = cleanPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      if (matchWord) {
        cleanPattern = `\\b${cleanPattern}\\b`;
      }
      pattern = new RegExp(cleanPattern, flags);
    } catch (e) {
      return [];
    }

    for (const file of allFiles) {
      if (!file.content) continue;
      const lines = file.content.split('\n');
      const fileMatches: SearchMatch[] = [];

      lines.forEach((lineText, idx) => {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(lineText)) !== null) {
          fileMatches.push({
            lineNumber: idx + 1,
            lineText,
            matchIndex: match.index
          });
          if (!pattern.global) break;
        }
      });

      if (fileMatches.length > 0) {
        results.push({
          filePath: file.path,
          fileName: file.name,
          matches: fileMatches
        });
      }
    }

    return results;
  }, [allFiles, query, matchCase, matchWord, useRegex]);

  const totalMatches = searchResults.reduce((acc, curr) => acc + curr.matches.length, 0);

  const toggleCollapse = (filePath: string) => {
    setCollapsedFiles(prev => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="h-7 px-3 flex items-center justify-between text-[11px] font-bold text-[#bbbbbb] tracking-wider uppercase border-b border-[#2b2b2b] bg-[#1f1f1f]">
        <span>SEARCH</span>
      </div>

      {/* Inputs Section */}
      <div className="p-3 space-y-2 border-b border-[#2b2b2b]">
        {/* Search input with modifiers */}
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search files..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-[#141414] border border-[#303030] focus:border-[#987654] text-xs text-[#F5F4F1] pl-2 pr-16 py-1 rounded outline-none transition-colors"
          />
          <div className="absolute right-1 flex items-center space-x-0.5 text-[#9C9C9C]">
            <button
              onClick={() => setMatchCase(!matchCase)}
              title="Match Case"
              className={`p-1 rounded hover:bg-[#191919] transition-colors ${
                matchCase ? 'text-[#F5F4F1] bg-[#987654]' : ''
              }`}
            >
              <CaseSensitive className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setMatchWord(!matchWord)}
              title="Match Whole Word"
              className={`p-1 rounded hover:bg-[#191919] transition-colors ${
                matchWord ? 'text-[#F5F4F1] bg-[#987654]' : ''
              }`}
            >
              <WholeWord className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setUseRegex(!useRegex)}
              title="Use Regular Expression"
              className={`p-1 rounded hover:bg-[#191919] transition-colors ${
                useRegex ? 'text-[#F5F4F1] bg-[#987654]' : ''
              }`}
            >
              <Regex className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Toggle Replace */}
        <button
          onClick={() => setShowReplace(!showReplace)}
          className="text-[11px] text-[#9C9C9C] hover:text-[#F5F4F1] flex items-center space-x-1 transition-colors"
        >
          <Replace className="w-3 h-3" />
          <span>Toggle Replace</span>
        </button>

        {showReplace && (
          <div className="flex items-center space-x-1">
            <input
              type="text"
              placeholder="Replace..."
              value={replaceQuery}
              onChange={e => setReplaceQuery(e.target.value)}
              className="w-full bg-[#141414] border border-[#303030] focus:border-[#987654] text-xs text-[#F5F4F1] px-2 py-1 rounded outline-none transition-colors"
            />
          </div>
        )}
      </div>

      {/* Results Header */}
      {query && (
        <div className="px-3 py-1 text-[11px] text-[#9C9C9C] bg-[#0c0c0c] border-b border-[#303030]">
          {totalMatches} result{totalMatches === 1 ? '' : 's'} in {searchResults.length} file{searchResults.length === 1 ? '' : 's'}
        </div>
      )}

      {/* Results List */}
      <div className="flex-1 overflow-y-auto py-1">
        {searchResults.map(result => {
          const isCollapsed = collapsedFiles[result.filePath];

          return (
            <div key={result.filePath} className="text-xs">
              {/* File header row */}
              <div
                onClick={() => toggleCollapse(result.filePath)}
                className="flex items-center h-6 px-2 cursor-pointer hover:bg-[#141414] text-[#D5D2CC] font-medium transition-colors"
              >
                <span className="w-4 h-4 flex items-center justify-center mr-1 text-[#9C9C9C]">
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
                <span className="mr-1.5 flex items-center justify-center">
                  {getFileIcon({ name: result.fileName, className: 'w-4 h-4' })}
                </span>
                <span className="truncate flex-1">{result.fileName}</span>
                <span className="text-[10px] bg-[#191919] border border-[#303030] px-1.5 py-0.2 rounded-full text-[#D5D2CC]">
                  {result.matches.length}
                </span>
              </div>

              {/* Matching lines */}
              {!isCollapsed && (
                <div className="pl-6 space-y-0.5">
                  {result.matches.map((m, idx) => (
                    <div
                      key={idx}
                      onClick={() => openFile(result.filePath)}
                      className="flex items-center h-5 px-2 cursor-pointer hover:bg-[#191919] text-[#9C9C9C] hover:text-[#F5F4F1] transition-colors"
                    >
                      <span className="w-7 text-[11px] text-[#987654] shrink-0 font-mono">
                        {m.lineNumber}
                      </span>
                      <span className="truncate text-xs font-mono text-[#D5D2CC]">
                        {m.lineText.trim()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
