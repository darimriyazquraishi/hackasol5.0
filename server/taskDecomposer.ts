import fs from 'fs';
import path from 'path';
import { detectImageGenerationIntent } from './imageEngine';

export interface ExtractedParameter {
  name: string;
  key: string;
  value: number | string;
  unit: string;
  raw: string;
}

export type TaskDomain =
  | 'engineering_calculation'
  | 'data_analysis'
  | 'programming'
  | 'document_analysis'
  | 'general_qa'
  | 'image_generation'
  | 'vision_analysis';

export type TaskOperation =
  | 'code_generation'
  | 'code_debugging'
  | 'vision_analysis'
  | 'vision_ocr'
  | 'engineering_pump'
  | 'engineering_compressed_air'
  | 'engineering_general'
  | 'math_problem'
  | 'document_summary'
  | 'document_compliance'
  | 'data_csv_analysis'
  | 'deliverable_pptx'
  | 'deliverable_xlsx'
  | 'image_generation'
  | 'general_qa';

export interface ConversationHistoryItem {
  sender: 'user' | 'assistant' | string;
  content: string;
  originalPrompt?: string;
  generatedSubject?: string;
  deliverableFormat?: string;
}

export function hasContextualReference(prompt: string): boolean {
  const lower = prompt.toLowerCase().trim();
  return (
    /(?:previous|prior|last|earlier|above|just|same)\s+(?:topic|subject|discussion|conversation|task|problem|question|answer|deliverable|data|result|item|one|presentation|report)/i.test(lower) ||
    /(?:what\s+we\s+(?:just\s+)?discussed|what\s+you\s+(?:just\s+)?generated|what\s+we\s+talked\s+about|from\s+where\s+we\s+stopped|continue\s+from|continue\s+where\s+we\s+left)/i.test(lower) ||
    /\b(?:on\s+the\s+same\s+topic|about\s+the\s+same|about\s+that|on\s+that|based\s+on\s+that|for\s+that|of\s+that|convert\s+(?:the\s+)?(?:previous|last|that)\s+answer)\b/i.test(lower) ||
    /^(?:make|create|generate|convert|turn)\s+(?:a\s+|an\s+|this\s+into\s+a\s+)?(?:ppt|powerpoint|presentation|pdf|report|doc|docx|spreadsheet|excel|xlsx)\s+(?:on|about|for|from)\s+(?:it|that|this|the\s+same|the\s+previous\s+one)/i.test(lower) ||
    /^(?:now\s+)?(?:make|create|generate|give\s+me)\s+(?:a\s+|an\s+)?(?:ppt|powerpoint|presentation|pdf|report|doc|docx|spreadsheet|excel|xlsx)\s+(?:on|about)\s+(?:the\s+same\s+topic|that\s+topic|it|that)/i.test(lower)
  );
}

/**
 * Lightweight Context Retrieval & Topic Extraction
 * Resolves conversational references back to the actual subject without confusing artifact containers.
 */
export function resolveConversationContext(
  prompt: string,
  history: ConversationHistoryItem[] = []
): { resolvedPrompt: string; topic: string; contextPreserved: boolean } {
  const p = prompt.trim();
  if (!hasContextualReference(p) || !history || history.length === 0) {
    return { resolvedPrompt: p, topic: '', contextPreserved: false };
  }

  // Traverse backward to find the relevant previous turn
  let priorTopic = '';
  let priorDetails = '';

  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];

    // 1. If item has an explicitly extracted generated subject (e.g. from an image: "cow")
    if (item.generatedSubject) {
      priorTopic = item.generatedSubject;
      break;
    }

    // 2. If it was a user prompt, extract the intent/subject
    if (item.sender === 'user') {
      const userText = item.originalPrompt || item.content;
      const imgIntent = detectImageGenerationIntent(userText);
      if (imgIntent.isImageGen && imgIntent.subject) {
        priorTopic = imgIntent.subject;
        break;
      }

      // Check if it was an engineering or specific subject prompt
      if (/water\s*pump|pumping/i.test(userText)) {
        priorTopic = 'Industrial Water Pumping System';
        priorDetails = userText;
        break;
      }
      if (/compress|air\s*audit/i.test(userText)) {
        priorTopic = 'Compressed Air System Energy Audit';
        priorDetails = userText;
        break;
      }

      // Extract subject from general user prompt
      const cleanPrompt = userText
        .replace(/^(?:generate|create|make|draw|write|calculate|analyze)\s+(?:a\s+|an\s+|the\s+)?/i, '')
        .replace(/[.!?]+$/, '')
        .trim();
      if (cleanPrompt.length > 2 && cleanPrompt.length < 80) {
        priorTopic = cleanPrompt;
        priorDetails = userText;
        break;
      }
    }

    // 3. If it's an assistant message with substantive content
    if (item.sender === 'assistant' && item.content) {
      const cowMatch = item.content.match(/\b(cow|cattle|mountain|pizza|burger|car)\b/i);
      if (cowMatch) {
        priorTopic = cowMatch[1];
        break;
      }
    }
  }

  if (!priorTopic) {
    return { resolvedPrompt: p, topic: '', contextPreserved: false };
  }

  // Capitalize topic nicely
  const cleanTopic = priorTopic.charAt(0).toUpperCase() + priorTopic.slice(1);

  // Determine requested output action
  const isPpt = /(?:powerpoint|power\s*point|\bpptx?\b|presentation|slides?\b)/i.test(p);
  const isPdf = /(?:\bpdf\b|printable\s*report)/i.test(p);
  const isDocx = /(?:\bdocx?\b|word\s*doc(?:ument)?|formal\s*report)/i.test(p);
  const isXlsx = /(?:excel|\bxlsx?\b|spreadsheet|workbook)/i.test(p);
  const isExplain = /(?:explain|describe|tell\s+me\s+more|in\s+more\s+detail|continue)/i.test(p);

  let resolvedPrompt = p;
  if (isPpt) {
    resolvedPrompt = `Create a comprehensive, professionally formatted PowerPoint presentation on ${cleanTopic} with structured slide titles, key themes, and bullet points based on our previous discussion.`;
  } else if (isPdf) {
    resolvedPrompt = `Generate a formal PDF deliverable report on ${cleanTopic} compiling the key findings, data, and recommendations from our previous discussion.${priorDetails ? ` Reference: ${priorDetails}` : ''}`;
  } else if (isDocx) {
    resolvedPrompt = `Generate a formal DOCX Word document deliverable on ${cleanTopic} compiling the key findings, data, and recommendations from our previous discussion.`;
  } else if (isXlsx) {
    resolvedPrompt = `Create an Excel workbook spreadsheet on ${cleanTopic} with data tables, metrics, and structured calculations based on our previous discussion.`;
  } else if (isExplain) {
    resolvedPrompt = `Explain ${cleanTopic} in more detail, expanding on the concepts, significance, and context from our previous discussion.`;
  } else {
    resolvedPrompt = `${p} regarding ${cleanTopic}.${priorDetails ? ` Context: ${priorDetails}` : ''}`;
  }

  return {
    resolvedPrompt,
    topic: cleanTopic,
    contextPreserved: true
  };
}

