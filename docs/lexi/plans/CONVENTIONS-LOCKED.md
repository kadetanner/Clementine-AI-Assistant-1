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

## 7. Express 5 `req.params.<name>` is `string | string[]` — coerce with `String()`

**Why:** Discovered in Plan 4 Task 4. The Express 5 type definitions widened param values, so `req.params.slug` no longer narrows to `string` and tsc fails on direct use as a `string` argument. `npm run build` breaks even though vitest passes (vitest doesn't run tsc).

**Pattern for new route handlers:**

```ts
router.get('/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug);  // ← coerce at the top
  // ... use `slug` everywhere below
});
```

This applies to ALL routes added in Plans 4–9.

---

## 8. For two-way bound form inputs, use Lit's `live()` directive

**Why:** Discovered in Plan 4 Task 5 (`lexi-prompt-editor`). Plain `.value=${this.draft}` doesn't update the DOM textarea when Lit's PropertyPart cache equals the new value (e.g., user types into a textarea, then a Cancel handler resets the draft to original — Lit's cache is still 'original' from the initial render because user input mutated the DOM property without going through Lit's commit, so the post-Cancel re-render is a no-op).

**Pattern:**

```ts
import { live } from 'lit/directives/live.js';
// ...
<textarea .value=${live(this.draft)} @input=${this.onInput}></textarea>
<input type="search" .value=${live(this.query)} ...>
```

`live()` forces the DOM property to be updated whenever it differs from the live DOM value. Standard Lit idiom for forms; not specific to decorator-free.

---

## 9. Avoid `?disabled=` Lit binding for buttons that synchronous-test-clicks rely on

**Why:** Plan 4 Task 5. Tests that dispatch input events then immediately click Save without an `await requestAnimationFrame()` see the button still rendered as `disabled` — Lit's re-render is async. JSDOM `.click()` is a no-op on disabled buttons → handler never fires.

**Options:**
- (a) **Drop the `?disabled` binding** and rely on visual-only cues like `data-dirty` indicators. Buttons still work when "clean" — handlers should be idempotent (e.g., Save when not dirty just emits with current value).
- (b) **Keep `?disabled`** and require all tests to `await new Promise((r) => requestAnimationFrame(r))` between input dispatch and click.

Lexi prefers (a) for new components — visual indicators (dot, tag, colour) communicate state without making form-input testing fragile. If a real UX need surfaces, revisit.

---

## When to update this doc

- Any time an implementer discovers a plan deviation that affects subsequent tasks.
- Any time a fix to executed code requires future tasks to do something different.

This doc is checked into git alongside the plans.
