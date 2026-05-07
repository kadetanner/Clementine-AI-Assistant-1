# Lexi Web Dashboard — UI Polish Review (Web Freeze)

**Reviewed:** 2026-05-07
**Baseline:** 24 mounted routes × 1440-viewport committed Playwright snapshots (`tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/`).
**Tech stack:** Lit web components, TypeScript, inline `<style>` blocks, design tokens at `src/lexi-dashboard/ui/design/tokens.css`.
**Already verified by automation:** D1 mount + dims (24/24), D2 axe a11y (24/24), D3 visual baselines (48/48), D4 empty/error/loading (24/24).
**Scope of this review:** "Is it modern and useful" subjective polish — not contract conformance, not test gaps.

---

## Pillar Scores

| Pillar | Score | One-line justification |
|---|---|---|
| 1. Copywriting | **3 / 4** | Headers, descriptions and empty states are intentional and human; some technical leakage (`/api/lexi-chat/_invariants`, raw JSON bodies) is fine for a power-user surface. |
| 2. Visuals | **2 / 4** | Cron and Today are clean; ~10 views are dragged down by a globally-broken `<lx-button>` primitive that renders Refresh/Create as label-floating-next-to-empty-rectangle, plus orphaned empty bordered "stub" boxes below empty states across at least 12 views. |
| 3. Color | **3 / 4** | Cyan accent restraint is correct (light theme `#0891b2`, only on icons + active state + primary buttons). Semantic red used appropriately on Cron broken-jobs callout. No accent overuse. |
| 4. Typography | **3 / 4** | Type scale respected (Inter sans + JetBrains Mono for cron expressions / IDs). Header/sub-header pattern consistent across views. Light usage of caps-tracked section labels (TODAY, USAGE, MEMBERS) reads well. |
| 5. Spacing | **2 / 4** | Sidebar + top bar density is fine. Inside views, vertical rhythm collapses on multi-section views (Plans, Team, Heartbeat) — sections stack with inconsistent gaps and the empty stub boxes leave dead air. |
| 6. Experience Design | **3 / 4** | D4 confirms every view has empty/loading/error coverage. Strong empty-state illustrations + microcopy on most views. Loses a point because the Refresh primitive is non-discoverable (looks broken, not clickable) and several views split a single concept across two visually-equal columns with no obvious primary path (Plans, Skills, Routines, Projects). |

**Overall: 16 / 24** — "decent fallback, two cross-cutting bugs away from good."

---

## Triage Table — 24 routes × 6 pillars

Legend: `pass` / `flag: <issue>` / `BLOCK: <issue>`. Pillar codes: **CW** copywriting, **VI** visuals, **CO** color, **TY** typography, **SP** spacing, **XD** experience design.

