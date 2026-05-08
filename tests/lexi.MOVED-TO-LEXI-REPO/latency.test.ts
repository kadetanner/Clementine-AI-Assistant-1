import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import EventSource from 'eventsource';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';
import { getEventBus } from '../../src/lexi-dashboard/events/bus.js';

describe('SSE latency budget (DoD #10)', () => {
  let server: LexiServer; let baseUrl: string;
  beforeAll(async () => { server = await startLexiServer({ port: 0 }); baseUrl = `http://localhost:${server.port}`; });
  afterAll(async () => { await server.stop(); });

  it('p95 of bus.emit → client onmessage is ≤ 500ms over 20 samples', async () => {
    const es = new EventSource(`${baseUrl}/api/events/stream`);
    await new Promise<void>((resolve) => es.addEventListener('open', () => resolve()));

    const samples: number[] = [];
    const SAMPLE_COUNT = 20;

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const t = await new Promise<number>((resolve, reject) => {
        const start = Date.now();
        const onMessage = (ev: MessageEvent): void => {
          const parsed = JSON.parse(ev.data as string) as { payload: { i?: number } };
          if (parsed.payload?.i === i) {
            es.removeEventListener('message', onMessage as EventListener);
            resolve(Date.now() - start);
          }
        };
        es.addEventListener('message', onMessage as EventListener);
        setTimeout(() => reject(new Error(`sample ${i} timed out`)), 1000);
        // emit immediately — measures end-to-end (bus → SSE write → kernel → client parse)
        getEventBus().emit('cron_tick', { i });
      });
      samples.push(t);
    }
    es.close();

    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95) - 1];
    expect(p95).toBeLessThanOrEqual(500);
  });
});
