// tests/lexi/e2e/states/all-routes.spec.ts
// Per-route empty/error/loading state coverage from the 2026-05 polish
// audit (Task D4). For each route, force /api/* responses into one of
// three states and assert the view stays visible + non-zero height +
// doesn't throw a JS exception.
//
// This is a "doesn't crash" bar, not a "states are pretty" bar. Visual
// review of empty/error states is part of Phase B's manual pass.

import { test, expect } from '@playwright/test';
import { LEXI_ROUTES } from '../helpers/route-list';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('lexi-onboarding-seen', '999'); } catch { /* ignore */ }
  });
  const r = await page.goto('/').catch(() => null);
  if (!r || r.status() >= 400) test.skip(true, 'dashboard not running on :3030');
});

const API_GLOB = '**/api/**';

for (const { route, tag } of LEXI_ROUTES) {
  test.describe(`states: #/${route}`, () => {
    test('error state — all /api/* 500: view stays visible, no JS exception', async ({ page }) => {
      const jsErrors: string[] = [];
      page.on('pageerror', (err) => jsErrors.push(err.message));
      await page.route(API_GLOB, (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"forced"}' }));
      await page.goto(`/#/${route}`);
      await expect(page.locator(tag)).toBeVisible({ timeout: 5000 });
      const box = await page.locator(tag).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThan(20);
      // Allow async errors to surface
      await page.waitForTimeout(500);
      expect(jsErrors).toEqual([]);
    });

    test('empty state — all /api/* return 200 with empty payload: view stays visible, no JS exception', async ({ page }) => {
      const jsErrors: string[] = [];
      page.on('pageerror', (err) => jsErrors.push(err.message));
      // Different endpoints expect arrays vs objects; an empty object [] is
      // valid JSON for both and returns "nothing to show" semantics for
      // most list-shaped endpoints. Object-shaped endpoints get a fallback
      // structure via the second route handler.
      await page.route(API_GLOB, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
      await page.goto(`/#/${route}`);
      await expect(page.locator(tag)).toBeVisible({ timeout: 5000 });
      const box = await page.locator(tag).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThan(20);
      await page.waitForTimeout(500);
      expect(jsErrors).toEqual([]);
    });

    test('loading state — all /api/* delayed 1500ms: view visible mid-load with non-zero height', async ({ page }) => {
      await page.route(API_GLOB, async (r) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      });
      const navPromise = page.goto(`/#/${route}`);
      // Mid-load: the component shell should already render (skeletons,
      // loading indicators, empty placeholder are all acceptable — but
      // the view must NOT collapse to zero height).
      await page.waitForSelector(tag, { timeout: 1000 });
      const box = await page.locator(tag).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThan(20);
      await navPromise;
    });
  });
}
