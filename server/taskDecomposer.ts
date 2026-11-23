import fs from 'fs';
import path from 'path';

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
  | 'image_generation';

export interface TaskDecomposition {
  id: string;
  originalPrompt: string;
  domain: TaskDomain;
  primaryObjective: string;
  parameters: ExtractedParameter[];
  constraints: string[];
  requiredCalculations: string[];
  relevantDocuments: string[];
  applicableStandards: string[];
  requestedOutputFormat: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'csv' | 'markdown' | 'png' | 'code';
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
  attachments: Array<{ id: string; name: string; type: string; data?: string }> = []
): TaskDecomposition {
  const p = prompt.trim();
  const lower = p.toLowerCase();
  const id = `decomp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // 1. Output Format Detection
  let requestedOutputFormat: TaskDecomposition['requestedOutputFormat'] = 'markdown';
  if (/(?:export\s*to\s*pdf|\bpdf\b|printable\s*report)/i.test(lower)) {
    requestedOutputFormat = 'pdf';
  } else if (/(?:\bdocx?\b|word\s*doc(?:ument)?)/i.test(lower)) {
    requestedOutputFormat = 'docx';
  } else if (/(?:\bxlsx?\b|excel|spreadsheet|workbook)/i.test(lower)) {
    requestedOutputFormat = 'xlsx';
  } else if (/(?:\bpptx?\b|powerpoint|slides|presentation)/i.test(lower)) {
    requestedOutputFormat = 'pptx';
  } else if (/(?:\bcsv\b|comma\s*separated)/i.test(lower)) {
    requestedOutputFormat = 'csv';
  } else if (/(?:generate|create|render)\s+(?:an?\s+)?(?:image|picture|photo|illustration|graphic)/i.test(lower)) {
    requestedOutputFormat = 'png';
  } else if (/(?:write|generate|implement)\s+(?:python|javascript|script|code|program|algorithm)/i.test(lower)) {
    requestedOutputFormat = 'code';
  }

  // 2. Parameter Extraction
  const parameters: ExtractedParameter[] = [];
  const lines = p.split('\n');

  // Regex patterns for key engineering/numerical parameters
  const paramLineRegex = /^[\s*-•]*([A-Za-z0-9\s()/_.-]+?)\s*[:=]\s*([₹$€£]?\s*[\d,.]+(?:\.\d+)?)\s*([a-zA-Z0-9³/²%_°/\\-]*)/;

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
        const key = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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

  // Catch inline patterns if lines didn't capture (e.g. "flow rate of 25 m3/h", "head of 35 m")
  if (parameters.length === 0) {
    const inlinePatterns = [
      { key: 'flow_rate', name: 'Flow Rate', regex: /(?:water\s*flow\s*rate|flow\s*rate|discharge|\bq\b)\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*(m[3³]\/h(?:our)?|m[3³]\/s|l\/s|gpm)/i },
      { key: 'head', name: 'Total Dynamic Head', regex: /(?:total\s*dynamic\s*head|\bhead\b|\btdh\b)\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*(m(?:etres?|eters?)?|ft)?/i },
      { key: 'density', name: 'Fluid Density', regex: /(?:water\s*density|\bdensity\b|\brho\b)\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*(kg\/m[3³])/i },
      { key: 'gravity', name: 'Gravitational Acceleration', regex: /(?:gravitational\s*acceleration|\bgravity\b|\bg\b)\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*(m\/s[2²])/i },
      { key: 'pump_efficiency', name: 'Pump Efficiency', regex: /pump\s*efficiency\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*%/i },
      { key: 'motor_efficiency', name: 'Motor Efficiency', regex: /motor\s*efficiency\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*%/i },
      { key: 'power', name: 'Power Consumption', regex: /(?:power\s*consumption|\bpower\b)\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*(kw|mw|hp)/i },
      { key: 'tariff', name: 'Electricity Tariff', regex: /(?:electricity\s*tariff|\btariff\b|power\s*cost|\brate\b)\s*(?:of|is|[:=])?\s*[₹$€£]?\s*(\d+(?:\.\d+)?)\s*\/?\s*(kwh|unit)/i },
      { key: 'duration', name: 'Operating Duration', regex: /(?:operating\s*duration|\bduration\b|operating\s*hours)\s*(?:of|is|[:=])?\s*(\d+(?:\.\d+)?)\s*(hours?\/day|h\/d|hrs?)/i }
    ];

    for (const pat of inlinePatterns) {
      const m = p.match(pat.regex);
      if (m) {
        parameters.push({
          name: pat.name,
          key: pat.key,
          value: parseFloat(m[1]),
          unit: m[2] || '',
          raw: m[0]
        });
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

  // 6. Domain Classification
  let domain: TaskDomain = 'general_qa';
  const hasFluidOrMechanical = /(?:pump|flow\s*rate|dynamic\s*head|compressor|nm3|kw|kwh|pressure|bar|efficiency|pipe|hydraulic|shaft\s*power)/i.test(lower);
  const hasProgramming = /(?:python|javascript|typescript|function|script|class|api|endpoint|debug|syntax|algorithm)/i.test(lower);
  const hasSpreadsheet = /(?:excel|xlsx|csv|spreadsheet|tabular|budget|expenses|columns|rows)/i.test(lower);
  const hasImage = /(?:image|illustration|photo|draw|render|flux|picture)/i.test(lower);
  const hasDocAnalysis =
    /(?:analyze|review|extract|summarize|read|search|query|check|cite|retrieve|inspect|examine)\b.*?\b(?:document|guideline|standard|manual|specification|knowledge\s*base|sop|paper|pdf|policy|policies)/i.test(lower) ||
    /(?:knowledge\s*base|uploaded\s*documents?|reference\s*documents?|document\s*control|engineering\s*report\s*guidelines?)/i.test(lower) ||
    attachments.length > 0;

  if (hasImage && !hasFluidOrMechanical) {
    domain = 'image_generation';
  } else if (hasFluidOrMechanical || parameters.length >= 2) {
    domain = 'engineering_calculation';
  } else if (hasSpreadsheet) {
    domain = 'data_analysis';
  } else if (hasProgramming) {
    domain = 'programming';
  } else if (hasDocAnalysis) {
    domain = 'document_analysis';
  }

  // 7. Suggested Deliverable Filename
  let suggestedDeliverableName = 'LUMI_Technical_Report.pdf';
  if (lower.includes('water pump') || lower.includes('pumping')) {
    suggestedDeliverableName = requestedOutputFormat === 'docx'
      ? 'Industrial_Water_Pumping_System_Performance_Report.docx'
      : 'Industrial_Water_Pumping_System_Performance_Report.pdf';
  } else if (lower.includes('compress') || lower.includes('air audit')) {
    suggestedDeliverableName = 'Compressed_Air_Engineering_Audit_Report.pdf';
  } else if (requestedOutputFormat === 'xlsx') {
    suggestedDeliverableName = 'Engineering_Analysis_Workbook.xlsx';
  } else if (requestedOutputFormat === 'docx') {
    suggestedDeliverableName = 'Technical_Evaluation_Report.docx';
  } else if (requestedOutputFormat === 'pptx') {
    suggestedDeliverableName = 'Engineering_Review_Presentation.pptx';
  } else if (requestedOutputFormat === 'csv') {
    suggestedDeliverableName = 'Dataset_Export.csv';
  } else if (requestedOutputFormat === 'png') {
    suggestedDeliverableName = 'Synthesized_Asset.png';
  }

  // 8. Primary Objective Formulation
  let primaryObjective = '';
  if (domain === 'engineering_calculation') {
    const flowParam = parameters.find(p => p.key.includes('flow'));
    const headParam = parameters.find(p => p.key.includes('head'));
    const contextStr = flowParam && headParam ? ` (${flowParam.value} ${flowParam.unit}, ${headParam.value} ${headParam.unit})` : '';
    primaryObjective = `Execute comprehensive engineering analysis for ${lower.includes('pump') ? 'industrial water pumping system' : 'mechanical/energy system'}${contextStr}: evaluate governing formulas, compute power requirements, size electrical drives with verified safety margins, project operating costs, and generate formal ${requestedOutputFormat.toUpperCase()} deliverable.`;
  } else if (domain === 'data_analysis') {
    primaryObjective = `Perform quantitative data modeling, calculate statistical distributions, and assemble formatted ${requestedOutputFormat.toUpperCase()} deliverable.`;
  } else if (domain === 'programming') {
    primaryObjective = `Synthesize robust code solution, execute sandboxed verification tests, and provide verified operational implementation.`;
  } else if (domain === 'document_analysis') {
    primaryObjective = `Ingest knowledge artifacts, extract grounded technical evidence, and synthesize cited findings per organizational guidelines.`;
  } else if (domain === 'image_generation') {
    primaryObjective = `Synthesize high-fidelity visual asset using authentic local diffusion pipeline.`;
  } else {
    primaryObjective = `Execute structured multi-agent synthesis for user query with transparent evidence provenance.`;
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

  const summary = `Primary Objective: ${primaryObjective}\nDomain: ${domain.replace('_', ' ').toUpperCase()} | Format: ${requestedOutputFormat.toUpperCase()} | Parameters: ${parameters.length} extracted | Standards: ${applicableStandards.length} referenced`;

  return {
    id,
    originalPrompt: p,
    domain,
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
    requiredSections,
    citationRequirements,
    validationCriteria,
    suggestedDeliverableName,
    summary
  };
}
