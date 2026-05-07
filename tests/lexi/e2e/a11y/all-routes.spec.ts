// tests/lexi/e2e/a11y/all-routes.spec.ts
// Per-route axe-playwright a11y baseline from the 2026-05 polish audit
// (Task D2). Fails on `serious` or `critical` violations only — the
// audit's bar is "navigable without a mouse and not actively hostile,"
// not full WCAG AA compliance.

import { test, expect } from '@playwright/test';
import { injectAxe, getViolations } from 'axe-playwright';
import { LEXI_ROUTES } from '../helpers/route-list';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('lexi-onboarding-seen', '999'); } catch { /* ignore */ }
  });
  const r = await page.goto('/').catch(() => null);
  if (!r || r.status() >= 400) test.skip(true, 'dashboard not running on :3030');
});

for (const { route, tag } of LEXI_ROUTES) {
  test(`a11y: #/${route} has no serious or critical violations`, async ({ page }) => {
    await page.goto(`/#/${route}`);
    await page.waitForSelector(tag, { timeout: 5000 });
    await injectAxe(page);
    const violations = await getViolations(page);
    const blocking = violations.filter((v) =>
      v.impact === 'serious' || v.impact === 'critical'
    );
    if (blocking.length > 0) {
      const summary = blocking.map((v) =>
        `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`
      ).join('\n');
      throw new Error(`a11y blocking violations on #/${route}:\n${summary}`);
    }
    expect(blocking).toEqual([]);
  });
}
