/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/connections/lexi-oauth-status.js');
});

describe('lexi-oauth-status', () => {
  function mount(connection: object): HTMLElement {
    document.body.replaceChildren();
    const el = document.createElement('lexi-oauth-status') as HTMLElement & { connection: unknown };
    (el as unknown as { connection: object }).connection = connection;
    document.body.appendChild(el);
    return el;
  }

  it('shows a Re-auth button when status is degraded or disconnected', async () => {
    const el = mount({ id: 'oauth:salesforce', kind: 'oauth', name: 'Salesforce', status: 'disconnected', tool_count: 0, last_check_at: null });
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.querySelector('[data-action="reauth"]')).toBeTruthy();
  });

  it('hides Re-auth button when status is connected', async () => {
    const el = mount({ id: 'oauth:salesforce', kind: 'oauth', name: 'Salesforce', status: 'connected', tool_count: 0, last_check_at: '2026-05-02T12:00:00Z' });
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.querySelector('[data-action="reauth"]')).toBeNull();
  });

  it('emits oauth-reauth with provider id when re-auth clicked', async () => {
    const el = mount({ id: 'oauth:gmail', kind: 'oauth', name: 'Gmail', status: 'disconnected', tool_count: 0, last_check_at: null });
    let captured: unknown = null;
    el.addEventListener('oauth-reauth', (ev: Event) => { captured = (ev as CustomEvent).detail; });
    await new Promise((r) => requestAnimationFrame(r));
    (el.querySelector('[data-action="reauth"]') as HTMLButtonElement).click();
    expect(captured).toEqual({ id: 'oauth:gmail', provider: 'gmail' });
  });
});
