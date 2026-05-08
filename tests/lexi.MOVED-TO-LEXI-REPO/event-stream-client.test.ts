/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventStream, type LexiEventLike } from '../../src/lexi-dashboard/ui/state/event-stream.js';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string; readyState = 0;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  constructor(url: string) { this.url = url; FakeEventSource.instances.push(this); }
  close(): void { this.readyState = 2; }
  fire(ev: LexiEventLike): void { this.onmessage?.({ data: JSON.stringify(ev) }); }
}

describe('EventStream client', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource: typeof FakeEventSource }).EventSource = FakeEventSource;
  });

  it('connects to /api/events/stream and forwards events to subscribers', () => {
    const stream = new EventStream();
    const seen: LexiEventLike[] = [];
    stream.subscribe((ev) => seen.push(ev));
    stream.connect();
    expect(FakeEventSource.instances).toHaveLength(1);
    FakeEventSource.instances[0].fire({ type: 'agent_activity', ts: 1, payload: { agent: 'lexi' } });
    expect(seen).toEqual([{ type: 'agent_activity', ts: 1, payload: { agent: 'lexi' } }]);
  });

  it('falls back to polling when EventSource is unavailable', async () => {
    delete (globalThis as { EventSource?: unknown }).EventSource;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [{ type: 'cron_tick', ts: 2, payload: { name: 'x' } }] }),
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    const stream = new EventStream({ pollIntervalMs: 10 });
    const seen: LexiEventLike[] = [];
    stream.subscribe((ev) => seen.push(ev));
    stream.connect();
    await new Promise((r) => setTimeout(r, 30));
    stream.disconnect();
    expect(fetchMock).toHaveBeenCalled();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0].type).toBe('cron_tick');
  });

  it('exposes a buffer of recent events for late subscribers', () => {
    const stream = new EventStream({ bufferSize: 3 });
    stream.connect();
    FakeEventSource.instances[0].fire({ type: 'cron_tick', ts: 1, payload: { i: 1 } });
    FakeEventSource.instances[0].fire({ type: 'cron_tick', ts: 2, payload: { i: 2 } });
    expect(stream.recent()).toHaveLength(2);
  });
});
