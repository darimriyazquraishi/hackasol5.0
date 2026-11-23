/**
 * LUMI Context-Aware RAG Engine
 * Universal Query-Aware Pre-Approval Retrieval and Workplan Augmentation
 */

import { ragEngine, KnowledgeChunk } from './ragEngine';
import { TaskDecomposition } from './taskDecomposer';
import { KnowledgeContextPackage, KnowledgeMatchItem, LumiWorkplan } from '../src/types';

/**
 * Universal query derivation across diverse task domains
 */
export function deriveRetrievalQueries(prompt: string, decomp: TaskDecomposition): string[] {
  const p = prompt.trim();
  const lower = p.toLowerCase();

  // 1. Strict suppression for creative, pure code, or generic queries
  // Non-organizational prompts must not inject corporate policy documents
  const isGenericImage = decomp.operation === 'image_generation' ||
    /(?:generate|create|draw|paint)\s+(?:an?\s+)?(?:image|picture|photo)\s+of\s+(?:giraffe|cat|dog|lion|tiger|woman|man|landscape|sunset|mountain|unicorn|apple|pizza|burger)/i.test(lower);
  const isPureMathOrCode = /fibonacci|fibonnacci|bubble\s*sort|binary\s*search|quick\s*sort|factorial/i.test(lower) &&
    !/policy|guideline|company|standard|internal|procedure|sop/i.test(lower);

  if (isGenericImage || isPureMathOrCode) {
    return [];
  }

  const queries: string[] = [];

  // Domain A: Presentations (PPTX, corporate slides)
  if (
    decomp.requestedOutputFormat === 'pptx' ||
    decomp.operation === 'presentation_generation' ||
    /presentation|slide|powerpoint|pptx|deck|keynote/i.test(lower)
  ) {
    queries.push('presentation guidelines');
    queries.push('corporate PowerPoint formatting standards');
    queries.push('presentation template branding slide design policy');
    queries.push('presentation typography color requirements');
  }

  // Domain B: Reports and Engineering Documents (DOCX, PDF)
  if (
    decomp.requestedOutputFormat === 'docx' ||
    decomp.requestedOutputFormat === 'pdf' ||
    decomp.operation === 'report_compilation' ||
    /report|documentation|technical\s*document|audit\s*report/i.test(lower)
  ) {
    queries.push('technical report writing standards');
    queries.push('controlled PDF and document creation guideline');
    queries.push('engineering document guideline');
    queries.push('corporate report formatting structure requirements');
  }

  // Domain C: Financial Spreadsheets (XLSX, models, budgets)
  if (
    decomp.requestedOutputFormat === 'xlsx' ||
    decomp.operation === 'calculation_analysis' ||
    /spreadsheet|excel|xlsx|financial|balance\s*sheet|p&l|ebitda|valuation/i.test(lower)
  ) {
    queries.push('financial analysis reporting guidelines');
    queries.push('spreadsheet model executive summary standards');
    queries.push('financial data presentation compliance');
  }

  // Domain D: Technical Specifications, SOPs, and Compliance
  if (
    decomp.operation === 'document_compliance' ||
    /sop|standard\s*operating\s*procedure|compliance|policy|guideline|protocol|governance/i.test(lower)
  ) {
    queries.push(p);
    queries.push('corporate operating procedure guidelines');
    queries.push('standard compliance policy documentation');
  }

  // Direct organizational inquiry (e.g. "What are the presentation guidelines of the company?")
  if (/guideline|policy|standard|rule|procedure|how\s+does\s+the\s+company/i.test(lower)) {
    if (!queries.includes(p)) queries.unshift(p);
    const cleaned = p.replace(/^(what\s+are|tell\s+me\s+about|show\s+me|explain)\s+/i, '').trim();
    if (cleaned && !queries.includes(cleaned)) queries.push(cleaned);
  }

  return Array.from(new Set(queries)).slice(0, 5);
}

/**
 * Clean and sanitize retrieved text against prompt injection attacks
 */
export function sanitizeContextText(text: string): string {
  if (!text) return '';
  // Strip potential instruction overrides and delimiter escaping
  return text
    .replace(/<\/?[a-z_][a-z0-9_-]*[^>]*>/gi, '') // Remove existing XML/HTML tags
    .replace(/(?:ignore\s+all\s+(?:previous|prior)\s+instructions|system\s*override|disregard\s+(?:all\s+)?guidelines)/gi, '[REDACTED_ATTEMPTED_INJECTION]')
    .trim();
}

/**
 * Extract key requirements or rules from retrieved guideline chunks
 */
