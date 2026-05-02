# Lexi Dashboard — Plan 3: Live View (Now Playing + System Map + Activity Stream)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Home page into a live, real-time view of the running Clementine system. SSE multiplexes agent activity, MCP call lifecycle, cron ticks, webhook arrivals, and workflow state changes into one stream. Three panels consume it: a center "Now Playing" card showing the current agent's streaming output and tool calls; a right-rail "Activity Stream" reverse-chrono list with filter chips and collapse-to-sliver; a top-bar "System Map" pill strip plus a drag-to-expand bottom drawer with a force-directed graph.

**Architecture:** All new files in `src/lexi-dashboard/`. Server-side `EventBus` taps upstream emitters where they exist (read-only — no upstream edits) and exposes thin `emit()` wrappers in our own modules. SSE endpoint streams JSON-encoded events. Polling fallback returns the last 200 events. Lit components consume via a single client-side `EventStream` singleton.

**Tech Stack:** TypeScript 5+ · Express SSE · Lit 3 · `d3-force@3` (lazy-loaded chunk for the bottom drawer only) · Vitest (with EventSource polyfill `eventsource@2`).

**Spec reference:** `docs/lexi/specs/2026-05-02-lexi-dashboard-design.md` §6.

---

## Conventions inherited from Plan 1

- Files kebab-case in `src/lexi-dashboard/**`. Components `lexi-` prefixed Lit elements.
- API routes `/api/<resource>`. Tests in `tests/lexi/`.
- SSE event shape **locked**: `{ type: string; ts: number; payload: unknown }`.
- Tests use `execFileSync` (never `execSync`); DOM mutation uses `replaceChildren()` + `appendChild()` (never `innerHTML`).
- Conventional commits (`feat(lexi):`, `test(lexi):`, …).
- Never edit upstream files. Importing from `src/agent/`, `src/dashboard/`, `src/cli/dashboard.ts` for **read-only inspection** is OK; modifying any of them is forbidden.

## File structure (created in this plan)

```
src/lexi-dashboard/
  events/
    types.ts                       ← LexiEvent type + EVENT_TYPES const
    bus.ts                         ← in-process EventBus (ring buffer + EventEmitter)
    upstream-taps.ts               ← thin wrappers around upstream emitters
    sse.ts                         ← /api/events/stream + /api/events/recent handlers
  ui/
    state/
      event-stream.ts              ← client EventSource singleton + polling fallback
    components/
      lexi-now-playing.ts
      lexi-activity-stream.ts
      lexi-system-map-strip.ts
      lexi-system-map-drawer.ts
      lexi-home-view.ts
tests/lexi/
  events-bus.test.ts
  events-sse.test.ts
  events-recent.test.ts
  event-stream-client.test.ts
  now-playing.test.ts
  activity-stream.test.ts
  system-map-strip.test.ts
  system-map-drawer.test.ts
  home-view.test.ts
```

**Modified files:** `src/lexi-dashboard/server.ts` (mount the new routes — Plan 1 created this file, so it is *our* file, not upstream); `src/lexi-dashboard/ui/components/lexi-app.ts` (point `home` route at `lexi-home-view`); `src/lexi-dashboard/ui/components/lexi-right-rail.ts` (replace placeholder); `src/lexi-dashboard/ui/components/lexi-bottom-drawer.ts` (replace placeholder); `src/lexi-dashboard/ui/components/lexi-top-bar.ts` (insert system-map strip); `package.json` (add `d3-force`, `eventsource`).

---

## Tradeoffs (read before starting)

- **`d3-force`** adds ~30KB minified to the bundle. We mitigate by importing it via dynamic `import()` only inside `lexi-system-map-drawer.ts`, so the cost is paid only when the user expands the drawer.
- **SSE vs WebSockets.** SSE is one-way (server→client) which matches our needs and is dramatically simpler (plain HTTP, auto-reconnect, no framing). Controls (stop/pause) go through normal `POST /api/agents/:id/stop` etc.
- **Upstream emitter coupling.** If upstream renames a hook surface we depend on in `upstream-taps.ts`, our build fails loudly — same risk profile Plan 1 already accepted via `upstream-compat.ts`.
- **Performance budget.** Spec DoD #10: end-to-end event delivery ≤500ms p95. SSE add-latency over a localhost loopback is <5ms; the budget is consumed by upstream emit cadence + DOM render. Task 9 includes a smoke that asserts <500ms wall-clock from `bus.emit()` to `EventSource` `onmessage` on the client.

---

## Task 1 — Event types and ring-buffer EventBus

**Files:** Create `src/lexi-dashboard/events/types.ts`, `src/lexi-dashboard/events/bus.ts`, `tests/lexi/events-bus.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/events-bus.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/lexi-dashboard/events/bus.js';
import type { LexiEvent } from '../../src/lexi-dashboard/events/types.js';

describe('EventBus', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus({ capacity: 4 }); });

  it('emits to subscribers with the locked envelope', () => {
    const seen: LexiEvent[] = [];
    bus.subscribe((ev) => seen.push(ev));
    bus.emit('agent_activity', { agent: 'lexi', text: 'hi' });
    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe('agent_activity');
    expect(typeof seen[0].ts).toBe('number');
    expect(seen[0].payload).toEqual({ agent: 'lexi', text: 'hi' });
  });

  it('keeps only the last N events in recent()', () => {
    for (let i = 0; i < 6; i++) bus.emit('cron_tick', { i });
    const recent = bus.recent();
    expect(recent).toHaveLength(4);
    expect((recent[0].payload as { i: number }).i).toBe(2);
    expect((recent[3].payload as { i: number }).i).toBe(5);
  });

  it('unsubscribe stops further deliveries', () => {
    const seen: LexiEvent[] = [];
    const off = bus.subscribe((ev) => seen.push(ev));
    bus.emit('cron_tick', { i: 1 });
    off();
    bus.emit('cron_tick', { i: 2 });
    expect(seen).toHaveLength(1);
  });

  it('rejects unknown event types', () => {
    // @ts-expect-error intentional
    expect(() => bus.emit('nope', {})).toThrow(/unknown event type/i);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/events-bus.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/events/types.ts`:

```ts
export const EVENT_TYPES = [
  'agent_activity',
  'mcp_call_start',
  'mcp_call_complete',
  'mcp_call_error',
  'cron_tick',
  'webhook_received',
  'workflow_state',
] as const;

export type LexiEventType = (typeof EVENT_TYPES)[number];

export interface LexiEvent {
  type: LexiEventType;
  ts: number;
  payload: unknown;
}

export function isLexiEventType(t: string): t is LexiEventType {
  return (EVENT_TYPES as readonly string[]).includes(t);
}
```

- [ ] **Step 4:** Create `src/lexi-dashboard/events/bus.ts`:

