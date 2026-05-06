# Lexi Dashboard v2 — "Lighthouse" Overhaul

**Spec date:** 2026-05-06
**Branch:** `lexi-dashboard`
**Supersedes:** `2026-05-02-lexi-dashboard-design.md` (the v1 parallel-dashboard spec)
**Status:** approved scope, awaiting user spec review before implementation

---

## 1. Why we are doing this

The v1 Lexi dashboard shipped 12 of upstream's 265 routes and called the rest "intentional omissions." In practice that produced a dashboard that is a major **degradation** from the upstream `clementine-agent` dashboard, not an upgrade. The user's requirement is that Lexi **far exceed** upstream's dashboard in both function and usefulness, while preserving the constraint that upstream pulls remain seamless.

This spec replaces the parallel-but-narrower frame with a parallel-and-superset frame: every upstream feature has a Lexi answer, organized in a Linear-precision IA, with four new pillars on top (live observability, deep memory/knowledge browser, full workflow control, daemon-CLI chat console).

## 2. Hard constraints (invariants)

These are non-negotiable. Every plan, change, and PR is gated on them.

1. **Free only.** No paid API calls. No Anthropic/OpenAI/Composio/etc. spend triggered by the dashboard or its tests. Features that *can* use paid keys ship with a "configure to enable" UI that cannot make outbound calls until the user explicitly provides credentials and toggles them on. A small explicit dev/test budget (≤$0) is allowed only if the user opts in via a dedicated flag — default is zero.
2. **Upstream-clean.** Zero edits to upstream files. The two pre-existing additive entries (`package.json` script + `src/cli/index.ts` Lexi subcommand) remain the only exceptions. Every new file lives under `src/lexi-dashboard/`, `tests/lexi/`, `docs/lexi/`, `scripts/` (Lexi-prefixed only), or `tools/lexi/`. `bash scripts/verify-upstream-clean.sh` is a hard gate before any push.
3. **Localhost only.** Lexi binds to `127.0.0.1:3030` and serves no auth (per user decision). No outbound network beyond user-configured connectors.
4. **Honest validation.** No DoD checks that test abstractions instead of behavior. Every claim of "works" must be backed by a real-browser Playwright assertion against the live LaunchAgent.
5. **Conventions-locked stays in force.** Decorator-FREE Lit + light DOM + CSS custom properties. ESM. `execFileSync` only. No `innerHTML` in tests/components. Routes aggregator pattern.
6. **Superset enforcement.** A `scripts/lexi-parity-audit.ts` audit runs in CI and asserts every upstream route in `src/cli/dashboard.ts` has a Lexi equivalent. **Documented omissions are no longer an escape hatch.** A route is either implemented (with a passing E2E) or explicitly excluded with a one-line rationale that itself must justify *why* the user wouldn't want it.

## 3. Architecture

