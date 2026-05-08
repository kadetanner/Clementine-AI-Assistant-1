/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

async function tick(ms = 50): Promise<void> { await new Promise((r) => setTimeout(r, ms)); }

describe('lexi-brain-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-brain-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/brain/sources') return new Response(JSON.stringify({
        sources: [
          { slug: 'arxiv',  mtime: '2026-05-01T00:00:00.000Z', isDir: true },
          { slug: 'rss',    mtime: '2026-05-02T00:00:00.000Z', isDir: false },
        ],
      }));
      if (url === '/api/brain/feeds')      return new Response(JSON.stringify({ feeds: [{ name: 'company-blog' }] }));
      if (url === '/api/brain/connectors') return new Response(JSON.stringify({
        connectors: [
          { id: 'web',    name: 'Web Search', requires: 'WEB_SEARCH_API_KEY', enabled: false },
          { id: 'github', name: 'GitHub',     requires: 'GITHUB_TOKEN',       enabled: true },
        ],
      }));
      if (url.startsWith('/api/brain/runs')) return new Response(JSON.stringify({
        runs: [{ id: 'run-1', mtime: '2026-05-06T10:00:00.000Z' }],
      }));
      if (url.startsWith('/api/brain/library/search')) return new Response(JSON.stringify({
        q: 'foo', results: [{ id: 'a1', title: 'Found' }], note: 'cross-surface',
      }));
      if (url.endsWith('/run')) return new Response(JSON.stringify({ error: 'requires daemon' }), { status: 501 });
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('registers and renders the five tab pills', async () => {
    expect(customElements.get('lexi-brain-view')).toBeDefined();
    document.body.appendChild(document.createElement('lexi-brain-view'));
    await tick();
    const view = document.querySelector('lexi-brain-view')!;
    const pills = view.querySelectorAll('.lx-tab-pill');
    expect(pills.length).toBe(5);
    const labels = Array.from(pills).map((p) => p.textContent?.trim().split(' ')[0]).join(',');
    expect(labels).toContain('Sources');
    expect(labels).toContain('Connectors');
    expect(labels).toContain('Library');
  });

  it('renders sources by default with mtime + Run buttons', async () => {
    document.body.appendChild(document.createElement('lexi-brain-view'));
    await tick();
    const view = document.querySelector('lexi-brain-view')!;
    expect(view.textContent).toContain('arxiv');
    expect(view.textContent).toContain('rss');
    expect(view.querySelectorAll('lx-button').length).toBeGreaterThan(0);
  });

  it('switches to connectors and shows enabled-status dots', async () => {
    document.body.appendChild(document.createElement('lexi-brain-view'));
    await tick();
    const view = document.querySelector('lexi-brain-view')!;
    const pills = Array.from(view.querySelectorAll('.lx-tab-pill')) as HTMLElement[];
    pills.find((p) => p.textContent?.includes('Connectors'))!.click();
    await tick(20);
    expect(view.textContent).toContain('Web Search');
    expect(view.textContent).toContain('WEB_SEARCH_API_KEY');
    expect(view.querySelectorAll('lx-status-dot').length).toBeGreaterThan(0);
  });

  it('library search hits /api/brain/library/search and surfaces note', async () => {
    document.body.appendChild(document.createElement('lexi-brain-view'));
    await tick();
    const view = document.querySelector('lexi-brain-view') as { libQ: string; runLibrarySearch: () => Promise<void>; tab: string };
    view.tab = 'library';
    view.libQ = 'foo';
    await view.runLibrarySearch();
    await tick(20);
    expect((view as unknown as HTMLElement).textContent).toContain('Found');
    expect((view as unknown as HTMLElement).textContent).toContain('cross-surface');
  });

  it('Run button surfaces the daemon-side 501 honestly via flash', async () => {
    document.body.appendChild(document.createElement('lexi-brain-view'));
    await tick();
    // Sources tab is default — find the per-source "Run" button (skip the
    // header "Refresh" button and only match exactly "Run").
    const buttons = Array.from(document.querySelectorAll('lexi-brain-view lx-button')) as HTMLElement[];
    const runBtn = buttons.find((b) => (b.textContent ?? '').trim() === 'Run');
    expect(runBtn, 'a per-source Run button should be rendered').toBeTruthy();
    runBtn!.click();
    await tick(60);
    const view = document.querySelector('lexi-brain-view')!;
    expect(view.textContent).toMatch(/requires daemon|Run requested|501/i);
  });
});
