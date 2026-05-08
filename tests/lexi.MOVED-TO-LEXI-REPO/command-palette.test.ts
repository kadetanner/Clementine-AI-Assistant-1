/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

beforeAll(async () => {
  await import('../../src/lexi-dashboard/ui/components/lexi-command-palette.js');
});

function mountPalette(): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-command-palette');
  document.body.appendChild(el);
  return el;
}

describe('lexi-command-palette', () => {
  beforeEach(() => { mountPalette(); });

  it('is hidden by default', async () => {
    await new Promise((r) => requestAnimationFrame(r));
    const el = document.querySelector('lexi-command-palette') as HTMLElement;
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('opens when Cmd+K is pressed', async () => {
    await new Promise((r) => requestAnimationFrame(r));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    await new Promise((r) => requestAnimationFrame(r));
    const el = document.querySelector('lexi-command-palette') as HTMLElement;
    expect(el.hasAttribute('open')).toBe(true);
  });

  it('closes when Escape is pressed', async () => {
    await new Promise((r) => requestAnimationFrame(r));
    const el = document.querySelector('lexi-command-palette') as HTMLElement;
    el.setAttribute('open', '');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('lists nav sections as commands', async () => {
    const el = document.querySelector('lexi-command-palette') as HTMLElement;
    el.setAttribute('open', '');
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    const items = el.shadowRoot
      ? el.shadowRoot.querySelectorAll('[data-command]')
      : el.querySelectorAll('[data-command]');
    const ids = Array.from(items).map((i) => i.getAttribute('data-command'));
    for (const expected of ['home','agents','connections','workflows','vault','memory','cron','settings']) {
      expect(ids).toContain(`nav:${expected}`);
    }
  });
});
