/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transitionTheme } from '../../src/lexi-dashboard/ui/theme/transition.js';
import { currentTheme, applyTheme } from '../../src/lexi-dashboard/ui/theme/themes.js';

describe('theme transition', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('data-theme-transitioning');
    document.body.replaceChildren();
    applyTheme('dark');
  });

  it('applies the new theme even without View Transitions support', async () => {
    await transitionTheme('light');
    expect(currentTheme()).toBe('light');
  });

  it('toggles data-theme-transitioning on body during the swap', async () => {
    const observer = vi.fn();
    new MutationObserver(observer).observe(document.body, { attributes: true });
    await transitionTheme('light');
    expect(observer).toHaveBeenCalled();
  });

  it('respects prefers-reduced-motion (no spotlight overlay remains)', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({
        matches: q.includes('reduce'), media: q, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    await transitionTheme('light', { originX: 100, originY: 100 });
    expect(document.getElementById('lexi-spotlight')).toBeNull();
  });

  it('does NOT change theme if next equals current', async () => {
    const before = document.documentElement.dataset.theme;
    await transitionTheme('dark');
    expect(document.documentElement.dataset.theme).toBe(before);
  });
});
