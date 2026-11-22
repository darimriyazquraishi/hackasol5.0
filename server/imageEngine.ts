import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

export interface ImageGenerationIntent {
  isImageGen: boolean;
  subject: string;
  format: 'png' | 'jpeg';
  width: number;
  height: number;
}

export interface GeneratedImageArtifact {
  id: string;
  filename: string;
  filePath: string;
  sizeBytes: number;
  sizeKb: string;
  format: 'png' | 'jpeg';
  width: number;
  height: number;
  mimeType: string;
  imageUrl: string;
  downloadUrl: string;
  prompt: string;
  subject: string;
  createdAt: string;
  verified: boolean;
  base64Data: string;
}

// In-memory image registry for direct image serving and download
export const IMAGE_REGISTRY = new Map<string, GeneratedImageArtifact>();

// Persistent artifacts directory
const ARTIFACTS_DIR = path.resolve(process.cwd(), 'scratch', 'artifacts');
try {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
} catch {
  // ignore
}

/**
 * Detect if user is requesting an actual image to be generated
 */
export function detectImageGenerationIntent(prompt: string): ImageGenerationIntent {
  const p = prompt.trim();
  const lower = p.toLowerCase();

  // Explicit patterns for image generation
  const pattern = /(?:generate|create|make|draw|render|produce|paint)\s+(?:an?\s+)?(?:image|picture|photo|illustration|graphic|art|sketch|drawing)\s+(?:of|about|depicting|showing|with)?\s*(.*)/i;
  const match = lower.match(pattern);

  if (match) {
    let subject = match[1]?.trim() || '';
    subject = subject.replace(/^(a|an|the)\s+/i, '').replace(/[.!?]+$/, '').trim();
    if (subject.length > 0) {
      return {
        isImageGen: true,
        subject,
        format: 'png',
        width: 1024,
        height: 1024
      };
    }
  }

  // Short direct commands like "draw a pizza", "image of a cat"
  const shortPattern = /^(?:draw|paint|sketch)\s+(?:an?\s+)?(.*)/i;
  const shortMatch = lower.match(shortPattern);
  if (shortMatch) {
    const subject = shortMatch[1].replace(/^(a|an|the)\s+/i, '').replace(/[.!?]+$/, '').trim();
    if (subject.length > 0) {
      return {
        isImageGen: true,
        subject,
        format: 'png',
        width: 1024,
        height: 1024
      };
    }
  }

  return {
    isImageGen: false,
    subject: '',
    format: 'png',
    width: 1024,
    height: 1024
  };
}

/**
 * Procedural Fallback Visual Scene Generators for common subjects
 */
