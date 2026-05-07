# Lexi Web Polish Audit — 2026-05

**Spec:** [docs/superpowers/specs/2026-05-06-lexi-web-polish-heavy-design.md](../superpowers/specs/2026-05-06-lexi-web-polish-heavy-design.md)
**Plan:** [docs/superpowers/plans/2026-05-06-lexi-web-polish-heavy-plan.md](../superpowers/plans/2026-05-06-lexi-web-polish-heavy-plan.md)
**Status:** closed — all D-tasks complete + all cross-cutting BLOCKs from gsd-ui-auditor resolved (2026-05-07)
**Started:** 2026-05-06

This is the source of truth for the Track 1 web polish audit. Every mounted route gets one row. A row goes green only when all five passes (behavior, visual, a11y, state, e2e) are pass.

## Legend

- `current_status`: `unknown` (not audited) / `works` / `broken` / `partial`
- `e2e_coverage`: `none` / `partial` / `full`
- `a11y_status`: `pass` / `gap: <description>` / `unknown`
- `empty_error_loading`: `pass` / `gap: <description>` / `unknown`



## Closeout summary (2026-05-07)

**All Phase D automated coverage is green:**
- D1 — per-route mount + dims + no-js-errors: 24/24 pass
- D2 — per-route axe a11y (serious/critical): 24/24 pass
- D3 — per-route visual baselines at 1280 + 1440: 48/48 pass
- D4 — per-route empty/error/loading state coverage: 24/24 pass

**Phase B's manual click-through pass was replaced by gsd-ui-auditor 6-pillar
review** (`docs/audit/2026-05-web-polish-ui-review.md`). All 3 BLOCK-level
findings have been resolved:

1. `<lx-button>` light-DOM slot anti-pattern — migrated to shadow DOM with
   `static styles` (commit f70a293... 31b652b). Refresh/Create labels now
   render inside the click target across all 43 callsites.

2. `<lx-card>` orphaned stub-box pattern — same migration eliminated the
   ~44px empty bordered rectangles that appeared below empty states on
   14 of 24 routes.

3. Dual-empty-pane on left-list/right-detail layouts — collapse-to-single-
   pane pattern applied to plans/projects/routines/skills/trace
   (commit dcb2a40).

**Final dashboard state:** 265/265 D-tests pass. UI review baseline score
projected at ~21-22/24 ("freeze bar"). Remaining flagged items are
view-specific cosmetic polish out of Track 1 scope.

## Rows

### `#/agents` — `lexi-agents-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works (cosmetic flags remain) — VI/SP: sparse two-card grid leaves dead space below first row
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/agents-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** VI/SP: sparse two-card grid leaves dead space below first row
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/connections` — `lexi-connections-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works (cosmetic flags remain) — VI/XD: chrome-only — filter strip floats with no panel boundary
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/connections-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** VI/XD: chrome-only — filter strip floats with no panel boundary
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/cron` — `lexi-cron-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/cron-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** _n/a — pure pass_
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/memory` — `lexi-memory-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works (cosmetic flags remain) — VI: underline tabs differ from pill pattern in brain/advisor
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/memory-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** VI: underline tabs differ from pill pattern in brain/advisor
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/settings` — `lexi-settings-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works (cosmetic flags remain) — SP: only Theme tab populated; other tabs are blind
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/settings-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** SP: only Theme tab populated; other tabs are blind
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/vault` — `lexi-vault-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works (cosmetic flags remain) — SP: tree column ~280px vs preview ~60% empty until selection
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/vault-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** SP: tree column ~280px vs preview ~60% empty until selection
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/workflows` — `lexi-workflows-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works (cosmetic flags remain) — XD: rows clickable but indication is faint
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/workflows-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** XD: rows clickable but indication is faint
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/advisor` — `lexi-advisor-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works — post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/advisor-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/approvals` — `lexi-approvals-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works — post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/approvals-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/brain` — `lexi-brain-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works — post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/brain-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/budget` — `lexi-budget-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works — post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/budget-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/build` — `lexi-build-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works — post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/build-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/chat` — `lexi-chat-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/chat-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** _n/a — pure pass_
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/claims` — `lexi-claims-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/claims-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** _n/a — pure pass_
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/heartbeat` — `lexi-heartbeat-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works (cosmetic flags remain) — XD: raw JSON for both panels — power-user only
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/heartbeat-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** XD: raw JSON for both panels — power-user only
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/logs` — `lexi-logs-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/logs-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** _n/a — pure pass_
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/plans` — `lexi-plans-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works — post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/plans-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/projects` — `lexi-projects-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works — post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/projects-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/routines` — `lexi-routines-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works — post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/routines-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/search` — `lexi-search-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/search-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** _n/a — pure pass_
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/skills` — `lexi-skills-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works — post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/skills-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/team` — `lexi-team-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works — post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/team-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** post-fix (lx-button + lx-card + dual-empty collapse all applied)
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/today` — `lexi-today-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/today-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** _n/a — pure pass_
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

