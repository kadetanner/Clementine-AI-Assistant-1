# Spec 1 — Lexi Web Dashboard Polish (Heavy Bar)

**Date:** 2026-05-06
**Track:** 1 of the [Lexi vision roadmap](./2026-05-06-lexi-vision-roadmap.md)
**Estimated duration:** 3 weeks
**Status:** Design complete, ready for plan-writing

---

## §1 — Goals & Done Bar

**Goal**
Bring the Lexi web dashboard to "good fallback" quality across all routes before it's frozen for the SwiftUI rebuild. Every interactive element on every view does what a user expects. No broken styles, no dead buttons, no confusing states. Then freeze.

**Done bar — concrete, all six must hold:**

1. **Functional audit complete.** Every interactive element on every view (buttons, links, tabs, drawers, drop-downs, form fields, keyboard shortcuts, ⌘K palette items) has been tested manually against expected behavior. No "click does nothing" buttons. No 404s. No silently-failing actions. Anything broken is fixed.
2. **Visual audit complete.** No view has unstyled-component-collapse bugs (the agents-page issue we fixed on 2026-05-06 is the canonical example of what we are preventing). Every view renders cleanly at 1280×800 and 1440×900. No overflow into wrong containers, no zero-height collapsed children, no obviously broken spacing.
3. **Playwright E2E coverage.** Every view has at least three tests: route renders, primary action works, primary navigation works. Every drawer/modal has open + close + ESC. Every form has submit happy-path. Currently 46 E2E tests; target ~120.
4. **Accessibility / keyboard pass.** Every interactive element is reachable by keyboard (Tab cycle works correctly). Visible focus states. ⌘K palette has full keyboard nav. ARIA labels on icon-only buttons. Color contrast meets WCAG AA on the default theme. Not full a11y compliance — "navigable without a mouse and not actively hostile."
5. **Empty / error / loading states.** Every async view has an explicit empty state, an error state with a retry path, and a loading state that does not flash layout.
6. **Green CI.** All E2E + unit tests pass. Bundle stays under the 400KB threshold. No new console errors on any route.

**Out of scope (deferred or never)**

- Visual redesign or restyling — this is polish, not redesign.
- New features.
- Performance optimization beyond not regressing.
- Mobile / responsive layout — desktop sizes only.
- Internationalization.
- Dark mode polish beyond what already exists.
- Any change that affects the API surface, because the SwiftUI app will depend on it.

---

## §2 — Audit Methodology

The procedural backbone — how we systematically verify "every button works" without missing things or burning weeks on busywork.

### Audit unit: the view × interaction matrix

For each view, we produce a single audit row before any fixing happens. The audit row is a structured artifact (markdown table or YAML — final format chosen during plan-writing) with these columns:

| Field | Example |
|---|---|
| `view` | `lexi-agents-view` |
| `route` | `#/agents` |
| `interactions` | enumerated list of every clickable, focusable, or input element |
| `expected_behavior` | one line per interaction, e.g. "Restart button → POST /api/agents/:slug/restart, agent status flips to 'restarting' within 2s, log entry appended" |
| `current_status` | `works` / `broken` / `partial` / `unknown` |
| `evidence` | path to Playwright screenshot or short clip showing current behavior |
| `fix_required` | one-line description |
| `e2e_coverage` | `none` / `partial` / `full` |
| `a11y_status` | `pass` / `gap: <description>` |
| `empty_error_loading` | `pass` / `gap: <description>` |

The audit rows together form the master audit document, committed to the repo at `docs/audit/2026-05-web-polish-audit.md`. This is the source of truth for what's done, what's not, and what's been deferred.

### Audit phases per view, in order

1. **Inventory pass** *(automated where possible).* Run a script over each view's `.ts` source to enumerate every `@click`, `@input`, `@change`, `<a>`, `<button>`, `[data-action]`, and form element. Output is a draft interactions list. Manual sweep adds anything missed (keyboard shortcuts, drag/drop, etc.).
2. **Behavior pass** *(manual + Playwright).* For each interaction, document expected behavior in one line. Click it in a real browser. Record actual result. Mark status. This is the "find what's broken" phase.
3. **Visual pass** *(Playwright screenshot diff).* Capture each view at both viewport sizes. Visual review — flag anything obviously broken. Compare against canonical "this looks right" baseline screenshots committed to repo.
4. **A11y pass.** Run `axe-playwright` against the route. Manual keyboard-only Tab traversal. Note gaps.
5. **State pass.** Force the view into empty / error / loading states via mocked endpoints. Document gaps.

