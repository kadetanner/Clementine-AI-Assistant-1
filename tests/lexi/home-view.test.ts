/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../src/lexi-dashboard/ui/components/lexi-home-view.js');
  await import('../../src/lexi-dashboard/ui/components/lexi-app.js');
});

describe('lexi-home-view', () => {
  it('renders Now Playing in the center', async () => {
    document.body.replaceChildren();
    const home = document.createElement('lexi-home-view');
    document.body.appendChild(home);
    await new Promise((r) => requestAnimationFrame(r));
    expect(home.querySelector('lexi-now-playing')).toBeTruthy();
  });

  it('lexi-app routes home to lexi-home-view by default', async () => {
    document.body.replaceChildren();
    const app = document.createElement('lexi-app');
    document.body.appendChild(app);
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    expect(app.querySelector('lexi-home-view')).toBeTruthy();
  });
});
