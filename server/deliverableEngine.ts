import pptxgen from 'pptxgenjs';
import ExcelJS from 'exceljs';
import * as docx from 'docx';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export type DeliverableType = 'pptx' | 'xlsx' | 'docx' | 'pdf' | 'csv' | 'markdown';

export interface DeliverableIntent {
  isDeliverable: boolean;
  type: DeliverableType;
  topic: string;
  title: string;
  suggestedFilename: string;
}

export interface DeliverableFile {
  id: string;
  name: string;
  size: string;
  type: DeliverableType;
  content: string; // base64 string
  buffer: Buffer;
  mimeType: string;
  downloadUrl: string;
  description: string;
  createdAt: string;
}

// In-memory deliverable cache for HTTP downloads
export const DELIVERABLE_REGISTRY = new Map<string, DeliverableFile>();

// Ensure disk storage directory exists
const DELIVERABLES_DIR = path.resolve(process.cwd(), 'scratch', 'deliverables');
try {
  if (!fs.existsSync(DELIVERABLES_DIR)) {
    fs.mkdirSync(DELIVERABLES_DIR, { recursive: true });
  }
} catch {
  // ignore
}

/**
 * Intelligent Deliverable Intent Detection
 * Analyzes the user's prompt to determine if an actual native file deliverable is requested.
 */
export function detectDeliverableIntent(prompt: string): DeliverableIntent {
  const p = prompt.trim();
  const lower = p.toLowerCase();

  // Explicit or strong deliverable patterns
  const isPptx = /(?:powerpoint|power\s*point|\bpptx?\b|presentation|slides?\b|slide\s*deck|pitch\s*deck)/i.test(lower);
  const isXlsx = /(?:excel|\bxlsx?\b|spreadsheet|workbook|\bsheet\b|expenses?\s*(?:sheet|tracker)|financial\s*(?:model|tracker|sheet)|budget\s*(?:sheet|tracker)|project\s*timeline)/i.test(lower);
  const isDocx = /(?:\bdocx?\b|word\s*doc(?:ument)?|formal\s*(?:report|proposal)|business\s*proposal|research\s*report|technical\s*report|project\s*charter)/i.test(lower);
  const isPdf = /(?:\bpdf\b|portable\s*document|printable\s*report|export\s*(?:to\s*)?pdf|convert\s*(?:.*to\s*)?pdf)/i.test(lower);
  const isCsv = /(?:\bcsv\b|comma\s*separated|export\s*(?:to\s*)?csv|tabular\s*data|data\s*table\s*file)/i.test(lower);

  // Action verbs indicating file creation
  const hasCreationIntent = /(?:generate|create|make|build|export|prepare|write|produce|compile|convert|give\s*me|download)\b/i.test(lower);

  const matched = (isPptx || isXlsx || isDocx || isPdf || isCsv) && (hasCreationIntent || /\.(pptx|xlsx|docx|pdf|csv)\b/i.test(lower));

  if (!matched) {
    return {
      isDeliverable: false,
      type: 'markdown',
      topic: '',
      title: '',
      suggestedFilename: ''
    };
  }

  let type: DeliverableType = 'pptx';
  if (isPptx) type = 'pptx';
  else if (isXlsx) type = 'xlsx';
  else if (isDocx) type = 'docx';
  else if (isPdf) type = 'pdf';
  else if (isCsv) type = 'csv';

  // Extract clean topic
  let topic = p
    .replace(/^(can\s+you\s+)?(please\s+)?(generate|create|make|build|prepare|write|give\s+me)\s+(an?\s+)?/i, '')
    .replace(/(powerpoint|power\s*point|presentation|ppt|pptx|excel|spreadsheet|sheet|xlsx|docx?|word\s*document|pdf|csv|slides?)\s+(on|about|for|of)?\s*/i, '')
    .replace(/[?!.]+$/, '')
    .trim();

  if (!topic || topic.length < 2) {
    topic = 'Deliverable_Document';
  }

  // Format title
  const cleanTitle = topic
    .split(/\s+/)
    .slice(0, 7)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const slug = cleanTitle
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 40)
    .replace(/^_+|_+$/g, '');

  return {
    isDeliverable: true,
    type,
    topic,
    title: cleanTitle || 'LUMI_Deliverable',
    suggestedFilename: `${slug || 'Deliverable'}.${type}`
  };
}

/**
 * 1. REAL POWERPOINT (PPTX) GENERATOR
 */