| Route | CW | VI | CO | TY | SP | XD |
|---|---|---|---|---|---|---|
| agents | pass | flag: 70% empty right pane on first load, agent cards overflow into sparse grid | pass | pass | flag: agents card has dead space below the two rows | pass |
| connections | pass | flag: chrome-only (filter pills + empty state), no surface affordance | pass | pass | flag: filter strip floats with no panel boundary | flag: "Probe all" + status-empty hint look like leftovers, not a CTA path |
| cron | pass | pass | pass | pass | pass | pass |
| memory | pass | flag: tab style differs from brain/advisor (underline vs pill) | pass | pass | flag: KPI cards stop at 5 columns, leaves ~30% empty bottom | flag: tabs read-only — no action surface |
| settings | pass | flag: only Theme tab populated; Auth/Tokens/Secrets/Advanced are blind tabs | pass | pass | flag: huge empty bottom — Theme tab content fits in ~120px | pass |
| vault | pass | flag: file tree + huge empty preview; no CTA when nothing selected besides "Pick a file" | pass | pass | flag: tree column is narrow (~280px), preview pane is 60% empty | pass |
| workflows | pass | flag: 5 thin rows + 90% empty bottom; rows are pure-text, no detail surface | pass | pass | flag: dead air below row list | flag: rows clickable but indication is faint |
| advisor | pass | BLOCK: orphaned empty bordered rectangle below "No decisions recorded" | pass | pass | flag: stub box adds dead air | pass |
| approvals | pass | BLOCK: "Refresh" label next to empty checkbox-shaped button (broken `<lx-button>`); orphaned input-shaped stub box below note field | pass | pass | flag: Pending(0) + Decided(0) sections each leave wide empty bands | pass |
| brain | pass | BLOCK: "Refresh" broken button; orphaned stub box below empty state | pass | pass | flag: stub box | pass |
| budget | pass | flag: 3 empty bordered boxes below the 3 KPI rows + a 4th below the explainer (broken stub pattern) | pass | pass | flag: stub boxes break vertical rhythm | pass |
| build | pass | flag: 2 stub boxes (one between sections, one below empty state) | pass | pass | flag: stub boxes | pass |
| chat | pass | pass | pass | pass | pass | pass |
| claims | pass | BLOCK: "Refresh" broken button | pass | pass | pass | pass |
| heartbeat | pass | flag: stub box below GLOBAL JSON, second below CONTROL JSON, third below PER-AGENT empty state | pass | pass | flag: 3 stub boxes amplify vertical dead air | flag: raw JSON for both panels — power-user only, no formatted view |
| logs | pass | flag: "Refresh" broken button (only the auto-refresh toggle to the right reads as functional); stub box below empty state | pass | pass | flag: stub box | pass |
| plans | pass | BLOCK: 4 stub boxes (under "No plan for today", under "No pending diff", under "No plans" empty state, under "Pick a plan") | pass | pass | flag: stub boxes everywhere | flag: 4 sections + no clear primary path |
| projects | pass | flag: 2 stub boxes (one per column under empty states) | pass | pass | flag: stub boxes | flag: dual empty pane reads as broken layout |
| routines | pass | BLOCK: "Refresh" broken button + stub box below "Pick a routine" | pass | pass | flag: stub box | flag: dual empty pane |
| search | pass | pass | pass | pass | pass | pass |
| skills | pass | BLOCK: "Create" button next to empty rectangle (broken `<lx-button>`); 2 stub boxes (under skills empty, under editor empty) | pass | pass | flag: stub boxes | flag: dual empty pane + broken Create CTA |
| team | pass | flag: 5 stub boxes — one per section (Status, Members, Recent Messages, Leaderboard, Pending Requests) | pass | pass | flag: stub boxes everywhere | flag: 5-section grid with no data is overwhelming and conveys "broken" |
| today | pass | pass | pass | pass | flag: AT A GLANCE + QUICK LINKS title boxes are empty rectangles below the KPI cards | pass |
| trace | pass | BLOCK: "Refresh" broken button + stub box below "Pick a run" | pass | pass | flag: stub box | pass |

---

## Top 3 Priority Fixes (cross-cutting)

### 1. Fix the `<lx-button>` Light-DOM slot bug (BLOCK)

**File:** `src/lexi-dashboard/ui/design/primitives/lx-button.ts`

**What's wrong:** `LxButton.createRenderRoot()` returns `this` (light DOM), but `render()` outputs an inner `<button class="lx-button">…<slot></slot>…</button>`. Because slots only project in **shadow** DOM, the slotted label text never enters the inner button — it sits in the host as a sibling text node next to the empty `<button>`. Every view that calls `<lx-button>Refresh</lx-button>` or `<lx-button>Create</lx-button>` renders the visible text floating to the *left* of an empty button-shaped rectangle.

**Affected views (visible regression):** approvals, brain, claims, logs, routines, skills, trace — and any other surface that uses `<lx-button>` (likely the bottom drawer, command palette result actions, etc.). 7 of 24 audited routes show the bug above the fold.

**Fix:** Either (a) switch `createRenderRoot()` to use shadow DOM (one-line fix, requires moving global `.lx-button` styles into shadow scope or piercing them), **or** (b) keep light DOM and pull the host's textContent into the inner button manually:

```ts
// Replace the <slot></slot> with rendered host children
render(): TemplateResult {
  const label = (this.textContent ?? '').trim();
  return html`<button class="lx-button" …>
    ${!this.iconRight && this.icon ? html`<lx-icon …></lx-icon>` : ''}
    <span class="lx-button-label">${label}</span>
    ${this.iconRight && this.icon ? html`<lx-icon …></lx-icon>` : ''}
  </button>`;
}
// Then in connectedCallback: clear original text children once label is captured.
```

Option (b) preserves the existing global stylesheet path that the rest of the codebase relies on. Run the existing visual baselines after the fix; expect 7+ snapshots to need re-baselining and intentional review.

**User impact:** every "Refresh" / primary-action surface currently looks broken. The Approvals view literally cannot be refreshed-by-mouse because the click target is the empty rectangle, not the visible "Refresh" word.

