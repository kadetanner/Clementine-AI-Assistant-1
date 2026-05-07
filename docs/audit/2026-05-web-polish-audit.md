# Lexi Web Polish Audit — 2026-05

**Spec:** [docs/superpowers/specs/2026-05-06-lexi-web-polish-heavy-design.md](../superpowers/specs/2026-05-06-lexi-web-polish-heavy-design.md)
**Plan:** [docs/superpowers/plans/2026-05-06-lexi-web-polish-heavy-plan.md](../superpowers/plans/2026-05-06-lexi-web-polish-heavy-plan.md)
**Status:** in progress
**Started:** 2026-05-06

This is the source of truth for the Track 1 web polish audit. Every mounted route gets one row. A row goes green only when all five passes (behavior, visual, a11y, state, e2e) are pass.

## Legend

- `current_status`: `unknown` (not audited) / `works` / `broken` / `partial`
- `e2e_coverage`: `none` / `partial` / `full`
- `a11y_status`: `pass` / `gap: <description>` / `unknown`
- `empty_error_loading`: `pass` / `gap: <description>` / `unknown`

## Rows

### `#/agents` — `lexi-agents-view`
- **Interactions:** _populated by Task B1_
- **Expected behavior:** _populated by Task B1_
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/agents-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:** _populated if status != works_
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/connections` — `lexi-connections-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/connections-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/cron` — `lexi-cron-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/cron-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/memory` — `lexi-memory-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/memory-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/settings` — `lexi-settings-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/settings-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/vault` — `lexi-vault-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/vault-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/workflows` — `lexi-workflows-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/workflows-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/advisor` — `lexi-advisor-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/advisor-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/approvals` — `lexi-approvals-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/approvals-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/brain` — `lexi-brain-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/brain-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/budget` — `lexi-budget-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/budget-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/build` — `lexi-build-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/build-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/chat` — `lexi-chat-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/chat-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/claims` — `lexi-claims-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/claims-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/heartbeat` — `lexi-heartbeat-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/heartbeat-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/logs` — `lexi-logs-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/logs-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/plans` — `lexi-plans-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/plans-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/projects` — `lexi-projects-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/projects-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/routines` — `lexi-routines-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/routines-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/search` — `lexi-search-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/search-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/skills` — `lexi-skills-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/skills-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/team` — `lexi-team-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/team-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/today` — `lexi-today-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/today-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/trace` — `lexi-trace-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:** tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/trace-1440-chromium-darwin.png (also -1280) — captured 2026-05-07 (D3)
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

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
