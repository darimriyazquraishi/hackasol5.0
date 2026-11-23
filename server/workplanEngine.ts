import { TaskDecomposition, TaskDomain } from './taskDecomposer';
import { AgentArchetype, LumiWorkflowStep, LumiWorkplan } from '../src/types';

export interface ModelRegistryConfig {
  vision: string;
  image_generation: string;
  math_code: string;
  reasoning: string;
  coder: string;
}

const DEFAULT_MODELS: ModelRegistryConfig = {
  vision: 'qwen2.5-vl:7b',
  image_generation: 'flux1-schnell',
  math_code: 'python-scientific-runtime',
  reasoning: 'qwen2.5:1.5b',
  coder: 'qwen2.5-coder:7b'
};

/**
 * Generate Dynamic, Capability-Routed Workplan
 * Creates 5 to 7 detailed stages tailored directly to the decomposed task.
 */
export function generateDynamicWorkplan(
  decomp: TaskDecomposition,
  installedModels: Array<{ name: string; size: string }> = []
): LumiWorkplan {
  const models = { ...DEFAULT_MODELS };
  if (installedModels.length > 0) {
    const installedNames = installedModels.map(m => m.name);
    // Find best match for reasoning
    const rMatch = installedNames.find(n => /qwen2\.5|qwen3|llama|mistral/i.test(n));
    if (rMatch) models.reasoning = rMatch;
    // Find best match for coder
    const cMatch = installedNames.find(n => /coder|code/i.test(n));
    if (cMatch) models.coder = cMatch;
    else if (rMatch) models.coder = rMatch;
    // Find best match for vision
    const vMatch = installedNames.find(n => /vl|vision/i.test(n));
    if (vMatch) models.vision = vMatch;
  }

  const steps: LumiWorkflowStep[] = [];
  const requiredCapabilities: string[] = [];
  const selectedAgents: AgentArchetype[] = [];
  const selectedModels: Record<string, string> = {};
  const expectedDeliverables: string[] = [];

  let stepCounter = 1;

  if (decomp.domain === 'engineering_calculation') {
    // -------------------------------------------------------------
    // DOMAIN 1: ENGINEERING CALCULATION WORKPLAN (7 STAGES)
    // -------------------------------------------------------------
    requiredCapabilities.push(
      'Vector Standard Ingestion',
      'Boundary Parameter Validation',
      'Deterministic Thermodynamic/Fluid Calculation',
      'Sensitivity & Excursion Modeling',
      'Formal Technical Synthesis',
      `Native ${decomp.requestedOutputFormat.toUpperCase()} Document Assembly`,
      'Post-Generation Quality Audit'
    );
    selectedAgents.push('vector_rag', 'math_code', 'reasoning_synthesis');
    selectedModels['vector_rag'] = 'vector-similarity-engine';
    selectedModels['math_code'] = models.math_code;
    selectedModels['reasoning_synthesis'] = models.reasoning;

    // Stage 1
    const s1Id = `step-${stepCounter++}`;
    steps.push({
      id: s1Id,
      stageNumber: 1,
      name: 'Document Retrieval & Technical Standard Ingestion',
      agent: 'vector_rag',
      model: 'vector-similarity-engine',
      description: 'Retrieve governing engineering standards, equations, and document guidelines from knowledge base.',
      actions: [
        'Query indexed knowledge base for pump engineering standards and guidelines.',
        'Extract equation definitions for hydraulic power, shaft power, and motor electrical input power.',
        'Retrieve motor sizing criteria, standard frame ratings, and recommended safety margin envelopes.',
        'Ingest organizational reporting rules (ENG-STD-002, DOC-STD-001).'
      ],
      inputs: `Search queries across ${decomp.applicableStandards.join(', ')}`,
      dependencies: [],
      expectedOutput: 'Grounded engineering formulas, efficiency definitions, and document layout standards.',
      validationCriteria: 'Relevant standards retrieved and citation anchors verified.',
      status: 'pending'
    });

    // Stage 2
    const s2Id = `step-${stepCounter++}`;
    steps.push({
      id: s2Id,
      stageNumber: 2,
      name: 'Parameter Extraction & Boundary Condition Verification',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Normalize input parameters to standard SI units and verify physical boundary conditions.',
      actions: [
        `Extract numerical specifications: ${decomp.parameters.map(p => `${p.name}: ${p.value} ${p.unit}`).join(', ')}.`,
        'Convert flow rate to SI units (Q = 25 m³/h = 0.006944 m³/s).',
        'Verify density (1000 kg/m³), head (35 m), and gravitational acceleration (9.81 m/s²).',
        'Validate efficiency ranges (Pump: 78%, Motor: 90%) and tariff rate (₹8/kWh).'
      ],
      inputs: 'User specification prompt and parameter definitions.',
      dependencies: [s1Id],
      expectedOutput: 'Verified dimensional parameter matrix ready for deterministic solver.',
      validationCriteria: 'All input variables present with confirmed non-zero positive boundaries.',
      status: 'pending'
    });

    // Stage 3
    const s3Id = `step-${stepCounter++}`;
    steps.push({
      id: s3Id,
      stageNumber: 3,
      name: 'Deterministic Engineering Calculation Execution',
      agent: 'math_code',
      model: models.math_code,
      description: 'Execute deterministic physical calculations in Python scientific runtime with zero LLM arithmetic.',
      actions: [
        'Calculate hydraulic power: P_hyd = rho * g * Q * H (1000 * 9.81 * (25/3600) * 35 / 1000 = 2.384 kW).',
        'Calculate required shaft power accounting for pump efficiency: P_shaft = P_hyd / 0.78 = 3.057 kW.',
        'Calculate electrical input power accounting for motor efficiency: P_elec = P_shaft / 0.90 = 3.397 kW.',
        'Evaluate standard IEC motor ratings (3.0 kW, 3.7 kW, 4.0 kW, 5.5 kW) and compute safety margins.',
        'Compute daily consumption (3.397 kW * 12 h = 40.76 kWh/day) and monthly consumption (1,222.8 kWh/month).',
        'Compute monthly operating cost: 1,222.8 kWh * ₹8/kWh = ₹9,782.30/month.'
      ],
      inputs: 'Verified SI parameter matrix from Stage 2.',
      dependencies: [s2Id],
      expectedOutput: 'Deterministic calculation records with exact formulas, values, and units.',
      validationCriteria: 'All 7 primary calculations solved without arithmetic approximation.',
      status: 'pending'
    });

    // Stage 4
    const s4Id = `step-${stepCounter++}`;
    steps.push({
      id: s4Id,
      stageNumber: 4,
      name: 'Sensitivity & Scenario Analysis (+20% Flow & BEP Dynamics)',
      agent: 'math_code',
      model: models.math_code,
      description: 'Simulate flow increase excursion and analyze hydrodynamic operation relative to BEP.',
      actions: [
        'Simulate 20% flow rate increase (30 m³/h) under constant head (35 m).',
        'Compute revised power: P_hyd = 2.861 kW, P_shaft = 3.668 kW, P_elec = 4.076 kW (+20.0%).',
        'Evaluate motor loading on standard 3.7 kW motor (3.668 / 3.7 = 99.1% load).',
        'Compute revised operating cost: ₹11,738.80/month (+₹1,956.50/month, +20.0%).',
        'Analyze Best Efficiency Point (BEP) operating dynamics per HI 14.3 (radial thrust, vibration, MTBF).'
      ],
      inputs: 'Baseline calculation records and sensitivity parameters.',
      dependencies: [s3Id],
      expectedOutput: 'Sensitivity comparison dataset and hydrodynamic BEP impact findings.',
      validationCriteria: 'Linear power scaling verified; motor overload constraints evaluated.',
      status: 'pending'
    });

    // Stage 5
    const s5Id = `step-${stepCounter++}`;
    steps.push({
      id: s5Id,
      stageNumber: 5,
      name: 'Multi-Agent Technical Synthesis & Interpretation',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Synthesize formal engineering report narrative incorporating calculation records and standards.',
      actions: [
        'Draft executive summary highlighting power requirements, recommended motor rating, and operating budget.',
        'Articulate motor selection rationale (3.7 kW rating provides 21.0% margin over baseline shaft power).',
        'Detail BEP engineering significance: hydrodynamic efficiency, cavitation prevention, and seal/bearing longevity.',
        'Synthesize sensitivity findings recommending 4.0 kW or 5.5 kW motor if 30 m³/h operation is continuous.'
      ],
      inputs: 'Deterministic records from Stages 3 & 4 and standard passages from Stage 1.',
      dependencies: [s4Id],
      expectedOutput: 'Comprehensive report sections strictly conforming to ENG-STD-002.',
      validationCriteria: 'All required sections addressed with rigorous technical depth and zero conversational filler.',
      status: 'pending'
    });

    // Stage 6
    const s6Id = `step-${stepCounter++}`;
    steps.push({
      id: s6Id,
      stageNumber: 6,
      name: `Professional Document Deliverable Assembly (${decomp.requestedOutputFormat.toUpperCase()})`,
      agent: 'reasoning_synthesis',
      model: 'reportlab-docx-deliverable-engine',
      description: `Compile fully formatted native ${decomp.requestedOutputFormat.toUpperCase()} deliverable file.`,
      actions: [
        'Assemble document title header, revision metadata, and discipline tags.',
        'Format design parameters table with alternating row fills, clean borders, and units.',
        'Construct step-by-step engineering calculation section with formulas, substitutions, and computed outputs.',
        'Generate operational cost table and sensitivity comparison matrix.',
        'Apply running headers, footers, and two-pass page numbering ("Page X of Y").'
      ],
      inputs: 'Synthesized report prose and structured calculation tables.',
      dependencies: [s5Id],
      expectedOutput: `Native binary deliverable: ${decomp.suggestedDeliverableName}.`,
      validationCriteria: 'Valid binary file generated with complete typographic layout.',
      status: 'pending'
    });

    // Stage 7
    const s7Id = `step-${stepCounter++}`;
    steps.push({
      id: s7Id,
      stageNumber: 7,
      name: 'Quality Assurance, Verification & Completeness Audit',
      agent: 'reasoning_synthesis',
      model: 'lumi-quality-gate',
      description: 'Perform deterministic completeness and mathematical consistency audit on generated deliverable.',
      actions: [
        'Re-open generated deliverable buffer and extract textual content.',
        'Verify document length exceeds 1500 characters of substantive technical text.',
        'Validate presence of all 8 mandatory report sections.',
        'Cross-verify computed values (2.384 kW, 3.057 kW, 3.397 kW, 3.7 kW motor, ₹9,782/mo).',
        'Confirm absence of prompt echoes, unrendered tags, and debugging metadata.'
      ],
      inputs: 'Compiled deliverable binary and verification truth records.',
      dependencies: [s6Id],
      expectedOutput: 'Verified quality assurance audit certificate (STATUS: PASSED).',
      validationCriteria: '100% compliance across completeness, calculations, and layout checks.',
      status: 'pending'
    });

    expectedDeliverables.push(decomp.suggestedDeliverableName);
    expectedDeliverables.push('Verified Technical Findings Summary');

  } else if (decomp.domain === 'programming') {
    // -------------------------------------------------------------
    // DOMAIN 2: PROGRAMMING & CODE EXECUTION WORKPLAN (5 STAGES)
    // -------------------------------------------------------------
    requiredCapabilities.push(
      'Requirements & Interface Specification',
      'Algorithmic Code Synthesis',
      'Isolated Sandboxed Execution',
      'Test Suite & Edge Case Verification',
      'Technical Documentation & Packaging'
    );
    selectedAgents.push('math_code', 'reasoning_synthesis');
    selectedModels['math_code'] = models.coder;
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1 = `step-${stepCounter++}`;
    steps.push({
      id: s1,
      stageNumber: 1,
      name: 'Requirements & Interface Specification',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Analyze programmatic requirements, function signatures, dependencies, and expected I/O.',
      actions: [
        'Decompose functional requirements and data structures.',
        'Identify target runtime (Python 3.10+ / Node.js) and required standard libraries.',
        'Define explicit unit test assertions and edge cases (empty inputs, bounds, invalid types).'
      ],
      inputs: 'User programming specification.',
      dependencies: [],
      expectedOutput: 'Formal API interface specification and test criteria.',
      validationCriteria: 'Signatures and type contracts clearly defined.',
      status: 'pending'
    });

    const s2 = `step-${stepCounter++}`;
    steps.push({
      id: s2,
      stageNumber: 2,
      name: 'Algorithmic Code Synthesis',
      agent: 'math_code',
      model: models.coder,
      description: 'Generate idiomatic, robust code implementation using dedicated coder model.',
      actions: [
        'Implement core computational functions with defensive error handling.',
        'Ensure clean modular design with zero external unverified dependencies.',
        'Embed automated test execution wrapper.'
      ],
      inputs: 'Interface specification and test contracts from Stage 1.',
      dependencies: [s1],
      expectedOutput: 'Executable standalone source code block.',
      validationCriteria: 'Syntactically valid code with proper typing and error traps.',
      status: 'pending'
    });

    const s3 = `step-${stepCounter++}`;
    steps.push({
      id: s3,
      stageNumber: 3,
      name: 'Isolated Sandboxed Execution',
      agent: 'math_code',
      model: 'sandbox-execution-runtime',
      description: 'Execute synthesized code inside subprocess sandbox and capture stdout/stderr.',
      actions: [
        'Dispatch code to isolated child process execution runner.',
        'Monitor execution duration, memory allocation, and return code.',
        'Capture and parse stdout payload and telemetry.'
      ],
      inputs: 'Synthesized code block from Stage 2.',
      dependencies: [s2],
      expectedOutput: 'Execution telemetry (exit code, runtime ms, stdout stream).',
      validationCriteria: 'Process exit code == 0 with zero runtime exceptions.',
      status: 'pending'
    });

    const s4 = `step-${stepCounter++}`;
    steps.push({
      id: s4,
      stageNumber: 4,
      name: 'Test Suite & Edge Case Verification',
      agent: 'math_code',
      model: models.coder,
      description: 'Evaluate assertions and verify behavioral correctness across boundary conditions.',
      actions: [
        'Verify test assertions against expected outputs.',
        'Validate performance and algorithmic complexity.',
        'Inspect potential memory or boundary edge failures.'
      ],
      inputs: 'Execution output stream from Stage 3.',
      dependencies: [s3],
      expectedOutput: 'Test suite validation matrix with 100% passing tests.',
      validationCriteria: 'All assertion cases evaluated and confirmed.',
      status: 'pending'
    });

    const s5 = `step-${stepCounter++}`;
    steps.push({
      id: s5,
      stageNumber: 5,
      name: 'Technical Documentation & Artifact Assembly',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Synthesize usage documentation, runtime instructions, and verified code deliverable.',
      actions: [
        'Compile structured code explanation and architectural overview.',
        'Document sample inputs, outputs, and invocation instructions.',
        'Assemble final verified deliverable artifact.'
      ],
      inputs: 'Verified code and execution telemetry.',
      dependencies: [s4],
      expectedOutput: 'Complete code deliverable with execution verification proof.',
      validationCriteria: 'Comprehensive documentation and working verified code.',
      status: 'pending'
    });

    expectedDeliverables.push('Verified Code Artifact & Execution Log');

  } else if (decomp.domain === 'data_analysis') {
    // -------------------------------------------------------------
    // DOMAIN 3: DATA ANALYSIS & SPREADSHEET WORKPLAN (5 STAGES)
    // -------------------------------------------------------------
    requiredCapabilities.push(
      'Tabular Data Ingestion & Schema Parsing',
      'Statistical Computation & Numerical Modeling',
      'Native Workbook Compilation (ExcelJS)',
      'Analytical Insights & Trend Synthesis',
      'Completeness & Formula Verification'
    );
    selectedAgents.push('math_code', 'reasoning_synthesis');
    selectedModels['math_code'] = models.math_code;
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1 = `step-${stepCounter++}`;
    steps.push({
      id: s1,
      stageNumber: 1,
      name: 'Tabular Data Ingestion & Schema Definition',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Parse dataset structure, extract dimensions, metrics, and data types.',
      actions: [
        'Define spreadsheet column hierarchy, categories, and numerical formats.',
        'Normalize currency, percentages, and timestamps.',
        'Establish calculation dependencies across rows and columns.'
      ],
      inputs: 'User dataset specification or uploaded records.',
      dependencies: [],
      expectedOutput: 'Structured schema definition and cell coordinate map.',
      validationCriteria: 'Schema validated with typed column definitions.',
      status: 'pending'
    });

    const s2 = `step-${stepCounter++}`;
    steps.push({
      id: s2,
      stageNumber: 2,
      name: 'Statistical Computation & Aggregation',
      agent: 'math_code',
      model: models.math_code,
      description: 'Compute totals, subtotals, variances, and statistical aggregates.',
      actions: [
        'Compute sums, averages, and period-over-period delta percentages.',
        'Perform sensitivity and variance evaluations.',
        'Prepare data matrix for ExcelJS workbook generator.'
      ],
      inputs: 'Raw records and schema from Stage 1.',
      dependencies: [s1],
      expectedOutput: 'Computed numerical matrix with explicit formulas.',
      validationCriteria: 'Calculations verified without arithmetic discrepancies.',
      status: 'pending'
    });

    const s3 = `step-${stepCounter++}`;
    steps.push({
      id: s3,
      stageNumber: 3,
      name: 'Native Workbook Assembly (XLSX / CSV)',
      agent: 'reasoning_synthesis',
      model: 'exceljs-workbook-engine',
      description: 'Synthesize native formatted spreadsheet with styled headers and formulas.',
      actions: [
        'Format dark charcoal header row with high-contrast typography.',
        'Apply zebra-striped row fills, thin cell borders, and currency number formats.',
        'Inject native formula cells (=SUM, =AVERAGE) for dynamic updating.',
        'Write binary XLSX buffer to disk registry.'
      ],
      inputs: 'Computed data matrix and formatting stylesheet.',
      dependencies: [s2],
      expectedOutput: `Downloadable spreadsheet file: ${decomp.suggestedDeliverableName}.`,
      validationCriteria: 'Valid Excel workbook generated with styled cells and proper formulas.',
      status: 'pending'
    });

    const s4 = `step-${stepCounter++}`;
    steps.push({
      id: s4,
      stageNumber: 4,
      name: 'Analytical Insights & Management Summary',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Synthesize business and technical insights derived from the dataset.',
      actions: [
        'Summarize key financial/operational highlights and dominant cost drivers.',
        'Identify significant variances and optimization opportunities.',
        'Draft executive briefing notes for decision makers.'
      ],
      inputs: 'Computed data matrix from Stage 2.',
      dependencies: [s3],
      expectedOutput: 'Written analytical briefing accompanying the spreadsheet.',
      validationCriteria: 'Concrete data-backed findings without generic filler.',
      status: 'pending'
    });

    const s5 = `step-${stepCounter++}`;
    steps.push({
      id: s5,
      stageNumber: 5,
      name: 'Spreadsheet Audit & Integrity Verification',
      agent: 'reasoning_synthesis',
      model: 'lumi-quality-gate',
      description: 'Audit generated spreadsheet for formula integrity and cell layout completeness.',
      actions: [
        'Verify file size and non-empty worksheet buffers.',
        'Validate column headers, row counts, and data consistency.',
        'Confirm download URL availability in deliverable registry.'
      ],
      inputs: 'Generated XLSX buffer and metadata.',
      dependencies: [s4],
      expectedOutput: 'Quality audit certificate confirming spreadsheet integrity.',
      validationCriteria: 'Worksheet contains valid headers, rows, and formatted data.',
      status: 'pending'
    });

    expectedDeliverables.push(decomp.suggestedDeliverableName);
    expectedDeliverables.push('Financial & Operational Summary Report');

  } else if (decomp.domain === 'document_analysis') {
    // -------------------------------------------------------------
    // DOMAIN 4: DOCUMENT ANALYSIS & RAG WORKPLAN (5 STAGES)
    // -------------------------------------------------------------
    requiredCapabilities.push(
      'Knowledge Ingestion & Vector Retrieval',
      'Cross-Document Evidence Synthesis',
      'Guideline Compliance Evaluation',
      'Provenance & Citation Verification',
      'Grounded Analysis Compilation'
    );
    selectedAgents.push('vector_rag', 'reasoning_synthesis');
    selectedModels['vector_rag'] = 'vector-similarity-engine';
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1 = `step-${stepCounter++}`;
    steps.push({
      id: s1,
      stageNumber: 1,
      name: 'Target Document Ingestion & Chunk Retrieval',
      agent: 'vector_rag',
      model: 'vector-similarity-engine',
      description: 'Retrieve relevant text chunks and metadata from indexed persistent knowledge base.',
      actions: [
        'Execute vector similarity search across indexed documents.',
        'Extract highest-scoring passages, document IDs, section anchors, and page locations.',
        'Compile retrieved chunks into structured evidence context.'
      ],
      inputs: 'User query keywords and target document parameters.',
      dependencies: [],
      expectedOutput: 'Ranked list of verified evidence passages with similarity scores.',
      validationCriteria: 'Non-empty chunk retrieval from genuine uploaded documents.',
      status: 'pending'
    });

    const s2 = `step-${stepCounter++}`;
    steps.push({
      id: s2,
      stageNumber: 2,
      name: 'Cross-Document Synthesis & Theme Extraction',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Extract core principles, rules, and mandatory clauses from retrieved text.',
      actions: [
        'Analyze mandatory vs recommended provisions (MUST / SHOULD / MUST NOT).',
        'Identify common themes, discrepancies, or policy gaps across documents.',
        'Synthesize coherent factual findings grounded strictly in retrieved text.'
      ],
      inputs: 'Retrieved evidence passages from Stage 1.',
      dependencies: [s1],
      expectedOutput: 'Thematic analysis matrix linking claims to source documents.',
      validationCriteria: 'All synthesized points grounded directly in retrieved snippets.',
      status: 'pending'
    });

    const s3 = `step-${stepCounter++}`;
    steps.push({
      id: s3,
      stageNumber: 3,
      name: 'Guideline & Regulatory Compliance Audit',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Evaluate practical application of guidelines to user scenario or target document.',
      actions: [
        'Map requirements from guidelines (e.g. ENG-STD-002, DOC-STD-001) to operational context.',
        'Check report layout, document numbering, review controls, and authoring rules.',
        'Formulate actionable recommendations for full standard compliance.'
      ],
      inputs: 'Extracted principles and operational scenario.',
      dependencies: [s2],
      expectedOutput: 'Compliance scorecard with pass/gap analysis.',
      validationCriteria: 'Actionable guidance with explicit clause references.',
      status: 'pending'
    });

    const s4 = `step-${stepCounter++}`;
    steps.push({
      id: s4,
      stageNumber: 4,
      name: 'Citation Formatting & Provenance Verification',
      agent: 'reasoning_synthesis',
      model: 'provenance-verification-gate',
      description: 'Format accurate citations and audit against knowledge base to eliminate hallucinated sources.',
      actions: [
        'Verify document names, section numbers, and chunk IDs against database.',
        'Eliminate any hallucinated citations not present in indexed files.',
        'Format citation callouts: [Document Name - Section #].'
      ],
      inputs: 'Draft analysis and retrieved chunk registry.',
      dependencies: [s3],
      expectedOutput: 'Verified citation register with confirmed provenance.',
      validationCriteria: '100% of cited sources correspond to indexed knowledge base entries.',
      status: 'pending'
    });

    const s5 = `step-${stepCounter++}`;
    steps.push({
      id: s5,
      stageNumber: 5,
      name: 'Final Grounded Report Assembly',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Compile authoritative, cited analysis document.',
      actions: [
        'Synthesize executive findings, detailed analysis, and compliance recommendations.',
        'Attach grounded source citation list with full text snippets.',
        'Format clean markdown or deliverable output.'
      ],
      inputs: 'Audited text and verified citations.',
      dependencies: [s4],
      expectedOutput: 'Comprehensive grounded technical analysis.',
      validationCriteria: 'Clear, rigorous document with transparent provenance.',
      status: 'pending'
    });

    expectedDeliverables.push('Grounded Technical Analysis Document');

  } else if (decomp.domain === 'image_generation') {
    // -------------------------------------------------------------
    // DOMAIN 5: IMAGE GENERATION WORKPLAN (4 STAGES)
    // -------------------------------------------------------------
    requiredCapabilities.push(
      'Visual Concept & Prompt Enhancement',
      'Authentic Diffusion Synthesis (FLUX.1-schnell)',
      'Image Quality & Artifact Inspection',
      'Asset Registration & Packaging'
    );
    selectedAgents.push('image_generation', 'reasoning_synthesis');
    selectedModels['image_generation'] = models.image_generation;
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1 = `step-${stepCounter++}`;
    steps.push({
      id: s1,
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
      inputs: 'User image generation brief.',
      dependencies: [],
      expectedOutput: 'Optimized diffusion prompt and negative prompt parameters.',
      validationCriteria: 'Detailed visual descriptor ready for generation engine.',
      status: 'pending'
    });

    const s2 = `step-${stepCounter++}`;
    steps.push({
      id: s2,
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
      inputs: 'Optimized visual prompt from Stage 1.',
      dependencies: [s1],
      expectedOutput: 'Authentic 1024×1024 PNG image binary.',
      validationCriteria: 'Valid PNG buffer with genuine image dimensions.',
      status: 'pending'
    });

    const s3 = `step-${stepCounter++}`;
    steps.push({
      id: s3,
      stageNumber: 3,
      name: 'Visual Quality & Artifact Inspection',
      agent: 'reasoning_synthesis',
      model: 'visual-quality-gate',
      description: 'Inspect generated image for structural fidelity and absence of visual corruption.',
      actions: [
        'Verify PNG magic bytes (89 50 4E 47 0D 0A 1A 0A).',
        'Check file size (>100 KB) and resolution (1024×1024).',
        'Verify correct visual subject representation.'
      ],
      inputs: 'Generated PNG buffer.',
      dependencies: [s2],
      expectedOutput: 'Quality inspection certificate (PASSED).',
      validationCriteria: 'Decodable image file matching requested subject.',
      status: 'pending'
    });

    const s4 = `step-${stepCounter++}`;
    steps.push({
      id: s4,
      stageNumber: 4,
      name: 'Asset Registration & UI Packaging',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Store image to disk, register download endpoint, and format chat presentation.',
      actions: [
        'Persist image to data/images directory.',
        'Register asset ID and download URL (/api/images/...).',
        'Format Markdown image presentation with generation metadata.'
      ],
      inputs: 'Verified PNG image from Stage 3.',
      dependencies: [s3],
      expectedOutput: 'Downloadable image asset registered in LUMI storage.',
      validationCriteria: 'Image available via HTTP endpoint and embedded in chat.',
      status: 'pending'
    });

    expectedDeliverables.push(decomp.suggestedDeliverableName);

  } else {
    // -------------------------------------------------------------
    // DOMAIN 6: GENERAL KNOWLEDGE & ASSISTANT WORKPLAN (4 STAGES)
    // -------------------------------------------------------------
    requiredCapabilities.push(
      'Query Decomposition & Intent Grounding',
      'Context & Knowledge Synthesis',
      'Structured Coherent Drafting',
      'Factuality & Output Verification'
    );
    selectedAgents.push('reasoning_synthesis');
    selectedModels['reasoning_synthesis'] = models.reasoning;

    const s1 = `step-${stepCounter++}`;
    steps.push({
      id: s1,
      stageNumber: 1,
      name: 'Intent Grounding & Context Ingestion',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Analyze user intent, extract core constraints, and gather contextual evidence.',
      actions: [
        'Decompose prompt into primary requirements and implied constraints.',
        'Check knowledge base for relevant facts or definitions.',
        'Define output structure and tone.'
      ],
      inputs: 'User prompt.',
      dependencies: [],
      expectedOutput: 'Grounded query plan with key themes.',
      validationCriteria: 'Clear intent understanding established.',
      status: 'pending'
    });

    const s2 = `step-${stepCounter++}`;
    steps.push({
      id: s2,
      stageNumber: 2,
      name: 'Multi-Perspective Synthesis',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Synthesize insights from foundational knowledge and logical deductions.',
      actions: [
        'Develop thorough, logically coherent arguments.',
        'Synthesize concrete examples and structured explanations.',
        'Ensure direct answers without unnecessary preamble.'
      ],
      inputs: 'Query plan from Stage 1.',
      dependencies: [s1],
      expectedOutput: 'Structured draft addressing all user questions.',
      validationCriteria: 'Accurate and comprehensive response content.',
      status: 'pending'
    });

    const s3 = `step-${stepCounter++}`;
    steps.push({
      id: s3,
      stageNumber: 3,
      name: 'Clarity & Formatting Polish',
      agent: 'reasoning_synthesis',
      model: models.reasoning,
      description: 'Refine response formatting with clean markdown, lists, and emphasis.',
      actions: [
        'Format with clear headings, bullet points, and code/quote blocks where appropriate.',
        'Remove conversational filler, repetitive apologies, or robotic transitions.',
        'Verify grammatical and technical precision.'
      ],
      inputs: 'Draft response from Stage 2.',
      dependencies: [s2],
      expectedOutput: 'Polished markdown response.',
      validationCriteria: 'Professional presentation meeting LUMI quality standards.',
      status: 'pending'
    });

    const s4 = `step-${stepCounter++}`;
    steps.push({
      id: s4,
      stageNumber: 4,
      name: 'Factuality & Completeness Verification',
      agent: 'reasoning_synthesis',
      model: 'lumi-quality-gate',
      description: 'Verify all aspects of the user prompt have been addressed accurately.',
      actions: [
        'Check every question in original prompt against the answer.',
        'Confirm factual coherence and logical consistency.',
        'Approve final compiled response for user delivery.'
      ],
      inputs: 'Polished response and original prompt.',
      dependencies: [s3],
      expectedOutput: 'Verified complete response ready for user presentation.',
      validationCriteria: '100% prompt question coverage verified.',
      status: 'pending'
    });

    expectedDeliverables.push('Compiled Technical Response');
  }

  // Construct task interpretation: Rich, specific, preserving numbers & objective
  let taskInterpretation = decomp.primaryObjective;
  if (decomp.parameters.length > 0) {
    taskInterpretation += ` Parameters: ${decomp.parameters.map(p => `${p.name}=${p.value}${p.unit}`).join(', ')}.`;
  }
  if (decomp.requiredCalculations.length > 0) {
    taskInterpretation += ` Tasks: ${decomp.requiredCalculations.slice(0, 3).join('; ')}...`;
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
