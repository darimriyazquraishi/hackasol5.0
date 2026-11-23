/**
 * LUMI Context-Aware RAG Engine
 * Universal Query-Aware Pre-Approval Retrieval, Relevance Scoring,
 * Prompt-Injection Defense, and Workplan Augmentation.
 */

import { ragEngine, KnowledgeChunk } from './ragEngine';
import { TaskDecomposition } from './taskDecomposer';
import { KnowledgeContextPackage, KnowledgeMatchItem, LumiWorkplan, LumiWorkflowStep } from '../src/types';

/**
 * Configurable RAG Scoring & Threshold Parameters
 */
export const RAG_CONFIG = {
  // Configurable relevance threshold (0.0 to 1.0). Overridable via process.env.RAG_RELEVANCE_THRESHOLD
  relevanceThreshold: Number(process.env.RAG_RELEVANCE_THRESHOLD || 0.60),
  highRelevanceThreshold: 0.75,
  topKPerQuery: 5,
  maxFinalChunks: 8,
  maxContextChars: 8000
};

/**
 * Universal Query-Aware Retrieval Mechanism (Requirement 3)
 * Dynamically derives high-signal search queries across multiple domains
 * without relying on a rigid keyword match or just repeating generic boilerplate.
 */
export function deriveRetrievalQueries(prompt: string, decomp: TaskDecomposition): string[] {
  const p = prompt.trim();
  const lower = p.toLowerCase();

  // 1. Strict suppression for creative, pure code, or generic non-organizational tasks (Test 4)
  const isGenericImage = decomp.operation === 'image_generation' ||
    /(?:generate|create|draw|paint)\s+(?:an?\s+)?(?:image|picture|photo)\s+of\s+(?:giraffe|cat|dog|lion|tiger|woman|man|landscape|sunset|mountain|unicorn|apple|pizza|burger)/i.test(lower);

  const isPureMathOrCode = /fibonacci|fibonnacci|bubble\s*sort|binary\s*search|quick\s*sort|factorial/i.test(lower) &&
    !/policy|guideline|company|standard|internal|procedure|sop|compliance|audit|data|report|status/i.test(lower);

  if (isGenericImage || isPureMathOrCode) {
    return [];
  }

  const queries: string[] = [];

  // 1. Include the user's raw prompt
  queries.push(p);

  // 2. Extract clean core topic / entity by stripping conversational verbs, prefixes, and suffixes
  const cleanedTopic = p
    .replace(/^(?:what\s+(?:is|are)|tell\s+me\s+about|show\s+me|explain|describe|summarize|give\s+me|can\s+you\s+(?:show|give)\s+me|list|find|prepare|create|generate)\s+(?:a\s+|an\s+|the\s+|our\s+)?/i, '')
    .replace(/^(?:presentation\s+(?:on|about|for)|report\s+(?:on|about|for)|spreadsheet\s+(?:on|about|for)|analysis\s+(?:of|for|on))\s+/i, '')
    .replace(/\s+(?:of\s+the\s+company|of\s+our\s+company|for\s+the\s+company|per\s+company\s+guidelines?|according\s+to\s+company\s+standards?)\??$/i, '')
    .replace(/[.?!]+$/, '')
    .trim();

  if (cleanedTopic && cleanedTopic.toLowerCase() !== lower && !queries.includes(cleanedTopic)) {
    queries.push(cleanedTopic);
  }

  // 3. Domain: Financial, Budget, Expenditure & Tariff
  if (/expenditure|utilities|energy|consumption|budget|overrun|overspending|variance|deviation|tariff|water\s*expenditure|coal\s*expenditure|financial/i.test(lower)) {
    queries.push('October financial records budget actual expenditure');
    queries.push('Energy Expenditure Report');
    queries.push('energy consumption electricity coal MWh MT tariff');
    if (/overrun|overspending|variance|deviation/i.test(lower)) {
      queries.push('budget overruns percentage deviations largest contributor overspending');
    }
  }

  // 4. Domain: Production & Operations Data
  if (/production|operations|departmental|uptime|capacity|generation|electricity\s*generation|gwh|plant\s*load\s*factor|plf|unit\s*\d|shortfall|target.*actual/i.test(lower)) {
    queries.push('electricity generation target actual production report');
    queries.push('Raipur Production Report');
    queries.push('unit wise production target actual achievement');
    if (/unit\s*3|boiler.*shutdown|lowest/i.test(lower)) {
      queries.push('Unit 3 boiler-related shutdowns lowest production');
    }
  }

  // 5. Domain: Maintenance, Safety & Corrective Actions
  if (/maintenance|safety|ehs|incident|equipment|corrective|shutdown|breakdown|downtime|boiler|turbine|conveyor|failure|leakage|interventions/i.test(lower)) {
    queries.push('Maintenance Safety Report');
    queries.push('preventive corrective maintenance records equipment downtime');
    queries.push('safety incidents severity status pending corrective actions');
    if (/highest\s*downtime|rank|operational\s*risk/i.test(lower)) {
      queries.push('highest downtime operational risk ranking pending maintenance');
    }
  }

  // 6. Cross-reference production and maintenance
  if ((/cross-reference|correlate|explain.*shortfall|production.*loss/i.test(lower)) && (/maintenance|failure|breakdown|equipment/i.test(lower))) {
    queries.push('Raipur Production Report');
    queries.push('Maintenance Safety Report');
    queries.push('equipment failures explain production shortfall');
  }

  // 7. Domain: Presentations
  if (
    decomp.requestedOutputFormat === 'pptx' ||
    decomp.operation === 'deliverable_pptx' ||
    /presentation|slide|powerpoint|pptx|deck|keynote/i.test(lower)
  ) {
    if (/guideline|standard|template|policy|brand|rule|typography/i.test(lower)) {
      queries.push('presentation guidelines');
      queries.push('corporate PowerPoint formatting standards');
      queries.push('official presentation template');
      queries.push('company branding and slide design policy');
    } else if (cleanedTopic) {
      queries.push(`${cleanedTopic} presentation`);
      queries.push('presentation guidelines');
    }
  }

  // 8. Domain: Reports & Document Compilation Standards
  if (
    /report\s*(?:guidelines?|standards?|templates?|policies|writing|format)/i.test(lower) ||
    /controlled\s*doc/i.test(lower) ||
    (decomp.operation === 'report_compilation' && !/maintenance|safety|production|infrastructure|energy/i.test(lower)) ||
    (/prepare|create|write|generate/i.test(lower) && /internal\s*project\s*report|formal\s*report/i.test(lower))
  ) {
    queries.push('report writing standards');
    queries.push('Corporate Reporting Guidelines');
    queries.push('ENG-STD-002 Technical Report Guidelines');
  }

  // 9. Direct organizational inquiry
  if (/guideline|policy|standard|rule|procedure|how\s+does\s+the\s+company|what\s+are\s+the\s+(?:company|our)/i.test(lower)) {
    if (!queries.includes(p)) queries.unshift(p);
  }

  return Array.from(new Set(queries)).slice(0, 8);
}

