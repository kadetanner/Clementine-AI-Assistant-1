import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';
import { getEventBus } from '../../src/lexi-dashboard/events/bus.js';

describe('GET /api/events/recent', () => {
  let server: LexiServer; let baseUrl: string;
  beforeAll(async () => {
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
    getEventBus().emit('cron_tick', { name: 'insight-check' });
    getEventBus().emit('agent_activity', { agent: 'lexi', text: 'thinking' });
  });
  afterAll(async () => { await server.stop(); });

  it('returns the most recent events as JSON', async () => {
    const res = await fetch(`${baseUrl}/api/events/recent?limit=5`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Array<{ type: string; ts: number; payload: unknown }> };
    expect(Array.isArray(body.events)).toBe(true);
    const types = body.events.map((e) => e.type);
    expect(types).toContain('cron_tick');
    expect(types).toContain('agent_activity');
  });
});
