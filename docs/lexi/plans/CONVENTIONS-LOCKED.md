# Conventions Locked During Execution

This file overrides any conflicting code in plans 1-9. It captures decisions made by implementer subagents during execution that affect ALL subsequent tasks.

**Read this before executing any plan.** When the plan source says X but this file says Y, Y wins.

---

## 1. Lit components — use decorator-FREE pattern (NOT `@customElement`/`@property`/`@state`)

**Why:** vitest's vite/esbuild SSR transform doesn't compile TypeScript decorators. Components written with `@customElement('name')` or `@state() private foo` will throw `SyntaxError: Invalid or unexpected token` at module load during tests. Discovered in Plan 1 Task 10.

**Replace** every plan example like this:

```ts
import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('my-component')
export class MyComponent extends LitElement {
  @property({ type: String }) foo = 'bar';
  @state() private internal = 0;
  // ...
}
```

**With** the decorator-free equivalent:

```ts
import { LitElement, html } from 'lit';

export class MyComponent extends LitElement {
  static properties = {
    foo: { type: String },
    internal: { state: true },
  };

  declare foo: string;
  declare internal: number;

  constructor() {
    super();
    this.foo = 'bar';
    this.internal = 0;
  }

  // render(), connectedCallback(), etc. unchanged
}
customElements.define('my-component', MyComponent);
```

**Notes:**
- Initialize properties in the constructor (not as class-field initializers — Lit warns about field shadowing).
- Use `declare foo: T;` to give TypeScript the type without emitting an initializer.
- The `customElements.define(...)` call goes AFTER the class declaration.
- All other Lit features (`html`, `css`, `static styles`, lifecycle hooks, `@click=` event bindings inside templates) work normally.

---

## 2. `bin/lexi` uses ESM `import()`, not CommonJS `require()`

**Why:** Repo `package.json` has `"type": "module"`, so the bin file is parsed as ESM where `require` is undefined. Discovered in Plan 1 Task 3.

**Plan 1 Task 3 says** `bin/lexi`:
```text
#!/usr/bin/env node
require('../dist/cli/index.js');
```

**Actual implementation** (correct):
```text
#!/usr/bin/env node
import('../dist/cli/index.js');
```

---

## 3. Doctor health-check paths reflect ACTUAL `~/.clementine/` layout

**Why:** Plan 2 Task 2's `doctor.ts` had path constants that were guesses. Real layout (verified 2026-05-02) differs. Fixed in commit `ce1c570`.

**Real paths:**
- MCP/integrations registry: `~/.clementine/claude-integrations.json` (NOT `~/.clementine/mcp/servers.json`)
- Cron heartbeat: mtime of `~/.clementine/cron/runs/` directory (NOT `~/.clementine/cron/last-fire.json`)
- Autonomy proxy: `~/.clementine/.heartbeat_state.json` (NOT `~/.clementine/autonomy/ledger.jsonl`)
- FalkorDB socket: glob `~/.clementine/.graph.db/fdb-*.sock` (NOT `~/.clementine/falkordb.sock`)

If a future plan adds new health checks, point them at these real paths.

---

## 4. Build chain assumes `scripts/esbuild-lexi.mjs` exists from Plan 1 Task 5

**Why:** Plan 1 Task 2 added `&& npm run build:lexi` to the `build` script BEFORE Task 5 created the script file. Tasks 3-4 use the workaround `npx tsc --outDir dist && chmod +x dist/cli/index.js && npm run build:assets` instead of `npm run build`.

**Status:** Resolved after Task 5 commit. Tasks 6+ can use `npm run build` normally.

---

## 5. JetBrains Mono is Latin-only (~40KB Google Fonts subset)

**Why:** Plan 1 Task 6's GitHub URL no longer exists. The Google Fonts CDN serves a Latin-only variable woff2. Acceptable for dashboard UI (ASCII only). If extended Unicode is later needed, swap for a full-range woff2 build.

---

## 6. Routes aggregator pattern — never edit `server.ts` after Plan 2 Task 1

**Why:** Plan 2 Task 1 added two lines to `server.ts` (one import, one call) for the routes aggregator. After that, ALL future routes go in new modules under `src/lexi-dashboard/fixes/` (or other dirs) and register themselves via `routes.ts`. This keeps `server.ts` stable and minimizes upstream-file edits to the originally-agreed two (`package.json` + `src/cli/index.ts`).

**For new routes in Plans 3-9:** add to `src/lexi-dashboard/routes.ts` only:

```ts
import { register as registerNewThing } from './newthing/routes.js';
// ...
export function registerLexiRoutes(app: Express): void {
  registerDoctor(app);
  registerRestartSelf(app);
  registerNewThing(app);  // ← add here
}
```

---

## When to update this doc

- Any time an implementer discovers a plan deviation that affects subsequent tasks.
- Any time a fix to executed code requires future tasks to do something different.

This doc is checked into git alongside the plans.
