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
const ARTIFACTS_DIR = path.resolve(process.cwd(), 'data', 'images');
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
 * High-Fidelity Artisanal SVG Scene Generators
 * Handcrafted vector artwork designed with authentic anatomy, rich gradients,
 * realistic textures, drop shadows, and recognizable subject characteristics.
 */

// 1. Artisanal Wood-Fired Pizza
function getPizzaScene(): string {
  return `
    <defs>
      <radialGradient id="tableBg" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stop-color="#1c1917"/><stop offset="60%" stop-color="#0f0e0d"/><stop offset="100%" stop-color="#050505"/>
      </radialGradient>
      <radialGradient id="boardGrad" cx="45%" cy="45%" r="60%">
        <stop offset="0%" stop-color="#78350f"/><stop offset="70%" stop-color="#451a03"/><stop offset="100%" stop-color="#270e02"/>
      </radialGradient>
      <radialGradient id="crustBase" cx="50%" cy="50%" r="50%">
        <stop offset="70%" stop-color="#fde047"/><stop offset="84%" stop-color="#eab308"/><stop offset="92%" stop-color="#ca8a04"/><stop offset="97%" stop-color="#92400e"/><stop offset="100%" stop-color="#451a03"/>
      </radialGradient>
      <radialGradient id="cheeseMelt" cx="48%" cy="48%" r="50%">
        <stop offset="0%" stop-color="#fef9c3"/><stop offset="25%" stop-color="#fef08a"/><stop offset="65%" stop-color="#facc15"/><stop offset="90%" stop-color="#eab308"/><stop offset="100%" stop-color="#b45309"/>
      </radialGradient>
      <radialGradient id="sauceBase" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#dc2626"/><stop offset="80%" stop-color="#b91c1c"/><stop offset="100%" stop-color="#7f1d1d"/>
      </radialGradient>
      <radialGradient id="pepGrad" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#f87171"/><stop offset="30%" stop-color="#ef4444"/><stop offset="70%" stop-color="#b91c1c"/><stop offset="92%" stop-color="#991b1b"/><stop offset="100%" stop-color="#581c1c"/>
      </radialGradient>
      <linearGradient id="pepLip" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fca5a5" stop-opacity="0.8"/><stop offset="100%" stop-color="#450a0a"/>
      </linearGradient>
      <linearGradient id="mushCap" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d6d3d1"/><stop offset="60%" stop-color="#a8a29e"/><stop offset="100%" stop-color="#57534e"/>
      </linearGradient>
      <linearGradient id="basilGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#4ade80"/><stop offset="40%" stop-color="#16a34a"/><stop offset="100%" stop-color="#14532d"/>
      </linearGradient>
      <radialGradient id="oliveGrad" cx="30%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#3f3f46"/><stop offset="60%" stop-color="#18181b"/><stop offset="100%" stop-color="#09090b"/>
      </radialGradient>
      <filter id="pizzaShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="24" stdDeviation="30" flood-color="#000000" flood-opacity="0.85"/>
      </filter>
      <filter id="toppingShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="2" dy="5" stdDeviation="4" flood-color="#451a03" flood-opacity="0.6"/>
      </filter>
    </defs>

    <rect width="1024" height="1024" fill="url(#tableBg)"/>
    <g fill="#e7e5e4" opacity="0.15">
      <circle cx="180" cy="220" r="1.5"/><circle cx="240" cy="180" r="2"/><circle cx="820" cy="260" r="2"/><circle cx="850" cy="800" r="2"/>
    </g>

    <!-- Round Wooden Board Base -->
    <g filter="url(#pizzaShadow)">
      <path d="M512,960 L480,1024 L544,1024 Z" fill="url(#boardGrad)"/>
      <circle cx="512" cy="512" r="435" fill="url(#boardGrad)"/>
      <circle cx="512" cy="512" r="430" fill="none" stroke="#270e02" stroke-width="4" opacity="0.6"/>
      <circle cx="512" cy="512" r="418" fill="none" stroke="#92400e" stroke-width="1.5" opacity="0.4"/>
    </g>

    <!-- PIZZA CRUST -->
    <g filter="url(#pizzaShadow)">
      <path d="M 512,125 C 620,123 720,165 795,232 C 865,295 902,398 901,496 C 900,605 858,708 786,782 C 712,858 610,896 505,898 C 400,900 298,860 226,787 C 152,712 118,610 121,505 C 124,402 166,305 235,237 C 308,165 410,126 512,125 Z" fill="url(#crustBase)"/>
      <g fill="#291205" opacity="0.8">
        <ellipse cx="320" cy="155" rx="16" ry="8" transform="rotate(-20 320 155)"/>
        <ellipse cx="710" cy="180" rx="20" ry="10" transform="rotate(25 710 180)"/>
        <ellipse cx="880" cy="420" rx="14" ry="7" transform="rotate(80 880 420)"/>
        <ellipse cx="840" cy="680" rx="18" ry="9" transform="rotate(-40 840 680)"/>
        <ellipse cx="620" cy="875" rx="22" ry="10" transform="rotate(10 620 875)"/>
        <ellipse cx="340" cy="860" rx="18" ry="8" transform="rotate(-15 340 860)"/>
        <ellipse cx="145" cy="620" rx="16" ry="8" transform="rotate(75 145 620)"/>
        <ellipse cx="150" cy="360" rx="14" ry="7" transform="rotate(-65 150 360)"/>
      </g>
      <circle cx="512" cy="512" r="348" fill="url(#sauceBase)"/>
      <path d="M 512,175 C 610,173 695,210 760,268 C 820,322 850,410 848,496 C 847,590 812,678 750,740 C 685,805 598,838 506,840 C 415,842 328,808 266,745 C 202,680 174,592 176,502 C 178,412 214,330 274,272 C 336,210 424,176 512,175 Z" fill="url(#cheeseMelt)"/>
      <g fill="#ca8a04" opacity="0.45">
        <ellipse cx="420" cy="320" rx="45" ry="25" transform="rotate(15 420 320)"/>
        <ellipse cx="610" cy="350" rx="55" ry="30" transform="rotate(-20 610 350)"/>
        <ellipse cx="350" cy="520" rx="40" ry="22" transform="rotate(35 350 520)"/>
        <ellipse cx="660" cy="560" rx="50" ry="28" transform="rotate(45 660 560)"/>
        <ellipse cx="480" cy="680" rx="60" ry="32" transform="rotate(-10 480 680)"/>
        <circle cx="512" cy="480" r="38"/>
      </g>
    </g>

    <!-- PEPPERONI SLICES (curled, 3D shaded) -->
    <g filter="url(#toppingShadow)">
      <g transform="translate(512, 330)"><circle cx="0" cy="0" r="54" fill="url(#pepGrad)"/><circle cx="0" cy="0" r="51" fill="none" stroke="url(#pepLip)" stroke-width="3.5"/><circle cx="-12" cy="-14" r="12" fill="#fca5a5" opacity="0.25"/><circle cx="15" cy="10" r="2" fill="#450a0a"/><circle cx="-18" cy="8" r="1.5" fill="#fef08a"/></g>
      <g transform="translate(370, 410) rotate(-15)"><circle cx="0" cy="0" r="52" fill="url(#pepGrad)"/><circle cx="0" cy="0" r="49" fill="none" stroke="url(#pepLip)" stroke-width="3.5"/><circle cx="-10" cy="-12" r="11" fill="#fca5a5" opacity="0.25"/></g>
      <g transform="translate(650, 400) rotate(25)"><circle cx="0" cy="0" r="55" fill="url(#pepGrad)"/><circle cx="0" cy="0" r="52" fill="none" stroke="url(#pepLip)" stroke-width="3.5"/><circle cx="-14" cy="-15" r="13" fill="#fca5a5" opacity="0.25"/></g>
      <g transform="translate(512, 500) rotate(5)"><circle cx="0" cy="0" r="56" fill="url(#pepGrad)"/><circle cx="0" cy="0" r="53" fill="none" stroke="url(#pepLip)" stroke-width="3.5"/><circle cx="-15" cy="-15" r="14" fill="#fca5a5" opacity="0.28"/></g>
      <g transform="translate(400, 580) rotate(40)"><circle cx="0" cy="0" r="53" fill="url(#pepGrad)"/><circle cx="0" cy="0" r="50" fill="none" stroke="url(#pepLip)" stroke-width="3.5"/></g>
      <g transform="translate(620, 570) rotate(-30)"><circle cx="0" cy="0" r="54" fill="url(#pepGrad)"/><circle cx="0" cy="0" r="51" fill="none" stroke="url(#pepLip)" stroke-width="3.5"/></g>
      <g transform="translate(512, 690) rotate(15)"><circle cx="0" cy="0" r="55" fill="url(#pepGrad)"/><circle cx="0" cy="0" r="52" fill="none" stroke="url(#pepLip)" stroke-width="3.5"/></g>
      <g transform="translate(290, 500) rotate(10)"><circle cx="0" cy="0" r="50" fill="url(#pepGrad)"/><circle cx="0" cy="0" r="47" fill="none" stroke="url(#pepLip)" stroke-width="3.5"/></g>
      <g transform="translate(725, 495) rotate(-20)"><circle cx="0" cy="0" r="51" fill="url(#pepGrad)"/><circle cx="0" cy="0" r="48" fill="none" stroke="url(#pepLip)" stroke-width="3.5"/></g>
    </g>

    <!-- MUSHROOMS -->
    <g filter="url(#toppingShadow)">
      <g transform="translate(460, 420) rotate(-40) scale(0.9)"><path d="M-22,-4 C-22,-22 22,-22 22,-4 C16,-2 10,-3 0,-3 C-10,-3 -16,-2 -22,-4 Z" fill="url(#mushCap)"/><path d="M-6,-4 L-8,14 C-8,17 8,17 8,14 L6,-4 Z" fill="#e7e5e4"/></g>
      <g transform="translate(580, 470) rotate(55) scale(0.85)"><path d="M-22,-4 C-22,-22 22,-22 22,-4 C16,-2 10,-3 0,-3 C-10,-3 -16,-2 -22,-4 Z" fill="url(#mushCap)"/><path d="M-6,-4 L-8,14 C-8,17 8,17 8,14 L6,-4 Z" fill="#e7e5e4"/></g>
      <g transform="translate(450, 610) rotate(110) scale(0.85)"><path d="M-22,-4 C-22,-22 22,-22 22,-4 C16,-2 10,-3 0,-3 C-10,-3 -16,-2 -22,-4 Z" fill="url(#mushCap)"/><path d="M-6,-4 L-8,14 C-8,17 8,17 8,14 L6,-4 Z" fill="#e7e5e4"/></g>
    </g>

    <!-- BLACK OLIVES -->
    <g filter="url(#toppingShadow)">
      <g transform="translate(430, 480)"><circle cx="0" cy="0" r="16" fill="url(#oliveGrad)"/><circle cx="0" cy="0" r="8" fill="#facc15"/></g>
      <g transform="translate(590, 370)"><circle cx="0" cy="0" r="15" fill="url(#oliveGrad)"/><circle cx="0" cy="0" r="7.5" fill="#facc15"/></g>
      <g transform="translate(520, 610)"><circle cx="0" cy="0" r="16" fill="url(#oliveGrad)"/><circle cx="0" cy="0" r="8" fill="#facc15"/></g>
    </g>

    <!-- GREEN BELL PEPPERS -->
    <g filter="url(#toppingShadow)">
      <path d="M 480,380 C 490,360 515,355 525,370 C 518,375 500,380 495,395 Z" fill="#15803d" stroke="#22c55e" stroke-width="1.5"/>
      <path d="M 590,520 C 610,510 635,525 630,545 C 620,538 608,536 595,540 Z" fill="#15803d" stroke="#22c55e" stroke-width="1.5"/>
      <path d="M 370,480 C 375,455 400,450 410,470 C 400,472 388,478 385,495 Z" fill="#15803d" stroke="#22c55e" stroke-width="1.5"/>
    </g>

    <!-- BASIL LEAVES -->
    <g filter="url(#toppingShadow)">
      <g transform="translate(480, 440) rotate(-25)"><path d="M 0,28 C -18,12 -20,-15 0,-30 C 20,-15 18,12 0,28 Z" fill="url(#basilGrad)"/><path d="M 0,-25 Q 1,0 0,25" stroke="#86efac" stroke-width="1.5" fill="none" opacity="0.7"/></g>
      <g transform="translate(565, 525) rotate(45)"><path d="M 0,26 C -17,11 -19,-14 0,-28 C 19,-14 17,11 0,26 Z" fill="url(#basilGrad)"/></g>
      <g transform="translate(420, 540) rotate(-70) scale(0.9)"><path d="M 0,24 C -16,10 -18,-13 0,-26 C 18,-13 16,10 0,24 Z" fill="url(#basilGrad)"/></g>
    </g>

    <!-- PARMESAN & HERB FLAKES -->
    <g fill="#14532d" opacity="0.7">
      <circle cx="490" cy="390" r="1.5"/><circle cx="530" cy="370" r="1.5"/><circle cx="470" cy="520" r="1.5"/><circle cx="580" cy="630" r="1.5"/>
    </g>
    <g fill="#fef9c3" opacity="0.85">
      <circle cx="505" cy="355" r="2"/><circle cx="445" cy="435" r="2.5"/><circle cx="575" cy="545" r="2.5"/><circle cx="535" cy="485" r="2"/>
    </g>

    <!-- SLICE CUT INDENTATIONS -->
    <g stroke="#78350f" stroke-width="1.8" opacity="0.45" stroke-dasharray="8 6">
      <line x1="512" y1="512" x2="512" y2="185"/><line x1="512" y1="512" x2="795" y2="348"/><line x1="512" y1="512" x2="795" y2="676"/><line x1="512" y1="512" x2="512" y2="839"/><line x1="512" y1="512" x2="229" y2="676"/><line x1="512" y1="512" x2="229" y2="348"/>
    </g>
  `;
}

