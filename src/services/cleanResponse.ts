/**
 * LUMI Universal Agent Response Cleaner & Text Sanitizer
 *
 * Guarantees that agent deliverables, chat outputs, and reasoning synthesis
 * contain clean, professional human-readable text free of raw JSON wrappers,
 * markdown punctuation artifacts (e.g., `**. /`, `** /`, `**.`, `• .`),
 * or conversational AI filler.
 */

/**
 * Clean markdown punctuation artifacts, LaTeX math commands, stray backslashes,
 * raw asterisks, and corrupted tags so LUMI outputs clean human-readable text.
 */
export function cleanFormattingArtifacts(str: string): string {
  if (!str) return '';
  let s = String(str);

  // 1. Convert LaTeX text blocks: \text{...}, \mathrm{...}, \mathbf{...}, \textit{...}
  // Run loop to cleanly unwrap any nested blocks
  let safety = 0;
  while (/\\(?:text|mathrm|mathbf|textit|bm|bf|rm|sf)\s*\{([^{}]+)\}/.test(s) && safety++ < 10) {
    s = s.replace(/\\(?:text|mathrm|mathbf|textit|bm|bf|rm|sf)\s*\{([^{}]+)\}/g, '$1');
  }

  // 2. Fractions: \frac{a}{b} -> (a / b)
  safety = 0;
  while (/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/.test(s) && safety++ < 10) {
    s = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1 / $2)');
  }

  // 3. LaTeX operators & symbols to plain text equivalents
  s = s.replace(/\\times\b/g, 'x');
  s = s.replace(/\\cdot\b/g, '·');
  s = s.replace(/\\div\b/g, '/');
  s = s.replace(/\\pm\b/g, '±');
  s = s.replace(/\\approx\b/g, '≈');
  s = s.replace(/\\(?:ge|geq)\b/g, '>=');
  s = s.replace(/\\(?:le|leq)\b/g, '<=');
  s = s.replace(/\\neq\b/g, '!=');
  s = s.replace(/\\Delta\b/g, 'Delta');
  s = s.replace(/\\degree\b|\^\\circ/g, '°');

  // 4. Spacing commands
  s = s.replace(/\\(?:quad|qquad|[;,!])/g, ' ');

  // 5. Parentheses / bracket sizing
  s = s.replace(/\\(?:left|right)/g, '');

  // 6. Math environment delimiters: \[, \], \(, \), $$, $
  s = s.replace(/\\\[\s*/g, '');
  s = s.replace(/\s*\\\]/g, ' ');
  s = s.replace(/\\\(\s*/g, '');
  s = s.replace(/\s*\\\)/g, ' ');
  s = s.replace(/\$\$/g, '');

  // 7. Strip isolated bracket artifacts around math: e.g. [ Unit 1 Shortfall = ... ]
  s = s.replace(/\[\s*([a-zA-Z0-9])/g, '$1');
  s = s.replace(/([a-zA-Z0-9%])\s*\](?!\()/g, '$1');

  // 8. Remove all backslashes and unescape symbols (\$ -> $, \% -> %, \_ -> _)
  s = s.replace(/\\([$%\_#&{}[\]])/g, '$1');
  s = s.replace(/\\+/g, '');

  // 9. Remove all asterisks (*, **, ***) per user directive: "remove the \,* and all other special characters, keep just the text"
  s = s.replace(/\*{1,3}([^*\n]+?)\*{1,3}/g, '$1');
  s = s.replace(/\*+/g, '');

  // 10. Fix merged headings caused by LLM: e.g. "Key Performance Indicators:Electricity Generation:"
  s = s.replace(/([a-zA-Z]):([a-zA-Z])/g, '$1: $2');

  // 11. Normalize bullets: collapse multiple bullets, clean punctuation noise right after bullet
  s = s.replace(/^[ \t]*([•\-]\s*)+/gm, '• ');
  s = s.replace(/^[ \t]*•\s*[\.\/\\:\-\s]+(?=[a-zA-Z0-9"'$₹€(\[])/gm, '• ');
  s = s.replace(/^[ \t]*•\s*[\.\/\\:\-\s]*$/gm, '');

  // 12. Clean numbered list noise: "1. / Title" -> "1. Title"
  s = s.replace(/^([ \t]*\d+\.)\s*[\.\/\\:\-\s]+(?=[a-zA-Z0-9"'$₹€(\[])/gm, '$1 ');

  // 13. Clean orphaned punctuation at line ends
  s = s.replace(/[ \t]+[\.\/\\:\-]+[ \t]*$/gm, '');

  // 14. Remove multiple repeated consecutive dots or slashes
  s = s.replace(/(?<!https?:)\/{2,}/g, '/');
  s = s.replace(/\.{4,}/g, '...');

  // 15. Clean multiple spaces and excessive empty lines
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');

  return s.trim();
}

/**
 * Deeply extract human-readable text from an arbitrary JSON structure.
 */
export function extractTextFromJson(obj: any): string {
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const inner = JSON.parse(trimmed);
        return extractTextFromJson(inner);
      } catch {
        // Not a JSON string, clean as markdown
      }
    }
    return cleanFormattingArtifacts(obj);
  }

  if (!obj || typeof obj !== 'object') {
    return String(obj ?? '');
  }

  // If array of items (e.g. findings, bullets, slides, strings)
  if (Array.isArray(obj)) {
    return obj
      .map(item => {
        if (typeof item === 'string') {
          const cleaned = cleanFormattingArtifacts(item);
          if (!cleaned) return '';
          return cleaned.startsWith('•') || cleaned.startsWith('-') || /^\d+\./.test(cleaned)
            ? cleaned
            : `• ${cleaned}`;
        }
        if (item && typeof item === 'object') {
          const title = item.title || item.heading || item.name || '';
          const desc = item.description || item.content || item.text || item.summary || '';
          const bullets = Array.isArray(item.bullets || item.points)
            ? (item.bullets || item.points).map((b: any) => `  - ${cleanFormattingArtifacts(String(b))}`).join('\n')
            : '';
          return [title ? `### ${title}` : '', desc ? cleanFormattingArtifacts(desc) : '', bullets].filter(Boolean).join('\n');
        }
        return String(item);
      })
      .filter(Boolean)
      .join('\n');
  }

  // Priority content fields in agent JSON responses
  const candidateKeys = [
    'response', 'content', 'text', 'answer', 'output', 'result',
    'deliverable', 'message', 'summary', 'findings', 'analysis',
    'explanation', 'markdown', 'body', 'description', 'report'
  ];

  for (const k of candidateKeys) {
    if (obj[k] !== undefined && obj[k] !== null) {
      const val = obj[k];
      const extracted = extractTextFromJson(val);
      if (extracted && extracted.trim().length > 0) {
        return extracted;
      }
    }
  }

  // Fallback: If object has slides or sections or table rows
  if (Array.isArray(obj.slides)) return extractTextFromJson(obj.slides);
  if (Array.isArray(obj.sections)) return extractTextFromJson(obj.sections);
  if (Array.isArray(obj.rows) && Array.isArray(obj.columns)) {
    const header = `| ${obj.columns.join(' | ')} |`;
    const sep = `| ${obj.columns.map(() => '---').join(' | ')} |`;
    const rows = obj.rows.map((r: any[]) => `| ${r.join(' | ')} |`).join('\n');
    return `${header}\n${sep}\n${rows}`;
  }

  // General object: extract string values that aren't metadata keys
  const metaKeys = new Set(['status', 'code', 'model', 'usage', 'id', 'timestamp', 'success', 'type']);
  const usefulParts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (metaKeys.has(key.toLowerCase())) continue;
    const txt = extractTextFromJson(val);
    if (txt && txt.trim().length > 0) {
      usefulParts.push(txt.trim());
    }
  }

  if (usefulParts.length > 0) {
    return usefulParts.join('\n\n');
  }

  return '';
}

/**
 * Primary sanitizer: Unwraps JSON (fenced, unfenced, or preamble-embedded),
 * removes AI conversational pleasantries, and cleans all formatting artifacts.
 */
export function cleanAgentResponse(raw: any): string {
  if (!raw) return '';
  let text = String(raw).trim();

  // 1. Unwrap Markdown-fenced JSON (e.g. ```json { ... } ``` or ``` { ... } ```)
  const fencedJsonMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedJsonMatch) {
    try {
      const inner = JSON.parse(fencedJsonMatch[1].trim());
      const extracted = extractTextFromJson(inner);
      if (extracted) text = extracted;
    } catch {
      text = fencedJsonMatch[1].trim();
    }
  }

  // 2. Direct or embedded JSON object
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      const extracted = extractTextFromJson(parsed);
      if (extracted) text = extracted;
    } catch {
      // Find outermost balanced JSON object if possible
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      if (startIdx !== -1 && endIdx > startIdx) {
        try {
          const parsed = JSON.parse(text.slice(startIdx, endIdx + 1));
          const extracted = extractTextFromJson(parsed);
          if (extracted) text = extracted;
        } catch {}
      }
    }
  } else {
    // Check if there is an embedded JSON block after preamble (e.g. "Here is the result:\n{ ... }")
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx > startIdx && (endIdx - startIdx) > 10) {
      try {
        const parsed = JSON.parse(text.slice(startIdx, endIdx + 1));
        const extracted = extractTextFromJson(parsed);
        if (extracted && extracted.length > 20) {
          text = extracted;
        }
      } catch {}
    }
  }

  // 3. Strip conversational preamble like "Certainly! Here is..." but preserve genuine content
  text = text.replace(/^(Certainly|Sure|Here is|Here's|Of course|I'd be happy to|Below is|As an AI)[^\n.:]*[:.]\s*/i, '');
  text = text.replace(/\n\s*(Let me know if you need anything else!|Hope this helps!|Feel free to ask if you have more questions[.!]|I hope this helps you[.!]|If you have any further questions[^\n]*)\s*$/i, '');

  // 4. Clean formatting artifacts
  text = cleanFormattingArtifacts(text);

  return text.trim();
}
