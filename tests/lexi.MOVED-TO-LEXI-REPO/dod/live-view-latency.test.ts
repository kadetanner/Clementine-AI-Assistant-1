import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';
import { getEventBus } from '../../../src/lexi-dashboard/events/bus.js';

describe('DoD 10 · live-view latency p95 ≤ 500ms', () => {
  let server: LexiServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it('100 synthetic events deliver via SSE with p95 ≤ 500ms', async () => {
    const samples: number[] = [];
    const N = 100;
    const bus = getEventBus();

    const res = await fetch(`${baseUrl}/api/events/stream`, {
      headers: { accept: 'text/event-stream' },
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let received = 0;

    const done = (async () => {
      while (received < N) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const m = frame.match(/data:\s*(\{.*\})/s);
          if (!m) continue;
          let payload: any;
          try {
            payload = JSON.parse(m[1]);
          } catch {
            continue;
          }
          if (payload.type !== 'agent_activity') continue;
          if (!payload.payload || !payload.payload.dodProbe) continue;
          samples.push(Date.now() - payload.payload.sentAt);
          received++;
        }
      }
    })();

    // Give the SSE handler a tick to attach its bus subscription before we emit.
    await new Promise((r) => setTimeout(r, 50));

    // Emit N probes spaced 5ms apart
    for (let i = 0; i < N; i++) {
      bus.emit('agent_activity', { sentAt: Date.now(), i, dodProbe: true });
      await new Promise((r) => setTimeout(r, 5));
    }

    await Promise.race([done, new Promise((r) => setTimeout(r, 10_000))]);
    reader.cancel().catch(() => undefined);

    expect(samples.length, 'received samples').toBeGreaterThanOrEqual(Math.floor(N * 0.95));
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length * 0.5)];
    const p95 = samples[Math.floor(samples.length * 0.95) - 1];
    const max = samples[samples.length - 1];
    // eslint-disable-next-line no-console
    console.log('latency:', { count: samples.length, p50, p95, max });
    expect(p95, 'p95 ms').toBeLessThanOrEqual(500);
  }, 30_000);
});