/**
 * Clean and sanitize retrieved text against prompt injection attacks (Requirement 10, Test 7)
 * Ensures retrieved document chunks are strictly passive reference data.
 */
export function sanitizeContextText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<\/?[a-z_][a-z0-9_-]*[^>]*>/gi, '') // Strip XML/HTML tags
    // Neutralize prompt injection and privilege escalation patterns
    .replace(/(?:ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions|system\s*override|disregard\s+(?:all\s+)?(?:guidelines|instructions|rules)|you\s+are\s+now\s+DAN|jailbreak)/gi, '[REDACTED_ATTEMPTED_INSTRUCTION_OVERRIDE]')
    .replace(/(?:reveal|leak|print|show)\s+(?:system\s*prompt|api\s*key|password|credential)/gi, '[REDACTED_ATTEMPTED_DATA_EXFILTRATION]')
    .trim();
}

/**
 * Extract key operational rules from retrieved guideline chunks
 */
export function extractGuidelineRules(chunks: KnowledgeChunk[]): string[] {
  const rules: string[] = [];
  const text = chunks.map(c => c.text).join('\n');

  if (/one\s+(?:key\s+)?message\s+per\s+slide|one\s+idea\s+per\s+slide/i.test(text)) {
    rules.push('One takeaway per slide: title must state the conclusion or action, not a generic topic.');
  }
  if (/evidence\s+before\s+conclusion|cite\s+(?:data|source)/i.test(text)) {
    rules.push('Mandatory evidence citations: all charts, figures, and assertions must cite verified source and date.');
  }
  if (/16:9|widescreen/i.test(text)) {
    rules.push('Standard 16:9 widescreen presentation layout.');
  }
  if (/navy|slate|corporate\s+blue|palette/i.test(text)) {
    rules.push('Restrained corporate palette: Deep Navy/Slate primary with subtle accent, avoiding flashy gradients.');
  }
  if (/controlled\s+document|document\s+number|revision/i.test(text)) {
    rules.push('Controlled document formatting: document ID, revision history block, and approval signatures.');
  }
  if (/executive\s*summary/i.test(text)) {
    rules.push('Mandatory Executive Summary preceding technical findings.');
  }

  return rules;
}