function getProceduralScene(subject: string): string {
  const s = subject.toLowerCase();

  // 1. Pizza
  if (s.includes('pizza')) {
    return `
      <rect width="1024" height="1024" fill="#0c0a09"/>
      <defs>
        <radialGradient id="crust" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#eab308"/><stop offset="85%" stop-color="#ca8a04"/><stop offset="100%" stop-color="#854d0e"/>
        </radialGradient>
        <radialGradient id="cheese" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fef08a"/><stop offset="80%" stop-color="#facc15"/><stop offset="100%" stop-color="#eab308"/>
        </radialGradient>
        <radialGradient id="pep" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#ef4444"/><stop offset="70%" stop-color="#b91c1c"/><stop offset="100%" stop-color="#7f1d1d"/>
        </radialGradient>
        <filter id="sh" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.9"/>
        </filter>
      </defs>
      <circle cx="512" cy="512" r="390" fill="url(#crust)" filter="url(#sh)"/>
      <circle cx="512" cy="512" r="348" fill="#dc2626"/>
      <circle cx="512" cy="512" r="338" fill="url(#cheese)"/>
      <circle cx="512" cy="360" r="50" fill="url(#pep)" filter="url(#sh)"/>
      <circle cx="390" cy="450" r="48" fill="url(#pep)" filter="url(#sh)"/>
      <circle cx="630" cy="440" r="52" fill="url(#pep)" filter="url(#sh)"/>
      <circle cx="440" cy="580" r="50" fill="url(#pep)" filter="url(#sh)"/>
      <circle cx="580" cy="590" r="48" fill="url(#pep)" filter="url(#sh)"/>
      <circle cx="512" cy="500" r="54" fill="url(#pep)" filter="url(#sh)"/>
      <circle cx="340" cy="530" r="44" fill="url(#pep)" filter="url(#sh)"/>
      <circle cx="670" cy="540" r="46" fill="url(#pep)" filter="url(#sh)"/>
      <g fill="#15803d">
        <path d="M500,420 Q520,400 540,420 Q520,440 500,420 Z" transform="rotate(25 520 420)"/>
        <path d="M420,500 Q440,480 460,500 Q440,520 420,500 Z" transform="rotate(-35 440 500)"/>
        <path d="M600,510 Q620,490 640,510 Q620,530 600,510 Z" transform="rotate(45 620 510)"/>
        <path d="M480,620 Q500,600 520,620 Q500,640 480,620 Z" transform="rotate(-15 500 620)"/>
      </g>
    `;
  }

  // 2. Sunset or Landscape
  if (s.includes('sunset') || s.includes('mountain') || s.includes('landscape') || s.includes('sky')) {
    return `
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f172a"/><stop offset="30%" stop-color="#311042"/><stop offset="60%" stop-color="#c2410c"/><stop offset="85%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#fef08a"/>
        </linearGradient>
        <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b0764"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient>
        <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#09090b"/></linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#sky)"/>
      <circle cx="512" cy="620" r="140" fill="#fffbeb" opacity="0.95"/>
      <polygon points="-50,850 320,450 680,850" fill="url(#m1)"/>
      <polygon points="380,850 720,480 1100,850" fill="url(#m1)"/>
      <polygon points="120,1050 512,600 950,1050" fill="url(#m2)"/>
      <rect y="840" width="1024" height="200" fill="#09090b"/>
    `;
  }

  // 3. Futuristic / Tech / AI / Robot
  if (s.includes('robot') || s.includes('cyberpunk') || s.includes('ai') || s.includes('tech') || s.includes('city')) {
    return `
      <defs>
        <linearGradient id="gridBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#030712"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
        <linearGradient id="neon" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#06b6d4"/><stop offset="50%" stop-color="#a855f7"/><stop offset="100%" stop-color="#ec4899"/></linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#gridBg)"/>
      <circle cx="512" cy="460" r="220" fill="none" stroke="url(#neon)" stroke-width="8" opacity="0.8"/>
      <circle cx="512" cy="460" r="180" fill="none" stroke="#06b6d4" stroke-width="4" stroke-dasharray="20 10"/>
      <circle cx="512" cy="460" r="120" fill="#1e1b4b" stroke="#ec4899" stroke-width="6"/>
      <circle cx="512" cy="460" r="40" fill="#06b6d4"/>
      <path d="M200,800 L512,680 L824,800" fill="none" stroke="url(#neon)" stroke-width="6"/>
      <line x1="100" y1="920" x2="924" y2="920" stroke="#06b6d4" stroke-width="2" opacity="0.4"/>
      <line x1="200" y1="960" x2="824" y2="960" stroke="#a855f7" stroke-width="2" opacity="0.4"/>
    `;
  }

  // Generic Elegant Vector Composition
  return `
    <defs>
      <linearGradient id="bgGen" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#18181b"/><stop offset="100%" stop-color="#09090b"/></linearGradient>
      <linearGradient id="taupeGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#987654"/><stop offset="100%" stop-color="#d4af37"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="16" result="c"/><feMerge><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="1024" height="1024" fill="url(#bgGen)"/>
    <circle cx="512" cy="480" r="240" fill="none" stroke="url(#taupeGold)" stroke-width="6" filter="url(#glow)"/>
    <circle cx="512" cy="480" r="190" fill="#1c1917" stroke="#765B43" stroke-width="4"/>
    <polygon points="512,340 620,530 404,530" fill="url(#taupeGold)" opacity="0.85"/>
    <circle cx="512" cy="480" r="45" fill="#f5f4f1"/>
    <text x="512" y="800" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#f5f4f1" text-anchor="middle" letter-spacing="2">${subject.toUpperCase()}</text>
    <text x="512" y="840" font-family="Arial, sans-serif" font-size="16" fill="#987654" text-anchor="middle">LUMI SYNTHETIC IMAGE ASSET</text>
  `;
}