export function extractGuidelineRules(chunks: KnowledgeChunk[]): string[] {
  const rules: string[] = [];
  const text = chunks.map(c => c.text).join('\n');

  if (/one\s+(?:key\s+)?message\s+per\s+slide|one\s+idea\s+per\s+slide/i.test(text)) {
    rules.push('One key takeaway per slide: headline must state the takeaway, not just a topic category.');
  }
  if (/evidence\s+before\s+conclusion|cite\s+(?:data|source)/i.test(text)) {
    rules.push('Mandatory data citation: every chart or claim must cite source and measurement date.');
  }
  if (/slide\s+count|minimum\s+\d+\s+slides|maximum\s+\d+\s+slides/i.test(text)) {
    rules.push('Strict structure: Title, Executive Context, Findings, Next Steps.');
  }
  if (/color\s+palette|navy|corporate\s+blue/i.test(text)) {
    rules.push('Restrained corporate color palette: navy/slate primary with single accent.');
  }
  if (/controlled\s+document|document\s+number|revision/i.test(text)) {
    rules.push('Controlled document formatting: document ID, revision history, and sign-off block.');
  }

  return rules;
}

/**
 * Retrieve task-grounded context across organizational knowledge base
 * BEFORE workplan approval.
 */
export async function retrieveTaskContext(
  prompt: string,
  decomp: TaskDecomposition
): Promise<KnowledgeContextPackage> {
  const derivedQueries = deriveRetrievalQueries(prompt, decomp);

  // If prompt is non-organizational (e.g. image of giraffe), return empty package immediately
  if (derivedQueries.length === 0) {
    return {
      hasMatches: false,
      matches: [],
      sanitizedContextText: '',
      conflictDetected: false,
      derivedQueries: [],
      guidelineRules: []
    };
  }

  // Multi-query search across local knowledge base
  const chunkMap = new Map<string, { chunk: KnowledgeChunk; score: number }>();
  for (const q of derivedQueries) {
    try {
      const results = await ragEngine.search(q, 4);
      for (const r of results) {
        const existing = chunkMap.get(r.chunk.id);
        if (!existing || r.score > existing.score) {
          chunkMap.set(r.chunk.id, r);
        }
      }
    } catch {
      // Continue with remaining queries if one fails
    }
  }

  const allItems = Array.from(chunkMap.values());

  // Group chunks by document
  const docMap = new Map<string, Array<{ chunk: KnowledgeChunk; score: number }>>();
  for (const item of allItems) {
    const docKey = item.chunk.file || item.chunk.docId || 'Knowledge Base Document';
    if (!docMap.has(docKey)) docMap.set(docKey, []);
    docMap.get(docKey)!.push(item);
  }

  const matches: KnowledgeMatchItem[] = [];
  const sanitizedBlocks: string[] = [];

  for (const [docName, items] of docMap.entries()) {
    // Sort chunks by score
    items.sort((a, b) => b.score - a.score);
    const topScore = items[0]?.score || 0;

    // Relevance filtering:
    // High: >= 0.55
    // Moderate: >= 0.38
    // Irrelevant: < 0.38 (discarded)
    if (topScore < 0.38) {
      continue;
    }

    const relevanceLevel: 'high' | 'moderate' = topScore >= 0.55 ? 'high' : 'moderate';
    const sectionNames = Array.from(new Set(items.map(i => i.chunk.section).filter(Boolean)));
    const sectionsText = sectionNames.length > 0 ? sectionNames.join(', ') : 'General Document Sections';

    // Extract potential version / date metadata
    let versionDate = 'Current Policy';
    const combinedSample = items.map(i => i.chunk.text).slice(0, 3).join(' ');
    const verMatch = combinedSample.match(/(?:version|v\.?)\s*(\d+(?:\.\d+)?)/i);
    const dateMatch = combinedSample.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i);
    if (verMatch && dateMatch) {
      versionDate = `v${verMatch[1]} (${dateMatch[0]})`;
    } else if (verMatch) {
      versionDate = `v${verMatch[1]}`;
    } else if (dateMatch) {
      versionDate = dateMatch[0];
    }

    // Determine key requirements
    const keyRequirements: string[] = [];
    if (/presentation/i.test(docName)) {
      keyRequirements.push('Corporate 16:9 layout structure', 'Executive takeaway headline on each slide', 'Verified citations for all charts');
    } else if (/report|controlled/i.test(docName)) {
      keyRequirements.push('Document control header', 'Executive Summary section', 'Structured conclusions and signatures');
    }

    matches.push({
      docId: items[0]?.chunk.docId || docName,
      docName,
      sections: sectionsText,
      relevanceScore: parseFloat(topScore.toFixed(3)),
      relevanceLevel,
      status: 'Accepted as execution context',
      rationale: `Matched ${items.length} section(s) with composite relevance score ${topScore.toFixed(2)} (${relevanceLevel} priority).`,
      versionDate,
      keyRequirements
    });

    // Build sanitized, untrusted reference context block
    for (const item of items.slice(0, 3)) {
      const clean = sanitizeContextText(item.chunk.text);
      sanitizedBlocks.push(
        `<reference_data source="${docName}" section="${item.chunk.section || 'Section'}" score="${item.score.toFixed(2)}" untrusted="true">\n${clean}\n</reference_data>`
      );
    }
  }

  // Conflict detection (e.g. multiple presentation or report guidelines)
  let conflictDetected = false;
  let conflictDetails: string | undefined;

  const presentationMatches = matches.filter(m => /presentation|slide|powerpoint/i.test(m.docName));
  if (presentationMatches.length > 1) {
    conflictDetected = true;
    conflictDetails = `Multiple matching presentation documents detected (${presentationMatches.map(m => m.docName).join(', ')}). Precedence given to highest relevance / latest revision.`;
  }

  const rawChunks = allItems.map(i => i.chunk);
  const guidelineRules = extractGuidelineRules(rawChunks);

  return {
    hasMatches: matches.length > 0,
    matches,
    sanitizedContextText: sanitizedBlocks.join('\n\n'),
    conflictDetected,
    conflictDetails,
    derivedQueries,
    primarySource: matches[0]?.docName,
    guidelineRules
  };
}

