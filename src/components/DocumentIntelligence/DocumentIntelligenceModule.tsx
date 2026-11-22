import React, { useState } from 'react';
import { FileSearch, FileText, CheckCircle2, Search, Table, Tag } from 'lucide-react';

export const DocumentIntelligenceModule: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#080808] text-[#F5F4F1] font-sans select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#303030] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold font-mono tracking-tight text-[#F5F4F1]">
              DOCUMENT INTELLIGENCE
            </h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#191919] text-[#987654] border border-[#303030]">
              SEMANTIC PARSER
            </span>
          </div>
          <p className="text-xs text-[#9C9C9C] mt-1">
            Structural extraction, OCR verification, and tabular decomposition across enterprise files.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-2">
          <div className="text-xs font-mono uppercase text-[#9C9C9C]">Analyzed Documents</div>
          <div className="text-2xl font-bold font-mono text-[#F5F4F1]">194</div>
          <div className="text-[11px] text-[#987654] font-mono">14,820 semantic entities parsed</div>
        </div>
        <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-2">
          <div className="text-xs font-mono uppercase text-[#9C9C9C]">Tabular Schemas Extracted</div>
          <div className="text-2xl font-bold font-mono text-[#F5F4F1]">48</div>
          <div className="text-[11px] text-[#987654] font-mono">Exported to Arrow / Parquet</div>
        </div>
        <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-2">
          <div className="text-xs font-mono uppercase text-[#9C9C9C]">Citation Integrity</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">99.8%</div>
          <div className="text-[11px] text-[#9C9C9C] font-mono">Ground truth verified</div>
        </div>
      </div>

      <div className="p-4 rounded bg-[#191919] border border-[#303030] space-y-3">
        <h2 className="text-xs font-mono uppercase text-[#9C9C9C] font-semibold">
          Recent Parsed Corpus
        </h2>
        <div className="space-y-2 font-mono text-xs">
          {[
            { name: 'enterprise_security_compliance.pdf', pages: 42, entities: 312, time: '20 mins ago' },
            { name: 'q4_systems_financial_statements.xlsx', pages: 12, entities: 184, time: '1 hour ago' },
            { name: 'distributed_consensus_whitepaper.pdf', pages: 28, entities: 240, time: '3 hours ago' }
          ].map(doc => (
            <div key={doc.name} className="p-3 rounded bg-[#080808] border border-[#262626] flex items-center justify-between">
              <div className="flex items-center space-x-2.5 truncate">
                <FileText className="w-4 h-4 text-[#987654] shrink-0" />
                <span className="text-[#F5F4F1] truncate">{doc.name}</span>
                <span className="text-[11px] text-[#9C9C9C]">({doc.pages} pages)</span>
              </div>
              <div className="flex items-center space-x-4 text-[11px] text-[#9C9C9C] shrink-0">
                <span className="text-[#987654]">{doc.entities} entities</span>
                <span>{doc.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
