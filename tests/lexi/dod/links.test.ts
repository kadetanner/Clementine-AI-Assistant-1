import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const bundlePath = path.join(repoRoot, 'dist/lexi-dashboard/ui/main.js');

// DoD 1-4 coverage from docs/lexi/specs/2026-05-02-lexi-dashboard-design.md §9.
//
// Deviations from docs/lexi/plans/09-dod-validation.md (lines 84-137):
//   - Plan asserts hash-route fetches return distinct bodies. Lexi's server is a
//     pure SPA shell: every non-/assets path responds with the same index.html.
//     Replaced the SECTIONS loop with a single SPA-shell smoke check.
//   - Plan asserts `data-action` verbs in main.js. Lexi components use Lit
//     `@click=` handlers, not `data-action`. Replaced with bundled-component
//     identifier checks (lexi-home-view, lexi-stuck-banner, etc.).
//   - Plan asserts a /api/settings POST/GET roundtrip. No such route exists;
//     Plan 7's lexi-settings-view persists theme to localStorage. Replaced
//     with a static check that the bundle wires localStorage + lexi-theme.
//   - Bundle reads use the on-disk dist build, not /assets/main.js. The Lexi
//     express server resolves its assets dir relative to __dirname, which under
//     vitest points to src/lexi-dashboard/ (uncompiled). Reading from
//     dist/lexi-dashboard/ui/main.js validates the actual shipped artifact.
describe('DoD 1-4 · links, buttons, forms', () => {
  let server: LexiServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it('SPA shell renders at / with non-empty HTML (DoD 1)', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body.length).toBeGreaterThan(100);
    expect(body).toContain('<lexi-app');
  });

  it('every <a href> on home page resolves to 200/304 (DoD 4)', async () => {
    const res = await fetch(`${baseUrl}/`);
    const html = await res.text();
    // Match <a href="…"> only — skip <link rel="stylesheet" href="…"> and other
    // non-anchor href attrs which point at build-time assets, not user navigation.
    const hrefs = Array.from(html.matchAll(/<a\s[^>]*href="([^"]+)"/gi)).map((m) => m[1]);
    const internal = hrefs.filter(
      (h) => (h.startsWith('/') || h.startsWith('#')) && !h.startsWith('//'),
    );
    for (const href of internal) {
      if (href.startsWith('#')) continue;
      const r = await fetch(new URL(href, baseUrl).toString());
      expect([200, 304], `link ${href}`).toContain(r.status);
    }
  });

  it('main.js bundle contains expected component identifiers (DoD 2)', () => {
    expect(
      existsSync(bundlePath),
      `dist bundle missing at ${bundlePath} — run \`npm run build:lexi\` first`,
    ).toBe(true);
    const js = readFileSync(bundlePath, 'utf8');
    for (const ident of [
      'lexi-today-view',
      'lexi-stuck-banner',
      'lexi-agents-view',
      'lexi-settings-view',
      'lexi-top-bar-v2',
      'lexi-nav-rail-v2',
      'lexi-notifications-drawer',
    ]) {
      expect(js, `bundle should reference ${ident}`).toContain(ident);
    }
  });

  it('settings persistence is wired through localStorage (DoD 3)', () => {
    expect(
      existsSync(bundlePath),
      `dist bundle missing at ${bundlePath} — run \`npm run build:lexi\` first`,
    ).toBe(true);
    const js = readFileSync(bundlePath, 'utf8');
    // Plan 7's settings-view persists theme + follow-system to localStorage.
    expect(js).toMatch(/localStorage[\.\[]/);
    expect(js).toMatch(/lexi-theme/);
  });
});
