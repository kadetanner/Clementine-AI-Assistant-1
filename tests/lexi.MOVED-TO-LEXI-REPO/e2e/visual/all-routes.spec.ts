// tests/lexi/e2e/visual/all-routes.spec.ts
// Per-route visual baselines from the 2026-05 polish audit (Task D3).
// Captures full-page screenshots at 1280x800 and 1440x900 for each
// of the 24 mounted dashboard routes.

import { test, expect } from '@playwright/test';
import { LEXI_ROUTES } from '../helpers/route-list';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('lexi-onboarding-seen', '999'); } catch { /* ignore */ }
  });
  const r = await page.goto('/').catch(() => null);
  if (!r || r.status() >= 400) test.skip(true, 'dashboard not running on :3030');
});

for (const { route, tag } of LEXI_ROUTES) {
  for (const viewport of [
    { width: 1280, height: 800, name: '1280' },
    { width: 1440, height: 900, name: '1440' },
  ]) {
    test(`visual: #/${route} @ ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/#/${route}`);
      await page.waitForSelector(tag, { timeout: 5000 });
      // Allow async data + transitions to settle before capture
      await page.waitForTimeout(800);
      await expect(page).toHaveScreenshot(`${route}-${viewport.name}.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  }
}
