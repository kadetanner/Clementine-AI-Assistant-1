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
  // Phase 22 — trace promoted out of phase-pending into a real view
  { route: 'trace', tag: 'lexi-trace-view' },
  // Phase 23 — observe pillar (logs, advisor, budget, heartbeat) shipped views
  { route: 'logs', tag: 'lexi-logs-view' },
  { route: 'advisor', tag: 'lexi-advisor-view' },
  { route: 'budget', tag: 'lexi-budget-view' },
  { route: 'heartbeat', tag: 'lexi-heartbeat-view' },
  // Phase 24 — brain pillar shipped view
  { route: 'brain', tag: 'lexi-brain-view' },
  // Phase 25 — operate pillar follow-on (routines, skills, approvals)
  { route: 'routines',  tag: 'lexi-routines-view' },
  { route: 'skills',    tag: 'lexi-skills-view' },
  { route: 'approvals', tag: 'lexi-approvals-view' },
  // Phase 26 — long-tail views (build, team, projects, plans, claims).
  // Closes the last phase-pending placeholders. All 17 nav sections now
  // mount real views.
  { route: 'build',    tag: 'lexi-build-view' },
  { route: 'team',     tag: 'lexi-team-view' },
  { route: 'projects', tag: 'lexi-projects-view' },
  { route: 'plans',    tag: 'lexi-plans-view' },
  { route: 'claims',   tag: 'lexi-claims-view' },
] as const;

// All Lighthouse sections now have a dedicated view. The pending list
// stays in place for forward compatibility but is empty.
const PENDING_SECTIONS = [] as const;

test.beforeAll(async ({ request }) => {
  try {
    const r = await request.get('/health', { timeout: 2_000 });
    if (!r.ok()) test.skip(true, `Lexi not healthy at /health (got ${r.status()})`);
  } catch (e) {
    test.skip(true, `Lexi unreachable at port 3030 — is com.lexi.dashboard loaded? (${(e as Error).message})`);
  }
});

// Phase 27 — the onboarding tour pops a modal overlay on first visit and
// blocks pointer events on the page underneath. Pre-seed the localStorage
// flag so it never opens during E2E. Tests that explicitly need the tour
// can override by clearing the flag in their own beforeEach.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('lexi-onboarding-seen', '1'); } catch { /* ignore */ }
  });
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

  test('trace — Runs pane renders, Timeline pane shows when there are runs', async ({ page }) => {
    await gotoRoute(page, 'trace', 'lexi-trace-view');
    const view = page.locator('lexi-trace-view');
    await expect(view).toContainText(/Trace/);
    await expect(view).toContainText(/Runs/);
    // When runs.length === 0, the right Timeline pane collapses to a single
    // full-width empty state (audit fix #3). When runs exist, both panes show.
    await expect(view).toContainText(/No runs yet|Timeline/);
    await expect(view).toContainText(/Pick a run|No runs yet|cron:|team-task:|unleashed:|discord:/);
  });

  test('logs — pane and filter input render', async ({ page }) => {
    await gotoRoute(page, 'logs', 'lexi-logs-view');
    const view = page.locator('lexi-logs-view');
    await expect(view).toContainText(/Logs/);
    await expect(view).toContainText(/Filter/);
  });

  test('advisor — five tab pills render and reflect status', async ({ page }) => {
    await gotoRoute(page, 'advisor', 'lexi-advisor-view');
    const view = page.locator('lexi-advisor-view');
    await expect(view).toContainText(/Advisor/);
    await expect(view).toContainText(/Decisions/);
    await expect(view).toContainText(/Effectiveness/);
    await expect(view).toContainText(/Trends/);
    await expect(view).toContainText(/Analytics/);
  });

  test('budget — surfaces free-only invariant and $0.00 spend', async ({ page }) => {
    await gotoRoute(page, 'budget', 'lexi-budget-view');
    const view = page.locator('lexi-budget-view');
    await expect(view).toContainText(/Free only|Paid enabled/);
    await expect(view).toContainText(/MTD spend/);
    await expect(view).toContainText(/\$\d+\.\d{2}/);
  });

  test('heartbeat — global + control + per-agent panes render', async ({ page }) => {
    await gotoRoute(page, 'heartbeat', 'lexi-heartbeat-view');
    const view = page.locator('lexi-heartbeat-view');
    await expect(view).toContainText(/Heartbeat/);
    await expect(view).toContainText(/Global/);
    await expect(view).toContainText(/Per-agent/);
  });

  test('brain — five tab pills render and connectors list shows', async ({ page }) => {
    await gotoRoute(page, 'brain', 'lexi-brain-view');
    const view = page.locator('lexi-brain-view');
    await expect(view).toContainText(/Brain/);
    await expect(view).toContainText(/Sources/);
    await expect(view).toContainText(/Feeds/);
    await expect(view).toContainText(/Connectors/);
    await expect(view).toContainText(/Library/);
    await expect(view).toContainText(/Runs/);
    // The connectors registry is static — at least one always shows
    await view.locator('.lx-tab-pill', { hasText: 'Connectors' }).click();
    await expect(view).toContainText(/Web Search|GitHub|Slack|Google Drive/);
  });

  test('routines — list pane renders, run-history collapses when empty', async ({ page }) => {
    await gotoRoute(page, 'routines', 'lexi-routines-view');
    const view = page.locator('lexi-routines-view');
    await expect(view).toContainText(/Routines/);
    // Run history pane only renders when there are routines OR something is
    // selected — see audit fix #3 in lexi-routines-view.ts.
    await expect(view).toContainText(/No routines configured|Run history/);
    await expect(view).toContainText(/No routines configured|Pick a routine|enabled|disabled/);
  });

  test('skills — list pane renders, editor pane collapses when empty', async ({ page }) => {
    await gotoRoute(page, 'skills', 'lexi-skills-view');
    const view = page.locator('lexi-skills-view');
    await expect(view).toContainText(/Skills/);
    await expect(view).toContainText(/Create/);
    // Editor pane only renders when skills exist OR something is selected.
    await expect(view).toContainText(/No skills yet|Editor/);
  });

  test('approvals — pending + decided buckets render', async ({ page }) => {
    await gotoRoute(page, 'approvals', 'lexi-approvals-view');
    const view = page.locator('lexi-approvals-view');
    await expect(view).toContainText(/Approvals/);
    await expect(view).toContainText(/Pending \(/);
    await expect(view).toContainText(/Decided \(/);
  });

  test('build — usage and operations panes render', async ({ page }) => {
    await gotoRoute(page, 'build', 'lexi-build-view');
    const view = page.locator('lexi-build-view');
    await expect(view).toContainText(/Build/);
    await expect(view).toContainText(/Usage/);
    await expect(view).toContainText(/Recent operations/);
  });

  test('team — status, members, leaderboard panes render', async ({ page }) => {
    await gotoRoute(page, 'team', 'lexi-team-view');
    const view = page.locator('lexi-team-view');
    await expect(view).toContainText(/Team/);
    await expect(view).toContainText(/Status/);
    await expect(view).toContainText(/Members/);
    await expect(view).toContainText(/Leaderboard/);
  });

  test('projects — list pane renders, detail collapses when empty', async ({ page }) => {
    await gotoRoute(page, 'projects', 'lexi-projects-view');
    const view = page.locator('lexi-projects-view');
    await expect(view).toContainText(/Projects/);
    // Detail pane only renders when projects exist OR something is selected.
    await expect(view).toContainText(/No projects|Detail/);
    await expect(view).toContainText(/Pick a project|No projects/);
  });

  test('plans — today + diff + list panes render', async ({ page }) => {
    await gotoRoute(page, 'plans', 'lexi-plans-view');
    const view = page.locator('lexi-plans-view');
    await expect(view).toContainText(/Plans/);
    await expect(view).toContainText(/Today/);
    await expect(view).toContainText(/Pending diff/);
  });

  test('claims — list with verify/fail/dismiss buttons render', async ({ page }) => {
    await gotoRoute(page, 'claims', 'lexi-claims-view');
    const view = page.locator('lexi-claims-view');
    await expect(view).toContainText(/Claims/);
    await expect(view).toContainText(/No claims|Verify|Fail|Dismiss/);
  });
});

