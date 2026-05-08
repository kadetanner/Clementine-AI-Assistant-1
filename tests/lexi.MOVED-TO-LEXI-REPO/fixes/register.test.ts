import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

let server: LexiServer; let baseUrl: string; let baseDir: string;

beforeAll(async () => {
  baseDir = mkdtempSync(path.join(tmpdir(), 'lexi-reg-'));
  mkdirSync(path.join(baseDir, 'vault', '01-Daily-Notes'), { recursive: true });
  mkdirSync(path.join(baseDir, 'cron', 'runs'), { recursive: true });
  process.env.CLEMENTINE_HOME = baseDir;
  server = await startLexiServer({ port: 0 });
  baseUrl = `http://localhost:${server.port}`;
});
afterAll(async () => {
  await server.stop();
  rmSync(baseDir, { recursive: true, force: true });
  delete process.env.CLEMENTINE_HOME;
});

describe('Plan 8 endpoints registered on the live server', () => {
  it('GET /api/daily-plan responds 200', async () => {
    const r = await fetch(`${baseUrl}/api/daily-plan`); expect(r.status).toBe(200);
  });
  it('POST /api/voice/synthesize responds 400 with no provider configured (not 404)', async () => {
    const r = await fetch(`${baseUrl}/api/voice/synthesize`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hi' }),
    });
    expect(r.status).toBe(400);
  });
  it('GET /api/digest responds 200', async () => {
    const r = await fetch(`${baseUrl}/api/digest`); expect(r.status).toBe(200);
  });
  it('GET /api/goals responds 200', async () => {
    const r = await fetch(`${baseUrl}/api/goals`); expect(r.status).toBe(200);
  });
  it('GET /api/cron/stuck responds 200', async () => {
    const r = await fetch(`${baseUrl}/api/cron/stuck`); expect(r.status).toBe(200);
  });
});