```ts
import { EVENT_TYPES, isLexiEventType, type LexiEvent, type LexiEventType } from './types.js';

export interface EventBusOptions { capacity?: number; }
export type LexiEventHandler = (ev: LexiEvent) => void;

export class EventBus {
  private buffer: LexiEvent[] = [];
  private readonly capacity: number;
  private handlers = new Set<LexiEventHandler>();

  constructor(opts: EventBusOptions = {}) {
    this.capacity = Math.max(1, opts.capacity ?? 200);
  }

  emit(type: LexiEventType, payload: unknown): LexiEvent {
    if (!isLexiEventType(type)) {
      throw new Error(`unknown event type: ${type as string} (allowed: ${EVENT_TYPES.join(', ')})`);
    }
    const ev: LexiEvent = { type, ts: Date.now(), payload };
    this.buffer.push(ev);
    if (this.buffer.length > this.capacity) this.buffer.splice(0, this.buffer.length - this.capacity);
    for (const h of this.handlers) {
      try { h(ev); } catch { /* swallow handler errors so emit() never throws */ }
    }
    return ev;
  }

  subscribe(handler: LexiEventHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  recent(limit?: number): LexiEvent[] {
    const slice = this.buffer.slice();
    return typeof limit === 'number' ? slice.slice(-limit) : slice;
  }

  size(): number { return this.buffer.length; }
}

let singleton: EventBus | null = null;
export function getEventBus(): EventBus {
  if (!singleton) singleton = new EventBus({ capacity: 200 });
  return singleton;
}
```

- [ ] **Step 5:** `npm test -- tests/lexi/events-bus.test.ts` → 4 PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/lexi-dashboard/events/types.ts src/lexi-dashboard/events/bus.ts tests/lexi/events-bus.test.ts
git commit -m "feat(lexi): event bus and locked event envelope"
```

---

## Task 2 — SSE endpoint and polling fallback

**Files:** Create `src/lexi-dashboard/events/sse.ts`. Modify `src/lexi-dashboard/server.ts`. Add `eventsource` dev dep. Create `tests/lexi/events-sse.test.ts`, `tests/lexi/events-recent.test.ts`.

- [ ] **Step 1:** Add to `package.json` `devDependencies`: `"eventsource": "^2.0.2"`, `"@types/eventsource": "^1.1.15"`. Run `npm install`.
- [ ] **Step 2:** Create `tests/lexi/events-recent.test.ts`:

```ts
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
```

- [ ] **Step 3:** Create `tests/lexi/events-sse.test.ts`:

```ts
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
          // emit AFTER the connection is open so we know the subscriber is wired
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
```

- [ ] **Step 4:** `npm test -- tests/lexi/events-sse.test.ts tests/lexi/events-recent.test.ts` → fail.
- [ ] **Step 5:** Create `src/lexi-dashboard/events/sse.ts`:

```ts
import type { Request, Response, Router } from 'express';
import express from 'express';
import { getEventBus } from './bus.js';

export function createEventsRouter(): Router {
  const router = express.Router();
  const bus = getEventBus();

  router.get('/api/events/recent', (req: Request, res: Response) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    res.json({ events: bus.recent(limit) });
  });

  router.get('/api/events/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Initial comment to flush headers / open the stream on the client.
    res.write(`: connected ${Date.now()}\n\n`);

    const heartbeat = setInterval(() => { res.write(`: hb ${Date.now()}\n\n`); }, 15_000);
    const off = bus.subscribe((ev) => { res.write(`data: ${JSON.stringify(ev)}\n\n`); });

    req.on('close', () => { clearInterval(heartbeat); off(); });
  });

  return router;
}
```

- [ ] **Step 6:** Edit `src/lexi-dashboard/server.ts` — at the top add `import { createEventsRouter } from './events/sse.js';` and after the `app.use('/assets', ...)` line add `app.use(createEventsRouter());`.
- [ ] **Step 7:** `npm test -- tests/lexi/events-sse.test.ts tests/lexi/events-recent.test.ts` → 2 PASS.
- [ ] **Step 8:** Commit:

```bash
git add src/lexi-dashboard/events/sse.ts src/lexi-dashboard/server.ts package.json package-lock.json tests/lexi/events-sse.test.ts tests/lexi/events-recent.test.ts
git commit -m "feat(lexi): SSE stream and /api/events/recent fallback"
```

---

## Task 3 — Upstream taps (read-only wrappers)

**Files:** Create `src/lexi-dashboard/events/upstream-taps.ts`. Modify `src/lexi-dashboard/server.ts`. Create `tests/lexi/upstream-taps.test.ts`.

This wires our bus to upstream emitters where they exist *without* editing upstream code. We probe known surfaces (heartbeat, agent runtime activity log, MCP bridge hooks) and attach listeners. If a surface is absent at runtime we log once and skip — never throw.

- [ ] **Step 1:** Create `tests/lexi/upstream-taps.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { wireUpstreamTaps, type UpstreamSources } from '../../src/lexi-dashboard/events/upstream-taps.js';
import { EventBus } from '../../src/lexi-dashboard/events/bus.js';

