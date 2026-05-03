import express from 'express';
import type { Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';
import { registerLexiRoutes } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface LexiServerOptions { port?: number; }
export interface LexiServer { port: number; app: Express; stop: () => Promise<void>; }

const startedAt = Date.now();

export async function startLexiServer(opts: LexiServerOptions = {}): Promise<LexiServer> {
  const app = express();
  const uiDir = path.resolve(__dirname, 'ui');
  app.use('/assets', express.static(uiDir));

  registerLexiRoutes(app);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'lexi-dashboard',
      uptimeMs: Date.now() - startedAt,
      version: process.env.npm_package_version ?? 'dev',
    });
  });

  app.get('/', (_req, res) => { res.sendFile(path.join(uiDir, 'index.html')); });

  const httpServer: Server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(opts.port ?? 3030, () => { httpServer.removeListener('error', reject); resolve(); });
  });
  const addr = httpServer.address();
  const port = typeof addr === 'object' && addr ? addr.port : (opts.port ?? 3030);
  return {
    port, app,
    stop: () => new Promise<void>((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve()))),
  };
}
