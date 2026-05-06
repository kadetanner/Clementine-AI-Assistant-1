/**
 * Phase 14 — agents pillar route smoke tests.
 *
 * Mounts the routes against a fresh Express app (no live LaunchAgent needed).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';

let server: LexiServer;
let baseUrl: string;

beforeAll(async () => {
  server = await startLexiServer({ port: 0 });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(async () => {
  await server.stop();
});

describe('agents-v2 routes', () => {
  it('GET /api/agent-heartbeats returns array', async () => {
    const r = await fetch(`${baseUrl}/api/agent-heartbeats`);
    expect(r.ok).toBe(true);
    const body = await r.json();
    expect(Array.isArray(body.heartbeats)).toBe(true);
  });

  it('GET /api/agents/:slug/detail returns 404 for unknown agent', async () => {
    const r = await fetch(`${baseUrl}/api/agents/__nope__/detail`);
    expect(r.status).toBe(404);
  });

  it('GET /api/agents/:slug/kpis returns 404 for unknown agent', async () => {
    const r = await fetch(`${baseUrl}/api/agents/__nope__/kpis`);
    expect(r.status).toBe(404);
  });

  it('GET /api/agents/:slug/budget reflects free-only invariant', async () => {
    // Use a real on-disk agent slug. Phase 27 synthesizes a virtual 'lexi'
    // entry with no directory; per-agent dir-rooted routes 404 for it.
    const list = await (await fetch(`${baseUrl}/api/agents`)).json();
    const slug = (list.agents ?? []).find((a: { slug: string; virtual?: boolean }) => !a.virtual)?.slug;
    if (!slug) return;
    const r = await fetch(`${baseUrl}/api/agents/${slug}/budget`);
    expect(r.ok).toBe(true);
    const body = await r.json();
    expect(body.monthlyBudgetCents).toBe(0);
    expect(body.mtdSpendCents).toBe(0);
  });

  it('GET /api/agents/:slug/activity returns runs array', async () => {
    const list = await (await fetch(`${baseUrl}/api/agents`)).json();
    const slug = (list.agents ?? []).find((a: { slug: string; virtual?: boolean }) => !a.virtual)?.slug;
    if (!slug) return;
    const r = await fetch(`${baseUrl}/api/agents/${slug}/activity`);
    expect(r.ok).toBe(true);
    const body = await r.json();
    expect(Array.isArray(body.runs)).toBe(true);
  });

  it('GET /api/agents/compare requires both query params', async () => {
    const r = await fetch(`${baseUrl}/api/agents/compare`);
    expect(r.status).toBe(400);
  });

  it('GET /api/agents/:slug/skills returns skills array (possibly empty)', async () => {
    const list = await (await fetch(`${baseUrl}/api/agents`)).json();
    const slug = (list.agents ?? [])[0]?.slug;
    if (!slug) return;
    const r = await fetch(`${baseUrl}/api/agents/${slug}/skills`);
    expect(r.ok).toBe(true);
    const body = await r.json();
    expect(Array.isArray(body.skills)).toBe(true);
  });
});