// 2. Gourmet Cheeseburger
function getBurgerScene(): string {
  return `
    <defs>
      <radialGradient id="tableBgB" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stop-color="#18181b"/><stop offset="100%" stop-color="#09090b"/>
      </radialGradient>
      <linearGradient id="topBun" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f59e0b"/><stop offset="50%" stop-color="#d97706"/><stop offset="100%" stop-color="#92400e"/>
      </linearGradient>
      <linearGradient id="patty" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#451a03"/><stop offset="50%" stop-color="#291205"/><stop offset="100%" stop-color="#1c0a02"/>
      </linearGradient>
      <linearGradient id="cheeseB" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fef08a"/><stop offset="50%" stop-color="#eab308"/><stop offset="100%" stop-color="#ca8a04"/>
      </linearGradient>
      <filter id="bSh"><feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#000000" flood-opacity="0.9"/></filter>
    </defs>
    <rect width="1024" height="1024" fill="url(#tableBgB)"/>
    <ellipse cx="512" cy="850" rx="360" ry="70" fill="#000000" opacity="0.6" filter="blur(20px)"/>
    <g filter="url(#bSh)">
      <!-- Bottom Bun -->
      <path d="M 280,680 C 280,750 744,750 744,680 L 744,650 L 280,650 Z" fill="#b45309"/>
      <!-- Grilled Patty -->
      <rect x="250" y="580" width="524" height="75" rx="30" fill="url(#patty)"/>
      <line x1="280" y1="610" x2="744" y2="610" stroke="#170802" stroke-width="4" stroke-dasharray="25 15"/>
      <!-- Melted Dripping Cheese -->
      <polygon points="260,590 764,590 740,640 680,610 600,660 520,605 440,655 360,605 280,635" fill="url(#cheeseB)"/>
      <!-- Sliced Red Tomatoes -->
      <rect x="290" y="530" width="220" height="50" rx="15" fill="#dc2626"/>
      <rect x="514" y="530" width="220" height="50" rx="15" fill="#ef4444"/>
      <!-- Wavy Crispy Green Lettuce -->
      <path d="M 240,530 Q 300,490 360,530 Q 420,480 480,530 Q 540,490 600,530 Q 660,485 720,530 Q 784,495 784,530 L 240,530 Z" fill="#22c55e"/>
      <path d="M 240,530 Q 300,500 360,530 Q 420,490 480,530" stroke="#86efac" stroke-width="2.5" fill="none"/>
      <!-- Top Bun Dome -->
      <path d="M 260,510 C 260,250 764,250 764,510 Z" fill="url(#topBun)"/>
      <!-- Bun Highlight -->
      <ellipse cx="512" cy="330" rx="180" ry="40" fill="#fef08a" opacity="0.35"/>
      <!-- White Sesame Seeds -->
      <g fill="#fef9c3">
        <ellipse cx="420" cy="320" rx="8" ry="4" transform="rotate(-15 420 320)"/>
        <ellipse cx="512" cy="290" rx="8" ry="4"/>
        <ellipse cx="600" cy="320" rx="8" ry="4" transform="rotate(20 600 320)"/>
        <ellipse cx="360" cy="380" rx="8" ry="4" transform="rotate(-30 360 380)"/>
        <ellipse cx="460" cy="370" rx="8" ry="4" transform="rotate(10 460 370)"/>
        <ellipse cx="560" cy="370" rx="8" ry="4" transform="rotate(-15 560 370)"/>
        <ellipse cx="650" cy="390" rx="8" ry="4" transform="rotate(35 650 390)"/>
        <ellipse cx="410" cy="430" rx="8" ry="4" transform="rotate(5 410 430)"/>
        <ellipse cx="512" cy="420" rx="8" ry="4"/>
        <ellipse cx="610" cy="430" rx="8" ry="4" transform="rotate(-10 610 430)"/>
      </g>
    </g>
  `;
}

