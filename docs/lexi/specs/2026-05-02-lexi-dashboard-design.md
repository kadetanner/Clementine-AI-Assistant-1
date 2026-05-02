# Lexi Dashboard Design

**Status:** Draft for user review
**Date:** 2026-05-02
**Branch (proposed):** `lexi-dashboard` (off `upstream/main`)
**Repo:** `~/projects/clementine-fork` (fork of `Natebreynolds/Clementine-AI-Assistant`)

---

## 1. Goal

Build a **parallel, Lexi-branded dashboard** that lives alongside the existing `src/cli/dashboard.ts` without modifying it. Replace the orange/clementine identity with a blue/Lexi identity, fix the IA so navigation is intuitive, surface a state-of-the-art live view, and guarantee every link, function, and setting works. Serve as the default dashboard via launchd while remaining 100% upstream-clean: pulling new changes from `Natebreynolds/Clementine-AI-Assistant/main` should never produce conflicts, because we never edit upstream files.

## 2. Non-goals

- **Modifying `src/cli/dashboard.ts` or any other upstream file.** Zero edits to existing source.
- **Rewriting backend services.** Memory, vault, MCP bridge, agent runtime, scheduler, brain/feeds, builder/workflows backend — all unchanged. We are a *consumer* of upstream services, not a fork of them.
- **Replacing functionality that works today.** Every panel/section that exists in the current dashboard has a counterpart in Lexi (or stays accessible via the original).
- **Light-only or dark-only.** Both themes are first-class.

## 3. Architecture

### 3.1 The parallel-dashboard pattern

```
upstream files (NEVER touched):
  src/cli/dashboard.ts          ← original Clementine dashboard
  src/cli/index.ts              ← CLI entry; we add a NEW subcommand, no edits

new Lexi-only files (NEW, no upstream conflict possible):
  src/lexi-dashboard/
    server.ts                   ← Express app; mounts shared services, serves Lexi UI
    routes/
      pages.ts                  ← HTML page routes (/, /agents, /mcp, etc.)
      api.ts                    ← Lexi-specific API routes (only what's missing upstream)
      proxy.ts                  ← thin pass-through to upstream /api/* routes that work
    ui/
      index.html                ← shell (header, nav rail, command palette)
      app.tsx                   ← React root (or vanilla TS — see §3.4)
      panels/
        home.tsx                ← live view composition
        agents.tsx
        mcp.tsx
        workflows.tsx
        vault.tsx
        cron.tsx
        settings.tsx
      live/
        now-playing.tsx
        activity-stream.tsx
        system-map.tsx
      theme/
        tokens.ts               ← Palette A as design tokens
        light.ts                ← light-mode token overrides
        dark.ts                 ← dark-mode token overrides
        transition.ts           ← View Transitions API + reduced-motion fallback
    fixes/
      doctor.ts                 ← implement missing /api/doctor
      daily-plan.ts             ← implement missing /api/daily-plan
      voice-synthesize.ts       ← implement missing /api/voice/synthesize
      goals-root.ts             ← implement GET /api/goals (root)
      digest-root.ts            ← implement GET /api/digest (root)
    launch/
      lexi-cli.ts               ← `lexi dashboard` CLI subcommand entry
  bin/
    lexi                        ← bin script declared in package.json
  scripts/
    install-lexi-launchd.sh     ← installs ~/Library/LaunchAgents/com.lexi.dashboard.plist
    com.lexi.dashboard.plist    ← LaunchAgent template
  docs/lexi/                    ← all Lexi docs (spec, runbook, screenshots)
```

**Why a new top-level `src/lexi-dashboard/` directory:** zero filename collisions with anything upstream ships, and the entire feature is greppable as one unit. Upstream adding files inside `src/cli/` or `src/dashboard/` (which it does often) cannot conflict with files in `src/lexi-dashboard/`.

### 3.2 Reusing upstream backend services