export async function buildPptxFile(
  title: string,
  topic: string,
  rawModelContent: string
): Promise<Buffer> {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  // 1. Title Slide (Deep Black & Warm Taupe LUMI Palette)
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: '080808' };

  titleSlide.addText(title, {
    x: 1.0,
    y: 2.0,
    w: 8.5,
    h: 1.6,
    fontSize: 34,
    color: 'F5F4F1',
    bold: true,
    fontFace: 'Arial'
  });

  titleSlide.addText('Prepared with LUMI Sovereign AI Intelligence', {
    x: 1.0,
    y: 3.6,
    w: 8.5,
    h: 0.6,
    fontSize: 16,
    color: '987654',
    fontFace: 'Arial'
  });

  titleSlide.addText(`Date: ${new Date().toLocaleDateString()} | Local Unified Multimodal Intelligence`, {
    x: 1.0,
    y: 4.8,
    w: 8.5,
    h: 0.4,
    fontSize: 11,
    color: '9C9C9C',
    fontFace: 'Arial'
  });

  // 2. Parse structured slides from model content
  const slidesData: Array<{ heading: string; points: string[] }> = [];

  // Try parsing JSON if model returned JSON
  try {
    const jsonMatch = rawModelContent.match(/\{[\s\S]*"slides"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.slides)) {
        for (const s of parsed.slides) {
          slidesData.push({
            heading: s.title || s.heading || 'Key Insights',
            points: Array.isArray(s.bullets) ? s.bullets : [s.content || s.description || '']
          });
        }
      }
    }
  } catch {
    // fallback to markdown parsing below
  }

  // If JSON parsing was not applicable, parse markdown/text headers and bullet points
  if (slidesData.length === 0) {
    const lines = rawModelContent.split('\n');
    let currentSlide: { heading: string; points: string[] } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      const slideMatch = trimmed.match(/^(?:#+|\*\*|Slide\s+\d+:?)\s*(.*)/i);
      if (slideMatch && slideMatch[1] && slideMatch[1].length > 3) {
        if (currentSlide && currentSlide.points.length > 0) {
          slidesData.push(currentSlide);
        }
        currentSlide = {
          heading: slideMatch[1].replace(/[*#]/g, '').trim(),
          points: []
        };
      } else if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
        const pointText = trimmed.replace(/^[-•*\d.]+\s*/, '').replace(/[*_]/g, '').trim();
        if (pointText.length > 2) {
          if (!currentSlide) {
            currentSlide = { heading: title, points: [] };
          }
          currentSlide.points.push(pointText);
        }
      } else if (trimmed.length > 15 && currentSlide && currentSlide.points.length < 6) {
        currentSlide.points.push(trimmed.replace(/[*_]/g, ''));
      }
    }

    if (currentSlide && currentSlide.points.length > 0) {
      slidesData.push(currentSlide);
    }
  }

  // Fallback slides if content was minimal
  if (slidesData.length === 0) {
    slidesData.push(
      {
        heading: 'Executive Overview',
        points: [
          `Core analysis and fundamental principles of ${topic}`,
          'Critical drivers, strategic context, and foundational requirements',
          'Primary functional roles and domain impacts'
        ]
      },
      {
        heading: 'Key Dimensions & Functions',
        points: [
          'Direct biological, industrial, and ecological significance',
          'Systemic dependencies and essential operational considerations',
          'Global patterns, distribution dynamics, and resource availability'
        ]
      },
      {
        heading: 'Strategic Implications & Outlook',
        points: [
          'Long-term sustainability and governance requirements',
          'Actionable recommendations and stewardship practices',
          'Summary of strategic priorities moving forward'
        ]
      }
    );
  }

  // 3. Add each content slide
  for (let i = 0; i < slidesData.length; i++) {
    const sData = slidesData[i];
    const slide = pptx.addSlide();
    slide.background = { color: '080808' };

    // Slide Header
    slide.addText(sData.heading, {
      x: 0.8,
      y: 0.6,
      w: 8.8,
      h: 0.7,
      fontSize: 22,
      color: 'F5F4F1',
      bold: true,
      fontFace: 'Arial'
    });

    // Accent line under title
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8,
      y: 1.35,
      w: 8.4,
      h: 0.02,
      fill: { color: '987654' },
      line: { color: '987654', width: 0 }
    });

    // Content Bullets
    const textItems = sData.points.slice(0, 6).map(pt => ({
      text: `${pt}\n`,
      options: {
        fontSize: 15,
        color: 'D5D2CC',
        bullet: true,
        breakLine: true,
        fontFace: 'Arial'
      }
    }));

    slide.addText(textItems, {
      x: 0.8,
      y: 1.6,
      w: 8.8,
      h: 3.4,
      valign: 'top',
      lineSpacing: 26
    });

    // Slide Footer
    slide.addText(`LUMI AI Workbench • Slide ${i + 2} of ${slidesData.length + 1}`, {
      x: 0.8,
      y: 5.1,
      w: 8.4,
      h: 0.3,
      fontSize: 10,
      color: '9C9C9C',
      fontFace: 'Arial'
    });
  }

  const rawBuffer = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(rawBuffer as ArrayBuffer);
}

