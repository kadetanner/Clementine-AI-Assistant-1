/**
 * Phase 22 — trace pillar routes (live agent run timeline).
 *
 *   GET  /api/runs                      list recent runs across all agents
 *   GET  /api/runs/:runId/events        full event timeline for a single run
 *   POST /api/runs/_test-event          (test-only when LEXI_ALLOW_TEST_EVENT=1)
 *
 * The trace store is populated by `data/lexi-native/session-log-tailer.ts`,
 * which tails the upstream daemon's `~/.clementine/sessions/*.jsonl` files.
 * Live updates flow through the SSE bus as `agent_run_event`s.
 */
import type { Express, Request, Response } from 'express';
import { listRuns, getRun, appendEvent, type TraceEvent, type TraceEventType } from '../data/lexi-native/trace-store.js';
import { startSessionLogTailer } from '../data/lexi-native/session-log-tailer.js';
import { getEventBus } from '../events/bus.js';

const VALID_TYPES: ReadonlySet<TraceEventType> = new Set([
  'run.started', 'run.step', 'run.tool-call', 'run.tool-result',
  'run.token-usage', 'run.completed', 'run.failed',
]);

export function register(app: Express): void {
  // Boot the tailer on first registration. Idempotent — guarded internally.
  try {
    startSessionLogTailer({ backfillOnStart: false });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[lexi] session-log tailer failed to start:', err);
  }

  app.get('/api/runs', (req: Request, res: Response) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const agent = typeof req.query.agent === 'string' ? req.query.agent : undefined;
    res.json({ runs: listRuns({ agent, limit }) });
  });

  app.get('/api/runs/:runId/events', (req: Request, res: Response) => {
    const runId = String(req.params.runId);
    const events = getRun(runId);
    if (events.length === 0) return res.status(404).json({ error: 'run not found', runId });
    res.json({ runId, agentSlug: events[0].agentSlug, events });
  });

  // Test-only injection so e2e/unit harnesses can populate the store without
  // needing the daemon to be writing real session logs. Gated by env so it
  // never ships hot in production. The dashboard itself never calls this.
  app.post('/api/runs/_test-event', (req: Request, res: Response) => {
    if (process.env.LEXI_ALLOW_TEST_EVENT !== '1') {
      return res.status(404).json({ error: 'disabled' });
    }
    const body = (req.body ?? {}) as Partial<TraceEvent>;
    if (typeof body.runId !== 'string' || typeof body.agentSlug !== 'string' || typeof body.type !== 'string') {
      return res.status(400).json({ error: 'missing runId/agentSlug/type' });
    }
    if (!VALID_TYPES.has(body.type as TraceEventType)) {
      return res.status(400).json({ error: 'invalid type', allowed: [...VALID_TYPES] });
    }
    const ev: TraceEvent = {
      runId: body.runId,
      agentSlug: body.agentSlug,
      type: body.type as TraceEventType,
      ts: typeof body.ts === 'number' ? body.ts : Date.now(),
      payload: body.payload,
    };
    appendEvent(ev);
    try { getEventBus().emit('agent_run_event', ev); } catch { /* ignore */ }
    res.json({ ok: true });
  });
}