---

### 2. Remove orphaned `<lx-card>` / status-stub boxes below empty states (BLOCK)

**Pattern:** A bordered, fixed-height empty rectangle (~44px tall, full content-width) appears below empty-state messages on advisor, approvals, brain, budget, build, heartbeat, logs, plans, projects, routines, skills, today, trace, team. 14 of 24 routes. These are the dominant visual "this looks unfinished" cue.

**Likely root causes** (one of):
- A shared `<lx-status>` / `.refresh-status` / footer-strip primitive that renders a bordered container even when empty — should self-collapse to `display: none` when no children.
- View templates render `<div class="status">${msg ?? ''}</div>` with the bordered class always applied; should be conditional on truthy content.
- The `lx-card` primitive applied to a section that has been emptied during the empty-state branch.

**Fix path:** grep the affected view source files for the recurring class — likely `refresh-status`, `status-row`, or `footer`. Add a `:empty { display: none }` rule (or a `?hidden=${!hasContent}` guard) in one place. This is a one-evening fix that resolves ~14 views simultaneously.

**User impact:** every view that has no data right now looks like it has a broken stub or skeleton stuck in the rendered output. This is the single biggest "feels unfinished" signal in the dashboard.

---

### 3. Resolve the dual-empty-pane pattern on left-list/right-detail views (flag, but pervasive)

**Affected views:** plans, projects, routines, skills, vault, trace.

**Pattern:** A two-column layout (list on the left, detail on the right). When there's no data, both columns show "No X" + "Pick an X" side-by-side at equal weight. With both empty, the screen reads as 60% empty space split into two equally-broken-looking halves.

**Fix options (pick one per view, not all):**
- **A. Collapse the detail pane when nothing is selectable.** Render only the empty state on the left and a single CTA ("Create your first plan", "Configure a project") spanning the full content width. Bring the detail column back when selection becomes possible.
- **B. Convert the empty state on the *left* into the primary CTA.** "No skills yet — [Create a skill]" with a real button styled as the primary action. Keep the detail-pane empty state as a small "Pick a skill on the left" hint.
- **C. Combine into a single banner across both columns.** "Lexi has no projects configured yet. Projects index is read-only — wire one in via daemon."

Option B is lowest-effort and ships fastest. Option A is most modern.

**User impact:** dual-empty layouts are the single most "this dashboard is empty" feeling — and most of these views are correctly empty by default for a fresh user. The polish goal is "looks intentional when empty," not "fills space with stubs."

---

## Per-View Findings (only views with at least one flag/BLOCK)

### `agents` — VI/SP flags

The right-hand "Select an agent to inspect." pane is ~75% of the screen and never gets visible content until the user clicks. Two agent cards stacked tightly leave the rest of the left column empty. Recommended: when no agent is selected, expand the agent card grid to fill, *or* show an inline preview of the most-recently-touched agent in the right pane.

### `connections` — VI/SP/XD flags

Chrome (KIND filters, STATUS filters, "Probe all", "Select a connection to view details.") sits on a single horizontal row, no panel boundary, against an otherwise blank page. Reads as toolbar with no content surface. Recommended: wrap KIND + STATUS + Probe in a panel header and show the empty state in a panel body below it. The connections-view inline-style-attr cleanup (Task C2 in the plan) should pair with this.

### `memory` — VI/SP/XD flags

Underline-style tabs (Stats / Graph / Recall Traces / Integrity) differ from the pill-with-counter pattern used by brain and advisor. Pick one and apply globally. KPI row leaves vertical dead space. Tabs are read-only with no action surface — consider adding an "Inspect chunk" or filter affordance.

### `settings` — VI/SP

