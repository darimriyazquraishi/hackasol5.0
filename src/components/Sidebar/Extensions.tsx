import React, { useState } from 'react';
import { Search, Download, Star, Settings2, Check } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const Extensions: React.FC = () => {
  const { extensions, toggleExtension } = useWorkspace();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'installed'>('all');

  const filteredExtensions = extensions.filter(ext => {
    const matchesSearch =
      ext.displayName.toLowerCase().includes(search.toLowerCase()) ||
      ext.description.toLowerCase().includes(search.toLowerCase()) ||
      ext.publisher.toLowerCase().includes(search.toLowerCase());

    if (filter === 'installed') {
      return matchesSearch && ext.installed;
    }
    return matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="h-7 px-3 flex items-center justify-between text-[11px] font-bold text-[#bbbbbb] tracking-wider uppercase border-b border-[#2b2b2b] bg-[#1f1f1f]">
        <span>EXTENSIONS: MARKETPLACE</span>
      </div>

      {/* Search & Filter */}
      <div className="p-3 border-b border-[#2b2b2b] space-y-2">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search Extensions in Marketplace..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#313131] border border-[#3c3c3c] focus:border-[#007acc] text-xs text-white pl-7 pr-2 py-1 rounded-sm outline-none"
          />
          <Search className="w-3.5 h-3.5 text-[#858585] absolute left-2 pointer-events-none" />
        </div>

        <div className="flex space-x-1 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded text-[11px] ${
              filter === 'all'
                ? 'bg-[#0078d4] text-white font-medium'
                : 'text-[#858585] hover:text-[#cccccc] bg-[#2b2b2b]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('installed')}
            className={`px-2 py-0.5 rounded text-[11px] ${
              filter === 'installed'
                ? 'bg-[#0078d4] text-white font-medium'
                : 'text-[#858585] hover:text-[#cccccc] bg-[#2b2b2b]'
            }`}
          >
            Installed ({extensions.filter(e => e.installed).length})
          </button>
        </div>
      </div>

      {/* Extension List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredExtensions.map(ext => (
          <div
            key={ext.id}
            className="p-2.5 rounded bg-[#252526] hover:bg-[#2a2d2e] border border-[#333333] transition-colors flex space-x-3"
          >
            {/* Icon */}
            <div className="w-9 h-9 rounded bg-[#1e1e1e] flex items-center justify-center text-lg shrink-0 border border-[#3c3c3c]">
              {ext.icon}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-[#cccccc] truncate">
                  {ext.displayName}
                </h4>
              </div>

              <div className="text-[11px] text-[#858585] truncate mt-0.5">
                {ext.publisher}
              </div>

              <p className="text-[11px] text-[#9d9d9d] line-clamp-2 mt-1 leading-normal">
                {ext.description}
              </p>

              <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#333333]/50">
                <div className="flex items-center space-x-2 text-[10px] text-[#858585]">
                  <span className="flex items-center space-x-0.5">
                    <Download className="w-2.5 h-2.5" />
                    <span>{ext.downloads}</span>
                  </span>
                  <span className="flex items-center space-x-0.5">
                    <Star className="w-2.5 h-2.5 fill-current text-[#e5a00d]" />
                    <span>{ext.rating}</span>
                  </span>
                </div>

                <button
                  onClick={() => toggleExtension(ext.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors flex items-center space-x-1 ${
                    ext.installed
                      ? 'bg-[#3c3c3c] hover:bg-[#484848] text-[#cccccc]'
                      : 'bg-[#0078d4] hover:bg-[#006bb3] text-white shadow'
                  }`}
                >
                  {ext.installed ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-green-400" />
                      <span>Installed</span>
                    </>
                  ) : (
                    <span>Install</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
