// tests/lexi/e2e/views/all-routes.spec.ts
// Per-route baseline E2E from the 2026-05 polish audit (Task D1).
// Three checks per route: mount, non-zero dims, no console errors.

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
  test.describe(`#/${route}`, () => {
    test('mounts the expected component tag', async ({ page }) => {
      await page.goto(`/#/${route}`);
      await expect(page.locator(tag)).toBeVisible({ timeout: 5000 });
    });

    test('component has non-zero rendered dimensions', async ({ page }) => {
      await page.goto(`/#/${route}`);
      const el = page.locator(tag);
      await expect(el).toBeVisible({ timeout: 5000 });
      const box = await el.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThan(0);
      expect(box!.width).toBeGreaterThan(0);
    });

    test('no JS errors after navigation', async ({ page }) => {
      // Real JS exceptions only — not "Failed to load resource" 404 logs
      // from optional/best-effort fetches that the views catch and handle.
      const jsErrors: string[] = [];
      page.on('pageerror', (err) => jsErrors.push(err.message));
      await page.goto(`/#/${route}`);
      await expect(page.locator(tag)).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(500);
      expect(jsErrors).toEqual([]);
    });
  });
}