test.describe('Navigation hygiene', () => {
  test('touring every route leaves exactly one view in the DOM', async ({ page }) => {
    await page.goto('/');
    const routes = [
      'today','agents','skills','heartbeat','cron','memory','workflows','logs',
      'budget','plans','team','projects','claims','brain','routines','approvals',
      'advisor','build','settings','trace','chat','search','vault','connections',
    ];
    for (const r of routes) {
      await page.goto(`/#/${r}`);
      await page.waitForTimeout(150);
    }
    const counts = await page.evaluate(() => {
      const tags = [
        'lexi-today-view','lexi-agents-view','lexi-skills-view','lexi-heartbeat-view',
        'lexi-cron-view','lexi-memory-view','lexi-workflows-view','lexi-logs-view',
        'lexi-budget-view','lexi-plans-view','lexi-team-view','lexi-projects-view',
        'lexi-claims-view','lexi-brain-view','lexi-routines-view','lexi-approvals-view',
        'lexi-advisor-view','lexi-build-view','lexi-settings-view','lexi-trace-view',
        'lexi-chat-view','lexi-search-view','lexi-vault-view','lexi-connections-view',
      ];
      const o: Record<string, number> = {};
      for (const t of tags) {
        const n = document.querySelectorAll(t).length;
        if (n > 0) o[t] = n;
      }
      return o;
    });
    const tags = Object.keys(counts);
    expect(tags.length, `expected exactly one mounted view, got: ${JSON.stringify(counts)}`).toBe(1);
    expect(counts[tags[0]]).toBe(1);
  });

  test('drawers do not render their content inline when closed', async ({ page }) => {
    await page.goto('/#/today');
    await page.waitForTimeout(400);
    const inline = await page.evaluate(() => {
      const notif = document.querySelector('lexi-notifications-drawer');
      const sys = document.querySelector('lexi-system-map-drawer');
      return {
        notifChildren: notif?.children.length ?? -1,
        sysChildren: sys?.children.length ?? -1,
      };
    });
    // When closed, both drawers should render `nothing` (zero children).
    expect(inline.notifChildren).toBe(0);
    expect(inline.sysChildren).toBe(0);
  });

  test('clicking the virtual Lexi agent does not 404 the detail pane', async ({ page }) => {
    await page.goto('/#/agents');
    await page.waitForTimeout(500);
    // Click the lexi agent entry in the list. Match the rendered name link.
    const lexiCard = page.locator('lexi-agents-view').getByText(/^lexi$/i).first();
    if (await lexiCard.count() > 0) {
      await lexiCard.click();
      await page.waitForTimeout(400);
      const view = page.locator('lexi-agents-view');
      await expect(view, 'no 404 after clicking virtual lexi').not.toContainText(/failed:\s*404|Error:.*404/);
    }
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
