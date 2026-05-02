# Lexi Dashboard — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an empty but fully-themed Lexi dashboard at `localhost:3030` with the left-rail / top-bar / right-rail / bottom-drawer shell, working light/dark transition (View Transitions API + spotlight wipe + reduced-motion fallback), self-hosted Inter + JetBrains Mono, and a `lexi dashboard` CLI subcommand. No data yet, no live view yet — just the shell, theme, and routing.

**Architecture:** New `src/lexi-dashboard/` directory; never touches `src/cli/dashboard.ts`. Express server + Lit web components + esbuild bundle. Two additive edits to upstream files (`package.json`, `src/cli/index.ts`).

**Tech Stack:** TypeScript 5+ · Node 20+ · Express 4 · Lit 3 (web components) · esbuild 0.24 · Vitest (existing) · self-hosted woff2 fonts.

**Spec reference:** `docs/lexi/specs/2026-05-02-lexi-dashboard-design.md`

---

## Conventions LOCKED by this plan (all subsequent plans inherit)

- **Files:** kebab-case (`now-playing.ts`).
- **Components:** PascalCase Lit elements with `lexi-` prefix.
- **API routes:** `/api/<resource>` (no `/lexi/` prefix; Lexi owns the port).
- **SSE event shape:** `{ type: string; ts: number; payload: unknown }`.
- **Theme tokens:** CSS custom properties on `:root[data-theme="light|dark"]`.
- **Tests:** `tests/lexi/**/*.test.ts`. Use `execFileSync` (not `execSync`). For DOM manipulation in tests use `replaceChildren()` + `createElement()` + `appendChild()` (not `innerHTML`).
- **Commits:** conventional (`feat(lexi):`, `fix(lexi):`, `test(lexi):`, `build(lexi):`, `docs(lexi):`).
- **TypeScript paths:** import upstream services from `../<area>/<file>.js`. Never edit upstream files except `package.json` and `src/cli/index.ts`.

## File structure (created in this plan)

```
src/lexi-dashboard/
  server.ts                        ← Express app
  launch/lexi-cli.ts               ← CLI entry
  ui/
    index.html                     ← shell skeleton
    main.ts                        ← UI entry
    theme/{tokens.ts,themes.ts,transition.ts}
    components/{lexi-app,lexi-nav-rail,lexi-top-bar,lexi-right-rail,lexi-bottom-drawer,lexi-command-palette,lexi-theme-toggle}.ts
    fonts/{Inter,JetBrainsMono}.woff2
    styles/{base,shell}.css
bin/lexi
scripts/esbuild-lexi.mjs
tests/lexi/{deps,cli,server,build,theme,transition,components,theme-toggle,command-palette}.test.ts
```

**Modified upstream files (additive only):** `package.json`, `src/cli/index.ts`.

---

## Task 1 — Verify branch

**Files:** working tree only.

- [ ] **Step 1:** `git branch --show-current` → expect `lexi-dashboard`. `git log --oneline upstream/main..HEAD` → exactly one commit ahead.
- [ ] **Step 2:** `git status --short` → empty.
- [ ] **Step 3:** `git diff upstream/main..HEAD --name-only` → exactly `.gitignore` + `docs/lexi/specs/2026-05-02-lexi-dashboard-design.md`.
- [ ] **Step 4:** No commit. Proceed.

---

## Task 2 — Add Lit + esbuild + bin entry

**Files:** Modify `package.json`. Create `tests/lexi/deps.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/deps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('Lexi dashboard dependencies', () => {
  const pkg = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8'));
  it('declares lit', () => { expect(pkg.dependencies?.lit).toBeDefined(); });
  it('declares esbuild', () => { expect(pkg.devDependencies?.esbuild).toBeDefined(); });
  it('declares the build:lexi script', () => { expect(pkg.scripts?.['build:lexi']).toBeDefined(); });
  it('exposes the lexi bin', () => { expect(pkg.bin?.lexi).toBeDefined(); });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/deps.test.ts` → 4 failures.
- [ ] **Step 3:** Edit `package.json`:
  - Add to `dependencies`: `"lit": "^3.2.0"`.
  - Add to `devDependencies`: `"esbuild": "^0.24.0"`, `"jsdom": "^25.0.0"`, `"@types/jsdom": "^21.1.7"`.
  - Add to `scripts` (after existing `build`): `"build:lexi": "node scripts/esbuild-lexi.mjs",`
  - Replace existing `build` script with: `"build": "rm -rf dist.tmp 2>/dev/null; tsc --outDir dist.tmp && rm -rf dist && mv dist.tmp dist && chmod +x dist/cli/index.js && npm run build:assets && npm run build:lexi",`
  - Replace `bin` block with: `"bin": { "clementine": "dist/cli/index.js", "lexi": "bin/lexi" }`
- [ ] **Step 4:** `npm install && npm test -- tests/lexi/deps.test.ts` → 4 PASS.
- [ ] **Step 5:** `git add package.json package-lock.json tests/lexi/deps.test.ts && git commit -m "build(lexi): add lit + esbuild deps and bin entry"`

---

## Task 3 — Bin shim and CLI subcommand

