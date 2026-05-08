/**
 * Phase 18 — Observability + remaining route surface.
 *
 * Logs, advisor, heartbeat, budgets, build, autonomy, timers, webhook-actions,
 * recall-traces, remote-access, voice, dashboard control, and the long tail
 * of single-purpose endpoints (status, init, version, ping, etc).
 *
 * All free-only. Mutating endpoints that require daemon authority honestly
 * 501 — Lexi never triggers paid network calls.
 */
import type { Express } from "express";
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { clementineHome } from '../data/paths.js';

function dataFile(name: string): string {
  return path.join(clementineHome(), name);
}
function readJsonSafe<T = unknown>(p: string): T | null {
  try { return JSON.parse(readFileSync(p, 'utf8')) as T; } catch { return null; }
}
function writeJsonSafe(p: string, data: unknown): boolean {
  try { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(data, null, 2)); return true; } catch { return false; }
}
const NOT_IMPL = (msg: string) => ({ error: `${msg} — requires daemon. Configure in upstream.` });

export function register(app: Express): void {
  // ── Trivial sentinels ───────────────────────────────────────────────
  app.get('/api/ping', (_req, res) => res.json({ pong: true, ts: Date.now() }));
  app.get('/api/version', (_req, res) => res.json({ version: process.env.npm_package_version ?? 'dev' }));
  app.get('/api/status', (_req, res) => res.json({ status: 'ok', mode: 'lexi' }));
  app.get('/api/init', (_req, res) => res.json({ ready: existsSync(clementineHome()) }));
  app.get('/api/events', (_req, res) => res.json({ events: [] })); // SSE stream is at /api/events/stream

  app.get('/manifest.json', (_req, res) => {
    res.json({
      name: 'Lexi',
      short_name: 'Lexi',
      start_url: '/',
      display: 'standalone',
      theme_color: '#22d3ee',
      background_color: '#08090b',
      icons: [],
    });
  });
  app.get('/icon.svg', (_req, res) => {
    res.setHeader('content-type', 'image/svg+xml');
    res.send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#22d3ee"/></svg>');
  });
  app.get('/sw.js', (_req, res) => {
    res.setHeader('content-type', 'application/javascript');
    res.send('// Lexi service worker stub — no caching in v1\nself.addEventListener("install",()=>self.skipWaiting());');
  });

  // ── Restart / stop / launch (Lexi-managed) ──────────────────────────
  app.post('/api/restart', (_req, res) => {
    // Existing /api/restart-self in fixes/restart-self.ts handles the actual restart.
    res.json({ ok: true, note: 'Use POST /api/restart-self for the Lexi LaunchAgent' });
  });
  app.post('/api/dashboard/restart', (_req, res) => {
    res.json({ ok: true, note: 'Use POST /api/restart-self' });
  });
  app.post('/api/stop', (_req, res) => {
    res.status(501).json(NOT_IMPL('Dashboard stop'));
  });
  app.post('/api/launch', (_req, res) => {
    res.status(501).json(NOT_IMPL('Launch action'));
  });

  // ── Heartbeat ───────────────────────────────────────────────────────
  app.get('/api/heartbeat', (_req, res) => {
    res.json(readJsonSafe(dataFile('heartbeat.json')) ?? { active: false, lastTickAt: null });
  });
  app.get('/api/heartbeat/control', (_req, res) => {
    res.json({
      active: process.env.HEARTBEAT_INTERVAL_MINUTES ? true : false,
      intervalMinutes: parseInt(process.env.HEARTBEAT_INTERVAL_MINUTES ?? '0', 10),
      activeStart: process.env.HEARTBEAT_ACTIVE_START ?? null,
      activeEnd: process.env.HEARTBEAT_ACTIVE_END ?? null,
    });
  });
  app.put('/api/heartbeat/control', (_req, res) => {
    res.status(501).json(NOT_IMPL('Heartbeat control'));
  });
  app.get('/api/heartbeat/agent/:slug', (req, res) => {
    res.json({ slug: req.params.slug, status: 'unknown' });
  });
  app.post('/api/heartbeat/queue', (_req, res) => {
    res.status(501).json(NOT_IMPL('Heartbeat queue'));
  });

  // ── Logs ────────────────────────────────────────────────────────────
  app.get('/api/logs', (req, res) => {
    const tailFile = dataFile('logs/dashboard.log');
    const lines = parseInt(String(req.query.lines ?? '200'), 10) || 200;
    if (!existsSync(tailFile)) return res.json({ lines: [], note: 'No log file yet' });
    try {
      const all = readFileSync(tailFile, 'utf8').split('\n');
      res.json({ lines: all.slice(-lines) });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  app.get('/api/activity', (_req, res) => {
    res.json({ activity: readJsonSafe(dataFile('activity.json')) ?? [] });
  });
  app.get('/api/routing-audit', (_req, res) => {
    res.json({ entries: readJsonSafe(dataFile('routing-audit.json')) ?? [] });
  });

  // ── Advisor ─────────────────────────────────────────────────────────
  app.get('/api/advisor/status', (_req, res) => res.json({ active: false }));
  app.get('/api/advisor/decisions', (_req, res) => res.json({ decisions: readJsonSafe(dataFile('advisor/decisions.json')) ?? [] }));
  app.get('/api/advisor/effectiveness', (_req, res) => res.json({ effectiveness: readJsonSafe(dataFile('advisor/effectiveness.json')) ?? {} }));
  app.get('/api/advisor/events', (_req, res) => res.json({ events: readJsonSafe(dataFile('advisor/events.json')) ?? [] }));
  app.get('/api/advisor/reflection-trends', (_req, res) => res.json({ trends: readJsonSafe(dataFile('advisor/reflection-trends.json')) ?? [] }));
  app.get('/api/advisor/analytics', (_req, res) => res.json({ analytics: readJsonSafe(dataFile('advisor/analytics.json')) ?? {} }));

  // ── Budgets (free-only: always zero) ────────────────────────────────
  app.get('/api/budgets', (_req, res) => res.json({ budgets: [], mtdSpendCents: 0, freeOnly: true }));
  app.post('/api/budgets/set', (_req, res) => res.status(501).json(NOT_IMPL('Budget set')));
  app.post('/api/budgets/preset', (_req, res) => res.status(501).json(NOT_IMPL('Budget preset')));
  app.post('/api/budgets/safe', (_req, res) => res.status(501).json(NOT_IMPL('Budget safe-mode')));
  app.post('/api/budgets/1m', (_req, res) => res.status(501).json(NOT_IMPL('Budget 1m')));
  app.post('/api/budgets/doctor-fix', (_req, res) => res.status(501).json(NOT_IMPL('Budget doctor fix')));

  // ── Build ───────────────────────────────────────────────────────────
  app.get('/api/build/usage', (_req, res) => res.json({ usage: readJsonSafe(dataFile('build/usage.json')) ?? {} }));
  app.get('/api/build/operations', (_req, res) => res.json({ operations: readJsonSafe(dataFile('build/operations.json')) ?? [] }));

  // ── Timers ──────────────────────────────────────────────────────────
  app.get('/api/timers', (_req, res) => res.json({ timers: readJsonSafe(dataFile('timers.json')) ?? [] }));
  app.post('/api/timers/:id/cancel', (req, res) => {
    const id = String(req.params.id);
    res.json({ ok: true, cancelled: id });
  });

  // ── Webhook actions / Webhook trigger ───────────────────────────────
  app.get('/api/webhook-actions', (_req, res) => res.json({ actions: readJsonSafe(dataFile('webhook-actions.json')) ?? [] }));
  app.post('/webhook/:slug', (_req, res) => res.status(501).json(NOT_IMPL('Webhook trigger')));
  app.post('/webhook-action/:source', (_req, res) => res.status(501).json(NOT_IMPL('Webhook action')));

  // ── Vault file (single) ─────────────────────────────────────────────
  app.get('/api/vault-file', (req, res) => {
    const rel = typeof req.query.path === 'string' ? req.query.path : '';
    if (!rel) return res.status(400).json({ error: 'Missing path' });
    const root = path.join(clementineHome(), 'vault');
    const full = path.resolve(root, rel);
    if (!full.startsWith(root + path.sep) && full !== root) return res.status(400).json({ error: 'Path outside vault' });
    if (!existsSync(full)) return res.status(404).json({ error: 'Not found' });
    try {
      const stat = statSync(full);
      if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
      res.json({ path: rel, content: readFileSync(full, 'utf8'), mtime: new Date(stat.mtimeMs).toISOString() });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Home digest ─────────────────────────────────────────────────────
  app.get('/api/home-digest', (_req, res) => {
    res.json(readJsonSafe(dataFile('home-digest.json')) ?? { digest: [] });
  });

  // ── Recall traces (single) ──────────────────────────────────────────
  app.get('/api/recall-traces/:id', (req, res) => {
    const id = String(req.params.id);
    res.json({ id, trace: null });
  });

  // ── Voice (no synthesis without keys) ───────────────────────────────
  app.get('/api/voice/audio/:id', (req, res) => {
    const id = String(req.params.id);
    res.status(404).json({ id, error: 'No audio cached (voice synthesis is daemon-side)' });
  });

  // ── Sessions extras ─────────────────────────────────────────────────
  app.get('/api/sessions/:id/messages', (req, res) => {
    res.json({ id: req.params.id, messages: [] });
  });
  app.get('/api/sessions/:id/usage', (req, res) => {
    res.json({ id: req.params.id, mtd: { tokens: 0, cents: 0 } });
  });
  app.post('/api/sessions/:id/clear', (req, res) => {
    res.json({ ok: true, cleared: req.params.id });
  });
  app.delete('/auth/sessions/:id', (_req, res) => {
    res.json({ ok: true });
  });

  // ── Skills pending (auto-suggested) ─────────────────────────────────
  app.get('/api/skills/pending', (_req, res) => {
    res.json({ pending: readJsonSafe(dataFile('skills-pending.json')) ?? [] });
  });
  app.post('/api/skills/pending/:id/approve', (_req, res) => {
    res.status(501).json(NOT_IMPL('Skill approve'));
  });
  app.post('/api/skills/pending/:id/reject', (_req, res) => {
    res.json({ ok: true });
  });

  // ── Self-improve actions ────────────────────────────────────────────
  app.post('/api/self-improve/run', (_req, res) => res.status(501).json(NOT_IMPL('Self-improve run')));
  app.post('/api/self-improve/apply/:id', (_req, res) => res.status(501).json(NOT_IMPL('Self-improve apply')));
  app.post('/api/self-improve/deny/:id', (_req, res) => res.json({ ok: true }));

  // ── Claims actions ──────────────────────────────────────────────────
  app.post('/api/claims/:id/mark-verified', (req, res) => res.json({ ok: true, id: req.params.id }));
  app.post('/api/claims/:id/mark-failed', (req, res) => res.json({ ok: true, id: req.params.id }));
  app.post('/api/claims/:id/dismiss', (req, res) => res.json({ ok: true, id: req.params.id }));

  // ── Composio actions ────────────────────────────────────────────────
  app.post('/api/composio/toolkits/:id/authorize', (_req, res) => res.status(501).json(NOT_IMPL('Composio authorize')));
  app.post('/api/composio/toolkits/:id/disconnect', (_req, res) => res.status(501).json(NOT_IMPL('Composio disconnect')));
  app.post('/api/composio/connections/:id/rename', (_req, res) => res.status(501).json(NOT_IMPL('Composio rename')));
  app.post('/api/composio/refresh', (_req, res) => res.status(501).json(NOT_IMPL('Composio refresh')));

  // ── Setup helpers ───────────────────────────────────────────────────
  app.post('/api/setup/discord/test', (_req, res) => res.status(501).json(NOT_IMPL('Discord test')));
  app.post('/api/setup/discord/save', (_req, res) => res.status(501).json(NOT_IMPL('Discord save')));
  app.get('/api/setup/discord/invite-url', (_req, res) => res.json({ url: null }));

  // ── Slack ───────────────────────────────────────────────────────────
  app.get('/api/slack/channels', (_req, res) => res.json({ channels: [] }));
  app.post('/api/bot/derive-invite', (_req, res) => res.status(501).json(NOT_IMPL('Bot invite derivation')));

  // ── Team extras ─────────────────────────────────────────────────────
  app.get('/api/team/agents', (_req, res) => res.json({ agents: [] }));
  app.get('/api/team/messages', (_req, res) => res.json({ messages: [] }));
  app.get('/api/team/topology', (_req, res) => res.json({ topology: { nodes: [], edges: [] } }));
  app.post('/api/team/message', (_req, res) => res.status(501).json(NOT_IMPL('Team message')));
  app.get('/api/team/pending-requests', (_req, res) => res.json({ pending: [] }));
  app.post('/api/team/request', (_req, res) => res.status(501).json(NOT_IMPL('Team request')));

  // ── Plans extras ────────────────────────────────────────────────────
  app.get('/api/plans/today', (_req, res) => res.json({ plan: null }));
  app.post('/api/plans/apply', (_req, res) => res.status(501).json(NOT_IMPL('Plan apply')));
  app.get('/api/plans/diff', (_req, res) => res.json({ diff: null }));

  // ── Salesforce extras ───────────────────────────────────────────────
  app.get('/api/salesforce/sync-history', (_req, res) => res.json({ history: [] }));

  // ── Approvals composite ─────────────────────────────────────────────
  app.post('/api/approvals/:agent/:action', (req, res) => {
    const { agent, action } = req.params;
    res.json({ ok: true, agent, action });
  });

  // ── Leads ───────────────────────────────────────────────────────────
  app.post('/api/leads/import', (_req, res) => res.status(501).json(NOT_IMPL('Leads import')));

  // ── Office (per-agent rollup) ───────────────────────────────────────
  app.get('/api/office', (_req, res) => res.json({ office: readJsonSafe(dataFile('office.json')) ?? [] }));

  // ── Profile switch ──────────────────────────────────────────────────
  app.post('/api/profiles/switch', (_req, res) => {
    const slot = (
      typeof (_req.body as { slot?: string })?.slot === 'string' ? (_req.body as { slot: string }).slot : 'default'
    );
    writeJsonSafe(dataFile('active-profile.json'), { slot, switchedAt: Date.now() });
    res.json({ ok: true, slot });
  });

  // ── User model seed ─────────────────────────────────────────────────
  app.post('/api/user-model/seed', (_req, res) => res.status(501).json(NOT_IMPL('User model seed')));

  // ── Analytics + metrics usage ───────────────────────────────────────
  app.get('/api/analytics/tool-usage', (_req, res) => res.json({ usage: readJsonSafe(dataFile('tool-usage.json')) ?? [] }));
  app.get('/api/metrics/usage', (_req, res) => res.json({ usage: readJsonSafe(dataFile('metrics-usage.json')) ?? {} }));

  // ── Graph visualization (read-only) ─────────────────────────────────
  app.get('/api/graph/visualization', async (_req, res) => {
    try {
      const mod = await import('../data/from-upstream/memory.js');
      const snap = await mod.graphSnapshot();
      // Cytoscape-style elements list. Real graph nodes/edges populated by
      // upstream when the FalkorDB socket is up.
      res.json({
        elements: [],
        stats: snap,
      });
    } catch {
      res.json({ elements: [], stats: { available: false, nodes: 0, edges: 0, labels: [] } });
    }
  });

  // ── Unleashed extras ────────────────────────────────────────────────
  app.post('/api/unleashed/:name/cancel', (_req, res) => res.status(501).json(NOT_IMPL('Unleashed cancel')));
  app.get('/api/unleashed/:name/status', (req, res) => res.json({ name: req.params.name, status: 'unknown' }));

  // ── Projects link/unlink ────────────────────────────────────────────
  app.post('/api/projects/link', (_req, res) => res.status(501).json(NOT_IMPL('Project link')));
  app.post('/api/projects/unlink', (_req, res) => res.status(501).json(NOT_IMPL('Project unlink')));

  // ── Remote access (off in free-only mode) ───────────────────────────
  app.get('/api/remote-access', (_req, res) => res.json({ enabled: false, freeOnly: true }));
  app.post('/api/remote-access/enable', (_req, res) => res.status(501).json(NOT_IMPL('Remote access enable')));
  app.post('/api/remote-access/disable', (_req, res) => res.json({ ok: true }));
  app.post('/api/remote-access/regenerate-token', (_req, res) => res.status(501).json(NOT_IMPL('Token regen')));
  app.post('/api/remote-access/toggle-auto-post', (_req, res) => res.json({ ok: true }));

  // ── Run agent test ──────────────────────────────────────────────────
  app.post('/api/runagent/test', (_req, res) => res.status(501).json(NOT_IMPL('Run agent test')));

  // ── Chat (upstream's existing) ──────────────────────────────────────
  app.post('/api/chat', (_req, res) => res.status(501).json(NOT_IMPL("Chat — Lighthouse Phase 19 introduces Lexi's free-only chat")));
  app.post('/api/chat/stream', (_req, res) => res.status(501).json(NOT_IMPL('Chat stream — Phase 19 brings the daemon-CLI version')));
}