Theme tab content is ~120px tall in a 900px viewport. Auth / Tokens / Secrets / Advanced are blind tabs (no preview of what's there). Consider moving Theme into a single Settings index page that shows section previews instead of hiding everything behind tabs.

### `vault` — VI/SP

Tree column is ~280px wide; preview pane is the rest of the screen and 100% empty until selection. Consider widening the tree to ~360px or showing recent-files inline in the preview pane on first load.

### `workflows` — VI/SP/XD

5 thin rows of pure text. The right-side `cron:daily-…` ID labels are the only differentiator. Consider per-row status indicators (last run, next run, success/fail dot) to give the rows visual weight and reduce the dead area below.

### `advisor` — VI BLOCK

Stub box below "No decisions recorded." See cross-cutting fix #2.

### `approvals` — VI BLOCK

Refresh button broken (see #1). Note textarea has a stray empty rectangle below it that's likely another `<lx-button>` collapse or a status row. Pending(0) + Decided(0) leave wide empty bands — consider merging the two into a single timeline.

### `brain` — VI BLOCK

Refresh button broken. Stub box below the empty state.

### `budget` — VI/SP

3 empty bordered boxes below the 3 KPI cards (MODE / MTD SPEND / CONFIGURED BUDGETS) plus a 4th below the WHY FREE-ONLY? explainer. All four are stub boxes. After fix #2, this view becomes near-pass.

### `build` — VI/SP

Two stub boxes — one between USAGE and RECENT OPERATIONS, one below "No build operations". After fix #2, near-pass.

### `claims` — VI BLOCK

Refresh button broken. Otherwise the empty state is clean. After fix #1, becomes pass.

### `heartbeat` — VI/SP/XD

Three stub boxes (one each below GLOBAL, CONTROL, PER-AGENT). Both panels render raw JSON — readable for power users but hostile for a fallback dashboard. Consider `<details>` collapse with a formatted summary above the JSON.

### `logs` — VI

Refresh button broken (the toggle to the right of it works fine and is the only visual signal that the row has any function). Stub box below empty state. After fix #1 + #2, becomes pass.

### `plans` — VI BLOCK + XD flag

Four stub boxes plus dual-empty-pane. After fixes #2 and #3, becomes pass.

### `projects` — VI/XD

Two stub boxes (one per column) plus dual-empty-pane. After fixes #2 and #3, near-pass.

### `routines` — VI BLOCK + XD flag

Refresh broken + dual-empty-pane + stub box. After fixes #1, #2, #3, becomes pass.

### `skills` — VI BLOCK + XD flag

Create button broken (same `<lx-button>` bug — "Create" floats to the left of an empty rectangle, no obvious click target). Two stub boxes. Dual-empty-pane. After fixes #1, #2, #3, becomes pass.

### `team` — VI/SP/XD

5-section grid with 5 empty-state stub boxes is the highest-density "this is unfinished" view in the dashboard. After fix #2 the view is acceptable but still wants the dual-empty-pane treatment from fix #3 (consider collapsing Recent Messages / Leaderboard / Pending Requests into a single tab strip when there's no data).

### `today` — SP

AT A GLANCE and QUICK LINKS title boxes are empty rectangles below the 4 KPI cards — stub-box pattern again. After fix #2, near-pass. (Today is otherwise the cleanest "dashboard with no data" view in the set — KPI cards have semantic dot colors and the Issue/0 red checks reads as intentional.)

### `trace` — VI BLOCK

Refresh broken + stub box. After fixes #1 and #2, becomes pass.

---

## Cron view scoring (sanity check)

Cron is the canonical "polished" target and scores 6×pass. Confirms the bar is achievable inside this stack:
- Native `<button>` with inline `<style>` block scoped to the component (avoids the `<lx-button>` bug).
- Semantic red callout for "2 broken jobs" with per-row Investigate buttons.
- Cyan "Run now" buttons used sparingly on the per-job rows.
- Tabular monospace cron expressions, sans-serif labels, KPI strip at top with semantic dots.
- No stub boxes anywhere.

The fix prescription for the rest of the dashboard is: **make every view look like cron does**.

---

## Estimated effort

- Fix #1 (`<lx-button>` light-DOM slot): ~1 hour code + ~2 hours re-baselining + visual review across 7+ snapshots.
- Fix #2 (orphaned stub boxes): ~3 hours to grep + identify the shared primitive, ~2 hours to add the conditional render + retest 14 views.
- Fix #3 (dual-empty-pane): per-view design call, ~30 min × 6 views = 3 hours.

**Total: ~1 day of focused work** brings the dashboard from 16/24 to ~21/24, which is the realistic Track 1 freeze bar.

---

## What's deliberately not flagged

- Sparse views with intentional empty states (Cron when not broken, Today, Search, Chat) — these are minimalism, not gaps.
- Tab content density (Settings Theme tab being short) — fine for a fallback surface; not worth investing in before SwiftUI replaces.
- Light vs. dark theme parity — D3 baselines were captured in light theme; dark theme has separate token coverage in `tokens.css` but is not in this review's scope per spec §1.
- Mobile/responsive — out of scope per spec §1.
- A11y violations — D2 already gates on serious/critical; nothing further to flag visually.
