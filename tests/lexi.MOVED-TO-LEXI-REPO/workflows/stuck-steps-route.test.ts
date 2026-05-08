import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

let server: LexiServer; let baseUrl: string; let dir: string; let file: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'lexi-stuck-route-'));
  file = path.join(dir, 'stuck.json');
  process.env.LEXI_STUCK_STEPS_FILE = file;
  server = await startLexiServer({ port: 0 });
  baseUrl = `http://localhost:${server.port}`;
});
afterAll(async () => { await server.stop(); rmSync(dir, { recursive: true, force: true }); delete process.env.LEXI_STUCK_STEPS_FILE; });
beforeEach(() => { writeFileSync(file, '[]'); });

describe('/api/workflows/stuck-steps', () => {
  it('GET returns the current list', async () => {
    writeFileSync(file, JSON.stringify([{ workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing', detectedAt: 1, lastError: 'x', thrashingEvents: 3 }]));
    const res = await fetch(`${baseUrl}/api/workflows/stuck-steps`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ workflowId: 'wf-a', stepId: 's1' });
  });

  it('DELETE clears a stuck step', async () => {
    writeFileSync(file, JSON.stringify([{ workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing', detectedAt: 1, lastError: 'x', thrashingEvents: 3 }]));
    const res = await fetch(`${baseUrl}/api/workflows/stuck-steps/wf-a/s1`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    const after = await (await fetch(`${baseUrl}/api/workflows/stuck-steps`)).json();
    expect(after).toEqual([]);
  });
});
