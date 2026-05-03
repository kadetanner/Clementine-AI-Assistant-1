export interface LexiEventLike { type: string; ts: number; payload: unknown; }
export interface EventStreamOptions { pollIntervalMs?: number; bufferSize?: number; sseUrl?: string; recentUrl?: string; }
export type EventHandler = (ev: LexiEventLike) => void;

export class EventStream {
  private handlers = new Set<EventHandler>();
  private buffer: LexiEventLike[] = [];
  private es: EventSource | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastTs = 0;
  private readonly opts: Required<EventStreamOptions>;

  constructor(opts: EventStreamOptions = {}) {
    this.opts = {
      pollIntervalMs: opts.pollIntervalMs ?? 2000,
      bufferSize: opts.bufferSize ?? 200,
      sseUrl: opts.sseUrl ?? '/api/events/stream',
      recentUrl: opts.recentUrl ?? '/api/events/recent',
    };
  }

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  recent(): LexiEventLike[] { return this.buffer.slice(); }

  connect(): void {
    if (typeof EventSource !== 'undefined') {
      this.es = new EventSource(this.opts.sseUrl);
      this.es.onmessage = (ev: MessageEvent) => {
        try { this.dispatch(JSON.parse(ev.data as string) as LexiEventLike); }
        catch { /* skip malformed frame */ }
      };
      this.es.onerror = () => { /* EventSource auto-reconnects; nothing to do */ };
    } else {
      this.pollTimer = setInterval(() => { void this.pollOnce(); }, this.opts.pollIntervalMs);
      void this.pollOnce();
    }
  }

  disconnect(): void {
    if (this.es) { this.es.close(); this.es = null; }
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  private async pollOnce(): Promise<void> {
    try {
      const res = await fetch(this.opts.recentUrl);
      if (!res.ok) return;
      const body = (await res.json()) as { events: LexiEventLike[] };
      for (const ev of body.events) {
        if (ev.ts > this.lastTs) this.dispatch(ev);
      }
    } catch { /* ignore network blips */ }
  }

  private dispatch(ev: LexiEventLike): void {
    this.lastTs = Math.max(this.lastTs, ev.ts);
    this.buffer.push(ev);
    if (this.buffer.length > this.opts.bufferSize) {
      this.buffer.splice(0, this.buffer.length - this.opts.bufferSize);
    }
    for (const h of this.handlers) {
      try { h(ev); } catch { /* never let one handler block another */ }
    }
  }
}

let singleton: EventStream | null = null;
export function getEventStream(): EventStream {
  if (!singleton) { singleton = new EventStream(); singleton.connect(); }
  return singleton;
}
