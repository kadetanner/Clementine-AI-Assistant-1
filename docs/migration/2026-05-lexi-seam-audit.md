# Lexi Seam Audit — 2026-05-07

**Source repo:** clementine-fork @ lexi-migration branch
**Target:** clean cut of `src/lexi-dashboard/` for migration to `kadetanner/lexi`
**Spec:** `docs/superpowers/specs/2026-05-07-lexi-repo-migration.md` §2 + §3
**Plan:** `docs/superpowers/plans/2026-05-07-lexi-repo-migration-plan.md` Phase A Task 1

## §A — Imports leaving `src/lexi-dashboard/`

Out-of-tree imports were identified by tracing each `../../` path *relative to the importing
file's location*. Depth-1 files (e.g. `services/probe.ts`) reach `src/` with `../../`;
depth-2 files (e.g. `data/lexi-native/session-log-tailer.ts`) reach `src/lexi-dashboard/`
with `../../`. Each candidate was traced individually before being marked a seam.

> **Correction (audit revision 2026-05-07):** An earlier version of this document listed
> `../../events/bus.js` (imported from `data/lexi-native/session-log-tailer.ts`) as an
> out-of-tree seam. That was wrong. From `data/lexi-native/`, `../../` resolves to
> `src/lexi-dashboard/`, so the import lands at `src/lexi-dashboard/events/bus.ts` —
> in-tree. There is no `src/events/bus.ts` at the Clementine root. The spec and plan were
> corrected in commit aa9421a.

| Import | Call sites | Decision | Notes |
|---|---|---|---|
| `../../agent/mcp-bridge.js` | 2 | inline → `lexi/web/agents/mcp-bridge.ts` | `services/probe.ts` + `services/connection-registry.ts`; drop unused exports |
| `../../integrations/composio/client.js` | 2 | drop + stub | `services/probe.ts` + `services/connection-registry.ts`; Composio not on Lexi roadmap |

**Call site files:**
- `src/lexi-dashboard/services/probe.ts` — imports `mcp-bridge.js` + `composio/client.js`
- `src/lexi-dashboard/services/connection-registry.ts` — imports `mcp-bridge.js` + `composio/client.js`

## §B — Imports entering `src/lexi-dashboard/` from outside

```
import { registerLexiCommand } from '../lexi-dashboard/launch/lexi-cli.js';
```

Source file: `src/cli/index.ts:44`

`src/cli/index.ts` is the Clementine CLI entrypoint. It pulls `registerLexiCommand` to wire
the `lexi` sub-command into the Clementine CLI binary. Treatment: **drop** — the `lexi` binary
in the new repo will have its own entrypoint; this coupling dissolves when the tree is cut.

## §C — package.json scripts referencing lexi-dashboard

Raw matches from `grep -nE "lexi-dashboard|/lexi/" package.json`:

```
9:    "lexi": "bin/lexi"
12:    "build:assets": "mkdir -p dist/agent/advisor-rules/builtin && (cp src/agent/advisor-rules/builtin/*.yaml dist/agent/advisor-rules/builtin/ 2>/dev/null || true) && mkdir -p dist/cli/static && (cp src/cli/static/* dist/cli/static/ 2>/dev/null || true) && mkdir -p dist/lexi-dashboard/ui && cp -r src/lexi-dashboard/ui/* dist/lexi-dashboard/ui/ 2>/dev/null || true",
30:    "test:e2e": "playwright test --config=tests/lexi/e2e/playwright.config.ts",
```

Additional lexi-related scripts not caught by the path grep:

```
14:    "build:lexi": "node scripts/esbuild-lexi.mjs",
34:    "parity": "node scripts/lexi-parity-audit.mjs",
35:    "parity:strict": "node scripts/lexi-parity-audit.mjs --strict",
36:    "parity:update-baseline": "node scripts/lexi-parity-audit.mjs --update-baseline",
```

| Script | New repo treatment |
|---|---|
| `build:assets` (lexi-dashboard copy step) | Rewrite for new path; non-lexi steps drop |
| `build:lexi` | Carry forward; update `esbuild-lexi.mjs` paths |
| `build` (full tsc + assets + lexi) | Rewrite — Clementine-specific tsc steps drop |
| `dev` (`tsx src/index.ts`) | Drop — Clementine entrypoint |
| `dashboard` | Drop |
| `desktop`, `desktop:debug`, `desktop:prepare`, `desktop:pack`, `desktop:dist`, `desktop:dist:unnotarized` | Drop |
| `test:e2e` | Carry forward; update `playwright.config.ts` path |
| `audit:inventory` | Carry forward; update path |
| `parity`, `parity:strict`, `parity:update-baseline` | Drop — Clementine-specific parity audit |
| `bin.lexi` (`bin/lexi`) — binary entrypoint (`bin["lexi"]`), not a script | Carry forward as the new repo's primary binary entry |

## §D — Runtime deps actually imported by lexi-dashboard

Raw output of `grep` on `from '...'` (non-relative) imports:

```
better-sqlite3
commander
dompurify
express
lit
lit/directives/live.js
lit/directives/unsafe-html.js
marked
node:child_process
node:crypto
node:events
node:fs
node:fs/promises
node:http
node:net
node:os
node:path
node:url
node:util
```

Grouped for `lexi/package.json`:

**Runtime dependencies:**
- `better-sqlite3` — SQLite bindings (trace store, pin store)
- `commander` — CLI arg parsing
- `dompurify` — HTML sanitization in UI
- `express` — HTTP server
- `lit` + `lit/directives/live.js` + `lit/directives/unsafe-html.js` — web components UI framework
- `marked` — Markdown rendering

**Node built-ins (no install needed):**
`node:child_process`, `node:crypto`, `node:events`, `node:fs`, `node:fs/promises`,
`node:http`, `node:net`, `node:os`, `node:path`, `node:url`, `node:util`

Everything else in the current `package.json` (electron, vitest, playwright peer deps, etc.)
does NOT carry over unless lexi-specific tests require it.

## §E — Surprises / unknowns

(empty — both real seams confirmed (`agent/mcp-bridge` and `integrations/composio/client`),
no additional out-of-tree imports found. `src/lexi-dashboard/` is otherwise a self-contained
tree. Phase A seam-cuts may proceed.)
