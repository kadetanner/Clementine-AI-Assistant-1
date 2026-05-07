# Lexi Web Polish (Heavy Bar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Lexi web dashboard to "good fallback" quality across all 24 mounted routes, then freeze. Every interactive element verified, ~120 Playwright E2E tests, axe-playwright a11y baseline, visual baselines, explicit empty/error/loading states.

**Architecture:** Audit-then-fix-then-test sequence. Phase A scaffolds tooling. Phase B audits all 24 views in a structured per-view loop, producing a master audit document. Phase C fixes known-broken items first, then loops through audit-flagged fixes. Phase D builds out test scaffolding (E2E, a11y, visual, states). Phase E freezes.

**Tech Stack:** TypeScript, Lit 3.2, Express, Playwright 1.59+, axe-playwright (new dependency), Vitest, esbuild for the dashboard bundle.

**Spec:** [`docs/superpowers/specs/2026-05-06-lexi-web-polish-heavy-design.md`](../specs/2026-05-06-lexi-web-polish-heavy-design.md)

---

## File structure overview

**New files:**
- `docs/audit/2026-05-web-polish-audit.md` — master audit document, one row per view
- `scripts/audit/inventory-interactions.ts` — enumerate `@click`/`@input`/etc. from a Lit view's `.ts` source
- `tests/lexi/e2e/views/<route>.spec.ts` — per-view E2E (24 files)
- `tests/lexi/e2e/a11y/<route>.spec.ts` — per-view axe-playwright (24 files)
- `tests/lexi/e2e/states/<route>.spec.ts` — empty/error/loading per view (subset of 24)
- `tests/lexi/e2e/visual/<route>.spec.ts` — visual screenshot diff per view (24 files)
- `tests/lexi/e2e/visual/<route>-{1280,1440}.png` — committed baseline screenshots (48 files)
- `tests/lexi/e2e/helpers/route-list.ts` — single source of truth for routes under audit

**Modified files:**
- `src/lexi-dashboard/ui/components/lexi-prompt-editor.ts` — add inline `<style>` block (known broken)
- `src/lexi-dashboard/ui/components/connections/lexi-connections-view.ts` — convert inline `style=""` attributes to inline `<style>` block (consistency fix)
- `src/lexi-dashboard/ui/components/lexi-home-view.ts` — delete (dead code; not mounted by router)
- `src/lexi-dashboard/ui/shell-v2.css` — global focus ring + WCAG AA contrast tweaks
- Each `lexi-*-view.ts` touched in Phase C — depends on audit findings; pattern documented in Task C-loop
- `package.json` — add `axe-playwright` to devDependencies, add `audit:inventory` script
- `package-lock.json` — regenerated

**Unchanged on purpose:**
- `src/lexi-dashboard/server.ts`, `routes.ts`, all route handlers, `services/` — API surface frozen.
- `src/desktop/main.ts` — Track 1 doesn't touch the Electron scaffold.
- All non-`lexi-*` code (agent runtime, MCP servers, etc.).

---

## The 24 routes under audit

This list is the source of truth. It's encoded as `tests/lexi/e2e/helpers/route-list.ts` in Task A0 and imported by every per-view test.

```ts
// Routes from src/lexi-dashboard/ui/components/lexi-app.ts router
// (#/home and #/today both resolve to lexi-today-view → 24 unique mount points)
export const LEXI_ROUTES = [
  { route: 'agents',     tag: 'lexi-agents-view' },
  { route: 'connections',tag: 'lexi-connections-view' },
  { route: 'cron',       tag: 'lexi-cron-view' },
  { route: 'memory',     tag: 'lexi-memory-view' },
  { route: 'settings',   tag: 'lexi-settings-view' },
  { route: 'vault',      tag: 'lexi-vault-view' },
  { route: 'workflows',  tag: 'lexi-workflows-view' },
  { route: 'advisor',    tag: 'lexi-advisor-view' },
  { route: 'approvals',  tag: 'lexi-approvals-view' },
  { route: 'brain',      tag: 'lexi-brain-view' },
  { route: 'budget',     tag: 'lexi-budget-view' },
  { route: 'build',      tag: 'lexi-build-view' },
  { route: 'chat',       tag: 'lexi-chat-view' },
  { route: 'claims',     tag: 'lexi-claims-view' },
  { route: 'heartbeat',  tag: 'lexi-heartbeat-view' },
  { route: 'logs',       tag: 'lexi-logs-view' },
  { route: 'plans',      tag: 'lexi-plans-view' },
  { route: 'projects',   tag: 'lexi-projects-view' },
  { route: 'routines',   tag: 'lexi-routines-view' },
  { route: 'search',     tag: 'lexi-search-view' },
  { route: 'skills',     tag: 'lexi-skills-view' },
  { route: 'team',       tag: 'lexi-team-view' },
  { route: 'today',      tag: 'lexi-today-view' },
  { route: 'trace',      tag: 'lexi-trace-view' },
] as const;
```

---

## Phase A — Tooling & Setup (Day 1)

### Task A0: Create the routes-under-audit helper

**Files:**
- Create: `tests/lexi/e2e/helpers/route-list.ts`

- [ ] **Step 1: Write the file**

```ts
// tests/lexi/e2e/helpers/route-list.ts
// Source of truth for the 24 mounted dashboard routes covered by the
// 2026-05 polish audit. Imported by every per-view E2E/a11y/visual spec.

export const LEXI_ROUTES = [
  { route: 'agents',     tag: 'lexi-agents-view' },
  { route: 'connections',tag: 'lexi-connections-view' },
  { route: 'cron',       tag: 'lexi-cron-view' },
  { route: 'memory',     tag: 'lexi-memory-view' },
  { route: 'settings',   tag: 'lexi-settings-view' },
  { route: 'vault',      tag: 'lexi-vault-view' },
  { route: 'workflows',  tag: 'lexi-workflows-view' },
  { route: 'advisor',    tag: 'lexi-advisor-view' },
  { route: 'approvals',  tag: 'lexi-approvals-view' },
  { route: 'brain',      tag: 'lexi-brain-view' },
  { route: 'budget',     tag: 'lexi-budget-view' },
  { route: 'build',      tag: 'lexi-build-view' },
  { route: 'chat',       tag: 'lexi-chat-view' },
  { route: 'claims',     tag: 'lexi-claims-view' },
  { route: 'heartbeat',  tag: 'lexi-heartbeat-view' },
  { route: 'logs',       tag: 'lexi-logs-view' },
  { route: 'plans',      tag: 'lexi-plans-view' },
  { route: 'projects',   tag: 'lexi-projects-view' },
  { route: 'routines',   tag: 'lexi-routines-view' },
  { route: 'search',     tag: 'lexi-search-view' },
  { route: 'skills',     tag: 'lexi-skills-view' },
  { route: 'team',       tag: 'lexi-team-view' },
  { route: 'today',      tag: 'lexi-today-view' },
  { route: 'trace',      tag: 'lexi-trace-view' },
] as const;

export type LexiRoute = typeof LEXI_ROUTES[number];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit tests/lexi/e2e/helpers/route-list.ts`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add tests/lexi/e2e/helpers/route-list.ts
git commit -m "test(polish): add canonical route list for audit/test fan-out"
```

---

### Task A1: Add axe-playwright dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (regenerated)

- [ ] **Step 1: Install the package**

Run: `npm install --save-dev axe-playwright`
Expected: package installs cleanly; `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Verify it imports**

