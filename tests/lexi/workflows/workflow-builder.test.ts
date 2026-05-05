/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

beforeAll(async () => {
  // Stub Drawflow before component loads — jsdom has no canvas; we only assert wiring.
  (globalThis as unknown as { Drawflow: unknown }).Drawflow = class {
    container: HTMLElement;
    constructor(c: HTMLElement) { this.container = c; }
    start() { /* noop */ }
    import(_data: unknown) { /* noop */ }
    export() { return { drawflow: { Home: { data: {} } } }; }
    on(_e: string, _cb: (...args: unknown[]) => void) { /* noop */ }
  };
  await import('../../../src/lexi-dashboard/ui/components/workflows/lexi-workflow-builder.js');
});

function mount(workflowId: string) {
  document.body.replaceChildren();
  const el = document.createElement('lexi-workflow-builder');
  el.setAttribute('workflow-id', workflowId);
  document.body.appendChild(el);
  return el;
}

describe('lexi-workflow-builder', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/builder/workflows/wf-a' && (!init || init.method === 'GET' || !init.method)) {
        return new Response(JSON.stringify({ id: 'wf-a', name: 'Onboarding', drawflow: { drawflow: { Home: { data: {} } } } }), { status: 200 });
      }
      if (url.endsWith('/save-from-drawflow')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.endsWith('/validate')) {
        return new Response(JSON.stringify({ ok: true, errors: [] }), { status: 200 });
      }
      if (url.endsWith('/test')) {
        return new Response(JSON.stringify({ runId: 'run-1' }), { status: 200 });
      }
      if (url.endsWith('/dry-run')) {
        return new Response(JSON.stringify({ runId: 'dry-1' }), { status: 200 });
      }
      return new Response('nope', { status: 404 });
    }) as unknown as typeof fetch;
  });

  it('mounts a Drawflow canvas div', async () => {
    mount('wf-a');
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('[data-drawflow-canvas]')).not.toBeNull();
  });

  it('loads workflow JSON on mount', async () => {
    mount('wf-a');
    await new Promise((r) => setTimeout(r, 30));
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls).toContain('/api/builder/workflows/wf-a');
  });

  it('renders Save / Validate / Test / Dry-run buttons', async () => {
    mount('wf-a');
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('[data-action="save"]')).not.toBeNull();
    expect(document.querySelector('[data-action="validate"]')).not.toBeNull();
    expect(document.querySelector('[data-action="test"]')).not.toBeNull();
    expect(document.querySelector('[data-action="dry-run"]')).not.toBeNull();
  });

  it('Save button POSTs to save-from-drawflow', async () => {
    mount('wf-a');
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('[data-action="save"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((u: string) => u.endsWith('/save-from-drawflow'))).toBe(true);
  });
});