describe('upstream taps', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus(); });

  it('forwards agent activity events with normalized envelope', () => {
    const agentRuntime = new EventEmitter();
    const sources: UpstreamSources = { agentRuntime };
    wireUpstreamTaps(bus, sources);
    agentRuntime.emit('activity', { agent: 'lexi', text: 'hi' });
    const events = bus.recent();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('agent_activity');
    expect(events[0].payload).toEqual({ agent: 'lexi', text: 'hi' });
  });

  it('forwards MCP call lifecycle (start/complete/error)', () => {
    const mcpBridge = new EventEmitter();
    wireUpstreamTaps(bus, { mcpBridge });
    mcpBridge.emit('call:start', { server: 'neon', tool: 'run_sql' });
    mcpBridge.emit('call:complete', { server: 'neon', tool: 'run_sql', ms: 42 });
    mcpBridge.emit('call:error', { server: 'neon', tool: 'run_sql', error: 'boom' });
    const types = bus.recent().map((e) => e.type);
    expect(types).toEqual(['mcp_call_start', 'mcp_call_complete', 'mcp_call_error']);
  });

  it('does not throw when sources are missing', () => {
    expect(() => wireUpstreamTaps(bus, {})).not.toThrow();
  });

  it('returns a teardown function that detaches all listeners', () => {
    const agentRuntime = new EventEmitter();
    const teardown = wireUpstreamTaps(bus, { agentRuntime });
    teardown();
    agentRuntime.emit('activity', { agent: 'lexi', text: 'x' });
    expect(bus.size()).toBe(0);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/upstream-taps.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/events/upstream-taps.ts`:

```ts
import type { EventEmitter } from 'node:events';
import type { EventBus } from './bus.js';
import type { LexiEventType } from './types.js';

export interface UpstreamSources {
  agentRuntime?: EventEmitter;
  mcpBridge?: EventEmitter;
  scheduler?: EventEmitter;
  webhooks?: EventEmitter;
  workflows?: EventEmitter;
}

interface Wiring { source: EventEmitter; event: string; handler: (...args: unknown[]) => void; }

export function wireUpstreamTaps(bus: EventBus, sources: UpstreamSources): () => void {
  const wirings: Wiring[] = [];

  const attach = (source: EventEmitter | undefined, event: string, type: LexiEventType): void => {
    if (!source) return;
    const handler = (payload: unknown): void => { bus.emit(type, payload ?? {}); };
    source.on(event, handler);
    wirings.push({ source, event, handler });
  };

  attach(sources.agentRuntime, 'activity', 'agent_activity');
  attach(sources.mcpBridge, 'call:start', 'mcp_call_start');
  attach(sources.mcpBridge, 'call:complete', 'mcp_call_complete');
  attach(sources.mcpBridge, 'call:error', 'mcp_call_error');
  attach(sources.scheduler, 'tick', 'cron_tick');
  attach(sources.webhooks, 'received', 'webhook_received');
  attach(sources.workflows, 'state', 'workflow_state');

  return (): void => { for (const w of wirings) w.source.off(w.event, w.handler); };
}

/**
 * Best-effort discovery of upstream emitters at server boot. Returns an empty
 * object if none are reachable — the bus still works (manual emit() and tests).
 */
export async function discoverUpstreamSources(): Promise<UpstreamSources> {
  const out: UpstreamSources = {};
  // Each probe is in its own try so a single missing module does not nuke the others.
  // We import upstream lazily and only read public surfaces.
  try {
    const mod = (await import('../../agent/runtime.js')) as { getRuntimeEmitter?: () => EventEmitter };
    if (typeof mod.getRuntimeEmitter === 'function') out.agentRuntime = mod.getRuntimeEmitter();
  } catch { /* upstream surface absent — that's OK */ }
  try {
    const mod = (await import('../../tools/mcp-bridge.js')) as { getBridgeEmitter?: () => EventEmitter };
    if (typeof mod.getBridgeEmitter === 'function') out.mcpBridge = mod.getBridgeEmitter();
  } catch { /* OK */ }
  return out;
}
```

- [ ] **Step 4:** Edit `src/lexi-dashboard/server.ts` — after `createEventsRouter()` is mounted, call (inside `startLexiServer`):

```ts
import { wireUpstreamTaps, discoverUpstreamSources } from './events/upstream-taps.js';
import { getEventBus } from './events/bus.js';

// inside startLexiServer, after app.use(createEventsRouter()):
const sources = await discoverUpstreamSources();
const detachTaps = wireUpstreamTaps(getEventBus(), sources);
```

Add `detachTaps()` to the `stop` callback.

- [ ] **Step 5:** `npm test -- tests/lexi/upstream-taps.test.ts` → 4 PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/lexi-dashboard/events/upstream-taps.ts src/lexi-dashboard/server.ts tests/lexi/upstream-taps.test.ts
git commit -m "feat(lexi): tap upstream emitters into the lexi event bus"
```

---

## Task 4 — Client-side EventStream singleton with polling fallback

**Files:** Create `src/lexi-dashboard/ui/state/event-stream.ts`, `tests/lexi/event-stream-client.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/event-stream-client.test.ts`:

```ts
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
```

- [ ] **Step 2:** `npm test -- tests/lexi/event-stream-client.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/state/event-stream.ts`:

```ts
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
```

- [ ] **Step 4:** `npm test -- tests/lexi/event-stream-client.test.ts` → 3 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/state/event-stream.ts tests/lexi/event-stream-client.test.ts
git commit -m "feat(lexi): client EventStream with SSE + polling fallback"
```

---

## Task 5 — `lexi-now-playing` component

**Files:** Create `src/lexi-dashboard/ui/components/lexi-now-playing.ts`, `tests/lexi/now-playing.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/now-playing.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { EventStream } from '../../src/lexi-dashboard/ui/state/event-stream.js';

beforeAll(async () => { await import('../../src/lexi-dashboard/ui/components/lexi-now-playing.js'); });

function mount(stream: EventStream): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-now-playing') as HTMLElement & { stream: EventStream };
  el.stream = stream;
  document.body.appendChild(el);
  return el;
}

describe('lexi-now-playing', () => {
  let stream: EventStream;
  beforeEach(() => { stream = new EventStream(); });

  it('shows the idle state when no agent activity has been seen', async () => {
    mount(stream);
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.body.textContent ?? '').toMatch(/idle/i);
  });

  it('renders streaming text from agent_activity events', async () => {
    const el = mount(stream);
    await new Promise((r) => requestAnimationFrame(r));
    (stream as unknown as { dispatch: (e: { type: string; ts: number; payload: unknown }) => void }).dispatch({
      type: 'agent_activity', ts: Date.now(),
      payload: { agent: 'lexi', text: 'thinking about plans', model: 'claude-opus-4-7' },
    });
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.textContent ?? '').toContain('thinking about plans');
    expect(el.textContent ?? '').toContain('lexi');
  });

  it('shows current MCP tool call name when mcp_call_start arrives', async () => {
    const el = mount(stream);
    await new Promise((r) => requestAnimationFrame(r));
    (stream as unknown as { dispatch: (e: { type: string; ts: number; payload: unknown }) => void }).dispatch({
      type: 'mcp_call_start', ts: Date.now(), payload: { agent: 'lexi', server: 'neon', tool: 'run_sql' },
    });
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.textContent ?? '').toContain('neon');
    expect(el.textContent ?? '').toContain('run_sql');
  });

  it('renders an agent tab for every agent that has spoken', async () => {
    const el = mount(stream) as HTMLElement & { stream: EventStream };
    const dispatch = (stream as unknown as { dispatch: (e: { type: string; ts: number; payload: unknown }) => void }).dispatch.bind(stream);
    dispatch({ type: 'agent_activity', ts: 1, payload: { agent: 'lexi', text: 'a' } });
    dispatch({ type: 'agent_activity', ts: 2, payload: { agent: 'jonah', text: 'b' } });
    await new Promise((r) => requestAnimationFrame(r));
    const tabs = el.querySelectorAll('[data-agent-tab]');
    const names = Array.from(tabs).map((t) => t.getAttribute('data-agent-tab'));
    expect(names).toContain('lexi');
    expect(names).toContain('jonah');
  });

  it('exposes stop and pause buttons', async () => {
    const el = mount(stream);
    (stream as unknown as { dispatch: (e: { type: string; ts: number; payload: unknown }) => void }).dispatch({
      type: 'agent_activity', ts: 1, payload: { agent: 'lexi', text: 'a' },
    });
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.querySelector('[data-action="stop"]')).toBeTruthy();
    expect(el.querySelector('[data-action="pause"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/now-playing.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-now-playing.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getEventStream, type EventStream, type LexiEventLike } from '../state/event-stream.js';

interface AgentSnapshot {
  agent: string;
  model?: string;
  text: string;
  startedAt: number;
  costUsd?: number;
  currentTool?: { server: string; tool: string; startedAt: number };
}

@customElement('lexi-now-playing')
export class LexiNowPlaying extends LitElement {
  @property({ attribute: false }) stream: EventStream | null = null;
  @state() private agents = new Map<string, AgentSnapshot>();
  @state() private activeAgent: string | null = null;
  private off: (() => void) | null = null;

  static styles = css`
    :host { display: block; }
    .card { background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px; padding: 20px; min-height: 320px; box-shadow: 0 0 0 6px var(--accent-glow) inset; }
    .tabs { display: flex; gap: 4px; margin-bottom: 12px; }
    .tabs button { background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary); padding: 4px 10px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 12px; }
    .tabs button[aria-selected="true"] { background: var(--bg-elevated); color: var(--text-primary); border-color: var(--border-default); }
    .header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; }
    .agent { font-size: 20px; font-weight: 600; color: var(--accent); }
    .model { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-tertiary); }
    .text { white-space: pre-wrap; line-height: 1.55; color: var(--text-primary); margin: 12px 0; }
    .tool { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-secondary); background: var(--bg-elevated); padding: 8px 10px; border-radius: 6px; }
    .controls { margin-top: 16px; display: flex; gap: 8px; }
    .controls button { background: transparent; border: 1px solid var(--border-default); color: var(--text-primary); padding: 6px 12px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 12px; }
    .controls button:hover { background: var(--bg-elevated); }
    .idle { color: var(--text-tertiary); font-style: italic; padding: 24px 0; text-align: center; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    const s = this.stream ?? getEventStream();
    this.off = s.subscribe((ev) => this.onEvent(ev));
  }

  disconnectedCallback(): void { this.off?.(); this.off = null; super.disconnectedCallback(); }

  private onEvent(ev: LexiEventLike): void {
    const p = ev.payload as Record<string, unknown>;
    const agent = typeof p?.agent === 'string' ? p.agent : null;
    if (!agent) return;
    const snap = this.agents.get(agent) ?? { agent, text: '', startedAt: ev.ts };
    if (ev.type === 'agent_activity') {
      const next = typeof p.text === 'string' ? p.text : '';
      snap.text = snap.text ? `${snap.text}${next.startsWith(snap.text) ? next.slice(snap.text.length) : next}` : next;
      if (typeof p.model === 'string') snap.model = p.model;
      if (typeof p.costUsd === 'number') snap.costUsd = p.costUsd;
    } else if (ev.type === 'mcp_call_start') {
      snap.currentTool = {
        server: typeof p.server === 'string' ? p.server : 'unknown',
        tool: typeof p.tool === 'string' ? p.tool : 'unknown',
        startedAt: ev.ts,
      };
    } else if (ev.type === 'mcp_call_complete' || ev.type === 'mcp_call_error') {
      snap.currentTool = undefined;
    }
    this.agents.set(agent, snap);
    this.activeAgent ??= agent;
    this.requestUpdate();
  }

  private async control(action: 'stop' | 'pause'): Promise<void> {
    if (!this.activeAgent) return;
    try { await fetch(`/api/agents/${encodeURIComponent(this.activeAgent)}/${action}`, { method: 'POST' }); }
    catch { /* surface error in a toast in a later plan */ }
  }

  render() {
    const agents = Array.from(this.agents.values());
    const active = this.activeAgent ? this.agents.get(this.activeAgent) : null;

    if (agents.length === 0) {
      return html`<div class="card"><div class="idle">lexi is idle · awaiting trigger</div></div>`;
    }

    return html`
      <div class="card">
        <div class="tabs">
          ${agents.map((a) => html`
            <button data-agent-tab="${a.agent}"
              aria-selected=${this.activeAgent === a.agent ? 'true' : 'false'}
              @click=${() => { this.activeAgent = a.agent; this.requestUpdate(); }}>${a.agent}</button>
          `)}
        </div>
        ${active ? html`
          <div class="header">
            <span class="agent">${active.agent}</span>
            ${active.model ? html`<span class="model">${active.model}</span>` : null}
            ${typeof active.costUsd === 'number'
              ? html`<span class="model">$${active.costUsd.toFixed(4)}</span>` : null}
          </div>
          <div class="text">${active.text}</div>
          ${active.currentTool ? html`
            <div class="tool">→ ${active.currentTool.server} · ${active.currentTool.tool}</div>
          ` : null}
          <div class="controls">
            <button data-action="pause" @click=${() => this.control('pause')}>Pause</button>
            <button data-action="stop" @click=${() => this.control('stop')}>Stop</button>
          </div>
        ` : null}
      </div>
    `;
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/now-playing.test.ts` → 5 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-now-playing.ts tests/lexi/now-playing.test.ts
git commit -m "feat(lexi): lexi-now-playing component with streaming text and tool calls"
```

---

## Task 6 — `lexi-activity-stream` component

**Files:** Create `src/lexi-dashboard/ui/components/lexi-activity-stream.ts`, `tests/lexi/activity-stream.test.ts`. Modify `src/lexi-dashboard/ui/components/lexi-right-rail.ts`.

- [ ] **Step 1:** Create `tests/lexi/activity-stream.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { EventStream } from '../../src/lexi-dashboard/ui/state/event-stream.js';

beforeAll(async () => { await import('../../src/lexi-dashboard/ui/components/lexi-activity-stream.js'); });

function mount(stream: EventStream): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-activity-stream') as HTMLElement & { stream: EventStream };
  el.stream = stream;
  document.body.appendChild(el);
  return el;
}

function fire(stream: EventStream, ev: { type: string; ts: number; payload: unknown }): void {
  (stream as unknown as { dispatch: (e: { type: string; ts: number; payload: unknown }) => void }).dispatch(ev);
}

describe('lexi-activity-stream', () => {
  let stream: EventStream;
  beforeEach(() => {
    localStorage.clear();
    stream = new EventStream();
  });

  it('renders newest events first', async () => {
    const el = mount(stream);
    fire(stream, { type: 'cron_tick', ts: 1, payload: { name: 'a' } });
    fire(stream, { type: 'cron_tick', ts: 2, payload: { name: 'b' } });
    await new Promise((r) => requestAnimationFrame(r));
    const rows = el.querySelectorAll('[data-event-row]');
    expect(rows[0].textContent).toContain('b');
    expect(rows[1].textContent).toContain('a');
  });

  it('filter chip "errors only" hides non-error events', async () => {
    const el = mount(stream);
    fire(stream, { type: 'cron_tick', ts: 1, payload: { name: 'a' } });
    fire(stream, { type: 'mcp_call_error', ts: 2, payload: { tool: 'x', error: 'boom' } });
    (el.querySelector('[data-filter="errors"]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const rows = el.querySelectorAll('[data-event-row]');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('boom');
  });

  it('expands a row to show full payload on click', async () => {
    const el = mount(stream);
    fire(stream, { type: 'webhook_received', ts: 1, payload: { source: 'github', body: { sha: 'abc' } } });
    await new Promise((r) => requestAnimationFrame(r));
    const row = el.querySelector('[data-event-row]') as HTMLElement;
    row.click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.textContent).toContain('abc');
  });

  it('collapses to a 32px sliver when toggled and persists in localStorage', async () => {
    const el = mount(stream);
    (el.querySelector('[data-action="collapse"]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.getAttribute('data-collapsed')).toBe('true');
    expect(localStorage.getItem('lexi-activity-collapsed')).toBe('1');
  });

  it('restores collapsed state from localStorage on mount', async () => {
    localStorage.setItem('lexi-activity-collapsed', '1');
    const el = mount(stream);
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.getAttribute('data-collapsed')).toBe('true');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/activity-stream.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-activity-stream.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getEventStream, type EventStream, type LexiEventLike } from '../state/event-stream.js';

type Filter = 'all' | 'agents' | 'tools' | 'cron' | 'webhooks' | 'errors';

const FILTER_PREDICATES: Record<Filter, (t: string) => boolean> = {
  all: () => true,
  agents: (t) => t === 'agent_activity',
  tools: (t) => t.startsWith('mcp_call_'),
  cron: (t) => t === 'cron_tick',
  webhooks: (t) => t === 'webhook_received',
  errors: (t) => t.endsWith('_error'),
};

const STORAGE_KEY = 'lexi-activity-collapsed';

@customElement('lexi-activity-stream')
export class LexiActivityStream extends LitElement {
  @property({ attribute: false }) stream: EventStream | null = null;
  @state() private events: LexiEventLike[] = [];
  @state() private filter: Filter = 'all';
  @state() private expanded = new Set<number>();
  @state() private collapsed = false;
  private off: (() => void) | null = null;

  static styles = css`
    :host { display: flex; flex-direction: column; gap: 8px; height: 100%; }
    :host([data-collapsed="true"]) { width: 32px; }
    .header { display: flex; align-items: center; gap: 6px; }
    .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-tertiary); font-weight: 600; flex: 1; }
    button { background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary); padding: 2px 8px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 11px; }
    button[aria-pressed="true"] { background: var(--bg-elevated); color: var(--text-primary); border-color: var(--border-default); }
    .filters { display: flex; flex-wrap: wrap; gap: 4px; }
    .list { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 2px; padding-right: 2px; }
    [data-event-row] { padding: 6px 8px; border-radius: 6px; font-size: 12px; cursor: pointer; color: var(--text-secondary); }
    [data-event-row]:hover { background: var(--bg-elevated); color: var(--text-primary); }
    .ts { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-tertiary); margin-right: 6px; }
    .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
    .payload { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-secondary); white-space: pre-wrap; padding: 6px 0 0; }
    .sliver { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.collapsed = localStorage.getItem(STORAGE_KEY) === '1';
    this.dataset.collapsed = String(this.collapsed);
    const s = this.stream ?? getEventStream();
    for (const ev of s.recent()) this.events.unshift(ev);
    this.off = s.subscribe((ev) => { this.events = [ev, ...this.events].slice(0, 200); });
  }

  disconnectedCallback(): void { this.off?.(); this.off = null; super.disconnectedCallback(); }

  private toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    this.dataset.collapsed = String(this.collapsed);
    localStorage.setItem(STORAGE_KEY, this.collapsed ? '1' : '0');
  }

  private dotColor(type: string): string {
    if (type.endsWith('_error')) return 'var(--danger)';
    if (type === 'cron_tick') return 'var(--purple)';
    if (type === 'webhook_received') return 'var(--warning)';
    if (type === 'agent_activity') return 'var(--accent)';
    return 'var(--success)';
  }

  private summary(ev: LexiEventLike): string {
    const p = ev.payload as Record<string, unknown>;
    if (ev.type === 'agent_activity') return `${p?.agent ?? '?'} · ${(p?.text as string ?? '').slice(0, 60)}`;
    if (ev.type.startsWith('mcp_call_')) return `${p?.server ?? '?'} · ${p?.tool ?? '?'}${ev.type === 'mcp_call_error' ? ' (error: ' + (p?.error ?? '') + ')' : ''}`;
    if (ev.type === 'cron_tick') return `cron · ${p?.name ?? '?'}`;
    if (ev.type === 'webhook_received') return `webhook · ${p?.source ?? '?'}`;
    if (ev.type === 'workflow_state') return `workflow · ${p?.id ?? '?'} → ${p?.state ?? '?'}`;
    return ev.type;
  }

  render() {
    if (this.collapsed) {
      return html`
        <div class="header"><button data-action="collapse" @click=${() => this.toggleCollapsed()}>›</button></div>
        <div class="sliver">
          ${this.events.slice(0, 12).map((ev) =>
            html`<span class="dot" style="background:${this.dotColor(ev.type)}" title="${ev.type}"></span>`)}
        </div>
      `;
    }

    const predicate = FILTER_PREDICATES[this.filter];
    const filtered = this.events.filter((ev) => predicate(ev.type));

    return html`
      <div class="header">
        <span class="label">Activity</span>
        <button data-action="collapse" @click=${() => this.toggleCollapsed()}>‹</button>
      </div>
      <div class="filters">
        ${(['all','agents','tools','cron','webhooks','errors'] as Filter[]).map((f) => html`
          <button data-filter="${f}" aria-pressed=${this.filter === f ? 'true' : 'false'}
            @click=${() => { this.filter = f; }}>${f}</button>
        `)}
      </div>
      <div class="list">
        ${filtered.map((ev) => html`
          <div data-event-row data-event-ts="${ev.ts}"
            @click=${() => {
              const next = new Set(this.expanded);
              next.has(ev.ts) ? next.delete(ev.ts) : next.add(ev.ts);
              this.expanded = next;
            }}>
            <span class="dot" style="background:${this.dotColor(ev.type)}"></span>
            <span class="ts">${new Date(ev.ts).toLocaleTimeString()}</span>
            ${this.summary(ev)}
            ${this.expanded.has(ev.ts)
              ? html`<div class="payload">${JSON.stringify(ev.payload, null, 2)}</div>` : null}
          </div>
        `)}
      </div>
    `;
  }
}
```

- [ ] **Step 4:** Replace `src/lexi-dashboard/ui/components/lexi-right-rail.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import './lexi-activity-stream.js';

@customElement('lexi-right-rail')
export class LexiRightRail extends LitElement {
  protected createRenderRoot() { return this; }
  render() { return html`<lexi-activity-stream></lexi-activity-stream>`; }
}
```

- [ ] **Step 5:** `npm test -- tests/lexi/activity-stream.test.ts` → 5 PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-activity-stream.ts src/lexi-dashboard/ui/components/lexi-right-rail.ts tests/lexi/activity-stream.test.ts
git commit -m "feat(lexi): activity stream with filters, expand, and sliver collapse"
```

---

## Task 7 — `lexi-system-map-strip` (top bar)

**Files:** Create `src/lexi-dashboard/ui/components/lexi-system-map-strip.ts`, `tests/lexi/system-map-strip.test.ts`. Modify `src/lexi-dashboard/ui/components/lexi-top-bar.ts`.

- [ ] **Step 1:** Create `tests/lexi/system-map-strip.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { EventStream } from '../../src/lexi-dashboard/ui/state/event-stream.js';

beforeAll(async () => { await import('../../src/lexi-dashboard/ui/components/lexi-system-map-strip.js'); });

function mount(stream: EventStream): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-system-map-strip') as HTMLElement & { stream: EventStream };
  el.stream = stream;
  document.body.appendChild(el);
  return el;
}

function fire(stream: EventStream, ev: { type: string; ts: number; payload: unknown }): void {
  (stream as unknown as { dispatch: (e: { type: string; ts: number; payload: unknown }) => void }).dispatch(ev);
}

describe('lexi-system-map-strip', () => {
  let stream: EventStream;
  beforeEach(() => { stream = new EventStream(); });

  it('shows pills for every agent and MCP server seen', async () => {
    const el = mount(stream);
    fire(stream, { type: 'agent_activity', ts: 1, payload: { agent: 'lexi' } });
    fire(stream, { type: 'mcp_call_start', ts: 2, payload: { agent: 'lexi', server: 'neon', tool: 'run_sql' } });
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.querySelector('[data-pill="agent:lexi"]')).toBeTruthy();
    expect(el.querySelector('[data-pill="mcp:neon"]')).toBeTruthy();
  });

  it('marks the pill as "active" briefly after a relevant event', async () => {
    const el = mount(stream);
    fire(stream, { type: 'mcp_call_start', ts: Date.now(), payload: { agent: 'lexi', server: 'neon', tool: 'x' } });
    await new Promise((r) => requestAnimationFrame(r));
    const pill = el.querySelector('[data-pill="mcp:neon"]') as HTMLElement;
    expect(pill.getAttribute('data-active')).toBe('true');
  });

  it('dispatches a lexi-filter event when a pill is clicked', async () => {
    const el = mount(stream);
    fire(stream, { type: 'agent_activity', ts: 1, payload: { agent: 'lexi' } });
    await new Promise((r) => requestAnimationFrame(r));
    const seen: CustomEvent[] = [];
    el.addEventListener('lexi-filter', (ev) => seen.push(ev as CustomEvent));
    (el.querySelector('[data-pill="agent:lexi"]') as HTMLElement).click();
    expect(seen).toHaveLength(1);
    expect((seen[0].detail as { kind: string; id: string }).id).toBe('lexi');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/system-map-strip.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-system-map-strip.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getEventStream, type EventStream, type LexiEventLike } from '../state/event-stream.js';

const ACTIVE_MS = 800;

interface Pill { kind: 'agent' | 'mcp'; id: string; activeUntil: number; calls: number; }

@customElement('lexi-system-map-strip')
export class LexiSystemMapStrip extends LitElement {
  @property({ attribute: false }) stream: EventStream | null = null;
  @state() private pills = new Map<string, Pill>();
  private off: (() => void) | null = null;
  private redraw: ReturnType<typeof setInterval> | null = null;

  static styles = css`
    :host { display: flex; align-items: center; gap: 6px; flex: 1; overflow: hidden; }
    .group { display: flex; gap: 4px; align-items: center; }
    .sep { color: var(--text-tertiary); margin: 0 6px; }
    button.pill {
      background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary);
      padding: 2px 10px; border-radius: 999px; font: inherit; font-size: 11px; cursor: pointer;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    button.pill[data-active="true"] { background: var(--accent-glow); color: var(--accent); border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    const s = this.stream ?? getEventStream();
    for (const ev of s.recent()) this.onEvent(ev);
    this.off = s.subscribe((ev) => this.onEvent(ev));
    this.redraw = setInterval(() => this.requestUpdate(), 250);
  }

  disconnectedCallback(): void {
    this.off?.(); this.off = null;
    if (this.redraw) clearInterval(this.redraw);
    super.disconnectedCallback();
  }

  private bump(kind: 'agent' | 'mcp', id: string): void {
    const key = `${kind}:${id}`;
    const existing = this.pills.get(key) ?? { kind, id, activeUntil: 0, calls: 0 };
    existing.activeUntil = Date.now() + ACTIVE_MS;
    existing.calls += 1;
    this.pills.set(key, existing);
    this.requestUpdate();
  }

  private onEvent(ev: LexiEventLike): void {
    const p = ev.payload as Record<string, unknown>;
    if (typeof p?.agent === 'string') this.bump('agent', p.agent);
    if (typeof p?.server === 'string') this.bump('mcp', p.server);
  }

  private filter(pill: Pill): void {
    this.dispatchEvent(new CustomEvent('lexi-filter', {
      detail: { kind: pill.kind, id: pill.id }, bubbles: true, composed: true,
    }));
  }

  render() {
    const now = Date.now();
    const agents = Array.from(this.pills.values()).filter((p) => p.kind === 'agent');
    const mcps = Array.from(this.pills.values()).filter((p) => p.kind === 'mcp');
    const renderPill = (p: Pill) => html`
      <button class="pill" data-pill="${p.kind}:${p.id}"
        data-active=${p.activeUntil > now ? 'true' : 'false'}
        title="${p.id} · ${p.calls} calls"
        @click=${() => this.filter(p)}>${p.id}</button>
    `;
    return html`
      <div class="group">${agents.map(renderPill)}</div>
      ${agents.length && mcps.length ? html`<span class="sep">↔</span>` : null}
      <div class="group">${mcps.map(renderPill)}</div>
    `;
  }
}
```

- [ ] **Step 4:** Edit `src/lexi-dashboard/ui/components/lexi-top-bar.ts` — add `import './lexi-system-map-strip.js';` and replace the `<span style="flex:1"></span>` spacer with `<lexi-system-map-strip></lexi-system-map-strip>`.
- [ ] **Step 5:** `npm test -- tests/lexi/system-map-strip.test.ts` → 3 PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-system-map-strip.ts src/lexi-dashboard/ui/components/lexi-top-bar.ts tests/lexi/system-map-strip.test.ts
git commit -m "feat(lexi): system-map strip pills with pulse + filter dispatch"
```

---

## Task 8 — `lexi-system-map-drawer` with lazy-loaded d3-force

**Files:** Create `src/lexi-dashboard/ui/components/lexi-system-map-drawer.ts`, `tests/lexi/system-map-drawer.test.ts`. Modify `src/lexi-dashboard/ui/components/lexi-bottom-drawer.ts`. Add `d3-force` to `package.json` dependencies.

- [ ] **Step 1:** Edit `package.json` `dependencies`: add `"d3-force": "^3.0.0"` and `"@types/d3-force": "^3.0.10"`. Run `npm install`.
- [ ] **Step 2:** Create `tests/lexi/system-map-drawer.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { EventStream } from '../../src/lexi-dashboard/ui/state/event-stream.js';

beforeAll(async () => { await import('../../src/lexi-dashboard/ui/components/lexi-system-map-drawer.js'); });

function mount(stream: EventStream): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-system-map-drawer') as HTMLElement & { stream: EventStream };
  el.stream = stream;
  document.body.appendChild(el);
  return el;
}

function fire(stream: EventStream, ev: { type: string; ts: number; payload: unknown }): void {
  (stream as unknown as { dispatch: (e: { type: string; ts: number; payload: unknown }) => void }).dispatch(ev);
}

describe('lexi-system-map-drawer', () => {
  let stream: EventStream;
  beforeEach(() => { stream = new EventStream(); });

  it('starts collapsed (height ≤ 32px)', async () => {
    const el = mount(stream);
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.getAttribute('data-state')).toBe('collapsed');
  });

  it('expands when the handle is clicked', async () => {
    const el = mount(stream);
    (el.querySelector('[data-action="toggle"]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.getAttribute('data-state')).toBe('expanded');
  });

  it('records nodes and edges from emitted events', async () => {
    const el = mount(stream) as HTMLElement & { nodeCount(): number; edgeCount(): number };
    fire(stream, { type: 'mcp_call_start', ts: 1, payload: { agent: 'lexi', server: 'neon', tool: 'run_sql' } });
    fire(stream, { type: 'mcp_call_start', ts: 2, payload: { agent: 'lexi', server: 'neon', tool: 'run_sql' } });
    fire(stream, { type: 'mcp_call_start', ts: 3, payload: { agent: 'jonah', server: 'gmail', tool: 'send' } });
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.nodeCount()).toBe(4); // lexi, neon, jonah, gmail
    expect(el.edgeCount()).toBe(2); // lexi→neon (×2), jonah→gmail
  });
});
```

- [ ] **Step 3:** `npm test -- tests/lexi/system-map-drawer.test.ts` → fail.
- [ ] **Step 4:** Create `src/lexi-dashboard/ui/components/lexi-system-map-drawer.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getEventStream, type EventStream, type LexiEventLike } from '../state/event-stream.js';

interface Node { id: string; kind: 'agent' | 'mcp'; calls: number; x?: number; y?: number; }
interface Edge { source: string; target: string; weight: number; }

@customElement('lexi-system-map-drawer')
export class LexiSystemMapDrawer extends LitElement {
  @property({ attribute: false }) stream: EventStream | null = null;
  @state() private expanded = false;
  private nodes = new Map<string, Node>();
  private edges = new Map<string, Edge>();
  private off: (() => void) | null = null;
  private simulation: { stop: () => void } | null = null;

  static styles = css`
    :host { display: block; width: 100%; height: 32px; transition: height 0.25s cubic-bezier(0.16, 1, 0.3, 1); overflow: hidden; }
    :host([data-state="expanded"]) { height: 360px; }
    .handle { display: flex; align-items: center; gap: 8px; padding: 6px 16px; cursor: pointer; font-size: 12px; color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle); background: var(--bg-canvas); }
    .canvas { width: 100%; height: calc(100% - 32px); position: relative; background: var(--bg-canvas); }
    svg { width: 100%; height: 100%; }
    circle.agent { fill: var(--accent); }
    circle.mcp { fill: var(--success); }
    line { stroke: var(--border-default); stroke-opacity: 0.6; }
    text { font-size: 10px; fill: var(--text-secondary); font-family: 'Inter', sans-serif; pointer-events: none; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.dataset.state = 'collapsed';
    const s = this.stream ?? getEventStream();
    for (const ev of s.recent()) this.onEvent(ev);
    this.off = s.subscribe((ev) => this.onEvent(ev));
  }

  disconnectedCallback(): void {
    this.off?.(); this.off = null;
    this.simulation?.stop(); this.simulation = null;
    super.disconnectedCallback();
  }

  /** Test-visible getters */
  nodeCount(): number { return this.nodes.size; }
  edgeCount(): number { return this.edges.size; }

  private onEvent(ev: LexiEventLike): void {
    const p = ev.payload as Record<string, unknown>;
    const agent = typeof p?.agent === 'string' ? p.agent : null;
    const server = typeof p?.server === 'string' ? p.server : null;
    if (agent) {
      const n = this.nodes.get(`agent:${agent}`) ?? { id: `agent:${agent}`, kind: 'agent' as const, calls: 0 };
      n.calls += 1; this.nodes.set(n.id, n);
    }
    if (server) {
      const n = this.nodes.get(`mcp:${server}`) ?? { id: `mcp:${server}`, kind: 'mcp' as const, calls: 0 };
      n.calls += 1; this.nodes.set(n.id, n);
    }
    if (agent && server) {
      const key = `agent:${agent}->mcp:${server}`;
      const e = this.edges.get(key) ?? { source: `agent:${agent}`, target: `mcp:${server}`, weight: 0 };
      e.weight += 1; this.edges.set(key, e);
    }
    this.requestUpdate();
  }

  private async toggle(): Promise<void> {
    this.expanded = !this.expanded;
    this.dataset.state = this.expanded ? 'expanded' : 'collapsed';
    if (this.expanded) await this.runSimulation();
    else { this.simulation?.stop(); this.simulation = null; }
  }

  private async runSimulation(): Promise<void> {
    // Lazy-load d3-force only on first expansion (~30KB chunk)
    const d3 = await import('d3-force');
    const nodes = Array.from(this.nodes.values()).map((n) => ({ ...n }));
    const links = Array.from(this.edges.values()).map((e) => ({ source: e.source, target: e.target }));
    const sim = d3.forceSimulation(nodes as unknown as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links).id((d: unknown) => (d as Node).id).distance(80))
      .force('charge', d3.forceManyBody().strength(-160))
      .force('center', d3.forceCenter(this.clientWidth / 2, 160))
      .on('tick', () => {
        for (const n of nodes) {
          const stored = this.nodes.get(n.id);
          if (stored) { stored.x = n.x; stored.y = n.y; }
        }
        this.requestUpdate();
      });
    this.simulation = { stop: () => sim.stop() };
  }

  render() {
    const nodes = Array.from(this.nodes.values());
    const edges = Array.from(this.edges.values());
    return html`
      <div class="handle" data-action="toggle" @click=${() => void this.toggle()}>
        <span>${this.expanded ? '▼' : '▲'}</span>
        <span>System map · ${nodes.length} nodes · ${edges.length} edges</span>
      </div>
      ${this.expanded ? html`
        <div class="canvas">
          <svg viewBox="0 0 ${this.clientWidth || 800} 320" preserveAspectRatio="xMidYMid meet">
            ${edges.map((e) => {
              const s = this.nodes.get(e.source); const t = this.nodes.get(e.target);
              if (!s?.x || !s?.y || !t?.x || !t?.y) return null;
              return html`<line x1="${s.x}" y1="${s.y}" x2="${t.x}" y2="${t.y}" stroke-width="${Math.min(4, 1 + e.weight / 4)}" />`;
            })}
            ${nodes.map((n) => html`
              <g transform="translate(${n.x ?? 0},${n.y ?? 0})">
                <circle class="${n.kind}" r="${4 + Math.min(16, n.calls)}"></circle>
                <text x="10" y="4">${n.id.split(':')[1]}</text>
              </g>
            `)}
          </svg>
        </div>
      ` : null}
    `;
  }
}
```

- [ ] **Step 5:** Replace `src/lexi-dashboard/ui/components/lexi-bottom-drawer.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import './lexi-system-map-drawer.js';

@customElement('lexi-bottom-drawer')
export class LexiBottomDrawer extends LitElement {
  protected createRenderRoot() { return this; }
  render() { return html`<lexi-system-map-drawer></lexi-system-map-drawer>`; }
}
```

Also update `src/lexi-dashboard/ui/styles/shell.css` — change `grid-template-rows` from `44px 1fr 32px` to `44px 1fr auto` so the drawer can grow when expanded.

- [ ] **Step 6:** `npm test -- tests/lexi/system-map-drawer.test.ts` → 3 PASS.
- [ ] **Step 7:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-system-map-drawer.ts src/lexi-dashboard/ui/components/lexi-bottom-drawer.ts src/lexi-dashboard/ui/styles/shell.css package.json package-lock.json tests/lexi/system-map-drawer.test.ts
git commit -m "feat(lexi): system-map drawer with lazy-loaded d3-force graph"
```

---

## Task 9 — `lexi-home-view` composition + route wiring + p95 latency smoke

**Files:** Create `src/lexi-dashboard/ui/components/lexi-home-view.ts`, `tests/lexi/home-view.test.ts`. Modify `src/lexi-dashboard/ui/components/lexi-app.ts`.

- [ ] **Step 1:** Create `tests/lexi/home-view.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../src/lexi-dashboard/ui/components/lexi-home-view.js');
  await import('../../src/lexi-dashboard/ui/components/lexi-app.js');
});

describe('lexi-home-view', () => {
  it('renders Now Playing in the center', async () => {
    document.body.replaceChildren();
    const home = document.createElement('lexi-home-view');
    document.body.appendChild(home);
    await new Promise((r) => requestAnimationFrame(r));
    expect(home.querySelector('lexi-now-playing')).toBeTruthy();
  });

  it('lexi-app routes home to lexi-home-view by default', async () => {
    document.body.replaceChildren();
    const app = document.createElement('lexi-app');
    document.body.appendChild(app);
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    expect(app.querySelector('lexi-home-view')).toBeTruthy();
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/home-view.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-home-view.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import './lexi-now-playing.js';

@customElement('lexi-home-view')
export class LexiHomeView extends LitElement {
  protected createRenderRoot() { return this; }

  static styles = css``;

  render() {
    return html`
      <section style="display:flex;flex-direction:column;gap:16px">
        <lexi-now-playing></lexi-now-playing>
      </section>
    `;
  }
}
```

- [ ] **Step 4:** Edit `src/lexi-dashboard/ui/components/lexi-app.ts` — replace the `<main>` block. Replace the placeholder `<h1>Welcome to Lexi</h1>` body with a hash-router that mounts `lexi-home-view` for `#/home` (default) and a TODO placeholder for the other 7 sections (later plans):

```ts
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './lexi-top-bar.js';
import './lexi-nav-rail.js';
import './lexi-right-rail.js';
import './lexi-bottom-drawer.js';
import './lexi-home-view.js';

@customElement('lexi-app')
export class LexiApp extends LitElement {
  @state() private route = 'home';
  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    const sync = (): void => {
      const h = window.location.hash.replace(/^#\//, '');
      this.route = h || 'home';
    };
    sync();
    window.addEventListener('hashchange', sync);
  }

  private renderRoute() {
    if (this.route === 'home') return html`<lexi-home-view></lexi-home-view>`;
    return html`
      <h1 style="margin:0 0 8px 0;font-size:28px;font-weight:600">${this.route}</h1>
      <p style="color:var(--text-secondary)">This section is wired in a later plan.</p>
    `;
  }

  render() {
    return html`
      <lexi-top-bar></lexi-top-bar>
      <lexi-nav-rail active="${this.route}"></lexi-nav-rail>
      <main class="lexi-main">${this.renderRoute()}</main>
      <lexi-right-rail></lexi-right-rail>
      <lexi-bottom-drawer></lexi-bottom-drawer>
    `;
  }
}
```

- [ ] **Step 5:** `npm test -- tests/lexi/home-view.test.ts` → 2 PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-home-view.ts src/lexi-dashboard/ui/components/lexi-app.ts tests/lexi/home-view.test.ts
git commit -m "feat(lexi): lexi-home-view composition and hash router"
```

---

## Task 10 — Latency budget smoke + final verification

**Files:** Create `tests/lexi/latency.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/latency.test.ts`:

```ts
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
```

- [ ] **Step 2:** `npm test -- tests/lexi/latency.test.ts` → PASS (p95 should be <50ms on localhost; the 500ms gate is a regression guard).
- [ ] **Step 3:** Run the full Plan 3 suite:

```bash
npm run build && npm test -- tests/lexi/events-bus tests/lexi/events-sse tests/lexi/events-recent tests/lexi/upstream-taps tests/lexi/event-stream-client tests/lexi/now-playing tests/lexi/activity-stream tests/lexi/system-map-strip tests/lexi/system-map-drawer tests/lexi/home-view tests/lexi/latency
```

→ all green.

- [ ] **Step 4:** Smoke the running server:

```bash
LEXI_PORT=3031 node dist/cli/index.js lexi dashboard &
SERVER_PID=$!
sleep 1
curl -s http://localhost:3031/api/events/recent | head -c 200
kill $SERVER_PID
```

Verify `{"events":[...]}` shape.

- [ ] **Step 5:** Open `http://localhost:3031/` in Chrome:
  - Top bar shows agent + MCP pills; pills pulse when an event fires.
  - Center "Now Playing" card: shows "lexi is idle" until events arrive; tabs appear once multiple agents speak.
  - Right rail: events stream newest-first; filter chips work; click a row to expand payload; collapse to sliver persists across reload.
  - Bottom drawer: click the handle → expands to ~360px → force-directed graph appears within ~500ms (lazy import pays its tax once).
- [ ] **Step 6:** `git diff upstream/main..HEAD --name-only | sort` → all paths under `src/lexi-dashboard/`, `tests/lexi/`, `docs/lexi/`, plus the two documented upstream-touched files (`package.json`, `package-lock.json`).
- [ ] **Step 7:** Commit:

```bash
git add tests/lexi/latency.test.ts
git commit -m "test(lexi): SSE end-to-end latency p95 ≤ 500ms regression guard"
```

---

## Definition of done for Plan 3

- [ ] All 10 tasks committed
- [ ] `npm test -- tests/lexi/` all green (existing Plan 1 suites + 11 new Plan 3 suites)
- [ ] `npm run build` succeeds; UI bundle main chunk still <150KB (d3-force lives in its own lazy chunk)
- [ ] `GET /api/events/stream` opens an SSE connection and forwards `bus.emit()` events with `{type, ts, payload}` envelope
- [ ] `GET /api/events/recent?limit=N` returns the last N events as JSON
- [ ] Latency: p95 of `bus.emit` → client `onmessage` ≤ 500ms (Spec DoD #10)
- [ ] `lexi-now-playing` shows current agent activity, current MCP tool call, agent tabs, stop/pause buttons
- [ ] `lexi-activity-stream` reverse-chrono, click-to-expand payloads, 6 filter chips, collapse-to-sliver persists in `localStorage`
- [ ] `lexi-system-map-strip` renders agent and MCP pills, pulses on events, dispatches `lexi-filter` on click
- [ ] `lexi-system-map-drawer` collapsed by default, expands on handle click, force-directed graph via lazy-loaded `d3-force`
- [ ] `lexi-home-view` composes Now Playing + Activity Stream + System Map strip + Drawer; `lexi-app` routes `home` to it by default
- [ ] No edits to upstream files in `src/agent/`, `src/dashboard/`, `src/cli/dashboard.ts`
- [ ] `git diff upstream/main..HEAD --name-only` includes only `src/lexi-dashboard/**`, `tests/lexi/**`, `docs/lexi/**`, `package.json`, `package-lock.json`, `src/cli/index.ts`
- [ ] `git merge-tree upstream/main HEAD | head -5` reports no conflict markers

## Hand-off to Plan 4

Plan 4 (Always-on / launchd) consumes Plan 3 unchanged: when the launchd-managed `com.lexi.dashboard` process boots, the SSE endpoint is already wired and the home view is the default route. Plan 4's `/api/doctor` check will additionally probe `GET /api/events/recent` to confirm the bus is reachable and tap discovery did not throw at boot.