The Lexi dashboard is a *new HTTP frontend* that imports from upstream:

```ts
// src/lexi-dashboard/server.ts
import { createMemoryStore } from '../memory/store.js';        // upstream
import { createMcpBridge } from '../tools/mcp-bridge.js';      // upstream
import { createAgentRuntime } from '../agent/runtime.js';      // upstream
import { createWorkflowEngine } from '../dashboard/builder/engine.js'; // upstream
```

If upstream renames or changes those imports, our build breaks loudly — that's the *correct* signal to investigate, not silently drift. We pin to current upstream APIs and update the import surface as a single thin "compat" file (`src/lexi-dashboard/upstream-compat.ts`) so churn is contained.

### 3.3 Routing strategy: own server, proxy where useful

Lexi runs its own Express server. It does NOT mount the upstream `dashboard.ts` Express app inside it (that would re-introduce coupling). Instead:

- **Routes Lexi reimplements (UI HTML + Lexi-specific endpoints):** all `/`, `/agents`, `/mcp`, etc. page routes; the 5 broken endpoints (§7).
- **Routes Lexi proxies to upstream services in-process:** for any endpoint whose business logic lives in upstream code (e.g. `/api/builder/workflows`), Lexi calls the same handler functions or services directly. We don't HTTP-proxy to a separate Clementine server — we share the process.
- **Single port.** Lexi launches one HTTP server. The original `clementine dashboard` command still works for users who want it (different port, started manually).

### 3.4 Frontend stack

**Vanilla TypeScript + Lit (web components)** rather than React. Rationale:
- The current dashboard.ts inlines all HTML/CSS/JS in one ~3000-line file, a pattern that became unmaintainable. A small step *up* in structure (web components, modules) is the right delta — but jumping to React + Vite + a build pipeline adds cognitive load and dependency churn that the project doesn't need.
- Lit gives us components, reactive properties, and template literals — all native. Bundle is tiny (~5KB).
- If light/dark transitions need React's concurrent rendering, we revisit. For the View Transitions API approach planned in §5, vanilla DOM is fine.

**Tooling:** `esbuild` for the UI bundle (single command, no config explosion). All assets compiled into `dist/lexi-dashboard/ui/` by the existing `build` script (which we extend non-destructively — `package.json` is one of the few upstream files we *do* have to edit; see §3.5).

### 3.5 The two unavoidable upstream-file edits

Two files must be touched to wire Lexi into the existing project. We minimize both:

1. **`package.json`** — add `bin.lexi`, add `scripts.build:lexi`, add esbuild + lit dependencies. ~6 line additions in three discrete spots. Conflicts on package.json are common and trivial to resolve.
2. **`src/cli/index.ts`** — register a `lexi` subcommand that imports from `src/lexi-dashboard/launch/lexi-cli.ts`. ~4 line addition.

These are the *only* edits to upstream files. Both are additive (no deletions, no reformatting). Conflict-resolution is "keep both sides" 100% of the time.

**Alternative considered:** ship Lexi as a separate npm package that depends on `clementine-agent`. Rejected because it would require upstream to expose internal APIs publicly, which they haven't done — we'd be importing private modules across package boundaries, which is more fragile than importing them from the same repo.

## 4. Information architecture

Current dashboard nav: **Home / Build / Team / Brain / Settings + ⌘K**. Five pages, each containing 3–6 sub-tabs, no consistent grouping. The "not intuitive" feeling comes from (a) the silently-broken Today panel making Home feel empty, and (b) related things scattered across pages (e.g. agents are under Team, but agent prompts are under Build).

Lexi nav (left rail, labels visible at default width, icon-only when collapsed):