/**
 * Augment and enrich the initial workplan with retrieved organizational context
 */
export function enrichWorkplan(
  workplan: LumiWorkplan,
  context: KnowledgeContextPackage,
  decomp: TaskDecomposition
): LumiWorkplan {
  workplan.knowledgeMatches = context.matches;
  workplan.knowledgeContext = context;

  // Check if user specifically requested a named internal policy/protocol/standard
  const prompt = (decomp.rawPrompt || workplan.originalPrompt || '').toLowerCase();
  const specificSubjectMatch = prompt.match(/(?:following|according to|per|our|the|for)\s+([a-z0-9_\s-]+(?:protocol|guideline|policy|procedure|standard|specification))/i);
  
  if (specificSubjectMatch) {
    const requestedSubject = specificSubjectMatch[1].trim();
    const words = requestedSubject.split(/\s+/).filter(w => !['our', 'the', 'a', 'an', 'following', 'protocol', 'guideline', 'policy', 'standard'].includes(w));
    const hasSpecificMatch = context.matches.some(m => {
      const lowerDoc = m.docName.toLowerCase();
      const lowerSec = m.sections.toLowerCase();
      return words.some(w => lowerDoc.includes(w) || lowerSec.includes(w));
    });

    if (!hasSpecificMatch) {
      workplan.policyFound = false;
      workplan.policyNotice = `Notice: No matching internal documentation was found for "${requestedSubject}". Execution will proceed based on universal best practices and first principles.`;
      return workplan;
    }
  }

  const askedForPolicy = /guideline|policy|standard|internal|procedure|sop|protocol|how\s+does\s+the\s+company/i.test(prompt);

  if (context.hasMatches) {
    workplan.policyFound = true;
    workplan.requiredCapabilities = Array.from(new Set([
      ...workplan.requiredCapabilities,
      'Internal Knowledge Base Compliance',
      'Organizational Guideline Grounding'
    ]));

    // Enrich existing execution sequence steps to incorporate the retrieved guidelines
    for (const step of workplan.executionSequence) {
      if (step.agent === 'presentation_compiler' || step.name.includes('Slide Outline')) {
        step.description = `${step.description} Strictly conforms to ${context.primarySource || 'company presentation standards'} (action headlines, restrained palette, cited data).`;
        step.actions.unshift(`Incorporate formatting rules from ${context.primarySource}`);
      } else if (step.agent === 'reasoning_synthesis' || step.name.includes('Synthesis')) {
        step.description = `${step.description} Grounded in verified corporate guidelines (${context.matches.map(m => m.docName).join(', ')}).`;
      } else if (step.agent === 'document_builder' || step.name.includes('Document Deliverable Assembly')) {
        step.description = `${step.description} Formats deliverable according to internal corporate publication standard.`;
      }
    }
  } else if (askedForPolicy) {
    workplan.policyFound = false;
    workplan.policyNotice = `Notice: No matching internal documentation was found for this specific query. Execution will proceed based on universal best practices and first principles.`;
  }

  return workplan;
}
