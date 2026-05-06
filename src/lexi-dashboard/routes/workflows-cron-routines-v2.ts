/**
 * Phase 16 — Workflows + Cron + Routines pillar (Lighthouse §7.3).
 *
 * Builder, cron, and routines all read/write through upstream's serializer
 * and dashboard/builder modules. Lexi mirrors the routes here. Read paths
 * return real data; write paths attempt thin imports and gracefully 501
 * when not available.
 */
import type { Express, Request, Response } from 'express';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { clementineHome } from '../data/paths.js';
import { listWorkflows, readWorkflow } from '../data/from-upstream/builder.js';

async function builderModule(): Promise<Record<string, unknown> | null> {
  try { return await import('../../dashboard/builder/serializer.js') as never; } catch { return null; }
}

async function call<T = unknown>(modPromise: Promise<Record<string, unknown> | null>, fnName: string, ...args: unknown[]): Promise<T | null> {
  const mod = await modPromise;
  if (!mod) return null;
  const fn = mod[fnName];
  if (typeof fn !== 'function') return null;
  try { return (fn as (...a: unknown[]) => T).apply(mod, args); } catch { return null; }
}

function routinesDir(): string {
  return path.join(clementineHome(), 'routines');
}

function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

export function register(app: Express): void {
  // ── Builder ─────────────────────────────────────────────────────────
  // GET /api/builder/workflows already in proxy
  app.get('/api/builder/workflows/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const wf = await readWorkflow(id);
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });
    res.json(wf);
  });

  app.put('/api/builder/workflows/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const r = await call<{ ok: boolean; error?: string }>(builderModule(), 'saveWorkflow', id, req.body);
    if (!r) return res.status(501).json({ error: 'saveWorkflow unavailable' });
    if (!r.ok) return res.status(400).json(r);
    res.json({ ok: true });
  });

  app.post('/api/builder/workflows', async (req: Request, res: Response) => {
    const id = String((req.body as { id?: string })?.id ?? '');
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const r = await call<{ ok: boolean; error?: string }>(builderModule(), 'saveWorkflow', id, req.body);
    if (!r) return res.status(501).json({ error: 'saveWorkflow unavailable' });
    res.json(r);
  });

  app.delete('/api/builder/workflows/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const r = await call<{ ok: boolean }>(builderModule(), 'deleteWorkflow', id);
    if (r === null) return res.status(501).json({ error: 'deleteWorkflow unavailable' });
    res.json({ ok: true, id });
  });

  app.post('/api/builder/workflows/:id/run', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Workflow execution requires daemon orchestration; trigger via daemon CLI' });
  });

  app.post('/api/builder/workflows/:id/save-from-drawflow', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Drawflow save requires daemon-side parser' });
  });

  app.post('/api/builder/workflows/:id/validate', async (req: Request, res: Response) => {
    const r = await call(builderModule(), 'validateWorkflow', String(req.params.id), req.body);
    if (r === null) return res.status(501).json({ error: 'validateWorkflow unavailable' });
    res.json({ ok: true, result: r });
  });

  app.post('/api/builder/workflows/:id/test', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Workflow test requires daemon orchestration' });
  });

  app.post('/api/builder/workflows/:id/dry-run', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Workflow dry-run requires daemon orchestration' });
  });

  app.post('/api/builder/runs/:runId/cancel', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Run cancellation requires daemon' });
  });

  app.get('/api/builder/mcp-discovery', async (_req: Request, res: Response) => {
    // Free-only mode: no probes. Return whatever's already known.
    const wfs = await listWorkflows();
    const slugs = new Set<string>();
    for (const w of wfs) {
      if (typeof w.agentSlug === 'string') slugs.add(w.agentSlug);
    }
    res.json({ agents: [...slugs], tools: [] });
  });

  app.post('/api/builder/chat', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Builder chat requires daemon LLM access' });
  });

  app.post('/api/builder/chat/stream', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Builder chat stream requires daemon LLM access' });
  });

  app.post('/api/builder/reset', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Builder reset requires daemon' });
  });

  app.post('/api/builder/test', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Builder test requires daemon orchestration' });
  });

  app.post('/api/builder/save', async (req: Request, res: Response) => {
    const id = String((req.body as { id?: string })?.id ?? '');
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const r = await call<{ ok: boolean }>(builderModule(), 'saveWorkflow', id, req.body);
    if (!r) return res.status(501).json({ error: 'saveWorkflow unavailable' });
    res.json(r);
  });

  // ── Cron extra endpoints ────────────────────────────────────────────
  // /api/cron and /api/cron/broken-jobs already in proxy
  app.post('/api/cron', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Cron creation requires daemon write authority' });
  });

  app.put('/api/cron/:name', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Cron update requires daemon' });
  });

  app.delete('/api/cron/:name', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Cron deletion requires daemon' });
  });

  app.post('/api/cron/:name/toggle', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Cron toggle requires daemon' });
  });

  app.post('/api/cron/run/:job', async (req: Request, res: Response) => {
    res.status(501).json({ error: 'Trigger cron via daemon CLI', job: req.params.job });
  });

  app.post('/api/cron/train', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Cron training requires daemon LLM access' });
  });

  app.get('/api/cron/:job/prompt-history', async (req: Request, res: Response) => {
    const job = String(req.params.job);
    const dir = path.join(clementineHome(), 'cron-history', job);
    if (!existsSync(dir)) return res.json({ job, history: [] });
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.md') || f.endsWith('.json')).sort().reverse().slice(0, 50);
      res.json({
        job,
        history: files.map((f) => {
          const full = path.join(dir, f);
          const stat = statSync(full);
          return { id: f, mtime: new Date(stat.mtimeMs).toISOString(), sizeBytes: stat.size };
        }),
      });
    } catch {
      res.json({ job, history: [] });
    }
  });

  app.get('/api/cron/:job/attachments', async (req: Request, res: Response) => {
    const job = String(req.params.job);
    const dir = path.join(clementineHome(), 'cron-attachments', job);
    if (!existsSync(dir)) return res.json({ job, attachments: [] });
    try {
      const files = readdirSync(dir);
      res.json({
        job,
        attachments: files.map((f) => {
          const full = path.join(dir, f);
          const stat = statSync(full);
          return { filename: f, sizeBytes: stat.size, mtime: new Date(stat.mtimeMs).toISOString() };
        }),
      });
    } catch {
      res.json({ job, attachments: [] });
    }
  });

  app.post('/api/cron/:job/attachments', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Attachment uploads require daemon multer pipeline' });
  });

  app.delete('/api/cron/:job/attachments/:filename', async (req: Request, res: Response) => {
    const job = String(req.params.job);
    const filename = String(req.params.filename).replace(/[^A-Za-z0-9._-]/g, '_');
    const file = path.join(clementineHome(), 'cron-attachments', job, filename);
    if (!existsSync(file)) return res.status(404).json({ error: 'Not found' });
    try {
      unlinkSync(file);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.get('/api/cron/:job/attachments/:filename', async (req: Request, res: Response) => {
    const job = String(req.params.job);
    const filename = String(req.params.filename).replace(/[^A-Za-z0-9._-]/g, '_');
    const file = path.join(clementineHome(), 'cron-attachments', job, filename);
    if (!existsSync(file)) return res.status(404).json({ error: 'Not found' });
    try {
      const stat = statSync(file);
      res.setHeader('content-length', String(stat.size));
      res.setHeader('content-type', 'application/octet-stream');
      res.send(readFileSync(file));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/cron/traces/:job', async (req: Request, res: Response) => {
    const job = String(req.params.job);
    const dir = path.join(clementineHome(), 'cron-traces', job);
    if (!existsSync(dir)) return res.json({ job, traces: [] });
    try {
      const files = readdirSync(dir).slice(0, 50);
      res.json({
        job,
        traces: files.map((f) => {
          const full = path.join(dir, f);
          const stat = statSync(full);
          return { id: f, mtime: new Date(stat.mtimeMs).toISOString(), sizeBytes: stat.size };
        }),
      });
    } catch {
      res.json({ job, traces: [] });
    }
  });

  app.post('/api/cron/broken-jobs/:jobName/apply-fix', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Apply-fix requires daemon orchestration' });
  });

  app.post('/api/cron/broken-jobs/:jobName/dismiss-diagnosis', async (req: Request, res: Response) => {
    const job = String(req.params.jobName);
    res.json({ ok: true, dismissed: job });
  });

  // ── Routines ────────────────────────────────────────────────────────
  app.get('/api/routines', async (_req: Request, res: Response) => {
    const dir = routinesDir();
    if (!existsSync(dir)) return res.json({ routines: [] });
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      const routines = files
        .map((f) => {
          try {
            return JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      res.json({ routines });
    } catch {
      res.json({ routines: [] });
    }
  });

  app.get('/api/routines/mcp-tools', async (_req: Request, res: Response) => {
    res.json({ tools: [] });
  });

  app.get('/api/routines/cli-tools', async (_req: Request, res: Response) => {
    res.json({ tools: [] });
  });

  app.get('/api/routines/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id).replace(/[^A-Za-z0-9_.-]/g, '_');
    const file = path.join(routinesDir(), `${id}.json`);
    if (!existsSync(file)) return res.status(404).json({ error: 'Routine not found' });
    try {
      res.json(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      res.status(500).json({ error: 'Routine corrupt' });
    }
  });

  app.post('/api/routines', async (req: Request, res: Response) => {
    const body = req.body as { id?: string } | undefined;
    if (!body?.id) return res.status(400).json({ error: 'Missing id' });
    const id = body.id.replace(/[^A-Za-z0-9_.-]/g, '_');
    try {
      ensureDir(routinesDir());
      writeFileSync(path.join(routinesDir(), `${id}.json`), JSON.stringify(body, null, 2));
      res.json({ ok: true, id });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.put('/api/routines/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id).replace(/[^A-Za-z0-9_.-]/g, '_');
    try {
      ensureDir(routinesDir());
      writeFileSync(path.join(routinesDir(), `${id}.json`), JSON.stringify(req.body, null, 2));
      res.json({ ok: true, id });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.delete('/api/routines/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id).replace(/[^A-Za-z0-9_.-]/g, '_');
    const file = path.join(routinesDir(), `${id}.json`);
    if (!existsSync(file)) return res.status(404).json({ error: 'Not found' });
    try {
      unlinkSync(file);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.post('/api/routines/:id/toggle', async (req: Request, res: Response) => {
    const id = String(req.params.id).replace(/[^A-Za-z0-9_.-]/g, '_');
    const file = path.join(routinesDir(), `${id}.json`);
    if (!existsSync(file)) return res.status(404).json({ error: 'Not found' });
    try {
      const r = JSON.parse(readFileSync(file, 'utf8'));
      r.enabled = !r.enabled;
      writeFileSync(file, JSON.stringify(r, null, 2));
      res.json({ ok: true, id, enabled: r.enabled });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.post('/api/routines/:id/run', async (req: Request, res: Response) => {
    res.status(501).json({ error: 'Routine execution requires daemon', id: req.params.id });
  });

  app.post('/api/routines/:id/dry-run', async (req: Request, res: Response) => {
    res.status(501).json({ error: 'Routine dry-run requires daemon', id: req.params.id });
  });

  app.post('/api/routines/:id/test', async (req: Request, res: Response) => {
    res.status(501).json({ error: 'Routine test requires daemon', id: req.params.id });
  });

  app.get('/api/routines/:id/runs', async (req: Request, res: Response) => {
    const id = String(req.params.id).replace(/[^A-Za-z0-9_.-]/g, '_');
    const dir = path.join(routinesDir(), id, 'runs');
    if (!existsSync(dir)) return res.json({ id, runs: [] });
    try {
      const files = readdirSync(dir).slice(0, 50);
      res.json({
        id,
        runs: files.map((f) => {
          const full = path.join(dir, f);
          const stat = statSync(full);
          return { id: f, mtime: new Date(stat.mtimeMs).toISOString() };
        }),
      });
    } catch {
      res.json({ id, runs: [] });
    }
  });
}