/**
 * 2. REAL EXCEL (XLSX) GENERATOR
 */
export async function buildXlsxFile(
  title: string,
  topic: string,
  rawModelContent: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LUMI Sovereign AI';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title.slice(0, 25) || 'Analysis');

  // Try parsing tabular data
  let headers: string[] = [];
  let rows: any[][] = [];

  // 1. Try parsing JSON table
  try {
    const jsonMatch = rawModelContent.match(/\{[\s\S]*"columns"[\s\S]*"rows"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) {
        headers = parsed.columns;
        rows = parsed.rows;
      }
    }
  } catch {
    // fallback to markdown table below
  }

  // 2. Try parsing Markdown table
  if (headers.length === 0) {
    const lines = rawModelContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
        if (cells.length >= 2) {
          if (cells.every(c => /^[-:]+$/.test(c))) {
            // separator line, skip
            continue;
          }
          if (headers.length === 0) {
            headers = cells;
          } else {
            rows.push(cells.map(c => {
              const num = Number(c.replace(/[$,]/g, ''));
              return !isNaN(num) && c !== '' ? num : c;
            }));
          }
        }
      }
    }
  }

  // 3. Fallback table if model didn't return tabular format
  if (headers.length === 0 || rows.length === 0) {
    headers = ['Item / Metric', 'Category', 'Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4', 'Full Year'];
    rows = [
      ['Core Allocation', 'Infrastructure', 2400, 2600, 2500, 2700, 10200],
      ['Hardware & Compute', 'Operations', 4800, 1200, 950, 1100, 8050],
      ['Data Validation & RAG', 'Development', 1500, 1550, 1600, 1650, 6300],
      ['Security & Compliance', 'Governance', 900, 950, 950, 1000, 3800],
      ['Contingency Reserve', 'Finance', 600, 600, 600, 600, 2400]
    ];
  }

  // Configure columns
  sheet.columns = headers.map(h => ({
    header: h,
    key: h.toLowerCase().replace(/\s+/g, '_'),
    width: Math.max(16, h.length + 6)
  }));

  // Style Header Row
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { bold: true, color: { argb: 'FFF5F4F1' }, size: 11, name: 'Segoe UI' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF191919' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };

  // Add rows with clean styling
  for (let i = 0; i < rows.length; i++) {
    const row = sheet.addRow(rows[i]);
    row.height = 20;
    row.font = { color: { argb: 'FF262626' }, size: 10, name: 'Segoe UI' };
    row.alignment = { vertical: 'middle' };

    // Alternate shading
    if (i % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9F9F8' }
      };
    }

    // Number formatting for numeric cells
    row.eachCell((cell, colNum) => {
      if (typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      };
    });
  }

  const rawBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(rawBuffer);
}

/**
 * 3. REAL WORD (DOCX) GENERATOR
 */
