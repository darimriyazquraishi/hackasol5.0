import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApiRequest } from './server/lumiServer';

function lumiBackendPlugin(): Plugin {
  return {
    name: 'lumi-backend-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          const handled = handleApiRequest(req, res);
          if (handled) return;
        }
        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), lumiBackendPlugin()],
  server: {
    port: 3000,
    host: true
  }
});
