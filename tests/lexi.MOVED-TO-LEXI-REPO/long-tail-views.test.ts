/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

async function tick(ms = 60): Promise<void> { await new Promise((r) => setTimeout(r, ms)); }

describe('lexi-build-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-build-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/build/usage')      return new Response(JSON.stringify({ usage: { features: 12, mcpCalls: 340 } }));
      if (url === '/api/build/operations') return new Response(JSON.stringify({ operations: [
        { ts: '2026-05-06T10:00:00Z', type: 'build', ms: 1500, ok: true },
        { ts: '2026-05-06T11:00:00Z', type: 'lint',  ms: 200,  ok: true },
      ] }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders usage counters and operations list', async () => {
    document.body.appendChild(document.createElement('lexi-build-view'));
    await tick();
    const view = document.querySelector('lexi-build-view')!;
    expect(view.textContent).toContain('features');
    expect(view.textContent).toContain('340');
    expect(view.textContent).toContain('build');
    expect(view.textContent).toContain('1500 ms');
  });
});

describe('lexi-team-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-team-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/team/status')  return new Response(JSON.stringify({ healthy: true, peers: 2 }));
      if (url === '/api/team')         return new Response(JSON.stringify({ members: [{ slug: 'lexi', role: 'orchestrator' }] }));
      if (url === '/api/team/agents')  return new Response(JSON.stringify({ agents: [{ slug: 'jonah', role: 'engineer' }] }));
      if (url === '/api/team/messages') return new Response(JSON.stringify({ messages: [{ from: 'lexi', to: 'jonah', ts: '2026-05-06T10:00:00Z', text: 'ping' }] }));
      if (url === '/api/team/leaderboard') return new Response(JSON.stringify({ leaderboard: [{ slug: 'lexi', score: 9 }] }));
      if (url === '/api/team/pending-requests') return new Response(JSON.stringify({ pending: [] }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders status, members, and recent messages', async () => {
    document.body.appendChild(document.createElement('lexi-team-view'));
    await tick();
    const view = document.querySelector('lexi-team-view')!;
    expect(view.textContent).toContain('healthy');
    expect(view.textContent).toContain('lexi');
    expect(view.textContent).toContain('jonah');
    expect(view.textContent).toContain('ping');
  });
});

describe('lexi-projects-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-projects-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/projects') return new Response(JSON.stringify({ projects: [{ id: 'p1', name: 'Lexi' }] }));
      if (url.startsWith('/api/projects/p1')) return new Response(JSON.stringify({ id: 'p1', name: 'Lexi', slug: 'lexi-dashboard' }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('lists projects and shows detail on select', async () => {
    document.body.appendChild(document.createElement('lexi-projects-view'));
    await tick();
    const view = document.querySelector('lexi-projects-view') as { select: (id: string) => Promise<void> };
    await view.select('p1');
    await tick(20);
    expect((view as unknown as HTMLElement).textContent).toContain('lexi-dashboard');
  });
});

describe('lexi-plans-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-plans-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/plans')       return new Response(JSON.stringify({ plans: [{ id: 'pl1', title: 'Phase 26' }] }));
      if (url === '/api/plans/today') return new Response(JSON.stringify({ plan: { date: '2026-05-06', items: ['ship Phase 26'] } }));
      if (url === '/api/plans/diff')  return new Response(JSON.stringify({ diff: null }));
      if (url.startsWith('/api/plans/')) return new Response(JSON.stringify({ id: 'pl1', body: 'do the thing' }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders today plan, list, and shows detail on select', async () => {
    document.body.appendChild(document.createElement('lexi-plans-view'));
    await tick();
    const view = document.querySelector('lexi-plans-view') as { select: (id: string) => Promise<void> };
    expect((view as unknown as HTMLElement).textContent).toContain('ship Phase 26');
    expect((view as unknown as HTMLElement).textContent).toContain('Phase 26');
    await view.select('pl1');
    await tick(20);
    expect((view as unknown as HTMLElement).textContent).toContain('do the thing');
  });
});

describe('lexi-claims-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/views/lexi-claims-view.js');
    let claims = [
      { id: 'c1', text: 'Sky is blue', source: 'manual', status: 'pending', createdAt: '2026-05-06T09:00:00Z' },
      { id: 'c2', text: 'Earth orbits sun', status: 'verified', createdAt: '2026-05-06T08:00:00Z' },
    ];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/claims') return new Response(JSON.stringify({ claims }));
      if (url.endsWith('/mark-verified')) {
        claims = claims.map((c) => c.id === 'c1' ? { ...c, status: 'verified' } : c);
        return new Response(JSON.stringify({ ok: true }));
      }
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders claims and mark-verified flips status', async () => {
    document.body.appendChild(document.createElement('lexi-claims-view'));
    await tick();
    const view = document.querySelector('lexi-claims-view') as { act: (id: string, a: 'mark-verified' | 'mark-failed' | 'dismiss') => Promise<void> };
    expect((view as unknown as HTMLElement).textContent).toContain('Sky is blue');
    await view.act('c1', 'mark-verified');
    await tick(40);
    expect((view as unknown as HTMLElement).textContent).toContain('mark-verified → c1');
  });
});
