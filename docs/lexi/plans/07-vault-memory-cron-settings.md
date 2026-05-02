# Lexi Dashboard — Plan 7: Vault + Memory + Cron + Settings sections

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the four remaining IA sections — **Vault**, **Memory**, **Cron & Tasks**, and **Settings** — into the Lexi dashboard. Each is a top-level Lit view rendered into `main.lexi-main` when the route hash matches. All upstream endpoints called are READ-ONLY except (1) `PUT /api/vault-file` which we add Lexi-side as a thin write wrapper around `fs.writeFileSync`, and (2) `POST /api/cron/run/:job` which already exists upstream. No writes to memory, graph, or skill registry.

**Architecture:** Pure additive — only new files in `src/lexi-dashboard/ui/components/` (4 view components + 1 markdown vendor module + 1 sanitizer module) and one new server route in `src/lexi-dashboard/server.ts` (`PUT /api/vault-file`). Self-host `marked` + `dompurify` for safe markdown rendering (npm deps).

**Tech Stack:** Same as Plan 1 (Lit 3 web components, esbuild bundle, vitest + jsdom, Express on the server). Adds `marked` (~50KB) and `dompurify` (~25KB) for sanitized markdown.

**Spec reference:** `docs/lexi/specs/2026-05-02-lexi-dashboard-design.md` §4 IA rows for *Vault*, *Memory*, *Cron & Tasks*, *Settings*.

**Conventions inherited from Plan 1:**

- Files: kebab-case (`lexi-vault-view.ts`).
- Components: PascalCase Lit elements with `lexi-` prefix.
- API routes: `/api/<resource>` (no `/lexi/` prefix).
- SSE shape: `{ type, ts, payload }` (not used in this plan).
- Theme tokens: CSS custom properties on `:root[data-theme]`.
- Tests: `tests/lexi/**/*.test.ts`. Use `execFileSync`. DOM via `replaceChildren()` + `createElement()` + `appendChild()` (never `innerHTML` for untrusted input).
- Untrusted HTML rendered via Lit's `unsafeHTML()` directive AFTER passing through DOMPurify. Never raw `el.innerHTML = ...`.
- Commits: conventional, **one commit per section** (`feat(lexi): vault view`, `feat(lexi): memory view`, `feat(lexi): cron view`, `feat(lexi): settings view`).
- TypeScript paths: import upstream services as `../../<area>/<file>.js`. Never edit upstream files.

## File structure (created in this plan)

```
src/lexi-dashboard/
  ui/
    components/
      lexi-vault-view.ts          ← Vault section (file tree + viewer/editor)
      lexi-memory-view.ts         ← Memory section (4 tabs)
      lexi-cron-view.ts           ← Cron section (jobs list + broken-job recovery)
      lexi-settings-view.ts       ← Settings section (5 tabs)
    vendor/
      markdown.ts                 ← marked + DOMPurify pipeline
  server.ts                       ← +1 new route: PUT /api/vault-file
tests/lexi/
  vault-view.test.ts
  vault-write-route.test.ts
  memory-view.test.ts
  cron-view.test.ts
  settings-view.test.ts
```

**Modified upstream files:** none. Modified Lexi files: `src/lexi-dashboard/server.ts` (one new route), `package.json` (add `marked` + `dompurify` deps).

---

## SECTION A — VAULT (Tasks 1-3, commit at end)

## Task 1 — Add `marked` + `dompurify` deps and sanitizer module

**Files:** Modify `package.json`. Create `src/lexi-dashboard/ui/vendor/markdown.ts`. Create `tests/lexi/vault-view.test.ts` (skeleton only — full tests added in Task 2).

