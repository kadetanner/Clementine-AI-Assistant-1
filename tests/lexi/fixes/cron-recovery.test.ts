import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { registerCronRecovery, runStuckDetectionOnce } from '../../../src/lexi-dashboard/fixes/cron-recovery.js';

let dir: string; let server: Server | undefined; let baseUrl: string;
let stopRecovery: (() => void) | undefined;

function writeRuns(job: string, entries: object[]) {
  const file = path.join(dir, 'cron', 'runs', `${job}.jsonl`);
  writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

async function startApp(emit?: (e: unknown) => void) {
  const app = express();
  stopRecovery = registerCronRecovery(app, { baseDir: dir, emit, intervalMs: 0 });
  const s = createServer(app);
  await new Promise<void>((resolve) => { server = s; s.listen(0, () => resolve()); });
  const addr = s.address();
  baseUrl = `http://localhost:${typeof addr === 'object' && addr ? addr.port : 0}`;
}

describe('cron-recovery', () => {
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'lexi-cron-'));
    mkdirSync(path.join(dir, 'cron', 'runs'), { recursive: true });
  });
  afterEach(async () => {
    if (stopRecovery) { stopRecovery(); stopRecovery = undefined; }
    if (server) {
      const s = server;
      server = undefined;
      await new Promise<void>((resolve, reject) => s.close((e) => (e ? reject(e) : resolve())));
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('does not mark a job stuck for <3 identical errors', async () => {
    const now = Date.now();
    writeRuns('insight-check', [
      { startedAt: new Date(now - 5 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long' },
      { startedAt: new Date(now - 2 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long' },
    ]);
    runStuckDetectionOnce({ baseDir: dir });
    expect(existsSync(path.join(dir, 'lexi-stuck-jobs.json'))).toBe(false);
  });

  it('marks a job stuck when 3+ identical errors occur within 30 min and emits SSE', async () => {
    const emit = vi.fn();
    const now = Date.now();
    writeRuns('insight-check', [
      { startedAt: new Date(now - 20 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long: 12345 tokens' },
      { startedAt: new Date(now - 10 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long: 12345 tokens' },
      { startedAt: new Date(now - 1 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long: 12345 tokens' },
    ]);
    runStuckDetectionOnce({ baseDir: dir, emit });
    const state = JSON.parse(readFileSync(path.join(dir, 'lexi-stuck-jobs.json'), 'utf-8'));
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0].name).toBe('insight-check');
    expect(state.jobs[0].errorCount).toBeGreaterThanOrEqual(3);
    expect(state.jobs[0].errorMessage).toMatch(/Prompt is too long/);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'cron_job_stuck',
      payload: expect.objectContaining({ name: 'insight-check' }),
    }));
  });

  it('does not re-emit SSE on subsequent detections of the same stuck job', async () => {
    const emit = vi.fn();
    const now = Date.now();
    writeRuns('insight-check', [
      { startedAt: new Date(now - 20 * 60_000).toISOString(), status: 'error', error: 'Boom' },
      { startedAt: new Date(now - 10 * 60_000).toISOString(), status: 'error', error: 'Boom' },
      { startedAt: new Date(now - 1 * 60_000).toISOString(), status: 'error', error: 'Boom' },
    ]);
    runStuckDetectionOnce({ baseDir: dir, emit });
    runStuckDetectionOnce({ baseDir: dir, emit });
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('exposes GET /api/cron/stuck and POST /api/cron/stuck/:job/clear', async () => {
    const now = Date.now();
    writeRuns('insight-check', [
      { startedAt: new Date(now - 20 * 60_000).toISOString(), status: 'error', error: 'X' },
      { startedAt: new Date(now - 10 * 60_000).toISOString(), status: 'error', error: 'X' },
      { startedAt: new Date(now - 1 * 60_000).toISOString(), status: 'error', error: 'X' },
    ]);
    runStuckDetectionOnce({ baseDir: dir });
    await startApp();
    const list = await fetch(`${baseUrl}/api/cron/stuck`).then((r) => r.json());
    expect(list.jobs).toHaveLength(1);
    const clear = await fetch(`${baseUrl}/api/cron/stuck/insight-check/clear`, { method: 'POST' });
    expect(clear.status).toBe(200);
    const after = await fetch(`${baseUrl}/api/cron/stuck`).then((r) => r.json());
    expect(after.jobs).toHaveLength(0);
  });

  it('normalises numeric noise so "12345 tokens" and "67890 tokens" group together', async () => {
    const now = Date.now();
    writeRuns('insight-check', [
      { startedAt: new Date(now - 20 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long: 12345 tokens' },
      { startedAt: new Date(now - 10 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long: 67890 tokens' },
      { startedAt: new Date(now - 1 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long: 11111 tokens' },
    ]);
    runStuckDetectionOnce({ baseDir: dir });
    const state = JSON.parse(readFileSync(path.join(dir, 'lexi-stuck-jobs.json'), 'utf-8'));
    expect(state.jobs).toHaveLength(1);
  });
});