export async function buildDocxFile(
  title: string,
  topic: string,
  rawModelContent: string
): Promise<Buffer> {
  const sections: docx.Paragraph[] = [];

  // Title
  sections.push(
    new docx.Paragraph({
      text: title,
      heading: docx.HeadingLevel.TITLE,
      alignment: docx.AlignmentType.CENTER,
      spacing: { after: 120 }
    }),
    new docx.Paragraph({
      text: 'LUMI Sovereign AI • Formal Intelligence Report',
      alignment: docx.AlignmentType.CENTER,
      spacing: { after: 360 }
    })
  );

  const lines = rawModelContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ') || trimmed.startsWith('## ')) {
      sections.push(
        new docx.Paragraph({
          text: trimmed.replace(/^#+\s*/, ''),
          heading: docx.HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 }
        })
      );
    } else if (trimmed.startsWith('### ')) {
      sections.push(
        new docx.Paragraph({
          text: trimmed.replace(/^#+\s*/, ''),
          heading: docx.HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 80 }
        })
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      sections.push(
        new docx.Paragraph({
          text: trimmed.replace(/^[-•*]\s*/, ''),
          bullet: { level: 0 },
          spacing: { after: 80 }
        })
      );
    } else {
      sections.push(
        new docx.Paragraph({
          text: trimmed.replace(/[*_`]/g, ''),
          spacing: { after: 120, line: 276 }
        })
      );
    }
  }

  const doc = new docx.Document({
    creator: 'LUMI Sovereign AI',
    title,
    sections: [
      {
        properties: {},
        children: sections
      }
    ]
  });

  return await docx.Packer.toBuffer(doc);
}

/**
 * 4. REAL PDF GENERATOR
 */
export async function buildPdfFile(
  title: string,
  topic: string,
  rawModelContent: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header rule
    doc.fontSize(8).fillColor('#9C9C9C').text('LUMI SOVEREIGN AI INTELLIGENCE DELIVERABLE', { align: 'right' });
    doc.moveTo(50, 65).lineTo(560, 65).strokeColor('#987654').lineWidth(1.5).stroke();
    doc.moveDown(2);

    // Title
    doc.fontSize(22).fillColor('#080808').font('Helvetica-Bold').text(title, { align: 'left' });
    doc.fontSize(11).fillColor('#765B43').font('Helvetica').text(`Topic: ${topic} • Generated: ${new Date().toLocaleDateString()}`);
    doc.moveDown(1.5);

    // Body content parsing
    const lines = rawModelContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        doc.moveDown(0.5);
        continue;
      }

      if (trimmed.startsWith('# ') || trimmed.startsWith('## ')) {
        doc.moveDown(0.8);
        doc.fontSize(14).fillColor('#191919').font('Helvetica-Bold').text(trimmed.replace(/^#+\s*/, ''));
        doc.moveDown(0.3);
      } else if (trimmed.startsWith('### ')) {
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#765B43').font('Helvetica-Bold').text(trimmed.replace(/^#+\s*/, ''));
        doc.moveDown(0.2);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
        doc.fontSize(10).fillColor('#333333').font('Helvetica').text(`•  ${trimmed.replace(/^[-•*]\s*/, '')}`, {
          indent: 15,
          lineGap: 3
        });
      } else {
        doc.fontSize(10).fillColor('#333333').font('Helvetica').text(trimmed.replace(/[*_`]/g, ''), {
          lineGap: 4
        });
      }
    }

    // Footer
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#9C9C9C').text(`LUMI Platform • Page ${i + 1} of ${range.count}`, 50, 740, {
        align: 'center',
        width: 510
      });
    }

    doc.end();
  });
}

/**
 * 5. REAL CSV GENERATOR
 */
export function buildCsvFile(
  title: string,
  topic: string,
  rawModelContent: string
): Buffer {
  let csvText = '';

  // Check if model gave csv
  if (rawModelContent.includes(',') && rawModelContent.includes('\n')) {
    const csvMatch = rawModelContent.match(/```(?:csv)?\s*([\s\S]*?)```/);
    if (csvMatch) {
      csvText = csvMatch[1].trim();
    } else {
      csvText = rawModelContent.trim();
    }
  }

  // Fallback to table extraction or default
  if (!csvText || !csvText.includes(',')) {
    csvText = [
      'Category,Metric,Q1,Q2,Q3,Q4,Annual_Total',
      'Compute,GPU Allocation,3200,3200,3200,3200,12800',
      'Memory,RAM Usage,4200,4300,4100,4400,17000',
      'Storage,Vector NVMe Commit,150,160,165,170,645',
      'Inference,Queries Served,840,920,1100,1250,4110'
    ].join('\n');
  }

  return Buffer.from(csvText, 'utf-8');
}

/**
 * Orchestrator: Generate Deliverable File from intent & model
 */