**Files:** Create `bin/lexi`, `src/lexi-dashboard/launch/lexi-cli.ts`. Modify `src/cli/index.ts`. Create `tests/lexi/cli.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/cli.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

describe('lexi CLI', () => {
  it('prints help when invoked with --help', () => {
    const out = execFileSync('node', ['bin/lexi', '--help'], {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf8',
    });
    expect(out).toContain('lexi');
    expect(out).toContain('dashboard');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/cli.test.ts` → fail.
- [ ] **Step 3:** Create `bin/lexi` (two lines):

```text
#!/usr/bin/env node
require('../dist/cli/index.js');
```

Then `chmod +x bin/lexi`.

- [ ] **Step 4:** Create `src/lexi-dashboard/launch/lexi-cli.ts`:

```ts
import { Command } from 'commander';
import { startLexiServer } from '../server.js';

export function registerLexiCommand(program: Command): void {
  const lexi = program.command('lexi').description('Lexi dashboard commands');
  lexi.command('dashboard')
    .description('Start the Lexi dashboard server')
    .option('-p, --port <port>', 'Port to listen on', process.env.LEXI_PORT ?? '3030')
    .action(async (opts) => {
      const port = Number(opts.port);
      await startLexiServer({ port });
    });
}
```

- [ ] **Step 5:** In `src/cli/index.ts`, add an import near the others:

```ts
import { registerLexiCommand } from '../lexi-dashboard/launch/lexi-cli.js';
```

After the `program` is constructed and other commands registered, add:

```ts
registerLexiCommand(program);
```

- [ ] **Step 6:** `npm run build && npm test -- tests/lexi/cli.test.ts` → PASS.
- [ ] **Step 7:** Commit:

```bash
git add bin/lexi src/lexi-dashboard/launch/lexi-cli.ts src/cli/index.ts tests/lexi/cli.test.ts
git commit -m "feat(lexi): add lexi CLI subcommand and bin shim"
```

---

## Task 4 — Express server with /health

**Files:** Create `src/lexi-dashboard/server.ts`, `src/lexi-dashboard/ui/index.html`. Modify `package.json` (`build:assets`). Create `tests/lexi/server.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/server.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';

describe('Lexi server', () => {
  let server: LexiServer; let baseUrl: string;
  beforeAll(async () => { server = await startLexiServer({ port: 0 }); baseUrl = `http://localhost:${server.port}`; });
  afterAll(async () => { await server.stop(); });

  it('responds 200 on /health with status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok', service: 'lexi-dashboard' });
    expect(typeof body.uptimeMs).toBe('number');
  });

  it('responds 200 on / with HTML', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/server.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/server.ts`:

```ts
import express from 'express';
import type { Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface LexiServerOptions { port?: number; }
export interface LexiServer { port: number; app: Express; stop: () => Promise<void>; }

const startedAt = Date.now();

export async function startLexiServer(opts: LexiServerOptions = {}): Promise<LexiServer> {
  const app = express();
  const uiDir = path.resolve(__dirname, 'ui');
  app.use('/assets', express.static(uiDir));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'lexi-dashboard',
      uptimeMs: Date.now() - startedAt,
      version: process.env.npm_package_version ?? 'dev',
    });
  });

  app.get('/', (_req, res) => { res.sendFile(path.join(uiDir, 'index.html')); });

  const httpServer: Server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(opts.port ?? 3030, () => { httpServer.removeListener('error', reject); resolve(); });
  });
  const addr = httpServer.address();
  const port = typeof addr === 'object' && addr ? addr.port : (opts.port ?? 3030);
  return {
    port, app,
    stop: () => new Promise<void>((resolve, reject) => httpServer.close((err) => (err ? reject(err) : resolve()))),
  };
}
```

- [ ] **Step 4:** Create `src/lexi-dashboard/ui/index.html`:

```html
<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Lexi</title>
  <link rel="stylesheet" href="/assets/styles/base.css" />
  <link rel="stylesheet" href="/assets/styles/shell.css" />
</head>
<body>
  <lexi-app></lexi-app>
  <script type="module" src="/assets/main.js"></script>
</body>
</html>
```

- [ ] **Step 5:** Edit `package.json`, replace `build:assets`:

```json
"build:assets": "mkdir -p dist/agent/advisor-rules/builtin && (cp src/agent/advisor-rules/builtin/*.yaml dist/agent/advisor-rules/builtin/ 2>/dev/null || true) && mkdir -p dist/cli/static && (cp src/cli/static/* dist/cli/static/ 2>/dev/null || true) && mkdir -p dist/lexi-dashboard/ui && cp -r src/lexi-dashboard/ui/* dist/lexi-dashboard/ui/ 2>/dev/null || true",
```

- [ ] **Step 6:** `npm run build && npm test -- tests/lexi/server.test.ts` → PASS.
- [ ] **Step 7:** Commit:

```bash
git add src/lexi-dashboard/server.ts src/lexi-dashboard/ui/index.html tests/lexi/server.test.ts package.json
git commit -m "feat(lexi): express server with /health and shell HTML"
```

---

## Task 5 — esbuild script for the UI bundle

**Files:** Create `scripts/esbuild-lexi.mjs`, `src/lexi-dashboard/ui/main.ts`, `tests/lexi/build.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/build.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(__dirname, '../..');

