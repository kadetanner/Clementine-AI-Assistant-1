import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

describe('DoD 6 · five broken endpoints fixed', () => {
  let server: LexiServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(async () => { await server.stop(); });

  it('GET /api/doctor returns structured 9-check response', async () => {
    const res = await fetch(`${baseUrl}/api/doctor`);
    expect(res.status).toBe(200);
    const body = await res.json() as { checks?: unknown[]; overall?: string };
    expect(Array.isArray(body.checks)).toBe(true);
    expect((body.checks ?? []).length).toBeGreaterThanOrEqual(9);
    expect(body.overall).toMatch(/green|yellow|red/);
  });

  it('GET /api/daily-plan returns parsed daily-note structure', async () => {
    const res = await fetch(`${baseUrl}/api/daily-plan`);
    expect(res.status).toBe(200);
    const body = await res.json() as { date?: string; goals?: unknown[]; tasks?: unknown[] };
    expect(typeof body.date).toBe('string');
    expect(Array.isArray(body.goals)).toBe(true);
    expect(Array.isArray(body.tasks)).toBe(true);
  });

  it('POST /api/voice/synthesize returns audio hash or non-silent provider error', async () => {
    const res = await fetch(`${baseUrl}/api/voice/synthesize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'lexi dod test' }),
    });
    if (res.status === 200) {
      const body = await res.json() as { hash?: string; url?: string };
      expect(body.hash || body.url).toBeTruthy();
    } else {
      // Plan 8 chose 400 ("client must configure") over 503 ("transient server issue")
      expect([400, 502]).toContain(res.status);
      const text = await res.text();
      expect(text).toMatch(/provider|config|tts/i);
    }
  });

  it('GET /api/digest returns endpoint catalog', async () => {
    const res = await fetch(`${baseUrl}/api/digest`);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok?: boolean; endpoints?: unknown[] };
    expect(Array.isArray(body.endpoints)).toBe(true);
    expect((body.endpoints ?? []).length).toBeGreaterThan(0);
  });

  it('GET /api/goals returns goals list with counts', async () => {
    const res = await fetch(`${baseUrl}/api/goals`);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok?: boolean; goals?: unknown[]; count?: number };
    expect(Array.isArray(body.goals)).toBe(true);
    expect(typeof body.count).toBe('number');
  });
});