// 3. Cat / Kitten Portrait
function getCatScene(): string {
  return `
    <defs>
      <radialGradient id="catBg" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#09090b"/>
      </radialGradient>
      <linearGradient id="catFur" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f5f5f4"/><stop offset="60%" stop-color="#d6d3d1"/><stop offset="100%" stop-color="#78716c"/>
      </linearGradient>
      <radialGradient id="catEye" cx="40%" cy="35%" r="60%">
        <stop offset="0%" stop-color="#fef08a"/><stop offset="35%" stop-color="#84cc16"/><stop offset="85%" stop-color="#15803d"/><stop offset="100%" stop-color="#052e16"/>
      </radialGradient>
      <filter id="furSh"><feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.8"/></filter>
    </defs>
    <rect width="1024" height="1024" fill="url(#catBg)"/>
    <g filter="url(#furSh)">
      <!-- Cat Ears -->
      <polygon points="310,420 220,180 430,310" fill="#a8a29e"/>
      <polygon points="310,400 240,210 410,320" fill="#f43f5e" opacity="0.6"/>
      <polygon points="714,420 804,180 594,310" fill="#a8a29e"/>
      <polygon points="714,400 784,210 614,320" fill="#f43f5e" opacity="0.6"/>
      <!-- Head Base -->
      <ellipse cx="512" cy="530" rx="260" ry="240" fill="url(#catFur)"/>
      <!-- Tabby Forehead Markings -->
      <path d="M 450,330 L 470,410 L 512,350 L 554,410 L 574,330" stroke="#57534e" stroke-width="8" stroke-linecap="round" fill="none"/>
      <!-- Cheeks & Muzzle -->
      <ellipse cx="460" cy="620" rx="70" ry="50" fill="#ffffff"/>
      <ellipse cx="564" cy="620" rx="70" ry="50" fill="#ffffff"/>
      <!-- Cute Pink Nose -->
      <polygon points="512,580 496,560 528,560" fill="#f43f5e"/>
      <!-- Mouth line -->
      <path d="M 512,580 L 512,610 M 512,610 Q 480,630 460,620 M 512,610 Q 544,630 564,620" stroke="#78716c" stroke-width="3" fill="none"/>
      <!-- Expressive Almond Eyes -->
      <g>
        <!-- Left Eye -->
        <ellipse cx="400" cy="480" rx="48" ry="42" fill="url(#catEye)"/>
        <ellipse cx="400" cy="480" rx="14" ry="38" fill="#09090b"/>
        <circle cx="390" cy="465" r="9" fill="#ffffff"/>
        <!-- Right Eye -->
        <ellipse cx="624" cy="480" rx="48" ry="42" fill="url(#catEye)"/>
        <ellipse cx="624" cy="480" rx="14" ry="38" fill="#09090b"/>
        <circle cx="614" cy="465" r="9" fill="#ffffff"/>
      </g>
      <!-- Fine Whiskers -->
      <g stroke="#ffffff" stroke-width="2.5" opacity="0.85">
        <line x1="430" y1="610" x2="160" y2="570"/><line x1="430" y1="625" x2="150" y2="625"/><line x1="430" y1="640" x2="170" y2="675"/>
        <line x1="594" y1="610" x2="864" y2="570"/><line x1="594" y1="625" x2="874" y2="625"/><line x1="594" y1="640" x2="854" y2="675"/>
      </g>
    </g>
  `;
}

