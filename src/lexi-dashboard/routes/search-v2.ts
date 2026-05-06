/**
 * Phase 20 — Cross-surface search.
 *
 * GET /api/lexi-search?q=<query>&kinds=vault,memory,cron,chat,agents
 *
 * Searches across multiple data sources and returns unified hits with
 * source tags. Read-only. No external network.
 */
import type { Express, Request, Response } from 'express';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { listAgents } from '../data/from-upstream/agents.js';
import { listFiles as listVaultFiles } from '../data/from-upstream/vault.js';
import { listJobs as listCronJobs } from '../data/from-upstream/cron.js';
import { lexiStateDir } from '../data/paths.js';

interface Hit {
  kind: 'agent' | 'vault' | 'cron' | 'chat' | 'memory';
  id: string;
  title: string;
  snippet?: string;
  href: string;
  score: number;
}

function score(hay: string, q: string): number {
  if (!q) return 0;
  const lower = hay.toLowerCase();
  const qlower = q.toLowerCase();
  const idx = lower.indexOf(qlower);
  if (idx < 0) return 0;
  // Earlier matches score higher; prefix matches highest.
  return idx === 0 ? 100 : 50 - Math.min(idx, 49);
}

export function register(app: Express): void {
  app.get('/api/lexi-search', async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const kindsParam = typeof req.query.kinds === 'string' ? req.query.kinds : 'agent,vault,cron,chat';
    const kinds = new Set(kindsParam.split(',').map((s) => s.trim()).filter(Boolean));
    const limit = Math.min(parseInt(String(req.query.limit ?? '40'), 10) || 40, 200);
    if (!q) return res.json({ q, hits: [] });

    const hits: Hit[] = [];

    if (kinds.has('agent')) {
      try {
        const agents = await listAgents();
        for (const a of agents) {
          const sc = Math.max(score(a.slug, q), score(a.name, q));
          if (sc > 0) {
            hits.push({ kind: 'agent', id: a.slug, title: a.name || a.slug, href: `#/agents/${a.slug}`, score: sc });
          }
        }
      } catch { /* skip */ }
    }

    if (kinds.has('vault')) {
      try {
        const files = await listVaultFiles({ limit: 200, sinceDays: 365, search: q });
        for (const f of files.slice(0, 30)) {
          hits.push({
            kind: 'vault',
            id: f.relPath,
            title: f.title,
            snippet: f.relPath,
            href: `#/vault?path=${encodeURIComponent(f.relPath)}`,
            score: score(f.title, q) + score(f.relPath, q) * 0.5,
          });
        }
      } catch { /* skip */ }
    }

    if (kinds.has('cron')) {
      try {
        const jobs = await listCronJobs();
        for (const job of jobs) {
          const sc = score(job.name, q);
          if (sc > 0) {
            hits.push({ kind: 'cron', id: job.name, title: job.name, snippet: job.schedule, href: `#/cron`, score: sc });
          }
        }
      } catch { /* skip */ }
    }

    if (kinds.has('chat')) {
      try {
        const chatDir = path.join(lexiStateDir(), 'chat');
        if (existsSync(chatDir)) {
          const files = readdirSync(chatDir).filter((f) => f.endsWith('.json'));
          for (const f of files) {
            const full = path.join(chatDir, f);
            try {
              const stat = statSync(full);
              const raw = readFileSync(full, 'utf8');
              if (raw.toLowerCase().includes(q.toLowerCase())) {
                const session = JSON.parse(raw);
                hits.push({
                  kind: 'chat',
                  id: session.id,
                  title: `Chat with ${session.agent}`,
                  snippet: new Date(stat.mtimeMs).toLocaleString(),
                  href: `#/chat`,
                  score: 30,
                });
              }
            } catch { /* skip */ }
          }
        }
      } catch { /* skip */ }
    }

    if (kinds.has('memory')) {
      try {
        const mod = await import('../../memory/store.js');
        const Store = (mod as unknown as { MemoryStore: new () => unknown }).MemoryStore;
        if (Store) {
          const store = new Store() as { searchByQuery?: (q: string, limit: number) => unknown[] };
          if (typeof store.searchByQuery === 'function') {
            const results = (store.searchByQuery(q, 10) ?? []) as Array<{ id?: string; chunk?: string }>;
            for (const r of results) {
              hits.push({
                kind: 'memory',
                id: String(r.id ?? ''),
                title: 'Memory chunk',
                snippet: typeof r.chunk === 'string' ? r.chunk.slice(0, 140) : '',
                href: `#/memory`,
                score: 60,
              });
            }
          }
        }
      } catch { /* skip */ }
    }

    hits.sort((a, b) => b.score - a.score);
    res.json({ q, hits: hits.slice(0, limit) });
  });
}
