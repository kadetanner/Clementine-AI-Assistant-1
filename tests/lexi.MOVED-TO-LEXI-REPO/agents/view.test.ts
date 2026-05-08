/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const fetchMock = vi.fn();

beforeAll(async () => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await import('../../../src/lexi-dashboard/ui/components/lexi-agents-view.js');
});

beforeEach(() => {
  fetchMock.mockReset();
  document.body.replaceChildren();
});

function jsonRes(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }));
}

describe('lexi-agents-view', () => {
  it('fetches /api/agents on connect and renders the list', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/api/agents')) return jsonRes({ agents: [
        { slug: 'lexi', name: 'lexi', model: 'claude-opus-4-7', tools_enabled: 2, tools_disabled: 1, memory_size_bytes: 1024, last_active_at: null, uptime_ms: 0 },
        { slug: 'jonah', name: 'jonah', model: 'claude-sonnet-4-5', tools_enabled: 0, tools_disabled: 0, memory_size_bytes: 512, last_active_at: null, uptime_ms: 0 },
      ]});
      return jsonRes({});
    });
    const el = document.createElement('lexi-agents-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 30));
    const items = el.querySelectorAll('[data-agent-slug]');
    expect(items.length).toBe(2);
  });

  it('loads detail when an agent is clicked', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/api/agents')) return jsonRes({ agents: [
        { slug: 'lexi', name: 'lexi', model: 'claude-opus-4-7', tools_enabled: 1, tools_disabled: 0, memory_size_bytes: 1024, last_active_at: null, uptime_ms: 0 },
      ]});
      if (url.endsWith('/api/agents/lexi')) return jsonRes({
        slug: 'lexi', name: 'lexi', model: 'claude-opus-4-7',
        tools_enabled: 1, tools_disabled: 0, memory_size_bytes: 1024,
        prompt: 'You are Lexi.', allowedTools: ['vault_read'], disabledTools: [],
        recent_activity: [], last_active_at: null,
      });
      return jsonRes({});
    });
    const el = document.createElement('lexi-agents-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 30));
    (el.querySelector('[data-agent-slug="lexi"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(el.querySelector('[data-detail-slug="lexi"]')).toBeTruthy();
    expect(el.querySelector('lexi-prompt-editor')).toBeTruthy();
  });

  it('restart button asks for confirmation before POSTing', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/api/agents')) return jsonRes({ agents: [
        { slug: 'lexi', name: 'lexi', model: 'm', tools_enabled: 0, tools_disabled: 0, memory_size_bytes: 0, last_active_at: null, uptime_ms: 0 },
      ]});
      if (url.endsWith('/api/agents/lexi')) return jsonRes({
        slug: 'lexi', name: 'lexi', model: 'm', tools_enabled: 0, tools_disabled: 0, memory_size_bytes: 0,
        prompt: '', allowedTools: [], disabledTools: [], recent_activity: [], last_active_at: null,
      });
      if (url.endsWith('/api/agents/lexi/restart')) return jsonRes({ status: 'queued' });
      return jsonRes({});
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const el = document.createElement('lexi-agents-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 30));
    (el.querySelector('[data-agent-slug="lexi"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    (el.querySelector('[data-restart]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(confirmSpy).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/restart'))).toBe(false);
    confirmSpy.mockRestore();
  });
});