```
src/lexi-dashboard/
│
├─ server.ts                  # frozen since v1 plan 2 task 1
├─ routes.ts                  # aggregator only
│
├─ data/                      # data sources — only place that touches daemon files / sqlite / fs
│   ├─ from-upstream/         # adapters that import upstream singletons where possible
│   │   ├─ agents.ts
│   │   ├─ memory.ts          # daemon SQLite ?mode=ro&immutable=0 + FalkorDB read-only
│   │   ├─ brain.ts           # sources, feeds, connectors, runs, library
│   │   ├─ builder.ts         # workflows, validation, runs
│   │   ├─ heartbeat.ts
│   │   ├─ advisor.ts
│   │   ├─ budgets.ts
│   │   ├─ mcp.ts             # servers, permissions, status
│   │   ├─ approvals.ts
│   │   ├─ skills.ts
│   │   ├─ cron.ts            # jobs + attachments + prompt history + traces + broken-jobs
│   │   ├─ routines.ts
│   │   ├─ vault.ts
│   │   ├─ logs.ts
│   │   ├─ home-digest.ts
│   │   ├─ team.ts
│   │   ├─ projects.ts
│   │   ├─ plans.ts
│   │   ├─ claims.ts
│   │   ├─ self-improve.ts
│   │   ├─ user-model.ts
│   │   ├─ unleashed.ts
│   │   ├─ cli-tools.ts
│   │   ├─ workspace-dirs.ts
│   │   ├─ profiles.ts
│   │   ├─ metrics.ts
│   │   ├─ recall-traces.ts
│   │   ├─ tool-preferences.ts
│   │   ├─ assistant-preferences.ts
│   │   ├─ background-tasks.ts
│   │   ├─ timers.ts
│   │   └─ webhook-actions.ts
│   └─ lexi-native/
│       ├─ chat-sessions.ts   # ephemeral session ids → spawned CLI processes
│       ├─ trace-store.ts     # per-run event timeline (in-memory, SSE-replayable)
│       ├─ pin-store.ts       # user pinned items (cron, agent, vault path)
│       ├─ search-index.ts    # FTS over vault + memory + cron + chat
│       └─ notifications.ts   # aggregated alerts feed
│
├─ routes/
│   ├─ agents.ts              # 21 routes
│   ├─ memory.ts              # 21
│   ├─ brain.ts               # 20
│   ├─ builder.ts             # 17
│   ├─ cron.ts                # 16
│   ├─ routines.ts            # 12
│   ├─ team.ts                # 7
│   ├─ skills.ts              # 7
│   ├─ composio.ts            # 6 (UI works, calls gated behind user-configured key)
│   ├─ budgets.ts             # 6
│   ├─ advisor.ts             # 6
│   ├─ remote-access.ts       # 5
│   ├─ plans.ts               # 5
│   ├─ heartbeat.ts           # 5
│   ├─ user-model.ts          # 4
│   ├─ unleashed.ts           # 4
│   ├─ sessions.ts            # 4 (read-only — no login UI in Lexi)
│   ├─ self-improve.ts        # 4
│   ├─ mcp-servers.ts         # 4
│   ├─ cli-tools.ts           # 4
│   ├─ claims.ts              # 4
│   ├─ workspace-dirs.ts      # 3
│   ├─ setup.ts               # 3
│   ├─ settings.ts            # 3
│   ├─ projects.ts            # 3
│   ├─ background-tasks.ts    # 3
│   ├─ tool-preferences.ts    # 2
│   ├─ timers.ts              # 2
│   ├─ salesforce.ts          # 2
│   ├─ recall-traces.ts       # 2
│   ├─ profiles.ts            # 2
│   ├─ metrics.ts             # 2
│   ├─ chat-upstream.ts       # 2 (upstream's existing chat routes; pass-through)
│   ├─ build.ts               # 2 (build/operations + build/usage)
│   ├─ assistant-preferences.ts # 2
│   ├─ approvals.ts           # 2
│   ├─ misc.ts                # the long tail of single-route namespaces
│   │
│   ├─ chat/                  # NEW: pillar — daemon CLI per-turn, SSE stream
│   ├─ trace/                 # NEW: pillar — live agent run trace
│   ├─ search/                # NEW: pillar — cross-surface search
│   └─ notifications/         # NEW: aggregated alerts feed
│
├─ proxy/                     # legacy from v1; trims as routes/ takes over
├─ events/                    # SSE bus + tap registrations
│   ├─ bus.ts
│   ├─ sse.ts
│   ├─ types.ts               # adds 14 new event types (see §6)
│   └─ upstream-taps.ts
├─ fixes/                     # legacy v1 broken-endpoint patches; kept for now
│
├─ ui/
│   ├─ design/
│   │   ├─ tokens.css         # one source of truth for color/space/type/motion
│   │   ├─ motion.ts          # canonical timings + easings + reduce-motion
│   │   ├─ icons.ts           # Heroicons-outline subset, tree-shaken, SVG only
│   │   └─ primitives/
│   │       ├─ lx-button.ts
│   │       ├─ lx-card.ts
│   │       ├─ lx-table.ts    # virtualized
│   │       ├─ lx-input.ts
│   │       ├─ lx-textarea.ts
│   │       ├─ lx-select.ts
│   │       ├─ lx-segmented.ts
│   │       ├─ lx-toggle.ts
│   │       ├─ lx-badge.ts
│   │       ├─ lx-pill.ts
│   │       ├─ lx-tag-input.ts
│   │       ├─ lx-popover.ts
│   │       ├─ lx-tooltip.ts
│   │       ├─ lx-dialog.ts
│   │       ├─ lx-drawer.ts
│   │       ├─ lx-sheet.ts
│   │       ├─ lx-tabs.ts
│   │       ├─ lx-breadcrumbs.ts
│   │       ├─ lx-empty-state.ts
│   │       ├─ lx-skeleton.ts
│   │       ├─ lx-toast.ts
│   │       ├─ lx-kbd.ts
│   │       ├─ lx-status-dot.ts
│   │       ├─ lx-avatar.ts
│   │       ├─ lx-meter.ts
│   │       ├─ lx-spark.ts    # 24px sparkline svg
│   │       ├─ lx-bar.ts      # tiny bar chart
│   │       ├─ lx-diff.ts
│   │       └─ lx-code.ts     # syntax-highlighted via vendored highlight.js subset
│   │
│   ├─ shell/
│   │   ├─ lexi-app.ts        # SPA router (existing; revamped renderRoute)
│   │   ├─ lexi-top-bar.ts    # logo · breadcrumbs · global actions · doctor dot
│   │   ├─ lexi-nav-rail.ts   # 12 nav items, ⌘1-9 shortcuts
│   │   ├─ lexi-command-palette.ts  # ⌘K — entities + actions + nav
│   │   ├─ lexi-notifications-drawer.ts
│   │   └─ lexi-system-map.ts # stuck jobs · failed runs · MCP red dots · budget alerts
│   │
│   ├─ views/
│   │   ├─ lexi-today-view.ts        # home — Today panel + at-a-glance + Now Playing
│   │   ├─ lexi-agents-view.ts       # list + detail + tabs
│   │   ├─ lexi-agent-detail-view.ts # KPIs · transcripts · audit · budget · pipeline · revisions · skills · stats · logs · health · activity
│   │   ├─ lexi-agent-compare-view.ts
│   │   ├─ lexi-workflows-view.ts    # list + visual builder + dry-run + history
│   │   ├─ lexi-cron-view.ts         # schedule · history · attachments · prompt-history · traces · broken-jobs
│   │   ├─ lexi-routines-view.ts
│   │   ├─ lexi-memory-view.ts       # chunks · search · graph · history · supersedes · episodes · learnings · commitments · coverage
│   │   ├─ lexi-brain-view.ts        # sources · feeds · connectors · library · runs · seed/preview/commit
│   │   ├─ lexi-vault-view.ts        # tree + read + edit
│   │   ├─ lexi-connections-view.ts  # MCP servers · permissions · OAuth · credentials · channels · discord · composio · claude-integrations · slack · salesforce
│   │   ├─ lexi-skills-view.ts
│   │   ├─ lexi-approvals-view.ts
│   │   ├─ lexi-budgets-view.ts
│   │   ├─ lexi-advisor-view.ts      # decisions · effectiveness · trends · analytics · events
│   │   ├─ lexi-logs-view.ts
│   │   ├─ lexi-heartbeat-view.ts
│   │   ├─ lexi-autonomy-view.ts
│   │   ├─ lexi-build-view.ts        # build/operations + build/usage
│   │   ├─ lexi-team-view.ts
│   │   ├─ lexi-projects-view.ts
│   │   ├─ lexi-plans-view.ts
│   │   ├─ lexi-claims-view.ts
│   │   ├─ lexi-chat-view.ts         # NEW pillar
│   │   ├─ lexi-trace-view.ts        # NEW pillar — live agent run timeline
│   │   ├─ lexi-search-view.ts       # NEW — cross-surface
│   │   └─ lexi-settings-view.ts     # workspace-dirs · settings · profiles · user-model · unleashed · cli-tools · tool-preferences · assistant-preferences · timers · webhook-actions · setup
│   │
│   └─ state/
│       ├─ signals.ts                # tiny @lit-labs/preact-signals-style impl, no decorators
│       ├─ event-stream.ts           # existing — kept
│       ├─ pinned.ts
│       └─ recently-visited.ts
│
└─ scripts/
    ├─ lexi-parity-audit.ts          # the new strict audit (replaces upstream-omissions)
    └─ lexi-route-stub-generator.ts  # codegen stubs from upstream's route list
```

