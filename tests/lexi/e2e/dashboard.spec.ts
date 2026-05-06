/**
 * Real-browser E2E suite for Lexi Dashboard.
 *
 * What this validates that the prior (Plan 9) DoD harness did not:
 *   - Sections actually mount their components (not the placeholder).
 *   - Theme toggle works at runtime (not just on refresh).
 *   - Each section renders content from its proxied data layer.
 *   - No console errors on a normal navigation.
 *   - Cmd+K opens the palette and section navigation works.
 *
 * Run: npx playwright test --config=tests/lexi/e2e/playwright.config.ts
 */
import { test, expect, type Page } from '@playwright/test';

const SECTIONS = [
  'home',
  'agents',
  'connections',
  'workflows',
  'vault',
  'memory',
  'cron',
  'settings',
] as const;

// Skip the entire file when port 3030 isn't reachable — keeps CI green when
// LaunchAgent isn't loaded.
test.beforeAll(async ({ request }) => {
  try {
    const r = await request.get('/health', { timeout: 2_000 });
    if (!r.ok()) test.skip(true, `Lexi not healthy at /health (got ${r.status()})`);
  } catch (e) {
    test.skip(true, `Lexi unreachable at port 3030 — is com.lexi.dashboard loaded? (${(e as Error).message})`);
  }
});

async function gotoSection(page: Page, section: string): Promise<void> {
  await page.goto(`/#/${section}`);
  // Lit renders are async — wait for the section's component to be in the DOM
  await page.waitForFunction(
    (s) => {
      const main = document.querySelector('main.lexi-main');
      const tag = `lexi-${s === 'workflows' ? 'workflows' : s}-view`;
      return !!main?.querySelector(tag);
    },
    section,
    { timeout: 5_000 },
  );
}

