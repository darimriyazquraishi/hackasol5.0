import fs from 'fs';
import path from 'path';

export interface StoredDocument {
  id: string;
  name: string;
  extension: string;
  sizeBytes: number;
  size: string;
  originalPath: string;
  uploadedAt: string;
  status: 'indexed' | 'processing' | 'failed';
  extractedTextLength: number;
  chunkCount: number;
  error?: string;
}

export interface KnowledgeChunk {
  id: string;
  docId: string;
  file: string;
  section: string;
  text: string;
  keywords: string[];
  createdAt: string;
}

export interface StoredVector {
  chunkId: string;
  docId: string;
  embedding?: number[];
  terms: Record<string, number>;
}

// Dedicated persistent local storage paths
const KNOWLEDGE_DIR = path.resolve(process.cwd(), 'data', 'knowledge');
const FILES_DIR = path.join(KNOWLEDGE_DIR, 'files');
const DOCS_FILE = path.join(KNOWLEDGE_DIR, 'documents.json');
const CHUNKS_FILE = path.join(KNOWLEDGE_DIR, 'chunks.json');
const VECTORS_FILE = path.join(KNOWLEDGE_DIR, 'vectors.json');

// Ensure storage directories exist
try {
  if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
  }
} catch (e) {
  console.error('Failed to initialize persistent knowledge storage directory:', e);
}

/**
 * Genuine Text Extraction Pipeline for multiple document types
 */
async function extractTextFromBuffer(filename: string, buffer: Buffer): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  // 1. PDF Extraction
  if (ext === '.pdf') {
    try {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const res = await parser.getText();
      return (res.text || '').trim();
    } catch (e: any) {
      throw new Error(`PDF text extraction failed: ${e.message}`);
    }
  }

  // 2. Word (.docx) Extraction
  if (ext === '.docx') {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);
      const docXml = await zip.file('word/document.xml')?.async('text');
      if (!docXml) return '';
      return docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    } catch (e: any) {
      throw new Error(`DOCX text extraction failed: ${e.message}`);
    }
  }

  // 3. PowerPoint (.pptx) Extraction
  if (ext === '.pptx') {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);
      const slideFiles = Object.keys(zip.files)
        .filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/[^0-9]/g, '') || '0', 10);
          const numB = parseInt(b.replace(/[^0-9]/g, '') || '0', 10);
          return numA - numB;
        });

      let slidesText = '';
      for (const sf of slideFiles) {
        const sXml = await zip.file(sf)?.async('text');
        if (sXml) {
          const slideClean = sXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (slideClean) slidesText += `[Slide ${sf}]: ${slideClean}\n\n`;
        }
      }
      return slidesText.trim();
    } catch (e: any) {
      throw new Error(`PPTX text extraction failed: ${e.message}`);
    }
  }

  // 4. Excel (.xlsx) Extraction
  if (ext === '.xlsx') {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      let sheetText = '';
      wb.eachSheet(sheet => {
        sheetText += `[Sheet: ${sheet.name}]\n`;
        sheet.eachRow(row => {
          if (Array.isArray(row.values)) {
            const rowContent = row.values
              .slice(1)
              .filter(v => v !== null && v !== undefined && v !== '')
              .map(v => (typeof v === 'object' && v && 'text' in (v as any) ? (v as any).text : String(v)))
              .join(' | ');
            if (rowContent) sheetText += rowContent + '\n';
          }
        });
        sheetText += '\n';
      });
      return sheetText.trim();
    } catch (e: any) {
      throw new Error(`XLSX text extraction failed: ${e.message}`);
    }
  }

  // 5. CSV, TXT, Markdown, etc.
  return buffer.toString('utf-8').trim();
}