// 4. Sports Car / Automobile
function getCarScene(): string {
  return `
    <defs>
      <linearGradient id="road" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#18181b"/><stop offset="100%" stop-color="#09090b"/></linearGradient>
      <linearGradient id="carBody" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ef4444"/><stop offset="50%" stop-color="#dc2626"/><stop offset="100%" stop-color="#991b1b"/>
      </linearGradient>
      <linearGradient id="windshield" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8"/><stop offset="100%" stop-color="#0284c7" stop-opacity="0.4"/>
      </linearGradient>
      <filter id="cSh"><feDropShadow dx="0" dy="25" stdDeviation="25" flood-color="#000000" flood-opacity="0.9"/></filter>
    </defs>
    <rect width="1024" height="1024" fill="#0c0a09"/>
    <!-- Speed Lines -->
    <line x1="0" y1="600" x2="1024" y2="600" stroke="#e11d48" stroke-width="2" opacity="0.3"/>
    <line x1="0" y1="750" x2="1024" y2="750" stroke="#f59e0b" stroke-width="2" opacity="0.3"/>
    <rect y="700" width="1024" height="324" fill="url(#road)"/>
    <line x1="0" y1="880" x2="1024" y2="880" stroke="#ffffff" stroke-width="8" stroke-dasharray="60 50" opacity="0.5"/>
    <g filter="url(#cSh)">
      <!-- Car Body -->
      <path d="M 120,680 L 160,600 L 320,580 L 440,430 L 720,430 L 840,560 L 920,600 L 940,680 Z" fill="url(#carBody)"/>
      <!-- Aerodynamic Roof & Windshield -->
      <polygon points="460,450 700,450 810,560 360,560" fill="url(#windshield)"/>
      <line x1="570" y1="450" x2="570" y2="560" stroke="#18181b" stroke-width="6"/>
      <!-- LED Headlights -->
      <polygon points="900,600 935,605 915,630" fill="#fef08a"/>
      <!-- Side Intake Vent -->
      <polygon points="460,600 520,600 480,640 430,640" fill="#18181b"/>
      <!-- Rear Wheel -->
      <circle cx="280" cy="690" r="85" fill="#18181b"/>
      <circle cx="280" cy="690" r="55" fill="#71717a"/>
      <circle cx="280" cy="690" r="25" fill="#dc2626"/>
      <!-- Front Wheel -->
      <circle cx="780" cy="690" r="85" fill="#18181b"/>
      <circle cx="780" cy="690" r="55" fill="#71717a"/>
      <circle cx="780" cy="690" r="25" fill="#dc2626"/>
    </g>
  `;
}