**Boundary discipline.** Views call routes. Routes call data sources. Data sources are the only thing that touches the filesystem, daemon SQLite, FalkorDB socket, or upstream singletons. This is a hard rule enforced by tests (`tests/lexi/architecture/no-fs-in-routes.test.ts`).

**Read-only file access for memory.** Per user decision, Lexi opens daemon's SQLite with `?mode=ro` and FalkorDB via the daemon's existing socket in read-only mode. Writes to memory always go through the daemon's own write-paths (e.g., shelling out to clementine's CLI for the few write operations). This keeps the daemon as the single writer and guarantees Lexi's view is always fresh.

**Import-first for routes.** For each upstream route, Lexi tries this in order:
1. Re-export the upstream handler if exported.
2. Import upstream services/utilities and reconstruct the handler in 3-10 lines.
3. Mirror the handler body verbatim into a Lexi-side module tagged `// MIRRORED FROM src/cli/dashboard.ts L<start>-<end>` and tracked by `lexi-parity-audit.ts` for drift.

## 4. Design system

**Aesthetic:** Linear-precision. Cyan single accent. Dark + light parity required.

### 4.1 Tokens (CSS custom properties)

```
/* Color — semantic */
--bg-canvas, --bg-panel, --bg-panel-2, --bg-overlay
--surface-1, --surface-2, --surface-3
--border-subtle, --border-default, --border-strong
--text-primary, --text-secondary, --text-tertiary, --text-disabled
--accent, --accent-soft, --accent-strong, --accent-fg
--positive, --warning, --danger
--positive-soft, --warning-soft, --danger-soft

/* Color — accent (cyan) */
--accent: oklch(80% 0.13 220);          /* dark mode */
--accent-soft: color-mix(in oklch, var(--accent) 18%, var(--bg-panel));
--accent-strong: oklch(72% 0.16 220);

/* Type */
--font-sans: ui-sans-serif, "Inter var", system-ui, sans-serif;
--font-mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace;
--text-xs: 11px / 14px;
--text-sm: 13px / 18px;
--text-base: 14px / 20px;
--text-lg: 16px / 22px;
--text-xl: 20px / 26px;
--text-2xl: 28px / 34px;
--num-xs: 11px / 14px var(--font-mono);   /* tabular numerics */

/* Space (4px grid) */
--space-1..--space-12

/* Radius */
--radius-sm: 4px; --radius-md: 6px; --radius-lg: 10px; --radius-pill: 999px;

/* Elevation — restrained */
--shadow-1, --shadow-2

/* Motion */
--ease-out: cubic-bezier(.2,.8,.2,1);
--ease-in:  cubic-bezier(.6,.2,.8,.4);
--dur-1: 80ms; --dur-2: 140ms; --dur-3: 220ms; --dur-4: 360ms;
@media (prefers-reduced-motion: reduce) { all durations → 0 }
```

