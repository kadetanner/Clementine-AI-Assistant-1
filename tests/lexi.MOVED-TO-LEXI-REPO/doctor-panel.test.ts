/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../../src/lexi-dashboard/ui/components/lexi-doctor-panel.js');
});

const FAKE_RESPONSE = {
  overall: 'yellow',
  checks: [
    { name: 'process', status: 'green', message: 'pid 1234 · uptime 42s' },
    { name: 'port', status: 'green', message: ':3030 reachable' },
    { name: 'mcp_servers', status: 'yellow', message: '1/3 degraded' },
    { name: 'falkordb_graph', status: 'green', message: 'graph reachable via socket' },
    { name: 'redis_socket', status: 'green', message: '/Users/x/.clementine/falkordb.sock' },
    { name: 'vault_directory', status: 'green', message: '/Users/x/.clementine/vault' },
    { name: 'cron_last_fire', status: 'green', message: '3m since last fire' },
    { name: 'autonomy_ledger', status: 'green', message: '12.4KB · last write 2h ago' },
    { name: 'log_growth', status: 'green', message: 'err log 0.01MB · 4m old' },
  ],
};

function mountPanel(): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-doctor-panel');
  document.body.appendChild(el);
  return el;
}

describe('lexi-doctor-panel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.endsWith('/api/doctor')) {
        return new Response(JSON.stringify(FAKE_RESPONSE), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (typeof url === 'string' && url.endsWith('/api/restart-self') && init?.method === 'POST') {
        return new Response(JSON.stringify({ label: 'com.lexi.dashboard', dryRun: true }), { status: 202 });
      }
      return new Response('not found', { status: 404 });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('registers the custom element', () => {
    expect(customElements.get('lexi-doctor-panel')).toBeDefined();
  });

  it('renders 9 check rows after fetch', async () => {
    mountPanel();
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
    const rows = document.querySelectorAll('lexi-doctor-panel [data-check]');
    expect(rows.length).toBe(9);
  });

  it('renders coloured dots matching status', async () => {
    mountPanel();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
    const greens = document.querySelectorAll('lexi-doctor-panel [data-check][data-status="green"]');
    const yellows = document.querySelectorAll('lexi-doctor-panel [data-check][data-status="yellow"]');
    const reds = document.querySelectorAll('lexi-doctor-panel [data-check][data-status="red"]');
    expect(greens.length).toBe(8);
    expect(yellows.length).toBe(1);
    expect(reds.length).toBe(0);
  });

  it('Run Doctor button triggers a re-fetch', async () => {
    mountPanel();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
    const before = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    const btn = document.querySelector('lexi-doctor-panel [data-action="run"]') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    const after = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    expect(after).toBeGreaterThan(before);
  });

  it('Restart Lexi button POSTs /api/restart-self', async () => {
    mountPanel();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
    const btn = document.querySelector('lexi-doctor-panel [data-action="restart"]') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const restartCall = calls.find((c) => typeof c[0] === 'string' && (c[0] as string).endsWith('/api/restart-self'));
    expect(restartCall).toBeDefined();
    expect((restartCall![1] as RequestInit | undefined)?.method).toBe('POST');
  });
});
