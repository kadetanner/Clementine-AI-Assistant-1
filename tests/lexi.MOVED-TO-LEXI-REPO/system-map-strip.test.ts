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