### 4.2 Density

- Default density = comfortable. User can flip to **compact** (row height shrinks 24px → 20px, type from sm → xs in tables).
- Tabular numerics everywhere a number lives (counts, durations, sizes, money).
- Tables virtualize at ≥200 rows.

### 4.3 Motion principles

- View transitions use `document.startViewTransition` (with Plan 10's this-binding fix preserved).
- Single canonical "appear" (8px-up + opacity, dur-2) and "dismiss" (opacity, dur-1).
- Status changes pulse the badge once (dur-3, ease-out), no looping motion.
- Live event arrivals nudge their row (translateY 4px → 0, dur-2). Never longer than dur-3 for ambient updates.

### 4.4 Iconography

- Single Heroicons-outline subset, vendored as inline SVG strings in `icons.ts`.
- Stroke 1.5px. 16px or 20px sizes only.
- No mixed icon sets.

### 4.5 Empty states & errors

Every list view ships with an `lx-empty-state` first-class component:
- Icon, one-line headline, secondary copy, primary action.
- Errors render in the same shape, accent → danger, action = "Retry" + "Copy details".

## 5. Information architecture

12 nav items, grouped:

```
WORK
  Today
  Agents
  Workflows
  Cron
  Routines

KNOWLEDGE
  Memory
  Brain
  Vault

OPERATE
  Connections
  Skills
  Approvals
  Budget

OBSERVE
  Logs
  Advisor
  Heartbeat
  Build

CONSOLE
  Chat
  Trace

────────
Settings (footer)
```

Top bar:
- Lexi logo (returns to Today)
- Breadcrumbs (current view → entity)
- Global search (⌘K)
- System map status dot (red/amber/green) → opens drawer
- Notifications bell with unread count
- Theme toggle
- Settings cog

⌘K palette is the universal accelerator: nav, entity find (agents, cron, vault paths, memory chunks), actions ("run cron X", "open trace for run Y", "create routine"), and recent visits.

## 6. SSE event bus expansion

Adds 14 new event types (existing ones retained):

```
agent.run.started        agent.run.step          agent.run.tool-call
agent.run.tool-result    agent.run.token-usage   agent.run.completed
agent.run.failed         cron.tick.fired         cron.tick.completed
memory.write             memory.consolidation    brain.run.progress
budget.alert             notification.created
```

These power Now Playing, the Trace view, the Notifications drawer, and the System Map dot in real time.

## 7. Pillar deep-dives

### 7.1 Pillar — Live agent observability (exceeds upstream)

- **Trace view** (`lexi-trace-view.ts`) for any in-flight or recent agent run. Vertical timeline of: step boundary → tool call → tool result → token usage. Each tool call expandable to its full input/output JSON with `lx-code`. Red rows for errors. "Replay" button re-runs the same prompt against the agent (free, daemon-CLI).
- **Per-agent dashboard** (`lexi-agent-detail-view.ts`) with 9 tabs: Overview · KPIs · Transcripts · Audit · Budget · Pipeline · Revisions · Skills · Stats. Every upstream `/api/agents/:slug/*` route maps to a tab.
- **Agent compare** (`lexi-agent-compare-view.ts`) — side-by-side diff of two agents' configs, prompts, tools, recent KPIs.
- **System map dot** computes color from: stuck jobs > 0 → red, failed runs (last 1h) > 0 → amber, otherwise green. Click → drawer with affected items.

### 7.2 Pillar — Memory + Brain (exceeds upstream)

- **Chunk browser** with FTS search, supersedes-tree visualization, time-window filter, "show me all writes since X" diff replay.
- **Graph view** of FalkorDB — Cytoscape-rendered node graph (vendored, no network). Click node → side panel with related nodes + recent chunks.
- **Knowledge ingestion (Brain)** — full UI for sources, feeds, connectors, library; seed-preview-commit flow with progress streamed via SSE.
- **Episodes / learnings / commitments / coverage** — read-mostly views, all upstream routes mapped.

### 7.3 Pillar — Workflows (exceeds upstream)

- Drawflow visual builder retained (existing). Adds:
  - Node palette grouped by MCP source.
  - Connection validation in real time with red highlights.
  - Dry-run panel that shows the would-be output of each node without execution.
  - Run history per workflow with timing breakdown.
- Cron view becomes "schedules" — gantt-style next-fire preview, per-job traces, attachments, prompt history, broken-job recovery (existing).
- Routines (separate from cron) get their own view with toggle, dry-run, test, runs.

### 7.4 Pillar — Chat console (NEW; upstream has only API routes)

- `lexi-chat-view.ts` is a focused single-pane console.
- New session → spawns `clementine-agent <subcommand>` via `execFile` with the user's chosen agent slug.
- stdin from textarea, stdout streams back via a per-session SSE channel `/api/chat/stream/:id`.
- Multi-agent: pick from agents list, transcripts saved to `~/.clementine/lexi/chat/<id>.json`.
- ⌘J opens chat from any view as a slideover.
- **Strict no-API-spend invariant:** the daemon is the only thing that decides whether to call paid APIs; Lexi just talks to the daemon. No direct Anthropic SDK calls from Lexi server or browser bundle.

## 8. Feature parity coverage

The full upstream route inventory (265 routes across 70 namespaces) maps to Lexi as follows. Implementation status will be tracked by `scripts/lexi-parity-audit.ts`; the goal at end of overhaul is **100% implemented or explicit-rationale-excluded**.

| Namespace | Routes | Lexi view(s) |
|---|---|---|
| memory | 21 | Memory + parts of Brain |
| agents | 21 | Agents · Agent Detail · Compare |
| brain | 20 | Brain |
| builder | 17 | Workflows |
| cron | 16 | Cron |
| routines | 12 | Routines |
| team | 7 | Team |
| skills | 7 | Skills |
| composio | 6 | Connections (gated) |
| budgets | 6 | Budget |
| advisor | 6 | Advisor |
| remote-access | 5 | Connections (gated) |
| plans | 5 | Plans |
| heartbeat | 5 | Heartbeat |
| user-model | 4 | Settings |
| unleashed | 4 | Settings |
| sessions | 4 | (Lexi: read-only display in Settings; no login UI) |
| self-improve | 4 | Advisor |
| mcp-servers | 4 | Connections |
| cli-tools | 4 | Settings |
| claims | 4 | Claims |
| workspace-dirs | 3 | Settings |
| setup | 3 | Settings (first-run tour) |
| settings | 3 | Settings |
| projects | 3 | Projects |
| background-tasks | 3 | Today (cards) + Logs |
| auth | 3 | (Lexi: read-only; no Lexi auth surface) |
| tool-preferences | 2 | Settings |
| timers | 2 | Today |
| salesforce | 2 | Connections |
| recall-traces | 2 | Trace |
| profiles | 2 | Settings |
| metrics | 2 | Today + Build |
| chat (upstream) | 2 | Chat (pass-through to keep parity) |
| build | 2 | Build |
| assistant-preferences | 2 | Settings |
| approvals | 2 | Approvals |
| Long tail (1 each) | 30+ | mapped 1:1 to most contextually appropriate view |

**Excluded with rationale (initial set, may shrink during implementation):** none planned to be excluded. Every route gets implemented. If during implementation a route turns out to be a dead/internal-only endpoint with no UI value, it goes into `scripts/lexi-parity-audit.ts`'s `EXPLICITLY_INTERNAL` list with a one-line justification.

## 9. Phased delivery

11 phases. Each phase ends with: build → unit tests → Playwright E2E → upstream-clean → parity audit → atomic commit. I move to the next phase only after all five gates pass.

| # | Phase | Gate |
|---|---|---|
| 11 | Design system + tokens + primitives + icons + motion | All primitives have unit tests + storybook-style harness page at `/_lexi/primitives` |
| 12 | New IA + shell rewrite (top bar, nav rail, palette, drawers, system map) | Playwright walks every nav item; ⌘K resolves entity + action |
| 13 | Data layer (read-only daemon files, upstream singleton imports, lexi-native stores) | Architecture test asserts no fs/sqlite imports outside `data/`; sample reads against live daemon |
| 14 | Agents pillar (full superset of 21 routes) + agent detail + compare + trace store | E2E covers every tab, including live trace replay |
| 15 | Memory + Brain pillars (41 routes combined) | E2E search, graph nav, history replay, supersedes tree |
| 16 | Workflows + Cron + Routines + Builder (45 routes combined) | E2E builds a workflow, dry-runs, runs once, sees history; cron broken-job recovery still works |
| 17 | Connections, MCP, Skills, Approvals (~30 routes) | E2E lists, edits, toggles each |
| 18 | Observability (Logs, Heartbeat, Advisor, Budgets, Autonomy, Build) (~30 routes) | E2E sees logs tail, advisor analytics, budget alerts |
| 19 | Chat console pillar | E2E: open chat, send a prompt to a stub agent, see streamed reply, verify no paid network calls happened (asserted by `process.env.ANTHROPIC_API_KEY=undefined` test mode) |
| 20 | Cross-surface search + notifications drawer + first-run tour | E2E: search hits across namespaces; notifications populate from real events |
| 21 | Final hardening — full parity audit at 100%, expanded E2E (~150 tests covering every nav section + key interaction), honest DOD-REPORT regenerated | All gates green |

Each phase commits like:
```
feat(lexi): phase N — <one-line summary>

- bullet of new modules
- bullet of new routes
- bullet of new components
- E2E delta: +X tests
```

## 10. Self-validation regime

**During the autonomous run, after every phase:**
1. `npm run build` — must pass.
2. `npm test -- tests/lexi/` — unit + integration; must be green.
3. `bash scripts/verify-upstream-clean.sh` — must show only allowed paths.
4. `npx tsx scripts/lexi-parity-audit.ts` — count of "missing" routes must monotonically decrease and reach 0 by phase 21.
5. `launchctl kickstart -k "gui/$UID/com.lexi.dashboard"` — restart the live LaunchAgent against the just-built bundle.
6. `npm run test:e2e` — Playwright against live LaunchAgent on :3030; must be green.
7. `git add -A && git commit -m "feat(lexi): phase N — ..."` and push.

If any gate fails, I do not advance. I diagnose, fix, re-run. The phase only ends when its own E2E suite passes alongside everything earlier. The DoD harness lying about success is the failure mode this overhaul exists to fix; this regime is what prevents recurrence.

## 11. Definition of Done

The overhaul is shipped only when **all** of the following are true:

1. `lexi-parity-audit.ts` reports 0 missing routes.
2. Every nav section has Playwright coverage that asserts: (a) component mounts with non-placeholder content, (b) at least one interaction works end-to-end, (c) no console errors during a 30s nav tour.
3. Theme toggle works in Chromium **and** Safari **and** Firefox (manual sign-off check; harness writes the timestamp file).
4. ⌘K palette is reachable from every view and resolves nav + entity + action.
5. Live trace shows a real run from start to finish, with token usage visible.
6. Chat pillar runs an end-to-end exchange against a local stub agent in a test that asserts `process.env.ANTHROPIC_API_KEY` was never used.
7. `bash scripts/verify-upstream-clean.sh` passes with zero diff outside allowed paths.
8. `npm run dod` produces a DOD-REPORT.md with all checks green; no "Honest disclosure" caveat needed.
9. `git rev-list --count upstream/main..HEAD` is reported as N for transparency, and `git merge-tree main upstream/main` is conflict-free.

## 12. Out of scope (for this overhaul, future work)

- iPad / mobile responsive (desktop only, ≥1280px target).
- Multi-user. Single-user assumption is hardcoded.
- Cloud deployment. Localhost only.
- Plugin system for third-party Lexi-views.
- Theme customization beyond dark/light + density.

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Upstream's inline handlers drift after we mirror them | `lexi-parity-audit.ts` records SHA1 of mirrored regions; warns on drift |
| Daemon SQLite contention (writer vs Lexi reader) | Open with `mode=ro`; rely on WAL; never hold long transactions |
| FalkorDB socket protocol changes between upstream versions | Version-check on connect; fall back to last known good with banner |
| Drawflow vendor lib bundle bloat | Already vendored; no new deps |
| Playwright suite duration creeps to >5min | Run per-section in parallel where state allows; gate threshold = 8min |
| Phase 19 chat accidentally calls paid API | Test-mode env strips `ANTHROPIC_API_KEY` and asserts absence; daemon handles all paid calls or none |
| Spec scope drift during autonomous run | This file is canonical; any deviation requires updating the spec first, with a commit |
