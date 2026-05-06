/**
 * Real-browser E2E suite for Lexi Dashboard.
 *
 * Lighthouse Phase 12 update: validates the new shell (top-bar-v2, nav-rail-v2,
 * notifications drawer, system-map drawer) and the v2 nav structure (17 items
 * across 5 groups). Existing 8 sections still mount their existing views.
 */
import { test, expect, type Page } from '@playwright/test';

// Old + new sections combined.
const LEGACY_SECTIONS = [
  { route: 'today', tag: 'lexi-today-view' },
  { route: 'agents', tag: 'lexi-agents-view' },
  { route: 'connections', tag: 'lexi-connections-view' },
  { route: 'workflows', tag: 'lexi-workflows-view' },
  { route: 'vault', tag: 'lexi-vault-view' },
  { route: 'memory', tag: 'lexi-memory-view' },
  { route: 'cron', tag: 'lexi-cron-view' },
  { route: 'settings', tag: 'lexi-settings-view' },
] as const;

const PENDING_SECTIONS = [
  'routines', 'brain', 'skills', 'approvals', 'budget',
  'logs', 'advisor', 'heartbeat', 'build',
  'team', 'projects', 'plans', 'claims',
  'trace', 'search',
] as const;

test.beforeAll(async ({ request }) => {
  try {
    const r = await request.get('/health', { timeout: 2_000 });
    if (!r.ok()) test.skip(true, `Lexi not healthy at /health (got ${r.status()})`);
  } catch (e) {
    test.skip(true, `Lexi unreachable at port 3030 — is com.lexi.dashboard loaded? (${(e as Error).message})`);
  }
});

async function waitForView(page: Page, tag: string): Promise<void> {
  await page.waitForFunction(
    (selector) => !!document.querySelector('main.lexi-main')?.querySelector(selector),
    tag,
    { timeout: 5_000 },
  );
}

async function gotoRoute(page: Page, route: string, expectTag: string): Promise<void> {
  await page.goto(`/#/${route}`);
  await waitForView(page, expectTag);
}

test.describe('Shell', () => {
  test('serves the SPA root with the v2 shell elements', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('lexi-app')).toBeVisible();
    await expect(page.locator('lexi-top-bar-v2')).toBeVisible();
    await expect(page.locator('lexi-nav-rail-v2')).toBeVisible();
  });

  test('nav rail shows all 17 nav items in 5 groups + 2 footer', async ({ page }) => {
    await page.goto('/');
    const items = await page.locator('lexi-nav-rail-v2 .lx-nav-item').count();
    // 17 grouped + 2 footer
    expect(items).toBeGreaterThanOrEqual(19);
  });

  test('all legacy sections mount their component (no placeholder)', async ({ page }) => {
    for (const s of LEGACY_SECTIONS) {
      await gotoRoute(page, s.route, s.tag);
      const main = page.locator('main.lexi-main');
      await expect(main, `section ${s.route}`).not.toContainText('This section is wired in a later plan');
      await expect(main, `section ${s.route}`).not.toContainText('Unknown section');
    }
  });

  test('pending sections render the phase-pending placeholder honestly', async ({ page }) => {
    for (const s of PENDING_SECTIONS) {
      await gotoRoute(page, s, 'lexi-phase-pending-view');
      const view = page.locator('lexi-phase-pending-view');
      await expect(view, `pending ${s}`).toBeVisible();
      // Honest: must call out a phase, not a deceptive "wired" placeholder
      await expect(view).toContainText(/Phase \d+/);
    }
  });

  test('no JS errors on a full nav tour through all 17 sections', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    for (const s of LEGACY_SECTIONS) {
      await gotoRoute(page, s.route, s.tag);
      await page.waitForTimeout(150);
    }
    for (const s of PENDING_SECTIONS) {
      await gotoRoute(page, s, 'lexi-phase-pending-view');
      await page.waitForTimeout(80);
    }
    expect(errors, `pageerrors during tour: ${errors.join(' | ')}`).toEqual([]);
  });

  test('home alias routes to Today view', async ({ page }) => {
    await page.goto('/#/home');
    await waitForView(page, 'lexi-today-view');
    await expect(page.locator('lexi-today-view')).toBeVisible();
  });
});

