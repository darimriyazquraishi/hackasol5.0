import { TaskDecomposition } from './taskDecomposer';
import { AgentArchetype, LumiWorkflowStep, LumiWorkplan } from '../src/types';

export interface ModelRegistryConfig {
  vision: string;
  image_generation: string;
  math_code: string;
  reasoning: string;
  coder: string;
}

const DEFAULT_MODELS: ModelRegistryConfig = {
  vision: 'moondream:latest',
  image_generation: 'flux1-schnell',
  math_code: 'qwen2.5-coder:1.5b',
  reasoning: 'qwen2.5:1.5b',
  coder: 'qwen2.5-coder:1.5b'
};

/**
 * Generate Dynamic, Capability-Routed Workplan
 * Adapts execution stages, selected models, and deliverables to the specific task operation.
 */
export function generateDynamicWorkplan(
  decomp: TaskDecomposition,
  installedModels: Array<{ name: string; size: string }> = []
): LumiWorkplan {
  const models = { ...DEFAULT_MODELS };
  if (installedModels.length > 0) {
    const installedNames = installedModels.map(m => m.name);
    const rMatch = installedNames.find(n => /qwen2\.5:1\.5b|qwen2\.5|llama|mistral/i.test(n));
    if (rMatch) models.reasoning = rMatch;
    const cMatch = installedNames.find(n => /qwen2\.5-coder|coder|code/i.test(n));
    if (cMatch) {
      models.coder = cMatch;
      models.math_code = cMatch;
    }
    const vMatch = installedNames.find(n => /moondream|vision|vl/i.test(n));
    if (vMatch) models.vision = vMatch;
  }

  const steps: LumiWorkflowStep[] = [];
  const requiredCapabilities: string[] = [];
  const selectedAgents: AgentArchetype[] = [];
  const selectedModels: Record<string, string> = {};
  const expectedDeliverables: string[] = [];

  let stepCounter = 1;
  const lower = decomp.originalPrompt.toLowerCase();

  // -------------------------------------------------------------------------
  // 1. CODE GENERATION (e.g. Fibonacci, algorithms, scripts)
  // -------------------------------------------------------------------------
  if (decomp.operation === 'code_generation') {
    requiredCapabilities.push('Coding', 'Execution', 'Validation');
    selectedAgents.push('math_code');
    selectedModels['math_code'] = models.coder;
    selectedModels['execution'] = 'python-sandbox-runtime';

    const isFibonacci = /fibonacci|fibonnacci/i.test(lower);
    const termMatch = lower.match(/(?:upto|up\s*to)?\s*(\d+)\s*terms?/i);
    const termCount = termMatch ? termMatch[1] : '12';

    // Step 1: Code Generation
    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Code Generation',
      agent: 'math_code',
      model: models.coder,
      description: isFibonacci
        ? `Generate the Fibonacci program using the coding agent.`
        : `Generate the ${decomp.targetLanguage || 'Python'} program using the coding agent.`,
      actions: [
        `Synthesize standalone, executable ${decomp.targetLanguage || 'Python'} code using ${models.coder}.`,
        'Ensure clean algorithmic design with zero unverified external dependencies.',
        'Format output inside a fenced code block with clear comments.'
      ],
      inputs: decomp.originalPrompt,
      dependencies: [],
      expectedOutput: `Standalone, executable ${decomp.targetLanguage || 'Python'} source code.`,
      validationCriteria: 'Syntactically valid source code.',
      status: 'pending'
    });

    // Step 2: Execution & Testing
    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Execution & Testing',
      agent: 'math_code',
      model: 'python-sandbox-runtime',
      description: isFibonacci
        ? `Run the program and verify that it produces ${termCount} correct terms.`
        : `Run the program and verify that it produces correct output.`,
      actions: [
        'Dispatch synthesized code to isolated subprocess runner.',
        'Monitor execution duration, exit code, and memory allocation.',
        'Capture and parse stdout stream and verify computed values.'
      ],
      inputs: `Synthesized code from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Sandboxed process execution output and verified telemetry.',
      validationCriteria: 'Process exit code == 0 with expected output verified.',
      status: 'pending'
    });

    expectedDeliverables.push(isFibonacci ? 'Executable Python program' : `Executable ${decomp.targetLanguage || 'Python'} program (${decomp.suggestedDeliverableName})`);
    expectedDeliverables.push('Verified execution output');

  // -------------------------------------------------------------------------
  // 2. CODE DEBUGGING & DEFECT PATCHING
  // -------------------------------------------------------------------------
  } else if (decomp.operation === 'code_debugging') {
    requiredCapabilities.push('Code Analysis', 'Defect Isolation & Patching', 'Sandboxed Verification');
    selectedAgents.push('math_code');
    selectedModels['math_code'] = models.coder;
    selectedModels['execution'] = 'python-sandbox-runtime';

    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Code Analysis & Defect Identification',
      agent: 'math_code',
      model: models.coder,
      description: 'Analyze source code and isolate syntax, type, or runtime exceptions.',
      actions: [
        'Inspect code syntax, variable bindings, and execution stack traces.',
        'Isolate defect root cause (e.g. index out of range, syntax error, null reference).',
        'Formulate minimal corrective patch.'
      ],
      inputs: decomp.originalPrompt,
      dependencies: [],
      expectedOutput: 'Identified root cause and patch plan.',
      validationCriteria: 'Defect isolated with explicit line reference.',
      status: 'pending'
    });

    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Code Correction & Patch Synthesis',
      agent: 'math_code',
      model: models.coder,
      description: 'Generate corrected source code with verified error resolution.',
      actions: [
        'Apply corrective patch preserving original algorithmic intent.',
        'Embed regression assertions to prevent defect re-occurrence.',
        'Synthesize clean, corrected source code block.'
      ],
      inputs: `Defect analysis from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Patched, syntactically clean source code.',
      validationCriteria: 'Patched code eliminates target exception.',
      status: 'pending'
    });

    const s3Id = `step-${stepCounter++}`;
    steps.push({
      id: s3Id,
      stageNumber: 3,
      name: 'Sandboxed Execution & Regression Testing',
      agent: 'math_code',
      model: 'python-sandbox-runtime',
      description: 'Execute patched code in sandbox to confirm clean execution without errors.',
      actions: [
        'Run patched program in isolated execution environment.',
        'Confirm return code 0 and absence of stderr exceptions.',
        'Verify programmatic output.'
      ],
      inputs: `Patched code from Stage 2 (${s2Id}).`,
      dependencies: [s2Id],
      expectedOutput: 'Verified execution telemetry confirming clean run.',
      validationCriteria: 'Process exits with code 0.',
      status: 'pending'
    });

    expectedDeliverables.push('Patched Python program');
    expectedDeliverables.push('Verified execution output');

  // -------------------------------------------------------------------------
  // 3. VISUAL OCR & TEXT EXTRACTION
  // -------------------------------------------------------------------------
  } else if (decomp.operation === 'vision_ocr') {
    requiredCapabilities.push('Visual OCR', 'Text Extraction & Transcription');
    selectedAgents.push('vision');
    selectedModels['vision'] = models.vision;

    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Visual OCR & Text Extraction',
      agent: 'vision',
      model: models.vision,
      description: 'Extract and transcribe all visible text, numbers, component codes, and annotations from image.',
      actions: [
        'Dispatch image buffer to Moondream multimodal vision agent.',
        'Detect text regions, header blocks, labels, and table cells.',
        'Transcribe visible text character-for-character preserving layout hierarchy.'
      ],
      inputs: 'Raw image buffer attachment.',
      dependencies: [],
      expectedOutput: 'Verbatim transcribed text elements.',
      validationCriteria: 'High character accuracy without speculative completion.',
      status: 'pending'
    });

    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Transcription Formatting & Verification',
      agent: 'vision',
      model: models.vision,
      description: 'Format extracted text labels into structured transcript and verify character fidelity.',
      actions: [
        'Normalize whitespace, align column data, and structure numbered sections.',
        'Flag any faint or ambiguous characters with explicit visual uncertainty markers.',
        'Assemble clean transcript deliverable.'
      ],
      inputs: `Extracted text from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Structured textual transcription.',
      validationCriteria: 'Formatted clean transcript.',
      status: 'pending'
    });

    expectedDeliverables.push('Extracted Text Transcript');

  // -------------------------------------------------------------------------
  // 4. MULTIMODAL VISION & DIAGRAM EXPLANATION
  // -------------------------------------------------------------------------
  } else if (decomp.operation === 'vision_analysis') {
    requiredCapabilities.push('Visual Inspection', 'Evidence Extraction', 'Technical Explanation');
    selectedAgents.push('vision', 'reasoning_synthesis');
    selectedModels['vision'] = models.vision;
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Visual Element & Component Recognition',
      agent: 'vision',
      model: models.vision,
      description: 'Inspect image layout, visual hierarchy, diagram components, and directional flow connections.',
      actions: [
        'Load image buffer and inspect graphical layout and elements.',
        'Identify diagram components, symbols, arrows, and directional flow connections.',
        'Recognize charts, legends, equipment symbols, and visual annotations.'
      ],
      inputs: 'Raw image buffer from uploaded attachment.',
      dependencies: [],
      expectedOutput: 'Structured visual element inventory and spatial relationship map.',
      validationCriteria: 'Diagram components, symbols, and connections identified.',
      status: 'pending'
    });

    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Diagram Element & Connection Mapping',
      agent: 'vision',
      model: models.vision,
      description: 'Transcribe visible text labels and map topological connections between visual components.',
      actions: [
        'Transcribe equipment tags, pipeline specifications, and numerical units.',
        'Trace directional flow lines and component interfaces.',
        'Structure evidence context for technical explanation.'
      ],
      inputs: `Visual element inventory from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Topological connection map with visible annotations.',
      validationCriteria: 'Evidence grounded in visual features.',
      status: 'pending'
    });

    const s3Id = `step-${stepCounter++}`;
    steps.push({
      id: s3Id,
      stageNumber: 3,
      name: 'Multi-Agent Technical Synthesis & Explanation',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Synthesize vision findings into structured plain-language technical explanation.',
      actions: [
        'Synthesize diagram components into cohesive operational workflow.',
        'Explain technical terminology and operational relationships clearly.',
        'Distinguish confirmed visible facts from inferred interpretations.',
        'Highlight important operational observations and flagged uncertainties.'
      ],
      inputs: `Extracted visual evidence from Stages 1 & 2 (${s1Id}, ${s2Id}).`,
      dependencies: [s2Id],
      expectedOutput: 'Comprehensive grounded technical explanation.',
      validationCriteria: '100% grounded in visual evidence with zero ungrounded hallucinations.',
      status: 'pending'
    });

    expectedDeliverables.push('Visual Analysis & Grounded Explanation Report');

  // -------------------------------------------------------------------------
  // 5. MATHEMATICAL PROBLEMS & DERIVATIONS
  // -------------------------------------------------------------------------
  } else if (decomp.operation === 'math_problem') {
    requiredCapabilities.push('Mathematical Formulation', 'Boundary & Assertion Verification');
    selectedAgents.push('math_code');
    selectedModels['math_code'] = models.coder;

    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Mathematical Formulation & Derivation',
      agent: 'math_code',
      model: models.coder,
      description: 'Derive step-by-step algebraic solution and evaluate governing equations deterministically.',
      actions: [
        'Formulate mathematical equations and variables.',
        'Derive step-by-step analytical solutions.',
        'Evaluate numerical values and roots.'
      ],
      inputs: decomp.originalPrompt,
      dependencies: [],
      expectedOutput: 'Step-by-step mathematical derivation.',
      validationCriteria: 'Algebraically sound derivations.',
      status: 'pending'
    });

    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Boundary & Assertion Verification',
      agent: 'math_code',
      model: 'python-scientific-runtime',
      description: 'Verify computed solutions against domain constraints and evaluate numerical stability.',
      actions: [
        'Verify roots and critical points.',
        'Confirm mathematical assertions.',
        'Format clean final solution.'
      ],
      inputs: `Derivation from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Verified numerical solution.',
      validationCriteria: 'Correct numerical result verified.',
      status: 'pending'
    });

    expectedDeliverables.push('Step-by-Step Mathematical Derivation');
    expectedDeliverables.push('Verified Numerical Solution');

  // -------------------------------------------------------------------------
  // 6. PURE ENGINEERING CALCULATION (e.g. Pump Power Calculation, Air Leakage Loss)
  // -------------------------------------------------------------------------
  } else if ((decomp.operation === 'engineering_pump' || decomp.operation === 'engineering_compressed_air' || decomp.operation === 'engineering_general') && decomp.requestedOutputFormat !== 'pdf' && !lower.includes('report') && !lower.includes('guideline')) {
    requiredCapabilities.push('Parameter Extraction', 'Deterministic Engineering Calculation', 'Numerical Validation');
    selectedAgents.push('math_code', 'reasoning_synthesis');
    selectedModels['math_code'] = 'python-scientific-runtime';
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Parameter Extraction & SI Normalization',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Extract numerical input parameters, convert to SI units, and verify physical boundaries.',
      actions: [
        `Extract numerical specifications: ${decomp.parameters.map(p => `${p.name}: ${p.value} ${p.unit}`).join(', ')}.`,
        'Convert flow rate to SI units (m³/s = m³/h ÷ 3600).',
        'Verify density, total dynamic head, and gravitational acceleration.',
        'Confirm non-zero positive physical values.'
      ],
      inputs: decomp.originalPrompt,
      dependencies: [],
      expectedOutput: 'Verified dimensional parameter matrix ready for deterministic calculation.',
      validationCriteria: 'All input variables present with confirmed non-zero positive boundaries.',
      status: 'pending'
    });

    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Deterministic Engineering Calculation Execution',
      agent: 'math_code',
      model: 'python-scientific-runtime',
      description: 'Execute deterministic physical calculations in Python scientific runtime with zero LLM arithmetic.',
      actions: [
        'Calculate hydraulic power required: P_hyd = rho * g * Q * H / 1000.',
        'Calculate required shaft power accounting for pump efficiency: P_shaft = P_hyd / eta_pump.',
        'Calculate electrical input power accounting for motor efficiency: P_elec = P_shaft / eta_motor.',
        'Evaluate standard IEC motor ratings and sizing safety margin.'
      ],
      inputs: `Verified SI parameter matrix from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Exact calculation records with formulas, values, and units.',
      validationCriteria: 'All primary calculations solved deterministically.',
      status: 'pending'
    });

    const s3Id = `step-${stepCounter++}`;
    steps.push({
      id: s3Id,
      stageNumber: 3,
      name: 'Drive Sizing & Operating Cost Validation',
      agent: 'math_code',
      model: 'python-scientific-runtime',
      description: 'Size standard electrical drive, evaluate safety margins, and project operating costs.',
      actions: [
        'Recommend standard motor rating with reasonable engineering margin.',
        'Compute daily and monthly electricity consumption (kWh).',
        'Compute monthly electricity cost based on electricity tariff.'
      ],
      inputs: `Calculation records from Stage 2 (${s2Id}).`,
      dependencies: [s2Id],
      expectedOutput: 'Motor sizing recommendation and operational cost breakdown.',
      validationCriteria: 'Standard motor sizing envelope satisfied.',
      status: 'pending'
    });

    expectedDeliverables.push('Verified Calculation Records');
    expectedDeliverables.push('Engineering Specification Sheet');

  // -------------------------------------------------------------------------
  // 6. FORMAL ENGINEERING AUDIT REPORT (Water Pump / Compressed Air PDF)
  // -------------------------------------------------------------------------
  } else if (decomp.domain === 'engineering_calculation') {
    requiredCapabilities.push(
      'Standard Knowledge Ingestion',
      'Boundary Parameter Validation',
      'Deterministic Physical Calculation',
      'Sensitivity & Scenario Modeling',
      'Formal Technical Synthesis',
      `Native ${decomp.requestedOutputFormat.toUpperCase()} Document Assembly`
    );
    if (decomp.requiresRAG) {
      selectedAgents.push('vector_rag');
      selectedModels['vector_rag'] = 'vector-similarity-engine';
    }
    selectedAgents.push('math_code', 'reasoning_synthesis');
    selectedModels['math_code'] = 'python-scientific-runtime';
    selectedModels['reasoning_synthesis'] = models.reasoning;

    if (decomp.requiresRAG) {
      const s1Id = `step-${stepCounter++}`;
      steps.push({
        id: s1Id,
        stageNumber: steps.length + 1,
        name: 'Document Retrieval & Technical Standard Ingestion',
        agent: 'vector_rag',
        model: 'vector-similarity-engine',
        description: 'Retrieve governing engineering standards, equations, and document guidelines from knowledge base.',
        actions: [
          'Query indexed knowledge base for engineering standards and guidelines.',
          'Extract equation definitions and standard motor sizing criteria.',
          'Ingest organizational reporting rules (ENG-STD-002, DOC-STD-001).'
        ],
        inputs: `Search queries across ${decomp.applicableStandards.join(', ')}`,
        dependencies: [],
        expectedOutput: 'Grounded engineering formulas, efficiency definitions, and document layout standards.',
        validationCriteria: 'Relevant standards retrieved and citation anchors verified.',
        status: 'pending'
      });
    }

    const sParamId = `step-${stepCounter++}`;
    steps.push({
      id: sParamId,
      stageNumber: steps.length + 1,
      name: 'Parameter Extraction & Boundary Condition Verification',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Normalize input parameters to standard SI units and verify physical boundary conditions.',
      actions: [
        `Extract numerical specifications: ${decomp.parameters.map(p => `${p.name}: ${p.value} ${p.unit}`).join(', ')}.`,
        'Verify density, head/pressure, and operational schedule.',
        'Validate non-zero positive physical boundaries.'
      ],
      inputs: decomp.originalPrompt,
      dependencies: steps.length > 0 ? [steps[steps.length - 1].id] : [],
      expectedOutput: 'Verified dimensional parameter matrix ready for deterministic solver.',
      validationCriteria: 'All input variables present with confirmed non-zero positive boundaries.',
      status: 'pending'
    });

    const sCalcId = `step-${stepCounter++}`;
    steps.push({
      id: sCalcId,
      stageNumber: steps.length + 1,
      name: 'Deterministic Engineering Calculation Execution',
      agent: 'math_code',
      model: 'python-scientific-runtime',
      description: 'Execute deterministic physical calculations in Python scientific runtime with zero LLM arithmetic.',
      actions: [
        'Execute deterministic fluid/thermodynamic formulas.',
        'Compute power, energy consumption, and operating costs.',
        'Evaluate standard equipment ratings and margins.'
      ],
      inputs: `Verified SI parameter matrix (${sParamId}).`,
      dependencies: [sParamId],
      expectedOutput: 'Deterministic calculation records with exact formulas, values, and units.',
      validationCriteria: 'All primary calculations solved without arithmetic approximation.',
      status: 'pending'
    });

    const sSynthId = `step-${stepCounter++}`;
    steps.push({
      id: sSynthId,
      stageNumber: steps.length + 1,
      name: 'Technical Synthesis & Report Drafting',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Synthesize formal engineering report narrative incorporating calculation records and standards.',
      actions: [
        'Draft executive summary highlighting power requirements and operating budget.',
        'Articulate equipment selection rationale and operating dynamics.',
        'Detail prioritized engineering recommendations.'
      ],
      inputs: `Deterministic records (${sCalcId}).`,
      dependencies: [sCalcId],
      expectedOutput: 'Comprehensive report sections strictly conforming to technical guidelines.',
      validationCriteria: 'All required sections addressed with rigorous technical depth.',
      status: 'pending'
    });

    const sDocId = `step-${stepCounter++}`;
    steps.push({
      id: sDocId,
      stageNumber: steps.length + 1,
      name: `Professional Document Deliverable Assembly (${decomp.requestedOutputFormat.toUpperCase()})`,
      agent: 'reasoning_synthesis',
      model: 'reportlab-docx-deliverable-engine',
      description: `Compile fully formatted native ${decomp.requestedOutputFormat.toUpperCase()} deliverable file.`,
      actions: [
        'Assemble document title header, revision metadata, and discipline tags.',
        'Format design parameters table with clean borders and units.',
        'Generate charts and apply running headers, footers, and two-pass page numbering ("Page X of Y").'
      ],
      inputs: `Synthesized report prose (${sSynthId}).`,
      dependencies: [sSynthId],
      expectedOutput: `Native binary deliverable: ${decomp.suggestedDeliverableName}.`,
      validationCriteria: 'Valid binary file generated with complete typographic layout.',
      status: 'pending'
    });

    expectedDeliverables.push(decomp.suggestedDeliverableName);
    expectedDeliverables.push('Verified Technical Findings Summary');

  // -------------------------------------------------------------------------
  // 7. POWERPOINT PRESENTATION DELIVERABLE
  // -------------------------------------------------------------------------
  } else if (decomp.operation === 'deliverable_pptx') {
    requiredCapabilities.push('Slide Outline & Narrative Structuring', 'Content Synthesis', 'Native PPTX Compilation');
    selectedAgents.push('reasoning_synthesis');
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Slide Outline & Narrative Structuring',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Decompose topic into title, key dimensions, technical/domain facts, and structured slide flow.',
      actions: [
        'Identify target topic, domain concepts, and audience objectives.',
        'Define slide sequence: Title Slide, Overview, Key Dimensions, Operational Significance, Strategic Outlook.',
        'Establish bullet point constraints (3-5 concise, information-dense points per slide).'
      ],
      inputs: decomp.primaryObjective,
      dependencies: [],
      expectedOutput: 'Structured presentation agenda and slide outline matrix.',
      validationCriteria: 'Clear multi-slide structure covering core aspects of topic.',
      status: 'pending'
    });

    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Thematic Domain Content Synthesis',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Generate factual, high-density slide headings and bullet points for each slide section.',
      actions: [
        'Synthesize domain knowledge, definitions, and realistic empirical facts for the topic.',
        'Eliminate repetitive generic boilerplate and focus on informative substantive points.',
        'Format slide draft with strict heading and bullet hierarchy.'
      ],
      inputs: `Slide outline from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Complete slide-by-slide copy ready for binary presentation generation.',
      validationCriteria: 'High factual density across all slides without placeholder text.',
      status: 'pending'
    });

    const s3Id = `step-${stepCounter++}`;
    steps.push({
      id: s3Id,
      stageNumber: 3,
      name: 'Native Presentation Compilation (PptxGenJS)',
      agent: 'reasoning_synthesis',
      model: 'pptxgenjs-runtime',
      description: 'Compile slide data into valid Microsoft PowerPoint (.pptx) binary container.',
      actions: [
        'Initialize 16:9 widescreen layout with LUMI dark charcoal background (#080808).',
        'Inject master title slide with warm taupe accent line (#987654) and metadata.',
        'Generate content slides with formatted headers, accent dividers, and styled bullet points.',
        'Encode presentation to OpenXML PKZip buffer.'
      ],
      inputs: `Slide copy from Stage 2 (${s2Id}).`,
      dependencies: [s2Id],
      expectedOutput: 'Native .pptx binary deliverable file.',
      validationCriteria: 'Non-empty presentation buffer adhering to PPTX OpenXML standards.',
      status: 'pending'
    });

    expectedDeliverables.push('Native PowerPoint Presentation (.pptx)');

  // -------------------------------------------------------------------------
  // 8. EXCEL SPREADSHEET WORKBOOK DELIVERABLE
  // -------------------------------------------------------------------------
  } else if (decomp.operation === 'deliverable_xlsx') {
    requiredCapabilities.push('Data Modeling & Workbook Architecture', 'Native XLSX Compilation', 'Formula Validation');
    selectedAgents.push('reasoning_synthesis');
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Data Modeling & Spreadsheet Architecture',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Design worksheet tabs, table schema, KPI definitions, and formula dependencies.',
      actions: [
        'Structure workbook layout (Executive KPI Summary, Detailed Data Sheet, Assumptions).',
        'Define column headers, data types, units, and currency symbols.',
        'Formulate dynamic Excel equations (=SUM, =AVERAGE, =B3*C3).'
      ],
      inputs: decomp.primaryObjective,
      dependencies: [],
      expectedOutput: 'Spreadsheet architecture schema with explicit formula mapping.',
      validationCriteria: 'Well-structured table definitions with proper formula design.',
      status: 'pending'
    });

    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Native XLSX Compilation with Working Formulas',
      agent: 'reasoning_synthesis',
      model: 'exceljs-xlsx-runtime',
      description: 'Generate multi-tab Excel (.xlsx) workbook with styled headers and functional formulas.',
      actions: [
        'Populate data rows with realistic values.',
        'Inject dynamic spreadsheet formulas with correct relative coordinates.',
        'Apply styling: charcoal header fills (#1E1E1E), muted grid lines, column auto-widths.',
        'Serialize workbook to OpenXML Excel buffer.'
      ],
      inputs: `Spreadsheet schema from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Native .xlsx workbook binary with working formulas.',
      validationCriteria: 'Valid XLSX file adhering to OpenXML spreadsheet standards.',
      status: 'pending'
    });

    const s3Id = `step-${stepCounter++}`;
    steps.push({
      id: s3Id,
      stageNumber: 3,
      name: 'Spreadsheet Integrity & Formula Verification',
      agent: 'reasoning_synthesis',
      model: 'lumi-quality-gate',
      description: 'Audit generated spreadsheet for formula integrity and cell layout completeness.',
      actions: [
        'Verify file size and non-empty worksheet buffers.',
        'Validate column headers, row counts, and data consistency.',
        'Confirm download URL availability in deliverable registry.'
      ],
      inputs: `Generated XLSX buffer (${s2Id}).`,
      dependencies: [s2Id],
      expectedOutput: 'Quality audit certificate confirming spreadsheet integrity.',
      validationCriteria: 'Worksheet contains valid headers, rows, and formatted data.',
      status: 'pending'
    });

    expectedDeliverables.push('Native Excel Workbook (.xlsx)');

  // -------------------------------------------------------------------------
  // 9. CSV DATASET ANALYSIS
  // -------------------------------------------------------------------------
  } else if (decomp.operation === 'data_csv_analysis') {
    requiredCapabilities.push('CSV Data Ingestion', 'Statistical Analysis & Aggregation', 'Insights Synthesis');
    selectedAgents.push('math_code', 'reasoning_synthesis');
    selectedModels['math_code'] = 'python-scientific-runtime';
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Data Ingestion & Schema Extraction',
      agent: 'math_code',
      model: 'python-scientific-runtime',
      description: 'Ingest CSV dataset, inspect column definitions, data types, and record counts.',
      actions: [
        'Load CSV into structured data frame.',
        'Extract summary schema: column names, data types, null counts, total rows.',
        'Identify quantitative metric columns and categorical grouping dimensions.'
      ],
      inputs: decomp.originalPrompt,
      dependencies: [],
      expectedOutput: 'Verified dataset schema and summary profiling statistics.',
      validationCriteria: 'Clean tabular schema extracted without missing column types.',
      status: 'pending'
    });

    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Statistical Computation & Metric Aggregation',
      agent: 'math_code',
      model: 'python-scientific-runtime',
      description: 'Compute descriptive statistics, aggregations, averages, and group metrics in Python runtime.',
      actions: [
        'Calculate core descriptive statistics: mean, median, standard deviation, min, max, quantiles.',
        'Execute required aggregations (group sums, category breakdown, percentage distributions).',
        'Extract anomalous data points and high-variance segments.'
      ],
      inputs: `Dataset schema from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Deterministic statistical calculation tables and metric aggregates.',
      validationCriteria: 'Statistical calculations solved without approximation.',
      status: 'pending'
    });

    const s3Id = `step-${stepCounter++}`;
    steps.push({
      id: s3Id,
      stageNumber: 3,
      name: 'Analytical Insights Synthesis',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Synthesize structured analytical findings highlighting business insights and key metric drivers.',
      actions: [
        'Draft executive summary interpreting metric trends and dominant drivers.',
        'Highlight critical variances, outlier patterns, and growth/efficiency opportunities.',
        'Format clean markdown tables presenting core computed statistics.'
      ],
      inputs: `Statistical computation results from Stage 2 (${s2Id}).`,
      dependencies: [s2Id],
      expectedOutput: 'Structured analytical summary report with verified data tables.',
      validationCriteria: 'Grounded insights linking directly to computed data values.',
      status: 'pending'
    });

    expectedDeliverables.push('Data Analysis Summary');
    expectedDeliverables.push('Structured Metric Tables');

  // -------------------------------------------------------------------------
  // 10. IMAGE GENERATION (DIFFUSION)
  // -------------------------------------------------------------------------
  } else if (decomp.operation === 'image_generation') {
    requiredCapabilities.push('Visual Prompt Enhancement', 'Authentic Diffusion Synthesis (FLUX.1-schnell)');
    selectedAgents.push('image_generation', 'reasoning_synthesis');
    selectedModels['image_generation'] = models.image_generation;
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Visual Concept & Prompt Optimization',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Formulate detailed visual prompt with composition, lighting, style, and aspect ratio.',
      actions: [
        'Analyze subject matter, foreground elements, and background environment.',
        'Optimize diffusion prompt with photographic / artistic keywords.',
        'Set resolution (1024×1024) and generation parameters.'
      ],
      inputs: decomp.originalPrompt,
      dependencies: [],
      expectedOutput: 'Optimized diffusion prompt.',
      validationCriteria: 'Detailed visual descriptor ready for generation engine.',
      status: 'pending'
    });

    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Authentic Diffusion Synthesis',
      agent: 'image_generation',
      model: models.image_generation,
      description: 'Execute genuine image generation pipeline to synthesize authentic PNG binary.',
      actions: [
        'Dispatch generation task to local FLUX.1-schnell / authentic diffusion engine.',
        'Process latent diffusion steps with guidance scale and sampling schedule.',
        'Decode latent tensor to high-resolution PNG image.'
      ],
      inputs: `Optimized visual prompt from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Authentic 1024×1024 PNG image binary.',
      validationCriteria: 'Valid PNG buffer with genuine image dimensions.',
      status: 'pending'
    });

    expectedDeliverables.push('Synthesized High-Resolution PNG Asset');

  // -------------------------------------------------------------------------
  // 11. DOCUMENT SUMMARY (PDF / DOC)
  // -------------------------------------------------------------------------
  } else if (decomp.operation === 'document_summary') {
    requiredCapabilities.push('Document Text Ingestion', 'Salient Argument Extraction', 'Summary Synthesis');
    selectedAgents.push('reasoning_synthesis');
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Document Text Ingestion & Section Chunking',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Extract textual content from document and segment into logical sections.',
      actions: [
        'Parse document text and preserve section hierarchy.',
        'Identify major headings, executive summaries, and core conclusions.',
        'Filter out boilerplate headers, footers, and page numbers.'
      ],
      inputs: decomp.originalPrompt,
      dependencies: [],
      expectedOutput: 'Clean segmented text sections.',
      validationCriteria: 'Document text extracted completely.',
      status: 'pending'
    });

    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Salient Argument & Finding Extraction',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Identify primary theses, supporting evidence, and key empirical findings.',
      actions: [
        'Extract core qualitative arguments and quantitative metrics.',
        'Isolate author conclusions and recommendations.',
        'Structure findings into thematic bullet points.'
      ],
      inputs: `Segmented text from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Thematic findings matrix.',
      validationCriteria: 'All extracted points grounded in source document.',
      status: 'pending'
    });

    const s3Id = `step-${stepCounter++}`;
    steps.push({
      id: s3Id,
      stageNumber: 3,
      name: 'Executive Summary Synthesis',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Synthesize concise executive summary with clear structure and actionable takeaways.',
      actions: [
        'Draft executive overview highlighting essential conclusions.',
        'Organize key takeaways with bold emphasis and clean formatting.',
        'Provide structured document overview without conversational filler.'
      ],
      inputs: `Findings from Stage 2 (${s2Id}).`,
      dependencies: [s2Id],
      expectedOutput: 'Comprehensive executive summary document.',
      validationCriteria: 'Clear, high-density summary.',
      status: 'pending'
    });

    expectedDeliverables.push('Executive Summary Document');

  // -------------------------------------------------------------------------
  // 12. DOCUMENT COMPLIANCE & STANDARDS AUDIT (RAG)
  // -------------------------------------------------------------------------
  } else if (decomp.operation === 'document_compliance') {
    requiredCapabilities.push('Knowledge Ingestion & Vector Retrieval', 'Guideline Compliance Evaluation', 'Provenance Verification');
    selectedAgents.push('vector_rag', 'reasoning_synthesis');
    selectedModels['vector_rag'] = 'vector-similarity-engine';
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Standard Document Ingestion & Chunk Retrieval',
      agent: 'vector_rag',
      model: 'vector-similarity-engine',
      description: 'Retrieve relevant text chunks and guidelines from persistent knowledge base.',
      actions: [
        'Execute vector similarity search across indexed documents.',
        'Extract highest-scoring passages, section anchors, and page locations.',
        'Compile retrieved chunks into structured evidence context.'
      ],
      inputs: decomp.originalPrompt,
      dependencies: [],
      expectedOutput: 'Ranked list of verified evidence passages.',
      validationCriteria: 'Non-empty chunk retrieval from genuine documents.',
      status: 'pending'
    });

    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Guideline & Regulatory Compliance Audit',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Evaluate practical application of guidelines to user scenario or target document.',
      actions: [
        'Map requirements from guidelines (e.g. ENG-STD-002, DOC-STD-001) to operational context.',
        'Check report layout, document numbering, review controls, and authoring rules.',
        'Formulate actionable recommendations for full standard compliance.'
      ],
      inputs: `Retrieved passages from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Compliance scorecard with pass/gap analysis.',
      validationCriteria: 'Actionable guidance with explicit clause references.',
      status: 'pending'
    });

    const s3Id = `step-${stepCounter++}`;
    steps.push({
      id: s3Id,
      stageNumber: 3,
      name: 'Grounded Compliance Analysis Assembly',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Compile authoritative, cited analysis document with transparent provenance.',
      actions: [
        'Synthesize executive findings, detailed analysis, and compliance recommendations.',
        'Attach grounded source citation list with full text snippets.',
        'Format clean markdown output.'
      ],
      inputs: `Compliance analysis from Stage 2 (${s2Id}).`,
      dependencies: [s2Id],
      expectedOutput: 'Comprehensive grounded technical analysis.',
      validationCriteria: 'Clear, rigorous document with transparent provenance.',
      status: 'pending'
    });

    expectedDeliverables.push('Grounded Compliance Evaluation Report');

  // -------------------------------------------------------------------------
  // 13. GENERAL QA & CONCEPTUAL INQUIRY
  // -------------------------------------------------------------------------
  } else {
    requiredCapabilities.push('Concept Analysis', 'Direct Technical Synthesis');
    selectedAgents.push('reasoning_synthesis');
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Context & Concept Analysis',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Analyze core inquiry, identify foundational principles, and define structure.',
      actions: [
        'Decompose prompt into primary requirements and implied constraints.',
        'Isolate foundational definitions, historical context, or engineering principles.',
        'Structure logical progression of the answer.'
      ],
      inputs: decomp.originalPrompt,
      dependencies: [],
      expectedOutput: 'Structured response architecture.',
      validationCriteria: 'Clear conceptual understanding established.',
      status: 'pending'
    });

    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Coherent Technical Synthesis',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Synthesize direct, factual response formatted cleanly without conversational filler.',
      actions: [
        'Formulate direct, logically rigorous answer addressing all parts of prompt.',
        'Use clean markdown structure with code snippets or lists where appropriate.',
        'Ensure direct answers without unnecessary conversational preamble.'
      ],
      inputs: `Concept architecture from Stage 1 (${s1Id}).`,
      dependencies: [s1Id],
      expectedOutput: 'Direct, comprehensive technical answer.',
      validationCriteria: 'Accurate and comprehensive response content.',
      status: 'pending'
    });

    expectedDeliverables.push('Direct Technical Response');
  }

  // Task interpretation: rich, specific, preserving numbers & objective
  let taskInterpretation = decomp.primaryObjective;
  if (decomp.parameters.length > 0) {
    taskInterpretation += ` Parameters: ${decomp.parameters.map(p => `${p.name}=${p.value}${p.unit}`).join(', ')}.`;
  }

  return {
    id: `plan-${Date.now()}`,
    taskInterpretation,
    originalPrompt: decomp.originalPrompt,
    decomposition: decomp,
    requiredCapabilities,
    selectedAgents,
    selectedModels,
    executionSequence: steps,
    expectedDeliverables,
    status: 'pending_approval',
    createdAt: new Date().toISOString()
  };
}