- [ ] **Step 1:** Create `tests/lexi/vault-view.test.ts` with the dep guard:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('vault view dependencies', () => {
  it('declares marked and dompurify as dependencies', () => {
    const pkg = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8'));
    expect(pkg.dependencies?.marked).toBeDefined();
    expect(pkg.dependencies?.dompurify).toBeDefined();
  });

  it('renderMarkdown() returns sanitized HTML', async () => {
    const mod = await import('../../src/lexi-dashboard/ui/vendor/markdown.js');
    expect(typeof mod.renderMarkdown).toBe('function');
    const out = mod.renderMarkdown('# hi');
    expect(out).toContain('<h1');
    expect(out).toContain('hi');
  });

  it('renderMarkdown() strips <script> and javascript: URLs', async () => {
    const { renderMarkdown } = await import('../../src/lexi-dashboard/ui/vendor/markdown.js');
    const dirty = '<script>alert(1)</script>\n[x](javascript:alert(1))';
    const clean = renderMarkdown(dirty);
    expect(clean).not.toContain('<script');
    expect(clean.toLowerCase()).not.toContain('javascript:');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/vault-view.test.ts` → 3 fail.
- [ ] **Step 3:** Edit `package.json` — add to `dependencies`:

```json
"marked": "^14.1.3",
"dompurify": "^3.1.7",
"@types/dompurify": "^3.0.5"
```

(`@types/dompurify` goes in `devDependencies` if your repo separates them; co-located is also fine.) Then `npm install`.

- [ ] **Step 4:** Create `src/lexi-dashboard/ui/vendor/markdown.ts`:

```ts
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: false });

/**
 * Renders trusted-source Markdown (vault files written by the user) to
 * sanitized HTML. Even though the corpus is local-only, we sanitize
 * defense-in-depth against e.g. notes pasted from the web.
 *
 * Returns a string of HTML safe to pass to Lit's `unsafeHTML()` directive.
 */
export function renderMarkdown(input: string): string {
  const raw = marked.parse(input, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
```

- [ ] **Step 5:** `npm test -- tests/lexi/vault-view.test.ts` → 3 PASS.
- [ ] **Step 6:** No commit yet. Continue to Task 2.

---

## Task 2 — `lexi-vault-view` component (tree + viewer)

**Files:** Create `src/lexi-dashboard/ui/components/lexi-vault-view.ts`. Extend `tests/lexi/vault-view.test.ts`.

- [ ] **Step 1:** Append to `tests/lexi/vault-view.test.ts`:

```ts
import { vi, beforeEach, afterEach } from 'vitest';

describe('lexi-vault-view component', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-vault-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/vault-files')) {
        return new Response(JSON.stringify({
          files: [
            { relPath: '00-System/notes.md', title: 'Notes', folder: '00-System', mtime: '2026-05-01T10:00:00Z', sizeBytes: 120 },
            { relPath: '01-Vision/why.md', title: 'Why', folder: '01-Vision', mtime: '2026-04-30T10:00:00Z', sizeBytes: 80 },
          ],
          total: 2, folderCounts: { '00-System': 1, '01-Vision': 1 },
        }), { headers: { 'content-type': 'application/json' } });
      }
      if (url.startsWith('/api/vault-file')) {
        return new Response(JSON.stringify({ path: '00-System/notes.md', content: '# Hi\n\nbody' }), { headers: { 'content-type': 'application/json' } });
      }
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  function mount(): HTMLElement {
    const el = document.createElement('lexi-vault-view');
    document.body.appendChild(el);
    return el;
  }

  it('registers as a custom element', () => {
    expect(customElements.get('lexi-vault-view')).toBeDefined();
  });

  it('loads the file tree on connect', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 20));
    const items = document.querySelectorAll('lexi-vault-view [data-file]');
    expect(items.length).toBe(2);
  });

  it('selecting a file fetches and renders markdown as HTML', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 20));
    (document.querySelector('lexi-vault-view [data-file="00-System/notes.md"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    const viewer = document.querySelector('lexi-vault-view .vault-viewer')!;
    expect(viewer.querySelector('h1')).toBeTruthy();
    expect(viewer.textContent).toContain('Hi');
  });

  it('search box updates the API query string', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 20));
    const search = document.querySelector('lexi-vault-view input[type="search"]') as HTMLInputElement;
    search.value = 'why';
    search.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 20));
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const called = calls.some((c) => String(c[0]).includes('q=why'));
    expect(called).toBe(true);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/vault-view.test.ts` → 4 new tests fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-vault-view.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { renderMarkdown } from '../vendor/markdown.js';

interface VaultFile { relPath: string; title: string; folder: string; mtime: string; sizeBytes: number; }

@customElement('lexi-vault-view')
export class LexiVaultView extends LitElement {
  @state() private files: VaultFile[] = [];
  @state() private query = '';
  @state() private selected: string | null = null;
  @state() private content = '';
  @state() private editing = false;
  @state() private draft = '';
  @state() private status: 'idle' | 'loading' | 'saving' | 'saved' | 'error' = 'idle';

  protected createRenderRoot() { return this; }

  connectedCallback(): void { super.connectedCallback(); void this.loadFiles(); }

  private async loadFiles(): Promise<void> {
    this.status = 'loading';
    const params = new URLSearchParams({ limit: '120', sinceDays: '90' });
    if (this.query) params.set('q', this.query);
    try {
      const res = await fetch(`/api/vault-files?${params.toString()}`);
      const body = await res.json() as { files: VaultFile[] };
      this.files = body.files;
      this.status = 'idle';
    } catch { this.status = 'error'; }
  }

  private async openFile(relPath: string): Promise<void> {
    this.selected = relPath;
    this.editing = false;
    this.status = 'loading';
    try {
      const res = await fetch(`/api/vault-file?path=${encodeURIComponent(relPath)}`);
      const body = await res.json() as { content: string };
      this.content = body.content;
      this.draft = body.content;
      this.status = 'idle';
    } catch { this.status = 'error'; }
  }

  private async save(): Promise<void> {
    if (!this.selected) return;
    this.status = 'saving';
    try {
      const res = await fetch(`/api/vault-file?path=${encodeURIComponent(this.selected)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: this.draft }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.content = this.draft;
      this.editing = false;
      this.status = 'saved';
      setTimeout(() => { if (this.status === 'saved') this.status = 'idle'; }, 1500);
    } catch { this.status = 'error'; }
  }

  private grouped(): Map<string, VaultFile[]> {
    const m = new Map<string, VaultFile[]>();
    for (const f of this.files) {
      if (!m.has(f.folder)) m.set(f.folder, []);
      m.get(f.folder)!.push(f);
    }
    return m;
  }

  render() {
    const groups = this.grouped();
    return html`
      <style>
        lexi-vault-view { display: grid; grid-template-columns: 280px 1fr; gap: 16px; height: 100%; }
        lexi-vault-view .tree { border-right: 1px solid var(--border-subtle); padding-right: 12px; overflow: auto; }
        lexi-vault-view input[type="search"] { width: 100%; padding: 6px 10px; background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: 6px; color: var(--text-primary); font: inherit; margin-bottom: 8px; }
        lexi-vault-view [data-file] { display: block; padding: 4px 8px; border-radius: 4px; color: var(--text-secondary); cursor: pointer; font-size: 12px; }
        lexi-vault-view [data-file]:hover, lexi-vault-view [data-file].active { background: var(--bg-elevated); color: var(--text-primary); }
        lexi-vault-view .folder { font-size: 10px; text-transform: uppercase; color: var(--text-tertiary); padding: 8px 8px 2px; letter-spacing: 0.4px; }
        lexi-vault-view .pane { display: flex; flex-direction: column; min-width: 0; }
        lexi-vault-view .toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        lexi-vault-view .toolbar button { background: transparent; border: 1px solid var(--border-default); color: var(--text-primary); padding: 4px 10px; border-radius: 6px; font: inherit; font-size: 12px; cursor: pointer; }
        lexi-vault-view .toolbar button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
        lexi-vault-view .vault-viewer, lexi-vault-view textarea { flex: 1; overflow: auto; padding: 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; }
        lexi-vault-view textarea { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--text-primary); resize: none; outline: none; width: 100%; }
        lexi-vault-view .empty { color: var(--text-tertiary); padding: 24px; text-align: center; font-size: 13px; }
        lexi-vault-view .status { font-size: 11px; color: var(--text-tertiary); margin-left: auto; }
      </style>
      <div class="tree">
        <input type="search" placeholder="Search vault..." .value=${this.query}
          @input=${(e: Event) => { this.query = (e.target as HTMLInputElement).value; void this.loadFiles(); }} />
        ${[...groups.entries()].map(([folder, fs]) => html`
          <div class="folder">${folder} · ${fs.length}</div>
          ${fs.map((f) => html`
            <a data-file="${f.relPath}" class="${this.selected === f.relPath ? 'active' : ''}"
               @click=${(e: Event) => { e.preventDefault(); void this.openFile(f.relPath); }}>${f.title}</a>
          `)}
        `)}
      </div>
      <div class="pane">
        <div class="toolbar">
          ${this.selected ? html`
            <button @click=${() => { this.editing = !this.editing; this.draft = this.content; }}>${this.editing ? 'Cancel' : 'Edit'}</button>
            ${this.editing ? html`<button class="primary" @click=${() => void this.save()}>Save</button>` : ''}
            <span class="status">${this.status === 'saving' ? 'saving…' : this.status === 'saved' ? 'saved ✓' : this.status === 'error' ? 'error' : this.selected}</span>
          ` : html`<span class="status">Select a file</span>`}
        </div>
        ${!this.selected ? html`<div class="empty">Pick a file from the tree to view or edit.</div>`
          : this.editing
            ? html`<textarea .value=${this.draft} @input=${(e: Event) => { this.draft = (e.target as HTMLTextAreaElement).value; }}></textarea>`
            : html`<div class="vault-viewer">${unsafeHTML(renderMarkdown(this.content))}</div>`}
      </div>
    `;
  }
}
```

> Note: `unsafeHTML()` is Lit's official directive for rendering HTML strings; the input is already sanitized by `renderMarkdown()` (DOMPurify). The `<style>` block is inside `render()` because the component uses light DOM.

- [ ] **Step 4:** `npm test -- tests/lexi/vault-view.test.ts` → 4 PASS.
- [ ] **Step 5:** No commit yet. Continue to Task 3.

---

## Task 3 — `PUT /api/vault-file` server route + commit Vault section

**Files:** Modify `src/lexi-dashboard/server.ts`. Create `tests/lexi/vault-write-route.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/vault-write-route.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';