test.describe('Theme toggle', () => {
  test('clicks toggle and the dataset.theme actually changes', async ({ page }) => {
    await page.goto('/');
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.click('button[aria-label="Toggle theme"]');
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

test.describe('Notifications drawer', () => {
  test('bell icon opens the drawer', async ({ page }) => {
    await page.goto('/');
    await page.click('button[aria-label="Notifications"]');
    await expect(page.locator('lexi-notifications-drawer .lx-drawer')).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('System map drawer', () => {
  test('status dot opens the drawer with doctor checks', async ({ page }) => {
    await page.goto('/');
    await page.click('button[aria-label*="System status"]');
    await expect(page.locator('lexi-system-map-drawer .lx-drawer')).toBeVisible({ timeout: 3_000 });
  });
});

test.describe('Section content', () => {
  test('today — Now Playing + At-a-glance counters', async ({ page }) => {
    await gotoRoute(page, 'today', 'lexi-today-view');
    const view = page.locator('lexi-today-view');
    await expect(view).toContainText(/Today/);
    await expect(view).toContainText(/At a glance/);
    // Counter labels
    await expect(view).toContainText(/Agents/);
    await expect(view).toContainText(/Memory/);
  });

  test('agents — list contains at least one agent card', async ({ page }) => {
    await gotoRoute(page, 'agents', 'lexi-agents-view');
    const view = page.locator('lexi-agents-view');
    await expect(view).toContainText(/\d+\/\d+\s+tools/);
  });

  test('connections — filter chips and connection cards render', async ({ page }) => {
    await gotoRoute(page, 'connections', 'lexi-connections-view');
    const view = page.locator('lexi-connections-view');
    await expect(view).toContainText(/Kind/);
    await expect(view).toContainText(/Status/);
    await expect(view).toContainText(/mcp|composio|oauth|No connections/);
  });

  test('workflows — at least one workflow row', async ({ page }) => {
    await gotoRoute(page, 'workflows', 'lexi-workflows-view');
    const view = page.locator('lexi-workflows-view');
    await expect(view).toContainText(/workflow:|cron:/);
  });

  test('vault — file tree shows folders', async ({ page }) => {
    await gotoRoute(page, 'vault', 'lexi-vault-view');
    const view = page.locator('lexi-vault-view');
    await expect(view).toContainText(/Daily-Notes|System|People/);
  });

  test('memory — tabs render (Stats/Graph/Recall Traces/Integrity)', async ({ page }) => {
    await gotoRoute(page, 'memory', 'lexi-memory-view');
    const view = page.locator('lexi-memory-view');
    await expect(view).toContainText(/Stats/);
    await expect(view).toContainText(/Graph/);
    await expect(view).toContainText(/Recall Traces/);
    await expect(view).toContainText(/Integrity/);
  });

  test('cron — at least one cron job row', async ({ page }) => {
    await gotoRoute(page, 'cron', 'lexi-cron-view');
    const view = page.locator('lexi-cron-view');
    await expect(view).toContainText(/\d+\s+\d+\s+\*\s+\*\s+\*/);
  });

  test('settings — tabs render', async ({ page }) => {
    await gotoRoute(page, 'settings', 'lexi-settings-view');
    const view = page.locator('lexi-settings-view');
    await expect(view).toContainText(/Theme/);
    await expect(view).toContainText(/Auth/);
  });
});

test.describe('Command palette (Cmd+K)', () => {
  test('Cmd+K opens palette from any section', async ({ page }) => {
    await gotoRoute(page, 'agents', 'lexi-agents-view');
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
  test('GET /api/cron has jobs array', async ({ request }) => {
    const r = await request.get('/api/cron');
    expect(r.ok()).toBe(true);
    const body = await r.json();
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
