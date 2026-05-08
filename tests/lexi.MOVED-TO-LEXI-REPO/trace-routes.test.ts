import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { register } from '../../src/lexi-dashboard/routes/trace-v2.js';
import { _resetForTest, appendEvent } from '../../src/lexi-dashboard/data/lexi-native/trace-store.js';
import { stopSessionLogTailer } from '../../src/lexi-dashboard/data/lexi-native/session-log-tailer.js';

let baseUrl = '';
let server: Server | null = null;

beforeAll(async () => {
  process.env.LEXI_ALLOW_TEST_EVENT = '1';
  const app = express();
  app.use(express.json());
  register(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      if (addr && typeof addr === 'object') baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  delete process.env.LEXI_ALLOW_TEST_EVENT;
  stopSessionLogTailer();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
});

beforeEach(() => { _resetForTest(); });

describe('trace routes', () => {
  it('GET /api/runs returns an empty list when nothing has run', async () => {
    const res = await fetch(`${baseUrl}/api/runs`);
    expect(res.status).toBe(200);
    const j = await res.json() as { runs: unknown[] };
    expect(j.runs).toEqual([]);
  });

  it('GET /api/runs reflects appended events with status, agent, and id', async () => {
    appendEvent({ runId: 'r1', agentSlug: 'lexi', type: 'run.started', ts: 1000, payload: {} });
    appendEvent({ runId: 'r1', agentSlug: 'lexi', type: 'run.completed', ts: 2000, payload: {} });
    const res = await fetch(`${baseUrl}/api/runs?limit=5`);
    const j = await res.json() as { runs: { runId: string; agentSlug: string; status: string }[] };
    expect(j.runs).toHaveLength(1);
    expect(j.runs[0]).toMatchObject({ runId: 'r1', agentSlug: 'lexi', status: 'completed' });
  });

  it('GET /api/runs supports the agent filter', async () => {
    appendEvent({ runId: 'r-lex', agentSlug: 'lexi', type: 'run.started', ts: 1, payload: {} });
    appendEvent({ runId: 'r-jon', agentSlug: 'jonah', type: 'run.started', ts: 2, payload: {} });
    const res = await fetch(`${baseUrl}/api/runs?agent=jonah`);
    const j = await res.json() as { runs: { runId: string }[] };
    expect(j.runs.map((r) => r.runId)).toEqual(['r-jon']);
  });

  it('GET /api/runs/:runId/events returns 404 when unknown', async () => {
    const res = await fetch(`${baseUrl}/api/runs/nope/events`);
    expect(res.status).toBe(404);
  });

  it('GET /api/runs/:runId/events returns the timeline', async () => {
    appendEvent({ runId: 'r2', agentSlug: 'lexi', type: 'run.started', ts: 1, payload: { prompt: 'hi' } });
    appendEvent({ runId: 'r2', agentSlug: 'lexi', type: 'run.tool-call', ts: 2, payload: { tool: 'Bash' } });
    const res = await fetch(`${baseUrl}/api/runs/r2/events`);
    const j = await res.json() as { runId: string; events: { type: string }[] };
    expect(j.runId).toBe('r2');
    expect(j.events.map((e) => e.type)).toEqual(['run.started', 'run.tool-call']);
  });

  it('POST /api/runs/_test-event ingests when LEXI_ALLOW_TEST_EVENT=1', async () => {
    const res = await fetch(`${baseUrl}/api/runs/_test-event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId: 'r3', agentSlug: 'lexi', type: 'run.started' }),
    });
    expect(res.status).toBe(200);
    const list = await fetch(`${baseUrl}/api/runs`).then((r) => r.json()) as { runs: { runId: string }[] };
    expect(list.runs.map((r) => r.runId)).toContain('r3');
  });

  it('POST /api/runs/_test-event rejects invalid type', async () => {
    const res = await fetch(`${baseUrl}/api/runs/_test-event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId: 'r4', agentSlug: 'lexi', type: 'not-real' }),
    });
    expect(res.status).toBe(400);
  });
});
