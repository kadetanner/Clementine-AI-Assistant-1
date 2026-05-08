/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/connections/lexi-credential-editor.js');
});

describe('lexi-credential-editor', () => {
  function mount(): HTMLElement {
    document.body.replaceChildren();
    const el = document.createElement('lexi-credential-editor') as HTMLElement & { credentials: unknown };
    (el as unknown as { credentials: object }).credentials = { API_KEY: 'sk***1234', EMPTY: null };
    document.body.appendChild(el);
    return el;
  }

  it('renders one password input per credential key', async () => {
    const el = mount();
    await new Promise((r) => requestAnimationFrame(r));
    const inputs = el.querySelectorAll('input[type="password"], input[type="text"][data-key]');
    expect(inputs.length).toBe(2);
  });

  it('toggles input type when show/hide is clicked', async () => {
    const el = mount();
    await new Promise((r) => requestAnimationFrame(r));
    const toggle = el.querySelector('[data-toggle="API_KEY"]') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    toggle.click();
    await new Promise((r) => requestAnimationFrame(r));
    const input = el.querySelector('input[data-key="API_KEY"]') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('emits credential-save with only changed keys on save', async () => {
    const el = mount();
    let captured: unknown = null;
    el.addEventListener('credential-save', (ev: Event) => { captured = (ev as CustomEvent).detail; });
    await new Promise((r) => requestAnimationFrame(r));
    const input = el.querySelector('input[data-key="API_KEY"]') as HTMLInputElement;
    input.value = 'sk-new-value-aaaa';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    (el.querySelector('[data-action="save"]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(captured).toEqual({ credentials: { API_KEY: 'sk-new-value-aaaa' } });
  });
});