| Section | Contains | Replaces |
|---|---|---|
| **Home** | Live view (Now Playing + System Map strip + Activity Stream) + Today panel + at-a-glance counters | Home tab |
| **Agents** | All agents in one place: list, status, prompt editor, tools enabled/disabled, memory size, restart, logs, current activity | Team > Agents + Build > Skills + parts of Settings |
| **Connections** | MCP servers, Composio toolkits, Salesforce/Discord/Slack/Gmail status, integration credentials | Settings > Integrations + Settings > Channels |
| **Workflows** | Existing Drawflow visual builder (preserved), plus running-workflow visibility tied into live view, autocompact-thrashing recovery surface | Build > Workflows |
| **Vault** | Browse, search, edit, ingest. Single canonical view. | Brain > Knowledge + Brain > Ingestion |
| **Memory** | Memory inspection, graph stats, integrity, recall traces | Brain > Memory + parts of Brain > Health |
| **Cron & Tasks** | Scheduled jobs, broken-job recovery (the `insight-check` failure loop has a clear "investigate" surface), background tasks, autonomy timeline | Build > Crons + Team > Activity |
| **Settings** | System, theme, auth, dashboard token, secrets, advanced | Settings (slimmed) |

**Always present:**
- **⌘K command palette** — every nav item, every agent, every workflow, every setting reachable with two keystrokes.
- **Top bar status strip** — system map mini-view (active vs idle MCP servers, agent activity dots, cost/token/health pills).
- **Right rail Activity Stream** — collapsible to ~32px sliver, drag to widen.
- **Bottom drawer "deep system map"** — collapsed by default, drag up to expand to full graph view of agents ↔ tools.

## 5. Visual system

### 5.1 Palette A: Vercel/Linear Modern

**Dark (default):**
| Token | Value | Use |
|---|---|---|
| `--bg-canvas` | `#0a0a0a` | Page background |
| `--bg-surface` | `#111111` | Cards, panels |
| `--bg-elevated` | `#1a1a1a` | Active nav item, hover |
| `--border-subtle` | `#1f1f1f` | Default borders |
| `--border-default` | `#2a2a2a` | Card borders |
| `--text-primary` | `#ededed` | Body text |
| `--text-secondary` | `#888888` | Secondary text, labels |
| `--text-tertiary` | `#666666` | Disabled, hints |
| `--accent` | `#0070f3` | Primary brand, focus rings, links |
| `--accent-hover` | `#3b8eff` | Accent hover state |
| `--accent-glow` | `rgba(0,112,243,0.15)` | Now-playing card background tint |
| `--success` | `#10b981` | Healthy status |
| `--warning` | `#f59e0b` | Degraded status |
| `--danger` | `#ef4444` | Failed/error status |
| `--purple` | `#a855f7` | Cron/scheduled events |

**Light:**
| Token | Value | Use |
|---|---|---|
| `--bg-canvas` | `#ffffff` | Page background |
| `--bg-surface` | `#fafafa` | Cards, panels |
| `--bg-elevated` | `#f4f4f5` | Active nav item, hover |
| `--border-subtle` | `#e4e4e7` | Default borders |
| `--border-default` | `#d4d4d8` | Card borders |
| `--text-primary` | `#0a0a0a` | Body text |
| `--text-secondary` | `#52525b` | Secondary text, labels |
| `--text-tertiary` | `#a1a1aa` | Disabled, hints |
| `--accent` | `#0070f3` | Primary brand (same in both modes) |
| `--accent-hover` | `#0058c4` | |
| `--accent-glow` | `rgba(0,112,243,0.08)` | |
| `--success` | `#059669` | |
| `--warning` | `#d97706` | |
| `--danger` | `#dc2626` | |
| `--purple` | `#9333ea` | |

### 5.2 Typography

- **UI font:** Inter (variable, woff2, self-hosted in `dist/lexi-dashboard/ui/fonts/`). Weights 400/500/600/700.
- **Mono:** JetBrains Mono (variable, woff2, self-hosted). Weights 400/500.
- **Scale:** 12 / 13 / 14 / 16 / 20 / 28. Body 14, headers 20/28. Mono used only inside code/data displays (SQL queries, IDs, numbers, paths).
- **Line-height:** 1.5 body, 1.3 headers, 1.4 mono.
- **Self-hosting required.** No Google Fonts CDN — the dashboard runs on localhost and we don't want a network dependency for it to render.

