# Lexi Seam Audit — 2026-05-07

**Source repo:** clementine-fork @ lexi-migration branch
**Target:** clean cut of `src/lexi-dashboard/` for migration to `kadetanner/lexi`

## §A — Imports leaving `src/lexi-dashboard/`

All out-of-tree imports use `../../` (two levels up = escaping `src/lexi-dashboard/`).
All single-level `../` imports were verified to resolve within the tree by tracing
source file location + relative path.

| Import | Call sites | Decision | Notes |
|---|---|---|---|
| `../../agent/mcp-bridge.js` | 2 | inline → `lexi/web/services/mcp-bridge.ts` | `services/probe.ts` + `services/connection-registry.ts`; drop unused exports |
| `../../events/bus.js` | 1 | inline → `lexi/web/events/bus.ts` | `data/lexi-native/session-log-tailer.ts`; Lexi has its own event surface in `lexi-dashboard/events/bus.ts` — merge or alias |
| `../../integrations/composio/client.js` | 2 | drop + stub | `services/probe.ts` + `services/connection-registry.ts`; Composio not on Lexi roadmap |

**Call site files:**
- `src/lexi-dashboard/services/probe.ts` — imports `mcp-bridge.js` + `composio/client.js`
- `src/lexi-dashboard/services/connection-registry.ts` — imports `mcp-bridge.js` + `composio/client.js`
- `src/lexi-dashboard/data/lexi-native/session-log-tailer.ts` — imports `../../events/bus.js`

Note: `../../events/bus.js` (escaping tree) is distinct from `../events/bus.js` used inside
`src/lexi-dashboard/fixes/register.ts` and `src/lexi-dashboard/routes/trace-v2.ts`, which
resolve to `src/lexi-dashboard/events/bus.ts` (in-tree, no seam).

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
| `desktop:*` | Drop |
| `test:e2e` | Carry forward; update `playwright.config.ts` path |
| `audit:inventory` | Carry forward; update path |
| `parity`, `parity:strict`, `parity:update-baseline` | Drop — Clementine-specific parity audit |
| `bin.lexi` (`bin/lexi`) | Carry forward as the new repo's primary binary entry |

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

(empty — all three known seams confirmed, no additional out-of-tree imports found.
`src/lexi-dashboard/` is otherwise a self-contained tree. Phase A seam-cuts may proceed.)
