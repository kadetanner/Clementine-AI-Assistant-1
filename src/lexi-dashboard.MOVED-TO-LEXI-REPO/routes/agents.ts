import { Router, type Express, type Request, type Response } from 'express';
import express from 'express';
import { listAgents, readAgent, writeAgentPrompt, setToolEnabled } from '../agents/vault-store.js';
import { tailActivity, lastActiveAt } from '../agents/activity-log.js';
import { requestRestart } from '../agents/restart.js';

function vaultOpts() {
  const vaultRoot = process.env.LEXI_VAULT_ROOT;
  return vaultRoot ? { vaultRoot } : undefined;
}

export function createAgentsRouter(): Router {
  const router = Router();
  router.use(express.json({ limit: '256kb' }));

  router.get('/', async (_req, res) => {
    const agents = await listAgents(vaultOpts());
    const enriched = agents.map((a) => ({ ...a, last_active_at: lastActiveAt(a.slug), uptime_ms: Date.now() - a.last_modified_at }));
    res.json({ agents: enriched });
  });

  router.get('/:slug', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    // Phase 27 — `lexi` is synthesized as a virtual entry in the registry
    // (no on-disk agent.md). Surface honest virtual detail rather than 404.
    if (slug.toLowerCase() === 'lexi') {
      try { await readAgent(slug, vaultOpts()); /* if it exists on disk later, fall through */ }
      catch {
        res.json({
          slug: 'lexi',
          name: 'Lexi',
          model: 'dashboard',
          tools_enabled: 0,
          tools_disabled: 0,
          memory_size_bytes: 0,
          last_modified_at: Date.now(),
          virtual: true,
          role: 'dashboard',
          prompt: 'Lexi runs as the local dashboard at http://127.0.0.1:3030. She has no agent.md because she is not invoked through the Claude Agent SDK — her behaviour is the dashboard itself. This entry exists so cron / team-task iterators that walk /api/agents see her without 404s.',
          allowedTools: [],
          disabledTools: [],
          raw: '',
          recent_activity: tailActivity(slug, 25),
          last_active_at: lastActiveAt(slug),
        });
        return;
      }
    }
    try {
      const detail = await readAgent(slug, vaultOpts());
      res.json({ ...detail, recent_activity: tailActivity(slug, 25), last_active_at: lastActiveAt(slug) });
    } catch (err) {
      res.status(404).json({ error: 'not_found', slug, message: (err as Error).message });
    }
  });

  router.put('/:slug/prompt', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const { prompt } = req.body ?? {};
    if (typeof prompt !== 'string') { res.status(400).json({ error: 'prompt_required' }); return; }
    try {
      await writeAgentPrompt(slug, prompt, vaultOpts());
      const detail = await readAgent(slug, vaultOpts());
      res.json({ ok: true, ...detail });
    } catch (err) {
      res.status(404).json({ error: 'not_found', message: (err as Error).message });
    }
  });

  router.put('/:slug/tools/:toolId', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const toolId = String(req.params.toolId);
    const { enabled } = req.body ?? {};
    if (typeof enabled !== 'boolean') { res.status(400).json({ error: 'enabled_required' }); return; }
    try {
      const updated = await setToolEnabled(slug, toolId, enabled, vaultOpts());
      res.json({ ok: true, ...updated });
    } catch (err) {
      res.status(404).json({ error: 'not_found', message: (err as Error).message });
    }
  });

  router.post('/:slug/restart', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const result = await requestRestart(slug);
    res.json(result);
  });

  return router;
}

export function register(app: Express): void {
  app.use('/api/agents', createAgentsRouter());
}
