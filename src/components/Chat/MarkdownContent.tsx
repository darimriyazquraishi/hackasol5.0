import React, { useState } from 'react';
import { Copy, Check, Play, Terminal, ChevronDown, ChevronRight } from 'lucide-react';

interface MarkdownContentProps {
  content: string;
  onExecuteCode?: (code: string, language: string) => void;
  className?: string;
}

/**
 * Professional Markdown Renderer for LUMI
 *
 * Cleanly renders:
 * - Headings (#, ##, ###, ####)
 * - Fenced code blocks with language labels, copy action, and sandbox execution
 * - Tables with headers and formatted cells
 * - Bullet lists and numbered lists
 * - Inline formatting (bold, italic, inline code)
 * - Blockquotes
 * - Math expressions
 * - Paragraphs with balanced spacing
 *
 * Automatically removes conversational AI introductory statements and closing filler.
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  onExecuteCode,
  className = ''
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Clean raw text to strip generic conversational filler
  const cleanContent = (raw: string): string => {
    let text = raw.trim();
    // Remove JSON wrapper if raw JSON was returned
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.response) text = parsed.response;
        else if (parsed.content) text = parsed.content;
        else if (parsed.answer) text = parsed.answer;
      } catch {
        // ignore
      }
    }
    // Remove conversational pleasantries
    text = text.replace(/^(Certainly!|Sure!|Here is|Here's|Of course|I'd be happy to|Below is|As an AI language model)[^\n]*\n+/i, '');
    text = text.replace(/\n+(Hope this helps!|Let me know if you need anything else!|Feel free to ask[^\n]*)\s*$/i, '');
    return text.trim();
  };

  const text = cleanContent(content);

  // Parse lines into blocks
  const parseBlocks = (rawText: string) => {
    const lines = rawText.split('\n');
    const blocks: Array<{
      type: 'code' | 'heading' | 'table' | 'list' | 'ordered-list' | 'quote' | 'math' | 'paragraph';
      content?: string;
      level?: number;
      language?: string;
      items?: string[];
      tableData?: { headers: string[]; rows: string[][] };
    }> = [];

    let inCodeBlock = false;
    let codeLanguage = '';
    let codeLines: string[] = [];

    let inTable = false;
    let tableLines: string[] = [];

    let currentList: string[] = [];
    let currentListType: 'list' | 'ordered-list' | null = null;

    let currentParagraph: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        blocks.push({
          type: 'paragraph',
          content: currentParagraph.join('\n')
        });
        currentParagraph = [];
      }
    };

    const flushList = () => {
      if (currentList.length > 0 && currentListType) {
        blocks.push({
          type: currentListType,
          items: [...currentList]
        });
        currentList = [];
        currentListType = null;
      }
    };

    const flushTable = () => {
      if (tableLines.length >= 2) {
        const headers = tableLines[0].split('|').map(c => c.trim()).filter(Boolean);
        const rows = tableLines.slice(2).map(line =>
          line.split('|').map(c => c.trim()).filter(Boolean)
        );
        blocks.push({
          type: 'table',
          tableData: { headers, rows }
        });
      } else if (tableLines.length > 0) {
        currentParagraph.push(...tableLines);
      }
      tableLines = [];
      inTable = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. Code Block Fence
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          flushParagraph();
          flushList();
          if (inTable) flushTable();
          inCodeBlock = true;
          codeLanguage = line.trim().slice(3).trim();
          codeLines = [];
        } else {
          inCodeBlock = false;
          blocks.push({
            type: 'code',
            language: codeLanguage || 'text',
            content: codeLines.join('\n')
          });
          codeLines = [];
          codeLanguage = '';
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // 2. Table row
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        flushParagraph();
        flushList();
        inTable = true;
        tableLines.push(line);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // 3. Headings
      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        flushParagraph();
        flushList();
        blocks.push({
          type: 'heading',
          level: headingMatch[1].length,
          content: headingMatch[2]
        });
        continue;
      }

      // 4. Block Math ($$...$$)
      if (line.trim().startsWith('$$') && line.trim().endsWith('$$') && line.trim().length > 4) {
        flushParagraph();
        flushList();
        blocks.push({
          type: 'math',
          content: line.trim().slice(2, -2).trim()
        });
        continue;
      }

      // 5. Blockquote
      if (line.trim().startsWith('> ')) {
        flushParagraph();
        flushList();
        blocks.push({
          type: 'quote',
          content: line.trim().slice(2)
        });
        continue;
      }

      // 6. Unordered List (- or *)
      const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
      if (bulletMatch) {
        flushParagraph();
        if (currentListType && currentListType !== 'list') flushList();
        currentListType = 'list';
        currentList.push(bulletMatch[2]);
        continue;
      }

      // 7. Ordered List (1. 2.)
      const numMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
      if (numMatch) {
        flushParagraph();
        if (currentListType && currentListType !== 'ordered-list') flushList();
        currentListType = 'ordered-list';
        currentList.push(numMatch[2]);
        continue;
      }

      // 8. Empty line
      if (!line.trim()) {
        flushParagraph();
        flushList();
        continue;
      }

      // 9. Standard paragraph text
      if (currentList.length > 0) flushList();
      currentParagraph.push(line);
    }

    if (inCodeBlock) {
      blocks.push({
        type: 'code',
        language: codeLanguage || 'text',
        content: codeLines.join('\n')
      });
    }
    if (inTable) flushTable();
    flushList();
    flushParagraph();

    return blocks;
  };

  const formatInline = (str: string) => {
    // Process bold, italic, inline code, links, and images
    const parts: React.ReactNode[] = [];
    let remaining = str;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Image: ![alt](url)
      const imgMatch = remaining.match(/^(.*?)!\[([^\]]*)\]\(([^)]+)\)(.*)$/s);
      // Inline Code: `...`
      const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/s);
      // Bold: **...**
      const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/s);
      // Link: [text](url)
      const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/s);

      type EarliestMatch = { type: 'image' | 'code' | 'bold' | 'link'; match: RegExpMatchArray; index: number };
      let earliest: EarliestMatch | null = null;

      if (imgMatch && (earliest === null || imgMatch[1].length < (earliest as EarliestMatch).index)) {
        earliest = { type: 'image', match: imgMatch, index: imgMatch[1].length };
      }
      if (codeMatch && (earliest === null || codeMatch[1].length < (earliest as EarliestMatch).index)) {
        earliest = { type: 'code', match: codeMatch, index: codeMatch[1].length };
      }
      if (boldMatch && (earliest === null || boldMatch[1].length < (earliest as EarliestMatch).index)) {
        earliest = { type: 'bold', match: boldMatch, index: boldMatch[1].length };
      }
      if (linkMatch && (earliest === null || linkMatch[1].length < (earliest as EarliestMatch).index)) {
        earliest = { type: 'link', match: linkMatch, index: linkMatch[1].length };
      }

      if (!earliest) {
        parts.push(remaining);
        break;
      }

      if (earliest.match[1]) {
        parts.push(earliest.match[1]);
      }

      if (earliest.type === 'image') {
        const altText = earliest.match[2];
        const srcUrl = earliest.match[3];
        parts.push(
          <span key={`img-container-${keyIdx++}`} className="block my-3">
            <img
              src={srcUrl}
              alt={altText || 'Generated visual deliverable'}
              className="max-w-full md:max-w-md rounded-xl border border-[#303030] shadow-md object-contain bg-[#0a0a0a] cursor-pointer hover:border-[#987654] transition-colors"
              onClick={() => window.open(srcUrl, '_blank')}
            />
            {altText && (
              <span className="block text-[10px] text-[#9C9C9C] mt-1 font-mono">{altText}</span>
            )}
          </span>
        );
        remaining = earliest.match[4];
      } else if (earliest.type === 'code') {
        parts.push(
          <code
            key={`code-${keyIdx++}`}
            className="px-1.5 py-0.5 rounded bg-[#191919] text-[#987654] font-mono text-[11px] border border-[#303030]"
          >
            {earliest.match[2]}
          </code>
        );
        remaining = earliest.match[3];
      } else if (earliest.type === 'bold') {
        parts.push(
          <strong key={`bold-${keyIdx++}`} className="font-semibold text-[#F5F4F1]">
            {earliest.match[2]}
          </strong>
        );
        remaining = earliest.match[3];
      } else if (earliest.type === 'link') {
        parts.push(
          <a
            key={`link-${keyIdx++}`}
            href={earliest.match[3]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#987654] hover:underline"
          >
            {earliest.match[2]}
          </a>
        );
        remaining = earliest.match[4];
      }
    }

    return parts;
  };

  const blocks = parseBlocks(text);

  return (
    <div className={`space-y-3.5 text-xs text-[#D5D2CC] leading-relaxed select-text ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            if (block.level === 1) {
              return (
                <h1
                  key={idx}
                  className="text-base font-bold text-[#F5F4F1] font-mono tracking-tight pt-2 pb-1 border-b border-[#262626]"
                >
                  {formatInline(block.content || '')}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2
                  key={idx}
                  className="text-sm font-semibold text-[#F5F4F1] font-mono tracking-tight pt-1.5 pb-0.5"
                >
                  {formatInline(block.content || '')}
                </h2>
              );
            }
            if (block.level === 3) {
              return (
                <h3 key={idx} className="text-xs font-semibold text-[#F5F4F1] font-mono pt-1">
                  {formatInline(block.content || '')}
                </h3>
              );
            }
            return (
              <h4 key={idx} className="text-xs font-medium text-[#D5D2CC] font-mono">
                {formatInline(block.content || '')}
              </h4>
            );
          }

          case 'paragraph':
            return (
              <p key={idx} className="leading-relaxed">
                {formatInline(block.content || '')}
              </p>
            );

          case 'code': {
            const codeString = block.content || '';
            const lang = (block.language || 'text').toLowerCase();
            const isExecutable = ['javascript', 'js', 'python', 'py'].includes(lang);

            return (
              <div
                key={idx}
                className="my-3 rounded bg-[#080808] border border-[#303030] overflow-hidden font-mono"
              >
                <div className="px-3 py-1.5 bg-[#141414] border-b border-[#262626] flex items-center justify-between text-[11px]">
                  <span className="text-[#987654] font-medium">{block.language || 'code'}</span>
                  <div className="flex items-center space-x-2">
                    {isExecutable && onExecuteCode && (
                      <button
                        onClick={() => onExecuteCode(codeString, lang)}
                        className="px-2 py-0.5 rounded bg-[#191919] hover:bg-[#202020] text-emerald-400 border border-[#303030] flex items-center space-x-1 text-[10px] transition-colors"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Run in Sandbox</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(codeString, idx)}
                      className="px-2 py-0.5 rounded hover:bg-[#191919] text-[#9C9C9C] hover:text-[#F5F4F1] flex items-center space-x-1 text-[10px] transition-colors"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <pre className="p-3 text-[11px] text-[#F5F4F1] overflow-x-auto leading-relaxed">
                  <code>{codeString}</code>
                </pre>
              </div>
            );
          }

          case 'table': {
            const table = block.tableData;
            if (!table) return null;
            return (
              <div key={idx} className="my-3 overflow-x-auto rounded border border-[#303030]">
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#141414] border-b border-[#303030] text-[#F5F4F1]">
                      {table.headers.map((h, hIdx) => (
                        <th key={hIdx} className="p-2.5 font-semibold">
                          {formatInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="border-b border-[#262626] last:border-b-0 hover:bg-[#141414]/50"
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-2.5 text-[#D5D2CC]">
                            {formatInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          case 'list':
            return (
              <ul key={idx} className="list-disc list-inside space-y-1.5 pl-1 my-2">
                {block.items?.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">
                    <span className="text-[#D5D2CC]">{formatInline(item)}</span>
                  </li>
                ))}
              </ul>
            );

          case 'ordered-list':
            return (
              <ol key={idx} className="list-decimal list-inside space-y-1.5 pl-1 my-2 font-mono text-[11px]">
                {block.items?.map((item, itemIdx) => (
                  <li key={itemIdx} className="leading-relaxed">
                    <span className="text-[#D5D2CC] font-sans text-xs">{formatInline(item)}</span>
                  </li>
                ))}
              </ol>
            );

          case 'quote':
            return (
              <blockquote
                key={idx}
                className="pl-3 py-1 border-l-2 border-[#987654] text-[#9C9C9C] italic my-2 bg-[#141414]/40 rounded-r"
              >
                {formatInline(block.content || '')}
              </blockquote>
            );

          case 'math':
            return (
              <div
                key={idx}
                className="my-3 p-3 rounded bg-[#101010] border border-[#303030] text-center font-mono text-xs text-[#987654] overflow-x-auto"
              >
                {block.content}
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
};
