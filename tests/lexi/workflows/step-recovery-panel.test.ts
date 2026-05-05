/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/workflows/lexi-step-recovery-panel.js');
});

function mount(workflowId: string, stepId: string, runId: string) {
  document.body.replaceChildren();
  const el = document.createElement('lexi-step-recovery-panel');
  el.setAttribute('workflow-id', workflowId);
  el.setAttribute('step-id', stepId);
  el.setAttribute('run-id', runId);
  document.body.appendChild(el);
  return el;
}

describe('lexi-step-recovery-panel', () => {
  beforeEach(() => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/workflows/runs/run-1/diagnostics')) {
        return new Response(JSON.stringify({
          runId: 'run-1', workflowId: 'wf-a',
          steps: [
            { stepId: 's1', startedAt: 1, endedAt: 2, status: 'error', error: 'context refilled', context: 'ctx A' },
            { stepId: 's1', startedAt: 3, endedAt: 4, status: 'error', error: 'context refilled', context: 'ctx B' },
            { stepId: 's1', startedAt: 5, endedAt: 6, status: 'error', error: 'context refilled', context: 'ctx C' },
          ],
          autocompactEvents: [],
          lastFailure: { stepId: 's1', ts: 7, error: 'context refilled within 3 turns', context: 'PROMPT: do thing' },
        }), { status: 200 });
      }
      if (url.endsWith('/api/workflows/stuck-steps/wf-a/s1') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      return new Response('nope', { status: 404 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('shows the failing prompt from lastFailure.context', async () => {
    mount('wf-a', 's1', 'run-1');
    await new Promise((r) => setTimeout(r, 30));
    expect(document.body.textContent).toContain('PROMPT: do thing');
  });

  it('shows the last 3 contexts', async () => {
    mount('wf-a', 's1', 'run-1');
    await new Promise((r) => setTimeout(r, 30));
    const ctxs = document.querySelectorAll('[data-context-snapshot]');
    expect(ctxs.length).toBe(3);
    expect(ctxs[0].textContent).toContain('ctx A');
    expect(ctxs[2].textContent).toContain('ctx C');
  });

  it('renders skip and retry buttons', async () => {
    mount('wf-a', 's1', 'run-1');
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('[data-action="skip"]')).not.toBeNull();
    expect(document.querySelector('[data-action="retry"]')).not.toBeNull();
  });

  it('skip clears the stuck marker', async () => {
    mount('wf-a', 's1', 'run-1');
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('[data-action="skip"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[1]?.method === 'DELETE');
    expect(calls.length).toBeGreaterThan(0);
  });
});
