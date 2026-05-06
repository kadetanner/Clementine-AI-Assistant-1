/**
 * @vitest-environment jsdom
 *
 * Lighthouse Phase 12: home alias routes to lexi-today-view (which composes
 * Now Playing + at-a-glance counters per spec §6).
 */
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../src/lexi-dashboard/ui/views/lexi-today-view.js');
  await import('../../src/lexi-dashboard/ui/components/lexi-app.js');
});

describe('lexi today view (home alias)', () => {
  it('today view embeds Now Playing', async () => {
    document.body.replaceChildren();
    const view = document.createElement('lexi-today-view');
    document.body.appendChild(view);
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    expect(view.querySelector('lexi-now-playing')).toBeTruthy();
  });

  it('lexi-app default route mounts today view', async () => {
    document.body.replaceChildren();
    const app = document.createElement('lexi-app');
    document.body.appendChild(app);
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    expect(app.querySelector('lexi-today-view')).toBeTruthy();
  });

  it('legacy #/home route also resolves to today view', async () => {
    document.body.replaceChildren();
    window.location.hash = '#/home';
    const app = document.createElement('lexi-app');
    document.body.appendChild(app);
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    expect(app.querySelector('lexi-today-view')).toBeTruthy();
    window.location.hash = '';
  });
});