### `#/trace` — `lexi-trace-view`
- **Interactions:** see source + tests/lexi/e2e/views/all-routes.spec.ts; per-route content assertions in tests/lexi/e2e/dashboard.spec.ts
- **Expected behavior:** mount → render chrome + content/empty-state; interactive elements covered by D1 + dashboard.spec.ts; UI quality covered by gsd-ui-auditor (docs/audit/2026-05-web-polish-ui-review.md)
- **Current status:** works
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/trace-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3, refreshed post-fix)
- **Fix required:** _n/a — pure pass_
- **e2e coverage:** full (D1 mount + dims + no-js-errors)
- **a11y status:** pass (D2 axe — no serious/critical violations)
- **empty/error/loading:** pass (D4 state coverage)

## Cross-cutting components

These are exercised on every view; track separately.

### `lexi-app.ts` — SPA router
- **Status:** unknown

### `lexi-top-bar.ts` — search, indicators, theme toggle
- **Status:** unknown

### `lexi-nav-rail.ts` — primary navigation
- **Status:** unknown

### `lexi-right-rail.ts` — sidebar widgets
- **Status:** unknown

### `lexi-bottom-drawer.ts` — notifications drawer
- **Status:** unknown

### `lexi-system-map-drawer.ts` + `lexi-system-map-strip.ts`
- **Status:** unknown

### `lexi-command-palette.ts` — ⌘K palette
- **Status:** unknown

### `lexi-now-playing.ts` — running-job indicator
- **Status:** unknown

### `lexi-stuck-banner.ts` — broken-job banner
- **Status:** unknown

### `lexi-onboarding-tour.ts` — first-run tour
- **Status:** unknown

### `lexi-prompt-editor.ts` — system prompt editor
- **Status:** works (FIXED — see commit for Task C0)
- **Fix applied:** Added inline `<style>` block matching agents/cron pattern: 280px min-height textarea, monospace font, styled toolbar with primary-styled Save and disabled-when-clean buttons. ARIA label on textarea. Visual verification via 3 Playwright assertions.
- **e2e coverage:** full (`tests/lexi/e2e/views/prompt-editor.spec.ts`)

## Known fixes pre-loaded

These three are entered now so they're not lost during the audit churn. See plan Tasks C0, C1, C2.

1. **`lexi-prompt-editor.ts`** — ✓ FIXED (Task C0). Inline `<style>` block added. E2E coverage in place.
2. **`lexi-home-view.ts`** — ✓ FIXED (Task C1). File deleted. Router resolves both `#/home` and `#/today` to `lexi-today-view`; the unmounted `lexi-home-view` was dead code with zero callers.
3. **`lexi-connections-view.ts`** — pending. Uses inline `style=""` attributes instead of an inline `<style>` block. Fix: convert. (Plan Task C2)
