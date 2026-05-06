import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

// DoD 5 coverage from docs/lexi/specs/2026-05-02-lexi-dashboard-design.md §9.
//
// "Every API endpoint either returns 200 or surfaces a deliberate 4xx with a
// UI-rendered message — never a silent failure (no opaque 5xx, no empty body)."
//
// Deviations from docs/lexi/plans/09-dod-validation.md (lines 153-211):
//   - Plan's endpoint list includes routes that don't exist on Lexi's server
//     (/api/mcp/servers, /api/workflows, /api/vault/index, /api/memory/stats,
//     /api/cron/jobs, /api/settings). Replaced with the actual route surface
//     registered in src/lexi-dashboard/routes.ts.
//   - Dropped /api/cron/broken-jobs — that route is upstream's
//     (src/cli/dashboard.ts), not registered on startLexiServer.
//   - Dropped per-resource endpoints requiring real :slug/:id values that
//     don't exist in a fresh test server. Test the LIST endpoints only.
//   - Dropped POST /api/restart-self — dangerous to invoke in tests.
const ENDPOINTS: Array<{ method: 'GET' | 'POST' | 'PUT'; path: string; body?: unknown }> = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/api/doctor' },
  { method: 'GET', path: '/api/daily-plan' },
  { method: 'GET', path: '/api/digest' },
  { method: 'GET', path: '/api/goals' },
  { method: 'GET', path: '/api/agents' },
  { method: 'GET', path: '/api/connections' },
  { method: 'GET', path: '/api/workflows/stuck-steps' },
  { method: 'GET', path: '/api/cron/stuck' },
  { method: 'GET', path: '/api/events/recent' },
  { method: 'POST', path: '/api/voice/synthesize', body: { text: 'dod test' } },
];

describe('DoD 5 · API endpoint coverage', () => {
  let server: LexiServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  for (const { method, path, body } of ENDPOINTS) {
    it(`${method} ${path} — 200 or non-silent 4xx`, async () => {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status >= 400 && res.status < 500) {
        const text = await res.text();
        expect(text.length, `${path} body length`).toBeGreaterThan(0);
        expect(text, `${path} body should mention error/message`).toMatch(/error|message/i);
      } else {
        expect(res.status, `${path}`).toBe(200);
      }
    });
  }

  it('no endpoint returns 5xx', async () => {
    for (const { method, path, body } of ENDPOINTS) {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      expect(res.status, `${path}`).toBeLessThan(500);
    }
  });
});