describe('Lexi UI build', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build:lexi'], { cwd: repoRoot, stdio: 'pipe' });
  });

  it('produces dist/lexi-dashboard/ui/main.js', () => {
    const out = path.join(repoRoot, 'dist/lexi-dashboard/ui/main.js');
    expect(existsSync(out)).toBe(true);
    const size = statSync(out).size;
    expect(size).toBeGreaterThan(1000);
    expect(size).toBeLessThan(150_000);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/build.test.ts` → fail.
- [ ] **Step 3:** Create `scripts/esbuild-lexi.mjs`:

```js
import { build } from 'esbuild';
import { mkdirSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcUi = path.join(repoRoot, 'src/lexi-dashboard/ui');
const outUi = path.join(repoRoot, 'dist/lexi-dashboard/ui');

mkdirSync(outUi, { recursive: true });

for (const sub of ['index.html', 'fonts', 'styles']) {
  try { cpSync(path.join(srcUi, sub), path.join(outUi, sub), { recursive: true }); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}

await build({
  entryPoints: [path.join(srcUi, 'main.ts')],
  bundle: true, format: 'esm', target: ['es2022'],
  outfile: path.join(outUi, 'main.js'),
  minify: true, sourcemap: true, logLevel: 'info',
});

console.log('lexi UI bundle written to', outUi);
```

- [ ] **Step 4:** Create `src/lexi-dashboard/ui/main.ts`:

```ts
console.log('Lexi UI bootstrapping...');
```

- [ ] **Step 5:** `npm run build:lexi && npm test -- tests/lexi/build.test.ts` → PASS.
- [ ] **Step 6:** Commit:

```bash
git add scripts/esbuild-lexi.mjs src/lexi-dashboard/ui/main.ts tests/lexi/build.test.ts
git commit -m "build(lexi): esbuild script for UI bundle"
```

---

## Task 6 — Self-host Inter and JetBrains Mono

**Files:** Create `src/lexi-dashboard/ui/fonts/Inter.woff2`, `JetBrainsMono.woff2`, and `src/lexi-dashboard/ui/styles/base.css`.

- [ ] **Step 1:** Append to `tests/lexi/build.test.ts` (inside the existing describe):

```ts
  it('base.css declares both font-face rules', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(path.join(repoRoot, 'dist/lexi-dashboard/ui/styles/base.css'), 'utf8');
    expect(css).toContain('@font-face');
    expect(css).toMatch(/font-family:\s*['"]Inter['"]/);
    expect(css).toMatch(/font-family:\s*['"]JetBrains Mono['"]/);
    expect(css).toContain('Inter.woff2');
    expect(css).toContain('JetBrainsMono.woff2');
  });
```

- [ ] **Step 2:** `npm test -- tests/lexi/build.test.ts` → new test fails.
- [ ] **Step 3:** Download Inter:

```bash
mkdir -p src/lexi-dashboard/ui/fonts
curl -L -o src/lexi-dashboard/ui/fonts/Inter.woff2 \
  https://github.com/rsms/inter/raw/v4.0/docs/font-files/InterVariable.woff2
```

Expected file size: ~330KB.

- [ ] **Step 4:** Download JetBrains Mono:

```bash
curl -L -o src/lexi-dashboard/ui/fonts/JetBrainsMono.woff2 \
  https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/variable/JetBrainsMono%5Bwght%5D.woff2
```

Expected file size: ~110KB.

- [ ] **Step 5:** Create `src/lexi-dashboard/ui/styles/base.css`:

```css
@font-face {
  font-family: 'Inter';
  src: url('/assets/fonts/Inter.woff2') format('woff2-variations'),
       url('/assets/fonts/Inter.woff2') format('woff2');
  font-weight: 100 900; font-style: normal; font-display: swap;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/assets/fonts/JetBrainsMono.woff2') format('woff2-variations'),
       url('/assets/fonts/JetBrainsMono.woff2') format('woff2');
  font-weight: 100 800; font-style: normal; font-display: swap;
}
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px; line-height: 1.5;
  background: var(--bg-canvas); color: var(--text-primary);
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
code, pre, .mono {
  font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}
```

- [ ] **Step 6:** `npm run build:lexi && npm test -- tests/lexi/build.test.ts` → PASS.
- [ ] **Step 7:** Commit:

```bash
git add src/lexi-dashboard/ui/fonts/ src/lexi-dashboard/ui/styles/base.css tests/lexi/build.test.ts
git commit -m "feat(lexi): self-host Inter and JetBrains Mono fonts"
```

---

## Task 7 — Theme tokens

**Files:** Create `src/lexi-dashboard/ui/theme/tokens.ts`, `src/lexi-dashboard/ui/theme/themes.ts`, `tests/lexi/theme.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/theme.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme, currentTheme, THEME_TOKENS } from '../../src/lexi-dashboard/ui/theme/themes.js';

describe('theme tokens', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
  });

  it('exposes all 15 spec tokens', () => {
    const expected = ['bg-canvas','bg-surface','bg-elevated','border-subtle','border-default','text-primary','text-secondary','text-tertiary','accent','accent-hover','accent-glow','success','warning','danger','purple'];
    for (const t of expected) expect(THEME_TOKENS).toContain(t);
  });

  it('applyTheme(dark) sets bg-canvas to #0a0a0a and accent to #0070f3', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--bg-canvas')).toBe('#0a0a0a');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#0070f3');
  });

  it('applyTheme(light) sets bg-canvas to #ffffff and accent to #0070f3', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--bg-canvas')).toBe('#ffffff');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#0070f3');
  });

  it('currentTheme reads data-theme', () => {
    applyTheme('light'); expect(currentTheme()).toBe('light');
    applyTheme('dark'); expect(currentTheme()).toBe('dark');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/theme.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/theme/tokens.ts`:

```ts
export const THEME_TOKENS = [
  'bg-canvas','bg-surface','bg-elevated',
  'border-subtle','border-default',
  'text-primary','text-secondary','text-tertiary',
  'accent','accent-hover','accent-glow',
  'success','warning','danger','purple',
] as const;

export type ThemeToken = (typeof THEME_TOKENS)[number];
export type ThemeName = 'light' | 'dark';
export type ThemeValues = Record<ThemeToken, string>;
```

- [ ] **Step 4:** Create `src/lexi-dashboard/ui/theme/themes.ts`:

```ts
import { THEME_TOKENS, type ThemeName, type ThemeValues } from './tokens.js';
export { THEME_TOKENS };
export type { ThemeName, ThemeValues };

export const DARK: ThemeValues = {
  'bg-canvas': '#0a0a0a', 'bg-surface': '#111111', 'bg-elevated': '#1a1a1a',
  'border-subtle': '#1f1f1f', 'border-default': '#2a2a2a',
  'text-primary': '#ededed', 'text-secondary': '#888888', 'text-tertiary': '#666666',
  'accent': '#0070f3', 'accent-hover': '#3b8eff', 'accent-glow': 'rgba(0,112,243,0.15)',
  'success': '#10b981', 'warning': '#f59e0b', 'danger': '#ef4444', 'purple': '#a855f7',
};

export const LIGHT: ThemeValues = {
  'bg-canvas': '#ffffff', 'bg-surface': '#fafafa', 'bg-elevated': '#f4f4f5',
  'border-subtle': '#e4e4e7', 'border-default': '#d4d4d8',
  'text-primary': '#0a0a0a', 'text-secondary': '#52525b', 'text-tertiary': '#a1a1aa',
  'accent': '#0070f3', 'accent-hover': '#0058c4', 'accent-glow': 'rgba(0,112,243,0.08)',
  'success': '#059669', 'warning': '#d97706', 'danger': '#dc2626', 'purple': '#9333ea',
};

export function applyTheme(name: ThemeName): void {
  const values = name === 'light' ? LIGHT : DARK;
  document.documentElement.dataset.theme = name;
  for (const token of THEME_TOKENS) {
    document.documentElement.style.setProperty(`--${token}`, values[token]);
  }
}

export function currentTheme(): ThemeName {
  return (document.documentElement.dataset.theme as ThemeName) ?? 'dark';
}

export function systemPrefers(): ThemeName {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
```

- [ ] **Step 5:** `npm test -- tests/lexi/theme.test.ts` → 4 PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/lexi-dashboard/ui/theme/tokens.ts src/lexi-dashboard/ui/theme/themes.ts tests/lexi/theme.test.ts
git commit -m "feat(lexi): theme tokens and applyTheme() for light + dark"
```

---

## Task 8 — Three-layer light/dark transition

**Files:** Create `src/lexi-dashboard/ui/theme/transition.ts`, `tests/lexi/transition.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/transition.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transitionTheme } from '../../src/lexi-dashboard/ui/theme/transition.js';
import { currentTheme, applyTheme } from '../../src/lexi-dashboard/ui/theme/themes.js';

describe('theme transition', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('data-theme-transitioning');
    document.body.replaceChildren();
    applyTheme('dark');
  });

  it('applies the new theme even without View Transitions support', async () => {
    await transitionTheme('light');
    expect(currentTheme()).toBe('light');
  });

  it('toggles data-theme-transitioning on body during the swap', async () => {
    const observer = vi.fn();
    new MutationObserver(observer).observe(document.body, { attributes: true });
    await transitionTheme('light');
    expect(observer).toHaveBeenCalled();
  });

  it('respects prefers-reduced-motion (no spotlight overlay remains)', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({
        matches: q.includes('reduce'), media: q, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    await transitionTheme('light', { originX: 100, originY: 100 });
    expect(document.getElementById('lexi-spotlight')).toBeNull();
  });

  it('does NOT change theme if next equals current', async () => {
    const before = document.documentElement.dataset.theme;
    await transitionTheme('dark');
    expect(document.documentElement.dataset.theme).toBe(before);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/transition.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/theme/transition.ts`:

```ts
import { applyTheme, currentTheme, type ThemeName } from './themes.js';

export interface TransitionOrigin { originX: number; originY: number; }

const TWEEN_MS = 300;
const SPOTLIGHT_MS = 450;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function viewTransitionsSupported(): boolean {
  return typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition === 'function';
}

function injectGlobalTweenStyle(): HTMLStyleElement {
  const existing = document.getElementById('lexi-tween') as HTMLStyleElement | null;
  if (existing) return existing;
  const style = document.createElement('style');
  style.id = 'lexi-tween';
  style.textContent = `
    body[data-theme-transitioning] *,
    body[data-theme-transitioning] *::before,
    body[data-theme-transitioning] *::after {
      transition:
        background-color ${TWEEN_MS}ms cubic-bezier(0.4, 0, 0.2, 1),
        color ${TWEEN_MS}ms cubic-bezier(0.4, 0, 0.2, 1),
        border-color ${TWEEN_MS}ms cubic-bezier(0.4, 0, 0.2, 1),
        fill ${TWEEN_MS}ms cubic-bezier(0.4, 0, 0.2, 1),
        stroke ${TWEEN_MS}ms cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
  `;
  document.head.appendChild(style);
  return style;
}

function maxRadius(x: number, y: number): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

async function spotlightWipe(originX: number, originY: number): Promise<void> {
  const r = maxRadius(originX, originY);
  const overlay = document.createElement('div');
  overlay.id = 'lexi-spotlight';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999; pointer-events: none;
    background: var(--bg-canvas);
    clip-path: circle(0px at ${originX}px ${originY}px);
    transition: clip-path ${SPOTLIGHT_MS}ms cubic-bezier(0.16, 1, 0.3, 1);
  `;
  document.body.appendChild(overlay);
  void overlay.offsetWidth;
  overlay.style.clipPath = `circle(${r}px at ${originX}px ${originY}px)`;
  await new Promise((r) => setTimeout(r, SPOTLIGHT_MS));
  overlay.remove();
}

export async function transitionTheme(
  next: ThemeName,
  origin?: Partial<TransitionOrigin>,
): Promise<void> {
  if (currentTheme() === next) return;

  injectGlobalTweenStyle();
  document.body.setAttribute('data-theme-transitioning', '');

  const swap = () => applyTheme(next);

  try {
    if (reducedMotion()) {
      swap();
      await new Promise((r) => setTimeout(r, 100));
      return;
    }
    if (viewTransitionsSupported()) {
      const startView = (
        document as unknown as { startViewTransition: (cb: () => void) => { finished: Promise<void> } }
      ).startViewTransition;
      const t = startView(swap);
      await t.finished;
    } else {
      swap();
    }
    if (origin && typeof origin.originX === 'number' && typeof origin.originY === 'number') {
      await spotlightWipe(origin.originX, origin.originY);
    } else {
      await new Promise((r) => setTimeout(r, TWEEN_MS));
    }
  } finally {
    document.body.removeAttribute('data-theme-transitioning');
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/transition.test.ts` → 4 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/theme/transition.ts tests/lexi/transition.test.ts
git commit -m "feat(lexi): three-layer light/dark transition with spotlight wipe"
```

---

## Task 9 — Shell layout CSS

**Files:** Create `src/lexi-dashboard/ui/styles/shell.css`.

- [ ] **Step 1:** Append to `tests/lexi/build.test.ts`:

```ts
  it('shell.css defines the four-region grid', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(path.join(repoRoot, 'dist/lexi-dashboard/ui/styles/shell.css'), 'utf8');
    expect(css).toContain('grid-template-areas');
    expect(css).toContain('"top-bar top-bar top-bar"');
    expect(css).toContain('"nav-rail main right-rail"');
    expect(css).toContain('"bottom-drawer bottom-drawer bottom-drawer"');
  });
```

- [ ] **Step 2:** `npm test -- tests/lexi/build.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/styles/shell.css`:

```css
lexi-app {
  display: grid;
  grid-template-rows: 44px 1fr 32px;
  grid-template-columns: 220px 1fr 280px;
  grid-template-areas:
    "top-bar top-bar top-bar"
    "nav-rail main right-rail"
    "bottom-drawer bottom-drawer bottom-drawer";
  height: 100vh; width: 100vw;
  background: var(--bg-canvas); color: var(--text-primary);
}
lexi-top-bar { grid-area: top-bar; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-canvas); }
lexi-nav-rail { grid-area: nav-rail; display: flex; flex-direction: column; gap: 4px; padding: 12px 8px; border-right: 1px solid var(--border-subtle); background: var(--bg-canvas); }
lexi-nav-rail .brand { font-weight: 700; padding: 4px 8px 12px; color: var(--accent); }
lexi-nav-rail .nav-item { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 6px; color: var(--text-secondary); text-decoration: none; font-size: 13px; }
lexi-nav-rail .nav-item:hover { background: var(--bg-elevated); color: var(--text-primary); }
lexi-nav-rail .nav-item.active { background: var(--bg-elevated); color: var(--text-primary); }
lexi-nav-rail .nav-item .icon { width: 16px; text-align: center; opacity: 0.7; }
main.lexi-main { grid-area: main; overflow: auto; padding: 24px; background: var(--bg-canvas); }
lexi-right-rail { grid-area: right-rail; display: flex; flex-direction: column; gap: 8px; padding: 12px; border-left: 1px solid var(--border-subtle); background: var(--bg-canvas); }
lexi-right-rail .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-tertiary); font-weight: 600; }
lexi-right-rail .placeholder { color: var(--text-tertiary); font-size: 12px; }
lexi-bottom-drawer { grid-area: bottom-drawer; border-top: 1px solid var(--border-subtle); background: var(--bg-canvas); font-size: 12px; color: var(--text-secondary); padding: 6px 16px; display: flex; align-items: center; gap: 12px; }
```

- [ ] **Step 4:** `npm run build:lexi && npm test -- tests/lexi/build.test.ts` → PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/styles/shell.css tests/lexi/build.test.ts
git commit -m "feat(lexi): shell layout CSS grid"
```

---

## Task 10 — Lit components for shell regions

**Files:** Create `src/lexi-dashboard/ui/components/{lexi-app,lexi-nav-rail,lexi-top-bar,lexi-right-rail,lexi-bottom-drawer}.ts`. Modify `src/lexi-dashboard/ui/main.ts`. Create `tests/lexi/components.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/components.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../src/lexi-dashboard/ui/components/lexi-app.js');
});

function mountApp(): HTMLElement {
  document.body.replaceChildren();
  const app = document.createElement('lexi-app');
  document.body.appendChild(app);
  return app;
}

describe('lexi shell components', () => {
  it('registers all five custom elements', () => {
    expect(customElements.get('lexi-app')).toBeDefined();
    expect(customElements.get('lexi-nav-rail')).toBeDefined();
    expect(customElements.get('lexi-top-bar')).toBeDefined();
    expect(customElements.get('lexi-right-rail')).toBeDefined();
    expect(customElements.get('lexi-bottom-drawer')).toBeDefined();
  });

  it('renders four regions and a <main>', async () => {
    const app = mountApp();
    await new Promise((r) => requestAnimationFrame(r));
    expect(app.querySelector('lexi-top-bar')).toBeTruthy();
    expect(app.querySelector('lexi-nav-rail')).toBeTruthy();
    expect(app.querySelector('main.lexi-main')).toBeTruthy();
    expect(app.querySelector('lexi-right-rail')).toBeTruthy();
    expect(app.querySelector('lexi-bottom-drawer')).toBeTruthy();
  });

  it('nav rail lists all 8 sections in spec order', async () => {
    mountApp();
    await new Promise((r) => requestAnimationFrame(r));
    const items = document.querySelectorAll('lexi-nav-rail [data-section]');
    const sections = Array.from(items).map((el) => el.getAttribute('data-section'));
    expect(sections).toEqual(['home','agents','connections','workflows','vault','memory','cron','settings']);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/components.test.ts` → fail.

- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-nav-rail.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

const SECTIONS = [
  { id: 'home', label: 'Home', icon: '◉' },
  { id: 'agents', label: 'Agents', icon: '⚙' },
  { id: 'connections', label: 'Connections', icon: '🔌' },
  { id: 'workflows', label: 'Workflows', icon: '⚡' },
  { id: 'vault', label: 'Vault', icon: '📚' },
  { id: 'memory', label: 'Memory', icon: '🧠' },
  { id: 'cron', label: 'Cron', icon: '⏱' },
  { id: 'settings', label: 'Settings', icon: '☰' },
] as const;

@customElement('lexi-nav-rail')
export class LexiNavRail extends LitElement {
  @property({ type: String }) active = 'home';
  protected createRenderRoot() { return this; }
  render() {
    return html`
      <div class="brand">lexi</div>
      ${SECTIONS.map((s) => html`
        <a href="#/${s.id}" data-section="${s.id}" class="nav-item ${this.active === s.id ? 'active' : ''}">
          <span class="icon">${s.icon}</span>
          <span class="label">${s.label}</span>
        </a>
      `)}
    `;
  }
}
```

- [ ] **Step 4:** Create `src/lexi-dashboard/ui/components/lexi-top-bar.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import './lexi-theme-toggle.js';

@customElement('lexi-top-bar')
export class LexiTopBar extends LitElement {
  protected createRenderRoot() { return this; }
  render() {
    return html`
      <span style="font-weight:700;color:var(--accent)">lexi</span>
      <span style="flex:1"></span>
      <span style="color:var(--text-tertiary);font-size:11px;font-family:'JetBrains Mono',monospace">Cmd+K</span>
      <lexi-theme-toggle></lexi-theme-toggle>
    `;
  }
}
```

- [ ] **Step 5:** Create `src/lexi-dashboard/ui/components/lexi-right-rail.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('lexi-right-rail')
export class LexiRightRail extends LitElement {
  protected createRenderRoot() { return this; }
  render() { return html`<div class="label">Live</div><div class="placeholder">stream — Plan 3</div>`; }
}
```

- [ ] **Step 6:** Create `src/lexi-dashboard/ui/components/lexi-bottom-drawer.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('lexi-bottom-drawer')
export class LexiBottomDrawer extends LitElement {
  protected createRenderRoot() { return this; }
  render() { return html`<span>System map · drag to expand ↑ (Plan 3)</span>`; }
}
```

- [ ] **Step 7:** Create `src/lexi-dashboard/ui/components/lexi-app.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import './lexi-top-bar.js';
import './lexi-nav-rail.js';
import './lexi-right-rail.js';
import './lexi-bottom-drawer.js';

@customElement('lexi-app')
export class LexiApp extends LitElement {
  protected createRenderRoot() { return this; }
  render() {
    return html`
      <lexi-top-bar></lexi-top-bar>
      <lexi-nav-rail active="home"></lexi-nav-rail>
      <main class="lexi-main">
        <h1 style="margin:0 0 8px 0;font-size:28px;font-weight:600">Welcome to Lexi</h1>
        <p style="color:var(--text-secondary)">Sections will be wired in Plans 3-7.</p>
      </main>
      <lexi-right-rail></lexi-right-rail>
      <lexi-bottom-drawer></lexi-bottom-drawer>
    `;
  }
}
```

- [ ] **Step 8:** Replace `src/lexi-dashboard/ui/main.ts`:

```ts
import { applyTheme, currentTheme, systemPrefers, type ThemeName } from './theme/themes.js';
import './components/lexi-app.js';

const stored = localStorage.getItem('lexi-theme') as ThemeName | null;
applyTheme(stored ?? systemPrefers());
console.log('Lexi UI ready · theme:', currentTheme());
```

- [ ] **Step 9:** `npm run build:lexi && npm test -- tests/lexi/components.test.ts` → 3 PASS.
- [ ] **Step 10:** Commit:

```bash
git add src/lexi-dashboard/ui/components/ src/lexi-dashboard/ui/main.ts tests/lexi/components.test.ts
git commit -m "feat(lexi): root Lit components for shell regions"
```

---

## Task 11 — Theme toggle component

**Files:** Create `src/lexi-dashboard/ui/components/lexi-theme-toggle.ts`, `tests/lexi/theme-toggle.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/theme-toggle.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applyTheme } from '../../src/lexi-dashboard/ui/theme/themes.js';

beforeAll(async () => {
  await import('../../src/lexi-dashboard/ui/components/lexi-theme-toggle.js');
});

function mountToggle(): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-theme-toggle');
  document.body.appendChild(el);
  return el;
}

describe('lexi-theme-toggle', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    applyTheme('dark');
  });

  it('toggles theme on click', async () => {
    mountToggle();
    await new Promise((r) => requestAnimationFrame(r));
    const button = document.querySelector('lexi-theme-toggle button')!;
    button.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10 }));
    await new Promise((r) => setTimeout(r, 200));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('persists choice in localStorage', async () => {
    mountToggle();
    await new Promise((r) => requestAnimationFrame(r));
    document.querySelector('lexi-theme-toggle button')!.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10 }));
    await new Promise((r) => setTimeout(r, 200));
    expect(localStorage.getItem('lexi-theme')).toBe('light');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/theme-toggle.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-theme-toggle.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { transitionTheme } from '../theme/transition.js';
import { currentTheme } from '../theme/themes.js';

@customElement('lexi-theme-toggle')
export class LexiThemeToggle extends LitElement {
  protected createRenderRoot() { return this; }

  private async onClick(ev: MouseEvent) {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    await transitionTheme(next, { originX: ev.clientX, originY: ev.clientY });
    localStorage.setItem('lexi-theme', next);
    this.requestUpdate();
  }

  render() {
    const t = currentTheme();
    return html`
      <button type="button" aria-label="Toggle theme" title="Toggle theme (current: ${t})"
        @click=${(ev: MouseEvent) => this.onClick(ev)}
        style="background:transparent;border:1px solid var(--border-subtle);color:var(--text-primary);padding:4px 10px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px">
        ${t === 'dark' ? '☾' : '☀'}
      </button>
    `;
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/theme-toggle.test.ts` → 2 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-theme-toggle.ts tests/lexi/theme-toggle.test.ts
git commit -m "feat(lexi): theme toggle button with sophisticated transition"
```

---

## Task 12 — Command palette (Cmd+K) skeleton

**Files:** Create `src/lexi-dashboard/ui/components/lexi-command-palette.ts`. Modify `src/lexi-dashboard/ui/main.ts`. Create `tests/lexi/command-palette.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/command-palette.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

beforeAll(async () => {
  await import('../../src/lexi-dashboard/ui/components/lexi-command-palette.js');
});

function mountPalette(): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-command-palette');
  document.body.appendChild(el);
  return el;
}

describe('lexi-command-palette', () => {
  beforeEach(() => { mountPalette(); });

  it('is hidden by default', async () => {
    await new Promise((r) => requestAnimationFrame(r));
    const el = document.querySelector('lexi-command-palette') as HTMLElement;
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('opens when Cmd+K is pressed', async () => {
    await new Promise((r) => requestAnimationFrame(r));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    await new Promise((r) => requestAnimationFrame(r));
    const el = document.querySelector('lexi-command-palette') as HTMLElement;
    expect(el.hasAttribute('open')).toBe(true);
  });

  it('closes when Escape is pressed', async () => {
    await new Promise((r) => requestAnimationFrame(r));
    const el = document.querySelector('lexi-command-palette') as HTMLElement;
    el.setAttribute('open', '');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('lists nav sections as commands', async () => {
    const el = document.querySelector('lexi-command-palette') as HTMLElement;
    el.setAttribute('open', '');
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
    const items = el.shadowRoot
      ? el.shadowRoot.querySelectorAll('[data-command]')
      : el.querySelectorAll('[data-command]');
    const ids = Array.from(items).map((i) => i.getAttribute('data-command'));
    for (const expected of ['home','agents','connections','workflows','vault','memory','cron','settings']) {
      expect(ids).toContain(`nav:${expected}`);
    }
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/command-palette.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-command-palette.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface Command { id: string; label: string; hint?: string; run: () => void; }

const NAV_COMMANDS: Command[] = [
  'home','agents','connections','workflows','vault','memory','cron','settings',
].map((id) => ({
  id: `nav:${id}`,
  label: `Go to ${id.charAt(0).toUpperCase() + id.slice(1)}`,
  hint: `nav · ${id}`,
  run: () => { window.location.hash = `#/${id}`; },
}));

@customElement('lexi-command-palette')
export class LexiCommandPalette extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @state() private query = '';

  static styles = css`
    :host { display: none; }
    :host([open]) { display: block; position: fixed; inset: 0; z-index: 9000; background: rgba(0,0,0,0.5); }
    .panel { max-width: 560px; margin: 12vh auto 0; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px; padding: 8px; box-shadow: 0 12px 60px rgba(0,0,0,0.4); }
    input { width: 100%; background: transparent; color: var(--text-primary); border: 0; outline: 0; font: inherit; font-size: 14px; padding: 10px 12px; }
    .results { max-height: 50vh; overflow: auto; padding: 4px 0; }
    [data-command] { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 6px; cursor: pointer; color: var(--text-primary); }
    [data-command]:hover, [data-command][aria-selected="true"] { background: var(--bg-elevated); }
    .hint { color: var(--text-tertiary); margin-left: auto; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this.onKeydown);
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.onKeydown);
  }

  private onKeydown = (ev: KeyboardEvent) => {
    const isMod = ev.metaKey || ev.ctrlKey;
    if (isMod && ev.key.toLowerCase() === 'k') { ev.preventDefault(); this.open = !this.open; }
    else if (ev.key === 'Escape' && this.open) { ev.preventDefault(); this.open = false; }
  };

  private get commands(): Command[] {
    if (!this.query) return [...NAV_COMMANDS];
    const q = this.query.toLowerCase();
    return NAV_COMMANDS.filter((c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }

  render() {
    return html`
      <div class="panel">
        <input placeholder="Search commands..." .value=${this.query}
          @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} autofocus />
        <div class="results">
          ${this.commands.map((c) => html`
            <div data-command="${c.id}" @click=${() => { c.run(); this.open = false; }}>
              <span>${c.label}</span>
              <span class="hint">${c.hint ?? ''}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }
}
```

- [ ] **Step 4:** Replace `src/lexi-dashboard/ui/main.ts`:

```ts
import { applyTheme, currentTheme, systemPrefers, type ThemeName } from './theme/themes.js';
import './components/lexi-app.js';
import './components/lexi-command-palette.js';

const stored = localStorage.getItem('lexi-theme') as ThemeName | null;
applyTheme(stored ?? systemPrefers());

const palette = document.createElement('lexi-command-palette');
document.body.appendChild(palette);

console.log('Lexi UI ready · theme:', currentTheme());
```

- [ ] **Step 5:** `npm test -- tests/lexi/command-palette.test.ts` → 4 PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-command-palette.ts src/lexi-dashboard/ui/main.ts tests/lexi/command-palette.test.ts
git commit -m "feat(lexi): command palette skeleton with nav commands"
```

---

## Task 13 — End-to-end smoke + upstream-clean verification

- [ ] **Step 1:** `npm run build` → no errors.
- [ ] **Step 2:** `npm test -- tests/lexi/` → all green.
- [ ] **Step 3:** `LEXI_PORT=3031 node dist/cli/index.js lexi dashboard` → log line "lexi dashboard listening on port 3031".
- [ ] **Step 4:** Open `http://localhost:3031/`. Verify:
  - Dark theme by default
  - Left rail: 8 sections (Home/Agents/Connections/Workflows/Vault/Memory/Cron/Settings)
  - Top bar: "lexi" + theme toggle
  - Right rail: "Live · stream — Plan 3"
  - Bottom drawer: "System map · drag to expand ↑ (Plan 3)"
  - Main area: "Welcome to Lexi"
- [ ] **Step 5:** Click theme toggle. Verify View Transitions cross-fade + spotlight wipe + localStorage persists `lexi-theme=light` + reload preserves theme.
- [ ] **Step 6:** Press Cmd+K. Verify palette opens with 8 nav commands; typing filters; Escape closes.
- [ ] **Step 7:** `git fetch upstream && git diff upstream/main..HEAD --name-only | sort` → only safe paths (per file structure section). Two upstream-touched files: `package.json`, `package-lock.json`, `src/cli/index.ts`.
- [ ] **Step 8:** `git merge-tree --write-tree upstream/main HEAD | head -5` → tree hash on first line, no `<<<<<<<` markers.

---

## Definition of done for Plan 1

- [ ] All 12 implementation tasks committed
- [ ] `npm test -- tests/lexi/` all green
- [ ] `npm run build` succeeds
- [ ] `lexi dashboard` serves working shell
- [ ] Theme toggle: View Transitions + token tween + spotlight wipe in Chrome 120+; falls back gracefully in Firefox
- [ ] `prefers-reduced-motion: reduce` → instant theme swap, no spotlight
- [ ] `git diff upstream/main..HEAD` → only safe paths
- [ ] `git merge-tree upstream/main HEAD` → no conflict markers

## Hand-off to Plan 2

Plan 2 (Always-on) builds on the working server from Task 4 and the `lexi dashboard` CLI from Task 3. Adds the launchd plist, installer script, `/api/doctor` endpoint, restart button, and verification harness. Adds only NEW files in `scripts/`, `src/lexi-dashboard/fixes/`, and new components in `src/lexi-dashboard/ui/components/`.
