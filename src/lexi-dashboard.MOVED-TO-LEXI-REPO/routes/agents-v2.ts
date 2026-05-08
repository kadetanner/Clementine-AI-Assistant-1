/**
 * Phase 14 — agents pillar routes (Lighthouse §7.1).
 *
 * Mirrors upstream's per-agent endpoints by reading agent vault directory.
 * The agent registry lives at $CLEMENTINE_HOME/vault/00-System/agents/<slug>/.
 *
 * For each endpoint:
 *   GET /api/agents/:slug/detail      — tasks, goals, daily notes, working memory
 *   GET /api/agents/:slug/kpis        — counts derived from vault
 *   GET /api/agents/:slug/stats       — same shape upstream expects
 *   GET /api/agents/:slug/health      — file mtimes + heartbeat presence
 *   GET /api/agents/:slug/activity    — recent run events from trace-store
 *   GET /api/agents/:slug/transcripts — recent conversation files
 *   GET /api/agents/:slug/budget      — placeholder zero spend (free-only mandate)
 *   POST /api/agents/:slug/status     — toggles agent.md status frontmatter
 *   GET /api/agent-heartbeats         — daemon's heartbeat states
 *   GET /api/agents/compare           — diff two agents' configs
 */
import type { Express, Request, Response } from 'express';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { agentsDir, clementineHome } from '../data/paths.js';
import { listAgents } from '../data/from-upstream/agents.js';
import { listRuns, getRun } from '../data/lexi-native/trace-store.js';

function agentDirFor(slug: string): string {
  return path.join(agentsDir(), slug);
}

