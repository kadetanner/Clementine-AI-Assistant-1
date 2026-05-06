/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('lexi-memory-view skeleton', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-memory-view.js');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  function mount(): HTMLElement {
    const el = document.createElement('lexi-memory-view');
    document.body.appendChild(el);
    return el;
  }

  it('registers as a custom element', () => {
    expect(customElements.get('lexi-memory-view')).toBeDefined();
  });

  it('renders four tab buttons in spec order', async () => {
    mount();
    await new Promise((r) => requestAnimationFrame(r));
    const tabs = document.querySelectorAll('lexi-memory-view [data-tab]');
    const ids = Array.from(tabs).map((t) => t.getAttribute('data-tab'));
    expect(ids).toEqual(['stats', 'graph', 'recall', 'integrity']);
  });

  it('clicking a tab updates the active panel', async () => {
    mount();
    await new Promise((r) => requestAnimationFrame(r));
    (document.querySelector('lexi-memory-view [data-tab="recall"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.querySelector('lexi-memory-view [data-panel="recall"]')).toBeTruthy();
  });
});

describe('lexi-memory-view data fetching', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-memory-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/memory') return new Response(JSON.stringify({ chunks: 1234, embeddings: 1100, pinned: 8, superseded: 12 }));
      if (url === '/api/memory/health') return new Response(JSON.stringify({ status: 'ok' }));
      if (url === '/api/memory/graph-stats') return new Response(JSON.stringify({ nodes: 50, edges: 80, entities: 30 }));
      if (url.startsWith('/api/recall-traces')) return new Response(JSON.stringify({ traces: [{ id: 'r1', ts: Date.now(), query: 'who is kade', hits: 4 }] }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders stats counters from /api/memory', async () => {
    document.body.appendChild(document.createElement('lexi-memory-view'));
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('lexi-memory-view')!.textContent).toContain('1234');
  });

  it('shows recall traces and expands on click', async () => {
    document.body.appendChild(document.createElement('lexi-memory-view'));
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('lexi-memory-view [data-tab="recall"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const row = document.querySelector('lexi-memory-view [data-panel="recall"] > div')!;
    (row.firstElementChild as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.querySelector('lexi-memory-view [data-panel="recall"] pre')).toBeTruthy();
  });

  it('graph tab renders three bars from /api/memory/graph-stats', async () => {
    document.body.appendChild(document.createElement('lexi-memory-view'));
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('lexi-memory-view [data-tab="graph"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const text = document.querySelector('lexi-memory-view [data-panel="graph"]')!.textContent ?? '';
    expect(text).toContain('Nodes');
    expect(text).toContain('Edges');
    expect(text).toContain('Entities');
  });
});

describe('lexi-memory-view integrity action', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-memory-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/memory/health/action' && init?.method === 'POST') {
        return new Response(JSON.stringify({
          results: [
            { name: 'orphan-chunks', ok: true },
            { name: 'embedding-coverage', ok: false, detail: '12 missing' },
          ],
        }));
      }
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('POSTs to /api/memory/health/action and renders results', async () => {
    document.body.appendChild(document.createElement('lexi-memory-view'));
    await new Promise((r) => setTimeout(r, 20));
    (document.querySelector('lexi-memory-view [data-tab="integrity"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    (document.querySelector('lexi-memory-view [data-panel="integrity"] button') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const text = document.querySelector('lexi-memory-view [data-panel="integrity"]')!.textContent ?? '';
    expect(text).toContain('orphan-chunks');
    expect(text).toContain('embedding-coverage');
    expect(text).toContain('12 missing');
  });
});