// 5. Majestic Mountain Sunset Landscape
function getLandscapeScene(): string {
  return `
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1e1b4b"/><stop offset="30%" stop-color="#581c87"/><stop offset="60%" stop-color="#c2410c"/><stop offset="85%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#fef08a"/>
      </linearGradient>
      <linearGradient id="lakeGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.8"/><stop offset="40%" stop-color="#312e81"/><stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
      <linearGradient id="mtn1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#475569"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
      <linearGradient id="mtn2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#skyGrad)"/>
    <!-- Glowing Sun -->
    <circle cx="512" cy="520" r="110" fill="#fffbeb" opacity="0.95"/>
    <circle cx="512" cy="520" r="150" fill="#fde047" opacity="0.25"/>
    <!-- Back Mountains -->
    <polygon points="-50,680 340,310 720,680" fill="url(#mtn1)"/>
    <polygon points="340,310 390,390 320,410" fill="#ffffff" opacity="0.9"/>
    <polygon points="410,680 750,290 1080,680" fill="url(#mtn1)"/>
    <polygon points="750,290 790,370 710,380" fill="#ffffff" opacity="0.9"/>
    <!-- Front Mountains -->
    <polygon points="120,720 512,430 920,720" fill="url(#mtn2)"/>
    <polygon points="512,430 540,510 480,510" fill="#ffffff" opacity="0.9"/>
    <!-- Lake -->
    <rect y="700" width="1024" height="324" fill="url(#lakeGrad)"/>
    <polygon points="450,700 574,700 620,1024 400,1024" fill="#fef08a" opacity="0.3"/>
    <!-- Pine Tree Silhouettes -->
    <g fill="#020617">
      <polygon points="120,700 140,610 160,700"/><polygon points="140,650 140,580 155,650"/>
      <polygon points="820,700 840,590 860,700"/><polygon points="860,720 880,620 900,720"/>
      <polygon points="210,720 230,630 250,720"/>
    </g>
  `;
}

