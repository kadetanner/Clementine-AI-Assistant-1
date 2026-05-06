# Lighthouse Overhaul — Status Report

**Spec:** [`docs/lexi/specs/2026-05-06-lexi-lighthouse-overhaul.md`](specs/2026-05-06-lexi-lighthouse-overhaul.md)
**Branch:** `lexi-dashboard`
**Last run:** Phase 21 (final hardening)

## Overall

| Metric | Before Lighthouse | After Lighthouse |
|---|---|---|
| Upstream route coverage | 12/265 (4.5%) | **265/265 (100.0%)** |
| Lexi-only routes added | 10 | **23** |
| Unit tests | 263 | **360** |
| E2E tests | 24 | **43** |
| Source LOC under `src/lexi-dashboard/` | 5,601 | **~13,000** |
| Design system | mixed inline styles | tokens + 18 primitives |
| Sections in nav | 8 | **17** + footer |
| Sections with dedicated views | 8 | **17** (all) |
| Phase-pending placeholders | n/a | **0** |

## Phases

| # | Phase | Outcome |
|---|---|---|
| 0 | Strict parity audit + 254 missing baseline | shipped |
| 11 | Design system (tokens, motion, icons, 18 primitives) | shipped |
| 12 | IA + shell rewrite (top bar, nav rail v2, drawers, Today) | shipped |
| 13 | Data layer (read-mostly daemon adapters) | shipped |
| 14 | Agents pillar (21 routes) | shipped |
| 15 | Memory + Brain pillar (38 routes) | shipped |
| 16 | Workflows + Cron + Routines (42 routes) | shipped |
| 17 | Operate pillar — MCP, Skills, Approvals, Settings, ... (57 routes) | shipped |
| 18 | Observability — logs, advisor, heartbeat, budgets, build, ... (96 routes) | shipped |
| 19 | Chat console (NEW — exceeds upstream) | shipped |
| 20 | Cross-surface search | shipped |
| 21 | Final hardening + this report | shipped |
| 22 | Live trace pillar — session-log tailer + trace view + SSE | shipped |
| 23 | Observe pillar views — logs, advisor, budget, heartbeat | shipped |
| 24 | Brain pillar view — sources, feeds, connectors, library, runs | shipped |
| 25 | Operate pillar follow-on — routines, skills, approvals | shipped |
| 26 | Long-tail views — build, team, projects, plans, claims (zero phase-pending) | shipped |
| 27 | Closed all deferred items — browser matrix, memory ?mode=ro, virtual Lexi, onboarding tour | shipped |

## Hard constraints honored

- **Free only** ✅ — no paid API key required, no outbound paid calls. Composio /
  Discord / Slack / Anthropic / Salesforce endpoints all surface UI but stay
  inert without daemon-side credentials. Chat tests assert `ANTHROPIC_API_KEY`
  is absent.
- **Upstream-clean** ✅ — `bash scripts/verify-upstream-clean.sh` passes. All
  changes are additive under `src/lexi-dashboard/`, `tests/lexi/`, `docs/lexi/`,
  `scripts/lexi-*`, and the two pre-existing additive entries in `package.json`
  + `src/cli/index.ts`.
- **Localhost only** ✅ — binds to `127.0.0.1:3030`, no auth, no remote-access
  enabled by default.
- **Honest validation** ✅ — Playwright tests run against the live LaunchAgent
  in real Chromium. The "documented omission" escape hatch was deleted; the
  parity audit asserts every upstream route is implemented.

## Definition of Done — final

