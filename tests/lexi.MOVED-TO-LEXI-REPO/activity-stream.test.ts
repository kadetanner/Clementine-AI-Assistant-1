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
    await new Promise((r) => requestAnimationFrame(r));
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
    await new Promise((r) => requestAnimationFrame(r));
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
