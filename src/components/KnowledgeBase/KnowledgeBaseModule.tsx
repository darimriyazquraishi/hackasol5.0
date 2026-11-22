import React, { useState } from 'react';
import {
  Database,
  Upload,
  Search,
  FileText,
  Sliders,
  CheckCircle2,
  Layers,
  ArrowRight,
  ExternalLink,
  Plus
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const KnowledgeBaseModule: React.FC = () => {
  const { knowledgeCollections } = useWorkspace();
  const [selectedCollectionId, setSelectedCollectionId] = useState(knowledgeCollections[0]?.id || '');
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<Array<{ id: string; text: string; score: number; file: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const activeCollection = knowledgeCollections.find(c => c.id === selectedCollectionId) || knowledgeCollections[0];

  const handleTestSearch = () => {
    if (!testQuery.trim()) return;
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      setTestResults([
        {
          id: 'chunk-1',
          file: 'system_architecture_spec.md#L45-L68',
          score: 0.942,
          text: 'Memory residency constraints mandate that local model weights allocate exclusively within contiguous GPU memory pages, avoiding paging swaps across system PCIe lanes.'
        },
        {
          id: 'chunk-2',
          file: 'runtime_topology.md#L12-L30',
          score: 0.887,
          text: 'The orchestrator maintains an immutable lock on active embedding indexes, validating cryptographic checksums prior to vector query dispatch.'
        }
      ]);
    }, 600);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#080808] text-[#F5F4F1] font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#303030] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold font-mono tracking-tight text-[#F5F4F1]">
              KNOWLEDGE BASE & RAG
            </h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#191919] text-[#987654] border border-[#303030]">
              DENSE VECTORS
            </span>
          </div>
          <p className="text-xs text-[#9C9C9C] mt-1">
            Local vector indexes, document chunking, and semantic retrieval engines.
          </p>
        </div>

        <button className="px-3 py-1.5 rounded text-xs font-mono bg-[#987654] hover:bg-[#765B43] text-[#F5F4F1] transition-colors flex items-center space-x-1.5">
          <Upload className="w-3.5 h-3.5" />
          <span>Ingest Document</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Collections List */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[#9C9C9C] font-semibold">
            Collections ({knowledgeCollections.length})
          </h2>

          <div className="space-y-2">
            {knowledgeCollections.map(col => {
              const isSelected = col.id === selectedCollectionId;
              return (
                <div
                  key={col.id}
                  onClick={() => setSelectedCollectionId(col.id)}
                  className={`p-3 rounded cursor-pointer transition-colors border ${
                    isSelected
                      ? 'bg-[#191919] border-[#987654]'
                      : 'bg-[#121212] border-[#303030] hover:bg-[#191919]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[#F5F4F1]">{col.name}</span>
                    <span className="text-[10px] font-mono text-[#987654]">{col.size}</span>
                  </div>
                  <p className="text-[11px] text-[#9C9C9C] mt-1 line-clamp-2 leading-relaxed">
                    {col.description}
                  </p>
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#262626] text-[10px] font-mono text-[#9C9C9C]">
                    <span>{col.documentCount} docs • {col.chunkCount} chunks</span>
                    <span>{col.lastUpdated}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ingestion & Chunking Settings Card */}
          <div className="p-3.5 rounded bg-[#191919] border border-[#303030] space-y-2 text-xs">
            <div className="font-semibold text-xs font-mono text-[#F5F4F1] flex items-center space-x-2">
              <Sliders className="w-3.5 h-3.5 text-[#987654]" />
              <span>Indexing Parameters</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px] text-[#D5D2CC] pt-1">
              <div className="flex justify-between">
                <span className="text-[#9C9C9C]">Chunk Size:</span>
                <span>512 tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9C9C]">Chunk Overlap:</span>
                <span>64 tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9C9C]">Embedding Model:</span>
                <span className="text-[#987654]">BGE-Large-EN-v1.5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9C9C9C]">Distance Metric:</span>
                <span>Cosine Similarity</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Retrieval Testing & Citation Inspector */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#9C9C9C] font-semibold">
              Semantic Retrieval Playground
            </h2>

            <div className="flex space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Test query: e.g. How does LUMI manage memory isolation?"
                  value={testQuery}
                  onChange={e => setTestQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTestSearch()}
                  className="w-full bg-[#080808] border border-[#303030] focus:border-[#987654] text-xs text-[#F5F4F1] pl-8 pr-3 py-2 rounded outline-none font-mono"
                />
                <Search className="w-3.5 h-3.5 text-[#9C9C9C] absolute left-2.5 top-2.5" />
              </div>

              <button
                onClick={handleTestSearch}
                disabled={!testQuery.trim() || isSearching}
                className="px-4 py-2 rounded bg-[#987654] hover:bg-[#765B43] text-xs font-mono font-medium text-[#F5F4F1] transition-colors"
              >
                {isSearching ? 'Searching...' : 'Run Query'}
              </button>
            </div>

            <div className="text-[11px] font-mono text-[#9C9C9C]">
              Searching index: <span className="text-[#F5F4F1]">{activeCollection?.name}</span> • Top-k: 5
            </div>
          </div>

          {/* Test Results Output */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#9C9C9C] font-semibold">
              Retrieved Chunks & Citations
            </h3>

            {testResults.length === 0 ? (
              <div className="p-8 rounded bg-[#121212] border border-[#262626] text-center text-xs text-[#9C9C9C] font-mono">
                Submit a query to inspect matched dense vector chunks and cosine similarity rankings.
              </div>
            ) : (
              testResults.map(res => (
                <div key={res.id} className="p-3.5 rounded bg-[#191919] border border-[#303030] space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#F5F4F1] font-medium">{res.file}</span>
                    <span className="text-[#987654] font-semibold">
                      Score: {res.score.toFixed(3)}
                    </span>
                  </div>
                  <p className="text-xs text-[#D5D2CC] leading-relaxed font-mono bg-[#080808] p-3 rounded border border-[#262626]">
                    "{res.text}"
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
