/**
 * @vitest-environment jsdom
 *
 * Lighthouse Phase 12: shell now uses v2 components.
 */
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../src/lexi-dashboard/ui/components/lexi-app.js');
});

function mountApp(): HTMLElement {
  document.body.replaceChildren();
  const app = document.createElement('lexi-app');
  document.body.appendChild(app);
  return app;
}

describe('lexi shell components (v2)', () => {
  it('registers shell custom elements', () => {
    expect(customElements.get('lexi-app')).toBeDefined();
    expect(customElements.get('lexi-nav-rail-v2')).toBeDefined();
    expect(customElements.get('lexi-top-bar-v2')).toBeDefined();
    expect(customElements.get('lexi-notifications-drawer')).toBeDefined();
    expect(customElements.get('lexi-system-map-drawer')).toBeDefined();
  });

  it('renders top bar + nav rail + main + drawers', async () => {
    const app = mountApp();
    await new Promise((r) => requestAnimationFrame(r));
    expect(app.querySelector('lexi-top-bar-v2')).toBeTruthy();
    expect(app.querySelector('lexi-nav-rail-v2')).toBeTruthy();
    expect(app.querySelector('main.lexi-main')).toBeTruthy();
    expect(app.querySelector('lexi-notifications-drawer')).toBeTruthy();
    expect(app.querySelector('lexi-system-map-drawer')).toBeTruthy();
  });

  it('nav rail v2 lists all 17 nav items + 2 footer in defined order', async () => {
    mountApp();
    await new Promise((r) => requestAnimationFrame(r));
    const items = document.querySelectorAll('lexi-nav-rail-v2 [data-section]');
    const sections = Array.from(items).map((el) => el.getAttribute('data-section'));
    expect(sections).toEqual([
      // Work
      'today', 'agents', 'workflows', 'cron', 'routines',
      // Knowledge
      'memory', 'brain', 'vault',
      // Operate
      'connections', 'skills', 'approvals', 'budget',
      // Observe
      'logs', 'advisor', 'heartbeat', 'build',
      // Console
      'chat', 'trace',
      // Footer
      'search', 'settings',
    ]);
  });
});