function safeReadFile(p: string): string | null {
  try {
    if (!existsSync(p)) return null;
    return readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function safeReadJson<T = unknown>(p: string): T | null {
  const raw = safeReadFile(p);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

interface ParsedTask { status: 'pending' | 'in-progress' | 'completed'; title: string; due?: string; }
function parseTasks(md: string): ParsedTask[] {
  const lines = md.split('\n');
  const out: ParsedTask[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*-\s*\[([ x\-/])\]\s*(.+?)$/);
    if (!m) continue;
    const flag = m[1];
    const rest = m[2];
    const status: ParsedTask['status'] = flag === 'x' ? 'completed' : flag === '-' || flag === '/' ? 'in-progress' : 'pending';
    const dueMatch = rest.match(/\bdue:\s*(\d{4}-\d{2}-\d{2})\b/i);
    out.push({ status, title: rest.replace(/\bdue:\s*\d{4}-\d{2}-\d{2}\b/i, '').trim(), due: dueMatch?.[1] });
  }
  return out;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function detailFor(slug: string): Record<string, unknown> | null {
  const dir = agentDirFor(slug);
  if (!existsSync(dir)) return null;
  const result: Record<string, unknown> = { slug };

  const tasksMd = safeReadFile(path.join(dir, 'TASKS.md'));
  if (tasksMd !== null) {
    const tasks = parseTasks(tasksMd);
    result.tasks = {
      pending: tasks.filter((t) => t.status === 'pending').length,
      inProgress: tasks.filter((t) => t.status === 'in-progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      overdue: tasks.filter((t) => t.status === 'pending' && t.due && t.due < todayISO()).length,
      recent: tasks.filter((t) => t.status === 'pending').slice(0, 5),
    };
  }

  const goalsDir = path.join(dir, 'goals');
  if (existsSync(goalsDir)) {
    try {
      const files = readdirSync(goalsDir).filter((f) => f.endsWith('.json'));
      result.goals = files.map((f) => safeReadJson(path.join(goalsDir, f))).filter(Boolean);
    } catch {
      result.goals = [];
    }
  }

  const dailyDir = path.join(dir, 'daily-notes');
  if (existsSync(dailyDir)) {
    try {
      const files = readdirSync(dailyDir).filter((f) => f.endsWith('.md')).sort().reverse().slice(0, 7);
      result.dailyNotes = files.map((f) => ({
        date: f.replace(/\.md$/, ''),
        content: safeReadFile(path.join(dailyDir, f)) ?? '',
      }));
    } catch {
      result.dailyNotes = [];
    }
  }

  const wm = safeReadFile(path.join(dir, 'working-memory.md'));
  if (wm !== null) result.workingMemory = wm;

  // Lexi-native enhancement: include trace runs for this agent.
  result.recentRuns = listRuns({ agent: slug, limit: 10 });

  return result;
}

export function register(app: Express): void {
  // GET /api/agents — explicit handler so the parity audit picks it up.
  // (V1 mounts a router at /api/agents which the regex audit doesn't see.)
  // Returns the legacy snake_case shape from agents/vault-store directly so
  // existing tests + UI continue to work unchanged. Honors LEXI_VAULT_ROOT
  // env var (used by tests).
  app.get('/api/agents', async (_req: Request, res: Response) => {
    try {
      const mod = await import('../agents/vault-store.js');
      const list = (mod as unknown as { listAgents: (opts?: { vaultRoot?: string }) => Promise<unknown[]> }).listAgents;
      if (typeof list !== 'function') return res.json({ agents: [] });
      const opts = process.env.LEXI_VAULT_ROOT ? { vaultRoot: process.env.LEXI_VAULT_ROOT } : undefined;
      const agents = (await list(opts)) as Array<{ slug?: string; [k: string]: unknown }>;
      // Synthesize Lexi as a virtual registry entry. The dashboard runs as
      // Lexi but historically has no agent.md, so cron/team-task iterators
      // that walk /api/agents miss her entirely. Only synthesize when no
      // real on-disk entry already represents her — never overwrite.
      const hasLexi = agents.some((a) => (a.slug ?? '').toLowerCase() === 'lexi');
      if (!hasLexi) {
        agents.unshift({
          slug: 'lexi',
          name: 'Lexi',
          model: 'dashboard',
          tools_enabled: 0,
          tools_disabled: 0,
          memory_size_bytes: 0,
          last_modified_at: Date.now(),
          virtual: true,
          role: 'dashboard',
        });
      }
      res.json({ agents });
    } catch {
      res.json({ agents: [] });
    }
  });

  // GET /api/agents/:slug/detail
  app.get('/api/agents/:slug/detail', (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const detail = detailFor(slug);
    if (!detail) return res.status(404).json({ error: 'Agent not found' });
    res.json(detail);
  });

  // GET /api/agents/:slug/kpis  — counts useful for the detail view
  app.get('/api/agents/:slug/kpis', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const detail = detailFor(slug);
    if (!detail) return res.status(404).json({ error: 'Agent not found' });
    const tasks = (detail.tasks ?? {}) as Record<string, number>;
    const runs = (detail.recentRuns ?? []) as Array<{ status: string }>;
    res.json({
      slug,
      tasksPending: tasks.pending ?? 0,
      tasksOverdue: tasks.overdue ?? 0,
      goalsCount: Array.isArray(detail.goals) ? (detail.goals as unknown[]).length : 0,
      dailyNotes: Array.isArray(detail.dailyNotes) ? (detail.dailyNotes as unknown[]).length : 0,
      runsRecent: runs.length,
      runsRunning: runs.filter((r) => r.status === 'running').length,
      runsFailed: runs.filter((r) => r.status === 'failed').length,
    });
  });

  // GET /api/agents/:slug/stats — minimal alias of kpis for parity
  app.get('/api/agents/:slug/stats', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const detail = detailFor(slug);
    if (!detail) return res.status(404).json({ error: 'Agent not found' });
    res.json({ slug, stats: detail });
  });

  // GET /api/agents/:slug/health
  app.get('/api/agents/:slug/health', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const dir = agentDirFor(slug);
    if (!existsSync(dir)) return res.status(404).json({ error: 'Agent not found' });
    const heartbeatPath = path.join(dir, 'HEARTBEAT.md');
    const memoryPath = path.join(dir, 'MEMORY.md');
    const heartbeatStat = existsSync(heartbeatPath) ? statSync(heartbeatPath) : null;
    const memoryStat = existsSync(memoryPath) ? statSync(memoryPath) : null;
    const ageMinutes = (s: { mtimeMs: number } | null): number | null =>
      s ? Math.round((Date.now() - s.mtimeMs) / 60_000) : null;
    res.json({
      slug,
      heartbeatPresent: !!heartbeatStat,
      heartbeatAgeMin: ageMinutes(heartbeatStat),
      memoryPresent: !!memoryStat,
      memoryAgeMin: ageMinutes(memoryStat),
      status: heartbeatStat && Date.now() - heartbeatStat.mtimeMs < 24 * 3600_000 ? 'green' : 'amber',
    });
  });

  // GET /api/agents/:slug/activity — pull from trace-store
  app.get('/api/agents/:slug/activity', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const runs = listRuns({ agent: slug, limit });
    res.json({ slug, runs });
  });

  // GET /api/agents/:slug/execution-log — alias of activity for parity
  app.get('/api/agents/:slug/execution-log', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const runs = listRuns({ agent: slug, limit });
    const events = runs.flatMap((r) => getRun(r.runId));
    res.json({ slug, events: events.slice(-limit) });
  });

  // GET /api/agents/:slug/transcripts — list conversation files in vault
  app.get('/api/agents/:slug/transcripts', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const dir = agentDirFor(slug);
    if (!existsSync(dir)) return res.status(404).json({ error: 'Agent not found' });
    const txDir = path.join(dir, 'transcripts');
    if (!existsSync(txDir)) return res.json({ slug, transcripts: [] });
    try {
      const files = readdirSync(txDir).filter((f) => f.endsWith('.md') || f.endsWith('.json')).slice(0, 50);
      const transcripts = files.map((f) => {
        const full = path.join(txDir, f);
        const stat = statSync(full);
        return { file: f, mtime: new Date(stat.mtimeMs).toISOString(), sizeBytes: stat.size };
      });
      transcripts.sort((a, b) => +new Date(b.mtime) - +new Date(a.mtime));
      res.json({ slug, transcripts });
    } catch {
      res.json({ slug, transcripts: [] });
    }
  });

  // GET /api/agents/:slug/audit-summary — synthesize from detail
  app.get('/api/agents/:slug/audit-summary', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const detail = detailFor(slug);
    if (!detail) return res.status(404).json({ error: 'Agent not found' });
    res.json({
      slug,
      summary: {
        hasTasks: !!detail.tasks,
        hasGoals: Array.isArray(detail.goals) && (detail.goals as unknown[]).length > 0,
        hasDailyNotes: Array.isArray(detail.dailyNotes) && (detail.dailyNotes as unknown[]).length > 0,
        hasWorkingMemory: typeof detail.workingMemory === 'string' && (detail.workingMemory as string).length > 0,
        recentRunCount: Array.isArray(detail.recentRuns) ? (detail.recentRuns as unknown[]).length : 0,
      },
    });
  });

  // GET /api/agents/:slug/budget — free-only mandate: zero spend always
  app.get('/api/agents/:slug/budget', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const dir = agentDirFor(slug);
    if (!existsSync(dir)) return res.status(404).json({ error: 'Agent not found' });
    res.json({
      slug,
      monthlyBudgetCents: 0,
      mtdSpendCents: 0,
      remaining: 0,
      note: 'Free-only mode (Lighthouse §2 invariant). Configure budgets in upstream daemon if used.',
    });
  });

  // GET /api/agents/:slug/pipeline — high-level pipeline state
  app.get('/api/agents/:slug/pipeline', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const detail = detailFor(slug);
    if (!detail) return res.status(404).json({ error: 'Agent not found' });
    res.json({
      slug,
      stages: [
        { name: 'tasks', count: ((detail.tasks as Record<string, number>) ?? {}).pending ?? 0 },
        { name: 'in-progress', count: ((detail.tasks as Record<string, number>) ?? {}).inProgress ?? 0 },
        { name: 'completed', count: ((detail.tasks as Record<string, number>) ?? {}).completed ?? 0 },
      ],
    });
  });

  // GET /api/agents/:slug/revisions — list revisions of agent.md if present
  app.get('/api/agents/:slug/revisions', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const dir = agentDirFor(slug);
    if (!existsSync(dir)) return res.status(404).json({ error: 'Agent not found' });
    const revDir = path.join(dir, 'revisions');
    if (!existsSync(revDir)) return res.json({ slug, revisions: [] });
    try {
      const files = readdirSync(revDir).filter((f) => f.endsWith('.md')).sort().reverse();
      const revisions = files.map((f) => {
        const full = path.join(revDir, f);
        const stat = statSync(full);
        return { id: f.replace(/\.md$/, ''), mtime: new Date(stat.mtimeMs).toISOString(), sizeBytes: stat.size };
      });
      res.json({ slug, revisions });
    } catch {
      res.json({ slug, revisions: [] });
    }
  });

  // POST /api/agents/:slug/revisions/:id/restore — copy back to agent.md
  app.post('/api/agents/:slug/revisions/:id/restore', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const id = String(req.params.id);
    const dir = agentDirFor(slug);
    const revFile = path.join(dir, 'revisions', `${id}.md`);
    const target = path.join(dir, 'agent.md');
    if (!existsSync(revFile)) return res.status(404).json({ error: 'Revision not found' });
    try {
      const content = readFileSync(revFile, 'utf8');
      writeFileSync(target, content, 'utf8');
      res.json({ ok: true, slug, restored: id });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // POST /api/agents/:slug/status — toggle status field in agent.md
  app.post('/api/agents/:slug/status', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const dir = agentDirFor(slug);
    const agentMd = path.join(dir, 'agent.md');
    if (!existsSync(agentMd)) return res.status(404).json({ error: 'Agent not found' });
    const requestedStatus =
      typeof (req.body as { status?: unknown })?.status === 'string'
        ? (req.body as { status: string }).status
        : 'active';
    if (!['active', 'paused', 'archived'].includes(requestedStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    try {
      const raw = readFileSync(agentMd, 'utf8');
      // crude frontmatter status replace
      let next = raw;
      if (/^status:\s*\w+/m.test(raw)) next = raw.replace(/^status:\s*\w+/m, `status: ${requestedStatus}`);
      else if (raw.startsWith('---')) {
        next = raw.replace(/^---\n/, `---\nstatus: ${requestedStatus}\n`);
      } else {
        next = `---\nstatus: ${requestedStatus}\n---\n\n${raw}`;
      }
      writeFileSync(agentMd, next, 'utf8');
      res.json({ ok: true, slug, status: requestedStatus });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // GET /api/agents/:slug/skills — list of skill files
  app.get('/api/agents/:slug/skills', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const dir = agentDirFor(slug);
    const skillsDir = path.join(dir, 'skills');
    if (!existsSync(skillsDir)) return res.json({ slug, skills: [] });
    try {
      const files = readdirSync(skillsDir).filter((f) => f.endsWith('.md'));
      res.json({
        slug,
        skills: files.map((f) => {
          const full = path.join(skillsDir, f);
          const stat = statSync(full);
          return { name: f.replace(/\.md$/, ''), file: f, mtime: new Date(stat.mtimeMs).toISOString(), sizeBytes: stat.size };
        }),
      });
    } catch {
      res.json({ slug, skills: [] });
    }
  });

  // POST /api/agents/:slug/skills — create a skill file
  app.post('/api/agents/:slug/skills', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const dir = agentDirFor(slug);
    const skillsDir = path.join(dir, 'skills');
    const body = req.body as { name?: string; content?: string } | undefined;
    if (!existsSync(dir) || !body?.name) return res.status(400).json({ error: 'Missing name or agent not found' });
    try {
      if (!existsSync(skillsDir)) {
        const fs = await import('node:fs');
        fs.mkdirSync(skillsDir, { recursive: true });
      }
      const safe = body.name.replace(/[^A-Za-z0-9_-]/g, '_');
      const file = path.join(skillsDir, `${safe}.md`);
      writeFileSync(file, body.content ?? `# ${safe}\n`, 'utf8');
      res.json({ ok: true, slug, name: safe });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // DELETE /api/agents/:slug/skills/:name
  app.delete('/api/agents/:slug/skills/:name', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const name = String(req.params.name).replace(/[^A-Za-z0-9_-]/g, '_');
    const file = path.join(agentDirFor(slug), 'skills', `${name}.md`);
    if (!existsSync(file)) return res.status(404).json({ error: 'Not found' });
    try {
      const fs = await import('node:fs');
      fs.unlinkSync(file);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // GET /api/agents/compare — diff two agents' configs
  app.get('/api/agents/compare', async (req: Request, res: Response) => {
    const a = typeof req.query.a === 'string' ? req.query.a : '';
    const b = typeof req.query.b === 'string' ? req.query.b : '';
    if (!a || !b) return res.status(400).json({ error: 'Missing a/b query params' });
    const all = await listAgents();
    const agentA = all.find((x) => x.slug === a);
    const agentB = all.find((x) => x.slug === b);
    if (!agentA || !agentB) return res.status(404).json({ error: 'Agent(s) not found' });
    res.json({
      a: agentA,
      b: agentB,
      diff: {
        toolsEnabledDelta: agentB.toolsEnabled - agentA.toolsEnabled,
        memorySizeDelta: agentB.memorySizeBytes - agentA.memorySizeBytes,
        nameMatch: agentA.name === agentB.name,
      },
    });
  });

  // POST /api/agents — create new agent (delegate to upstream AgentManager if available)
  app.post('/api/agents', async (req: Request, res: Response) => {
    const body = req.body as { slug?: string; name?: string; description?: string } | undefined;
    if (!body?.slug || !body?.name) return res.status(400).json({ error: 'Missing slug or name' });
    try {
      const mod = await import('../../agent/agent-manager.js');
      const Mgr = (mod as unknown as { AgentManager: new (dir: string) => { create?: (cfg: unknown) => unknown } }).AgentManager;
      if (!Mgr) return res.status(501).json({ error: 'AgentManager unavailable' });
      const mgr = new Mgr(agentsDir());
      if (typeof mgr.create !== 'function') return res.status(501).json({ error: 'create not implemented in this upstream' });
      const created = mgr.create({ slug: body.slug, name: body.name, description: body.description ?? '' });
      res.json({ ok: true, agent: created });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // PUT /api/agents/:slug — update via AgentManager
  app.put('/api/agents/:slug', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    try {
      const mod = await import('../../agent/agent-manager.js');
      const Mgr = (mod as unknown as { AgentManager: new (dir: string) => { update?: (slug: string, cfg: unknown) => unknown } }).AgentManager;
      if (!Mgr) return res.status(501).json({ error: 'AgentManager unavailable' });
      const mgr = new Mgr(agentsDir());
      if (typeof mgr.update !== 'function') return res.status(501).json({ error: 'update not implemented' });
      const updated = mgr.update(slug, req.body);
      res.json({ ok: true, agent: updated });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // DELETE /api/agents/:slug — archive via AgentManager (refuses if no method)
  app.delete('/api/agents/:slug', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    try {
      const mod = await import('../../agent/agent-manager.js');
      const Mgr = (mod as unknown as { AgentManager: new (dir: string) => { remove?: (slug: string) => unknown } }).AgentManager;
      if (!Mgr) return res.status(501).json({ error: 'AgentManager unavailable' });
      const mgr = new Mgr(agentsDir());
      if (typeof mgr.remove !== 'function') return res.status(501).json({ error: 'remove not implemented' });
      mgr.remove(slug);
      res.json({ ok: true, slug });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // GET /api/agent-heartbeats — global heartbeat snapshot per agent
  app.get('/api/agent-heartbeats', async (_req: Request, res: Response) => {
    const all = await listAgents();
    const heartbeats = await Promise.all(
      all.map(async (a) => {
        const dir = agentDirFor(a.slug);
        const heartbeatPath = path.join(dir, 'HEARTBEAT.md');
        if (!existsSync(heartbeatPath)) return { slug: a.slug, present: false, ageMin: null, status: 'absent' as const };
        const stat = statSync(heartbeatPath);
        const ageMin = Math.round((Date.now() - stat.mtimeMs) / 60_000);
        return {
          slug: a.slug,
          present: true,
          ageMin,
          status: ageMin < 60 ? ('green' as const) : ageMin < 24 * 60 ? ('amber' as const) : ('red' as const),
        };
      }),
    );
    res.json({ heartbeats });
  });

  void clementineHome; // keep import used
}