### 5.3 The "highly sophisticated light/dark transition"

Three layers, all of which must work together:

**Layer 1 — View Transitions API.** Wrap the theme toggle in `document.startViewTransition(() => applyTheme(next))`. Browsers that support it (Chrome/Edge/Safari 18+) get an automatic cross-fade between the two snapshots of the page. ~30 lines of code.

**Layer 2 — Token-level tweening.** All theme tokens are CSS custom properties on `:root`. Theme switches change the values; the browser already animates `color`, `background-color`, etc. across `transition: 0.3s ease`. We declare a global `* { transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease; }` scoped to a single `<body data-theme-transitioning>` attribute applied during the swap (so the transitions don't fire on every interaction).

**Layer 3 — Spotlight wipe.** From the toggle button's location, a circular SVG mask reveals the new theme outward, like macOS Sonoma's appearance switcher. Built with `clip-path: circle()` animating from 0 → max diagonal. Falls back to the cross-fade on browsers without `clip-path` animation support.

**Reduced motion respected.** `@media (prefers-reduced-motion: reduce)` disables layers 1 and 3, keeps layer 2 at 100ms.

**System sync.** Default theme follows `prefers-color-scheme`. User toggle stored in `localStorage` overrides. A "follow system" option in Settings restores auto-tracking via `matchMedia`.

### 5.4 Motion language

- **Snappy** — most transitions 150–200ms.
- **Easing** — `cubic-bezier(0.16, 1, 0.3, 1)` (Linear's curve) for entrance, `cubic-bezier(0.4, 0, 1, 1)` for exit.
- **Streaming text** — characters appear with a 12ms stagger, no blink/cursor unless idle for 600ms.
- **Activity stream** — new rows enter from top with a 6px slide + fade over 180ms.

## 6. Live view composition

The Home page renders the unified live view. Three modes coexist:

### 6.1 "Now Playing" (center, dominant)

A single large card showing what *one* agent is doing right now. Default agent shown = the most recently active. Tabs at the top of the card to switch agent (`lexi`, `jonah`, `cron`, etc.).

Card contents (live-streamed via SSE):
- Agent name, model, time-in-action, current cost
- Current "thought" (LLM streaming output, character-by-character)
- Current tool call (tool name + input, output streaming)
- Queue (next pending tasks)
- Stop / pause / fast-forward controls

Empty state: "lexi is idle · awaiting trigger" with a list of next scheduled events.

### 6.2 "System Map" (top status strip + bottom expandable drawer)

**Strip (always visible):** horizontal row of pills — agents on the left, MCP servers/integrations on the right, edges between them are subtle lines. When a call happens, the corresponding edge pulses (CSS animation). Click any pill to filter the live view to that subject.

**Drawer (collapsed by default):** drag up to expand. Full force-directed graph using `d3-force` (lazy-loaded). Nodes sized by call frequency, edges weighted by recent traffic. Hover any node for current state details.

### 6.3 "Activity Stream" (right rail)

Reverse-chronological list of every event across the system. Each row: timestamp, agent, tool/event type, summary. Click any row to expand the full payload (request + response). Filter chips at top: `agents`, `tools`, `cron`, `webhooks`, `errors only`.

Rail collapsible to a 32px sliver showing just colored dots (agent activity). Drag handle widens it. Persistence in `localStorage`.

### 6.4 Real-time delivery

Single SSE endpoint `/api/events/stream` multiplexes:
- agent activity
- MCP call lifecycle (start, complete, error)
- cron tick events
- webhook arrivals
- workflow run state changes

Server-side, this taps into upstream's existing event emitters where available (the heartbeat, routing audit, agent activity logs). Where no emitter exists, we wrap the relevant function once with a lightweight emit. Falls back to `/api/events` polling at 2s if SSE fails.

## 7. Bug fixes (from diagnostic)

These are part of the build, not future work. Done = all five resolved.

| Bug | Fix |
|---|---|
| `/api/doctor` 404 | Implement in `src/lexi-dashboard/fixes/doctor.ts`. Mirrors the `archon doctor` 9-check pattern: process health, port reachability, MCP server connectivity, FalkorDB graph, redis socket, vault file integrity, cron last-fire ages, autonomy ledger, log file growth. Returns structured JSON; "Run Doctor" button in Settings shows results inline. |
| `/api/daily-plan` 404 | Implement in `src/lexi-dashboard/fixes/daily-plan.ts`. Reads today's vault file `~/.clementine/vault/01-Daily-Notes/YYYY-MM-DD.md`, parses goals/tasks, returns structured plan. Powers the Today panel on Home. |
| `/api/voice/synthesize` 404 | Implement in `src/lexi-dashboard/fixes/voice-synthesize.ts`. Uses ElevenLabs or OpenAI TTS (whichever is configured in upstream's `claude-integrations.json`). Stores audio at the same hash path that `/api/voice/audio/:hash` already serves. |
| `GET /api/digest`, `GET /api/goals` (root) | Add list endpoints in `src/lexi-dashboard/fixes/{digest-root,goals-root}.ts`. Currently sub-paths exist but root paths 404. |
| Cron `insight-check` "Prompt is too long" hard-fail loop | Add a recovery surface in Cron section: detect repeated identical errors on the same job within 30 min → mark as "stuck", suspend further runs, show user a one-click "investigate" that opens the failing prompt + last 3 contexts for review. The fix to the prompt itself is upstream's concern; we make the failure visible and stop the burn. |
| Workflow `s1` autocompact-thrashing | Same recovery pattern in Workflows section. Detect autocompact failure → mark step as "needs human review" with the diagnostic message + last good context. |

## 8. Always-on (launchd)

Replace `com.clem.assistant` (currently unloaded) with `com.lexi.dashboard`. The new plist:

- `Label`: `com.lexi.dashboard`
- `ProgramArguments`: `node` `<repo>/dist/cli/index.js` `lexi` `dashboard`
- `RunAtLoad`: true
- `KeepAlive`: `{ SuccessfulExit: false, Crashed: true }`
- `StandardOutPath` / `StandardErrorPath`: `~/.clementine/logs/lexi-dashboard.{out,err}.log`
- `EnvironmentVariables`: includes `LEXI_PORT=3030` (configurable)
- `WorkingDirectory`: `~/projects/clementine-fork`

Installer script `scripts/install-lexi-launchd.sh`:
1. Renders the plist with the current user's paths
2. Copies to `~/Library/LaunchAgents/`
3. `launchctl bootstrap gui/$UID` (replaces deprecated `load -w`)
4. `launchctl enable gui/$UID/com.lexi.dashboard`
5. `launchctl kickstart gui/$UID/com.lexi.dashboard`
6. Verifies via `launchctl print` and a `curl localhost:$LEXI_PORT/health`

Also: a "Restart Lexi" button in Settings that runs `launchctl kickstart -k gui/$UID/com.lexi.dashboard`.

The original `com.clem.assistant` plist is left in place but unloaded (current state). User can restore it manually if desired. Cron stays under `com.clem.cron` (untouched — it's upstream's).

## 9. Definition of done — "100% working"

The dashboard is not complete until all of the following are true. Each becomes an acceptance criterion in the implementation plan.

**Functional:**
1. Every nav item resolves to a non-empty page that renders without console errors.
2. Every button performs its labeled action and reports success/failure visibly.
3. Every form persists and reads back its values.
4. Every link in the dashboard (internal or external) returns 200 or opens correctly.
5. Every API endpoint the UI calls returns 200 (or a deliberate 4xx with a UI-rendered message — never a silent failure).
6. The 5 broken endpoints from §7 are fixed.
7. Every existing dashboard.ts feature has a Lexi counterpart OR is intentionally omitted with a documented reason.

**Quality:**
8. Light/dark toggle works in all major browsers (Chrome 120+, Safari 17+, Firefox 121+); the spotlight-wipe transition runs in browsers that support View Transitions, falls back gracefully elsewhere.
9. ⌘K opens the command palette from any screen; every nav target is reachable in ≤2 keystrokes after open.
10. Live view delivers an event end-to-end (agent action → SSE → DOM render) in ≤500ms p95 on local hardware.
11. No requests to external networks except those explicitly tied to a feature (TTS, MCP servers configured by user). No analytics, no fonts CDN.

**Operational:**
12. `com.lexi.dashboard` is loaded, enabled, and survives a logout/login cycle.
13. After a forced kill (`kill -9`), launchd restarts the process within 3 seconds.
14. The doctor endpoint reports green on a clean install.
15. Build commands documented: `npm run build:lexi` produces `dist/lexi-dashboard/ui/` and the launch script works against it.

**Upstream-clean:**
16. `git log --oneline upstream/main..lexi-dashboard` shows commits that touch ONLY: `src/lexi-dashboard/**`, `bin/lexi`, `scripts/install-lexi-launchd.sh`, `scripts/com.lexi.dashboard.plist`, `docs/lexi/**`, plus the documented additive edits to `package.json` and `src/cli/index.ts`.
17. `git fetch upstream && git merge upstream/main` produces zero conflicts on a fresh checkout. Verified as the final pre-merge step.

**Spec accountability:** the implementation plan (next step) will turn each numbered item above into a phase or test that gates "done."

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Upstream renames an internal API we depend on | All upstream imports go through `src/lexi-dashboard/upstream-compat.ts`; one file to update on breakage |
| Lexi dashboard and Clementine dashboard fight over port 3030 | Lexi reads `LEXI_PORT` env (default 3030). The original is started manually only; if user wants both, set `LEXI_PORT=3031`. The launchd plist binds the port we care about. |
| View Transitions polyfill drift | We use the native API only; no polyfill. Fallback path is the cross-fade (layer 2) which works everywhere. |
| `s1` workflow autocompact-thrashing turns into a Lexi UI bug | We surface the failure rather than fix it (upstream's concern). The recovery UI explicitly tells the user "this is an upstream issue with workflow context limits — see [issue-link]." |
| Re-doing 3000 lines of dashboard.ts behavior is more work than estimated | Cut scope to the §4 sections in priority order (Home → Agents → Connections → Workflows → Vault → Memory → Cron → Settings). Earlier sections ship without later ones blocking. |

## 11. Open questions for spec review

None as of the design conversation — but flag if any of these assumptions are wrong:

- **Port 3030 stays the canonical dashboard port.** (Confirmed via lsof.)
- **You want the launchd label to be `com.lexi.dashboard`** (not `com.clem.lexi` or similar).
- **You don't want a mobile/responsive view.** (Dashboard is desktop-only; mobile would be a separate project — pipelinepulse iOS already exists for that.)
- **You're OK with self-hosted Inter and JetBrains Mono fonts** adding ~200KB to the bundle.

## 12. Glossary

- **Lexi** — your assistant identity (per `~/.clementine/vault/00-System/SOUL.md`), already configured in `.env` `ASSISTANT_NAME`.
- **Upstream** — `Natebreynolds/Clementine-AI-Assistant` on GitHub.
- **Origin** — `kadetanner/Clementine-AI-Assistant-1` (your fork).
- **The original dashboard** — `src/cli/dashboard.ts`, the existing 3000-line single-file dashboard. Untouched by this work.
- **Lexi dashboard** — the new dashboard built in `src/lexi-dashboard/`. The default-running one.
