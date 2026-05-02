/**
 * @vitest-environment jsdom
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

describe('lexi shell components', () => {
  it('registers all five custom elements', () => {
    expect(customElements.get('lexi-app')).toBeDefined();
    expect(customElements.get('lexi-nav-rail')).toBeDefined();
    expect(customElements.get('lexi-top-bar')).toBeDefined();
    expect(customElements.get('lexi-right-rail')).toBeDefined();
    expect(customElements.get('lexi-bottom-drawer')).toBeDefined();
  });

  it('renders four regions and a <main>', async () => {
    const app = mountApp();
    await new Promise((r) => requestAnimationFrame(r));
    expect(app.querySelector('lexi-top-bar')).toBeTruthy();
    expect(app.querySelector('lexi-nav-rail')).toBeTruthy();
    expect(app.querySelector('main.lexi-main')).toBeTruthy();
    expect(app.querySelector('lexi-right-rail')).toBeTruthy();
    expect(app.querySelector('lexi-bottom-drawer')).toBeTruthy();
  });

  it('nav rail lists all 8 sections in spec order', async () => {
    mountApp();
    await new Promise((r) => requestAnimationFrame(r));
    const items = document.querySelectorAll('lexi-nav-rail [data-section]');
    const sections = Array.from(items).map((el) => el.getAttribute('data-section'));
    expect(sections).toEqual(['home','agents','connections','workflows','vault','memory','cron','settings']);
  });
});
