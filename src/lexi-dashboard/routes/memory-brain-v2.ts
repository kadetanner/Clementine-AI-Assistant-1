/**
 * Phase 15 — Memory + Brain pillar routes (Lighthouse §7.2).
 *
 * Memory endpoints read upstream's MemoryStore via thin imports.
 * Brain endpoints (sources, feeds, connectors, runs, library, ingestion)
 * are mostly thin wrappers over upstream modules where exported, with
 * minimal-viable stubs returning empty arrays where not.
 *
 * Free-only invariant: ingestion endpoints accept input but do not trigger
 * any external network call without daemon-side credentials being configured.
 */
import type { Express, Request, Response } from 'express';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { clementineHome } from '../data/paths.js';
import { graphSnapshot } from '../data/from-upstream/memory.js';

async function memoryStoreOrNull(): Promise<unknown | null> {
  try {
    const mod = await import('../../memory/store.js');
    const Store = (mod as unknown as { MemoryStore: new () => unknown }).MemoryStore;
    if (!Store) return null;
    return new Store();
  } catch {
    return null;
  }
}

function callIfFunction<T = unknown>(obj: unknown, name: string, ...args: unknown[]): T | null {
  const m = (obj as Record<string, unknown>)[name];
  if (typeof m !== 'function') return null;
  try {
    return (m as (...a: unknown[]) => T).apply(obj, args);
  } catch {
    return null;
  }
}

function brainDir(): string {
  return path.join(clementineHome(), 'brain');
}

function safeListDir(p: string): string[] {
  try {
    if (!existsSync(p)) return [];
    return readdirSync(p);
  } catch {
    return [];
  }
}

