import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import EventSource from 'eventsource';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';
import { getEventBus } from '../../src/lexi-dashboard/events/bus.js';

describe('GET /api/events/stream (SSE)', () => {
  let server: LexiServer; let baseUrl: string;
  beforeAll(async () => { server = await startLexiServer({ port: 0 }); baseUrl = `http://localhost:${server.port}`; });
  afterAll(async () => { await server.stop(); });

  it('delivers an emitted event to a connected client within 500ms', async () => {
    const es = new EventSource(`${baseUrl}/api/events/stream`);
    try {
      const received = await new Promise<{ type: string; payload: unknown; ts: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout waiting for SSE event')), 1500);
        es.addEventListener('open', () => {
          setTimeout(() => getEventBus().emit('agent_activity', { agent: 'lexi', text: 'hello' }), 5);
        });
        es.onmessage = (ev: MessageEvent) => { clearTimeout(timer); resolve(JSON.parse(ev.data as string)); };
        es.onerror = (err) => { clearTimeout(timer); reject(err as Error); };
      });
      expect(received.type).toBe('agent_activity');
      expect(received.payload).toEqual({ agent: 'lexi', text: 'hello' });
      expect(typeof received.ts).toBe('number');
    } finally {
      es.close();
    }
  });
});