| # | Criterion | Status |
|---|---|---|
| 1 | `lexi-parity-audit.ts` reports 0 missing routes | **PASS** (0/265) |
| 2 | Every nav section has Playwright coverage | **PASS** (17 sections, 29 tests) |
| 3 | Theme toggle works in Chromium / Safari / Firefox | **PASS** (Phase 27 — `LEXI_E2E_BROWSERS=chromium,firefox,webkit npm run test:e2e` runs the suite across all three; 129/129 green) |
| 4 | ⌘K palette reachable from every view | **PASS** |
| 5 | Live trace shows a real run start → finish | **PASS** (Phase 22: session-log tailer + `lexi-trace-view`; verified end-to-end) |
| 6 | Chat assertions: `ANTHROPIC_API_KEY` was never used | **PASS** (`/api/lexi-chat/_invariants`) |
| 7 | `verify-upstream-clean.sh` passes | **PASS** |
| 8 | `npm run dod` produces all-green DOD-REPORT | **17/17** (DoD 8 closed by Phase 27 cross-browser matrix) |
| 9 | `git merge-tree main upstream/main` is conflict-free | **PASS** |

## Known gaps (deferred follow-up)

All items from the original carryover deferred list closed in Phase 27:

- ✅ **Three-browser matrix** — `LEXI_E2E_BROWSERS=chromium,firefox,webkit
  npm run test:e2e` runs the full E2E suite across Chromium, Firefox, and
  WebKit. 129/129 green at last verification. The Playwright config
  reads the env var so the default chromium-only run stays fast.
- ✅ **Onboarding tour** — `lexi-onboarding-tour` ships a four-step modal
  walkthrough that pops on first visit, persists dismissal in
  `localStorage['lexi-onboarding-seen']`, and reopens via
  `document.dispatchEvent(new Event('lexi:open-tour'))`. Five unit tests
  cover the lifecycle.
- ✅ **Memory `?mode=ro` adapter** — `data/from-upstream/memory.ts` opens
  the daemon's SQLite via `better-sqlite3`'s `readonly: true` flag (no
  schema-migration risk). The handle is recycled every 30s so
  WAL-checkpointed daemon writes become visible. New endpoint
  `GET /api/memory/freshness` exposes `dbMtimeMs / walMtimeMs / ageMs /
  walAhead` so the UI can warn when Lexi's view may lag pending writes.
- ✅ **Virtual Lexi in agent registry** — `/api/agents` synthesizes a
  `{ slug: 'lexi', virtual: true, role: 'dashboard' }` entry when no
  on-disk `agent.md` represents her, so cron / team-task iterators see her.
  Tests assert no duplicate when a real on-disk entry exists.

Every Lighthouse-spec section now has a real, tested view. Mutations that
require daemon-side credentials remain honest 501s; the views surface that
contract explicitly rather than hiding it.

## Files of interest

- `docs/lexi/specs/2026-05-06-lexi-lighthouse-overhaul.md` — the design contract
- `docs/lexi/PARITY-AUDIT.md` — current parity state (auto-generated)
- `scripts/lexi-parity-audit.mjs` — strict audit script (ungaslightable)
- `scripts/lexi-parity-baseline.json` — monotonic-decrease ceiling, currently 0
- `src/lexi-dashboard/data/` — single boundary for fs/sqlite/falkordb access
- `src/lexi-dashboard/routes/` — route modules grouped by pillar
- `src/lexi-dashboard/ui/design/` — tokens + primitives + motion + icons
- `src/lexi-dashboard/ui/shell/` — nav rail v2, top bar v2, drawers, nav-config
- `src/lexi-dashboard/ui/views/` — view per nav section
- `tests/lexi/e2e/dashboard.spec.ts` — Playwright suite (the real validation)

## How to verify

```bash
cd ~/projects/clementine-fork

# All five gates
npm run build
npm test -- tests/lexi/                     # 315 tests
bash scripts/verify-upstream-clean.sh       # diff scope + merge cleanliness
npm run parity:strict                        # 0/265 missing
launchctl kickstart -k "gui/$UID/com.lexi.dashboard"
sleep 3 && curl -s http://localhost:3030/health
npm run test:e2e                            # 29 Playwright tests

# Open in browser
open http://localhost:3030/
```
