/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

async function tick(ms = 50): Promise<void> { await new Promise((r) => setTimeout(r, ms)); }

describe('lexi-routines-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-routines-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/routines') return new Response(JSON.stringify({
        routines: [
          { id: 'morning', name: 'Morning brief', schedule: '0 7 * * *', enabled: true },
          { id: 'nightly', name: 'Nightly tidy',  schedule: '0 22 * * *', enabled: false },
        ],
      }));
      if (url.includes('/toggle')) return new Response(JSON.stringify({ ok: true, enabled: true }));
      if (url.endsWith('/dry-run')) return new Response(JSON.stringify({ error: 'requires daemon' }), { status: 501 });
      if (url.endsWith('/runs')) return new Response(JSON.stringify({ runs: [{ file: 'r1.json', mtime: '2026-05-06T10:00:00Z', sizeBytes: 64 }] }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders the list with status dots and toggles', async () => {
    document.body.appendChild(document.createElement('lexi-routines-view'));
    await tick();
    const view = document.querySelector('lexi-routines-view')!;
    expect(view.textContent).toContain('Morning brief');
    expect(view.textContent).toContain('Nightly tidy');
    expect(view.querySelectorAll('lx-status-dot').length).toBeGreaterThanOrEqual(2);
    expect(view.querySelectorAll('lx-toggle').length).toBe(2);
  });

  it('clicking dry-run surfaces the daemon-side 501 in the flash row', async () => {
    document.body.appendChild(document.createElement('lexi-routines-view'));
    await tick();
    const view = document.querySelector('lexi-routines-view') as { dryRun: (id: string) => Promise<void> };
    await view.dryRun('morning');
    await tick(20);
    expect((view as unknown as HTMLElement).textContent).toMatch(/requires daemon|501/);
  });

  it('selecting a routine fetches its run history', async () => {
    document.body.appendChild(document.createElement('lexi-routines-view'));
    await tick();
    const view = document.querySelector('lexi-routines-view') as { select: (id: string) => Promise<void> };
    await view.select('morning');
    await tick(20);
    expect((view as unknown as HTMLElement).textContent).toContain('r1.json');
  });
});

describe('lexi-skills-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-skills-view.js');
    let savedContent = '# orig\n';
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/skills' && (!init || init.method === 'GET' || !init.method)) {
        return new Response(JSON.stringify({
          skills: [
            { name: 'note-taking', file: 'note-taking.md', mtime: '2026-05-06T10:00:00Z' },
          ],
        }));
      }
      if (url.match(/^\/api\/skills\/[^/]+$/) && (!init || init.method === 'GET' || !init.method)) {
        return new Response(JSON.stringify({ name: 'note-taking', content: savedContent }));
      }
      if (url.match(/^\/api\/skills\/[^/]+$/) && init?.method === 'PUT') {
        const body = init.body ? JSON.parse(String(init.body)) : { content: '' };
        savedContent = body.content;
        return new Response(JSON.stringify({ ok: true }));
      }
      if (url === '/api/skills' && init?.method === 'POST') {
        return new Response(JSON.stringify({ ok: true, name: 'fresh' }));
      }
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('lists skills, lets you load + edit + save with dirty-tracking', async () => {
    document.body.appendChild(document.createElement('lexi-skills-view'));
    await tick();
    const view = document.querySelector('lexi-skills-view') as { select: (n: string) => Promise<void>; save: () => Promise<void>; content: string; dirty: boolean };
    await view.select('note-taking');
    await tick(20);
    expect(view.content).toBe('# orig\n');
    expect(view.dirty).toBe(false);
    view.content = '# updated\n'; view.dirty = true;
    await view.save();
    await tick(20);
    expect((view as unknown as HTMLElement).textContent).toContain('Saved note-taking');
  });
});

describe('lexi-approvals-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-approvals-view.js');
    let items = [
      { id: 'a1', agent: 'lexi', action: 'send_email', reason: 'cold outreach', createdAt: '2026-05-06T09:00:00Z' },
      { id: 'a2', agent: 'jonah', action: 'commit_to_pr', decision: 'approved', decidedAt: '2026-05-06T08:00:00Z' },
    ];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/approvals') return new Response(JSON.stringify({ approvals: items }));
      if (url.includes('/decision') && init?.method === 'POST') {
        const body = init.body ? JSON.parse(String(init.body)) : {};
        items = items.map((x) => x.id === 'a1' ? { ...x, decision: body.decision, decidedAt: '2026-05-06T10:00:00Z' } : x);
        return new Response(JSON.stringify({ ok: true }));
      }
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('groups items into pending and decided buckets', async () => {
    document.body.appendChild(document.createElement('lexi-approvals-view'));
    await tick();
    const view = document.querySelector('lexi-approvals-view')!;
    expect(view.textContent).toContain('Pending (1)');
    expect(view.textContent).toContain('Decided (1)');
    expect(view.textContent).toContain('send_email');
    expect(view.textContent).toContain('commit_to_pr');
  });

  it('approving moves the item from pending to decided', async () => {
    document.body.appendChild(document.createElement('lexi-approvals-view'));
    await tick();
    const view = document.querySelector('lexi-approvals-view') as { decide: (id: string, d: 'approved' | 'denied') => Promise<void> };
    await view.decide('a1', 'approved');
    await tick(30);
    expect((view as unknown as HTMLElement).textContent).toContain('Pending (0)');
    expect((view as unknown as HTMLElement).textContent).toContain('Decided (2)');
  });
});
