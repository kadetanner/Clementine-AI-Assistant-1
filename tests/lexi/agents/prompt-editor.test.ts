/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/lexi-prompt-editor.js');
});

function mount(initial = 'hello'): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-prompt-editor') as HTMLElement & { value: string };
  el.setAttribute('value', initial);
  document.body.appendChild(el);
  return el;
}

describe('lexi-prompt-editor', () => {
  beforeEach(() => { document.body.replaceChildren(); });

  it('renders a textarea with the initial value', async () => {
    const el = mount('You are Lexi.');
    await new Promise((r) => requestAnimationFrame(r));
    const ta = el.querySelector('textarea')!;
    expect(ta.value).toBe('You are Lexi.');
  });

  it('marks itself dirty when the textarea changes', async () => {
    const el = mount('a');
    await new Promise((r) => requestAnimationFrame(r));
    const ta = el.querySelector('textarea')!;
    ta.value = 'b'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.querySelector('[data-dirty]')).toBeTruthy();
  });

  it('emits prompt-save on Save click with the new value', async () => {
    const el = mount('a');
    await new Promise((r) => requestAnimationFrame(r));
    const ta = el.querySelector('textarea')!;
    ta.value = 'c'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    const handler = vi.fn();
    el.addEventListener('prompt-save', handler as EventListener);
    (el.querySelector('[data-save]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(handler).toHaveBeenCalled();
    expect((handler.mock.calls[0][0] as CustomEvent).detail.value).toBe('c');
  });

  it('Cancel reverts to the original value and clears dirty', async () => {
    const el = mount('original');
    await new Promise((r) => requestAnimationFrame(r));
    const ta = el.querySelector('textarea')!;
    ta.value = 'mut'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    (el.querySelector('[data-cancel]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect((el.querySelector('textarea')! as HTMLTextAreaElement).value).toBe('original');
    expect(el.querySelector('[data-dirty]')).toBeNull();
  });
});
