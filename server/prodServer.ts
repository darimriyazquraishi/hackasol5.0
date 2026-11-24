import http from 'http';
import fs from 'fs';
import path from 'path';
import { handleApiRequest } from './lumiServer';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

// Locate dist directory relative to executable or current working directory
function resolveDistDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'dist'),
    path.resolve(__dirname, 'dist'),
    path.resolve(__dirname, '..', 'dist')
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
  }

  return candidates[0];
}

const DIST_DIR = resolveDistDir();

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const rawUrl = req.url || '/';
  const cleanPath = rawUrl.split('?')[0];
  let filePath = path.join(DIST_DIR, cleanPath === '/' ? 'index.html' : cleanPath);

  // Security check: prevent directory traversal
  const relative = path.relative(DIST_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  // If path is a directory or does not exist, fallback to index.html (SPA routing)
  let stats: fs.Stats | null = null;
  try {
    stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(DIST_DIR, 'index.html');
      stats = fs.statSync(filePath);
    }
  } catch {
    filePath = path.join(DIST_DIR, 'index.html');
    try {
      stats = fs.statSync(filePath);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('LUMI Frontend dist/index.html not found. Please run npm run build.');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const headers: Record<string, string | number> = {
    'Content-Type': contentType,
    'Content-Length': stats.size
  };

  // Cache static hashed assets for 1 year, no-cache for index.html
  if (cleanPath.startsWith('/assets/') || cleanPath.startsWith('/fonts/')) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else {
    headers['Cache-Control'] = 'no-cache';
  }

  res.writeHead(200, headers);
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}

export function startProductionServer(preferredPort: number = 3000): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    let port = preferredPort;

    const server = http.createServer((req, res) => {
      // CORS headers for local access
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = req.url || '';
      if (url.startsWith('/api/')) {
        const handled = handleApiRequest(req, res);
        if (handled) return;
      }

      serveStatic(req, res);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        port++;
        if (port < preferredPort + 20) {
          server.listen(port);
        } else {
          reject(new Error(`No free port found between ${preferredPort} and ${port}`));
        }
      } else {
        reject(err);
      }
    });

    server.listen(port, () => {
      console.log(`[LUMI Production Server] Listening on http://localhost:${port}`);
      resolve({ server, port });
    });
  });
}

// Auto-run if executed directly as entrypoint
if (require.main === module || !process.env.LUMI_NO_AUTO_START) {
  const targetPort = parseInt(process.env.PORT || '3000', 10);
  startProductionServer(targetPort).catch(err => {
    console.error('[LUMI Server Error]:', err);
    process.exit(1);
  });
}
