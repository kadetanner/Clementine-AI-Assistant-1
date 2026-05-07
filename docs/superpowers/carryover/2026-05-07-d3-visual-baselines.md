# Carryover — Task D3 (Visual Baselines, Lexi Web Polish Spec 1)

**Prepared:** 2026-05-07
**For:** A fresh Claude Code session picking up Task D3 of the Lexi web polish plan.
**Branch to work on:** `lexi-dashboard` (in `~/projects/clementine-fork/`)
**Plan:** [`docs/superpowers/plans/2026-05-06-lexi-web-polish-heavy-plan.md`](../plans/2026-05-06-lexi-web-polish-heavy-plan.md), see "Task D3"
**Spec:** [`docs/superpowers/specs/2026-05-06-lexi-web-polish-heavy-design.md`](../specs/2026-05-06-lexi-web-polish-heavy-design.md), §5 (Testing strategy)
**Vision umbrella:** [`docs/superpowers/specs/2026-05-06-lexi-vision-roadmap.md`](../specs/2026-05-06-lexi-vision-roadmap.md)

---

## TL;DR for the next session

Generate per-route visual baselines at two viewports, commit the snapshot PNGs, manually review each one, then re-run to confirm the suite passes against the just-captured baselines. ~48 PNGs total. The whole task is ~30-60 min of Claude time + ~30 min of human visual review.

This was deferred during the original execution session because:
1. Snapshot files add weight to the repo (~3-5 MB total)
2. The "is this baseline correct?" judgment is fundamentally human; automation can capture but not validate

If you (the future Claude) are running this without your human partner present to review, **stop after capture and ask them to review the snapshots before declaring D3 done**.

---

## Context — what's already in place

### Repo state at carryover time

- Branch `lexi-dashboard` head is `57435cb`, fully pushed to `origin/lexi-dashboard` on `kadetanner/Clementine-AI-Assistant-1`.
- E2E suite is at 217/217 passing.
- Phase A (A0–A3), Phase C (C0, C1, C2, C-globals, four a11y fixes, two D-surfaced bug fixes), Phase D1 (per-route baseline), D2 (axe a11y), D4 (state coverage) are **complete**. D3 is the only remaining D-task.

### Files already created — DO NOT recreate

- `tests/lexi/e2e/helpers/route-list.ts` — exports `LEXI_ROUTES`, the canonical 24-route array. **Import from this** for the visual spec.
- `tests/lexi/e2e/views/all-routes.spec.ts` — D1 baseline (mount/dims/no-js-errors)
- `tests/lexi/e2e/a11y/all-routes.spec.ts` — D2 a11y
- `tests/lexi/e2e/states/all-routes.spec.ts` — D4 state coverage
- `tests/lexi/e2e/playwright.config.ts` — already configured, baseURL `http://localhost:3030`, single-worker sequential, viewport defaults to `1440×900`
- `docs/audit/2026-05-web-polish-audit.md` — master audit doc, update the `evidence` field per route as you go

### Pre-flight verification

The dashboard launchd agent runs the dashboard on port 3030. Before starting:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3030/health
```

Expected: `200`. If not, tests will skip (the test harness already handles this gracefully via `test.skip`).

If the dashboard is down, kick it via launchd:

```bash
launchctl kickstart -k "gui/$UID/com.kadetanner.archon.web"
```

(Wait — that's the wrong service. The Lexi dashboard runs from this fork's launchd plist; check `~/Library/LaunchAgents/` for `com.clem.*` entries. As of 2026-05-06 the dashboard was confirmed live at :3030 from this branch.)

---

## What you need to build

### 1. The visual spec file

**Create:** `tests/lexi/e2e/visual/all-routes.spec.ts`

Use this exact content (matches the plan, with the same `addInitScript` tour-suppression pattern that all the other D-specs use):

```ts
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
```

**Why these specific values:**
- `maxDiffPixelRatio: 0.02` — 2% pixel diff tolerance accommodates font hinting and subpixel rendering across runs without missing real layout breakage
- `animations: 'disabled'` — prevents animation mid-frame from being captured
- `waitForTimeout(800)` — most async views complete their initial fetch in ≤500ms; 800 gives headroom
- `fullPage: false` — captures the viewport only, since we're testing chrome + above-the-fold layout, not infinite-scroll content

### 2. Generate the baselines

```bash
cd ~/projects/clementine-fork
npm run test:e2e -- tests/lexi/e2e/visual/all-routes.spec.ts --update-snapshots
```

This writes 48 PNGs to `tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/`. The first run always "fails" all 48 tests (Playwright reports baselines being newly written as failures, even though they're correct).

### 3. Manually review each snapshot — REQUIRED HUMAN STEP

For each PNG:
1. Open it (Finder, VS Code preview, or `open <path>`)
2. Confirm:
   - The view is rendered (not blank, not collapsed to zero height)
   - Layout looks intentional — no overflow, no zero-height children, no broken stacking
   - Component is visible above the fold; no obviously wrong cropping

If a snapshot looks wrong: **don't accept the baseline**. Investigate the underlying view, file as a Phase C-loop fix task, fix it, re-run with `--update-snapshots` again.

If running without the human present, list the snapshots and ask them to review before continuing.

### 4. Confirm clean baseline by re-running

After all 48 snapshots are accepted:

```bash
npm run test:e2e -- tests/lexi/e2e/visual/all-routes.spec.ts
```

Expected: 48/48 pass.

### 5. Update the audit doc

In `docs/audit/2026-05-web-polish-audit.md`, for each of the 24 routes, update the row's `evidence` field:

```
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/<route>-1440.png
```

This closes the "evidence" column from the audit methodology in §2 of the spec.

### 6. Commit

```bash
git add tests/lexi/e2e/visual/all-routes.spec.ts \
        tests/lexi/e2e/visual/all-routes.spec.ts-snapshots \
        docs/audit/2026-05-web-polish-audit.md

