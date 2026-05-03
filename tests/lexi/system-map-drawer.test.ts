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
    await new Promise((r) => requestAnimationFrame(r));
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