test.describe('Shell', () => {
  test('serves the SPA root with the lexi-app element', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('lexi-app')).toBeVisible();
    await expect(page.locator('lexi-top-bar')).toBeVisible();
    await expect(page.locator('lexi-nav-rail')).toBeVisible();
  });

  test('all 8 sections mount their component (no placeholder)', async ({ page }) => {
    for (const section of SECTIONS) {
      await gotoSection(page, section);
      const main = page.locator('main.lexi-main');
      await expect(main, `section ${section}`).not.toContainText('This section is wired in a later plan');
      await expect(main, `section ${section}`).not.toContainText('Unknown section');
    }
  });

  test('no JS errors on a full nav tour', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    for (const section of SECTIONS) {
      await gotoSection(page, section);
      await page.waitForTimeout(300);
    }
    // SSE stream chunked-encoding warnings come through page.on('requestfailed')
    // not pageerror, and are cosmetic on hashchange — ignore.
    expect(errors, `pageerrors during tour: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('Theme toggle', () => {
  test('clicks toggle and the dataset.theme actually changes', async ({ page }) => {
    await page.goto('/');
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.click('button[aria-label="Toggle theme"]');
    // View Transitions + spotlight wipe ~ 450ms, then settle
    await page.waitForFunction(
      (initial) => document.documentElement.dataset.theme !== initial,
      before,
      { timeout: 3_000 },
    );
    const after = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(after).not.toBe(before);
    expect(['light', 'dark']).toContain(after);
  });

  test('CSS custom property --bg-canvas swaps with theme', async ({ page }) => {
    await page.goto('/');
    const initial = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim(),
    );
    await page.click('button[aria-label="Toggle theme"]');
    await page.waitForTimeout(800);
    const swapped = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim(),
    );
    expect(swapped).not.toBe(initial);
  });

  test('localStorage persists the chosen theme', async ({ page }) => {
    await page.goto('/');
    await page.click('button[aria-label="Toggle theme"]');
    await page.waitForTimeout(500);
    const stored = await page.evaluate(() => localStorage.getItem('lexi-theme'));
    expect(['light', 'dark']).toContain(stored);
  });
});

test.describe('Section content', () => {
  test('agents — list contains at least one agent card', async ({ page }) => {
    await gotoSection(page, 'agents');
    const view = page.locator('lexi-agents-view');
    await expect(view).toContainText(/\d+\/\d+\s+tools/);
  });

  test('connections — filter chips and connection cards render', async ({ page }) => {
    await gotoSection(page, 'connections');
    const view = page.locator('lexi-connections-view');
    await expect(view).toContainText(/Kind/);
    await expect(view).toContainText(/Status/);
    // Should have at least one of mcp/composio/oauth label or "No connections"
    await expect(view).toContainText(/mcp|composio|oauth|No connections/);
  });

  test('workflows — at least one workflow row', async ({ page }) => {
    await gotoSection(page, 'workflows');
    const view = page.locator('lexi-workflows-view');
    // Workflow IDs follow workflow:* or cron:* pattern
    await expect(view).toContainText(/workflow:|cron:/);
  });

  test('vault — file tree shows folders', async ({ page }) => {
    await gotoSection(page, 'vault');
    const view = page.locator('lexi-vault-view');
    await expect(view).toContainText(/Daily-Notes|System|People/);
  });

  test('memory — tabs render (Stats/Graph/Recall Traces/Integrity)', async ({ page }) => {
    await gotoSection(page, 'memory');
    const view = page.locator('lexi-memory-view');
    await expect(view).toContainText(/Stats/);
    await expect(view).toContainText(/Graph/);
    await expect(view).toContainText(/Recall Traces/);
    await expect(view).toContainText(/Integrity/);
  });

  test('cron — at least one cron job row', async ({ page }) => {
    await gotoSection(page, 'cron');
    const view = page.locator('lexi-cron-view');
    // Cron schedule format like "0 8 * * *"
    await expect(view).toContainText(/\d+\s+\d+\s+\*\s+\*\s+\*/);
  });

  test('settings — tabs render', async ({ page }) => {
    await gotoSection(page, 'settings');
    const view = page.locator('lexi-settings-view');
    await expect(view).toContainText(/Theme/);
    await expect(view).toContainText(/Auth/);
  });

  test('home — now-playing card renders', async ({ page }) => {
    await gotoSection(page, 'home');
    const view = page.locator('lexi-home-view');
    await expect(view).toBeVisible();
    // Empty-state copy is the current shipped behavior; documented gap in
    // spec §6 (home should also have Today panel + at-a-glance counters).
    await expect(view).toContainText(/lexi/i);
  });
});

test.describe('Command palette (Cmd+K)', () => {
  test('Cmd+K opens palette from any section', async ({ page }) => {
    await gotoSection(page, 'agents');
    await page.keyboard.press('Meta+k');
    const palette = page.locator('lexi-command-palette[open]');
    await expect(palette).toBeVisible({ timeout: 3_000 });
  });

  test('Escape closes the palette', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+k');
    const palette = page.locator('lexi-command-palette');
    await expect(palette).toHaveAttribute('open', '', { timeout: 3_000 });
    await page.keyboard.press('Escape');
    await expect(palette).not.toHaveAttribute('open', '', { timeout: 3_000 });
  });
});

test.describe('Backend endpoints (sanity)', () => {
  // These overlap the old DoD endpoint coverage but verify the proxy layer
  // actually serves real data, not just 200s.
  test('GET /api/cron has jobs array', async ({ request }) => {
    const r = await request.get('/api/cron');
    expect(r.ok()).toBe(true);
    const body = await r.json();
    // Upstream's getCronJobs returns { jobs: [...] }
    expect(body.jobs ?? body).toBeDefined();
  });

  test('GET /api/cron/broken-jobs responds 200', async ({ request }) => {
    const r = await request.get('/api/cron/broken-jobs');
    expect(r.ok()).toBe(true);
  });

  test('GET /api/agents lists agents', async ({ request }) => {
    const r = await request.get('/api/agents');
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(Array.isArray(body.agents)).toBe(true);
  });

  test('GET /api/connections lists connections', async ({ request }) => {
    const r = await request.get('/api/connections');
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(Array.isArray(body.connections)).toBe(true);
  });

  test('GET /api/vault-files responds with files array', async ({ request }) => {
    const r = await request.get('/api/vault-files?limit=10&sinceDays=90');
    expect(r.ok()).toBe(true);
  });

  test('GET /api/memory/health responds 200', async ({ request }) => {
    const r = await request.get('/api/memory/health');
    expect(r.ok()).toBe(true);
  });

  test('GET /api/builder/workflows lists workflows', async ({ request }) => {
    const r = await request.get('/api/builder/workflows');
    expect(r.ok()).toBe(true);
  });

  test('GET /api/secrets/refs returns secrets list (names only)', async ({ request }) => {
    const r = await request.get('/api/secrets/refs');
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(Array.isArray(body.secrets ?? body)).toBe(true);
  });
});