describe('PUT /api/vault-file', () => {
  let server: LexiServer; let baseUrl: string; let baseDir: string;
  beforeAll(async () => {
    baseDir = mkdtempSync(path.join(tmpdir(), 'lexi-vault-'));
    mkdirSync(path.join(baseDir, 'vault', '00-System'), { recursive: true });
    writeFileSync(path.join(baseDir, 'vault', '00-System', 'notes.md'), '# Original\n');
    process.env.CLEMENTINE_BASE_DIR = baseDir;
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });
  afterAll(async () => {
    await server.stop();
    rmSync(baseDir, { recursive: true, force: true });
    delete process.env.CLEMENTINE_BASE_DIR;
  });

  it('writes new content to an existing vault file', async () => {
    const res = await fetch(`${baseUrl}/api/vault-file?path=${encodeURIComponent('00-System/notes.md')}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '# Updated\n\nbody' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, path: '00-System/notes.md' });
    const onDisk = readFileSync(path.join(baseDir, 'vault', '00-System', 'notes.md'), 'utf-8');
    expect(onDisk).toContain('Updated');
  });

  it('rejects path traversal', async () => {
    const res = await fetch(`${baseUrl}/api/vault-file?path=${encodeURIComponent('../../etc/passwd')}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'x' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for files outside vault tree', async () => {
    const res = await fetch(`${baseUrl}/api/vault-file?path=${encodeURIComponent('does/not/exist.md')}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'x' }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/vault-write-route.test.ts` → 3 fail.
- [ ] **Step 3:** Edit `src/lexi-dashboard/server.ts`. Add near the top with the other `node:` imports:

```ts
import { existsSync, writeFileSync, statSync } from 'node:fs';
import os from 'node:os';
```

Then add this route registration block right after the `app.get('/health', ...)` block (or wherever Plan 4/5 added their `/api/*` routes):

```ts
  // Vault write — Lexi-only route. Upstream offers GET /api/vault-file but
  // not PUT. We only allow rewriting existing .md files inside ~/.clementine/vault.
  app.use(express.json({ limit: '1mb' }));
  app.put('/api/vault-file', (req, res) => {
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    const baseDir = process.env.CLEMENTINE_BASE_DIR ?? path.join(os.homedir(), '.clementine');
    const vaultRoot = path.join(baseDir, 'vault');
    if (!relPath || relPath.includes('..') || path.isAbsolute(relPath)) {
      res.status(400).json({ error: 'Bad path' });
      return;
    }
    const full = path.resolve(vaultRoot, relPath);
    if (!full.startsWith(vaultRoot + path.sep)) { res.status(400).json({ error: 'Outside vault root' }); return; }
    if (!existsSync(full) || !statSync(full).isFile()) { res.status(404).json({ error: 'Not found' }); return; }
    if (!full.endsWith('.md')) { res.status(400).json({ error: 'Only .md files writable' }); return; }
    const body = req.body as { content?: unknown };
    if (typeof body?.content !== 'string') { res.status(400).json({ error: 'Missing content' }); return; }
    try {
      writeFileSync(full, body.content, 'utf-8');
      res.json({ ok: true, path: relPath, bytes: Buffer.byteLength(body.content, 'utf-8') });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
```

- [ ] **Step 4:** `npm test -- tests/lexi/vault-write-route.test.ts tests/lexi/vault-view.test.ts` → all PASS.
- [ ] **Step 5:** Commit:

```bash
git add package.json package-lock.json src/lexi-dashboard/ui/vendor/markdown.ts \
  src/lexi-dashboard/ui/components/lexi-vault-view.ts src/lexi-dashboard/server.ts \
  tests/lexi/vault-view.test.ts tests/lexi/vault-write-route.test.ts
git commit -m "feat(lexi): vault view with tree, search, sanitized markdown viewer, and editor"
```

---

## SECTION B — MEMORY (Tasks 4-6, commit at end)

## Task 4 — `lexi-memory-view` skeleton with tab strip

**Files:** Create `src/lexi-dashboard/ui/components/lexi-memory-view.ts`. Create `tests/lexi/memory-view.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/memory-view.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('lexi-memory-view skeleton', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-memory-view.js');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  function mount(): HTMLElement {
    const el = document.createElement('lexi-memory-view');
    document.body.appendChild(el);
    return el;
  }

  it('registers as a custom element', () => {
    expect(customElements.get('lexi-memory-view')).toBeDefined();
  });

  it('renders four tab buttons in spec order', async () => {
    mount();
    await new Promise((r) => requestAnimationFrame(r));
    const tabs = document.querySelectorAll('lexi-memory-view [data-tab]');
    const ids = Array.from(tabs).map((t) => t.getAttribute('data-tab'));
    expect(ids).toEqual(['stats', 'graph', 'recall', 'integrity']);
  });

  it('clicking a tab updates the active panel', async () => {
    mount();
    await new Promise((r) => requestAnimationFrame(r));
    (document.querySelector('lexi-memory-view [data-tab="recall"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.querySelector('lexi-memory-view [data-panel="recall"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/memory-view.test.ts` → 3 fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-memory-view.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

type Tab = 'stats' | 'graph' | 'recall' | 'integrity';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'stats', label: 'Stats' },
  { id: 'graph', label: 'Graph' },
  { id: 'recall', label: 'Recall Traces' },
  { id: 'integrity', label: 'Integrity' },
];

interface MemoryStats { chunks?: number; embeddings?: number; pinned?: number; superseded?: number; }
interface GraphStats { nodes?: number; edges?: number; entities?: number; }
interface RecallTrace { id: string; ts: number; query: string; hits: number; }
interface IntegrityResult { name: string; ok: boolean; detail?: string; }

@customElement('lexi-memory-view')
export class LexiMemoryView extends LitElement {
  @state() private tab: Tab = 'stats';
  @state() private stats: MemoryStats = {};
  @state() private health: { status?: string } = {};
  @state() private graph: GraphStats = {};
  @state() private traces: RecallTrace[] = [];
  @state() private expanded = new Set<string>();
  @state() private integrity: IntegrityResult[] = [];
  @state() private integrityRunning = false;

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    const [s, h, g, t] = await Promise.all([
      fetch('/api/memory').then((r) => r.json()).catch(() => ({})),
      fetch('/api/memory/health').then((r) => r.json()).catch(() => ({})),
      fetch('/api/memory/graph-stats').then((r) => r.json()).catch(() => ({})),
      fetch('/api/recall-traces?limit=50').then((r) => r.json()).catch(() => ({ traces: [] })),
    ]);
    this.stats = s; this.health = h; this.graph = g;
    this.traces = (t.traces ?? t.items ?? []) as RecallTrace[];
  }

  private async runIntegrity(): Promise<void> {
    this.integrityRunning = true;
    try {
      const res = await fetch('/api/memory/health/action', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'integrity' }),
      });
      const body = await res.json() as { results?: IntegrityResult[] };
      this.integrity = body.results ?? [];
    } catch { this.integrity = [{ name: 'fetch', ok: false, detail: 'request failed' }]; }
    this.integrityRunning = false;
  }

  private renderStats() {
    const cells: Array<[string, number | string]> = [
      ['Chunks', this.stats.chunks ?? 0],
      ['Embeddings', this.stats.embeddings ?? 0],
      ['Pinned', this.stats.pinned ?? 0],
      ['Superseded', this.stats.superseded ?? 0],
      ['Health', this.health.status ?? 'unknown'],
    ];
    return html`
      <div data-panel="stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
        ${cells.map(([k, v]) => html`
          <div style="padding:14px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px">
            <div style="font-size:11px;text-transform:uppercase;color:var(--text-tertiary);letter-spacing:0.5px">${k}</div>
            <div style="font-size:24px;font-weight:600;margin-top:4px">${v}</div>
          </div>
        `)}
      </div>
    `;
  }

  private renderGraph() {
    const total = (this.graph.nodes ?? 0) + (this.graph.edges ?? 0) + (this.graph.entities ?? 0) || 1;
    const bar = (label: string, value: number, color: string) => html`
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>${label}</span><span class="mono">${value}</span></div>
        <div style="height:8px;background:var(--bg-elevated);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${(value / total) * 100}%;background:${color}"></div>
        </div>
      </div>
    `;
    return html`
      <div data-panel="graph" style="max-width:520px">
        ${bar('Nodes', this.graph.nodes ?? 0, 'var(--accent)')}
        ${bar('Edges', this.graph.edges ?? 0, 'var(--success)')}
        ${bar('Entities', this.graph.entities ?? 0, 'var(--purple)')}
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:8px">Counters from /api/memory/graph-stats. Full graph viz lives in upstream Brain panel.</div>
      </div>
    `;
  }

  private renderRecall() {
    return html`
      <div data-panel="recall">
        ${this.traces.length === 0 ? html`<div style="color:var(--text-tertiary);padding:24px">No traces yet.</div>` : ''}
        ${this.traces.map((t) => {
          const isOpen = this.expanded.has(t.id);
          return html`
            <div style="border:1px solid var(--border-subtle);border-radius:6px;margin-bottom:6px;background:var(--bg-surface)">
              <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer"
                   @click=${() => { isOpen ? this.expanded.delete(t.id) : this.expanded.add(t.id); this.requestUpdate(); }}>
                <span class="mono" style="color:var(--text-tertiary);font-size:11px">${new Date(t.ts).toISOString().slice(11, 19)}</span>
                <span style="flex:1">${t.query}</span>
                <span style="color:var(--text-secondary);font-size:12px">${t.hits} hits</span>
              </div>
              ${isOpen ? html`<pre class="mono" style="margin:0;padding:10px 12px;border-top:1px solid var(--border-subtle);font-size:11px;overflow:auto">${JSON.stringify(t, null, 2)}</pre>` : ''}
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderIntegrity() {
    return html`
      <div data-panel="integrity">
        <button @click=${() => void this.runIntegrity()} ?disabled=${this.integrityRunning}
          style="background:var(--accent);color:#fff;border:0;padding:6px 14px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px">
          ${this.integrityRunning ? 'Running…' : 'Run integrity probes'}
        </button>
        <div style="margin-top:12px">
          ${this.integrity.map((r) => html`
            <div style="display:flex;gap:10px;padding:6px 10px;border-bottom:1px solid var(--border-subtle)">
              <span style="color:${r.ok ? 'var(--success)' : 'var(--danger)'}">${r.ok ? '✓' : '✗'}</span>
              <span style="flex:1">${r.name}</span>
              <span style="color:var(--text-tertiary);font-size:12px">${r.detail ?? ''}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  render() {
    const panel = this.tab === 'stats' ? this.renderStats()
      : this.tab === 'graph' ? this.renderGraph()
      : this.tab === 'recall' ? this.renderRecall()
      : this.renderIntegrity();
    return html`
      <div style="display:flex;gap:4px;border-bottom:1px solid var(--border-subtle);margin-bottom:16px">
        ${TABS.map((t) => html`
          <button data-tab="${t.id}" @click=${() => { this.tab = t.id; }}
            style="background:transparent;border:0;border-bottom:2px solid ${this.tab === t.id ? 'var(--accent)' : 'transparent'};color:${this.tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)'};padding:8px 14px;cursor:pointer;font:inherit;font-size:13px">
            ${t.label}
          </button>
        `)}
      </div>
      ${panel}
    `;
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/memory-view.test.ts` → 3 PASS.
- [ ] **Step 5:** No commit. Continue to Task 5.

---

## Task 5 — Memory data wiring + recall trace expansion

**Files:** Extend `tests/lexi/memory-view.test.ts`.

- [ ] **Step 1:** Append:

```ts
describe('lexi-memory-view data fetching', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-memory-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/memory') return new Response(JSON.stringify({ chunks: 1234, embeddings: 1100, pinned: 8, superseded: 12 }));
      if (url === '/api/memory/health') return new Response(JSON.stringify({ status: 'ok' }));
      if (url === '/api/memory/graph-stats') return new Response(JSON.stringify({ nodes: 50, edges: 80, entities: 30 }));
      if (url.startsWith('/api/recall-traces')) return new Response(JSON.stringify({ traces: [{ id: 'r1', ts: Date.now(), query: 'who is kade', hits: 4 }] }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders stats counters from /api/memory', async () => {
    document.body.appendChild(document.createElement('lexi-memory-view'));
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('lexi-memory-view')!.textContent).toContain('1234');
  });

  it('shows recall traces and expands on click', async () => {
    document.body.appendChild(document.createElement('lexi-memory-view'));
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('lexi-memory-view [data-tab="recall"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const row = document.querySelector('lexi-memory-view [data-panel="recall"] > div')!;
    (row.firstElementChild as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.querySelector('lexi-memory-view [data-panel="recall"] pre')).toBeTruthy();
  });

  it('graph tab renders three bars from /api/memory/graph-stats', async () => {
    document.body.appendChild(document.createElement('lexi-memory-view'));
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('lexi-memory-view [data-tab="graph"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const text = document.querySelector('lexi-memory-view [data-panel="graph"]')!.textContent ?? '';
    expect(text).toContain('Nodes');
    expect(text).toContain('Edges');
    expect(text).toContain('Entities');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/memory-view.test.ts` → 3 new tests PASS (component already implements these).
- [ ] **Step 3:** No commit. Continue to Task 6.

---

## Task 6 — Integrity action wiring + commit Memory section

**Files:** Extend `tests/lexi/memory-view.test.ts`.

- [ ] **Step 1:** Append:

```ts
describe('lexi-memory-view integrity action', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-memory-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/memory/health/action' && init?.method === 'POST') {
        return new Response(JSON.stringify({
          results: [
            { name: 'orphan-chunks', ok: true },
            { name: 'embedding-coverage', ok: false, detail: '12 missing' },
          ],
        }));
      }
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('POSTs to /api/memory/health/action and renders results', async () => {
    document.body.appendChild(document.createElement('lexi-memory-view'));
    await new Promise((r) => setTimeout(r, 20));
    (document.querySelector('lexi-memory-view [data-tab="integrity"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    (document.querySelector('lexi-memory-view [data-panel="integrity"] button') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const text = document.querySelector('lexi-memory-view [data-panel="integrity"]')!.textContent ?? '';
    expect(text).toContain('orphan-chunks');
    expect(text).toContain('embedding-coverage');
    expect(text).toContain('12 missing');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/memory-view.test.ts` → all PASS.
- [ ] **Step 3:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-memory-view.ts tests/lexi/memory-view.test.ts
git commit -m "feat(lexi): memory view with stats, graph, recall traces, and integrity tabs"
```

---

## SECTION C — CRON & TASKS (Tasks 7-9, commit at end)

## Task 7 — `lexi-cron-view` jobs list

**Files:** Create `src/lexi-dashboard/ui/components/lexi-cron-view.ts`. Create `tests/lexi/cron-view.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/cron-view.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('lexi-cron-view', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-cron-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.startsWith('/api/cron/broken-jobs')) return new Response(JSON.stringify({ broken: [] }));
      if (url === '/api/cron') return new Response(JSON.stringify({ jobs: [
        { name: 'insight-check', schedule: '*/30 * * * *', lastRun: '2026-05-02T09:00:00Z', nextRun: '2026-05-02T09:30:00Z', lastStatus: 'success', successCount: 100, failCount: 2 },
        { name: 'vault-rollup', schedule: '0 6 * * *', lastRun: '2026-05-02T06:00:00Z', nextRun: '2026-05-03T06:00:00Z', lastStatus: 'failed', successCount: 30, failCount: 1 },
      ] }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('registers as a custom element', () => {
    expect(customElements.get('lexi-cron-view')).toBeDefined();
  });

  it('lists jobs with last_run, next_run, status, counts', async () => {
    document.body.appendChild(document.createElement('lexi-cron-view'));
    await new Promise((r) => setTimeout(r, 20));
    const rows = document.querySelectorAll('lexi-cron-view [data-job]');
    expect(rows.length).toBe(2);
    const text = document.querySelector('lexi-cron-view')!.textContent ?? '';
    expect(text).toContain('insight-check');
    expect(text).toContain('vault-rollup');
    expect(text).toContain('100');
    expect(text).toContain('failed');
  });

  it('renders a Run Now button per job', async () => {
    document.body.appendChild(document.createElement('lexi-cron-view'));
    await new Promise((r) => setTimeout(r, 20));
    const buttons = document.querySelectorAll('lexi-cron-view [data-action="run-now"]');
    expect(buttons.length).toBe(2);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/cron-view.test.ts` → 3 fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-cron-view.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

interface CronJob {
  name: string; schedule: string;
  lastRun?: string; nextRun?: string;
  lastStatus?: 'success' | 'failed' | 'running' | string;
  successCount?: number; failCount?: number;
  workflowId?: string;
}
interface BrokenJob { name: string; reason: string; lastError?: string; workflowId?: string; }

@customElement('lexi-cron-view')
export class LexiCronView extends LitElement {
  @state() private jobs: CronJob[] = [];
  @state() private broken: BrokenJob[] = [];
  @state() private busy = new Set<string>();
  @state() private msg: string | null = null;

  protected createRenderRoot() { return this; }

  connectedCallback(): void { super.connectedCallback(); void this.refresh(); }

  private async refresh(): Promise<void> {
    const [jres, bres] = await Promise.all([
      fetch('/api/cron').then((r) => r.json()).catch(() => ({})),
      fetch('/api/cron/broken-jobs').then((r) => r.json()).catch(() => ({})),
    ]);
    this.jobs = (jres.jobs ?? []) as CronJob[];
    this.broken = (bres.broken ?? bres.jobs ?? []) as BrokenJob[];
  }

  private async runNow(name: string): Promise<void> {
    this.busy.add(name); this.requestUpdate();
    try {
      const res = await fetch(`/api/cron/run/${encodeURIComponent(name)}`, { method: 'POST' });
      this.msg = res.ok ? `${name}: triggered` : `${name}: HTTP ${res.status}`;
    } catch { this.msg = `${name}: request failed`; }
    this.busy.delete(name); this.requestUpdate();
    setTimeout(() => { this.msg = null; this.requestUpdate(); }, 2500);
    void this.refresh();
  }

  private investigate(b: BrokenJob): void {
    if (b.workflowId) {
      window.location.hash = `#/workflows/${encodeURIComponent(b.workflowId)}/recovery`;
    } else {
      this.msg = `${b.name}: ${b.lastError ?? b.reason ?? 'no diagnosis'}`;
      this.requestUpdate();
      setTimeout(() => { this.msg = null; this.requestUpdate(); }, 5000);
    }
  }

  private fmt(d?: string): string { return d ? new Date(d).toLocaleString() : '—'; }

  render() {
    return html`
      ${this.broken.length > 0 ? html`
        <div style="border:1px solid var(--danger);background:rgba(239,68,68,0.08);border-radius:8px;padding:12px;margin-bottom:16px">
          <div style="font-weight:600;color:var(--danger);margin-bottom:6px">${this.broken.length} broken job${this.broken.length === 1 ? '' : 's'}</div>
          ${this.broken.map((b) => html`
            <div style="display:flex;align-items:center;gap:10px;padding:6px 0">
              <span class="mono" style="font-size:12px">${b.name}</span>
              <span style="color:var(--text-secondary);font-size:12px;flex:1">${b.reason}</span>
              <button data-action="investigate" @click=${() => this.investigate(b)}
                style="background:var(--danger);color:#fff;border:0;padding:4px 10px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">
                Investigate
              </button>
            </div>
          `)}
        </div>
      ` : ''}

      ${this.msg ? html`<div style="padding:8px 12px;background:var(--bg-elevated);border-radius:6px;font-size:12px;margin-bottom:12px">${this.msg}</div>` : ''}

      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="text-align:left;color:var(--text-tertiary);font-size:11px;text-transform:uppercase;letter-spacing:0.4px">
            <th style="padding:8px 6px">Job</th>
            <th style="padding:8px 6px">Schedule</th>
            <th style="padding:8px 6px">Last run</th>
            <th style="padding:8px 6px">Next run</th>
            <th style="padding:8px 6px">Status</th>
            <th style="padding:8px 6px;text-align:right">✓ / ✗</th>
            <th style="padding:8px 6px"></th>
          </tr>
        </thead>
        <tbody>
          ${this.jobs.map((j) => html`
            <tr data-job="${j.name}" style="border-top:1px solid var(--border-subtle)">
              <td class="mono" style="padding:8px 6px">${j.name}</td>
              <td class="mono" style="padding:8px 6px;color:var(--text-secondary);font-size:11px">${j.schedule}</td>
              <td style="padding:8px 6px;color:var(--text-secondary)">${this.fmt(j.lastRun)}</td>
              <td style="padding:8px 6px;color:var(--text-secondary)">${this.fmt(j.nextRun)}</td>
              <td style="padding:8px 6px;color:${j.lastStatus === 'success' ? 'var(--success)' : j.lastStatus === 'failed' ? 'var(--danger)' : 'var(--text-secondary)'}">${j.lastStatus ?? '—'}</td>
              <td style="padding:8px 6px;text-align:right;font-family:'JetBrains Mono',monospace">${j.successCount ?? 0} / ${j.failCount ?? 0}</td>
              <td style="padding:8px 6px;text-align:right">
                <button data-action="run-now" ?disabled=${this.busy.has(j.name)} @click=${() => void this.runNow(j.name)}
                  style="background:transparent;color:var(--accent);border:1px solid var(--accent);padding:3px 10px;border-radius:6px;font:inherit;font-size:11px;cursor:pointer">
                  ${this.busy.has(j.name) ? '…' : 'Run now'}
                </button>
              </td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/cron-view.test.ts` → 3 PASS.
- [ ] **Step 5:** No commit. Continue to Task 8.

---

## Task 8 — Broken jobs banner + Investigate routing

**Files:** Extend `tests/lexi/cron-view.test.ts`.

- [ ] **Step 1:** Append:

```ts
describe('lexi-cron-view broken jobs', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-cron-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/cron') return new Response(JSON.stringify({ jobs: [] }));
      if (url === '/api/cron/broken-jobs') return new Response(JSON.stringify({
        broken: [
          { name: 'insight-check', reason: 'failing 7 runs', lastError: 'timeout', workflowId: 'wf-42' },
          { name: 'orphan-task', reason: 'unknown', lastError: 'AttributeError' },
        ],
      }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('surfaces broken jobs in a banner', async () => {
    document.body.appendChild(document.createElement('lexi-cron-view'));
    await new Promise((r) => setTimeout(r, 20));
    const text = document.querySelector('lexi-cron-view')!.textContent ?? '';
    expect(text).toContain('2 broken jobs');
    expect(text).toContain('insight-check');
    expect(text).toContain('orphan-task');
  });

  it('Investigate on a workflow-backed job sets workflow recovery hash', async () => {
    document.body.appendChild(document.createElement('lexi-cron-view'));
    await new Promise((r) => setTimeout(r, 20));
    const before = window.location.hash;
    const buttons = document.querySelectorAll('lexi-cron-view [data-action="investigate"]');
    (buttons[0] as HTMLElement).click();
    expect(window.location.hash).toContain('/workflows/wf-42/recovery');
    window.location.hash = before;
  });

  it('Investigate on a non-workflow job shows raw error inline', async () => {
    document.body.appendChild(document.createElement('lexi-cron-view'));
    await new Promise((r) => setTimeout(r, 20));
    const buttons = document.querySelectorAll('lexi-cron-view [data-action="investigate"]');
    (buttons[1] as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.querySelector('lexi-cron-view')!.textContent).toContain('AttributeError');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/cron-view.test.ts` → 3 new tests PASS.
- [ ] **Step 3:** No commit. Continue to Task 9.

---

## Task 9 — Run-now POST + commit Cron section

**Files:** Extend `tests/lexi/cron-view.test.ts`.

- [ ] **Step 1:** Append:

```ts
describe('lexi-cron-view run-now', () => {
  let posted: string[] = [];
  beforeEach(async () => {
    posted = [];
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-cron-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST' && url.startsWith('/api/cron/run/')) {
        posted.push(url);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url === '/api/cron/broken-jobs') return new Response(JSON.stringify({ broken: [] }));
      if (url === '/api/cron') return new Response(JSON.stringify({ jobs: [{ name: 'foo', schedule: '* * * * *', lastStatus: 'success' }] }));
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('POSTs to /api/cron/run/:job and shows confirmation', async () => {
    document.body.appendChild(document.createElement('lexi-cron-view'));
    await new Promise((r) => setTimeout(r, 20));
    (document.querySelector('lexi-cron-view [data-action="run-now"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(posted).toContain('/api/cron/run/foo');
    expect(document.querySelector('lexi-cron-view')!.textContent).toContain('triggered');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/cron-view.test.ts` → all PASS.
- [ ] **Step 3:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-cron-view.ts tests/lexi/cron-view.test.ts
git commit -m "feat(lexi): cron view with jobs list, broken-job recovery, and run-now"
```

---

## SECTION D — SETTINGS (Tasks 10-12, commit at end)

## Task 10 — `lexi-settings-view` shell with 5 tabs + Theme tab

**Files:** Create `src/lexi-dashboard/ui/components/lexi-settings-view.ts`. Create `tests/lexi/settings-view.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/settings-view.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyTheme } from '../../src/lexi-dashboard/ui/theme/themes.js';

describe('lexi-settings-view shell', () => {
  beforeEach(async () => {
    document.body.replaceChildren();
    document.documentElement.removeAttribute('data-theme');
    localStorage.clear();
    applyTheme('dark');
    await import('../../src/lexi-dashboard/ui/components/lexi-settings-view.js');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('registers as a custom element', () => {
    expect(customElements.get('lexi-settings-view')).toBeDefined();
  });

  it('renders five tab buttons in spec order', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => requestAnimationFrame(r));
    const ids = Array.from(document.querySelectorAll('lexi-settings-view [data-tab]')).map((t) => t.getAttribute('data-tab'));
    expect(ids).toEqual(['theme', 'auth', 'tokens', 'secrets', 'advanced']);
  });

  it('Theme tab has light/dark/system radios and a follow-system toggle', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => requestAnimationFrame(r));
    const radios = document.querySelectorAll('lexi-settings-view [data-panel="theme"] input[type="radio"]');
    expect(radios.length).toBe(3);
    expect(document.querySelector('lexi-settings-view [data-panel="theme"] [data-control="follow-system"]')).toBeTruthy();
  });

  it('changing theme radio applies theme and persists to localStorage', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => requestAnimationFrame(r));
    const lightRadio = document.querySelector('lexi-settings-view input[type="radio"][value="light"]') as HTMLInputElement;
    lightRadio.checked = true;
    lightRadio.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('lexi-theme')).toBe('light');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/settings-view.test.ts` → 4 fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-settings-view.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { transitionTheme } from '../theme/transition.js';
import { currentTheme, systemPrefers } from '../theme/themes.js';

type Tab = 'theme' | 'auth' | 'tokens' | 'secrets' | 'advanced';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'theme', label: 'Theme' },
  { id: 'auth', label: 'Auth' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'secrets', label: 'Secrets' },
  { id: 'advanced', label: 'Advanced' },
];

interface AuthSession { id: string; createdAt?: string; userAgent?: string; current?: boolean; }
interface SecretRef { name: string; source: string; }

@customElement('lexi-settings-view')
export class LexiSettingsView extends LitElement {
  @state() private tab: Tab = 'theme';
  @state() private themeChoice: 'light' | 'dark' | 'system' =
    (localStorage.getItem('lexi-theme-mode') as 'light' | 'dark' | 'system' | null) ?? 'dark';
  @state() private followSystem = localStorage.getItem('lexi-follow-system') === '1';
  @state() private sessions: AuthSession[] = [];
  @state() private secrets: SecretRef[] = [];
  @state() private logLevel = 'info';
  @state() private port = '3030';
  @state() private msg: string | null = null;

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadAuth();
    void this.loadSecrets();
  }

  private async loadAuth(): Promise<void> {
    try {
      const res = await fetch('/auth/sessions', { credentials: 'same-origin' });
      const body = await res.json() as { sessions?: AuthSession[] };
      this.sessions = body.sessions ?? [];
    } catch { /* */ }
  }

  private async loadSecrets(): Promise<void> {
    try {
      const res = await fetch('/api/secrets/refs');
      if (res.ok) {
        const body = await res.json() as { secrets?: SecretRef[] };
        this.secrets = body.secrets ?? [];
      }
    } catch { /* */ }
  }

  private async revoke(id: string): Promise<void> {
    await fetch(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
    this.sessions = this.sessions.filter((s) => s.id !== id);
  }

  private async setTheme(choice: 'light' | 'dark' | 'system'): Promise<void> {
    this.themeChoice = choice;
    localStorage.setItem('lexi-theme-mode', choice);
    const next = choice === 'system' ? systemPrefers() : choice;
    if (currentTheme() !== next) await transitionTheme(next);
    if (choice !== 'system') localStorage.setItem('lexi-theme', next);
  }

  private toggleFollow(on: boolean): void {
    this.followSystem = on;
    localStorage.setItem('lexi-follow-system', on ? '1' : '0');
  }

  private async rotateToken(): Promise<void> {
    try {
      const res = await fetch('/api/dashboard-token/rotate', { method: 'POST', credentials: 'same-origin' });
      this.msg = res.ok ? 'Token rotated. Re-paste in clients.' : `Rotate failed: ${res.status}`;
    } catch { this.msg = 'Rotate failed: network'; }
    setTimeout(() => { this.msg = null; this.requestUpdate(); }, 4000);
  }

  private async restart(): Promise<void> {
    if (!confirm('Restart Lexi service via launchctl kickstart?')) return;
    try {
      const res = await fetch('/api/lexi/restart', { method: 'POST' });
      this.msg = res.ok ? 'Restart triggered.' : `Restart failed: ${res.status}`;
    } catch { this.msg = 'Restart failed: network'; }
    setTimeout(() => { this.msg = null; this.requestUpdate(); }, 4000);
  }

  private renderTheme() {
    const radio = (val: 'light' | 'dark' | 'system') => html`
      <label style="display:flex;align-items:center;gap:8px;padding:6px 0">
        <input type="radio" name="theme" value="${val}" .checked=${this.themeChoice === val}
          @change=${() => void this.setTheme(val)} />
        <span style="text-transform:capitalize">${val}</span>
      </label>
    `;
    return html`
      <div data-panel="theme">
        ${radio('light')}${radio('dark')}${radio('system')}
        <label data-control="follow-system" style="display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border-subtle)">
          <input type="checkbox" .checked=${this.followSystem} @change=${(e: Event) => this.toggleFollow((e.target as HTMLInputElement).checked)} />
          <span>Follow OS theme changes (matchMedia)</span>
        </label>
      </div>
    `;
  }

  private renderAuth() {
    return html`
      <div data-panel="auth">
        ${this.sessions.length === 0 ? html`<div style="color:var(--text-tertiary);padding:12px 0">No active sessions found.</div>` : ''}
        ${this.sessions.map((s) => html`
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-subtle)">
            <div style="flex:1">
              <div class="mono" style="font-size:12px">${s.id}${s.current ? ' · current' : ''}</div>
              <div style="font-size:11px;color:var(--text-tertiary)">${s.userAgent ?? '—'} · ${s.createdAt ?? ''}</div>
            </div>
            <button ?disabled=${!!s.current} @click=${() => void this.revoke(s.id)}
              style="background:transparent;color:var(--danger);border:1px solid var(--danger);padding:3px 10px;border-radius:6px;font:inherit;font-size:11px;cursor:pointer">Revoke</button>
          </div>
        `)}
      </div>
    `;
  }

  private renderTokens() {
    return html`
      <div data-panel="tokens">
        <p style="color:var(--text-secondary);font-size:13px;max-width:520px">
          The dashboard token authenticates external clients to Lexi. Rotating invalidates all in-use tokens — you'll need to re-paste in any consumers.
        </p>
        <button @click=${() => void this.rotateToken()}
          style="background:var(--accent);color:#fff;border:0;padding:6px 14px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px">
          Rotate dashboard token
        </button>
      </div>
    `;
  }

  private renderSecrets() {
    return html`
      <div data-panel="secrets">
        <p style="color:var(--text-secondary);font-size:13px;max-width:520px">
          Read-only view of integration credentials referenced by Lexi. To <em>add or change</em> a secret, use the
          <a href="#/connections" style="color:var(--accent)">Connections</a> section.
        </p>
        ${this.secrets.length === 0 ? html`<div style="color:var(--text-tertiary);padding:12px 0">No secret references registered.</div>` : ''}
        ${this.secrets.map((s) => html`
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:12px">
            <span class="mono">${s.name}</span>
            <span style="color:var(--text-tertiary)">${s.source}</span>
          </div>
        `)}
      </div>
    `;
  }

  private renderAdvanced() {
    return html`
      <div data-panel="advanced">
        <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px;max-width:240px">
          <span style="font-size:12px;color:var(--text-secondary)">Log level</span>
          <select .value=${this.logLevel} @change=${(e: Event) => { this.logLevel = (e.target as HTMLSelectElement).value; }}
            style="padding:6px 8px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:6px;color:var(--text-primary);font:inherit">
            ${['debug','info','warn','error'].map((l) => html`<option value="${l}">${l}</option>`)}
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px;max-width:240px">
          <span style="font-size:12px;color:var(--text-secondary)">Port override (LEXI_PORT)</span>
          <input type="text" .value=${this.port} @change=${(e: Event) => { this.port = (e.target as HTMLInputElement).value; }}
            style="padding:6px 8px;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:6px;color:var(--text-primary);font:inherit" />
        </label>
        <button data-action="restart" @click=${() => void this.restart()}
          style="background:var(--danger);color:#fff;border:0;padding:6px 14px;border-radius:6px;cursor:pointer;font:inherit;font-size:13px">
          Restart Lexi
        </button>
      </div>
    `;
  }

  render() {
    const panel = this.tab === 'theme' ? this.renderTheme()
      : this.tab === 'auth' ? this.renderAuth()
      : this.tab === 'tokens' ? this.renderTokens()
      : this.tab === 'secrets' ? this.renderSecrets()
      : this.renderAdvanced();
    return html`
      <div style="display:flex;gap:4px;border-bottom:1px solid var(--border-subtle);margin-bottom:16px">
        ${TABS.map((t) => html`
          <button data-tab="${t.id}" @click=${() => { this.tab = t.id; }}
            style="background:transparent;border:0;border-bottom:2px solid ${this.tab === t.id ? 'var(--accent)' : 'transparent'};color:${this.tab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)'};padding:8px 14px;cursor:pointer;font:inherit;font-size:13px">
            ${t.label}
          </button>
        `)}
      </div>
      ${this.msg ? html`<div style="padding:8px 12px;background:var(--bg-elevated);border-radius:6px;font-size:12px;margin-bottom:12px">${this.msg}</div>` : ''}
      ${panel}
    `;
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/settings-view.test.ts` → 4 PASS.
- [ ] **Step 5:** No commit. Continue to Task 11.

---

## Task 11 — Auth tab + Tokens tab wiring

**Files:** Extend `tests/lexi/settings-view.test.ts`.

- [ ] **Step 1:** Append:

```ts
describe('lexi-settings-view auth + tokens', () => {
  let deletes: string[] = [];
  let posts: string[] = [];
  beforeEach(async () => {
    deletes = []; posts = [];
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-settings-view.js');
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/auth/sessions' && (!init || init.method === undefined || init.method === 'GET')) {
        return new Response(JSON.stringify({ sessions: [
          { id: 'sess-1', userAgent: 'Chrome', createdAt: '2026-05-01', current: true },
          { id: 'sess-2', userAgent: 'curl/8', createdAt: '2026-05-02' },
        ] }));
      }
      if (init?.method === 'DELETE' && url.startsWith('/auth/sessions/')) {
        deletes.push(url);
        return new Response('{}', { status: 200 });
      }
      if (init?.method === 'POST' && url === '/api/dashboard-token/rotate') {
        posts.push(url);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('Auth tab lists sessions and revokes non-current ones', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('lexi-settings-view [data-tab="auth"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const buttons = document.querySelectorAll('lexi-settings-view [data-panel="auth"] button');
    // Two sessions, two buttons; the current one is disabled.
    expect(buttons.length).toBe(2);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    (buttons[1] as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect(deletes).toContain('/auth/sessions/sess-2');
  });

  it('Tokens tab POSTs to /api/dashboard-token/rotate and confirms', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('lexi-settings-view [data-tab="tokens"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    (document.querySelector('lexi-settings-view [data-panel="tokens"] button') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toContain('/api/dashboard-token/rotate');
    expect(document.querySelector('lexi-settings-view')!.textContent).toContain('Token rotated');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/settings-view.test.ts` → 2 new tests PASS (component already implements).
- [ ] **Step 3:** No commit. Continue to Task 12.

---

## Task 12 — Secrets + Advanced (restart) tabs + commit Settings section

**Files:** Extend `tests/lexi/settings-view.test.ts`.

- [ ] **Step 1:** Append:

```ts
describe('lexi-settings-view secrets + advanced', () => {
  let posts: string[] = [];
  beforeEach(async () => {
    posts = [];
    document.body.replaceChildren();
    await import('../../src/lexi-dashboard/ui/components/lexi-settings-view.js');
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/secrets/refs') return new Response(JSON.stringify({
        secrets: [{ name: 'OPENAI_API_KEY', source: '~/.config/secrets.env' }],
      }));
      if (init?.method === 'POST' && url === '/api/lexi/restart') {
        posts.push(url);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response('{}');
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('Secrets tab lists registered refs and links to Connections', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('lexi-settings-view [data-tab="secrets"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const panel = document.querySelector('lexi-settings-view [data-panel="secrets"]')!;
    expect(panel.textContent).toContain('OPENAI_API_KEY');
    expect((panel.querySelector('a') as HTMLAnchorElement).hash).toBe('#/connections');
  });

  it('Advanced tab Restart Lexi POSTs to /api/lexi/restart', async () => {
    document.body.appendChild(document.createElement('lexi-settings-view'));
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('lexi-settings-view [data-tab="advanced"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    (document.querySelector('lexi-settings-view [data-action="restart"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(posts).toContain('/api/lexi/restart');
    expect(document.querySelector('lexi-settings-view')!.textContent).toContain('Restart triggered');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/settings-view.test.ts` → all PASS.
- [ ] **Step 3:** Smoke-test the four views end-to-end:
  - `npm run build` → no errors.
  - `npm test -- tests/lexi/` → all green.
  - `LEXI_PORT=3031 node dist/cli/index.js lexi dashboard` and verify in a browser:
    - `#/vault` → tree on left, search filters, click a file renders sanitized markdown, Edit toggles textarea, Save round-trips.
    - `#/memory` → 4 tabs all render; integrity probe button returns results.
    - `#/cron` → jobs list renders; broken-jobs banner shows when present; Run Now triggers POST and shows confirmation.
    - `#/settings` → 5 tabs; theme radios change theme with transition; revoke session works; rotate-token confirms; restart prompts then POSTs.
- [ ] **Step 4:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-settings-view.ts tests/lexi/settings-view.test.ts
git commit -m "feat(lexi): settings view with theme, auth, tokens, secrets, advanced tabs"
```

---

## Definition of done for Plan 7

- [ ] All 12 implementation tasks committed in 4 grouped commits (vault / memory / cron / settings).
- [ ] `npm test -- tests/lexi/` all green (vault-view, vault-write-route, memory-view, cron-view, settings-view).
- [ ] `npm run build` succeeds; `dist/lexi-dashboard/ui/main.js` includes the four new view components.
- [ ] `lexi dashboard` serves all four section routes (`#/vault`, `#/memory`, `#/cron`, `#/settings`) with no console errors.
- [ ] Vault: tree loads, search filters, view renders sanitized markdown (DOMPurify), edit-save round-trips a real file under `~/.clementine/vault/`.
- [ ] Memory: stats counters reflect `/api/memory`; graph bars reflect `/api/memory/graph-stats`; recall traces expand; integrity probe surfaces results.
- [ ] Cron: job list correct; broken-jobs banner only when `/api/cron/broken-jobs` is non-empty; Run Now POSTs and shows status; Investigate routes to recovery hash for workflow-backed jobs and shows error inline otherwise.
- [ ] Settings: theme radios use `transitionTheme()` and persist `lexi-theme-mode` + `lexi-theme`; follow-system toggle persists; sessions list + revoke; rotate-token POSTs; secrets is read-only with link to Connections; restart POSTs to `/api/lexi/restart` after `confirm()`.
- [ ] Only ONE write endpoint added Lexi-side: `PUT /api/vault-file`. All other server routes called are upstream and either read-only or already-existing writes (`POST /api/cron/run/:job`, `DELETE /auth/sessions/:id`, `POST /api/dashboard-token/rotate`, `POST /api/lexi/restart` from Plan 2, `POST /api/memory/health/action` from upstream).
- [ ] No raw `el.innerHTML = ...` assignments anywhere; untrusted markdown rendered via Lit's `unsafeHTML()` directive only after DOMPurify sanitization.
- [ ] `git diff upstream/main..HEAD --name-only` → no edits to upstream files beyond those Plan 1/2 already touched (`package.json`, `package-lock.json`, `src/cli/index.ts`).
- [ ] `git merge-tree upstream/main HEAD | head -5` → no `<<<<<<<` markers.

## Hand-off after Plan 7

All 8 IA sections (Home, Agents, Connections, Workflows, Vault, Memory, Cron, Settings) are now wired. Subsequent plans can focus on (a) the live view (right rail + bottom drawer streams) and (b) the launchd "always-on" hardening / verification harness.