### Fix phase happens after audit is complete

Auditing every view first (not "audit-then-fix-this-view-then-audit-next") is deliberate:

- It gives us a complete picture of total work before committing to a sequence.
- It prevents "I'll just fix this one quick thing" rabbit holes during audit.
- It lets us batch similar fixes across views (the unstyled-component bug on agents-view was a CSS pattern that affected multiple views — global fix, not per-view).

### Tooling

- Playwright already exists for E2E. Reuse the test harness.
- Add `axe-playwright` for a11y checks.
- Small node script to enumerate interactions from `.ts` source — written during plan execution.
- Manual browser session for behavior verification (no way around this — automation can't tell if the *intent* of a button matches its behavior).

### Why this structure

Heavy polish without methodology turns into a 3-week vibes session that misses things. The audit-row-per-view structure forces concrete claims (the Restart button on agents view actually works is a documented assertion, not an assumption) and gives us a paper trail for the freeze decision.

---

## §3 — Scope: views in the audit

Every route currently mounted by the dashboard SPA shell. As of 2026-05-06 there are **24 user-facing views** (the internal `lexi-phase-pending-view` is excluded — `PHASE_PENDING_SECTIONS` is empty per Phase 27 closure).

Note: `lexi-app.ts` resolves both `#/home` and `#/today` to `lexi-today-view`. The file `src/lexi-dashboard/ui/components/lexi-home-view.ts` is registered as a custom element but never mounted by the router or any other component — likely dead code. The audit will flag it; the fix decision (delete vs. wire up vs. leave) belongs in Week 2.

**Components-tree views** (`src/lexi-dashboard/ui/components/`):

| Route | Component file |
|---|---|
| `#/agents` | `lexi-agents-view.ts` |
| `#/connections` | `connections/lexi-connections-view.ts` |
| `#/cron` | `lexi-cron-view.ts` |
| `#/memory` | `lexi-memory-view.ts` |
| `#/settings` | `lexi-settings-view.ts` |
| `#/vault` | `lexi-vault-view.ts` |
| `#/workflows` | `workflows/lexi-workflows-view.ts` |

**Views-tree views** (`src/lexi-dashboard/ui/views/`):

| Route | Component file |
|---|---|
| `#/advisor` | `lexi-advisor-view.ts` |
| `#/approvals` | `lexi-approvals-view.ts` |
| `#/brain` | `lexi-brain-view.ts` |
| `#/budget` | `lexi-budget-view.ts` |
| `#/build` | `lexi-build-view.ts` |
| `#/chat` | `lexi-chat-view.ts` |
| `#/claims` | `lexi-claims-view.ts` |
| `#/heartbeat` | `lexi-heartbeat-view.ts` |
| `#/logs` | `lexi-logs-view.ts` |
| `#/plans` | `lexi-plans-view.ts` |
| `#/projects` | `lexi-projects-view.ts` |
| `#/routines` | `lexi-routines-view.ts` |
| `#/search` | `lexi-search-view.ts` |
| `#/skills` | `lexi-skills-view.ts` |
| `#/team` | `lexi-team-view.ts` |
| `#/today` | `lexi-today-view.ts` |
| `#/trace` | `lexi-trace-view.ts` |

**Shell components also in scope** (cross-cutting; exercised on every view):

- `lexi-app.ts` — SPA router + view mount logic
- `lexi-top-bar.ts` — search, indicators, theme toggle, settings link
- `lexi-nav-rail.ts` — primary navigation
- `lexi-right-rail.ts` — sidebar widgets
- `lexi-bottom-drawer.ts` — notifications drawer
- `lexi-system-map-drawer.ts` + `lexi-system-map-strip.ts` — system map
- `lexi-command-palette.ts` — ⌘K palette
- `lexi-now-playing.ts` — running-job indicator
- `lexi-stuck-banner.ts` — broken-job banner
- `lexi-onboarding-tour.ts` — first-run tour
- `lexi-prompt-editor.ts` — used inside agents view; **known broken in screenshot from 2026-05-06**, see §7
- `lexi-tool-toggle-list.ts`, `lexi-credential-editor.ts`, `lexi-mcp-server-card.ts`, `lexi-oauth-status.ts`, `lexi-step-recovery-panel.ts`, `lexi-doctor-panel.ts`, `lexi-theme-toggle.ts`, `lexi-activity-stream.ts` — embedded primitives
- `lexi-workflow-builder.ts`, `lexi-workflow-detail.ts`, `lexi-workflow-runs.ts` — workflow detail surfaces

**Total audit footprint:** 25 routes × shell components.

---

## §4 — Component & file inventory

What gets touched, where things live.

### New artifacts

| Path | Purpose |
|---|---|
| `docs/audit/2026-05-web-polish-audit.md` | Master audit document (one row per view, see §2). Source of truth for done/not-done. |
| `scripts/audit/inventory-interactions.ts` | Enumerate interactive elements from a view's `.ts` source. Outputs draft interaction lists. |
| `tests/e2e/views/<view>.spec.ts` | One Playwright spec file per view. Many already exist; this fills gaps. |
| `tests/e2e/a11y/<view>.spec.ts` | One axe-playwright spec per view. New addition. |
| `tests/visual-baselines/<view>-{1280,1440}.png` | Committed baseline screenshots for visual diffing. |
| `tests/e2e/states/<view>-states.spec.ts` | Empty / error / loading state coverage per view. |

### Modified artifacts (likely set; final list emerges from audit)

| Path | Why |
|---|---|
| `src/lexi-dashboard/ui/components/lexi-prompt-editor.ts` | **Known broken** — 57 lines, no styles, `createRenderRoot()` returns `this` but never adds an inline `<style>` block, so the page inherits no layout. Visible in 2026-05-06 screenshot. |
| `src/lexi-dashboard/ui/components/lexi-app.ts` | Possible additions to view-cleanup lifecycle if audit reveals further routing edge cases. |
| `src/lexi-dashboard/ui/shell-v2.css` | Global rules for view custom-element display, focus rings, contrast tweaks. |
| Each `lexi-*-view.ts` | Inline `<style>` blocks expanded as needed; empty/error/loading states added; ARIA labels added; keyboard shortcuts wired. |
| `package.json` | Add `axe-playwright` dev dependency. |
| `playwright.config.ts` | Register new spec directories; ensure both viewport sizes are exercised. |
| `tests/e2e/bundle-size.spec.ts` (or equivalent) | Reaffirm 400KB threshold. |

### Unchanged on purpose

- All `src/lexi-dashboard/server.ts`, `routes.ts`, route handlers, and `services/` code. **API surface frozen** — Track 2 depends on it.
- `src/desktop/main.ts` and the existing Electron scaffold. Not part of this track.
- All non-`lexi-*` code (the broader Clementine fork's agent runtime, MCP servers, etc.).

---

## §5 — Testing strategy

### Layers

1. **Unit tests** — 370 currently passing, ~5 expected additions for any new utility code (e.g., the inventory script).
2. **Playwright E2E** — currently 46, target ~120.
   - 3 baseline tests per view × 25 views = 75
   - +20 cross-cutting (drawer open/close, ⌘K palette, navigation cycle, system-map, theme toggle)
   - +20 state coverage (empty/error/loading per view that has async data)
3. **A11y (axe-playwright)** — 25 routes × 1 spec = 25 specs. Fail on serious or critical violations.
4. **Visual diff** — 25 views × 2 viewports = 50 baseline screenshots. Diff threshold tuned to catch layout collapse without choking on font hinting.
5. **Bundle size** — existing 400KB gate stays.

### CI gate

All five layers must be green before merge to `lexi-dashboard` branch. Audit document must be all-green for the freeze commit.

### What we explicitly do not test

- Backend correctness — the API surface is frozen, and the existing dashboard already exercises it.
- Cross-browser — Playwright runs Chromium-only. Track 2 retires the web dashboard, so cross-browser hardening is not worth the cost.
- Mobile viewports — out of scope (see §1).

### Where automation can't reach

The "click this and see if it does what a human expects" check is unavoidable manual work. The audit methodology in §2 is structured so this manual time is short and bounded: one focused browser session per view, ~20-30 minutes, recorded in the audit document.

---

## §6 — Phasing

3 calendar weeks, structured as four phases. The audit-everything-first ordering (§2) is the load-bearing structural choice.

### Week 1 — Audit (days 1-5)

- **Day 1:** Build `scripts/audit/inventory-interactions.ts`. Run it across all 25 views. Hand-correct output. Initialize the master audit document with one row per view, interactions filled in.
- **Days 2-4:** Behavior pass. One ~20-30 min focused browser session per view. Document expected vs. actual. Mark current_status. ~6 views per day → 18 in three days. Wrap any spillover on day 5.
- **Day 5:** Visual pass + a11y pass + state pass. These are faster (mostly automated). Audit document is fully populated and committed.

### Week 2 — Fix (days 6-10)

- **Days 6-8:** Walk down the audit document. Group fixes by category (broken styles, dead buttons, missing states, a11y gaps). Batch similar fixes. Per known-broken: prompt editor styles (high priority — visible to user), any additional unstyled components surfaced during audit.
- **Days 9-10:** Re-run audit on every view that had a fix. Update audit document. Carry over anything still not green.

### Week 3 — Test build-out + freeze (days 11-15)

- **Days 11-13:** Author the new Playwright tests, axe-playwright specs, visual baselines, and state coverage specs. Target ~120 E2E + 25 a11y + 50 visual baselines.
- **Day 14:** CI green run. Audit document final pass — every row marked all-green or explicitly deferred-with-justification.
- **Day 15:** Freeze commit. Tag `web-frozen-2026-05-XX`. Open the door for Spec 2 (repo migration).

### Buffer

If Week 1's audit reveals more broken than expected, Week 2 can extend by 2-3 days at the cost of Week 3's headroom. Hard ceiling: 3.5 weeks. If we exceed that, escalate — most likely cause is a single view (e.g., chat or workflows) being significantly worse than the others, in which case scope-cutting that view to "freeze-as-is, deferred to Spec 2 audit" is the right call.

---

## §7 — Known issues to fix

These were already surfaced in the user's 2026-05-06 message; they're entered here so they're not lost in the audit-document churn.

1. **`lexi-prompt-editor.ts` is unstyled.** 57 lines of TypeScript, no inline `<style>` block, `createRenderRoot()` returns `this`. The textarea, label, and buttons all inherit zero layout, producing the cramped/ugly box in the 2026-05-06 screenshot. Fix: add inline `<style>` block with the same pattern used in `lexi-cron-view`/`lexi-agents-view` (toolbar with label + dirty indicator + Cancel/Save buttons; full-width textarea with monospace font, min-height ~280px, resize: vertical, proper padding). Visual target: matches the spacing density of the rest of the agents detail panel.

2. **Bottom drawer notifications integration.** Memory observation #9707 noted "stuck-cron integration with API mismatch." Audit must confirm this still works after the 2026-05-06 fix; if not, fix.

3. **View-stacking edge cases.** Memory observations #9708-#9730 document the route-accumulation work. The fix is in place (imperative view mounting in `lexi-app.ts`); audit must include explicit Playwright coverage of the 24-route tour to lock the regression.

4. **Connections-view inline styles.** Memory observation #9751 noted connections-view uses inline `style=""` attributes rather than a `<style>` block. Functionally fine after the global display:block fix, but inconsistent with the rest of the codebase. Fix: convert to inline `<style>` block matching the pattern of every other view.

---

## §8 — Risks & open questions

### Risks

- **Audit reveals more broken than 3 weeks accommodates.** Mitigation: Week 1 is timeboxed; if behavior pass alone exceeds 5 days, raise scope-cut conversation immediately rather than letting it consume Week 2.
- **Manual behavior pass is the bottleneck.** ~25 views × 25 minutes is ~10 hours of focused clicking. Real-world calendar friction will stretch this. Mitigation: schedule it as 6 views/day with a hard daily stop.
- **Visual diff false positives.** Font hinting and subpixel rendering vary. Mitigation: tune Playwright `expect.toHaveScreenshot` `maxDiffPixelRatio` and threshold conservatively; review and accept new baselines liberally during this track.
- **A11y rabbit hole.** Real WCAG AA compliance is a multi-week project on its own. Mitigation: explicitly bounded to "navigable without a mouse and not actively hostile" — axe `serious` and `critical` violations only; lower severities tracked but not blocking.

### Open questions (resolved during plan-writing, not now)

- Final format of the audit document (markdown table vs. YAML vs. tool-readable JSON) — affects whether we can automate progress reporting.
- Whether to add a screenshot regression CI step or leave visual diff as a local-only check (CI cost vs. catch rate).
- Whether the `inventory-interactions.ts` script should be one-shot (ad-hoc tool) or kept maintained for future audits — leaning one-shot.
- Specific list of `aria-label`s needed for icon-only buttons — emerges during the a11y pass.

### Non-questions (already decided)

- Bar height: **Heavy** (full audit + Playwright + a11y).
- API surface: frozen.
- Visual redesign: out of scope.
- Track 2 coordination: Spec 1 ends with a freeze tag; Spec 2 starts after.