export async function generateDeliverable(
  intent: DeliverableIntent,
  prompt: string,
  callOllama: (model: string, prompt: string, systemPrompt?: string) => Promise<string>,
  targetModel: string,
  guidelinesText?: string
): Promise<{ deliverable: DeliverableFile; summary: string }> {
  const { type, topic, title, suggestedFilename } = intent;

  let modelSystemPrompt = '';
  let modelUserPrompt = '';

  const guidelineInstruction = guidelinesText
    ? `\n\nAdhere strictly to these organizational guidelines and formatting standards:\n${guidelinesText}`
    : '';

  if (type === 'pptx') {
    modelSystemPrompt = `You are LUMI Presentation Architect. Generate structured PowerPoint slide content. Provide a Title, Subtitle, and 5-6 thematic slides with 3-4 bullet points per slide. Focus on accurate technical and domain concepts.${guidelineInstruction}`;
    modelUserPrompt = `Generate a comprehensive presentation outline for: "${topic}". Include title and structured slides with concise, informative bullet points.${guidelineInstruction}`;
  } else if (type === 'xlsx') {
    modelSystemPrompt = `You are LUMI Data Analyst. Generate structured spreadsheet data with realistic columns, categories, and numerical metrics formatted as a markdown table with headers and data rows.${guidelineInstruction}`;
    modelUserPrompt = `Generate structured tabular spreadsheet data for: "${topic}". Include 5-8 columns and at least 6 detailed rows of numerical data.${guidelineInstruction}`;
  } else if (type === 'docx' || type === 'pdf') {
    modelSystemPrompt = `You are LUMI Technical Writer. Write a complete, formal, highly detailed document with an Executive Summary, Key Dimensions, Methodological Considerations, and Strategic Recommendations formatted in Markdown with headers (# and ##) and bullet points.${guidelineInstruction}`;
    modelUserPrompt = `Write a comprehensive, professional report on: "${topic}". Provide detailed sections and concrete insights.${guidelineInstruction}`;
  } else if (type === 'csv') {
    modelSystemPrompt = `You are LUMI Data Engineer. Output ONLY valid CSV text with a header row and realistic data rows. Do not include markdown commentary.${guidelineInstruction}`;
    modelUserPrompt = `Generate a CSV dataset for: "${topic}". Include header and at least 6 data rows.${guidelineInstruction}`;
  }

  // 1. Generate structured content with local model
  let rawContent = '';
  try {
    rawContent = await callOllama(targetModel, modelUserPrompt, modelSystemPrompt);
  } catch (err: any) {
    rawContent = `# ${title}\n\nComprehensive analysis regarding ${topic}.\n\n- Key dimension 1\n- Key dimension 2\n- Key dimension 3`;
  }

  // 2. Synthesize native binary file
  let buffer: Buffer;
  let mimeType = 'application/octet-stream';

  if (type === 'pptx') {
    buffer = await buildPptxFile(title, topic, rawContent);
    mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  } else if (type === 'xlsx') {
    buffer = await buildXlsxFile(title, topic, rawContent);
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (type === 'docx') {
    buffer = await buildDocxFile(title, topic, rawContent);
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (type === 'pdf') {
    buffer = await buildPdfFile(title, topic, rawContent);
    mimeType = 'application/pdf';
  } else if (type === 'csv') {
    buffer = buildCsvFile(title, topic, rawContent);
    mimeType = 'text/csv';
  } else {
    buffer = Buffer.from(rawContent, 'utf-8');
    mimeType = 'text/markdown';
  }

  const fileId = `deliv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const sizeKb = (buffer.length / 1024).toFixed(1);
  const sizeStr = buffer.length > 1024 * 1024 ? `${(buffer.length / (1024 * 1024)).toFixed(1)} MB` : `${sizeKb} KB`;

  // Write copy to disk
  try {
    const diskPath = path.join(DELIVERABLES_DIR, suggestedFilename);
    fs.writeFileSync(diskPath, buffer);
  } catch {
    // ignore
  }

  const deliverable: DeliverableFile = {
    id: fileId,
    name: suggestedFilename,
    size: sizeStr,
    type,
    content: buffer.toString('base64'),
    buffer,
    mimeType,
    downloadUrl: `/api/deliverables/download/${fileId}`,
    description: `Native ${type.toUpperCase()} deliverable for "${title}".`,
    createdAt: new Date().toISOString()
  };

  // Register in memory
  DELIVERABLE_REGISTRY.set(fileId, deliverable);

  // Summary message for chat
  let summary = '';
  if (type === 'pptx') {
    summary = `I have generated your native PowerPoint presentation **"${suggestedFilename}"** (${sizeStr}). It includes a custom LUMI title slide, formatted thematic sections, and structured bullet points based on your request.`;
  } else if (type === 'xlsx') {
    summary = `I have created your native Excel workbook **"${suggestedFilename}"** (${sizeStr}). It features styled header rows, formatted numerical columns, alternating grid lines, and data metrics ready for analysis.`;
  } else if (type === 'docx') {
    summary = `I have prepared your formal Word document **"${suggestedFilename}"** (${sizeStr}) with complete typographic hierarchy, executive summary, and structured analytical sections.`;
  } else if (type === 'pdf') {
    summary = `I have compiled your executive PDF report **"${suggestedFilename}"** (${sizeStr}) with headers, formatted sections, and page numbering.`;
  } else if (type === 'csv') {
    summary = `I have generated your CSV data export **"${suggestedFilename}"** (${sizeStr}) containing structured tabular records.`;
  } else {
    summary = `I have generated your deliverable file **"${suggestedFilename}"** (${sizeStr}).`;
  }

  return { deliverable, summary };
}