export function register(app: Express): void {
  // ── Memory (full pillar) ────────────────────────────────────────────
  app.get('/api/memory/supersedes', async (_req: Request, res: Response) => {
    const store = await memoryStoreOrNull();
    const r = callIfFunction<unknown[]>(store, 'listSupersedes') ?? [];
    res.json({ supersedes: r });
  });

  app.get('/api/memory/session-bridge', async (_req: Request, res: Response) => {
    const store = await memoryStoreOrNull();
    const r = callIfFunction(store, 'getSessionBridge') ?? null;
    res.json({ bridge: r });
  });

  app.get('/api/memory/writes/recent', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 500);
    const store = await memoryStoreOrNull();
    const r = (callIfFunction<unknown[]>(store, 'listRecentWrites', limit) ?? []) as unknown[];
    res.json({ writes: r });
  });

  app.get('/api/memory/learnings', async (req: Request, res: Response) => {
    const store = await memoryStoreOrNull();
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 500);
    const r = (callIfFunction<unknown[]>(store, 'listLearnings', limit) ?? []) as unknown[];
    res.json({ learnings: r });
  });

  app.post('/api/memory/learnings/action', async (req: Request, res: Response) => {
    const store = await memoryStoreOrNull();
    const r = callIfFunction(store, 'learningsAction', req.body);
    if (r === null) return res.status(501).json({ error: 'Not implemented in this upstream' });
    res.json({ ok: true, result: r });
  });

  app.get('/api/memory/commitments', async (req: Request, res: Response) => {
    const store = await memoryStoreOrNull();
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 500);
    const r = (callIfFunction<unknown[]>(store, 'listCommitments', limit) ?? []) as unknown[];
    res.json({ commitments: r });
  });

  app.post('/api/memory/commitments/action', async (req: Request, res: Response) => {
    const store = await memoryStoreOrNull();
    const r = callIfFunction(store, 'commitmentsAction', req.body);
    if (r === null) return res.status(501).json({ error: 'Not implemented in this upstream' });
    res.json({ ok: true, result: r });
  });

  app.get('/api/memory/episodes', async (req: Request, res: Response) => {
    const store = await memoryStoreOrNull();
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 500);
    const r = (callIfFunction<unknown[]>(store, 'listEpisodes', limit) ?? []) as unknown[];
    res.json({ episodes: r });
  });

  app.get('/api/memory/coverage', async (_req: Request, res: Response) => {
    const store = await memoryStoreOrNull();
    const r = callIfFunction(store, 'coverage') ?? { available: false };
    res.json(r);
  });

  app.post('/api/memory/quick-add', async (req: Request, res: Response) => {
    const store = await memoryStoreOrNull();
    const r = callIfFunction(store, 'quickAdd', req.body);
    if (r === null) return res.status(501).json({ error: 'Not implemented in this upstream' });
    res.json({ ok: true, result: r });
  });

  app.post('/api/memory/health/action', async (req: Request, res: Response) => {
    const store = await memoryStoreOrNull();
    const r = callIfFunction(store, 'healthAction', req.body);
    if (r === null) return res.status(501).json({ error: 'Not implemented in this upstream' });
    res.json({ ok: true, result: r });
  });

  app.get('/api/memory/chunks/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const store = await memoryStoreOrNull();
    const r = callIfFunction(store, 'getChunk', id);
    if (r === null || r === undefined) return res.status(404).json({ error: 'Chunk not found' });
    res.json(r);
  });

  app.put('/api/memory/chunks/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const store = await memoryStoreOrNull();
    const r = callIfFunction(store, 'updateChunk', id, req.body);
    if (r === null) return res.status(501).json({ error: 'Not implemented' });
    res.json({ ok: true });
  });

  app.delete('/api/memory/chunks/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const store = await memoryStoreOrNull();
    const r = callIfFunction(store, 'deleteChunk', id);
    if (r === null) return res.status(501).json({ error: 'Not implemented' });
    res.json({ ok: true });
  });

  app.post('/api/memory/chunks/:id/restore', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const store = await memoryStoreOrNull();
    const r = callIfFunction(store, 'restoreChunk', id);
    if (r === null) return res.status(501).json({ error: 'Not implemented' });
    res.json({ ok: true });
  });

  app.post('/api/memory/chunks/:id/pin', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const store = await memoryStoreOrNull();
    const r = callIfFunction(store, 'pinChunk', id, req.body);
    if (r === null) return res.status(501).json({ error: 'Not implemented' });
    res.json({ ok: true });
  });

  app.get('/api/memory/chunks/:id/history', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const store = await memoryStoreOrNull();
    const r = (callIfFunction<unknown[]>(store, 'chunkHistory', id) ?? []) as unknown[];
    res.json({ history: r });
  });

  app.get('/api/memory/search', async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 200);
    const store = await memoryStoreOrNull();
    const r = (callIfFunction<unknown[]>(store, 'searchByQuery', q, limit) ?? []) as unknown[];
    res.json({ q, results: r });
  });

  // ── Brain (sources/feeds/connectors/runs/library) ───────────────────
  app.get('/api/brain/sources', async (_req: Request, res: Response) => {
    const dir = path.join(brainDir(), 'sources');
    const items = safeListDir(dir).map((slug) => {
      const f = path.join(dir, slug);
      try {
        const st = statSync(f);
        return { slug, mtime: new Date(st.mtimeMs).toISOString(), isDir: st.isDirectory() };
      } catch {
        return { slug, mtime: '', isDir: false };
      }
    });
    res.json({ sources: items });
  });

  app.post('/api/brain/sources', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Source creation requires daemon-side credentials. Configure in upstream.' });
  });

  app.post('/api/brain/sources/:slug/run', async (req: Request, res: Response) => {
    res.status(501).json({ error: 'Source run requires daemon. Trigger via upstream.', slug: req.params.slug });
  });

  app.delete('/api/brain/sources/:slug', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Source deletion requires daemon write authority' });
  });

  app.get('/api/brain/feeds', async (_req: Request, res: Response) => {
    const dir = path.join(brainDir(), 'feeds');
    const items = safeListDir(dir).map((name) => ({ name }));
    res.json({ feeds: items });
  });

  app.post('/api/brain/feeds', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Feed creation requires daemon' });
  });

  app.post('/api/brain/feeds/:name/run', async (req: Request, res: Response) => {
    res.status(501).json({ error: 'Feed run requires daemon', name: req.params.name });
  });

  app.delete('/api/brain/feeds/:name', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Feed deletion requires daemon' });
  });

  app.get('/api/brain/connectors', async (_req: Request, res: Response) => {
    // Static list — Lexi never spends. Connectors enabled-state lives in daemon.
    res.json({
      connectors: [
        { id: 'web', name: 'Web Search', requires: 'WEB_SEARCH_API_KEY', enabled: false },
        { id: 'github', name: 'GitHub', requires: 'GITHUB_TOKEN', enabled: false },
        { id: 'gdrive', name: 'Google Drive', requires: 'GOOGLE_OAUTH', enabled: false },
        { id: 'slack', name: 'Slack', requires: 'SLACK_TOKEN', enabled: false },
      ],
    });
  });

  app.get('/api/brain/credentials', async (_req: Request, res: Response) => {
    // Names only — never expose values.
    res.json({ credentials: [] });
  });

  app.post('/api/brain/credentials', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Credential storage handled by daemon settings UI' });
  });

  app.get('/api/brain/runs', async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 200);
    const dir = path.join(brainDir(), 'runs');
    const items = safeListDir(dir).slice(0, limit).map((id) => {
      try {
        const f = path.join(dir, id);
        const st = statSync(f);
        return { id, mtime: new Date(st.mtimeMs).toISOString() };
      } catch {
        return { id };
      }
    });
    res.json({ runs: items });
  });

  app.get('/api/brain/library/search', async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    res.json({ q, results: [], note: 'Library search is wired in Phase 20 (cross-surface search)' });
  });

  app.get('/api/brain/artifacts/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const f = path.join(brainDir(), 'artifacts', id);
    if (!existsSync(f)) return res.status(404).json({ error: 'Artifact not found' });
    try {
      const stat = statSync(f);
      if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
      res.setHeader('content-type', 'application/octet-stream');
      res.send(readFileSync(f));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/brain/seed/preview', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Seed preview requires daemon ingestion pipeline' });
  });

  app.post('/api/brain/seed/commit', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Seed commit requires daemon ingestion pipeline' });
  });

  app.post('/api/brain/seed/preview/stream', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Seed preview stream requires daemon' });
  });

  app.post('/api/brain/seed/commit/stream', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Seed commit stream requires daemon' });
  });

  app.post('/api/brain/seed/upload', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Seed upload requires daemon multer pipeline' });
  });

  app.post('/api/brain/mcp/probe', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'MCP probe requires daemon-side connection' });
  });

  // graph-stats already in proxy/upstream-routes.ts
  void graphSnapshot;
}