Run: `node -e "console.log(Object.keys(require('axe-playwright')))"`
Expected: prints array including `injectAxe`, `checkA11y`, `getViolations`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps(test): add axe-playwright for a11y audits"
```

---

### Task A2: Build the interaction inventory script

**Files:**
- Create: `scripts/audit/inventory-interactions.ts`
- Create: `tests/audit/inventory-interactions.test.ts`
- Modify: `package.json` (add `audit:inventory` script)

- [ ] **Step 1: Write the failing test**

```ts
// tests/audit/inventory-interactions.test.ts
import { describe, it, expect } from 'vitest';
import { extractInteractions } from '../../scripts/audit/inventory-interactions';

describe('extractInteractions', () => {
  it('returns empty list for source with no interactions', () => {
    const src = `import { LitElement, html } from 'lit';
      class X extends LitElement { render() { return html\`<div>static</div>\`; } }`;
    expect(extractInteractions(src)).toEqual([]);
  });

  it('finds @click handlers', () => {
    const src = `html\`<button @click=\${this.onSave}>Save</button>\``;
    const out = extractInteractions(src);
    expect(out).toContainEqual({ kind: '@click', handler: 'onSave', context: 'button' });
  });

  it('finds @input handlers', () => {
    const src = `html\`<textarea @input=\${this.onInput}></textarea>\``;
    const out = extractInteractions(src);
    expect(out).toContainEqual({ kind: '@input', handler: 'onInput', context: 'textarea' });
  });

  it('finds <a> links with href', () => {
    const src = `html\`<a href="#/agents">Agents</a>\``;
    const out = extractInteractions(src);
    expect(out).toContainEqual({ kind: 'link', handler: '#/agents', context: 'a' });
  });

  it('finds buttons without handlers (potentially broken)', () => {
    const src = `html\`<button data-action="restart">Restart</button>\``;
    const out = extractInteractions(src);
    expect(out).toContainEqual({ kind: 'button', handler: 'data-action=restart', context: 'button' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audit/inventory-interactions.test.ts`
Expected: FAIL with "Cannot find module '../../scripts/audit/inventory-interactions'".

- [ ] **Step 3: Write the implementation**

```ts
// scripts/audit/inventory-interactions.ts
// Enumerate interactive elements declared in a Lit view's .ts source.
// Output is a draft list for the audit document — not authoritative,
// always followed by a manual sweep.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Interaction {
  kind: '@click' | '@input' | '@change' | '@submit' | 'link' | 'button';
  handler: string;
  context: string;
}

const PATTERNS: Array<{ kind: Interaction['kind']; re: RegExp }> = [
  { kind: '@click',  re: /<(\w+)[^>]*@click\s*=\s*\$\{this\.(\w+)/g },
  { kind: '@input',  re: /<(\w+)[^>]*@input\s*=\s*\$\{this\.(\w+)/g },
  { kind: '@change', re: /<(\w+)[^>]*@change\s*=\s*\$\{this\.(\w+)/g },
  { kind: '@submit', re: /<(\w+)[^>]*@submit\s*=\s*\$\{this\.(\w+)/g },
  { kind: 'link',    re: /<(a)[^>]*href\s*=\s*"([^"]+)"/g },
];

export function extractInteractions(src: string): Interaction[] {
  const out: Interaction[] = [];
  for (const { kind, re } of PATTERNS) {
    for (const m of src.matchAll(re)) {
      const [, ctx, handler] = m;
      out.push({ kind, handler, context: ctx });
    }
  }
  // Buttons without @click — possibly dead, flag for manual review
  const btnRe = /<button(?![^>]*@click)[^>]*?(?:data-action\s*=\s*"([^"]+)")?[^>]*>/g;
  for (const m of src.matchAll(btnRe)) {
    const action = m[1];
    if (action) out.push({ kind: 'button', handler: `data-action=${action}`, context: 'button' });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: tsx scripts/audit/inventory-interactions.ts <view.ts>');
    process.exit(1);
  }
  const src = readFileSync(resolve(file), 'utf8');
  const interactions = extractInteractions(src);
  console.log(JSON.stringify({ file, interactions }, null, 2));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/audit/inventory-interactions.test.ts`
Expected: PASS, all 5 cases green.

- [ ] **Step 5: Add the npm script**

Edit `package.json` `"scripts"` block, insert after `"test:e2e"`:

```json
"audit:inventory": "tsx scripts/audit/inventory-interactions.ts"
```

- [ ] **Step 6: Smoke-test against a real view**

Run: `npm run audit:inventory -- src/lexi-dashboard/ui/components/lexi-prompt-editor.ts`
Expected: JSON output listing the `onInput`, `onSave`, `onCancel` handlers from the textarea + Cancel + Save buttons.

- [ ] **Step 7: Commit**

```bash
git add scripts/audit/inventory-interactions.ts tests/audit/inventory-interactions.test.ts package.json
git commit -m "tools(audit): inventory script for Lit view interactions"
```

---

### Task A3: Initialize the audit document

**Files:**
- Create: `docs/audit/2026-05-web-polish-audit.md`

- [ ] **Step 1: Write the audit document scaffold**

```markdown
# Lexi Web Polish Audit — 2026-05

**Spec:** [docs/superpowers/specs/2026-05-06-lexi-web-polish-heavy-design.md](../superpowers/specs/2026-05-06-lexi-web-polish-heavy-design.md)
**Status:** in progress
**Started:** 2026-05-06

This is the source of truth for the Track 1 web polish audit. Every mounted route gets one row. A row goes green only when all five passes (behavior, visual, a11y, state, e2e) are pass.

## Legend

- `current_status`: `unknown` (not audited) / `works` / `broken` / `partial`
- `e2e_coverage`: `none` / `partial` / `full`
- `a11y_status`: `pass` / `gap: <description>`
- `empty_error_loading`: `pass` / `gap: <description>`

## Rows

### `#/agents` — `lexi-agents-view`
- **Interactions:** _populated by Task B0_
- **Expected behavior:** _populated by Task B0_
- **Current status:** unknown
- **Evidence:** _Playwright screenshot path or trace_
- **Fix required:** _populated if status != works_
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/connections` — `lexi-connections-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/cron` — `lexi-cron-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/memory` — `lexi-memory-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/settings` — `lexi-settings-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/vault` — `lexi-vault-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/workflows` — `lexi-workflows-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/advisor` — `lexi-advisor-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/approvals` — `lexi-approvals-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/brain` — `lexi-brain-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/budget` — `lexi-budget-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/build` — `lexi-build-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/chat` — `lexi-chat-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/claims` — `lexi-claims-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/heartbeat` — `lexi-heartbeat-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/logs` — `lexi-logs-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/plans` — `lexi-plans-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/projects` — `lexi-projects-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/routines` — `lexi-routines-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/search` — `lexi-search-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/skills` — `lexi-skills-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/team` — `lexi-team-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/today` — `lexi-today-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
- **Fix required:**
- **e2e coverage:** none
- **a11y status:** unknown
- **empty/error/loading:** unknown

### `#/trace` — `lexi-trace-view`
- **Interactions:**
- **Expected behavior:**
- **Current status:** unknown
- **Evidence:**
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

### `lexi-prompt-editor.ts` — system prompt editor (KNOWN BROKEN, see Task C0)
- **Status:** broken
- **Fix required:** Add inline `<style>` block; matches the screenshot bug from 2026-05-06.

## Known fixes pre-loaded

These three are entered now so they're not lost during the audit churn. See Tasks C0, C1, C2.

1. **`lexi-prompt-editor.ts`** — unstyled. Fix: add inline `<style>` block.
2. **`lexi-home-view.ts`** — dead code. Fix: delete.
3. **`lexi-connections-view.ts`** — uses inline `style=""` attributes instead of inline `<style>` block. Fix: convert.
```

- [ ] **Step 2: Verify the file exists and is well-formed**

Run: `wc -l docs/audit/2026-05-web-polish-audit.md`
Expected: 200+ lines.

- [ ] **Step 3: Commit**

```bash
git add docs/audit/2026-05-web-polish-audit.md
git commit -m "docs(audit): scaffold web polish audit doc with 24 routes"
```

---

## Phase B — Audit Loop (Days 2-5)

Each Phase B task uses the same procedure. **Task B0** documents that procedure as a reusable checklist; **Tasks B1–B24** apply it to one route at a time. This avoids placeholder "follow same as previous task" — every per-view task is bite-sized and concrete because it follows the B0 checklist.

### Task B0: Per-view audit procedure (the loop body)

This task is a **reference document**, not an executable task. It defines the procedure that B1-B24 each execute against their own route.

For route `<R>` mounting tag `<T>`:

1. **Inventory pass.**
   - Run: `npm run audit:inventory -- src/lexi-dashboard/ui/components/<path-to-T>.ts`
   - Capture the interactions JSON.
   - Manual sweep: open the source file, look for keyboard shortcuts (`addEventListener('keydown', ...)`), drag/drop handlers, intersection observers — anything the regex script may have missed. Append findings.
   - Update the audit row's `interactions` field.

2. **Behavior pass.**
   - Confirm the dashboard is running on `:3030` (or start it: see `npm run dev` / launchd).
   - Open `http://localhost:3030/#/<R>` in Chromium.
   - For each interaction documented in step 1: predict what should happen in one line, then click/type/etc., observe the actual result, mark `works` / `broken` / `partial`.
   - Capture a Playwright screenshot:
     ```bash
     npx playwright screenshot --viewport-size=1440,900 \
       --wait-for-selector=<T> \
       http://localhost:3030/#/<R> \
       tests/lexi/e2e/visual/<R>-evidence.png
     ```
   - Update audit row's `current_status`, `expected_behavior`, `evidence`.

3. **Visual pass.**
   - Compare the screenshot to a "this looks right" mental model. Flag obvious bugs (zero-height children, overflowing containers, unstyled components).
   - Also capture at 1280×800:
     ```bash
     npx playwright screenshot --viewport-size=1280,800 \
       --wait-for-selector=<T> \
       http://localhost:3030/#/<R> \
       tests/lexi/e2e/visual/<R>-evidence-1280.png
     ```

4. **A11y pass.**
   - Tab through the view manually. Confirm focus order is sensible and visible.
   - Run axe inline (script written in Task A1):
     ```bash
     node -e "
       const { chromium } = require('@playwright/test');
       const { injectAxe, getViolations } = require('axe-playwright');
       (async () => {
         const browser = await chromium.launch();
         const page = await browser.newPage();
         await page.goto('http://localhost:3030/#/<R>');
         await page.waitForSelector('<T>', { timeout: 5000 });
         await injectAxe(page);
         const v = await getViolations(page, null, { detailedReport: false });
         console.log(JSON.stringify(v.filter(x => ['serious','critical'].includes(x.impact)), null, 2));
         await browser.close();
       })();
     "
     ```
   - Update `a11y_status`: `pass` if no serious/critical, else `gap: <summary>`.

5. **State pass.**
   - Identify async data sources in the view's source (`fetch(`, `EventSource`, etc.).
   - For each: temporarily block the request via DevTools network blocking → reload → check empty/loading/error rendering.
   - Update `empty_error_loading`: `pass` if all three states render acceptably, else `gap: <summary>`.

6. **Commit.**
   - `git add docs/audit/2026-05-web-polish-audit.md tests/lexi/e2e/visual/<R>-evidence*.png`
   - `git commit -m "audit(<R>): document interactions and current status"`

---

### Tasks B1–B24: Run the B0 procedure per route

**Files for every B-task:**
- Modify: `docs/audit/2026-05-web-polish-audit.md` (one row updated)
- Create: `tests/lexi/e2e/visual/<route>-evidence.png`
- Create: `tests/lexi/e2e/visual/<route>-evidence-1280.png`

Each B-task below is one route. Execute the B0 procedure substituting `<R>` and `<T>`. Commit per-task.

- [ ] **Task B1: `agents` / `lexi-agents-view`** — execute B0 procedure
- [ ] **Task B2: `connections` / `lexi-connections-view`** — execute B0 procedure
- [ ] **Task B3: `cron` / `lexi-cron-view`** — execute B0 procedure
- [ ] **Task B4: `memory` / `lexi-memory-view`** — execute B0 procedure
- [ ] **Task B5: `settings` / `lexi-settings-view`** — execute B0 procedure
- [ ] **Task B6: `vault` / `lexi-vault-view`** — execute B0 procedure
- [ ] **Task B7: `workflows` / `lexi-workflows-view`** — execute B0 procedure
- [ ] **Task B8: `advisor` / `lexi-advisor-view`** — execute B0 procedure
- [ ] **Task B9: `approvals` / `lexi-approvals-view`** — execute B0 procedure
- [ ] **Task B10: `brain` / `lexi-brain-view`** — execute B0 procedure
- [ ] **Task B11: `budget` / `lexi-budget-view`** — execute B0 procedure
- [ ] **Task B12: `build` / `lexi-build-view`** — execute B0 procedure
- [ ] **Task B13: `chat` / `lexi-chat-view`** — execute B0 procedure
- [ ] **Task B14: `claims` / `lexi-claims-view`** — execute B0 procedure
- [ ] **Task B15: `heartbeat` / `lexi-heartbeat-view`** — execute B0 procedure
- [ ] **Task B16: `logs` / `lexi-logs-view`** — execute B0 procedure
- [ ] **Task B17: `plans` / `lexi-plans-view`** — execute B0 procedure
- [ ] **Task B18: `projects` / `lexi-projects-view`** — execute B0 procedure
- [ ] **Task B19: `routines` / `lexi-routines-view`** — execute B0 procedure
- [ ] **Task B20: `search` / `lexi-search-view`** — execute B0 procedure
- [ ] **Task B21: `skills` / `lexi-skills-view`** — execute B0 procedure
- [ ] **Task B22: `team` / `lexi-team-view`** — execute B0 procedure
- [ ] **Task B23: `today` / `lexi-today-view`** — execute B0 procedure
- [ ] **Task B24: `trace` / `lexi-trace-view`** — execute B0 procedure

### Task B25: Audit cross-cutting components

**Files:**
- Modify: `docs/audit/2026-05-web-polish-audit.md` (cross-cutting section)

- [ ] **Step 1: Audit each cross-cutting component**

For each of: `lexi-app`, `lexi-top-bar`, `lexi-nav-rail`, `lexi-right-rail`, `lexi-bottom-drawer`, `lexi-system-map-drawer`, `lexi-command-palette`, `lexi-now-playing`, `lexi-stuck-banner`, `lexi-onboarding-tour`:
- Run inventory script
- Manual behavior check (cross-cutting components are exercised on every view, so behavior check folds into B1–B24's evidence)
- Update audit row

- [ ] **Step 2: Commit**

```bash
git add docs/audit/2026-05-web-polish-audit.md
git commit -m "audit(shell): document cross-cutting component status"
```

---

## Phase C — Fix (Days 6-10)

Phase C has three pre-known fix tasks (C0, C1, C2) and a fix-loop pattern (C-loop) for audit-discovered issues. After Phase B completes, walk down the audit document, group fix needs by category, and apply C-loop to each.

### Task C0: Fix the unstyled prompt editor

**Files:**
- Modify: `src/lexi-dashboard/ui/components/lexi-prompt-editor.ts`
- Create: `tests/lexi/e2e/views/prompt-editor.spec.ts`

- [ ] **Step 1: Write the failing visual test**

```ts
// tests/lexi/e2e/views/prompt-editor.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Prompt editor styling', () => {
  test.beforeEach(async ({ page }) => {
    const r = await page.goto('/#/agents').catch(() => null);
    if (!r || r.status() >= 400) test.skip(true, 'dashboard not running on :3030');
  });

  test('textarea has min-height >= 240px and full width', async ({ page }) => {
    // Click an agent that has a prompt (e.g. Jonah from screenshot)
    await page.locator('lexi-agents-view .agent-row').first().click();
    const ta = page.locator('lexi-prompt-editor textarea');
    await expect(ta).toBeVisible();
    const box = await ta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(240);
    expect(box!.width).toBeGreaterThanOrEqual(400);
  });

  test('toolbar shows label, save, cancel with proper spacing', async ({ page }) => {
    await page.locator('lexi-agents-view .agent-row').first().click();
    const editor = page.locator('lexi-prompt-editor');
    await expect(editor.locator('.toolbar .label')).toHaveText('System prompt');
    await expect(editor.locator('button[data-save]')).toBeVisible();
    await expect(editor.locator('button[data-cancel]')).toBeVisible();
    const toolbarBox = await editor.locator('.toolbar').boundingBox();
    expect(toolbarBox!.height).toBeGreaterThanOrEqual(36);
  });

  test('save button is disabled when not dirty', async ({ page }) => {
    await page.locator('lexi-agents-view .agent-row').first().click();
    const save = page.locator('lexi-prompt-editor button[data-save]');
    await expect(save).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- tests/lexi/e2e/views/prompt-editor.spec.ts`
Expected: FAIL — textarea has tiny dimensions and toolbar is unstyled.

- [ ] **Step 3: Replace `lexi-prompt-editor.ts` with the styled version**

```ts
// src/lexi-dashboard/ui/components/lexi-prompt-editor.ts
import { LitElement, html } from 'lit';
import { live } from 'lit/directives/live.js';

export class LexiPromptEditor extends LitElement {
  static properties = {
    value: { type: String },
    draft: { state: true },
    dirty: { state: true },
  };

  declare value: string;
  declare draft: string;
  declare dirty: boolean;

  constructor() {
    super();
    this.value = '';
    this.draft = '';
    this.dirty = false;
  }

  protected createRenderRoot() { return this; }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('value') && !this.dirty) this.draft = this.value;
  }

  private onInput = (ev: Event) => {
    this.draft = (ev.target as HTMLTextAreaElement).value;
    this.dirty = this.draft !== this.value;
  };

  private onSave = () => {
    this.dispatchEvent(new CustomEvent('prompt-save', { detail: { value: this.draft }, bubbles: true, composed: true }));
    this.value = this.draft;
    this.dirty = false;
  };

  private onCancel = () => {
    this.draft = this.value;
    this.dirty = false;
  };

  render() {
    return html`
      <style>
        lexi-prompt-editor {
          display: block;
          width: 100%;
        }
        lexi-prompt-editor .toolbar {
          display: flex;
          align-items: center;
          gap: var(--sp-2, 8px);
          padding: var(--sp-2, 8px) 0;
          min-height: 40px;
        }
        lexi-prompt-editor .toolbar .label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #111827);
        }
        lexi-prompt-editor .toolbar [data-dirty] {
          font-size: 12px;
          color: var(--accent, #2563eb);
        }
        lexi-prompt-editor .toolbar button {
          padding: 6px 12px;
          font-size: 13px;
          border-radius: 6px;
          border: 1px solid var(--border-subtle, #e5e7eb);
          background: var(--bg-surface, #ffffff);
          color: var(--text-primary, #111827);
          cursor: pointer;
          transition: background 120ms;
        }
        lexi-prompt-editor .toolbar button:hover:not(:disabled) {
          background: var(--bg-hover, #f3f4f6);
        }
        lexi-prompt-editor .toolbar button[data-save] {
          background: var(--accent, #2563eb);
          color: #ffffff;
          border-color: var(--accent, #2563eb);
        }
        lexi-prompt-editor .toolbar button[data-save]:hover:not(:disabled) {
          background: var(--accent-hover, #1d4ed8);
        }
        lexi-prompt-editor .toolbar button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        lexi-prompt-editor textarea {
          display: block;
          width: 100%;
          min-height: 280px;
          padding: var(--sp-3, 12px);
          font-family: var(--font-mono, ui-monospace, "SF Mono", Menlo, Monaco, monospace);
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-primary, #111827);
          background: var(--bg-input, #ffffff);
          border: 1px solid var(--border-subtle, #e5e7eb);
          border-radius: 6px;
          resize: vertical;
          box-sizing: border-box;
        }
        lexi-prompt-editor textarea:focus {
          outline: 2px solid var(--accent, #2563eb);
          outline-offset: -1px;
          border-color: var(--accent, #2563eb);
        }
      </style>
      <div class="toolbar">
        <span class="label">System prompt</span>
        ${this.dirty ? html`<span data-dirty>● unsaved</span>` : null}
        <span style="flex:1"></span>
        <button data-cancel @click=${this.onCancel} ?disabled=${!this.dirty}>Cancel</button>
        <button data-save @click=${this.onSave} ?disabled=${!this.dirty}>Save</button>
      </div>
      <textarea
        spellcheck="false"
        aria-label="System prompt"
        .value=${live(this.draft)}
        @input=${this.onInput}
      ></textarea>
    `;
  }
}
customElements.define('lexi-prompt-editor', LexiPromptEditor);
```

- [ ] **Step 4: Rebuild dashboard bundle**

Run: `npm run build:lexi`
Expected: Bundle rebuilds; check size remains under 400KB.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:e2e -- tests/lexi/e2e/views/prompt-editor.spec.ts`
Expected: PASS, all 3 cases green.

- [ ] **Step 6: Update audit row**

Edit `docs/audit/2026-05-web-polish-audit.md` row for `lexi-prompt-editor`: set `current_status: works`, note the fix.

- [ ] **Step 7: Commit**

```bash
git add src/lexi-dashboard/ui/components/lexi-prompt-editor.ts tests/lexi/e2e/views/prompt-editor.spec.ts docs/audit/2026-05-web-polish-audit.md
git commit -m "fix(lexi): style the prompt editor (toolbar + textarea + states)"
```

---

### Task C1: Delete the dead `lexi-home-view.ts`

**Files:**
- Delete: `src/lexi-dashboard/ui/components/lexi-home-view.ts`

- [ ] **Step 1: Confirm it's not imported anywhere**

Run: `grep -rE "from .*lexi-home-view|import.*lexi-home-view" src/ tests/ scripts/ --include="*.ts" 2>/dev/null`
Expected: zero matches (or only matches in the file being deleted).

- [ ] **Step 2: Confirm the router doesn't reference it**

Run: `grep -E "'home'.*=>|case 'home'" src/lexi-dashboard/ui/components/lexi-app.ts`
Expected: home route resolves to `lexi-today-view`, not `lexi-home-view`.

- [ ] **Step 3: Delete the file**

Run: `rm src/lexi-dashboard/ui/components/lexi-home-view.ts`

- [ ] **Step 4: Rebuild and run all tests**

```bash
npm run build:lexi && npm test && npm run test:e2e -- tests/lexi/e2e/dashboard.spec.ts
```
Expected: clean build, all unit tests pass, all existing E2E pass.

- [ ] **Step 5: Update audit doc**

Edit `docs/audit/2026-05-web-polish-audit.md` to remove the `lexi-home-view` reference (or note it as `deleted`).

- [ ] **Step 6: Commit**

```bash
git add -A src/lexi-dashboard/ui/components/lexi-home-view.ts docs/audit/2026-05-web-polish-audit.md
git commit -m "chore(lexi): delete unmounted lexi-home-view (dead code)"
```

---

### Task C2: Convert connections-view inline `style=""` to inline `<style>` block

**Files:**
- Modify: `src/lexi-dashboard/ui/components/connections/lexi-connections-view.ts`

- [ ] **Step 1: Read the current file**

Run: `wc -l src/lexi-dashboard/ui/components/connections/lexi-connections-view.ts`
Note the line count for diff context.

- [ ] **Step 2: Identify all inline `style=""` attributes**

Run: `grep -n 'style="' src/lexi-dashboard/ui/components/connections/lexi-connections-view.ts`
Capture the list. These will move into a single inline `<style>` block at the top of `render()`.

- [ ] **Step 3: Rewrite the view to use a `<style>` block**

Apply this pattern (the same one used by `lexi-cron-view` and the just-fixed `lexi-prompt-editor`):
- At the top of `render()` template, add `<style> ... </style>` containing the consolidated CSS, scoped via the element tag selector `lexi-connections-view`.
- For each inline `style="prop: value"` attribute on a markup element: extract the rule into the `<style>` block under a class selector, then replace `style=""` with `class="…"` on the element.
- Keep all existing class names; add new ones only where needed for the extracted rules.

- [ ] **Step 4: Rebuild and verify**

```bash
npm run build:lexi
npm run test:e2e -- tests/lexi/e2e/dashboard.spec.ts
```
Expected: connections section content test still passes.

- [ ] **Step 5: Visual sanity check**

Open `http://localhost:3030/#/connections` after rebuild. Compare against the audit's evidence screenshot from Task B2. Layout should be identical.

- [ ] **Step 6: Update audit row**

Edit the connections row in the audit doc: note inline-style consolidation complete.

- [ ] **Step 7: Commit**

```bash
git add src/lexi-dashboard/ui/components/connections/lexi-connections-view.ts docs/audit/2026-05-web-polish-audit.md
git commit -m "refactor(lexi): consolidate connections-view inline styles into <style> block"
```

---

### Task C-loop: Audit-discovered fixes

After Phase B completes, every audit row marked `broken` or `partial`, or every `gap:` annotation in `a11y_status` / `empty_error_loading`, becomes one Phase C task. Each follows this template:

**Files (per fix):**
- Modify: `<view-source>.ts` (specific path determined by the audit row)
- Modify: `docs/audit/2026-05-web-polish-audit.md` (the row being fixed)
- Test: `tests/lexi/e2e/views/<route>.spec.ts` (added or extended)

**Procedure (per fix):**

- [ ] **Step 1: Write a failing E2E test that asserts the fixed behavior**
  - Test file: `tests/lexi/e2e/views/<route>.spec.ts`
  - Pattern: same shape as `prompt-editor.spec.ts` from Task C0 — `test.beforeEach` skips on no dashboard, then specific assertion.
- [ ] **Step 2: Run the test to confirm it fails for the right reason**
  - Run: `npm run test:e2e -- tests/lexi/e2e/views/<route>.spec.ts`
  - Expected: FAIL with the symptom described in the audit row.
- [ ] **Step 3: Apply the minimal fix**
  - Edit the view source. Stay within the existing styling/structure pattern of the file.
- [ ] **Step 4: Rebuild and re-run the test**
  - Run: `npm run build:lexi && npm run test:e2e -- tests/lexi/e2e/views/<route>.spec.ts`
  - Expected: PASS.
- [ ] **Step 5: Run full E2E to confirm no regression**
  - Run: `npm run test:e2e`
  - Expected: All pass.
- [ ] **Step 6: Update audit row to `works` / `pass` / etc.**
- [ ] **Step 7: Commit**
  - `git commit -m "fix(<route>): <one-line summary from audit row>"`

The full list of C-loop tasks is generated *during* execution — one per finding from Phase B. The plan executor adds them to its task list as they're discovered. Each finding is one bite-sized task per the procedure above.

---

### Task C-globals: Global shell-v2.css polish

**Files:**
- Modify: `src/lexi-dashboard/ui/shell-v2.css`

- [ ] **Step 1: Inventory shell-v2.css gaps from audit**

Open `docs/audit/2026-05-web-polish-audit.md`, collect any `a11y_status` gap that's about focus rings, contrast, or globally-themable concerns. These get fixed in shell-v2.css rather than per-view.

- [ ] **Step 2: Add a global focus-ring rule if missing**

In `src/lexi-dashboard/ui/shell-v2.css`, after the existing display:block rule, add:

```css
/* Audit 2026-05: visible focus everywhere, suppressed for mouse users */
:where(button, a, [role="button"], input, textarea, select):focus-visible {
  outline: 2px solid var(--accent, #2563eb);
  outline-offset: 2px;
  border-radius: 4px;
}

/* WCAG AA contrast for muted text */
:root {
  --text-muted: #4b5563; /* was #6b7280 — bumped for AA on light bg */
}
:root[data-theme="dark"] {
  --text-muted: #9ca3af; /* AA on dark bg */
}
```

- [ ] **Step 3: Rebuild and visual-check**

Run: `npm run build:lexi`
Open `http://localhost:3030/#/agents` and Tab through the page. Visible focus rings should appear on every focusable element.

- [ ] **Step 4: Run all E2E**

Run: `npm run test:e2e`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lexi-dashboard/ui/shell-v2.css
git commit -m "fix(lexi): add global focus rings + WCAG AA muted-text contrast"
```

---

## Phase D — Test Build-out (Days 11-13)

Each of these tasks creates a category of test coverage across all 24 routes. They use the `LEXI_ROUTES` constant from Task A0 to drive test fan-out.

### Task D1: Per-route baseline E2E tests

**Files:**
- Create: `tests/lexi/e2e/views/all-routes.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/lexi/e2e/views/all-routes.spec.ts
import { test, expect } from '@playwright/test';
import { LEXI_ROUTES } from '../helpers/route-list';

test.beforeEach(async ({ page }) => {
  const r = await page.goto('/').catch(() => null);
  if (!r || r.status() >= 400) test.skip(true, 'dashboard not running on :3030');
});

for (const { route, tag } of LEXI_ROUTES) {
  test.describe(`#/${route}`, () => {
    test('mounts the expected component tag', async ({ page }) => {
      await page.goto(`/#/${route}`);
      await expect(page.locator(tag)).toBeVisible({ timeout: 5000 });
    });

    test('component has non-zero rendered dimensions', async ({ page }) => {
      await page.goto(`/#/${route}`);
      const el = page.locator(tag);
      await expect(el).toBeVisible({ timeout: 5000 });
      const box = await el.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThan(0);
      expect(box!.width).toBeGreaterThan(0);
    });

    test('no console errors after navigation', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      await page.goto(`/#/${route}`);
      await expect(page.locator(tag)).toBeVisible({ timeout: 5000 });
      // Allow 500ms for late async errors
      await page.waitForTimeout(500);
      expect(errors).toEqual([]);
    });
  });
}
```

- [ ] **Step 2: Run the spec**

Run: `npm run test:e2e -- tests/lexi/e2e/views/all-routes.spec.ts`
Expected: 72 tests (24 routes × 3 tests each), all pass. Any failure here is a real regression — fix or escalate.

- [ ] **Step 3: Commit**

```bash
git add tests/lexi/e2e/views/all-routes.spec.ts
git commit -m "test(lexi): per-route baseline E2E (mount, dims, no console errors)"
```

---

### Task D2: Per-route a11y spec

**Files:**
- Create: `tests/lexi/e2e/a11y/all-routes.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/lexi/e2e/a11y/all-routes.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, getViolations } from 'axe-playwright';
import { LEXI_ROUTES } from '../helpers/route-list';

test.beforeEach(async ({ page }) => {
  const r = await page.goto('/').catch(() => null);
  if (!r || r.status() >= 400) test.skip(true, 'dashboard not running on :3030');
});

for (const { route, tag } of LEXI_ROUTES) {
  test(`a11y: #/${route} has no serious or critical violations`, async ({ page }) => {
    await page.goto(`/#/${route}`);
    await page.waitForSelector(tag, { timeout: 5000 });
    await injectAxe(page);
    const violations = await getViolations(page);
    const blocking = violations.filter((v) =>
      v.impact === 'serious' || v.impact === 'critical'
    );
    if (blocking.length > 0) {
      const summary = blocking.map((v) =>
        `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`
      ).join('\n');
      throw new Error(`a11y blocking violations on #/${route}:\n${summary}`);
    }
    expect(blocking).toEqual([]);
  });
}
```

- [ ] **Step 2: Run the spec**

Run: `npm run test:e2e -- tests/lexi/e2e/a11y/all-routes.spec.ts`
Expected: 24 tests. Any failure surfaces a real a11y gap — file as a C-loop fix task and resolve before Phase E.

- [ ] **Step 3: Commit**

```bash
git add tests/lexi/e2e/a11y/all-routes.spec.ts
git commit -m "test(lexi): per-route axe-playwright a11y baseline (serious+critical)"
```

---

### Task D3: Per-route visual baselines

**Files:**
- Create: `tests/lexi/e2e/visual/all-routes.spec.ts`
- Create: `tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/*.png` (auto-created on first run)

- [ ] **Step 1: Write the spec**

```ts
// tests/lexi/e2e/visual/all-routes.spec.ts
import { test, expect } from '@playwright/test';
import { LEXI_ROUTES } from '../helpers/route-list';

test.beforeEach(async ({ page }) => {
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
      // Allow async data + transitions to settle
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

- [ ] **Step 2: Generate baseline screenshots**

Run: `npm run test:e2e -- tests/lexi/e2e/visual/all-routes.spec.ts --update-snapshots`
Expected: 48 screenshots written to `tests/lexi/e2e/visual/all-routes.spec.ts-snapshots/`.

- [ ] **Step 3: Manually review each snapshot**

Open each PNG. Confirm:
- Component is rendered (not blank, not collapsed)
- Layout looks intentional
- No unstyled overflow or zero-height children

If any snapshot looks wrong, the underlying view has a bug — file as a C-loop task and re-baseline after fix.

- [ ] **Step 4: Run again to confirm clean baseline**

Run: `npm run test:e2e -- tests/lexi/e2e/visual/all-routes.spec.ts`
Expected: 48 tests pass against the just-captured baselines.

- [ ] **Step 5: Commit**

```bash
git add tests/lexi/e2e/visual/all-routes.spec.ts tests/lexi/e2e/visual/all-routes.spec.ts-snapshots
git commit -m "test(lexi): visual baselines for 24 routes at 1280 + 1440"
```

---

### Task D4: Empty / error / loading state coverage

**Files:**
- Create: `tests/lexi/e2e/states/all-routes.spec.ts`

The state-coverage spec is more involved because it requires per-route knowledge of which API call to block. The audit document's `empty_error_loading` field tells you, per route, what the relevant request URL is.

- [ ] **Step 1: Write the spec**

```ts
// tests/lexi/e2e/states/all-routes.spec.ts
import { test, expect } from '@playwright/test';
import { LEXI_ROUTES } from '../helpers/route-list';

// Per-route async request URLs derived from the audit's `empty_error_loading`
// field. Routes without async data are listed in NO_ASYNC and skip the test.
const ASYNC_ENDPOINTS: Record<string, string> = {
  agents:     '**/api/agents**',
  connections:'**/api/connections**',
  cron:       '**/api/cron**',
  memory:     '**/api/memory**',
  vault:      '**/api/vault-file**',
  workflows:  '**/api/workflows**',
  advisor:    '**/api/advisor**',
  approvals:  '**/api/approvals**',
  brain:      '**/api/brain**',
  budget:     '**/api/budget**',
  build:      '**/api/build**',
  chat:       '**/api/chat**',
  claims:     '**/api/claims**',
  heartbeat:  '**/api/heartbeat**',
  logs:       '**/api/logs**',
  plans:      '**/api/plans**',
  projects:   '**/api/projects**',
  routines:   '**/api/routines**',
  search:     '**/api/search**',
  skills:     '**/api/skills**',
  team:       '**/api/team**',
  today:      '**/api/today**',
  trace:      '**/api/trace**',
};
const NO_ASYNC = new Set(['settings']); // pure-form view, no async data

test.beforeEach(async ({ page }) => {
  const r = await page.goto('/').catch(() => null);
  if (!r || r.status() >= 400) test.skip(true, 'dashboard not running on :3030');
});

for (const { route, tag } of LEXI_ROUTES) {
  if (NO_ASYNC.has(route)) continue;
  const endpoint = ASYNC_ENDPOINTS[route];
  if (!endpoint) continue;

  test.describe(`states: #/${route}`, () => {
    test('error state renders without crashing the view', async ({ page }) => {
      await page.route(endpoint, (r) => r.fulfill({ status: 500, body: '{"error":"forced"}' }));
      await page.goto(`/#/${route}`);
      await expect(page.locator(tag)).toBeVisible({ timeout: 5000 });
      // The view must render *something* — not be empty, not throw, not be 0-height
      const box = await page.locator(tag).boundingBox();
      expect(box!.height).toBeGreaterThan(40);
    });

    test('empty state renders without crashing the view', async ({ page }) => {
      await page.route(endpoint, (r) => r.fulfill({ status: 200, body: '[]' }));
      await page.goto(`/#/${route}`);
      await expect(page.locator(tag)).toBeVisible({ timeout: 5000 });
      const box = await page.locator(tag).boundingBox();
      expect(box!.height).toBeGreaterThan(40);
    });

    test('loading state does not flash zero-height layout', async ({ page }) => {
      await page.route(endpoint, async (r) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await r.continue();
      });
      const navPromise = page.goto(`/#/${route}`);
      // Mid-load: component should already be visible with non-zero height
      await page.waitForSelector(tag, { timeout: 1000 });
      const box = await page.locator(tag).boundingBox();
      expect(box!.height).toBeGreaterThan(40);
      await navPromise;
    });
  });
}
```

- [ ] **Step 2: Run the spec**

Run: `npm run test:e2e -- tests/lexi/e2e/states/all-routes.spec.ts`
Expected: ~69 tests (23 routes × 3 states). Failures here surface real empty/error/loading gaps — each gap = one C-loop fix task.

- [ ] **Step 3: Commit**

```bash
git add tests/lexi/e2e/states/all-routes.spec.ts
git commit -m "test(lexi): empty/error/loading state coverage for 23 async routes"
```

---

### Task D5: Bundle size + CI verification

**Files:**
- (none — verification step)

- [ ] **Step 1: Verify bundle size threshold**

Run: `node scripts/check-bundle-size.mjs 2>/dev/null || ls -lh dist/lexi-dashboard/main.js`
Expected: Bundle size under 400KB. If over, identify what was added; either trim or raise threshold with a one-line justification in the test (rare — most polish doesn't grow the bundle).

- [ ] **Step 2: Run the full test suite**

Run: `npm test && npm run test:e2e`
Expected: All unit tests pass, all E2E specs pass. Total E2E count should be ~72 (D1) + ~24 (D2) + ~48 (D3) + ~69 (D4) + ~17 (existing dashboard.spec.ts) + ~3 (prompt-editor.spec.ts) = ~233 E2E tests. (The Spec 1 target of "~120" was conservative; we're well above.)

- [ ] **Step 3: Verify no console errors during full suite**

The D1 spec already checks for console errors per route. Also confirm visually by skimming the run output.

---

## Phase E — Freeze (Days 14-15)

### Task E1: Final audit document pass

**Files:**
- Modify: `docs/audit/2026-05-web-polish-audit.md`

- [ ] **Step 1: Walk every audit row**

For each row, confirm:
- `current_status: works`
- `e2e_coverage: full` (covered by D1+D4 specs)
- `a11y_status: pass` (covered by D2)
- `empty_error_loading: pass` (covered by D4)

Anything not in this state is either:
- Fixed via a C-loop task before proceeding, OR
- Explicitly deferred with a one-line justification in the row

- [ ] **Step 2: Mark the document `complete`**

Edit the header:
```markdown
**Status:** complete
**Completed:** YYYY-MM-DD
```

- [ ] **Step 3: Commit**

```bash
git add docs/audit/2026-05-web-polish-audit.md
git commit -m "audit(lexi): mark web polish audit complete"
```

---

### Task E2: Tag the freeze commit

**Files:**
- (none — git tag operation)

- [ ] **Step 1: Verify clean working tree**

Run: `git status`
Expected: nothing to commit.

- [ ] **Step 2: Verify CI is green on remote**

Run: `git push origin lexi-dashboard`
Then check CI status (GitHub Actions or wherever). Expected: all checks green.

- [ ] **Step 3: Create freeze tag**

Run: `git tag -a web-frozen-$(date +%Y-%m-%d) -m "Lexi web dashboard frozen after Track 1 polish (Spec 1)"`

- [ ] **Step 4: Push the tag**

Run: `git push origin web-frozen-$(date +%Y-%m-%d)`

- [ ] **Step 5: Open the door for Spec 2**

Edit `docs/superpowers/specs/2026-05-06-lexi-vision-roadmap.md`, in the "Track 2A — Repo migration" row: set `Status:` from "TBD" to "Ready to design — Spec 2A can be written".

```bash
git add docs/superpowers/specs/2026-05-06-lexi-vision-roadmap.md
git commit -m "docs(roadmap): Track 1 frozen; Track 2A ready for spec"
git push origin lexi-dashboard
```

---

## Self-review

**Spec coverage check** — every section of `2026-05-06-lexi-web-polish-heavy-design.md`:

- §1 Goals & Done Bar — 6 done-bar criteria covered:
  - (1) Functional audit: Phase B (B1–B25)
  - (2) Visual audit: D3 visual baselines + Phase B visual pass
  - (3) Playwright E2E: D1 (72 tests) — meets/exceeds 120 target
  - (4) A11y: D2 + C-globals (focus rings, contrast)
  - (5) Empty/error/loading: D4
  - (6) Green CI: D5 + E2
- §2 Audit Methodology — encoded as B0 procedure + B1–B25 fan-out
- §3 Scope (24 views) — encoded as `LEXI_ROUTES` (Task A0); cross-cutting components in B25
- §4 Component & file inventory — covered in "File structure overview" + per-task `Files:` blocks
- §5 Testing strategy — D1 (E2E), D2 (a11y), D3 (visual), D4 (states), D5 (bundle/CI)
- §6 Phasing (3 weeks, day-by-day) — Phases A/B/C/D/E aligned to days 1 / 2-5 / 6-10 / 11-13 / 14-15
- §7 Known issues — C0 (prompt editor), C1 (dead lexi-home-view), C2 (connections inline-style consolidation); cross-cutting bottom-drawer + view-stacking concerns are exercised by D1's "no console errors" coverage and D4's state coverage
- §8 Risks & open questions — risk mitigations baked into phasing (timebox Week 1, etc.); open questions (audit doc format) resolved in A3 by going markdown

**Placeholder scan:** Searched plan for "TBD", "TODO", "implement later", "similar to". The only "TBD" is in the vision-roadmap reference inside Task E2, which is the legitimate state of Spec 2A before Track 1 lands. The C-loop task is structured (not a placeholder) — it provides a complete procedure executed N times where N comes from audit findings; this is the correct shape for "fix-loop based on audit output."

**Type consistency:** `LEXI_ROUTES` shape is defined once in A0 and reused by D1/D2/D3/D4. `Interaction` interface defined once in A2. `extractInteractions` named consistently across A2 test + impl. Audit row schema defined once in A3 and updated by every B-task in the same shape.

**Final task count:**
- Phase A: 4 tasks (A0–A3)
- Phase B: 25 tasks (B1–B25; B0 is reference, not executable)
- Phase C: 3 known + N audit-discovered (C0, C1, C2, C-loop×N, C-globals)
- Phase D: 5 tasks (D1–D5)
- Phase E: 2 tasks (E1, E2)

Total minimum: ~39 tasks. With audit-discovered C-loop fixes, expected ~50-70 tasks total.
