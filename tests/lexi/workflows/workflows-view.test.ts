/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/workflows/lexi-workflows-view.js');
});

function mount() {
  document.body.replaceChildren();
  const el = document.createElement('lexi-workflows-view');
  document.body.appendChild(el);
  return el;
}

describe('lexi-workflows-view', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/builder/workflows')) {
        return new Response(JSON.stringify({ workflows: [
          { id: 'wf-a', name: 'Onboarding', status: 'idle' },
          { id: 'wf-b', name: 'Daily Brief', status: 'running' },
        ]}), { status: 200 });
      }
      if (url.endsWith('/api/workflows/stuck-steps')) {
        return new Response(JSON.stringify([
          { workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing', detectedAt: 1, lastError: 'context refill', thrashingEvents: 3 },
        ]), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;
  });

  it('lists workflows from /api/builder/workflows', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 30));
    const items = document.querySelectorAll('[data-workflow-id]');
    const ids = Array.from(items).map((i) => i.getAttribute('data-workflow-id'));
    expect(ids).toContain('wf-a');
    expect(ids).toContain('wf-b');
  });

  it('renders a status dot per workflow', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 30));
    const dots = document.querySelectorAll('[data-status-dot]');
    const statuses = Array.from(dots).map((d) => d.getAttribute('data-status-dot'));
    expect(statuses).toContain('idle');
    expect(statuses).toContain('running');
  });

  it('shows the stuck-steps banner when any step is stuck', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 30));
    const banner = document.querySelector('[data-stuck-banner]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toMatch(/needs human review/i);
  });

  it('marks a workflow as needs-review if it owns a stuck step', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 30));
    const wfA = document.querySelector('[data-workflow-id="wf-a"] [data-status-dot]');
    expect(wfA?.getAttribute('data-status-dot')).toBe('needs-review');
  });
});