/**
 * Local Neural Visual Scene Synthesizer
 * Uses local model to generate custom SVG scene elements, then compiles with procedural guarantees
 */
async function generateSceneSvg(
  subject: string,
  callOllama: (model: string, prompt: string, systemPrompt?: string) => Promise<string>,
  targetModel: string
): Promise<string> {
  const proceduralInner = getProceduralScene(subject);

  try {
    const systemPrompt = `You are an SVG graphics designer. Output ONLY valid SVG XML element tags (like <rect>, <circle>, <polygon>, <path>, <linearGradient>, etc.) representing a visual illustration of: "${subject}". Do NOT include conversational text, explanation or outer <svg> wrapper tags.`;
    const userPrompt = `Create an artistic visual illustration of: "${subject}". Provide SVG shapes, colors, gradients and details.`;

    const modelResponse = await callOllama(targetModel, userPrompt, systemPrompt);
    const cleaned = modelResponse.replace(/```(?:xml|svg)?/gi, '').replace(/```/g, '').trim();

    if (cleaned.includes('<circle') || cleaned.includes('<rect') || cleaned.includes('<path') || cleaned.includes('<polygon')) {
      const wrapped = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
        <rect width="1024" height="1024" fill="#09090b"/>
        ${cleaned}
      </svg>`;
      // Quick test if it parses with Resvg
      try {
        const testResvg = new Resvg(wrapped, { fitTo: { mode: 'width', value: 1024 } });
        testResvg.render();
        return wrapped;
      } catch {
        // model SVG had syntax errors; fall back to procedural scene
      }
    }
  } catch {
    // Model timed out or failed; use procedural scene
  }

  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    ${proceduralInner}
  </svg>`;
}

/**
 * Master Image Generation Pipeline
 * Generates an actual, non-empty, decoded PNG image artifact.
 */
export async function executeImageGeneration(
  intent: ImageGenerationIntent,
  callOllama: (model: string, prompt: string, systemPrompt?: string) => Promise<string>,
  targetModel: string,
  conversationId?: string
): Promise<GeneratedImageArtifact> {
  const { subject } = intent;
  const imageId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const cleanSubject = subject.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 30);
  const filename = `${cleanSubject || 'generated_image'}_${Date.now()}.png`;
  const filePath = path.join(ARTIFACTS_DIR, filename);

  // 1. Generate visual scene
  const svg = await generateSceneSvg(subject, callOllama, targetModel);

  // 2. Render to PNG buffer using Resvg
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1024 }
  });
  const rendered = resvg.render();
  const pngBuffer = Buffer.from(rendered.asPng());

  // 3. Strict Image Decoder Validation
  const decoded = PNG.sync.read(pngBuffer);
  if (!decoded.width || !decoded.height || decoded.width === 0 || decoded.height === 0 || pngBuffer.length < 1000) {
    throw new Error('Image decoder validation failed: output buffer does not contain a valid decodable raster image.');
  }

  // 4. Save to persistent artifacts directory
  fs.writeFileSync(filePath, pngBuffer);

  const sizeKb = `${(pngBuffer.length / 1024).toFixed(1)} KB`;
  const artifact: GeneratedImageArtifact = {
    id: imageId,
    filename,
    filePath,
    sizeBytes: pngBuffer.length,
    sizeKb,
    format: 'png',
    width: decoded.width,
    height: decoded.height,
    mimeType: 'image/png',
    imageUrl: `/api/images/${imageId}`,
    downloadUrl: `/api/deliverables/download/${imageId}`,
    prompt: intent.subject,
    subject,
    createdAt: new Date().toISOString(),
    verified: true,
    base64Data: pngBuffer.toString('base64')
  };

  // Register in memory cache
  IMAGE_REGISTRY.set(imageId, artifact);

  return artifact;
}
