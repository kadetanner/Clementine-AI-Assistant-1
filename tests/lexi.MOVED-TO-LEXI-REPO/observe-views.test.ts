/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

async function tick(ms = 30): Promise<void> { await new Promise((r) => setTimeout(r, ms)); }

describe('lexi-logs-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-logs-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/logs')) return new Response(JSON.stringify({
        lines: ['2026-05-06 INFO server up', '2026-05-06 WARN slow query 1200ms', '2026-05-06 ERROR fetch failed'],
      }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('registers as a custom element', () => {
    expect(customElements.get('lexi-logs-view')).toBeDefined();
  });

  it('fetches /api/logs and renders lines into the log pane', async () => {
    document.body.appendChild(document.createElement('lexi-logs-view'));
    await tick(60);
    const view = document.querySelector('lexi-logs-view')!;
    expect(view.textContent).toContain('server up');
    expect(view.textContent).toContain('slow query');
    expect(view.querySelector('.lx-log-pane')).toBeTruthy();
  });

  it('renders an empty-state when /api/logs reports no log file', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ lines: [], note: 'No log file yet' }))));
    document.body.appendChild(document.createElement('lexi-logs-view'));
    await tick(60);
    const view = document.querySelector('lexi-logs-view')!;
    expect(view.textContent).toContain('No log file yet');
  });

  it('classifies lines: ERROR/WARN get level classes', async () => {
    document.body.appendChild(document.createElement('lexi-logs-view'));
    await tick(60);
    const view = document.querySelector('lexi-logs-view')!;
    expect(view.querySelector('.lx-log-line--error')).toBeTruthy();
    expect(view.querySelector('.lx-log-line--warn')).toBeTruthy();
  });
});

describe('lexi-advisor-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-advisor-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/advisor/status')          return new Response(JSON.stringify({ active: true }));
      if (url === '/api/advisor/decisions')       return new Response(JSON.stringify({ decisions: [{ id: 'd1', verdict: 'allow' }] }));
      if (url === '/api/advisor/effectiveness')   return new Response(JSON.stringify({ effectiveness: { allowRate: 0.8 } }));
      if (url === '/api/advisor/events')          return new Response(JSON.stringify({ events: [{ ts: 1, msg: 'tick' }] }));
      if (url === '/api/advisor/reflection-trends') return new Response(JSON.stringify({ trends: [] }));
      if (url === '/api/advisor/analytics')       return new Response(JSON.stringify({ analytics: { runs: 10 } }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders status, the five tab pills, and a default decisions pane', async () => {
    document.body.appendChild(document.createElement('lexi-advisor-view'));
    await tick(60);
    const view = document.querySelector('lexi-advisor-view')!;
    expect(view.textContent).toContain('active');
    const pills = view.querySelectorAll('.lx-tab-pill');
    expect(pills.length).toBe(5);
    expect(view.textContent).toContain('"verdict": "allow"');
  });

  it('switches to effectiveness tab when clicked', async () => {
    document.body.appendChild(document.createElement('lexi-advisor-view'));
    await tick(60);
    const view = document.querySelector('lexi-advisor-view')!;
    const pills = Array.from(view.querySelectorAll('.lx-tab-pill')) as HTMLElement[];
    const eff = pills.find((p) => p.textContent?.includes('Effectiveness'))!;
    eff.click();
    await tick(30);
    expect(view.textContent).toContain('allowRate');
  });
});

describe('lexi-budget-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-budget-view.js');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      budgets: [], mtdSpendCents: 0, freeOnly: true,
    }))));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('surfaces the free-only invariant prominently', async () => {
    document.body.appendChild(document.createElement('lexi-budget-view'));
    await tick(60);
    const view = document.querySelector('lexi-budget-view')!;
    expect(view.textContent).toContain('Free only');
    expect(view.textContent).toContain('$0.00');
  });

  it('reflects paid mode if the daemon flips freeOnly off', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      budgets: [{ scope: 'global', limitCents: 5000 }], mtdSpendCents: 1234, freeOnly: false,
    }))));
    document.body.appendChild(document.createElement('lexi-budget-view'));
    await tick(60);
    const view = document.querySelector('lexi-budget-view')!;
    expect(view.textContent).toContain('Paid enabled');
    expect(view.textContent).toContain('$12.34');
  });
});

describe('lexi-heartbeat-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-heartbeat-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/heartbeat')          return new Response(JSON.stringify({ enabled: true, intervalMin: 5 }));
      if (url === '/api/heartbeat/control')  return new Response(JSON.stringify({ paused: false }));
      if (url === '/api/agent-heartbeats')   return new Response(JSON.stringify({
        heartbeats: [
          { slug: 'lexi',  present: true,  ageMin: 3,  status: 'green' },
          { slug: 'jonah', present: true,  ageMin: 90, status: 'amber' },
          { slug: 'ghost', present: false, ageMin: null, status: 'absent' },
        ],
      }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders global, control, and per-agent panes', async () => {
    document.body.appendChild(document.createElement('lexi-heartbeat-view'));
    await tick(60);
    const view = document.querySelector('lexi-heartbeat-view')!;
    expect(view.textContent).toContain('intervalMin');
    expect(view.textContent).toContain('paused');
    expect(view.textContent).toContain('lexi');
    expect(view.textContent).toContain('jonah');
    expect(view.textContent).toContain('absent');
  });
});
