import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

let server: LexiServer; let baseUrl: string; let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'lexi-diag-'));
  process.env.LEXI_STUCK_STEPS_FILE = path.join(dir, 'stuck.json');
  process.env.LEXI_RUNS_FILE = path.join(dir, 'runs.json');
  writeFileSync(process.env.LEXI_RUNS_FILE, JSON.stringify({
    'run-123': {
      runId: 'run-123', workflowId: 'wf-a',
      steps: [
        { stepId: 's1', startedAt: 1, endedAt: 2, status: 'error', error: 'context refilled', context: 'last good ctx A' },
        { stepId: 's1', startedAt: 3, endedAt: 4, status: 'error', error: 'context refilled', context: 'last good ctx B' },
      ],
      autocompactEvents: [
        { stepId: 's1', ts: 5, message: 'autocompact #1' },
        { stepId: 's1', ts: 6, message: 'autocompact #2' },
      ],
      lastFailure: { stepId: 's1', ts: 7, error: 'context refilled', context: 'failing prompt' },
    },
  }));
  server = await startLexiServer({ port: 0 });
  baseUrl = `http://localhost:${server.port}`;
});
afterAll(async () => {
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.LEXI_STUCK_STEPS_FILE;
  delete process.env.LEXI_RUNS_FILE;
});

describe('GET /api/workflows/runs/:runId/diagnostics', () => {
  it('returns step traces, autocompact events, and last failure', async () => {
    const res = await fetch(`${baseUrl}/api/workflows/runs/run-123/diagnostics`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runId).toBe('run-123');
    expect(body.steps).toHaveLength(2);
    expect(body.autocompactEvents).toHaveLength(2);
    expect(body.lastFailure).toMatchObject({ stepId: 's1', context: 'failing prompt' });
  });

  it('returns 404 for unknown runId', async () => {
    const res = await fetch(`${baseUrl}/api/workflows/runs/unknown/diagnostics`);
    expect(res.status).toBe(404);
  });
});
