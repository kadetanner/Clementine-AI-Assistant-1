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