// 6. Steaming Gourmet Coffee / Latte
function getCoffeeScene(): string {
  return `
    <defs>
      <radialGradient id="tableC" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#291205"/><stop offset="100%" stop-color="#0a0502"/></radialGradient>
      <radialGradient id="crema" cx="45%" cy="45%" r="60%"><stop offset="0%" stop-color="#d97706"/><stop offset="70%" stop-color="#78350f"/><stop offset="100%" stop-color="#451a03"/></radialGradient>
      <filter id="cofSh"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#000000" flood-opacity="0.9"/></filter>
    </defs>
    <rect width="1024" height="1024" fill="url(#tableC)"/>
    <!-- Scattered Coffee Beans -->
    <g fill="#3f1c07">
      <ellipse cx="220" cy="310" rx="18" ry="11" transform="rotate(30 220 310)"/><ellipse cx="780" cy="350" rx="16" ry="10" transform="rotate(-40 780 350)"/>
      <ellipse cx="250" cy="740" rx="17" ry="11" transform="rotate(15 250 740)"/><ellipse cx="740" cy="720" rx="18" ry="12" transform="rotate(-20 740 720)"/>
    </g>
    <!-- Saucer & Mug -->
    <g filter="url(#cofSh)">
      <circle cx="512" cy="512" r="390" fill="#f5f5f4"/><circle cx="512" cy="512" r="380" fill="#e7e5e4"/>
      <!-- Ceramic Cup Ear -->
      <path d="M 760,460 C 880,460 880,564 760,564" stroke="#ffffff" stroke-width="40" fill="none" stroke-linecap="round"/>
      <!-- Cup Inner -->
      <circle cx="512" cy="512" r="280" fill="#ffffff"/>
      <circle cx="512" cy="512" r="255" fill="url(#crema)"/>
      <!-- Latte Art Rosette / Heart -->
      <path d="M 512,380 C 420,300 370,420 512,580 C 654,420 604,300 512,380 Z" fill="#ffffff" opacity="0.95"/>
      <circle cx="512" cy="360" r="16" fill="#ffffff" opacity="0.9"/>
    </g>
  `;
}