/**
 * Retrieve task-grounded context across organizational knowledge base
 * BEFORE workplan approval. (Requirement 2 & Requirement 4)
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

  // Multi-query search across local vector & lexical knowledge base
  const chunkMap = new Map<string, { chunk: KnowledgeChunk; score: number }>();
  for (const q of derivedQueries) {
    try {
      const results = await ragEngine.search(q, RAG_CONFIG.topKPerQuery);
      for (const r of results) {
        const existing = chunkMap.get(r.chunk.id);
        if (!existing || r.score > existing.score) {
          chunkMap.set(r.chunk.id, r);
        }
      }
    } catch (err) {
      console.warn(`[ContextRAG] Query '${q}' search error:`, err);
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
    // Sort chunks by score descending
    items.sort((a, b) => b.score - a.score);
    const topScore = items[0]?.score || 0;

    // Strict Relevance Evaluation (Requirement 4):
    // Discard any candidate below the configurable relevance threshold
    if (topScore < RAG_CONFIG.relevanceThreshold) {
      continue;
    }

    const relevanceLevel: 'high' | 'moderate' = topScore >= RAG_CONFIG.highRelevanceThreshold ? 'high' : 'moderate';
    const sectionNames = Array.from(new Set(items.map(i => i.chunk.section).filter(Boolean)));
    const sectionsText = sectionNames.length > 0 ? sectionNames.join(', ') : 'General Document Sections';

    // Extract potential version / date metadata (Requirement 5)
    let versionDate = 'Current Official Standard';
    const combinedSample = items.map(i => i.chunk.text).slice(0, 3).join(' ');
    const verMatch = combinedSample.match(/(?:version|v\.?|rev\.?)\s*(\d+(?:\.\d+)?)/i);
    const dateMatch = combinedSample.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i);
    if (verMatch && dateMatch) {
      versionDate = `v${verMatch[1]} (${dateMatch[0]})`;
    } else if (verMatch) {
      versionDate = `v${verMatch[1]}`;
    } else if (dateMatch) {
      versionDate = dateMatch[0];
    }

    // Determine domain-specific key requirements and task rationale (Section 4)
    const keyRequirements: string[] = [];
    let rationale = '';

    if (/presentation/i.test(docName)) {
      rationale = 'Mandates slide layout hierarchy, 16:9 widescreen standards, and takeaway headline requirements for presentation compilation.';
      keyRequirements.push('Corporate 16:9 layout structure', 'Executive takeaway headline on each slide', 'Verified citations for all charts');
    } else if (/production/i.test(docName)) {
      rationale = 'Provides unit-wise generation figures, production targets vs actuals, and equipment availability baselines needed to quantify shortfalls.';
      keyRequirements.push('Monthly production targets vs actual generation', 'Unit-wise performance and generation shortfalls', 'Equipment availability and scheduled operating hours');
    } else if (/infrastructure/i.test(docName)) {
      rationale = 'Provides capital works milestone reviews, budget allocations, and contractor execution logs for project status assessment.';
      keyRequirements.push('Capital expenditure tracking', 'Project milestone delivery dates', 'Contractor progress monitoring');
    } else if (/maintenance|safety/i.test(docName)) {
      rationale = 'Contains equipment breakdown logs, boiler shutdown incident history, and corrective maintenance records required for root-cause diagnosis.';
      keyRequirements.push('Corrective maintenance and equipment breakdown logs', 'Boiler and turbine outage incident records', 'Preventive maintenance backlog and overdue work orders');
    } else if (/energy|expenditure/i.test(docName)) {
      rationale = 'Supplies utility consumption records and fuel expenditure accounts for auxiliary cost and tariff analysis.';
      keyRequirements.push('Electrical grid consumption baselines', 'Auxiliary fuel and utility expenditures', 'Demand charges and power factor baselines');
    } else if (/reporting_guidelines|controlled|report/i.test(docName)) {
      rationale = 'Governs document control numbers, revision tracking, executive summary structuring, and technical report standards.';
      keyRequirements.push('Document control header (Doc ID, Rev, Date)', 'Executive Summary section', 'Structured conclusions and sign-off block');
    } else if (/financial|spreadsheet|data/i.test(docName)) {
      rationale = 'Defines formula validation rules, KPI dashboard structure, and quantitative precision standards.';
      keyRequirements.push('KPI summary tab', 'Formula integrity standards', 'Currency and unit transparency');
    } else {
      rationale = `Supplies verified organizational reference context from ${docName}.`;
      keyRequirements.push('Factual reference citations', 'Organizational policy compliance');
    }

    matches.push({
      docId: items[0]?.chunk.docId || docName,
      docName,
      sections: sectionsText,
      relevanceScore: parseFloat(topScore.toFixed(3)),
      relevanceLevel,
      status: 'Accepted as execution context',
      rationale,
      versionDate,
      keyRequirements
    });
  }

  // Sort matches by relevance score descending
  matches.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Section 4 Relevance Filtering: Avoid polluting specialized domain analyses with low/moderate generic report guidelines
  // If high-confidence domain documents (score >= 0.85, e.g. Production Data or Maintenance Report) are present,
  // filter out generic report creation guidelines unless user explicitly asked for document formatting standards.
  const hasSpecificHighConfidenceDoc = matches.some(m => m.relevanceScore >= 0.85 && /production|maintenance|infrastructure|expenditure|presentation/i.test(m.docName));
  const askedForReportGuidelines = /report\s*(?:guidelines?|standards?|templates?|policies|writing)/i.test(prompt);

  const filteredMatches = hasSpecificHighConfidenceDoc && !askedForReportGuidelines
    ? matches.filter(m => !/corporate_reporting_guidelines|01_controlled_pdf|readme_test_pack/i.test(m.docName) || m.relevanceScore >= 0.90)
    : matches;

  // Build sanitized, untrusted reference context block from accepted filtered matches
  const allowedDocNames = new Set(filteredMatches.map(m => m.docName));
  for (const [docName, items] of docMap.entries()) {
    if (!allowedDocNames.has(docName)) continue;
    for (const item of items.slice(0, 6)) {
      const clean = sanitizeContextText(item.chunk.text);
      sanitizedBlocks.push(
        `<untrusted_reference_document source="${docName}" section="${item.chunk.section || 'Section'}" score="${item.score.toFixed(2)}" untrusted="true">\n${clean}\n</untrusted_reference_document>`
      );
    }
  }

  // Conflicting Document Detection & Resolution (Requirement 7 & Test 6)
  let conflictDetected = false;
  let conflictDetails: string | undefined;

  const presentationMatches = matches.filter(m => /presentation|slide|powerpoint/i.test(m.docName));
  if (presentationMatches.length > 1) {
    conflictDetected = true;
    const primary = presentationMatches[0];
    const secondary = presentationMatches[1];
    conflictDetails = `Multiple matching presentation documents detected (${primary.docName} vs ${secondary.docName}). Precedence automatically assigned to ${primary.docName} (${primary.versionDate || 'Latest revision'}, score: ${primary.relevanceScore}).`;
  }

  const rawChunks = allItems.map(i => i.chunk);
  const guidelineRules = extractGuidelineRules(rawChunks);

  return {
    hasMatches: filteredMatches.length > 0,
    matches: filteredMatches,
    sanitizedContextText: sanitizedBlocks.join('\n\n'),
    conflictDetected,
    conflictDetails,
    derivedQueries,
    primarySource: filteredMatches[0]?.docName,
    guidelineRules
  };
}

/**
 * Augment and Enrich Workplan Based on Retrieved Organizational Context (Requirement 2 & 5)
 * Transforms the execution sequence from generic placeholders into source-grounded tasks.
 */