git commit -m "test(lexi): visual baselines for 24 routes at 1280 + 1440

Captures and commits 48 baseline screenshots (24 routes x 2 viewports).
Uses 2% maxDiffPixelRatio to absorb font hinting variance, animations
disabled at capture time, 800ms settle to let async data render.

After capture each baseline was visually reviewed against the
'this looks intentional' bar from spec section 5. <Add 1-2 sentences
on what stood out, e.g.: All 24 routes captured cleanly. Audit doc
evidence field populated for each route.>

Plan task: D3
48/48 visual diff tests pass against the just-captured baselines.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin lexi-dashboard
```

### 7. Mark D3 complete and update the plan tracking

In whatever task-tracking surface you're using, mark D3 done. If you're using `TaskCreate`/`TaskUpdate`, mark task D3 (was previously deferred — re-create as in-progress at session start, then completed).

---

## Gotchas you might hit

### Playwright reports first run as failed

This is normal. `--update-snapshots` *generates* the baselines; without that flag a run with no baselines fails because there's nothing to diff against. After the first `--update-snapshots` run, subsequent runs without that flag will pass.

### Routes with live data that animates between runs

A few routes have surfaces whose content changes each time:
- `#/heartbeat` — shows live timestamps
- `#/today` — agent activity counters
- `#/trace` — run timestamps
- `#/cron` — "last fired" relative times

The 2% pixel tolerance (`maxDiffPixelRatio: 0.02`) should absorb single-line timestamp changes. If it doesn't, you have two options:
1. Bump the tolerance for these specific routes (per-test override)
2. Mock the relevant API endpoints to return deterministic timestamps before capture

Option 1 is simpler. Option 2 is more correct. Use 1 unless tolerance creep starts hiding real bugs.

### Font hinting differences if running on a different machine

The baselines you capture are tied to the rendering output of the machine that captured them. If anyone else (or CI) runs the suite on a different OS / Chromium build, font subpixel rendering will diff. Two options:
1. Document the capture machine in the commit message (so reviewers know to re-baseline if they're on a different machine)
2. Run inside a Docker container with a pinned Chromium for deterministic rendering

For Track 1 (web freeze), option 1 is fine — the dashboard is about to be frozen anyway and only Kade runs the suite.

### Onboarding tour modal

The `addInitScript` block in the spec template suppresses it. Don't remove that line. If you see a `<lexi-onboarding-tour>` backdrop in any snapshot, the localStorage suppression isn't running early enough. The fix is what's in the spec already — `addInitScript` runs before any page script.

### Bundle size threshold

Adding the snapshot directory shouldn't affect the bundle size test (which measures `dist/lexi-dashboard/ui/main.js`). But if any of your screenshot reviews surface a layout bug that requires a CSS fix, the bundle could grow past 400KB. Current size is 252.0KB so there's headroom.

---

## Decision points where you might need to ask

If a baseline shows a view rendering correctly but with content you weren't expecting (e.g., real agent data leaks through), ask before committing — Kade may want a sanitized baseline.

If you find a real visual bug during baseline review (a view collapsed, broken layout), file it as a C-loop fix task and resolve it BEFORE re-baselining. Do not commit broken baselines.

If 1-2 routes' baselines genuinely cannot be made stable (live data, animations) even with mocking, ask whether to skip those specific routes or invest in deterministic mocking. The plan's bar is "every route covered"; the practical reality may be "22 covered, 2 skipped with justification."

---

## After D3 lands

The remaining work in Spec 1:

1. **Phase B manual behavior pass** (B1-B25) — the human-judgment "click every button, verify intent matches behavior" pass. Most rough edges have already been surfaced by D1/D2/D4 automated tests + audited fixes. Remaining is the bar that automation can't reach.
2. **Phase E1** — final audit doc green pass; every row marked all-green or explicitly deferred-with-justification.
3. **Phase E2** — `web-frozen-2026-05-XX` git tag, push tag, update `2026-05-06-lexi-vision-roadmap.md` Track 2A status from "TBD" to "Ready to design".

Then Spec 2A gets written (repo migration to `lexi/` monorepo) and the SwiftUI work begins per the vision roadmap.

---

## Quick context-recall checklist

Before you start, confirm you can answer:

- [ ] What does the Lexi vision roadmap say macOS replaces? *(answer: pipelinepulse iOS RevOps surfaces — Lexi-Mac absorbs them; iOS pipelinepulse becomes Live-Activities-only)*
- [ ] Why is web polish "Heavy bar" being done if the web dashboard is going to be frozen? *(answer: web becomes the "good fallback" surface in the Approach 3 transition; it gets polished, then frozen, then SwiftUI replaces it as primary)*
- [ ] What was the user's specific 2026-05-06 screenshot pain? *(answer: cramped/unstyled prompt editor on the agents page — fixed in commit `40f75c4`)*
- [ ] What's the target test count for this spec? *(answer: ~120 E2E was the conservative target; we're at 217 after D1+D2+D4. D3 adds 48 visual diff tests, bringing it to ~265.)*

If you can't answer all four, re-read the vision roadmap + spec before starting D3.
