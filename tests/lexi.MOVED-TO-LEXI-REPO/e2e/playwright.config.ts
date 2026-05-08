import { defineConfig } from '@playwright/test';

/**
 * Playwright config for Lexi Dashboard E2E tests.
 *
 * Tests run against the live LaunchAgent on port 3030. They do NOT spawn a
 * sandbox server — the point is to validate the actual deployed dashboard
 * including its proxied data layer, themes, and SPA routing.
 *
 * If port 3030 isn't reachable, tests skip with a clear message rather than
 * failing — this lets the suite run safely in CI without the agent loaded.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // Single live server — sequential to avoid SSE/state races
  workers: 1,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3030',
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Three-browser matrix per DoD 8 — sequential because they share the live
  // LaunchAgent on :3030 and SSE streams there don't tolerate concurrent
  // tabs. Chromium runs by default; webkit + firefox runs are gated by env
  // because they require their browser binaries (`npx playwright install
  // webkit firefox`) and add ~10s per run on a clean machine.
  projects: (() => {
    const want = (process.env.LEXI_E2E_BROWSERS ?? 'chromium')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const all = {
      chromium: { name: 'chromium', use: { browserName: 'chromium' as const } },
      firefox:  { name: 'firefox',  use: { browserName: 'firefox'  as const } },
      webkit:   { name: 'webkit',   use: { browserName: 'webkit'   as const } },
    };
    return want
      .map((b) => (all as Record<string, typeof all.chromium | undefined>)[b])
      .filter((p): p is typeof all.chromium => Boolean(p));
  })(),
});