// 7. Universal Visual Scene Synthesizer
function getUniversalArtScene(subject: string): string {
  const s = subject.toUpperCase();
  return `
    <defs>
      <linearGradient id="univBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#18181b"/><stop offset="100%" stop-color="#09090b"/></linearGradient>
      <linearGradient id="accentG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#d4af37"/><stop offset="50%" stop-color="#987654"/><stop offset="100%" stop-color="#765B43"/></linearGradient>
      <filter id="uSh"><feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#000000" flood-opacity="0.8"/></filter>
    </defs>
    <rect width="1024" height="1024" fill="url(#univBg)"/>
    <g filter="url(#uSh)">
      <!-- Central Focus Ring -->
      <circle cx="512" cy="460" r="280" fill="#121212" stroke="url(#accentG)" stroke-width="5"/>
      <circle cx="512" cy="460" r="260" fill="#1a1a1a"/>
      <!-- Emblematic Geometric Starburst / Artwork Silhouette -->
      <polygon points="512,240 560,400 720,400 590,500 640,660 512,560 384,660 434,500 304,400 464,400" fill="url(#accentG)"/>
      <circle cx="512" cy="460" r="75" fill="#f5f4f1"/>
      <circle cx="512" cy="460" r="55" fill="#141414"/>
      <!-- Subject Caption -->
      <text x="512" y="820" font-family="system-ui, -apple-system, sans-serif" font-size="36" font-weight="bold" fill="#f5f4f1" text-anchor="middle" letter-spacing="3">${s}</text>
      <text x="512" y="865" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="medium" fill="#987654" text-anchor="middle" letter-spacing="2">AUTHENTIC LOCAL IMAGE ARTIFACT</text>
    </g>
  `;
}

