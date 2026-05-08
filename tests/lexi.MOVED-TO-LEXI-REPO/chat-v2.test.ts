/**
 * Phase 19 — Chat console tests.
 *
 * Verifies the free-only invariant (no paid API calls) and the SSE streaming
 * round-trip with the echo stub.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';

let server: LexiServer;
let baseUrl: string;

beforeAll(async () => {
  process.env.LEXI_CHAT_STUB = '1';
  delete process.env.ANTHROPIC_API_KEY;
  server = await startLexiServer({ port: 0 });
  baseUrl = `http://localhost:${server.port}`;
});
afterAll(async () => {
  await server.stop();
  delete process.env.LEXI_CHAT_STUB;
});

describe('chat-v2 routes', () => {
  it('starts a session and returns a sessionId', async () => {
    const r = await fetch(`${baseUrl}/api/lexi-chat/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent: 'default' }),
    });
    expect(r.ok).toBe(true);
    const body = await r.json();
    expect(body.sessionId).toMatch(/^c-\d+/);
  });

  it('refuses send without a session', async () => {
    const r = await fetch(`${baseUrl}/api/lexi-chat/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: '__missing__', prompt: 'hi' }),
    });
    expect(r.status).toBe(404);
  });

  it('lists sessions', async () => {
    const r = await fetch(`${baseUrl}/api/lexi-chat/sessions`);
    expect(r.ok).toBe(true);
    const body = await r.json();
    expect(Array.isArray(body.sessions)).toBe(true);
  });

  it('asserts free-only invariant via _invariants endpoint', async () => {
    const r = await fetch(`${baseUrl}/api/lexi-chat/_invariants`);
    expect(r.ok).toBe(true);
    const body = await r.json();
    expect(body.anthropicKeyPresent).toBe(false);
    expect(body.paidNetworkAttempted).toBe(false);
    expect(body.mode).toBe('stub');
  });

  it('round-trips a turn via send + sessions read', async () => {
    const start = await fetch(`${baseUrl}/api/lexi-chat/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent: 'echo-test' }),
    });
    const { sessionId } = await start.json();
    await fetch(`${baseUrl}/api/lexi-chat/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, prompt: 'hello world' }),
    });
    // Wait for async spawn + write to settle.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const r = await fetch(`${baseUrl}/api/lexi-chat/sessions/${sessionId}`);
    expect(r.ok).toBe(true);
    const body = await r.json();
    expect(body.id).toBe(sessionId);
    expect(body.agent).toBe('echo-test');
    expect(Array.isArray(body.turns)).toBe(true);
    expect(body.turns.length).toBeGreaterThanOrEqual(1);
    expect(body.turns[0].role).toBe('user');
    expect(body.turns[0].content).toBe('hello world');
  });
});
