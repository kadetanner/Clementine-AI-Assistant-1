/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/connections/lexi-connections-view.js');
});

const fixture = {
  connections: [
    { id: 'mcp:neon', kind: 'mcp', name: 'neon', status: 'connected', tool_count: 5, last_check_at: '2026-05-02T12:00:00Z' },
    { id: 'composio:gmail', kind: 'composio', name: 'gmail', status: 'degraded', tool_count: 0, last_check_at: null },
    { id: 'oauth:salesforce', kind: 'oauth', name: 'Salesforce', status: 'disconnected', tool_count: 0, last_check_at: null },
  ],
};

function mockFetchOk(body: unknown) {
  globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => body } as unknown as Response)) as typeof fetch;
}

describe('lexi-connections-view', () => {
  it('fetches /api/connections on connect and renders one row per connection', async () => {
    mockFetchOk(fixture);
    document.body.replaceChildren();
    const el = document.createElement('lexi-connections-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 20));
    await new Promise((r) => requestAnimationFrame(r));
    const rows = el.querySelectorAll('[data-connection-id]');
    expect(rows.length).toBe(3);
  });

  it('filters by kind when a kind filter is active', async () => {
    mockFetchOk(fixture);
    document.body.replaceChildren();
    const el = document.createElement('lexi-connections-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 20));
    (el.querySelector('[data-filter-kind="mcp"]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const rows = el.querySelectorAll('[data-connection-id]');
    expect(rows.length).toBe(1);
    expect(rows[0].getAttribute('data-connection-id')).toBe('mcp:neon');
  });

  it('filters by status', async () => {
    mockFetchOk(fixture);
    document.body.replaceChildren();
    const el = document.createElement('lexi-connections-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 20));
    (el.querySelector('[data-filter-status="disconnected"]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const rows = el.querySelectorAll('[data-connection-id]');
    expect(rows.length).toBe(1);
    expect(rows[0].getAttribute('data-connection-id')).toBe('oauth:salesforce');
  });

  it('clicking a row opens the detail panel for that connection', async () => {
    mockFetchOk(fixture);
    document.body.replaceChildren();
    const el = document.createElement('lexi-connections-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 20));
    (el.querySelector('[data-connection-id="mcp:neon"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const detail = el.querySelector('[data-detail-id]');
    expect(detail?.getAttribute('data-detail-id')).toBe('mcp:neon');
  });

  it('bulk probe button issues one POST per connection', async () => {
    let probes = 0;
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'POST' && u.includes('/probe')) { probes += 1; return { ok: true, status: 200, json: async () => ({ status: 'connected' }) } as unknown as Response; }
      return { ok: true, status: 200, json: async () => fixture } as unknown as Response;
    }) as typeof fetch;
    document.body.replaceChildren();
    const el = document.createElement('lexi-connections-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 20));
    (el.querySelector('[data-action="probe-all"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(probes).toBe(3);
  });
});
