/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme, currentTheme, THEME_TOKENS } from '../../src/lexi-dashboard/ui/theme/themes.js';

describe('theme tokens', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
  });

  it('exposes all 15 spec tokens', () => {
    const expected = ['bg-canvas','bg-surface','bg-elevated','border-subtle','border-default','text-primary','text-secondary','text-tertiary','accent','accent-hover','accent-glow','success','warning','danger','purple'];
    for (const t of expected) expect(THEME_TOKENS).toContain(t);
  });

  it('applyTheme(dark) sets bg-canvas to #0a0a0a and accent to #0070f3', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--bg-canvas')).toBe('#0a0a0a');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#0070f3');
  });

  it('applyTheme(light) sets bg-canvas to #ffffff and accent to #0070f3', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--bg-canvas')).toBe('#ffffff');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#0070f3');
  });

  it('currentTheme reads data-theme', () => {
    applyTheme('light'); expect(currentTheme()).toBe('light');
    applyTheme('dark'); expect(currentTheme()).toBe('dark');
  });
});