/**
 * Format bytes into human readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Standard English stopwords for BM25 keyword discrimination
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
  'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if',
  'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor',
  'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until',
  'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
  'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves', 'tell', 'show', 'give', 'prepare',
  'create', 'make', 'generate', 'please'
]);

function tokenizeQuery(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

class RagKnowledgeEngine {
  private documents: StoredDocument[] = [];
  private chunks: KnowledgeChunk[] = [];
  private vectors: StoredVector[] = [];

  constructor() {
    this.loadFromDisk();
  }

  /**
   * Load strictly user-uploaded persistent data from disk.
   * Zero hardcoded or dummy documents.
   */
  public loadFromDisk() {
    try {
      // 1. Load documents registry
      if (fs.existsSync(DOCS_FILE)) {
        const rawDocs = fs.readFileSync(DOCS_FILE, 'utf-8');
        this.documents = JSON.parse(rawDocs);
      } else {
        this.documents = [];
      }

      // 2. Load chunk records
      if (fs.existsSync(CHUNKS_FILE)) {
        const rawChunks = fs.readFileSync(CHUNKS_FILE, 'utf-8');
        this.chunks = JSON.parse(rawChunks);
      } else {
        this.chunks = [];
      }

      // 3. Load vectors
      if (fs.existsSync(VECTORS_FILE)) {
        const rawVectors = fs.readFileSync(VECTORS_FILE, 'utf-8');
        this.vectors = JSON.parse(rawVectors);
      } else {
        this.vectors = [];
      }
    } catch (e) {
      console.error('Error loading persistent knowledge base from disk:', e);
      this.documents = [];
      this.chunks = [];
      this.vectors = [];
    }
  }

  /**
   * Persist current state synchronously to disk
   */
  public saveToDisk() {
    try {
      fs.writeFileSync(DOCS_FILE, JSON.stringify(this.documents, null, 2), 'utf-8');
      fs.writeFileSync(CHUNKS_FILE, JSON.stringify(this.chunks, null, 2), 'utf-8');
      fs.writeFileSync(VECTORS_FILE, JSON.stringify(this.vectors, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to commit knowledge data to disk:', e);
    }
  }

  public getDocuments(): StoredDocument[] {
    return this.documents;
  }

  public getChunks(): KnowledgeChunk[] {
    return this.chunks;
  }

  /**
   * Compute dense semantic embedding vector using local nomic-embed-text:latest (768 dimensions)
   */
  public async getEmbedding(text: string): Promise<number[]> {
    try {
      const res = await fetch('http://127.0.0.1:11434/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'nomic-embed-text:latest',
          prompt: text.slice(0, 1500),
          keep_alive: -1
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.embedding) && data.embedding.length > 0) {
          return data.embedding;
        }
      }
    } catch {
      // runtime offline or fallback
    }
    return [];
  }

  /**
   * Exact cosine similarity between two float vectors
   */
  public cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Ingest an authentic user-uploaded document:
   * 1. Validate file
   * 2. Retain original file on persistent disk
   * 3. Extract text
   * 4. Chunk document
   * 5. Generate embeddings/vectors
   * 6. Commit to persistent database
   */
  public async ingestDocumentFile(
    filename: string,
    fileBuffer: Buffer
  ): Promise<{ success: boolean; document: StoredDocument; chunksIndexed: number; error?: string }> {
    const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cleanName = path.basename(filename);
    const ext = path.extname(cleanName).toLowerCase();
    const storedFileName = `${docId}_${cleanName}`;
    const originalPath = path.join(FILES_DIR, storedFileName);

    // Save original file to persistent disk
    try {
      fs.writeFileSync(originalPath, fileBuffer);
    } catch (err: any) {
      return {
        success: false,
        document: {
          id: docId,
          name: cleanName,
          extension: ext,
          sizeBytes: fileBuffer.length,
          size: formatFileSize(fileBuffer.length),
          originalPath: '',
          uploadedAt: new Date().toISOString(),
          status: 'failed',
          extractedTextLength: 0,
          chunkCount: 0,
          error: `Failed to save file to disk: ${err.message}`
        },
        chunksIndexed: 0,
        error: `Disk write failed: ${err.message}`
      };
    }

    // Extract text
    let extractedText = '';
    try {
      extractedText = await extractTextFromBuffer(cleanName, fileBuffer);
    } catch (extractErr: any) {
      const failedDoc: StoredDocument = {
        id: docId,
        name: cleanName,
        extension: ext,
        sizeBytes: fileBuffer.length,
        size: formatFileSize(fileBuffer.length),
        originalPath,
        uploadedAt: new Date().toISOString(),
        status: 'failed',
        extractedTextLength: 0,
        chunkCount: 0,
        error: extractErr.message
      };
      this.documents.push(failedDoc);
      this.saveToDisk();
      return {
        success: false,
        document: failedDoc,
        chunksIndexed: 0,
        error: extractErr.message
      };
    }

    if (!extractedText.trim()) {
      const emptyDoc: StoredDocument = {
        id: docId,
        name: cleanName,
        extension: ext,
        sizeBytes: fileBuffer.length,
        size: formatFileSize(fileBuffer.length),
        originalPath,
        uploadedAt: new Date().toISOString(),
        status: 'failed',
        extractedTextLength: 0,
        chunkCount: 0,
        error: 'Document contained no extractable text.'
      };
      this.documents.push(emptyDoc);
      this.saveToDisk();
      return {
        success: false,
        document: emptyDoc,
        chunksIndexed: 0,
        error: 'No text found in document.'
      };
    }

    // Semantic Chunking
    const paragraphs = extractedText
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 10);

    const newChunks: KnowledgeChunk[] = [];
    const newVectors: StoredVector[] = [];
    let chunkSeq = 1;

    for (const para of paragraphs) {
      // If paragraph is long (> 800 chars), subdivide into sentences
      const subSegments: string[] = [];
      if (para.length > 800) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        let curr = '';
        for (const s of sentences) {
          if ((curr + ' ' + s).length > 600) {
            if (curr) subSegments.push(curr.trim());
            curr = s;
          } else {
            curr = curr ? `${curr} ${s}` : s;
          }
        }
        if (curr) subSegments.push(curr.trim());
      } else {
        subSegments.push(para);
      }

      for (const seg of subSegments) {
        const chunkId = `k-${docId}-${chunkSeq++}`;
        const terms = seg.toLowerCase().split(/\W+/).filter(t => t.length > 2);
        const uniqueKeywords = Array.from(new Set(terms)).slice(0, 20);

        // Term frequency map
        const termFreq: Record<string, number> = {};
        for (const t of terms) {
          termFreq[t] = (termFreq[t] || 0) + 1;
        }

        // Generate semantic vector embedding via nomic-embed-text:latest (768 dimensions)
        let emb: number[] = [];
        try {
          emb = await this.getEmbedding(seg);
        } catch {
          emb = [];
        }

        newChunks.push({
          id: chunkId,
          docId,
          file: cleanName,
          section: `Section ${chunkSeq - 1}`,
          text: seg,
          keywords: uniqueKeywords,
          createdAt: new Date().toISOString()
        });

        newVectors.push({
          chunkId,
          docId,
          embedding: emb,
          terms: termFreq
        });
      }
    }

    // If no chunks created, create one chunk for entire text
    if (newChunks.length === 0) {
      const chunkId = `k-${docId}-1`;
      const terms = extractedText.toLowerCase().split(/\W+/).filter(t => t.length > 2);
      let emb: number[] = [];
      try {
        emb = await this.getEmbedding(extractedText);
      } catch {
        emb = [];
      }

      newChunks.push({
        id: chunkId,
        docId,
        file: cleanName,
        section: 'General',
        text: extractedText,
        keywords: Array.from(new Set(terms)).slice(0, 20),
        createdAt: new Date().toISOString()
      });
      newVectors.push({
        chunkId,
        docId,
        embedding: emb,
        terms: terms.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>)
      });
    }

    // Commit to in-memory state
    const completedDoc: StoredDocument = {
      id: docId,
      name: cleanName,
      extension: ext,
      sizeBytes: fileBuffer.length,
      size: formatFileSize(fileBuffer.length),
      originalPath,
      uploadedAt: new Date().toISOString(),
      status: 'indexed',
      extractedTextLength: extractedText.length,
      chunkCount: newChunks.length
    };

    this.documents.push(completedDoc);
    this.chunks.push(...newChunks);
    this.vectors.push(...newVectors);

    // Commit synchronously to disk
    this.saveToDisk();

    return {
      success: true,
      document: completedDoc,
      chunksIndexed: newChunks.length
    };
  }

  /**
   * Delete an authentic user-uploaded document and purge all associated files,
   * chunks, and vectors from persistent storage.
   */
  public deleteDocument(docId: string): boolean {
    const docIndex = this.documents.findIndex(d => d.id === docId);
    if (docIndex === -1) return false;

    const doc = this.documents[docIndex];

    // 1. Delete original physical file
    try {
      if (doc.originalPath && fs.existsSync(doc.originalPath)) {
        fs.unlinkSync(doc.originalPath);
      }
    } catch (e) {
      console.error(`Failed to delete physical file ${doc.originalPath}:`, e);
    }

    // 2. Remove document from registry
    this.documents.splice(docIndex, 1);

    // 3. Remove chunks
    this.chunks = this.chunks.filter(c => c.docId !== docId);

    // 4. Remove vectors
    this.vectors = this.vectors.filter(v => v.docId !== docId);

    // 5. Commit to disk
    this.saveToDisk();

    return true;
  }

  /**
   * Hybrid Relevance Retrieval: BM25 Lexical Keyword Search + Dense Semantic Vector Search
   * Combines term frequency saturation, inverse document frequency (IDF), document length normalization,
   * exact phrase bonus, filename/title matching bonus, and dense cosine similarity.
   */
  public async search(query: string, topK: number = 3): Promise<Array<{ chunk: KnowledgeChunk; score: number }>> {
    if (this.chunks.length === 0) return [];

    let queryEmb: number[] = [];
    try {
      queryEmb = await this.getEmbedding(query);
    } catch {
      queryEmb = [];
    }

    return this.executeHybridSearch(query, queryEmb, topK);
  }

  /**
   * Synchronous Hybrid Search (uses pre-stored vectors and BM25)
   */
  public searchSync(query: string, topK: number = 3): Array<{ chunk: KnowledgeChunk; score: number }> {
    if (this.chunks.length === 0) return [];
    return this.executeHybridSearch(query, [], topK);
  }

  /**
   * Core Hybrid Search Execution Engine
   */
  private executeHybridSearch(
    query: string,
    queryEmb: number[] = [],
    topK: number = 3
  ): Array<{ chunk: KnowledgeChunk; score: number }> {
    const queryTerms = tokenizeQuery(query);
    if (queryTerms.length === 0) return [];

    const N = this.chunks.length;
    const rawQuery = query.toLowerCase().trim();
    const k1 = 1.2;
    const b = 0.75;

    // 1. Calculate corpus statistics for BM25
    const docTokens = this.chunks.map(c => tokenizeQuery(c.text + ' ' + (c.file || '') + ' ' + (c.section || '')));
    const docLengths = docTokens.map(t => t.length);
    const avgdl = docLengths.reduce((a, b) => a + b, 0) / (N || 1);

    const docTermFreqs = docTokens.map(tokens => {
      const map = new Map<string, number>();
      for (const t of tokens) map.set(t, (map.get(t) || 0) + 1);
      return map;
    });

    const termDocFreq = new Map<string, number>();
    for (const tokens of docTokens) {
      const unique = new Set(tokens);
      for (const t of unique) termDocFreq.set(t, (termDocFreq.get(t) || 0) + 1);
    }

    const scored: Array<{ chunk: KnowledgeChunk; score: number }> = [];

    for (let i = 0; i < N; i++) {
      const chunk = this.chunks[i];
      const dl = docLengths[i];
      const tfMap = docTermFreqs[i];
      const lowerFile = (chunk.file || '').toLowerCase();
      const lowerText = chunk.text.toLowerCase();

      let matchedTerms = 0;
      let bm25Sum = 0;
      let maxMatchedSum = 0;
      let fileMatches = 0;

      for (const term of queryTerms) {
        const df = termDocFreq.get(term) || 0;
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
        const maxTermScore = Math.max(0.5, idf) * (k1 + 1);

        const f = tfMap.get(term) || 0;
        const inText = lowerText.includes(term);
        const inFile = lowerFile.includes(term);

        if (inFile) fileMatches++;

        if (f > 0 || inText || inFile) {
          matchedTerms++;
          maxMatchedSum += maxTermScore;
          const actualF = Math.max(f, inFile ? 2 : 1);
          const num = actualF * (k1 + 1);
          const denom = actualF + k1 * (1 - b + b * (dl / avgdl));
          bm25Sum += Math.max(0.5, idf) * (num / denom);
        }
      }

      // If no query terms matched at all
      let bm25Score = 0;
      if (matchedTerms > 0 && maxMatchedSum > 0) {
        const termCoverage = matchedTerms / queryTerms.length;
        const bm25Quality = Math.min(1.0, bm25Sum / maxMatchedSum);
        const fileBonus = fileMatches > 0 ? (fileMatches / queryTerms.length) * 0.35 : 0;
        const phraseBonus = rawQuery.length > 5 && lowerText.includes(rawQuery) ? 0.25 : 0;

        let rawScore = termCoverage * (bm25Quality * 0.65 + 0.35) + fileBonus + phraseBonus;

        // Multi-term coverage penalty: downweight accidental single-word overlap when user asked multi-term query
        if (queryTerms.length >= 3 && matchedTerms === 1 && fileMatches === 0) {
          rawScore *= 0.3;
        } else if (queryTerms.length >= 2 && matchedTerms === 1 && fileMatches === 0) {
          rawScore *= 0.45;
        }

        bm25Score = Math.min(0.99, Math.max(0, rawScore));
      }

      // 2. Dense Semantic Vector Retrieval (when embeddings exist)
      let denseScore: number | null = null;
      const vector = this.vectors.find(v => v.chunkId === chunk.id);
      if (
        queryEmb.length > 0 &&
        vector &&
        Array.isArray(vector.embedding) &&
        vector.embedding.length > 0
      ) {
        denseScore = Math.max(0, this.cosineSimilarity(queryEmb, vector.embedding));
      }

      // 3. Hybrid Fusion: Convex combination when both modalities exist
      let finalScore = bm25Score;
      if (denseScore !== null) {
        if (bm25Score > 0) {
          finalScore = bm25Score * 0.5 + denseScore * 0.5;
          // Reciprocal Rank Agreement Bonus if both indicate relevance
          if (bm25Score >= 0.40 && denseScore >= 0.40) {
            finalScore = Math.min(0.99, finalScore + 0.05);
          }
        } else {
          // Conceptual match found by dense embeddings even if no literal keyword overlapped
          finalScore = denseScore * 0.8;
        }
      }

      if (finalScore >= 0.25) {
        scored.push({
          chunk,
          score: Math.min(0.99, +finalScore.toFixed(3))
        });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Automatic Organizational Guidelines Lookup
   * Checks if user's prompt matches any organizational rules in uploaded documents
   */
  public getRelevantGuidelines(taskPrompt: string): { guidelinesText: string; citations: KnowledgeChunk[] } {
    if (this.chunks.length === 0) {
      return { guidelinesText: '', citations: [] };
    }

    const matches = this.searchSync(taskPrompt, 3);
    const valid = matches.filter(m => m.score >= 0.30).map(m => m.chunk);

    if (valid.length === 0) {
      return { guidelinesText: '', citations: [] };
    }

    const guidelinesText = valid
      .map(m => `[From ${m.file} - ${m.section}]:\n${m.text}`)
      .join('\n\n');

    return { guidelinesText, citations: valid };
  }
}

export const ragEngine = new RagKnowledgeEngine();
