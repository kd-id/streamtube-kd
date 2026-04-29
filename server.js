import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiMiddleware } from './server/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// API and Logging endpoints
app.use(apiMiddleware);

const isProduction = process.env.NODE_ENV === 'production';

async function createServer() {
  if (!isProduction) {
    // In development, we use Vite's development server in middleware mode
    // This allows both frontend and backend to run together on port 3000
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  StreamTube Pro — Development Mode (ViteSSR) ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Server listening on http://localhost:${PORT}   ║`);
    console.log('╚══════════════════════════════════════════════╝');
  } else {
    // In production, we serve the statically built files from Vite
    app.use(express.static(path.join(__dirname, 'dist')));
    // SPA Fallback: send index.html for all unused routes
    app.use((req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
    
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  StreamTube Pro — Production Server Started  ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Server listening on http://localhost:${PORT}   ║`);
    console.log('╚══════════════════════════════════════════════╝');
  }

  app.listen(PORT, () => {
    // Log is already printed above
  });
}

createServer();