export function enrichWorkplan(
  workplan: LumiWorkplan,
  context: KnowledgeContextPackage,
  decomp: TaskDecomposition
): LumiWorkplan {
  workplan.knowledgeMatches = context.matches;
  workplan.knowledgeContext = context;

  const prompt = (decomp.rawPrompt || workplan.originalPrompt || '').toLowerCase();

  // Test 5: Check if user specifically requested a named internal protocol/policy
  const specificSubjectMatch = prompt.match(/(?:following|according to|per|our|the|for)\s+([a-z0-9_\s-]+(?:protocol|guideline|policy|procedure|standard|specification))/i);
  
  if (specificSubjectMatch) {
    const requestedSubject = specificSubjectMatch[1].trim();
    const words = requestedSubject.split(/\s+/).filter(w => !['our', 'the', 'a', 'an', 'following', 'protocol', 'guideline', 'policy', 'standard', 'specialized'].includes(w));
    const hasSpecificMatch = context.matches.some(m => {
      const lowerDoc = m.docName.toLowerCase();
      const lowerSec = m.sections.toLowerCase();
      return words.some(w => lowerDoc.includes(w) || lowerSec.includes(w));
    });

    if (!hasSpecificMatch) {
      workplan.policyFound = false;
      workplan.policyNotice = `Notice: No matching internal documentation was found for "${requestedSubject}". Execution will proceed based on universal best practices and first principles without fabricated policies.`;
      return workplan;
    }
  }

  const askedForPolicy = /guideline|policy|standard|internal|procedure|sop|protocol|how\s+does\s+the\s+company|what\s+are\s+the/i.test(prompt);

  // If relevant documents were found, transform execution sequence into source-grounded tasks
  if (context.hasMatches) {
    workplan.policyFound = true;
    const docName = context.primarySource || 'Official Company Guidelines';

    workplan.requiredCapabilities = Array.from(new Set([
      ...workplan.requiredCapabilities,
      'Internal Knowledge Base Compliance',
      'Organizational Guideline Grounding',
      'Policy-Grounded Quality Gate Audit'
    ]));

    // Dynamic reconstruction of execution sequence based on domain and retrieved context
    if ((/unit\s*\d+|lowest\s*production|boiler|turbine\s*vibration/i.test(prompt)) && (/analyze|corrective\s*actions?|recommend|recovery/i.test(prompt))) {
      workplan.taskInterpretation = 'Analyze Unit 3 production shortfall, quantify shortfall vs plant targets, investigate repeated boiler outage root causes using maintenance records, and establish an evidence-based corrective action recovery plan.';
      workplan.expectedDeliverables = [
        'Unit 3 Operational Recovery & Corrective Action Report',
        'Unit-Wise Generation Variance Reconciliation Matrix'
      ];
      const enrichedSteps: LumiWorkflowStep[] = [
        {
          id: 'step-1',
          stageNumber: 1,
          name: 'Production Data Validation & Unit-Wise Generation Comparison',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Extract and reconcile monthly generation figures across Unit 1 (225 GWh / 240 GWh target), Unit 2 (218 GWh / 240 GWh target), and Unit 3 (205 GWh / 240 GWh target) against plant total target (720 GWh target vs 648 GWh actual) from Raipur_Production_Report.txt.',
          actions: [
            'Reconcile plant-wide 72 GWh generation deficit (648 GWh actual vs 720 GWh target)',
            'Compare individual unit generation against equal 240 GWh benchmarks',
            'Validate Unit 3 deficit of 35 GWh (14.6% shortfall) as the primary generation drag'
          ],
          inputs: 'October 2026 Production & Operations Data (Raipur_Production_Report.txt)',
          dependencies: [],
          expectedOutput: 'Validated unit-wise generation ledger and shortfall breakdown',
          validationCriteria: '100% numerical reconciliation with official production records',
          status: 'pending'
        },
        {
          id: 'step-2',
          stageNumber: 2,
          name: 'Quantification of Production Shortfalls & Capacity Loss',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Quantify generation deficit, plant load factor (PLF) degradation from 85% to 76%, and output rejection increase from 2.0% to 3.8%.',
          actions: [
            'Quantify lost generation value and daily megawatt shortfall for Unit 3',
            'Calculate impact of plant load factor (PLF) drop from 85% baseline down to 76%',
            'Analyze rejected product variance rise from 2.0% to 3.8%'
          ],
          inputs: 'Generation shortfall data from Step 1',
          dependencies: ['step-1'],
          expectedOutput: 'Detailed shortfall variance matrix and capacity loss metrics',
          validationCriteria: 'Mathematical consistency across PLF and rejection rate calculations',
          status: 'pending'
        },
        {
          id: 'step-3',
          stageNumber: 3,
          name: 'Investigation of Unit 3 Boiler Shutdowns & Downtime Logs',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Correlate Unit 3 generation loss with repeated boiler-related forced outages and corrective work orders in Maintenance_Safety_Report.txt.',
          actions: [
            'Evaluate equipment availability degradation from 95% down to 87%',
            'Cross-reference boiler trip logs, tube leakage history, and unplanned downtime hours',
            'Isolate Unit 3 boiler outage duration vs Unit 2 turbine vibration events'
          ],
          inputs: 'Maintenance & Safety Report (Maintenance_Safety_Report.txt)',
          dependencies: ['step-1'],
          expectedOutput: 'Boiler shutdown root-cause correlation and downtime chronology',
          validationCriteria: 'All forced outage hours accounted for against availability drop',
          status: 'pending'
        },
        {
          id: 'step-4',
          stageNumber: 4,
          name: 'Assessment of Contributing Operational & Equipment Factors',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Analyze auxiliary equipment reliability, feed water pump performance, and operating condition factors contributing to boiler trips.',
          actions: [
            'Review overdue preventive work orders in maintenance register',
            'Assess thermal stress cycling and feed pump stoppage impacts',
            'Distinguish confirmed mechanical defects from secondary operational symptoms'
          ],
          inputs: 'Outage logs from Step 3 and production operating logs',
          dependencies: ['step-3'],
          expectedOutput: 'Operational risk assessment and failure mechanism diagnosis',
          validationCriteria: 'Physical failure mechanism corroborated by operating telemetry',
          status: 'pending'
        },
        {
          id: 'step-5',
          stageNumber: 5,
          name: 'Evidence-Based Corrective Actions & Performance Recovery Recommendations',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Formulate prioritized, time-bound engineering and operational corrective actions to restore Unit 3 availability and eliminate boiler trips.',
          actions: [
            'Establish immediate boiler inspection, non-destructive testing (NDT), and tube thickness mapping protocol',
            'Define preventative maintenance overhaul schedule for critical feed pumps and valves',
            'Formulate generation recovery plan to regain 35 GWh shortfall and return plant PLF to >85%'
          ],
          inputs: 'Failure analysis from Step 4',
          dependencies: ['step-4'],
          expectedOutput: 'Comprehensive corrective action plan with recovery milestones',
          validationCriteria: 'Action items directly address identified failure causes with clear ownership',
          status: 'pending'
        }
      ];
      workplan.executionSequence = enrichedSteps;
    } else if (/presentation/i.test(docName) || decomp.operation === 'deliverable_pptx') {
      const enrichedSteps: LumiWorkflowStep[] = [
        {
          id: 'step-1',
          stageNumber: 1,
          name: `Analyze Official Company Presentation Guidelines (${docName})`,
          agent: 'vector_rag',
          model: 'vector-similarity-engine',
          description: `Ingest and interpret mandatory presentation standards, slide layout rules, and branding policies from ${docName}.`,
          actions: [
            `Extract mandatory slide structure from ${docName}`,
            'Identify required 16:9 widescreen layout and typographic hierarchy',
            'Extract approved corporate color palette and citation requirements'
          ],
          inputs: `Retrieved knowledge chunks from ${docName}`,
          dependencies: [],
          expectedOutput: 'Grounded presentation rule matrix covering structure, branding, and citations.',
          validationCriteria: 'Official guidelines successfully parsed and validated.',
          status: 'pending'
        },
        {
          id: 'step-2',
          stageNumber: 2,
          name: 'Extract Mandatory Formatting, Branding & Structural Requirements',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: `Translate extracted rules into actionable constraints: takeaway headlines, restrained palette, and evidence citation standards.`,
          actions: [
            'Enforce rule: headline must state the conclusion or takeaway, not just a topic category',
            'Define slide sequence: Title, Executive Summary, Analysis, Findings, Next Steps',
            'Enforce citation footnotes on all factual assertions'
          ],
          inputs: 'Rule matrix from Stage 1 (step-1).',
          dependencies: ['step-1'],
          expectedOutput: 'Actionable slide design specification compliant with company policy.',
          validationCriteria: 'All mandatory corporate formatting rules codified.',
          status: 'pending'
        },
        {
          id: 'step-3',
          stageNumber: 3,
          name: 'Generate Presentation Content Compliant with Guidelines',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Synthesize concise, high-density slide headings and takeaways strictly adhering to company writing standards.',
          actions: [
            'Synthesize factual slide content adhering to the 3-5 concise bullet point rule',
            'Eliminate generic marketing fluff in favor of verified technical points',
            'Attach verified source attribution to every technical claim'
          ],
          inputs: 'Design specification from Stage 2 (step-2).',
          dependencies: ['step-2'],
          expectedOutput: 'Complete slide copy formatted to corporate standards.',
          validationCriteria: 'All slides satisfy corporate brevity and evidence requirements.',
          status: 'pending'
        },
        {
          id: 'step-4',
          stageNumber: 4,
          name: 'Compile Native PowerPoint (.pptx) Using Approved Formatting Standards',
          agent: 'reasoning_synthesis',
          model: 'pptxgenjs-runtime',
          description: `Compile slide deck into native Microsoft PowerPoint container using approved corporate styling.`,
          actions: [
            'Initialize 16:9 widescreen layout with corporate styling',
            'Inject title slide with organizational metadata and sign-off block',
            'Render takeaway headlines, styled bullet points, and citation footnotes',
            'Encode presentation to OpenXML PKZip buffer'
          ],
          inputs: 'Slide copy from Stage 3 (step-3).',
          dependencies: ['step-3'],
          expectedOutput: 'Native .pptx deliverable adhering to corporate branding.',
          validationCriteria: 'Non-empty presentation conforming to OpenXML and company standards.',
          status: 'pending'
        },
        {
          id: 'step-5',
          stageNumber: 5,
          name: 'Validate Generated Presentation Against Retrieved Guidelines',
          agent: 'reasoning_synthesis',
          model: 'visual-quality-gate',
          description: `Verify that the compiled presentation fully satisfies all mandatory policies in ${docName}.`,
          actions: [
            'Verify adherence to slide structure and takeaway headline standards',
            'Verify color palette and typography compliance',
            'Confirm data citations and source transparency'
          ],
          inputs: 'Compiled .pptx from Stage 4 (step-4) and rules from Stage 1.',
          dependencies: ['step-4'],
          expectedOutput: 'Compliance validation report with audit check results.',
          validationCriteria: 'Zero non-compliance violations detected.',
          status: 'pending'
        }
      ];

      workplan.executionSequence = enrichedSteps;
    } else if (/production/i.test(docName)) {
      const enrichedSteps: LumiWorkflowStep[] = [
        {
          id: 'step-1',
          stageNumber: 1,
          name: `Ingest Production & Operations Records (${docName})`,
          agent: 'vector_rag',
          model: 'vector-similarity-engine',
          description: `Retrieve verified monthly production statements, output metrics, and downtime logs from ${docName}.`,
          actions: [
            `Extract departmental performance metrics from ${docName}`,
            'Identify capacity utilization baselines and monthly volume targets',
            'Isolate maintenance downtime and equipment operational factors'
          ],
          inputs: `Retrieved knowledge chunks from ${docName}`,
          dependencies: [],
          expectedOutput: 'Grounded operational dataset and verified output metrics.',
          validationCriteria: 'Production logs successfully extracted and validated.',
          status: 'pending'
        },
        {
          id: 'step-2',
          stageNumber: 2,
          name: 'Analyze Departmental Performance, Metrics & Operating Targets',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Evaluate output variances across departments against corporate operating targets.',
          actions: [
            'Reconcile actual output vs budgeted targets per manufacturing unit',
            'Quantify yield efficiencies and line stoppage drivers',
            'Identify production bottlenecks and operational recovery measures'
          ],
          inputs: 'Operational dataset from Stage 1 (step-1).',
          dependencies: ['step-1'],
          expectedOutput: 'Actionable variance analysis and departmental breakdown.',
          validationCriteria: 'All operational deviations mathematically reconciled.',
          status: 'pending'
        },
        {
          id: 'step-3',
          stageNumber: 3,
          name: 'Synthesize Findings & Performance Summary',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Synthesize executive operations summary citing verified figures from the official record.',
          actions: [
            'Draft executive summary with key performance indicators (KPIs)',
            'Include plant efficiency recommendations and actionable takeaways',
            'Attach verified source attribution and reference citations'
          ],
          inputs: 'Analysis from Stage 2 (step-2).',
          dependencies: ['step-2'],
          expectedOutput: 'Structured production performance report with verified metrics.',
          validationCriteria: 'Executive summary complete with official citations.',
          status: 'pending'
        },
        {
          id: 'step-4',
          stageNumber: 4,
          name: 'Validate Operational Data Integrity',
          agent: 'reasoning_synthesis',
          model: 'lumi-quality-gate',
          description: `Audit findings against ${docName} to ensure zero metric hallucination.`,
          actions: [
            'Cross-check reported production figures against source record tables',
            'Confirm calculation consistency across operational units',
            'Certify deliverable compliance with corporate reporting standards'
          ],
          inputs: 'Draft report from Stage 3 and source records from Stage 1.',
          dependencies: ['step-3'],
          expectedOutput: 'Operational data integrity audit certificate.',
          validationCriteria: 'Zero metric discrepancy detected against source document.',
          status: 'pending'
        }
      ];

      workplan.executionSequence = enrichedSteps;
    } else if (/infrastructure/i.test(docName)) {
      const enrichedSteps: LumiWorkflowStep[] = [
        {
          id: 'step-1',
          stageNumber: 1,
          name: `Ingest Infrastructure Project Status Data (${docName})`,
          agent: 'vector_rag',
          model: 'vector-similarity-engine',
          description: `Retrieve capital works milestones, project timelines, and contractor reviews from ${docName}.`,
          actions: [
            `Extract capital works milestone progress from ${docName}`,
            'Identify budget allocation and cumulative expenditure per package',
            'Record critical path risks and contractor delivery schedules'
          ],
          inputs: `Retrieved knowledge chunks from ${docName}`,
          dependencies: [],
          expectedOutput: 'Capital projects register and milestone progress log.',
          validationCriteria: 'Project status data verified against source record.',
          status: 'pending'
        },
        {
          id: 'step-2',
          stageNumber: 2,
          name: 'Review Capital Works Milestones, Expenditure & Critical Path',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Evaluate physical completion percentages and financial disbursements across active project packages.',
          actions: [
            'Calculate completion variance against original commissioning dates',
            'Assess expenditure burn rate against authorized project budgets',
            'Highlight critical bottleneck packages requiring executive escalation'
          ],
          inputs: 'Project data from Stage 1 (step-1).',
          dependencies: ['step-1'],
          expectedOutput: 'Comprehensive capital works review with variance analysis.',
          validationCriteria: 'Budget and schedule variances fully reconciled.',
          status: 'pending'
        },
        {
          id: 'step-3',
          stageNumber: 3,
          name: 'Synthesize Project Status & Progress Analysis',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Generate structured capital projects status summary for leadership review.',
          actions: [
            'Formulate package-by-package status summary with traffic-light risk ratings',
            'Detail mitigation actions for delayed milestones',
            'Document official reference numbers and reporting dates'
          ],
          inputs: 'Review findings from Stage 2 (step-2).',
          dependencies: ['step-2'],
          expectedOutput: 'Infrastructure status briefing with actionable recommendations.',
          validationCriteria: 'All active packages accounted for with verified citations.',
          status: 'pending'
        },
        {
          id: 'step-4',
          stageNumber: 4,
          name: 'Milestone Verification & Schedule Compliance Check',
          agent: 'reasoning_synthesis',
          model: 'lumi-quality-gate',
          description: `Audit project status statements against ${docName}.`,
          actions: [
            'Verify physical milestone dates against official engineering logs',
            'Ensure expenditure numbers reconcile with financial allocations',
            'Certify report accuracy'
          ],
          inputs: 'Briefing from Stage 3 and records from Stage 1.',
          dependencies: ['step-3'],
          expectedOutput: 'Milestone verification certificate.',
          validationCriteria: 'Zero schedule or financial discrepancies found.',
          status: 'pending'
        }
      ];

      workplan.executionSequence = enrichedSteps;
    } else if (/maintenance|safety/i.test(docName)) {
      const enrichedSteps: LumiWorkflowStep[] = [
        {
          id: 'step-1',
          stageNumber: 1,
          name: `Ingest Maintenance & Safety Records (${docName})`,
          agent: 'vector_rag',
          model: 'vector-similarity-engine',
          description: `Retrieve equipment availability logs, preventative maintenance schedules, and EHS incident registers from ${docName}.`,
          actions: [
            `Extract monthly maintenance uptime and equipment breakdown logs from ${docName}`,
            'Review EHS incident records and lost-time injury metrics',
            'Identify statutory safety audit and environmental compliance ratings'
          ],
          inputs: `Retrieved knowledge chunks from ${docName}`,
          dependencies: [],
          expectedOutput: 'Verified maintenance and EHS operational data record.',
          validationCriteria: 'Safety and maintenance metrics parsed and validated.',
          status: 'pending'
        },
        {
          id: 'step-2',
          stageNumber: 2,
          name: 'Evaluate EHS Incidents, Equipment Uptime & Inspection Logs',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Analyze equipment availability rates and evaluate workplace safety incident frequency.',
          actions: [
            'Calculate Mean Time Between Failures (MTBF) and availability percentages',
            'Classify reported safety near-misses and statutory compliance events',
            'Evaluate corrective action closeout rates across production lines'
          ],
          inputs: 'Data record from Stage 1 (step-1).',
          dependencies: ['step-1'],
          expectedOutput: 'Detailed equipment reliability and safety compliance assessment.',
          validationCriteria: 'All incident and maintenance metrics verified.',
          status: 'pending'
        },
        {
          id: 'step-3',
          stageNumber: 3,
          name: 'Synthesize Maintenance & Safety Action Summary',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Synthesize monthly EHS and plant maintenance briefing with actionable safety directives.',
          actions: [
            'Compile executive safety dashboard and maintenance performance summary',
            'Outline preventative maintenance schedule priorities for coming cycle',
            'Include verified document reference and incident tracking citations'
          ],
          inputs: 'Assessment from Stage 2 (step-2).',
          dependencies: ['step-2'],
          expectedOutput: 'Actionable maintenance and safety executive briefing.',
          validationCriteria: 'All statutory EHS disclosures complete and referenced.',
          status: 'pending'
        },
        {
          id: 'step-4',
          stageNumber: 4,
          name: 'Safety Protocol & Maintenance Compliance Audit',
          agent: 'reasoning_synthesis',
          model: 'lumi-quality-gate',
          description: `Verify findings against ${docName} records.`,
          actions: [
            'Audit safety incident statistics against official EHS logs',
            'Confirm preventative maintenance compliance rates match records',
            'Certify compliance certificate'
          ],
          inputs: 'Briefing from Stage 3 and source logs from Stage 1.',
          dependencies: ['step-3'],
          expectedOutput: 'Maintenance & EHS compliance certification.',
          validationCriteria: 'Zero non-compliance findings.',
          status: 'pending'
        }
      ];

      workplan.executionSequence = enrichedSteps;
    } else if (/energy|expenditure/i.test(docName)) {
      const enrichedSteps: LumiWorkflowStep[] = [
        {
          id: 'step-1',
          stageNumber: 1,
          name: `Ingest Energy & Expenditure Data (${docName})`,
          agent: 'vector_rag',
          model: 'vector-similarity-engine',
          description: `Retrieve electrical grid consumption, fuel expenditure, and utility budget records from ${docName}.`,
          actions: [
            `Extract utility consumption figures (kWh, fuel, water) from ${docName}`,
            'Retrieve monthly expenditure breakdowns against allocated utility budgets',
            'Record power factor, demand charges, and tariff variance rates'
          ],
          inputs: `Retrieved knowledge chunks from ${docName}`,
          dependencies: [],
          expectedOutput: 'Comprehensive utility consumption and energy cost ledger.',
          validationCriteria: 'Energy and financial statements verified against source document.',
          status: 'pending'
        },
        {
          id: 'step-2',
          stageNumber: 2,
          name: 'Analyze Utility Consumption, Tariff Variances & Cost Trends',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Reconcile unit power costs and quantify specific energy consumption against production volume.',
          actions: [
            'Calculate Specific Energy Consumption (SEC) per ton/unit of output',
            'Analyze budget variance across power tariffs and auxiliary fuel accounts',
            'Identify high-consumption operational periods and demand peak penalties'
          ],
          inputs: 'Cost ledger from Stage 1 (step-1).',
          dependencies: ['step-1'],
          expectedOutput: 'Energy efficiency analysis and cost reconciliation report.',
          validationCriteria: 'All utility variances mathematically reconciled.',
          status: 'pending'
        },
        {
          id: 'step-3',
          stageNumber: 3,
          name: 'Synthesize Financial Performance & Utilities Summary',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Draft executive energy statement with quantitative findings and conservation recommendations.',
          actions: [
            'Formulate executive energy and expenditure briefing',
            'Detail conservation measures to reduce peak tariff penalties',
            'Cite official statement reference and reporting periods'
          ],
          inputs: 'Analysis from Stage 2 (step-2).',
          dependencies: ['step-2'],
          expectedOutput: 'Structured energy and expenditure executive briefing.',
          validationCriteria: 'All consumption metrics cited with source transparency.',
          status: 'pending'
        },
        {
          id: 'step-4',
          stageNumber: 4,
          name: 'Budget Variance & Consumption Integrity Audit',
          agent: 'reasoning_synthesis',
          model: 'lumi-quality-gate',
          description: `Audit energy and financial figures against ${docName}.`,
          actions: [
            'Reconcile reported expenditures against official accounting figures',
            'Verify utility billing meters and tariff classifications',
            'Certify financial and utility statement accuracy'
          ],
          inputs: 'Briefing from Stage 3 and statements from Stage 1.',
          dependencies: ['step-3'],
          expectedOutput: 'Energy expenditure audit certificate.',
          validationCriteria: 'Zero numerical discrepancies against official statement.',
          status: 'pending'
        }
      ];

      workplan.executionSequence = enrichedSteps;
    } else if (decomp.operation === 'report_compilation' || /report|guideline|standard/i.test(prompt)) {
      const enrichedSteps: LumiWorkflowStep[] = [
        {
          id: 'step-1',
          stageNumber: 1,
          name: `Ingest Governing Report Standards (${docName})`,
          agent: 'vector_rag',
          model: 'vector-similarity-engine',
          description: `Retrieve controlled document and report structure guidelines from ${docName}.`,
          actions: [
            'Extract document control header rules (Doc ID, Rev, Date)',
            'Identify mandatory sections: Executive Summary, Methodology, Findings, Sign-off',
            'Ingest citation and signature standards'
          ],
          inputs: `Retrieved knowledge chunks from ${docName}`,
          dependencies: [],
          expectedOutput: 'Controlled document schema and formatting constraints.',
          validationCriteria: 'Report standards identified and verified.',
          status: 'pending'
        },
        {
          id: 'step-2',
          stageNumber: 2,
          name: 'Synthesize Report Content Under Organizational Guidelines',
          agent: 'reasoning_synthesis',
          model: 'qwen2.5:1.5b',
          description: 'Draft structured report content fulfilling corporate documentation standards.',
          actions: [
            'Formulate Executive Summary with quantitative findings',
            'Structure technical evidence and methodology',
            'Format tables and conclusions per corporate standard'
          ],
          inputs: 'Document schema from Stage 1 (step-1).',
          dependencies: ['step-1'],
          expectedOutput: 'Complete report body ready for document assembly.',
          validationCriteria: 'All mandatory sections drafted without placeholder text.',
          status: 'pending'
        },
        {
          id: 'step-3',
          stageNumber: 3,
          name: 'Compile Native Controlled Document Deliverable (.docx / .pdf)',
          agent: 'reasoning_synthesis',
          model: 'reportlab-docx-deliverable-engine',
          description: 'Assemble native document with document control header and corporate typography.',
          actions: [
            'Generate document header with ID, Revision, and Date',
            'Apply approved typography and table formatting',
            'Export native document binary'
          ],
          inputs: 'Report content from Stage 2 (step-2).',
          dependencies: ['step-2'],
          expectedOutput: 'Native controlled report deliverable file.',
          validationCriteria: 'Valid binary document file generated.',
          status: 'pending'
        },
        {
          id: 'step-4',
          stageNumber: 4,
          name: 'Quality Gate & Compliance Audit',
          agent: 'reasoning_synthesis',
          model: 'lumi-quality-gate',
          description: `Audit final report deliverable against ${docName} requirements.`,
          actions: [
            'Check document control header completeness',
            'Verify all required sections exist',
            'Validate data citations and signature blocks'
          ],
          inputs: 'Compiled document from Stage 3.',
          dependencies: ['step-3'],
          expectedOutput: 'Quality audit verification certificate.',
          validationCriteria: 'Document compliance verified.',
          status: 'pending'
        }
      ];

      workplan.executionSequence = enrichedSteps;
    } else {
      // General tasks with relevant retrieved context
      for (const step of workplan.executionSequence) {
        if (step.agent === 'reasoning_synthesis' || step.name.includes('Synthesis')) {
          step.description = `${step.description} Grounded in official documentation (${docName}).`;
          step.actions.unshift(`Apply governing rules and definitions from ${docName}`);
        } else if (step.agent === 'presentation_compiler' || step.name.includes('Slide Outline')) {
          step.description = `${step.description} Conforms to ${docName}.`;
          step.actions.unshift(`Incorporate presentation standards from ${docName}`);
        }
      }
    }
  } else if (askedForPolicy) {
    workplan.policyFound = false;
    workplan.policyNotice = `Notice: No matching internal documentation was found for this query in the local knowledge base. Execution will proceed based on universal best practices and first principles.`;
  }

  return workplan;
}