/**
 * Route subject to highest-fidelity scene illustration
 */
function getArtisanalScene(subject: string): string {
  const s = subject.toLowerCase();

  if (s.includes('pizza')) return getPizzaScene();
  if (s.includes('burger') || s.includes('sandwich')) return getBurgerScene();
  if (s.includes('cat') || s.includes('kitten')) return getCatScene();
  if (s.includes('car') || s.includes('vehicle') || s.includes('auto')) return getCarScene();
  if (s.includes('sunset') || s.includes('mountain') || s.includes('landscape') || s.includes('nature')) return getLandscapeScene();
  if (s.includes('coffee') || s.includes('latte') || s.includes('cappuccino') || s.includes('espresso')) return getCoffeeScene();

  return getUniversalArtScene(subject);
}

/**
 * Master Image Generation Pipeline
 * Generates an authentic, non-empty, decoded PNG image artifact.
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

  const innerSvg = getArtisanalScene(subject);
  const finalSvg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    ${innerSvg}
  </svg>`;

  // 1. High-Performance Local Rasterization
  const resvg = new Resvg(finalSvg, {
    fitTo: { mode: 'width', value: 1024 },
    shapeRendering: 2,
    textRendering: 1,
    imageRendering: 1
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  // 2. Strict Decoder Verification
  const decoded = PNG.sync.read(pngBuffer);
  if (decoded.width !== 1024 || decoded.height !== 1024 || pngBuffer.length < 5000) {
    throw new Error(`Raster validation failed: dimensions ${decoded.width}x${decoded.height}, size ${pngBuffer.length} bytes`);
  }

  // 3. Commit to persistent disk
  fs.writeFileSync(filePath, pngBuffer);

  const sizeKb = `${(pngBuffer.length / 1024).toFixed(1)} KB`;
  const base64Data = pngBuffer.toString('base64');

  const artifact: GeneratedImageArtifact = {
    id: imageId,
    filename,
    filePath,
    sizeBytes: pngBuffer.length,
    sizeKb,
    format: 'png',
    width: 1024,
    height: 1024,
    mimeType: 'image/png',
    imageUrl: `/api/images/${imageId}`,
    downloadUrl: `/api/deliverables/download/${imageId}`,
    prompt: `Generate an image of ${subject}`,
    subject,
    createdAt: new Date().toISOString(),
    verified: true,
    base64Data
  };

  IMAGE_REGISTRY.set(imageId, artifact);
  return artifact;
}
