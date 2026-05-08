/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applyTheme } from '../../src/lexi-dashboard/ui/theme/themes.js';

beforeAll(async () => {
  await import('../../src/lexi-dashboard/ui/components/lexi-theme-toggle.js');
});

function mountToggle(): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-theme-toggle');
  document.body.appendChild(el);
  return el;
}

describe('lexi-theme-toggle', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    applyTheme('dark');
  });

  it('toggles theme on click', async () => {
    mountToggle();
    await new Promise((r) => requestAnimationFrame(r));
    const button = document.querySelector('lexi-theme-toggle button')!;
    button.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10 }));
    await new Promise((r) => setTimeout(r, 200));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('persists choice in localStorage', async () => {
    mountToggle();
    await new Promise((r) => requestAnimationFrame(r));
    document.querySelector('lexi-theme-toggle button')!.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10 }));
    await new Promise((r) => setTimeout(r, 200));
    expect(localStorage.getItem('lexi-theme')).toBe('light');
  });
});
