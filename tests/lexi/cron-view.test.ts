/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('lexi-cron-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-cron-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/cron/broken-jobs')) return new Response(JSON.stringify({ broken: [] }));
      if (url === '/api/cron') return new Response(JSON.stringify({ jobs: [
        { name: 'insight-check', schedule: '*/30 * * * *', lastRun: '2026-05-02T09:00:00Z', nextRun: '2026-05-02T09:30:00Z', lastStatus: 'success', successCount: 100, failCount: 2 },
        { name: 'vault-rollup', schedule: '0 6 * * *', lastRun: '2026-05-02T06:00:00Z', nextRun: '2026-05-03T06:00:00Z', lastStatus: 'failed', successCount: 30, failCount: 1 },
      ] }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('registers as a custom element', () => {
    expect(customElements.get('lexi-cron-view')).toBeDefined();
  });

  it('lists jobs with last_run, next_run, status, counts', async () => {
    document.body.appendChild(document.createElement('lexi-cron-view'));
    await new Promise((r) => setTimeout(r, 20));
    const rows = document.querySelectorAll('lexi-cron-view [data-job]');
    expect(rows.length).toBe(2);
    const text = document.querySelector('lexi-cron-view')!.textContent ?? '';
    expect(text).toContain('insight-check');
    expect(text).toContain('vault-rollup');
    expect(text).toContain('100');
    expect(text).toContain('failed');
  });

  it('renders a Run Now button per job', async () => {
    document.body.appendChild(document.createElement('lexi-cron-view'));
    await new Promise((r) => setTimeout(r, 20));
    const buttons = document.querySelectorAll('lexi-cron-view [data-action="run-now"]');
    expect(buttons.length).toBe(2);
  });
});

describe('lexi-cron-view broken jobs', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-cron-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/cron') return new Response(JSON.stringify({ jobs: [] }));
      if (url === '/api/cron/broken-jobs') return new Response(JSON.stringify({
        broken: [
          { name: 'insight-check', reason: 'failing 7 runs', lastError: 'timeout', workflowId: 'wf-42' },
          { name: 'orphan-task', reason: 'unknown', lastError: 'AttributeError' },
        ],
      }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('surfaces broken jobs in a banner', async () => {
    document.body.appendChild(document.createElement('lexi-cron-view'));
    await new Promise((r) => setTimeout(r, 20));
    const text = document.querySelector('lexi-cron-view')!.textContent ?? '';
    expect(text).toContain('2 broken jobs');
    expect(text).toContain('insight-check');
    expect(text).toContain('orphan-task');
  });

  it('Investigate on a workflow-backed job sets workflow recovery hash', async () => {
    document.body.appendChild(document.createElement('lexi-cron-view'));
    await new Promise((r) => setTimeout(r, 20));
    const before = window.location.hash;
    const buttons = document.querySelectorAll('lexi-cron-view [data-action="investigate"]');
    (buttons[0] as HTMLElement).click();
    expect(window.location.hash).toContain('/workflows/wf-42/recovery');
    window.location.hash = before;
  });

  it('Investigate on a non-workflow job shows raw error inline', async () => {
    document.body.appendChild(document.createElement('lexi-cron-view'));
    await new Promise((r) => setTimeout(r, 20));
    const buttons = document.querySelectorAll('lexi-cron-view [data-action="investigate"]');
    (buttons[1] as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.querySelector('lexi-cron-view')!.textContent).toContain('AttributeError');
  });
});

describe('lexi-cron-view run-now', () => {
  let posted: string[] = [];
  beforeEach(async () => {
    posted = [];
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-cron-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && url.startsWith('/api/cron/run/')) {
        posted.push(url);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url === '/api/cron/broken-jobs') return new Response(JSON.stringify({ broken: [] }));
      if (url === '/api/cron') return new Response(JSON.stringify({ jobs: [{ name: 'foo', schedule: '* * * * *', lastStatus: 'success' }] }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('POSTs to /api/cron/run/:job and shows confirmation', async () => {
    document.body.appendChild(document.createElement('lexi-cron-view'));
    await new Promise((r) => setTimeout(r, 20));
    (document.querySelector('lexi-cron-view [data-action="run-now"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(posted).toContain('/api/cron/run/foo');
    expect(document.querySelector('lexi-cron-view')!.textContent).toContain('triggered');
  });
});
