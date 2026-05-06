/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/lexi-stuck-banner.js');
});

const originalFetch = global.fetch;

function mount(): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-stuck-banner');
  document.body.appendChild(el);
  return el;
}

describe('lexi-stuck-banner', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); global.fetch = originalFetch; });

  it('is hidden when there are zero stuck jobs', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, jobs: [] }), { status: 200 })) as unknown as typeof fetch;
    const el = mount();
    await Promise.resolve(); await Promise.resolve();
    await (el as any).updateComplete!;
    expect(getComputedStyle(el).display === 'none' || el.hasAttribute('hidden')).toBe(true);
  });

  it('renders count and Investigate button when stuck jobs exist', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      jobs: [{ name: 'insight-check', errorMessage: 'Prompt is too long', errorCount: 4 }],
    }), { status: 200 })) as unknown as typeof fetch;
    const el = mount();
    await Promise.resolve(); await Promise.resolve();
    await (el as any).updateComplete!;
    expect(el.textContent).toMatch(/1 cron job stuck/);
    expect(el.querySelector('button')?.textContent).toMatch(/Investigate/);
  });

  it('Investigate button dispatches lexi:navigate to cron section with focus', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      jobs: [{ name: 'insight-check', errorMessage: 'X', errorCount: 3 }],
    }), { status: 200 })) as unknown as typeof fetch;
    const el = mount();
    await Promise.resolve(); await Promise.resolve();
    await (el as any).updateComplete!;
    const events: CustomEvent[] = [];
    window.addEventListener('lexi:navigate', (e) => events.push(e as CustomEvent));
    el.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(events).toHaveLength(1);
    expect(events[0].detail).toMatchObject({ section: 'cron', focus: 'insight-check' });
  });

  it('updates immediately when a cron_job_stuck window event fires', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, jobs: [] }), { status: 200 })) as unknown as typeof fetch;
    const el = mount();
    await Promise.resolve(); await (el as any).updateComplete!;
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      ok: true, jobs: [{ name: 'x', errorMessage: 'y', errorCount: 3 }],
    }), { status: 200 })) as unknown as typeof fetch;
    window.dispatchEvent(new CustomEvent('cron_job_stuck', { detail: { name: 'x' } }));
    await Promise.resolve(); await Promise.resolve();
    await (el as any).updateComplete!;
    expect(el.textContent).toMatch(/1 cron job stuck/);
  });
});