export interface TaskDecomposition {
  id: string;
  originalPrompt: string;
  domain: TaskDomain;
  operation: TaskOperation;
  primaryObjective: string;
  parameters: ExtractedParameter[];
  constraints: string[];
  requiredCalculations: string[];
  relevantDocuments: string[];
  applicableStandards: string[];
  requestedOutputFormat: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'csv' | 'markdown' | 'png' | 'code';
  targetLanguage?: 'python' | 'javascript' | 'typescript' | 'auto';
  requiresRAG: boolean;
  requiresVision: boolean;
  requiresCodeExecution: boolean;
  requiresImageGen: boolean;
  attachedFileProfiles?: {
    images: string[];
    code: string[];
    data: string[];
    documents: string[];
  };
  requiredSections: string[];
  citationRequirements: string[];
  validationCriteria: string[];
  suggestedDeliverableName: string;
  summary: string;
}

/**
 * Intelligent Task Decomposition Engine
 * Preserves the original prompt, extracts parameters, identifies standards,
 * operations, and output format requirements.
 */
export function decomposeUserTask(
  prompt: string,
  attachments: Array<{ id: string; name: string; type: string; data?: string }> = [],
  conversationHistory: ConversationHistoryItem[] = []
): TaskDecomposition {
  // Resolve conversation context if prompt contains contextual references
  const { resolvedPrompt, topic: contextTopic, contextPreserved } = resolveConversationContext(prompt, conversationHistory);
  const p = resolvedPrompt.trim();
  const lower = p.toLowerCase();
  const id = `decomp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const imgIntent = detectImageGenerationIntent(p);

  // Attachment profile classification
  const imageAttachments = attachments.filter(a =>
    ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(a.type.toLowerCase())
  );
  const codeAttachments = attachments.filter(a =>
    ['py', 'js', 'ts', 'jsx', 'tsx', 'cpp', 'c', 'java', 'rs', 'go', 'sh', 'bash', 'html', 'css', 'json', 'sql', 'zip', 'tar', 'gz'].includes(a.type.toLowerCase())
  );
  const dataAttachments = attachments.filter(a =>
    ['csv', 'tsv', 'xlsx', 'xls'].includes(a.type.toLowerCase())
  );
  const docAttachments = attachments.filter(a =>
    ['pdf', 'docx', 'doc', 'txt', 'md', 'rtf'].includes(a.type.toLowerCase())
  );

  const attachedFileProfiles = {
    images: imageAttachments.map(a => a.name),
    code: codeAttachments.map(a => a.name),
    data: dataAttachments.map(a => a.name),
    documents: docAttachments.map(a => a.name)
  };

  // Coding intent detection (catching spelling variations like fibonnacci, upto, etc.)
  const isFibonacci = /\b(?:fibonacci|fibonnacci)\b/i.test(lower);
  const isCodingRequest =
    isFibonacci ||
    codeAttachments.length > 0 ||
    /(?:write|generate|create|build|implement|develop|code|run|execute)\s+(?:a\s+|an\s+)?(?:python|javascript|typescript|js|py|c\+\+|java|rust|go|bash|shell|node)?\s*(?:program|script|code|application|app|function|algorithm|class|module|routine|solver|calculator)\b/i.test(lower) ||
    /\b(?:program|script|code)\s+(?:for|to|that)\b/i.test(lower) ||
    /\b(?:factorial|quicksort|mergesort|binary\s*search|bubble\s*sort|dijkstra|sieve\s*of\s*eratosthenes|prime\s*numbers?|linked\s*list|binary\s*tree|recursion|dynamic\s*programming)\b/i.test(lower) ||
    /\b(?:debug|fix\s*(?:bug|error|issue|syntax|traceback)|traceback|syntaxerror|typeerror|indexerror|keyerror|runtimeerror|nullpointer|exception)\b/i.test(lower) ||
    /(?:in|using|with)\s+(?:python|javascript|typescript|c\+\+|java|rust|golang|bash)\b/i.test(lower) ||
    /^(?:write|generate|implement)\s+(?:code|a\s+function|a\s+script|a\s+program)\b/i.test(lower);

  // Target programming language
  let targetLanguage: 'python' | 'javascript' | 'typescript' | 'auto' = 'python';
  if (/(?:javascript|\bjs\b|node|nodejs)/i.test(lower)) targetLanguage = 'javascript';
  else if (/(?:typescript|\bts\b)/i.test(lower)) targetLanguage = 'typescript';
  else if (/(?:python|\bpy\b)/i.test(lower)) targetLanguage = 'python';
  else if (codeAttachments.some(a => ['js', 'ts'].includes(a.type.toLowerCase()))) targetLanguage = 'javascript';

  // 1. Output Format Detection
  let requestedOutputFormat: TaskDecomposition['requestedOutputFormat'] = 'markdown';
  const isDirectInquiry = /^(?:what\s+(?:is|are)|tell\s+me\s+about|show\s+me|explain|describe|list|how\s+does|summarize|give\s+me)\s+(?:the\s+|our\s+)?.*?(?:guidelines?|policies|policy|standards?|procedures?|sop|manual|rules?|production|data|status|report|expenditure|maintenance|safety|project)/i.test(lower);

  if (isDirectInquiry) {
    requestedOutputFormat = 'markdown';
  } else if (/(?:export\s*to\s*pdf|\bpdf\b|printable\s*report)/i.test(lower)) {
    requestedOutputFormat = 'pdf';
  } else if (/(?:\bdocx?\b|word\s*doc(?:ument)?)/i.test(lower)) {
    requestedOutputFormat = 'docx';
  } else if (/(?:\bxlsx?\b|excel|spreadsheet|workbook)/i.test(lower)) {
    requestedOutputFormat = 'xlsx';
  } else if (/(?:\bpptx?\b|powerpoint|slides|presentation)/i.test(lower)) {
    requestedOutputFormat = 'pptx';
  } else if (/(?:\bcsv\b|comma\s*separated)/i.test(lower)) {
    requestedOutputFormat = 'csv';
  } else if (imgIntent.isImageGen && imageAttachments.length === 0) {
    requestedOutputFormat = 'png';
  } else if (isCodingRequest) {
    requestedOutputFormat = 'code';
  }

  // 2. Parameter Extraction
  const parameters: ExtractedParameter[] = [];
  const lines = p.split('\n');

  // Regex patterns for key engineering/numerical parameters
  const paramLineRegex = /^[\s*•\t-]*([A-Za-z0-9\s()/_.-]+?)\s*[:=]\s*([₹$€£]?\s*[\d,.]+(?:\.\d+)?)\s*([a-zA-Z0-9³/²%_°/\\-]*)/;

  for (const line of lines) {
    const match = line.match(paramLineRegex);
    if (match) {
      const rawName = match[1].trim();
      let rawVal = match[2].trim();
      let unit = match[3].trim();

      // Clean currency if attached to val
      if (rawVal.startsWith('₹') || rawVal.startsWith('$') || rawVal.startsWith('€') || rawVal.startsWith('£')) {
        const curr = rawVal[0];
        rawVal = rawVal.slice(1).trim();
        unit = unit ? `${curr}/${unit.replace(/^[\\/]/, '')}` : curr;
      }

      const numVal = parseFloat(rawVal.replace(/,/g, ''));
      if (!isNaN(numVal) && rawName.length > 2 && rawName.length < 50) {
        const rawKey = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        let key = rawKey;
        if (/flow.*rate|discharge/i.test(rawKey)) key = 'flow_rate_m3_h';
        else if (/head|tdh/i.test(rawKey)) key = 'head_m';
        else if (/density|rho/i.test(rawKey)) key = 'density_kg_m3';
        else if (/gravity/i.test(rawKey)) key = 'gravity_m_s2';
        else if (/pump.*eff/i.test(rawKey)) key = 'pump_efficiency';
        else if (/motor.*eff/i.test(rawKey)) key = 'motor_efficiency';
        else if (/operat.*duration|operat.*hour|duty.*hour/i.test(rawKey)) key = 'hours_per_day';
        else if (/tariff|electricity.*rate|power.*rate/i.test(rawKey)) key = 'tariff_inr_kwh';
        else if (/flow.*increase|sensitivity/i.test(rawKey)) key = 'flow_increase_pct';
        else if (/operating.*day|calendar.*day/i.test(rawKey)) key = 'days_per_month';

        parameters.push({
          name: rawName,
          key,
          value: numVal,
          unit: unit || '',
          raw: line.trim()
        });
      }
    }
  }

  // Catch inline patterns for any parameters not already captured by line regex
  const existingKeys = new Set(parameters.map(param => param.key));
  const inlinePatterns = [
    { key: 'flow_rate', name: 'Flow Rate', regex: /(?:water\s*flow\s*rate|flow\s*rate|discharge|\bq\b)\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*(m[3³]\/h(?:our)?|m[3³]\/s|l\/s|gpm)/i },
    { key: 'head', name: 'Total Dynamic Head', regex: /(?:total\s*dynamic\s*head|\bhead\b|\btdh\b)\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*(m(?:etres?|eters?)?|ft)?/i },
    { key: 'density', name: 'Fluid Density', regex: /(?:water\s*density|\bdensity\b|\brho\b)\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*(kg\/m[3³])/i },
    { key: 'gravity', name: 'Gravitational Acceleration', regex: /(?:gravitational\s*acceleration|\bgravity\b|\bg\b)\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*(m\/s[2²])/i },
    { key: 'pump_efficiency', name: 'Pump Efficiency', regex: /pump\s*efficiency\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*%/i },
    { key: 'motor_efficiency', name: 'Motor Efficiency', regex: /motor\s*efficiency\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*%/i },
    { key: 'power', name: 'Power Consumption', regex: /(?:power\s*consumption|\bpower\b)\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*(kw|mw|hp)/i },
    { key: 'tariff', name: 'Electricity Tariff', regex: /(?:electricity\s*tariff|\btariff\b|power\s*cost|\brate\b)\s*(?:of|is|[:=])?\s*[₹$€£]?\s*(\d+(?:\.\d+)?)\s*\/?\s*(kwh|unit)/i },
    { key: 'duration', name: 'Operating Duration', regex: /(?:operating\s*duration|\bduration\b|operating\s*hours)\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*(hours?\/day|h\/d|hrs?)/i },
    { key: 'flow_increase_pct', name: 'Flow Rate Increase', regex: /(?:flow\s*(?:rate)?\s*increase|increase\s*(?:in\s*)?flow(?:\s*rate)?|sensitivity(?:\s*scenario)?)\s*(?:of|by|to|[:=])?\s*(\d+(?:\.\d+)?)\s*%/i },
    { key: 'days_per_month', name: 'Operating Days', regex: /(?:assume\s*)?(\d+)\s*(?:operating\s*)?days(?:\s*\/\s*month)?/i }
  ];

  for (const pat of inlinePatterns) {
    if (!existingKeys.has(pat.key)) {
      const m = p.match(pat.regex);
      if (m) {
        parameters.push({
          name: pat.name,
          key: pat.key,
          value: parseFloat(m[1]),
          unit: m[2] || '',
          raw: m[0]
        });
        existingKeys.add(pat.key);
      }
    }
  }

  // 3. Required Calculations & Operations
  const requiredCalculations: string[] = [];
  const taskRegex = /^\s*(?:\d+[.)]|\*|-)\s+(.*(?:calculate|compute|determine|evaluate|recommend|estimate|size|solve|explain|verify).*)/gim;
  let taskMatch;
  while ((taskMatch = taskRegex.exec(p)) !== null) {
    const task = taskMatch[1].trim();
    if (task && !requiredCalculations.includes(task)) {
      requiredCalculations.push(task);
    }
  }

  // Fallback if no explicit task list
  if (requiredCalculations.length === 0) {
    if (lower.includes('hydraulic power') || lower.includes('shaft power') || lower.includes('motor sizing')) {
      requiredCalculations.push('Calculate hydraulic power required (P_hyd = rho * g * Q * H)');
      requiredCalculations.push('Calculate shaft power required accounting for pump efficiency (P_shaft = P_hyd / eta_pump)');
      requiredCalculations.push('Calculate electrical input power accounting for motor efficiency (P_elec = P_shaft / eta_motor)');
      requiredCalculations.push('Recommend appropriate standard motor rating with safety margin');
      requiredCalculations.push('Calculate daily and monthly energy consumption and cost');
      requiredCalculations.push('Evaluate flow rate sensitivity (+20% scenario)');
      requiredCalculations.push('Analyze Best Efficiency Point (BEP) operating dynamics');
    }
  }

  // 4. Required Report Sections
  const requiredSections: string[] = [];
  const sectionKeywords = [
    'Executive Summary',
    'Input Design Parameters Table',
    'Step-by-Step Engineering Calculations',
    'Motor Selection Recommendation',
    'Operational Cost Analysis',
    'Best Efficiency Point (BEP) Analysis',
    'Sensitivity & Scenario Analysis',
    'Standards & Guidelines Citations',
    'Summary Table of Computed Results'
  ];

  for (const sk of sectionKeywords) {
    const re = new RegExp(sk.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&').replace(/\s+/g, '[\\s_-]+'), 'i');
    if (re.test(p) || p.length > 100) {
      requiredSections.push(sk);
    }
  }
  if (requiredSections.length === 0) {
    requiredSections.push('Executive Summary', 'Design Parameters', 'Methodology & Calculations', 'Equipment Recommendations', 'Summary Results');
  }

  // 5. Applicable Standards & Citations
  const applicableStandards: string[] = [];
  if (lower.includes('pump') || lower.includes('head') || lower.includes('flow rate')) {
    applicableStandards.push('ISO 9906:2012 (Rotodynamic pumps — Hydraulic performance acceptance tests)');
    applicableStandards.push('HI 14.3 / 9.6.1 (Hydraulic Institute Standards for Centrifugal Pumps & Operating Margins)');
    applicableStandards.push('IEC 60034-1:2022 (Rotating electrical machines — Rating and performance)');
    applicableStandards.push('ENG-STD-002: Technical Report & Engineering Document Guideline');
    applicableStandards.push('DOC-STD-001: Controlled PDF & Document Creation Guideline');
  } else if (lower.includes('compress') || lower.includes('leakage') || lower.includes('air')) {
    applicableStandards.push('ISO 11011:2013 (Compressed air — Energy efficiency — Assessment methodology)');
    applicableStandards.push('CAGI Compressed Air & Gas Handbook (6th Edition)');
    applicableStandards.push('ENG-STD-002: Technical Report & Engineering Document Guideline');
  } else {
    applicableStandards.push('ENG-STD-002: Technical Report & Engineering Document Guideline');
    applicableStandards.push('DOC-STD-001: Controlled PDF & Document Creation Guideline');
  }

  // Check indexed documents in knowledge base
  const relevantDocuments: string[] = [];
  try {
    const docsPath = path.resolve(process.cwd(), 'data', 'knowledge', 'documents.json');
    if (fs.existsSync(docsPath)) {
      const storedDocs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));
      if (Array.isArray(storedDocs)) {
        for (const sd of storedDocs) {
          relevantDocuments.push(sd.name);
        }
      }
    }
  } catch {
    // ignore
  }

  // 6. Domain & Fine-Grained Operation Classification
  let domain: TaskDomain = 'general_qa';
  let operation: TaskOperation = 'general_qa';

  const hasFluidOrMechanical = /(?:pump|flow\s*rate|dynamic\s*head|compressor|nm3|kw|kwh|pressure|bar|efficiency|pipe|hydraulic|shaft\s*power)/i.test(lower);

  // 1. Image generation (diffusion)
  if (imgIntent.isImageGen && imageAttachments.length === 0 && !/(?:explain|summarize|ocr|read|inspect)\s+(?:this|the)?\s*(?:image|diagram|chart|picture)/i.test(lower)) {
    domain = 'image_generation';
    operation = 'image_generation';
  }
  // 2. Multimodal Vision / OCR
  else if (
    imageAttachments.length > 0 ||
    (/(?:image|picture|photo|diagram|drawing|chart|flowchart|layout|schematic|pipeline)/i.test(lower) &&
      /(?:summarize|explain|describe|analyze|analyse|inspect|examine|read|understand|interpret|what\s+is\s+in|what\s+does.*show|tell\s+me\s+about|break\s+down|extract\s+text|ocr|read\s+text|visible\s+text)/i.test(lower))
  ) {
    domain = 'vision_analysis';
    if (/(?:extract\s+text|ocr|read\s+text|visible\s+text|labels|symbols|transcribe)/i.test(lower)) {
      operation = 'vision_ocr';
    } else {
      operation = 'vision_analysis';
    }
  }
  // 3. Programming & Code (Generation, Debugging, Scripting)
  else if (isCodingRequest) {
    domain = 'programming';
    if (/(?:debug|fix|patch|error|traceback|syntaxerror|typeerror|bug|issue|why\s+does\s+(?:this|my\s+code)\s+fail)/i.test(lower)) {
      operation = 'code_debugging';
    } else {
      operation = 'code_generation';
    }
  }
  // 4. Engineering calculations (Water pump, Compressed Air, Thermodynamics)
  else if (/(?:water\s*pump|pumping|flow\s*rate|dynamic\s*head|\btdh\b|hydraulic\s*power|shaft\s*power)/i.test(lower)) {
    domain = 'engineering_calculation';
    operation = 'engineering_pump';
  } else if (/(?:compress|air\s*audit|leakage|pneumatic|cagi|nm3\/h)/i.test(lower)) {
    domain = 'engineering_calculation';
    operation = 'engineering_compressed_air';
  } else if (parameters.length >= 2 && /(?:power|kw|kwh|pressure|bar|efficiency|flow|temperature)/i.test(lower)) {
    domain = 'engineering_calculation';
    operation = 'engineering_general';
  }
  // 5. Math Problem Solving
  else if (/(?:solve\s+(?:the\s+)?equation|quadratic|calculus|integral|derivative|matrix|algebra|solve\s+for\s+[a-z])/i.test(lower)) {
    domain = 'engineering_calculation';
    operation = 'math_problem';
  }
  // 6. CSV Data Analysis
  else if (dataAttachments.length > 0 || (/(?:\bcsv\b|dataset|tabular\s*data|sales|revenue|expenses)/i.test(lower) && /(?:analyze|analysis|calculate|find|compute|stats|summary|average)/i.test(lower))) {
    domain = 'data_analysis';
    operation = 'data_csv_analysis';
  }
  // 7. Deliverables: PPTX or XLSX
  else if (requestedOutputFormat === 'pptx') {
    domain = 'data_analysis';
    operation = 'deliverable_pptx';
  } else if (requestedOutputFormat === 'xlsx' || /(?:excel|spreadsheet|workbook|kpi\s*dashboard)/i.test(lower)) {
    domain = 'data_analysis';
    operation = 'deliverable_xlsx';
  }
  // 8. Document Analysis: Compliance vs Summary
  else if (
    isDirectInquiry ||
    /(?:knowledge\s*base|uploaded\s*documents?|reference\s*documents?|guidelines?|sop|standard|compliance|iso\s*\d+|iec\s*\d+|policy|policies|corporate\s*standard)/i.test(lower)
  ) {
    domain = 'document_analysis';
    operation = 'document_compliance';
  } else if (
    docAttachments.length > 0 ||
    /(?:summarize|summary|review|abstract|bullet\s*points)\b.*?\b(?:pdf|document|paper|report|file|article)/i.test(lower)
  ) {
    domain = 'document_analysis';
    operation = 'document_summary';
  }
  // 9. General QA
  else {
    domain = 'general_qa';
    operation = 'general_qa';
  }

  // Capability Requirements (strict - no unnecessary RAG or models)
  const requiresRAG =
    operation === 'document_compliance' ||
    operation === 'document_summary' ||
    isDirectInquiry ||
    operation === 'deliverable_pptx' ||
    /(?:knowledge\s*base|uploaded\s*documents?|reference\s*documents?|guidelines?|sop|per\s+our\s+manual|standards?|policy|policies|company|internal|production\s*data|project\s*status|maintenance|safety|expenditure|report)/i.test(lower) ||
    (domain === 'engineering_calculation' && requestedOutputFormat === 'pdf');

  const requiresVision = domain === 'vision_analysis' || imageAttachments.length > 0;
  const requiresCodeExecution = domain === 'programming' || operation === 'data_csv_analysis';
  const requiresImageGen = operation === 'image_generation';

  // 7. Suggested Deliverable Filename
  let suggestedDeliverableName = 'LUMI_Technical_Report.pdf';
  const cleanTopicForFile = contextTopic ? contextTopic.replace(/[^a-zA-Z0-9_-]+/g, '_') : '';
  if (isFibonacci) {
    suggestedDeliverableName = 'fibonacci_12_terms.py';
  } else if (domain === 'programming') {
    const rawSubj = p
      .replace(/^(?:generate|write|create|build|implement|debug|fix)\s+(?:a\s+|an\s+)?(?:python|javascript|script|program|code\s+for|function\s+for)?\s*/i, '')
      .replace(/[.!?]+$/, '')
      .trim()
      .slice(0, 30)
      .replace(/[^a-zA-Z0-9_-]+/g, '_');
    const ext = targetLanguage === 'javascript' ? 'js' : targetLanguage === 'typescript' ? 'ts' : 'py';
    suggestedDeliverableName = `${rawSubj || 'program'}.${ext}`;
  } else if (lower.includes('water pump') || lower.includes('pumping')) {
    suggestedDeliverableName = requestedOutputFormat === 'docx'
      ? 'Industrial_Water_Pumping_System_Performance_Report.docx'
      : 'Industrial_Water_Pumping_System_Performance_Report.pdf';
  } else if (lower.includes('compress') || lower.includes('air audit')) {
    suggestedDeliverableName = 'Compressed_Air_Engineering_Audit_Report.pdf';
  } else if (requestedOutputFormat === 'pptx') {
    suggestedDeliverableName = cleanTopicForFile ? `${cleanTopicForFile}_Presentation.pptx` : 'Engineering_Review_Presentation.pptx';
  } else if (requestedOutputFormat === 'xlsx') {
    suggestedDeliverableName = cleanTopicForFile ? `${cleanTopicForFile}_Analysis.xlsx` : 'Engineering_Analysis_Workbook.xlsx';
  } else if (requestedOutputFormat === 'docx') {
    suggestedDeliverableName = cleanTopicForFile ? `${cleanTopicForFile}_Report.docx` : 'Technical_Evaluation_Report.docx';
  } else if (requestedOutputFormat === 'pdf') {
    suggestedDeliverableName = cleanTopicForFile ? `${cleanTopicForFile}_Report.pdf` : 'LUMI_Technical_Report.pdf';
  } else if (requestedOutputFormat === 'csv') {
    suggestedDeliverableName = 'Dataset_Export.csv';
  } else if (requestedOutputFormat === 'png') {
    suggestedDeliverableName = 'Synthesized_Asset.png';
  }

  // 8. Primary Objective Formulation (Dynamic & Task-Specific)
  let primaryObjective = '';
  if (operation === 'code_generation') {
    if (isFibonacci) {
      const termMatch = lower.match(/(?:upto|up\s*to)?\s*(\d+)\s*terms?/i) || lower.match(/(\d+)\s*(?:numbers?|elements?|values?|terms?)/i);
      const termCount = termMatch ? termMatch[1] : '12';
      primaryObjective = `Generate and verify a working program that prints the first ${termCount} terms of the Fibonacci sequence.`;
    } else {
      const cleanSubj = p
        .replace(/^(?:generate|write|create|build|implement)\s+(?:a\s+|an\s+)?(?:python|javascript|script|program|code\s+for|function\s+for)?\s*/i, '')
        .replace(/[.!?]+$/, '')
        .trim();
      primaryObjective = `Generate and verify a working ${targetLanguage} program for ${cleanSubj || 'the requested computational task'}.`;
    }
  } else if (operation === 'code_debugging') {
    const fileHint = codeAttachments[0]?.name ? ` in ${codeAttachments[0].name}` : '';
    primaryObjective = `Analyze source code${fileHint}, isolate syntax/runtime defects, apply verified corrections, and validate execution.`;
  } else if (operation === 'vision_ocr') {
    primaryObjective = `Extract and transcribe all visible textual annotations, labels, and numeric parameters from image.`;
  } else if (operation === 'vision_analysis') {
    primaryObjective = `Inspect visual diagram/image elements, extract visible labels and technical annotations using multimodal vision agent, and synthesize grounded explanation.`;
  } else if (operation === 'engineering_pump') {
    const flowParam = parameters.find(param => param.key.includes('flow'));
    const headParam = parameters.find(param => param.key.includes('head'));
    const contextStr = flowParam && headParam ? ` (${flowParam.value} ${flowParam.unit}, ${headParam.value} ${headParam.unit})` : '';
    primaryObjective = `Engineering sizing and hydrodynamic analysis for industrial water pumping system${contextStr} to evaluate motor safety margins and operating costs.`;
  } else if (operation === 'engineering_compressed_air') {
    primaryObjective = `Thermodynamic and electrical energy audit for compressed-air station to evaluate SEC and leakage reduction scenarios.`;
  } else if (operation === 'engineering_general') {
    primaryObjective = `Deterministic physical calculations and verified engineering evaluation.`;
  } else if (operation === 'math_problem') {
    primaryObjective = `Deterministic mathematical solution with step-by-step algebraic derivations.`;
  } else if (operation === 'data_csv_analysis') {
    primaryObjective = `Statistical distribution analysis and analytical metric synthesis.`;
  } else if (operation === 'deliverable_pptx') {
    primaryObjective = `Presentation slide deck for ${contextTopic || 'the requested topic'} with thematic structure and native formatting.`;
  } else if (operation === 'deliverable_xlsx') {
    primaryObjective = `Excel workbook for ${contextTopic || 'the requested topic'} with data tables and verified formulas.`;
  } else if (operation === 'document_summary') {
    primaryObjective = `Structured executive summary extracting core principles and key findings.`;
  } else if (operation === 'document_compliance') {
    primaryObjective = isDirectInquiry
      ? `Retrieve and analyze official organizational guidelines and standards for ${contextTopic || 'the requested subject'}.`
      : `Grounded technical evaluation citing guidelines and compliance evidence.`;
  } else if (operation === 'image_generation') {
    primaryObjective = `Synthesize high-fidelity visual asset using authentic local diffusion pipeline.`;
  } else {
    primaryObjective = `Synthesize clear, direct, and factual response addressing user inquiry.`;
  }

  // 9. Validation Criteria
  const validationCriteria: string[] = [
    'All numerical input parameters parsed and verified with explicit units.',
    'Formulas derived deterministically from governing physics/standards.',
    'Intermediate calculation steps and unit conversions explicitly shown.',
    'Output document verified non-empty (>1500 chars) with complete required sections.'
  ];

  const citationRequirements: string[] = [
    'Ground methodology in verified knowledge base documents where available.',
    'Cite governing industry standards (e.g. ISO 9906, HI 14.3, IEC 60034-1).',
    'Report exact document titles, sections, and relevance.'
  ];

  const summary = `Primary Objective: ${primaryObjective}\nDomain: ${domain.replace('_', ' ').toUpperCase()} | Operation: ${operation.toUpperCase()} | Format: ${requestedOutputFormat.toUpperCase()}`;

  return {
    id,
    originalPrompt: p,
    domain,
    operation,
    primaryObjective,
    parameters,
    constraints: [
      'Zero hallucination in numerical calculations (must use deterministic mathematical evaluation).',
      'Preserve unit consistency across all equations.',
      'Mandatory post-generation deliverable completeness verification.'
    ],
    requiredCalculations,
    relevantDocuments,
    applicableStandards,
    requestedOutputFormat,
    targetLanguage,
    requiresRAG,
    requiresVision,
    requiresCodeExecution,
    requiresImageGen,
    attachedFileProfiles,
    requiredSections,
    citationRequirements,
    validationCriteria,
    suggestedDeliverableName,
    summary
  };
}

export interface StructuredTaskContext {
  originalPrompt: string;
  extractedParameters: Record<string, { value: number | string; unit: string; raw: string }>;
  assumptions: string[];
  requestedCalculations: string[];
  outputFormat: string;
  requiredSections: string[];
  uploadedFiles: string[];
  retrievedEvidence: Array<{ id: string; file: string; section: string; snippet: string; score: number }>;
  discrepancies: string[];
}

export function extractEngineeringPumpParameters(
  prompt: string,
  existingParams: ExtractedParameter[] = []
): {
  flow_rate_m3_h: number;
  head_m: number;
  density_kg_m3: number;
  gravity_m_s2: number;
  pump_efficiency: number;
  motor_efficiency: number;
  hours_per_day: number;
  days_per_month: number;
  tariff_inr_kwh: number;
  flow_increase_pct: number;
} {
  const p = prompt;
  const paramMap = new Map<string, number>();

  for (const ep of existingParams) {
    if (typeof ep.value === 'number' && !isNaN(ep.value)) {
      paramMap.set(ep.key, ep.value);
    }
  }

  // 1. Flow rate
  let flowRate = paramMap.get('water_flow_rate') ?? paramMap.get('flow_rate_m3_h') ?? paramMap.get('flow_rate') ?? paramMap.get('q');
  if (flowRate === undefined) {
    const m = p.match(/(?:water\s*flow\s*rate|flow\s*rate|discharge|\bq\b)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:m[3³]\/h|m\^3\/h)/i);
    if (m) flowRate = parseFloat(m[1]);
  }

  // 2. Head
  let head = paramMap.get('total_dynamic_head') ?? paramMap.get('head_m') ?? paramMap.get('head') ?? paramMap.get('tdh');
  if (head === undefined) {
    const m = p.match(/(?:total\s*dynamic\s*head|\bhead\b|\btdh\b)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:m(?:etres?|eters?)?)/i);
    if (m) head = parseFloat(m[1]);
  }

  // 3. Density
  let density = paramMap.get('water_density') ?? paramMap.get('density_kg_m3') ?? paramMap.get('density') ?? paramMap.get('rho');
  if (density === undefined) {
    const m = p.match(/(?:water\s*density|\bdensity\b|\brho\b)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:kg\/m[3³]|kg\/m\^3)/i);
    if (m) density = parseFloat(m[1]);
  }

  // 4. Gravity
  let gravity = paramMap.get('gravitational_acceleration') ?? paramMap.get('gravity_m_s2') ?? paramMap.get('gravity') ?? paramMap.get('g');
  if (gravity === undefined) {
    const m = p.match(/(?:gravitational\s*acceleration|\bgravity\b|\bg\b)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:m\/s[2²]|m\/s\^2)/i);
    if (m) gravity = parseFloat(m[1]);
  }

  // 5. Pump efficiency
  let pumpEff = paramMap.get('pump_efficiency') ?? paramMap.get('pump_eff');
  if (pumpEff === undefined) {
    const m = p.match(/pump\s*efficiency\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/i);
    if (m) pumpEff = parseFloat(m[1]);
  }

  // 6. Motor efficiency
  let motorEff = paramMap.get('motor_efficiency') ?? paramMap.get('motor_eff');
  if (motorEff === undefined) {
    const m = p.match(/motor\s*efficiency\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/i);
    if (m) motorEff = parseFloat(m[1]);
  }

  // 7. Operating hours
  let hours = paramMap.get('operating_duration') ?? paramMap.get('hours_per_day') ?? paramMap.get('operating_hours') ?? paramMap.get('duration');
  if (hours === undefined) {
    const m = p.match(/(?:operating\s*duration|\boperating\s*hours|\bduration\b)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:hours?\/day|h\/d|hrs?)/i);
    if (m) hours = parseFloat(m[1]);
  }

  // 8. Operating days
  let days = paramMap.get('operating_days') ?? paramMap.get('days_per_month') ?? paramMap.get('operating_calendar');
  if (days === undefined) {
    const m = p.match(/(?:assume\s*)?(\d+)\s*(?:operating\s*)?days(?:\s*\/\s*month)?/i);
    if (m) days = parseFloat(m[1]);
  }

  // 9. Tariff
  let tariff = paramMap.get('electricity_tariff') ?? paramMap.get('tariff_inr_kwh') ?? paramMap.get('tariff') ?? paramMap.get('power_tariff');
  if (tariff === undefined) {
    const m = p.match(/(?:electricity\s*tariff|\btariff\b|power\s*cost)\s*[:=]?\s*[₹$€£]?\s*(\d+(?:\.\d+)?)\s*\/?\s*(?:kwh|unit)/i);
    if (m) tariff = parseFloat(m[1]);
  }

  // 10. Flow increase percentage
  let flowIncrease = paramMap.get('flow_increase_pct') ?? paramMap.get('flow_rate_increase') ?? paramMap.get('flow_increase');
  if (flowIncrease === undefined) {
    const m = p.match(/(?:flow\s*(?:rate)?\s*increase|increase\s*(?:in\s*)?flow(?:\s*rate)?|sensitivity(?:\s*scenario)?)\s*(?:of|by|to|[:=])?\s*(\d+(?:\.\d+)?)\s*%/i)
      || p.match(/(\d+(?:\.\d+)?)\s*%\s*(?:flow\s*(?:rate)?\s*increase|increase\s*(?:in\s*)?flow)/i);
    if (m) flowIncrease = parseFloat(m[1]);
  }

  return {
    flow_rate_m3_h: flowRate ?? 25.0,
    head_m: head ?? 35.0,
    density_kg_m3: density ?? 1000.0,
    gravity_m_s2: gravity ?? 9.81,
    pump_efficiency: pumpEff ?? 78.0,
    motor_efficiency: motorEff ?? 90.0,
    hours_per_day: hours ?? 12.0,
    days_per_month: days ?? 30.0,
    tariff_inr_kwh: tariff ?? 8.0,
    flow_increase_pct: flowIncrease ?? 20.0
  };
}

export function buildStructuredTaskContext(
  prompt: string,
  decomp: TaskDecomposition,
  retrievedEvidence: Array<{ id: string; file: string; section: string; snippet: string; score: number }> = [],
  uploadedFiles: string[] = []
): StructuredTaskContext {
  const extractedParams: Record<string, { value: number | string; unit: string; raw: string }> = {};
  for (const p of decomp.parameters) {
    extractedParams[p.key] = {
      value: p.value,
      unit: p.unit,
      raw: p.raw
    };
  }

  const discrepancies: string[] = [];

  // Cross-compare prompt numbers with extracted parameters
  const numbersInPrompt = Array.from(prompt.matchAll(/\b(\d+(?:\.\d+)?)\b/g)).map(m => parseFloat(m[1]));
  const extractedValues = decomp.parameters.map(p => typeof p.value === 'number' ? p.value : parseFloat(String(p.value))).filter(n => !isNaN(n));

  for (const ev of extractedValues) {
    if (!numbersInPrompt.includes(ev)) {
      discrepancies.push(`Extracted parameter value ${ev} does not appear directly in original user prompt.`);
    }
  }

  return {
    originalPrompt: prompt,
    extractedParameters: extractedParams,
    assumptions: [
      'Operating temperature: standard 20°C ambient fluid conditions.',
      'Pipe friction losses incorporated in Total Dynamic Head (TDH).',
      'Continuous motor load rating per IEC 60034-1 duty class S1.'
    ],
    requestedCalculations: decomp.requiredCalculations,
    outputFormat: decomp.requestedOutputFormat,
    requiredSections: decomp.requiredSections,
    uploadedFiles,
    retrievedEvidence,
    discrepancies
  };
}
