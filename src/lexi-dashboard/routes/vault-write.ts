import { type Express, type Request, type Response } from 'express';
import express from 'express';
import { existsSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function register(app: Express): void {
  // Note: express.json must be applied before the PUT handler can parse the body.
  // Other route modules in the codebase apply it on their own routers; we apply
  // it scoped to this single PUT to avoid interfering with raw-body endpoints.
  app.put(
    '/api/vault-file',
    express.json({ limit: '1mb' }),
    (req: Request, res: Response) => {
      const relPath = typeof req.query.path === 'string' ? req.query.path : '';
      const baseDir = process.env.CLEMENTINE_BASE_DIR ?? path.join(os.homedir(), '.clementine');
      const vaultRoot = path.join(baseDir, 'vault');

      if (!relPath || relPath.includes('..') || path.isAbsolute(relPath)) {
        res.status(400).json({ error: 'Bad path' });
        return;
      }

      const full = path.resolve(vaultRoot, relPath);
      if (!full.startsWith(vaultRoot + path.sep)) {
        res.status(400).json({ error: 'Outside vault root' });
        return;
      }
      if (!existsSync(full) || !statSync(full).isFile()) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      if (!full.endsWith('.md')) {
        res.status(400).json({ error: 'Only .md files writable' });
        return;
      }

      const body = req.body as { content?: unknown };
      if (typeof body?.content !== 'string') {
        res.status(400).json({ error: 'Missing content' });
        return;
      }

      try {
        writeFileSync(full, body.content, 'utf-8');
        res.json({ ok: true, path: relPath, bytes: Buffer.byteLength(body.content, 'utf-8') });
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    }
  );
}
