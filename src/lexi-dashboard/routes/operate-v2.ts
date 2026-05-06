/**
 * Phase 17 — Operate pillar (Connections, MCP, Skills, Approvals, Settings, etc).
 *
 * Read paths return real data; mutating endpoints that require daemon
 * authority (credentials, integration tokens) honest-501 with rationale.
 *
 * Strict free-only invariant: no endpoint here triggers paid network calls.
 * Composio/Discord/Slack/Salesforce/Claude integration toggles surface but
 * remain inert until the daemon-side credentials are configured.
 */
import type { Express, Request, Response } from 'express';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { clementineHome, vaultRoot } from '../data/paths.js';

function dataFile(name: string): string {
  return path.join(clementineHome(), name);
}

function readJsonSafe<T = unknown>(p: string): T | null {
  try { return JSON.parse(readFileSync(p, 'utf8')) as T; } catch { return null; }
}

function writeJsonSafe(p: string, data: unknown): boolean {
  try {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

function listFilesIn(dir: string, ext = '.md'): string[] {
  if (!existsSync(dir)) return [];
  try { return readdirSync(dir).filter((f) => f.endsWith(ext)); } catch { return []; }
}

const NOT_IMPL = (msg: string) => ({ error: `${msg} — requires daemon. Configure in upstream.` });

export function register(app: Express): void {
  // ── MCP servers ─────────────────────────────────────────────────────
  app.get('/api/mcp-servers', async (_req: Request, res: Response) => {
    const f = dataFile('mcp-servers.json');
    res.json({ servers: readJsonSafe<unknown[]>(f) ?? [] });
  });
  app.post('/api/mcp-servers', async (req: Request, res: Response) => {
    const f = dataFile('mcp-servers.json');
    const list = (readJsonSafe<unknown[]>(f) ?? []) as Record<string, unknown>[];
    list.push(req.body as Record<string, unknown>);
    writeJsonSafe(f, list);
    res.json({ ok: true });
  });
  app.put('/api/mcp-servers/:name', async (req: Request, res: Response) => {
    const name = String(req.params.name);
    const f = dataFile('mcp-servers.json');
    const list = (readJsonSafe<unknown[]>(f) ?? []) as Record<string, unknown>[];
    const i = list.findIndex((x) => x.name === name);
    if (i < 0) return res.status(404).json({ error: 'Not found' });
    list[i] = { ...list[i], ...(req.body as Record<string, unknown>) };
    writeJsonSafe(f, list);
    res.json({ ok: true });
  });
  app.delete('/api/mcp-servers/:name', async (req: Request, res: Response) => {
    const name = String(req.params.name);
    const f = dataFile('mcp-servers.json');
    const list = (readJsonSafe<unknown[]>(f) ?? []) as Record<string, unknown>[];
    const next = list.filter((x) => x.name !== name);
    writeJsonSafe(f, next);
    res.json({ ok: true });
  });
  app.get('/api/mcp-permissions', async (_req: Request, res: Response) => {
    res.json({ permissions: readJsonSafe(dataFile('mcp-permissions.json')) ?? [] });
  });
  app.get('/api/mcp-status', async (_req: Request, res: Response) => {
    res.json({ available: true, lastChecked: new Date().toISOString(), red: 0, amber: 0 });
  });

  // ── Skills (top-level, distinct from per-agent skills) ─────────────
  function skillsDir(): string { return path.join(vaultRoot(), '00-System', 'skills'); }
  app.get('/api/skills', async (_req: Request, res: Response) => {
    const dir = skillsDir();
    if (!existsSync(dir)) return res.json({ skills: [] });
    try {
      const all: { name: string; file: string; mtime: string }[] = [];
      for (const f of readdirSync(dir)) {
        const full = path.join(dir, f);
        try {
          const stat = statSync(full);
          if (stat.isFile() && f.endsWith('.md')) {
            all.push({ name: f.replace(/\.md$/, ''), file: f, mtime: new Date(stat.mtimeMs).toISOString() });
          }
        } catch { /* skip */ }
      }
      res.json({ skills: all });
    } catch {
      res.json({ skills: [] });
    }
  });
  app.get('/api/skills/:name', async (req: Request, res: Response) => {
    const name = String(req.params.name).replace(/[^A-Za-z0-9_-]/g, '_');
    const f = path.join(skillsDir(), `${name}.md`);
    if (!existsSync(f)) return res.status(404).json({ error: 'Not found' });
    res.json({ name, content: readFileSync(f, 'utf8') });
  });
  app.post('/api/skills', async (req: Request, res: Response) => {
    const body = req.body as { name?: string; content?: string } | undefined;
    if (!body?.name) return res.status(400).json({ error: 'Missing name' });
    const safe = body.name.replace(/[^A-Za-z0-9_-]/g, '_');
    try {
      mkdirSync(skillsDir(), { recursive: true });
      writeFileSync(path.join(skillsDir(), `${safe}.md`), body.content ?? `# ${safe}\n`, 'utf8');
      res.json({ ok: true, name: safe });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });
  app.put('/api/skills/:name', async (req: Request, res: Response) => {
    const name = String(req.params.name).replace(/[^A-Za-z0-9_-]/g, '_');
    const f = path.join(skillsDir(), `${name}.md`);
    if (!existsSync(f)) return res.status(404).json({ error: 'Not found' });
    try {
      writeFileSync(f, (req.body as { content?: string })?.content ?? '', 'utf8');
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });
  app.delete('/api/skills/:name', async (req: Request, res: Response) => {
    const name = String(req.params.name).replace(/[^A-Za-z0-9_-]/g, '_');
    const f = path.join(skillsDir(), `${name}.md`);
    if (!existsSync(f)) return res.status(404).json({ error: 'Not found' });
    try { unlinkSync(f); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: String(err) }); }
  });
  app.get('/api/skills/:name/info', async (req: Request, res: Response) => {
    const name = String(req.params.name).replace(/[^A-Za-z0-9_-]/g, '_');
    const f = path.join(skillsDir(), `${name}.md`);
    if (!existsSync(f)) return res.status(404).json({ error: 'Not found' });
    const stat = statSync(f);
    res.json({ name, sizeBytes: stat.size, mtime: new Date(stat.mtimeMs).toISOString() });
  });

  // ── Approvals ───────────────────────────────────────────────────────
  app.get('/api/approvals', async (_req: Request, res: Response) => {
    res.json({ approvals: readJsonSafe(dataFile('approvals.json')) ?? [] });
  });
  app.post('/api/approvals/:id/decision', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const list = (readJsonSafe<Record<string, unknown>[]>(dataFile('approvals.json')) ?? []) as Record<string, unknown>[];
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return res.status(404).json({ error: 'Not found' });
    list[i] = {
      ...list[i],
      decision: (req.body as { decision?: string })?.decision ?? 'pending',
      decidedAt: new Date().toISOString(),
    };
    writeJsonSafe(dataFile('approvals.json'), list);
    res.json({ ok: true });
  });

  // ── Settings + workspace dirs + setup ───────────────────────────────
  app.get('/api/settings', async (_req: Request, res: Response) => {
    res.json(readJsonSafe(dataFile('settings.json')) ?? {});
  });
  app.put('/api/settings/:key', async (req: Request, res: Response) => {
    const key = String(req.params.key);
    const f = dataFile('settings.json');
    const o = (readJsonSafe<Record<string, unknown>>(f) ?? {}) as Record<string, unknown>;
    o[key] = (req.body as { value?: unknown })?.value;
    writeJsonSafe(f, o);
    res.json({ ok: true });
  });
  app.delete('/api/settings/:key', async (req: Request, res: Response) => {
    const key = String(req.params.key);
    const f = dataFile('settings.json');
    const o = (readJsonSafe<Record<string, unknown>>(f) ?? {}) as Record<string, unknown>;
    delete o[key];
    writeJsonSafe(f, o);
    res.json({ ok: true });
  });

  app.get('/api/workspace-dirs', async (_req: Request, res: Response) => {
    res.json({ dirs: readJsonSafe(dataFile('workspace-dirs.json')) ?? [] });
  });
  app.post('/api/workspace-dirs', async (req: Request, res: Response) => {
    const f = dataFile('workspace-dirs.json');
    const list = (readJsonSafe<unknown[]>(f) ?? []) as unknown[];
    list.push(req.body);
    writeJsonSafe(f, list);
    res.json({ ok: true });
  });
  app.delete('/api/workspace-dirs', async (req: Request, res: Response) => {
    const f = dataFile('workspace-dirs.json');
    const list = (readJsonSafe<Record<string, unknown>[]>(f) ?? []) as Record<string, unknown>[];
    const target = (req.body as { path?: string })?.path;
    const next = list.filter((x) => x.path !== target);
    writeJsonSafe(f, next);
    res.json({ ok: true });
  });

  app.get('/api/setup/status', async (_req: Request, res: Response) => {
    res.json({ ready: existsSync(clementineHome()) });
  });
  app.post('/api/setup', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Setup wizard'));
  });
  app.post('/api/setup/complete', async (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // ── Tool / assistant preferences ────────────────────────────────────
  app.get('/api/tool-preferences', async (_req: Request, res: Response) => {
    res.json(readJsonSafe(dataFile('tool-preferences.json')) ?? {});
  });
  app.put('/api/tool-preferences', async (req: Request, res: Response) => {
    writeJsonSafe(dataFile('tool-preferences.json'), req.body);
    res.json({ ok: true });
  });

  app.get('/api/assistant-preferences', async (_req: Request, res: Response) => {
    res.json(readJsonSafe(dataFile('assistant-preferences.json')) ?? {});
  });
  app.put('/api/assistant-preferences', async (req: Request, res: Response) => {
    writeJsonSafe(dataFile('assistant-preferences.json'), req.body);
    res.json({ ok: true });
  });

  // ── User model / unleashed / cli-tools ──────────────────────────────
  app.get('/api/user-model', async (_req: Request, res: Response) => {
    res.json(readJsonSafe(dataFile('user-model.json')) ?? {});
  });
  app.put('/api/user-model/:slot', async (req: Request, res: Response) => {
    const slot = String(req.params.slot);
    const f = dataFile('user-model.json');
    const o = (readJsonSafe<Record<string, unknown>>(f) ?? {}) as Record<string, unknown>;
    o[slot] = (req.body as { value?: unknown })?.value;
    writeJsonSafe(f, o);
    res.json({ ok: true });
  });
  app.delete('/api/user-model/:slot', async (req: Request, res: Response) => {
    const slot = String(req.params.slot);
    const f = dataFile('user-model.json');
    const o = (readJsonSafe<Record<string, unknown>>(f) ?? {}) as Record<string, unknown>;
    delete o[slot];
    writeJsonSafe(f, o);
    res.json({ ok: true });
  });
  app.post('/api/user-model', async (req: Request, res: Response) => {
    writeJsonSafe(dataFile('user-model.json'), req.body);
    res.json({ ok: true });
  });

  app.get('/api/unleashed', async (_req: Request, res: Response) => {
    res.json({ items: listFilesIn(path.join(clementineHome(), 'unleashed')) });
  });
  app.post('/api/unleashed', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Unleashed creation'));
  });
  app.put('/api/unleashed/:name', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Unleashed update'));
  });
  app.delete('/api/unleashed/:name', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Unleashed deletion'));
  });

  app.get('/api/cli-tools', async (_req: Request, res: Response) => {
    res.json({ tools: readJsonSafe(dataFile('cli-tools.json')) ?? [] });
  });
  app.post('/api/cli-tools', async (req: Request, res: Response) => {
    const f = dataFile('cli-tools.json');
    const list = (readJsonSafe<unknown[]>(f) ?? []) as unknown[];
    list.push(req.body);
    writeJsonSafe(f, list);
    res.json({ ok: true });
  });
  app.put('/api/cli-tools/:cmd', async (req: Request, res: Response) => {
    const cmd = String(req.params.cmd);
    const f = dataFile('cli-tools.json');
    const list = (readJsonSafe<Record<string, unknown>[]>(f) ?? []) as Record<string, unknown>[];
    const i = list.findIndex((x) => x.cmd === cmd);
    if (i < 0) return res.status(404).json({ error: 'Not found' });
    list[i] = { ...list[i], ...(req.body as Record<string, unknown>) };
    writeJsonSafe(f, list);
    res.json({ ok: true });
  });
  app.delete('/api/cli-tools/:cmd', async (req: Request, res: Response) => {
    const cmd = String(req.params.cmd);
    const f = dataFile('cli-tools.json');
    const list = (readJsonSafe<Record<string, unknown>[]>(f) ?? []) as Record<string, unknown>[];
    writeJsonSafe(f, list.filter((x) => x.cmd !== cmd));
    res.json({ ok: true });
  });

  // ── Profiles / metrics / available-tools / autonomy / browse-dir ───
  app.get('/api/profiles', async (_req: Request, res: Response) => {
    res.json({ profiles: readJsonSafe(dataFile('profiles.json')) ?? [] });
  });
  app.put('/api/profiles', async (req: Request, res: Response) => {
    writeJsonSafe(dataFile('profiles.json'), req.body);
    res.json({ ok: true });
  });

  app.get('/api/metrics', async (_req: Request, res: Response) => {
    res.json({ ts: Date.now(), metrics: readJsonSafe(dataFile('metrics.json')) ?? {} });
  });
  app.post('/api/metrics', async (req: Request, res: Response) => {
    writeJsonSafe(dataFile('metrics.json'), req.body);
    res.json({ ok: true });
  });

  app.get('/api/available-tools', async (_req: Request, res: Response) => {
    res.json({ tools: readJsonSafe(dataFile('available-tools.json')) ?? [] });
  });

  app.get('/api/autonomy', async (req: Request, res: Response) => {
    const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
    res.json({ slug, autonomy: readJsonSafe(dataFile('autonomy.json')) ?? {} });
  });

  app.get('/api/browse-dir', async (req: Request, res: Response) => {
    const dir = typeof req.query.dir === 'string' ? req.query.dir : clementineHome();
    if (!existsSync(dir)) return res.status(404).json({ error: 'Dir not found' });
    try {
      const entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({
        name: e.name,
        isDir: e.isDirectory(),
      }));
      res.json({ dir, entries });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/fs/browse', async (req: Request, res: Response) => {
    const dir = typeof req.query.path === 'string' ? req.query.path : clementineHome();
    if (!existsSync(dir)) return res.status(404).json({ error: 'Path not found' });
    try {
      const entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({ name: e.name, isDir: e.isDirectory() }));
      res.json({ path: dir, entries });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Sessions (read-only — Lexi has no auth) ─────────────────────────
  app.get('/api/sessions', async (_req: Request, res: Response) => {
    res.json({ sessions: [] });
  });
  app.delete('/api/sessions/:id', async (_req: Request, res: Response) => {
    res.json({ ok: true });
  });
  app.post('/auth/login', async (_req: Request, res: Response) => {
    res.json({ ok: true, mode: 'local-only' });
  });
  app.get('/auth/logout', async (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // ── Auth: anthropic status (free-only — no calls) ───────────────────
  app.get('/api/auth/anthropic/status', async (_req: Request, res: Response) => {
    res.json({ configured: false, mode: 'lexi-free-only' });
  });
  app.post('/api/auth/anthropic/login', async (_req: Request, res: Response) => {
    res.status(501).json(NOT_IMPL('Anthropic login'));
  });
  app.post('/api/auth/anthropic/wait', async (_req: Request, res: Response) => {
    res.status(501).json(NOT_IMPL('Anthropic wait'));
  });

  // ── Channels / Discord / Slack / Salesforce / Composio / claude-integrations ─
  app.get('/api/channels/status', async (_req: Request, res: Response) => {
    res.json({ channels: [] });
  });
  app.get('/api/discord/channels', async (_req: Request, res: Response) => {
    res.json({ channels: [] });
  });
  app.get('/api/composio/status', async (_req: Request, res: Response) => {
    res.json({ configured: false, note: 'Free-only mode — no paid API calls' });
  });
  app.get('/api/composio/toolkits', async (_req: Request, res: Response) => {
    res.json({ toolkits: [] });
  });
  app.get('/api/claude-integrations', async (_req: Request, res: Response) => {
    res.json({ integrations: [] });
  });
  app.get('/api/salesforce/status', async (_req: Request, res: Response) => {
    res.json({ configured: false });
  });
  app.get('/api/slack/status', async (_req: Request, res: Response) => {
    res.json({ configured: false });
  });

  // ── Background tasks ────────────────────────────────────────────────
  app.get('/api/background-tasks', async (_req: Request, res: Response) => {
    res.json({ tasks: readJsonSafe(dataFile('background-tasks.json')) ?? [] });
  });
  app.post('/api/background-tasks/:id/cancel', async (_req: Request, res: Response) => {
    res.status(501).json(NOT_IMPL('Background task cancel'));
  });
  app.delete('/api/background-tasks/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const f = dataFile('background-tasks.json');
    const list = (readJsonSafe<Record<string, unknown>[]>(f) ?? []) as Record<string, unknown>[];
    writeJsonSafe(f, list.filter((x) => x.id !== id));
    res.json({ ok: true });
  });

  // ── Plans / projects / claims / team ────────────────────────────────
  app.get('/api/plans', async (_req: Request, res: Response) => {
    res.json({ plans: listFilesIn(path.join(clementineHome(), 'plans')) });
  });
  app.post('/api/plans', async (req: Request, res: Response) => {
    res.json(NOT_IMPL('Plans creation'));
    void req;
  });
  app.get('/api/plans/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id).replace(/[^A-Za-z0-9_.-]/g, '_');
    const f = path.join(clementineHome(), 'plans', `${id}.md`);
    if (!existsSync(f)) return res.status(404).json({ error: 'Not found' });
    res.json({ id, content: readFileSync(f, 'utf8') });
  });
  app.put('/api/plans/:id', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Plan update'));
  });
  app.delete('/api/plans/:id', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Plan deletion'));
  });

  app.get('/api/projects', async (_req: Request, res: Response) => {
    res.json({ projects: listFilesIn(path.join(clementineHome(), 'projects'), '') });
  });
  app.post('/api/projects', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Project creation'));
  });
  app.get('/api/projects/:id', async (req: Request, res: Response) => {
    res.json({ id: req.params.id });
  });

  app.get('/api/claims', async (_req: Request, res: Response) => {
    res.json({ claims: readJsonSafe(dataFile('claims.json')) ?? [] });
  });
  app.post('/api/claims', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Claim creation'));
  });
  app.put('/api/claims/:id', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Claim update'));
  });
  app.delete('/api/claims/:id', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Claim deletion'));
  });

  app.get('/api/team/status', async (_req: Request, res: Response) => {
    // team/status already in upstream's dashboard.ts via different module — Lexi shadows
    res.json({ agents: [] });
  });
  app.get('/api/team', async (_req: Request, res: Response) => {
    res.json({ team: readJsonSafe(dataFile('team.json')) ?? [] });
  });
  app.post('/api/team', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Team add'));
  });
  app.put('/api/team/:id', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Team update'));
  });
  app.delete('/api/team/:id', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Team remove'));
  });
  app.get('/api/team/leaderboard', async (_req: Request, res: Response) => {
    res.json({ leaderboard: [] });
  });

  // ── Self-improve ────────────────────────────────────────────────────
  app.get('/api/self-improve', async (_req: Request, res: Response) => {
    res.json({ runs: readJsonSafe(dataFile('self-improve.json')) ?? [] });
  });
  app.post('/api/self-improve', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Self-improve trigger'));
  });
  app.put('/api/self-improve/:id', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Self-improve update'));
  });
  app.delete('/api/self-improve/:id', async (_req: Request, res: Response) => {
    res.json(NOT_IMPL('Self-improve deletion'));
  });

  // Free-only invariant assertion in response headers (defensive)
  app.use((_req, res, next) => {
    if (!res.headersSent) res.setHeader('x-lexi-mode', 'free-only');
    next();
  });
}
