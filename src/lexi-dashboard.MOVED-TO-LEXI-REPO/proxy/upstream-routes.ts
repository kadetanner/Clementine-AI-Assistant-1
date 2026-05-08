/**
 * Plan 10 — In-process proxy for upstream API endpoints.
 *
 * Per spec §3.3 (docs/lexi/specs/2026-05-02-lexi-dashboard-design.md):
 *   "Routes Lexi proxies to upstream services in-process: for any endpoint
 *    whose business logic lives in upstream code, Lexi calls the same handler
 *    functions or services directly. We don't HTTP-proxy to a separate
 *    Clementine server — we share the process."
 *
 * Each route below either:
 *   - thin-imports a shared upstream service (memory store, builder serializer,
 *     failure monitor), or
 *   - inline-mirrors the upstream handler body verbatim (with a comment
 *     pointing to the upstream line so future drift is greppable).
 *
 * BASE_DIR is resolved from CLEMENTINE_HOME (same as upstream).
 */
import type { Express, Request, Response } from 'express';
import path from 'node:path';
import { homedir } from 'node:os';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

function getBaseDir(): string {
  return process.env.CLEMENTINE_HOME ?? path.join(homedir(), '.clementine');
}

export function register(app: Express): void {
  // ── 1. /api/builder/workflows  (upstream dashboard.ts:3662) ──────────
  app.get('/api/builder/workflows', async (_req, res) => {
    try {
      const { listAllForBuilder } = await import('../../dashboard/builder/serializer.js');
      res.json({ workflows: listAllForBuilder() });
    } catch (err) {
      res.status(500).json({ error: 'Failed to list workflows', detail: String(err) });
    }
  });

  // ── 2. /api/vault-files  (upstream dashboard.ts:3318) ────────────────
  // Mirrors upstream src/cli/dashboard.ts:3318 — vault file walker.
  app.get('/api/vault-files', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? '120'), 10) || 120, 500);
      const sinceDays = Math.max(parseInt(String(req.query.sinceDays ?? '30'), 10) || 30, 1);
      const agentFilter = typeof req.query.agent === 'string' ? req.query.agent : '';
      const folderFilter = typeof req.query.folder === 'string' ? req.query.folder : '';
      const search = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : '';
      const includeAuto = req.query.includeAuto === '1';
      const typeFilter = typeof req.query.type === 'string' ? req.query.type : '';
      const tagFilter = typeof req.query.tag === 'string' ? req.query.tag : '';
      const cutoffMs = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
      const vaultRoot = path.join(getBaseDir(), 'vault');
      const matter = (await import('gray-matter')).default;
      const files: Array<{
        path: string; relPath: string; title: string; folder: string;
        agentSlug: string | null; mtime: string; sizeBytes: number;
        type: string | null; category: string | null; tags: string[];
      }> = [];
      function walk(dir: string) {
        let entries: string[] = [];
        try { entries = readdirSync(dir); } catch { return; }
        for (const e of entries) {
          if (e.startsWith('.')) continue;
          const full = path.join(dir, e);
          let stat;
          try { stat = statSync(full); } catch { continue; }
          if (stat.isDirectory()) { walk(full); continue; }
          if (!e.endsWith('.md')) continue;
          if (e.endsWith('.md.bak')) continue;
          if (stat.mtimeMs < cutoffMs) continue;
          const rel = path.relative(vaultRoot, full);
          if (!includeAuto && rel.startsWith('00-System/skills/auto/')) continue;
          if (!includeAuto && rel.startsWith('00-System/agents/') && /\/(MEMORY|HEARTBEAT|TASKS|CRON)\.md$/.test(rel)) continue;
          const folder = path.dirname(rel).split(path.sep)[0] || '';
          let agentSlug: string | null = null;
          if (rel.startsWith('00-System/agents/')) {
            const m = rel.match(/^00-System\/agents\/([^/]+)\//);
            if (m) agentSlug = m[1];
          }
          let title = path.basename(rel, '.md');
          let typeTag: string | null = null;
          let categoryTag: string | null = null;
          let tags: string[] = [];
          try {
            const head = readFileSync(full, 'utf-8').slice(0, 4000);
            const parsed = matter(head);
            const data = parsed.data as Record<string, unknown>;
            if (typeof data.title === 'string') title = data.title;
            else if (typeof data.name === 'string') title = data.name;
            else {
              const h1 = (parsed.content || '').match(/^#\s+(.+)$/m);
              if (h1) title = h1[1].trim();
            }
            if (typeof data.type === 'string') typeTag = data.type;
            if (typeof data.category === 'string') categoryTag = data.category;
            if (Array.isArray(data.tags)) {
              tags = data.tags.filter((t): t is string => typeof t === 'string');
            } else if (typeof data.tags === 'string') {
              tags = data.tags.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
            }
          } catch { /* */ }
          files.push({
            path: full, relPath: rel, title, folder, agentSlug,
            mtime: new Date(stat.mtimeMs).toISOString(),
            sizeBytes: stat.size, type: typeTag, category: categoryTag, tags,
          });
        }
      }
      walk(vaultRoot);
      const filtered = files
        .sort((a, b) => b.mtime.localeCompare(a.mtime))
        .filter(f => {
          if (agentFilter === '__shared__' && f.agentSlug != null) return false;
          if (agentFilter && agentFilter !== '__shared__' && f.agentSlug !== agentFilter) return false;
          if (folderFilter && f.folder !== folderFilter) return false;
          if (typeFilter && f.type !== typeFilter) return false;
          if (tagFilter && !f.tags.includes(tagFilter)) return false;
          if (search) {
            const hay = (
              f.title + ' ' + f.relPath + ' ' +
              (f.type || '') + ' ' + (f.category || '') + ' ' +
              f.tags.join(' ')
            ).toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        })
        .slice(0, limit);
      const folderCounts: Record<string, number> = {};
      const typeCounts: Record<string, number> = {};
      const tagCounts: Record<string, number> = {};
      for (const f of files) {
        folderCounts[f.folder] = (folderCounts[f.folder] || 0) + 1;
        if (f.type) typeCounts[f.type] = (typeCounts[f.type] || 0) + 1;
        for (const t of f.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
      res.json({ files: filtered, total: files.length, folderCounts, typeCounts, tagCounts });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── 3. /api/memory  (upstream dashboard.ts:3464 / getMemory at 1667) ─
  // Mirrors upstream src/cli/dashboard.ts:1667 (getMemory) + 3464 (handler).
  app.get('/api/memory', async (_req, res) => {
    try {
      const baseDir = getBaseDir();
      const vaultDir = path.join(baseDir, 'vault');
      const memoryFile = path.join(vaultDir, '00-System', 'MEMORY.md');
      let content = '';
      if (existsSync(memoryFile)) {
        try { content = readFileSync(memoryFile, 'utf-8'); } catch { /* ignore */ }
      }
      const dbPath = path.join(vaultDir, '.memory.db');
      let dbStats: Record<string, unknown> = {};
      if (existsSync(dbPath)) {
        try {
          const Database = (await import('better-sqlite3')).default;
          const db = new Database(dbPath, { readonly: true });
          const chunkCount = (db.prepare('SELECT COUNT(*) as count FROM chunks').get() as { count: number }).count;
          const fileCount = (db.prepare('SELECT COUNT(DISTINCT source_file) as count FROM chunks').get() as { count: number }).count;
          const { size } = statSync(dbPath);
          dbStats = { chunks: chunkCount, files: fileCount, sizeBytes: size };
          try {
            const consolidated = (db.prepare('SELECT COUNT(*) as count FROM chunks WHERE consolidated = 1').get() as { count: number }).count;
            (dbStats as Record<string, unknown>).consolidated = consolidated;
            (dbStats as Record<string, unknown>).unconsolidated = chunkCount - consolidated;
          } catch { /* */ }
          db.close();
        } catch { /* */ }
      }
      let graphStats: Record<string, unknown> = { available: false };
      try {
        const { getSharedGraphStore } = await import('../../memory/graph-store.js');
        const graphDbDir = path.join(baseDir, '.graph.db');
        const gs = await getSharedGraphStore(graphDbDir);
        if (gs) {
          const nodeCount = await gs.query('MATCH (n) RETURN count(n) AS c');
          const edgeCount = await gs.query('MATCH ()-[r]->() RETURN count(r) AS c');
          const labelCounts = await gs.query('MATCH (n) RETURN labels(n)[0] AS label, count(n) AS c ORDER BY c DESC');
          graphStats = {
            available: true,
            nodes: (nodeCount[0] as { c?: number } | undefined)?.c ?? 0,
            edges: (edgeCount[0] as { c?: number } | undefined)?.c ?? 0,
            labels: (labelCounts ?? []).map((r: { label?: string; c?: number }) => ({ label: r.label, count: r.c })),
          };
        }
      } catch { /* */ }
      res.json({ content: content.slice(0, 5000), dbStats, graphStats });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── 4. /api/memory/health  (upstream dashboard.ts:7386) ──────────────
  // Adapted: upstream pulls store from gateway; we use shared getStore() directly.
  app.get('/api/memory/health', async (_req, res) => {
    try {
      const { getStore } = await import('../../tools/shared.js');
      const store = await getStore();
      if (!store?.getMemoryHealth) {
        res.status(503).json({ error: 'Memory store not available' });
        return;
      }
      const health = store.getMemoryHealth({ topCitedLimit: 10 });
      res.json({ ok: true, health });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── 5. /api/memory/graph-stats  (upstream dashboard.ts:7344) ─────────
  // Adapted: upstream pulls store from gateway; we use shared getStore() directly.
  app.get('/api/memory/graph-stats', async (_req, res) => {
    try {
      const { getStore } = await import('../../tools/shared.js');
      const store = await getStore() as { getGraphStats?: (opts: { topN: number; lookbackHours: number }) => unknown };
      if (!store?.getGraphStats) {
        res.status(503).json({ error: 'Memory store not available' });
        return;
      }
      res.json({ ok: true, stats: store.getGraphStats({ topN: 12, lookbackHours: 24 * 7 }) });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── 6. /api/recall-traces  (upstream dashboard.ts:7175) ──────────────
  app.get('/api/recall-traces', async (req: Request, res: Response) => {
    try {
      const sessionKey = String(req.query.sessionKey ?? 'dashboard:web');
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 200);
      const { getStore } = await import('../../tools/shared.js');
      const store = await getStore();
      if (!store?.getRecentRecallTraces) {
        res.json({ traces: [] });
        return;
      }
      const traces = store.getRecentRecallTraces(sessionKey, limit);
      res.json({ ok: true, sessionKey, traces });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── 7. /api/cron  (upstream dashboard.ts:2696 / getCronJobs at 1293) ─
  // Mirrors upstream src/cli/dashboard.ts:1293 (getCronJobs).
  app.get('/api/cron', async (_req, res) => {
    try {
      const baseDir = getBaseDir();
      const vaultDir = path.join(baseDir, 'vault');
      const cronFile = path.join(vaultDir, '00-System', 'CRON.md');
      const matter = (await import('gray-matter')).default;
      const jobs: Array<Record<string, unknown>> = [];
      if (existsSync(cronFile)) {
        try {
          const raw = readFileSync(cronFile, 'utf-8');
          const parsed = matter(raw);
          const mainJobs = (parsed.data.jobs ?? []) as Array<Record<string, unknown>>;
          jobs.push(...mainJobs);
        } catch { /* */ }
      }
      const agentsDir = path.join(vaultDir, '00-System', 'agents');
      if (existsSync(agentsDir)) {
        try {
          for (const slug of readdirSync(agentsDir)) {
            const agentCronFile = path.join(agentsDir, slug, 'CRON.md');
            if (!existsSync(agentCronFile)) continue;
            try {
              const raw = readFileSync(agentCronFile, 'utf-8');
              const parsed = matter(raw);
              const agentJobs = (parsed.data.jobs ?? []) as Array<Record<string, unknown>>;
              for (const job of agentJobs) {
                jobs.push({ ...job, agent: slug, name: `${slug}:${job.name}` });
              }
            } catch { /* */ }
          }
        } catch { /* */ }
      }
      const runsDir = path.join(baseDir, 'cron', 'runs');
      const enriched = jobs.map((job) => {
        const name = String(job.name ?? '');
        const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const logPath = path.join(runsDir, `${safe}.jsonl`);
        let recentRuns: unknown[] = [];
        if (existsSync(logPath)) {
          try {
            const lines = readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
            recentRuns = lines.slice(-10).map((l) => JSON.parse(l)).reverse();
          } catch { /* */ }
        }
        return { ...job, recentRuns };
      });
      res.json({ jobs: enriched });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── 8. /api/cron/broken-jobs  (upstream dashboard.ts:5224) ───────────
  app.get('/api/cron/broken-jobs', async (_req, res) => {
    try {
      const { computeBrokenJobs } = await import('../../gateway/failure-monitor.js');
      res.json({ jobs: computeBrokenJobs() });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── 9. /auth/sessions  (upstream dashboard.ts:2431) ──────────────────
  // Lexi runs in its own process and does not share the upstream sessions Map.
  // The settings-view consumer tolerates an empty list. We surface an empty
  // array with 200 so the UI renders the "no remote sessions" state.
  app.get('/auth/sessions', (_req, res) => {
    res.json({ sessions: [] });
  });

  // ── 10. /api/secrets/refs  (does not exist upstream — Lexi-native) ───
  // Enumerates known secret-bearing files without exposing values.
  // settings-view contract: { secrets: Array<{ name: string; source: string }> }
  app.get('/api/secrets/refs', (_req, res) => {
    try {
      const baseDir = getBaseDir();
      const refs: Array<{ name: string; source: string }> = [];

      // .env file — list keys only.
      const envFile = path.join(baseDir, '.env');
      if (existsSync(envFile)) {
        try {
          const raw = readFileSync(envFile, 'utf-8');
          for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq <= 0) continue;
            const key = trimmed.slice(0, eq).trim();
            if (key) refs.push({ name: key, source: '.env' });
          }
        } catch { /* */ }
      }

      // claude-integrations.json — list top-level integration names.
      const integrationsFile = path.join(baseDir, 'claude-integrations.json');
      if (existsSync(integrationsFile)) {
        try {
          const raw = readFileSync(integrationsFile, 'utf-8');
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const enumerate = (obj: Record<string, unknown>, prefix: string) => {
            for (const k of Object.keys(obj)) {
              refs.push({ name: prefix ? `${prefix}.${k}` : k, source: 'claude-integrations.json' });
            }
          };
          if (parsed && typeof parsed === 'object') {
            // Top-level keys (typical shape: { mcpServers: {...}, ... })
            for (const k of Object.keys(parsed)) {
              const v = parsed[k];
              if (v && typeof v === 'object' && !Array.isArray(v)) {
                enumerate(v as Record<string, unknown>, k);
              } else {
                refs.push({ name: k, source: 'claude-integrations.json' });
              }
            }
          }
        } catch { /* */ }
      }

      res.json({ secrets: refs });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
