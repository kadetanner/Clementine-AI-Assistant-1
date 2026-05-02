# Lexi Dashboard — Plan 6: Workflows section

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the existing upstream Drawflow-based workflow builder into the Lexi dashboard (no upstream edits, no reimplementation), wire it to live SSE state from Plan 3, and add an autocompact-thrashing recovery surface so the `s1` step failure (and any future repeats) becomes visible and unblockable instead of silently burning context.

**Architecture:** Lexi reuses upstream `/api/builder/*` endpoints in-process (see `src/cli/dashboard.ts:2936-3157`). All UI is new Lit components in `src/lexi-dashboard/ui/components/workflows/`. Drawflow is **vendored** (self-hosted woff2-style — no CDN) into `src/lexi-dashboard/ui/vendor/drawflow.min.js` to honor §9.11 "no external network" rule. Recovery state persists to `~/.clementine/lexi-stuck-steps.json` (Lexi-owned, not upstream's).

**Tech Stack:** Same as Plan 1. Adds Drawflow 0.0.59 as a runtime dep, vendored at build time via the existing esbuild copy step.

**Spec reference:** `docs/lexi/specs/2026-05-02-lexi-dashboard-design.md` §4 (IA "Workflows" row), §7 (autocompact-thrashing recovery).

**Conventions inherited:** Plan 1 (kebab-case files, `lexi-` Lit prefix, `/api/<resource>`, SSE shape `{type, ts, payload}`, tests under `tests/lexi/`, `execFileSync`, no `innerHTML`, conventional commits).

**Upstream surface consumed (read-only — do not edit):**
- `GET /api/builder/workflows` — list
- `GET /api/builder/workflows/:id` — load
- `PUT /api/builder/workflows/:id` — update meta
- `POST /api/builder/workflows` — create
- `DELETE /api/builder/workflows/:id` — delete
- `POST /api/builder/workflows/:id/save-from-drawflow` — serialize
- `POST /api/builder/workflows/:id/validate` — validate
- `POST /api/builder/workflows/:id/test` — test (mock mode)
- `POST /api/builder/workflows/:id/dry-run` — dry run
- `POST /api/builder/runs/:runId/cancel` — cancel

---

## File structure (created in this plan)

```
src/lexi-dashboard/
  workflows/
    stuck-steps-store.ts            ← persistent ~/.clementine/lexi-stuck-steps.json store
    thrashing-detector.ts           ← server-side watcher, emits workflow_step_stuck
    diagnostics.ts                  ← per-run diagnostics aggregation
  routes/
    workflows.ts                    ← /api/workflows/runs/:runId/diagnostics, /api/workflows/stuck-steps
  ui/
    vendor/
      drawflow.min.js               ← vendored at build time (esbuild copy)
      drawflow.min.css
    components/workflows/
      lexi-workflows-view.ts        ← list view + status dots + stuck-step banner
      lexi-workflow-detail.ts       ← tabbed master view (Builder | Runs | Recovery)
      lexi-workflow-builder.ts      ← Drawflow canvas wrapper
      lexi-workflow-runs.ts         ← live run list + log side panel
      lexi-step-recovery-panel.ts   ← failing prompt + last 3 contexts + skip/retry buttons
tests/lexi/workflows/
  stuck-steps-store.test.ts
  thrashing-detector.test.ts
  diagnostics-route.test.ts
  stuck-steps-route.test.ts
  drawflow-vendor.test.ts
  workflows-view.test.ts
  workflow-builder.test.ts
  step-recovery-panel.test.ts
```

**Modified files:** `package.json` (add `drawflow` dep), `scripts/esbuild-lexi.mjs` (copy `drawflow.min.{js,css}` from `node_modules/drawflow/dist/` into `dist/lexi-dashboard/ui/vendor/`), `src/lexi-dashboard/ui/index.html` (script + link tags for vendored Drawflow), `src/lexi-dashboard/server.ts` (mount workflows router + start thrashing detector). All edits additive.

---

## Task 1 — Vendor Drawflow (no CDN)

**Files:** Modify `package.json`, `scripts/esbuild-lexi.mjs`, `src/lexi-dashboard/ui/index.html`. Create `tests/lexi/workflows/drawflow-vendor.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/workflows/drawflow-vendor.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(__dirname, '../../..');

describe('Drawflow vendoring', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build:lexi'], { cwd: repoRoot, stdio: 'pipe' });
  });

  it('copies drawflow.min.js into dist/lexi-dashboard/ui/vendor/', () => {
    const out = path.join(repoRoot, 'dist/lexi-dashboard/ui/vendor/drawflow.min.js');
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(10_000);
  });

  it('copies drawflow.min.css into dist/lexi-dashboard/ui/vendor/', () => {
    const out = path.join(repoRoot, 'dist/lexi-dashboard/ui/vendor/drawflow.min.css');
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(500);
  });

  it('index.html references vendored paths (not CDN URLs)', () => {
    const html = readFileSync(path.join(repoRoot, 'dist/lexi-dashboard/ui/index.html'), 'utf8');
    expect(html).toContain('/assets/vendor/drawflow.min.js');
    expect(html).toContain('/assets/vendor/drawflow.min.css');
    expect(html).not.toMatch(/cdn\.|unpkg\.|jsdelivr\./);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/workflows/drawflow-vendor.test.ts` → fail.
- [ ] **Step 3:** `npm install drawflow@^0.0.59` (runtime dep — added to `dependencies`).
- [ ] **Step 4:** Edit `scripts/esbuild-lexi.mjs`. After the existing `for (const sub of ['index.html', 'fonts', 'styles']) { ... }` loop, add:

```js
import { existsSync as _existsSync } from 'node:fs';

// Vendor Drawflow — no external CDN per spec §9.11
const drawflowDir = path.join(repoRoot, 'node_modules/drawflow/dist');
const vendorOut = path.join(outUi, 'vendor');
mkdirSync(vendorOut, { recursive: true });
for (const file of ['drawflow.min.js', 'drawflow.min.css']) {
  const src = path.join(drawflowDir, file);
  if (!_existsSync(src)) throw new Error(`Drawflow asset missing: ${src} — did you 'npm install drawflow'?`);
  cpSync(src, path.join(vendorOut, file));
}
console.log('Vendored Drawflow into', vendorOut);
```

- [ ] **Step 5:** Edit `src/lexi-dashboard/ui/index.html`. Inside `<head>`, after the existing `<link rel="stylesheet" href="/assets/styles/shell.css" />`, add:

```html
  <link rel="stylesheet" href="/assets/vendor/drawflow.min.css" />
  <script defer src="/assets/vendor/drawflow.min.js"></script>
```

- [ ] **Step 6:** `npm run build:lexi && npm test -- tests/lexi/workflows/drawflow-vendor.test.ts` → 3 PASS.
- [ ] **Step 7:** Commit:

```bash
git add package.json package-lock.json scripts/esbuild-lexi.mjs src/lexi-dashboard/ui/index.html tests/lexi/workflows/drawflow-vendor.test.ts
git commit -m "build(lexi): vendor Drawflow for offline workflow builder"
```

---

## Task 2 — Stuck-steps persistent store

**Files:** Create `src/lexi-dashboard/workflows/stuck-steps-store.ts`, `tests/lexi/workflows/stuck-steps-store.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/workflows/stuck-steps-store.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStuckStepsStore, type StuckStep } from '../../../src/lexi-dashboard/workflows/stuck-steps-store.js';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'lexi-stuck-'));
  file = path.join(dir, 'lexi-stuck-steps.json');
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('stuck-steps-store', () => {
  it('returns empty list when file does not exist', async () => {
    const store = createStuckStepsStore(file);
    expect(await store.list()).toEqual([]);
  });

  it('marks a step stuck and persists to disk', async () => {
    const store = createStuckStepsStore(file);
    const step: StuckStep = {
      workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing',
      detectedAt: 1700000000000, lastError: 'context refilled within 3 turns',
      thrashingEvents: 3,
    };
    await store.mark(step);
    expect(existsSync(file)).toBe(true);
    const persisted = JSON.parse(readFileSync(file, 'utf8'));
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ workflowId: 'wf-a', stepId: 's1' });
  });

  it('upserts on (workflowId, stepId) pair (no duplicates)', async () => {
    const store = createStuckStepsStore(file);
    const base = { workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing' as const, detectedAt: 1, lastError: 'a', thrashingEvents: 3 };
    await store.mark(base);
    await store.mark({ ...base, detectedAt: 2, lastError: 'b', thrashingEvents: 4 });
    const all = await store.list();
    expect(all).toHaveLength(1);
    expect(all[0].lastError).toBe('b');
    expect(all[0].thrashingEvents).toBe(4);
  });

  it('clears a step and rewrites the file', async () => {
    writeFileSync(file, JSON.stringify([
      { workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing', detectedAt: 1, lastError: 'x', thrashingEvents: 3 },
      { workflowId: 'wf-b', stepId: 's2', reason: 'autocompact-thrashing', detectedAt: 2, lastError: 'y', thrashingEvents: 5 },
    ]));
    const store = createStuckStepsStore(file);
    await store.clear('wf-a', 's1');
    const all = await store.list();
    expect(all).toHaveLength(1);
    expect(all[0].workflowId).toBe('wf-b');
  });

  it('survives a corrupt file by treating it as empty', async () => {
    writeFileSync(file, '{not json');
    const store = createStuckStepsStore(file);
    expect(await store.list()).toEqual([]);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/workflows/stuck-steps-store.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/workflows/stuck-steps-store.ts`:

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface StuckStep {
  workflowId: string;
  stepId: string;
  reason: 'autocompact-thrashing' | 'repeated-error' | 'manual';
  detectedAt: number;
  lastError: string;
  thrashingEvents: number;
}

export interface StuckStepsStore {
  list(): Promise<StuckStep[]>;
  mark(step: StuckStep): Promise<void>;
  clear(workflowId: string, stepId: string): Promise<void>;
}

export function defaultStuckStepsPath(): string {
  return path.join(os.homedir(), '.clementine', 'lexi-stuck-steps.json');
}

async function readSafe(file: string): Promise<StuckStep[]> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StuckStep[]) : [];
  } catch {
    return [];
  }
}

export function createStuckStepsStore(file: string = defaultStuckStepsPath()): StuckStepsStore {
  return {
    list: () => readSafe(file),
    async mark(step) {
      const all = await readSafe(file);
      const idx = all.findIndex((s) => s.workflowId === step.workflowId && s.stepId === step.stepId);
      if (idx >= 0) all[idx] = step; else all.push(step);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(all, null, 2), 'utf8');
    },
    async clear(workflowId, stepId) {
      const all = await readSafe(file);
      const next = all.filter((s) => !(s.workflowId === workflowId && s.stepId === stepId));
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(next, null, 2), 'utf8');
    },
  };
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/workflows/stuck-steps-store.test.ts` → 5 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/workflows/stuck-steps-store.ts tests/lexi/workflows/stuck-steps-store.test.ts
git commit -m "feat(lexi): persistent stuck-steps store at ~/.clementine/lexi-stuck-steps.json"
```

---

## Task 3 — Autocompact-thrashing detector

**Files:** Create `src/lexi-dashboard/workflows/thrashing-detector.ts`, `tests/lexi/workflows/thrashing-detector.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/workflows/thrashing-detector.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createThrashingDetector } from '../../../src/lexi-dashboard/workflows/thrashing-detector.js';
import { createStuckStepsStore } from '../../../src/lexi-dashboard/workflows/stuck-steps-store.js';

let dir: string; let file: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'lexi-detect-')); file = path.join(dir, 'stuck.json'); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('thrashing-detector', () => {
  it('marks step stuck after >=3 thrashing events on same step within 30 min', async () => {
    const store = createStuckStepsStore(file);
    const emitter = vi.fn();
    const detector = createThrashingDetector({ store, emit: emitter, windowMs: 30 * 60_000 });
    const t0 = 1_700_000_000_000;
    await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'autocompact_thrash', ts: t0, message: 'context refill 1' });
    await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'autocompact_thrash', ts: t0 + 1000, message: 'context refill 2' });
    expect((await store.list())).toHaveLength(0);
    await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'autocompact_thrash', ts: t0 + 2000, message: 'context refill 3' });
    const stuck = await store.list();
    expect(stuck).toHaveLength(1);
    expect(stuck[0]).toMatchObject({ workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing', thrashingEvents: 3 });
    expect(emitter).toHaveBeenCalledWith(expect.objectContaining({
      type: 'workflow_step_stuck',
      payload: expect.objectContaining({ workflowId: 'wf-a', stepId: 's1' }),
    }));
  });

  it('does NOT trigger if events span more than 30 min', async () => {
    const store = createStuckStepsStore(file);
    const detector = createThrashingDetector({ store, emit: vi.fn(), windowMs: 30 * 60_000 });
    const t0 = 1_700_000_000_000;
    await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'autocompact_thrash', ts: t0, message: 'm' });
    await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'autocompact_thrash', ts: t0 + 31 * 60_000, message: 'm' });
    await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'autocompact_thrash', ts: t0 + 62 * 60_000, message: 'm' });
    expect((await store.list())).toHaveLength(0);
  });

  it('isolates state per (workflowId, stepId)', async () => {
    const store = createStuckStepsStore(file);
    const detector = createThrashingDetector({ store, emit: vi.fn(), windowMs: 30 * 60_000 });
    const t0 = 1_700_000_000_000;
    for (const stepId of ['s1', 's2']) {
      await detector.observe({ workflowId: 'wf-a', stepId, kind: 'autocompact_thrash', ts: t0, message: 'm' });
      await detector.observe({ workflowId: 'wf-a', stepId, kind: 'autocompact_thrash', ts: t0 + 1, message: 'm' });
    }
    expect((await store.list())).toHaveLength(0);
  });

  it('ignores non-autocompact events', async () => {
    const store = createStuckStepsStore(file);
    const detector = createThrashingDetector({ store, emit: vi.fn(), windowMs: 30 * 60_000 });
    for (let i = 0; i < 5; i++) {
      await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'step_complete', ts: i, message: 'ok' });
    }
    expect((await store.list())).toHaveLength(0);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/workflows/thrashing-detector.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/workflows/thrashing-detector.ts`:

```ts
import type { StuckStepsStore } from './stuck-steps-store.js';

export interface ThrashEvent {
  workflowId: string;
  stepId: string;
  kind: 'autocompact_thrash' | 'step_complete' | 'step_error';
  ts: number;
  message: string;
}

export interface SseEvent {
  type: string;
  ts: number;
  payload: unknown;
}

export interface ThrashingDetectorOptions {
  store: StuckStepsStore;
  emit: (event: SseEvent) => void;
  windowMs?: number;
  threshold?: number;
}

export interface ThrashingDetector {
  observe(event: ThrashEvent): Promise<void>;
}

export function createThrashingDetector(opts: ThrashingDetectorOptions): ThrashingDetector {
  const windowMs = opts.windowMs ?? 30 * 60_000;
  const threshold = opts.threshold ?? 3;
  const window: Map<string, ThrashEvent[]> = new Map();

  const key = (e: ThrashEvent) => `${e.workflowId}::${e.stepId}`;

  return {
    async observe(event) {
      if (event.kind !== 'autocompact_thrash') return;
      const k = key(event);
      const recent = (window.get(k) ?? []).filter((e) => event.ts - e.ts <= windowMs);
      recent.push(event);
      window.set(k, recent);

      if (recent.length >= threshold) {
        await opts.store.mark({
          workflowId: event.workflowId,
          stepId: event.stepId,
          reason: 'autocompact-thrashing',
          detectedAt: event.ts,
          lastError: event.message,
          thrashingEvents: recent.length,
        });
        opts.emit({
          type: 'workflow_step_stuck',
          ts: event.ts,
          payload: {
            workflowId: event.workflowId,
            stepId: event.stepId,
            reason: 'autocompact-thrashing',
            thrashingEvents: recent.length,
            lastError: event.message,
          },
        });
        // Reset the window so we don't re-emit on every subsequent event.
        window.delete(k);
      }
    },
  };
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/workflows/thrashing-detector.test.ts` → 4 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/workflows/thrashing-detector.ts tests/lexi/workflows/thrashing-detector.test.ts
git commit -m "feat(lexi): autocompact-thrashing detector with 3-events-in-30min rule"
```

---

## Task 4 — Diagnostics + stuck-steps HTTP routes

**Files:** Create `src/lexi-dashboard/workflows/diagnostics.ts`, `src/lexi-dashboard/routes/workflows.ts`. Modify `src/lexi-dashboard/server.ts`. Create `tests/lexi/workflows/diagnostics-route.test.ts`, `tests/lexi/workflows/stuck-steps-route.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/workflows/diagnostics-route.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

let server: LexiServer; let baseUrl: string; let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'lexi-diag-'));
  process.env.LEXI_STUCK_STEPS_FILE = path.join(dir, 'stuck.json');
  process.env.LEXI_RUNS_FILE = path.join(dir, 'runs.json');
  writeFileSync(process.env.LEXI_RUNS_FILE, JSON.stringify({
    'run-123': {
      runId: 'run-123', workflowId: 'wf-a',
      steps: [
        { stepId: 's1', startedAt: 1, endedAt: 2, status: 'error', error: 'context refilled', context: 'last good ctx A' },
        { stepId: 's1', startedAt: 3, endedAt: 4, status: 'error', error: 'context refilled', context: 'last good ctx B' },
      ],
      autocompactEvents: [
        { stepId: 's1', ts: 5, message: 'autocompact #1' },
        { stepId: 's1', ts: 6, message: 'autocompact #2' },
      ],
      lastFailure: { stepId: 's1', ts: 7, error: 'context refilled', context: 'failing prompt' },
    },
  }));
  server = await startLexiServer({ port: 0 });
  baseUrl = `http://localhost:${server.port}`;
});
afterAll(async () => {
  await server.stop();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.LEXI_STUCK_STEPS_FILE;
  delete process.env.LEXI_RUNS_FILE;
});

describe('GET /api/workflows/runs/:runId/diagnostics', () => {
  it('returns step traces, autocompact events, and last failure', async () => {
    const res = await fetch(`${baseUrl}/api/workflows/runs/run-123/diagnostics`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runId).toBe('run-123');
    expect(body.steps).toHaveLength(2);
    expect(body.autocompactEvents).toHaveLength(2);
    expect(body.lastFailure).toMatchObject({ stepId: 's1', context: 'failing prompt' });
  });

  it('returns 404 for unknown runId', async () => {
    const res = await fetch(`${baseUrl}/api/workflows/runs/unknown/diagnostics`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2:** Create `tests/lexi/workflows/stuck-steps-route.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

let server: LexiServer; let baseUrl: string; let dir: string; let file: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'lexi-stuck-route-'));
  file = path.join(dir, 'stuck.json');
  process.env.LEXI_STUCK_STEPS_FILE = file;
  server = await startLexiServer({ port: 0 });
  baseUrl = `http://localhost:${server.port}`;
});
afterAll(async () => { await server.stop(); rmSync(dir, { recursive: true, force: true }); delete process.env.LEXI_STUCK_STEPS_FILE; });
beforeEach(() => { writeFileSync(file, '[]'); });

describe('/api/workflows/stuck-steps', () => {
  it('GET returns the current list', async () => {
    writeFileSync(file, JSON.stringify([{ workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing', detectedAt: 1, lastError: 'x', thrashingEvents: 3 }]));
    const res = await fetch(`${baseUrl}/api/workflows/stuck-steps`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ workflowId: 'wf-a', stepId: 's1' });
  });

  it('DELETE clears a stuck step', async () => {
    writeFileSync(file, JSON.stringify([{ workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing', detectedAt: 1, lastError: 'x', thrashingEvents: 3 }]));
    const res = await fetch(`${baseUrl}/api/workflows/stuck-steps/wf-a/s1`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    const after = await (await fetch(`${baseUrl}/api/workflows/stuck-steps`)).json();
    expect(after).toEqual([]);
  });
});
```

- [ ] **Step 3:** `npm test -- tests/lexi/workflows/diagnostics-route.test.ts tests/lexi/workflows/stuck-steps-route.test.ts` → fail.
- [ ] **Step 4:** Create `src/lexi-dashboard/workflows/diagnostics.ts`:

```ts
import { promises as fs } from 'node:fs';

export interface StepTrace {
  stepId: string; startedAt: number; endedAt: number;
  status: 'ok' | 'error'; error?: string; context?: string;
}
export interface AutocompactEvent { stepId: string; ts: number; message: string; }
export interface LastFailure { stepId: string; ts: number; error: string; context: string; }
export interface RunDiagnostics {
  runId: string; workflowId: string;
  steps: StepTrace[]; autocompactEvents: AutocompactEvent[];
  lastFailure?: LastFailure;
}

export interface DiagnosticsStore {
  get(runId: string): Promise<RunDiagnostics | undefined>;
}

export function createDiagnosticsStore(file: string): DiagnosticsStore {
  return {
    async get(runId) {
      try {
        const raw = await fs.readFile(file, 'utf8');
        const all = JSON.parse(raw) as Record<string, RunDiagnostics>;
        return all[runId];
      } catch {
        return undefined;
      }
    },
  };
}
```

- [ ] **Step 5:** Create `src/lexi-dashboard/routes/workflows.ts`:

```ts
import { Router, type Router as ExpressRouter } from 'express';
import { createDiagnosticsStore } from '../workflows/diagnostics.js';
import { createStuckStepsStore, defaultStuckStepsPath } from '../workflows/stuck-steps-store.js';

export interface WorkflowsRouterOptions {
  stuckStepsFile?: string;
  runsFile?: string;
}

export function createWorkflowsRouter(opts: WorkflowsRouterOptions = {}): ExpressRouter {
  const router = Router();
  const stuckFile = opts.stuckStepsFile ?? process.env.LEXI_STUCK_STEPS_FILE ?? defaultStuckStepsPath();
  const runsFile = opts.runsFile ?? process.env.LEXI_RUNS_FILE ?? '';
  const stuck = createStuckStepsStore(stuckFile);
  const diags = runsFile ? createDiagnosticsStore(runsFile) : undefined;

  router.get('/stuck-steps', async (_req, res) => {
    res.json(await stuck.list());
  });

  router.delete('/stuck-steps/:workflowId/:stepId', async (req, res) => {
    await stuck.clear(req.params.workflowId, req.params.stepId);
    res.status(204).end();
  });

  router.get('/runs/:runId/diagnostics', async (req, res) => {
    if (!diags) { res.status(404).json({ error: 'diagnostics store not configured' }); return; }
    const found = await diags.get(req.params.runId);
    if (!found) { res.status(404).json({ error: 'run not found' }); return; }
    res.json(found);
  });

  return router;
}
```

- [ ] **Step 6:** Edit `src/lexi-dashboard/server.ts`. After `app.get('/health', ...)` block, add:

```ts
import { createWorkflowsRouter } from './routes/workflows.js';
// ...
app.use('/api/workflows', createWorkflowsRouter());
```

(Place the `import` with the other top-level imports; place the `app.use` after `/health` and before `app.get('/')`.)

- [ ] **Step 7:** `npm test -- tests/lexi/workflows/diagnostics-route.test.ts tests/lexi/workflows/stuck-steps-route.test.ts` → 4 PASS.
- [ ] **Step 8:** Commit:

```bash
git add src/lexi-dashboard/workflows/diagnostics.ts src/lexi-dashboard/routes/workflows.ts src/lexi-dashboard/server.ts tests/lexi/workflows/diagnostics-route.test.ts tests/lexi/workflows/stuck-steps-route.test.ts
git commit -m "feat(lexi): workflows API — diagnostics + stuck-steps routes"
```

---

## Task 5 — `lexi-workflows-view` list component + stuck banner

**Files:** Create `src/lexi-dashboard/ui/components/workflows/lexi-workflows-view.ts`, `tests/lexi/workflows/workflows-view.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/workflows/workflows-view.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/workflows/lexi-workflows-view.js');
});

function mount() {
  document.body.replaceChildren();
  const el = document.createElement('lexi-workflows-view');
  document.body.appendChild(el);
  return el;
}

describe('lexi-workflows-view', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/builder/workflows')) {
        return new Response(JSON.stringify({ workflows: [
          { id: 'wf-a', name: 'Onboarding', status: 'idle' },
          { id: 'wf-b', name: 'Daily Brief', status: 'running' },
        ]}), { status: 200 });
      }
      if (url.endsWith('/api/workflows/stuck-steps')) {
        return new Response(JSON.stringify([
          { workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing', detectedAt: 1, lastError: 'context refill', thrashingEvents: 3 },
        ]), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;
  });

  it('lists workflows from /api/builder/workflows', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 30));
    const items = document.querySelectorAll('[data-workflow-id]');
    const ids = Array.from(items).map((i) => i.getAttribute('data-workflow-id'));
    expect(ids).toContain('wf-a');
    expect(ids).toContain('wf-b');
  });

  it('renders a status dot per workflow', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 30));
    const dots = document.querySelectorAll('[data-status-dot]');
    const statuses = Array.from(dots).map((d) => d.getAttribute('data-status-dot'));
    expect(statuses).toContain('idle');
    expect(statuses).toContain('running');
  });

  it('shows the stuck-steps banner when any step is stuck', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 30));
    const banner = document.querySelector('[data-stuck-banner]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toMatch(/needs human review/i);
  });

  it('marks a workflow as needs-review if it owns a stuck step', async () => {
    mount();
    await new Promise((r) => setTimeout(r, 30));
    const wfA = document.querySelector('[data-workflow-id="wf-a"] [data-status-dot]');
    expect(wfA?.getAttribute('data-status-dot')).toBe('needs-review');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/workflows/workflows-view.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/workflows/lexi-workflows-view.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

interface WorkflowSummary { id: string; name: string; status: string; }
interface StuckStep { workflowId: string; stepId: string; reason: string; lastError: string; thrashingEvents: number; }

@customElement('lexi-workflows-view')
export class LexiWorkflowsView extends LitElement {
  @state() private workflows: WorkflowSummary[] = [];
  @state() private stuck: StuckStep[] = [];
  @state() private loadError = '';

  static styles = css`
    :host { display: block; }
    .banner { background: var(--accent-glow); border: 1px solid var(--warning); color: var(--text-primary); padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
    .banner b { color: var(--warning); }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    li { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border-subtle); border-radius: 8px; cursor: pointer; }
    li:hover { background: var(--bg-elevated); }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot[data-status-dot="idle"] { background: var(--text-tertiary); }
    .dot[data-status-dot="running"] { background: var(--success); box-shadow: 0 0 0 4px rgba(16,185,129,0.18); }
    .dot[data-status-dot="failed"] { background: var(--danger); }
    .dot[data-status-dot="needs-review"] { background: var(--warning); box-shadow: 0 0 0 4px rgba(245,158,11,0.18); }
    .err { color: var(--danger); font-size: 12px; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  private async refresh() {
    try {
      const [wfRes, stuckRes] = await Promise.all([
        fetch('/api/builder/workflows'),
        fetch('/api/workflows/stuck-steps'),
      ]);
      const wfBody = await wfRes.json();
      this.workflows = (wfBody.workflows ?? wfBody ?? []) as WorkflowSummary[];
      this.stuck = (await stuckRes.json()) as StuckStep[];
    } catch (e) {
      this.loadError = (e as Error).message;
    }
  }

  private statusFor(wf: WorkflowSummary): string {
    if (this.stuck.some((s) => s.workflowId === wf.id)) return 'needs-review';
    return wf.status ?? 'idle';
  }

  private open(id: string) {
    this.dispatchEvent(new CustomEvent('open-workflow', { detail: { id }, bubbles: true, composed: true }));
    window.location.hash = `#/workflows/${id}`;
  }

  render() {
    return html`
      ${this.stuck.length > 0 ? html`
        <div class="banner" data-stuck-banner>
          <b>${this.stuck.length} step(s) need human review</b> — autocompact thrashing detected.
          Open the affected workflow's Recovery tab to investigate.
        </div>` : ''}
      ${this.loadError ? html`<div class="err">Failed to load workflows: ${this.loadError}</div>` : ''}
      <ul>
        ${this.workflows.map((wf) => {
          const status = this.statusFor(wf);
          return html`
            <li data-workflow-id="${wf.id}" @click=${() => this.open(wf.id)}>
              <span class="dot" data-status-dot="${status}"></span>
              <span style="flex:1">${wf.name}</span>
              <span style="color:var(--text-tertiary);font-size:11px;font-family:'JetBrains Mono',monospace">${wf.id}</span>
            </li>`;
        })}
      </ul>
    `;
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/workflows/workflows-view.test.ts` → 4 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/components/workflows/lexi-workflows-view.ts tests/lexi/workflows/workflows-view.test.ts
git commit -m "feat(lexi): workflows list view with status dots and stuck banner"
```

---

## Task 6 — `lexi-workflow-builder` Drawflow canvas wrapper

**Files:** Create `src/lexi-dashboard/ui/components/workflows/lexi-workflow-builder.ts`, `tests/lexi/workflows/workflow-builder.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/workflows/workflow-builder.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

beforeAll(async () => {
  // Stub Drawflow before component loads — jsdom has no canvas; we only assert wiring.
  (globalThis as unknown as { Drawflow: unknown }).Drawflow = class {
    container: HTMLElement;
    constructor(c: HTMLElement) { this.container = c; }
    start() { /* noop */ }
    import(_data: unknown) { /* noop */ }
    export() { return { drawflow: { Home: { data: {} } } }; }
    on(_e: string, _cb: (...args: unknown[]) => void) { /* noop */ }
  };
  await import('../../../src/lexi-dashboard/ui/components/workflows/lexi-workflow-builder.js');
});

function mount(workflowId: string) {
  document.body.replaceChildren();
  const el = document.createElement('lexi-workflow-builder');
  el.setAttribute('workflow-id', workflowId);
  document.body.appendChild(el);
  return el;
}

describe('lexi-workflow-builder', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/builder/workflows/wf-a' && (!init || init.method === 'GET' || !init.method)) {
        return new Response(JSON.stringify({ id: 'wf-a', name: 'Onboarding', drawflow: { drawflow: { Home: { data: {} } } } }), { status: 200 });
      }
      if (url.endsWith('/save-from-drawflow')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.endsWith('/validate')) {
        return new Response(JSON.stringify({ ok: true, errors: [] }), { status: 200 });
      }
      if (url.endsWith('/test')) {
        return new Response(JSON.stringify({ runId: 'run-1' }), { status: 200 });
      }
      if (url.endsWith('/dry-run')) {
        return new Response(JSON.stringify({ runId: 'dry-1' }), { status: 200 });
      }
      return new Response('nope', { status: 404 });
    }) as unknown as typeof fetch;
  });

  it('mounts a Drawflow canvas div', async () => {
    mount('wf-a');
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('[data-drawflow-canvas]')).not.toBeNull();
  });

  it('loads workflow JSON on mount', async () => {
    mount('wf-a');
    await new Promise((r) => setTimeout(r, 30));
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls).toContain('/api/builder/workflows/wf-a');
  });

  it('renders Save / Validate / Test / Dry-run buttons', async () => {
    mount('wf-a');
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('[data-action="save"]')).not.toBeNull();
    expect(document.querySelector('[data-action="validate"]')).not.toBeNull();
    expect(document.querySelector('[data-action="test"]')).not.toBeNull();
    expect(document.querySelector('[data-action="dry-run"]')).not.toBeNull();
  });

  it('Save button POSTs to save-from-drawflow', async () => {
    mount('wf-a');
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('[data-action="save"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((u: string) => u.endsWith('/save-from-drawflow'))).toBe(true);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/workflows/workflow-builder.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/workflows/lexi-workflow-builder.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface DrawflowGlobal {
  new (container: HTMLElement): {
    container: HTMLElement;
    start(): void;
    import(data: unknown): void;
    export(): unknown;
    on(event: string, cb: (...args: unknown[]) => void): void;
  };
}

@customElement('lexi-workflow-builder')
export class LexiWorkflowBuilder extends LitElement {
  @property({ type: String, attribute: 'workflow-id' }) workflowId = '';
  @state() private status = '';
  @state() private runningStepId: string | null = null;

  // Use light DOM so the vendored Drawflow CSS can style descendants.
  protected createRenderRoot() { return this; }

  private editor: ReturnType<DrawflowGlobal> | null = null;

  async connectedCallback() {
    super.connectedCallback();
    await this.updateComplete;
    this.initEditor();
    await this.load();
  }

  private initEditor() {
    const Drawflow = (window as unknown as { Drawflow?: DrawflowGlobal }).Drawflow;
    if (!Drawflow) { this.status = 'Drawflow not loaded (check vendor script)'; return; }
    const canvas = this.querySelector('[data-drawflow-canvas]') as HTMLElement | null;
    if (!canvas) return;
    this.editor = new Drawflow(canvas);
    this.editor.start();
  }

  private async load() {
    if (!this.workflowId) return;
    try {
      const res = await fetch(`/api/builder/workflows/${encodeURIComponent(this.workflowId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body?.drawflow && this.editor) this.editor.import(body.drawflow);
      this.status = 'Loaded';
    } catch (e) {
      this.status = `Load failed: ${(e as Error).message}`;
    }
  }

  private async save() {
    if (!this.editor) return;
    this.status = 'Saving...';
    try {
      const data = this.editor.export();
      const res = await fetch(`/api/builder/workflows/${encodeURIComponent(this.workflowId)}/save-from-drawflow`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ drawflow: data, force: true }),
      });
      this.status = res.ok ? 'Saved' : `Save failed: HTTP ${res.status}`;
    } catch (e) { this.status = `Save error: ${(e as Error).message}`; }
  }

  private async run(action: 'validate' | 'test' | 'dry-run') {
    this.status = `${action}...`;
    try {
      const url = `/api/builder/workflows/${encodeURIComponent(this.workflowId)}/${action}`;
      const init: RequestInit = action === 'test'
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'mock' }) }
        : { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };
      const res = await fetch(url, init);
      const body = await res.json().catch(() => ({}));
      this.status = res.ok ? `${action} ok${body.runId ? ` · run ${body.runId}` : ''}` : `${action} failed: HTTP ${res.status}`;
    } catch (e) { this.status = `${action} error: ${(e as Error).message}`; }
  }

  /** Public hook called by lexi-workflow-detail when an SSE workflow_state event arrives. */
  public highlightStep(stepId: string | null) {
    this.runningStepId = stepId;
    // Light visual: outline all nodes whose data-node-id matches.
    this.querySelectorAll('[data-node-id]').forEach((el) => {
      (el as HTMLElement).style.outline = el.getAttribute('data-node-id') === stepId
        ? '2px solid var(--success)' : '';
    });
  }

  render() {
    return html`
      <div style="display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-subtle);margin-bottom:8px">
        <button data-action="save" @click=${() => this.save()}>Save</button>
        <button data-action="validate" @click=${() => this.run('validate')}>Validate</button>
        <button data-action="test" @click=${() => this.run('test')}>Test (mock)</button>
        <button data-action="dry-run" @click=${() => this.run('dry-run')}>Dry run</button>
        <span style="flex:1"></span>
        <span style="font-size:12px;color:var(--text-secondary)">${this.status}</span>
        ${this.runningStepId ? html`<span style="font-size:11px;color:var(--success);font-family:'JetBrains Mono',monospace">running: ${this.runningStepId}</span>` : ''}
      </div>
      <div data-drawflow-canvas style="height:560px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-surface);overflow:hidden" id="drawflow-${this.workflowId}"></div>
    `;
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/workflows/workflow-builder.test.ts` → 4 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/components/workflows/lexi-workflow-builder.ts tests/lexi/workflows/workflow-builder.test.ts
git commit -m "feat(lexi): Drawflow canvas wrapper using upstream /api/builder endpoints"
```

---

## Task 7 — `lexi-step-recovery-panel` for autocompact-thrashing

**Files:** Create `src/lexi-dashboard/ui/components/workflows/lexi-step-recovery-panel.ts`, `tests/lexi/workflows/step-recovery-panel.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/workflows/step-recovery-panel.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/workflows/lexi-step-recovery-panel.js');
});

function mount(workflowId: string, stepId: string, runId: string) {
  document.body.replaceChildren();
  const el = document.createElement('lexi-step-recovery-panel');
  el.setAttribute('workflow-id', workflowId);
  el.setAttribute('step-id', stepId);
  el.setAttribute('run-id', runId);
  document.body.appendChild(el);
  return el;
}

describe('lexi-step-recovery-panel', () => {
  beforeEach(() => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/workflows/runs/run-1/diagnostics')) {
        return new Response(JSON.stringify({
          runId: 'run-1', workflowId: 'wf-a',
          steps: [
            { stepId: 's1', startedAt: 1, endedAt: 2, status: 'error', error: 'context refilled', context: 'ctx A' },
            { stepId: 's1', startedAt: 3, endedAt: 4, status: 'error', error: 'context refilled', context: 'ctx B' },
            { stepId: 's1', startedAt: 5, endedAt: 6, status: 'error', error: 'context refilled', context: 'ctx C' },
          ],
          autocompactEvents: [],
          lastFailure: { stepId: 's1', ts: 7, error: 'context refilled within 3 turns', context: 'PROMPT: do thing' },
        }), { status: 200 });
      }
      if (url.endsWith('/api/workflows/stuck-steps/wf-a/s1') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      return new Response('nope', { status: 404 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('shows the failing prompt from lastFailure.context', async () => {
    mount('wf-a', 's1', 'run-1');
    await new Promise((r) => setTimeout(r, 30));
    expect(document.body.textContent).toContain('PROMPT: do thing');
  });

  it('shows the last 3 contexts', async () => {
    mount('wf-a', 's1', 'run-1');
    await new Promise((r) => setTimeout(r, 30));
    const ctxs = document.querySelectorAll('[data-context-snapshot]');
    expect(ctxs.length).toBe(3);
    expect(ctxs[0].textContent).toContain('ctx A');
    expect(ctxs[2].textContent).toContain('ctx C');
  });

  it('renders skip and retry buttons', async () => {
    mount('wf-a', 's1', 'run-1');
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('[data-action="skip"]')).not.toBeNull();
    expect(document.querySelector('[data-action="retry"]')).not.toBeNull();
  });

  it('skip clears the stuck marker', async () => {
    mount('wf-a', 's1', 'run-1');
    await new Promise((r) => setTimeout(r, 30));
    (document.querySelector('[data-action="skip"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[1]?.method === 'DELETE');
    expect(calls.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/workflows/step-recovery-panel.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/workflows/lexi-step-recovery-panel.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface Diag {
  runId: string; workflowId: string;
  steps: { stepId: string; status: string; error?: string; context?: string }[];
  lastFailure?: { stepId: string; ts: number; error: string; context: string };
}

@customElement('lexi-step-recovery-panel')
export class LexiStepRecoveryPanel extends LitElement {
  @property({ type: String, attribute: 'workflow-id' }) workflowId = '';
  @property({ type: String, attribute: 'step-id' }) stepId = '';
  @property({ type: String, attribute: 'run-id' }) runId = '';
  @state() private diag?: Diag;
  @state() private status = '';
  @state() private manualContext = '';

  static styles = css`
    :host { display: block; }
    .head { font-weight: 600; color: var(--warning); margin-bottom: 8px; }
    .row { margin: 8px 0; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-tertiary); margin-bottom: 4px; }
    pre { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px; font: 12px/1.4 'JetBrains Mono', monospace; max-height: 180px; overflow: auto; white-space: pre-wrap; color: var(--text-primary); }
    .ctxs { display: flex; flex-direction: column; gap: 6px; }
    button { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--text-primary); cursor: pointer; font: inherit; font-size: 13px; }
    button[data-action="skip"] { border-color: var(--warning); color: var(--warning); }
    button[data-action="retry"] { border-color: var(--accent); color: var(--accent); }
    textarea { width: 100%; min-height: 80px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; color: var(--text-primary); font: 12px/1.4 'JetBrains Mono', monospace; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      const res = await fetch(`/api/workflows/runs/${encodeURIComponent(this.runId)}/diagnostics`);
      if (!res.ok) { this.status = `No diagnostics: HTTP ${res.status}`; return; }
      this.diag = (await res.json()) as Diag;
    } catch (e) { this.status = (e as Error).message; }
  }

  private async skip() {
    this.status = 'Skipping...';
    const res = await fetch(`/api/workflows/stuck-steps/${encodeURIComponent(this.workflowId)}/${encodeURIComponent(this.stepId)}`, { method: 'DELETE' });
    this.status = res.ok ? 'Skipped — step cleared from review queue' : `Skip failed: HTTP ${res.status}`;
    this.dispatchEvent(new CustomEvent('step-recovered', { detail: { workflowId: this.workflowId, stepId: this.stepId, mode: 'skip' }, bubbles: true, composed: true }));
  }

  private async retry() {
    this.status = 'Retry queued (manual context attached)';
    this.dispatchEvent(new CustomEvent('step-recovered', { detail: { workflowId: this.workflowId, stepId: this.stepId, mode: 'retry', manualContext: this.manualContext }, bubbles: true, composed: true }));
    await fetch(`/api/workflows/stuck-steps/${encodeURIComponent(this.workflowId)}/${encodeURIComponent(this.stepId)}`, { method: 'DELETE' });
  }

  private contextsForStep(): string[] {
    if (!this.diag) return [];
    return this.diag.steps.filter((s) => s.stepId === this.stepId && s.context).map((s) => s.context!).slice(-3);
  }

  render() {
    const failing = this.diag?.lastFailure;
    const ctxs = this.contextsForStep();
    return html`
      <div class="head">Step ${this.stepId} needs human review</div>
      ${failing ? html`
        <div class="row">
          <div class="label">Failing prompt (from last failure)</div>
          <pre>${failing.context}</pre>
          <div style="font-size:12px;color:var(--danger);margin-top:4px">${failing.error}</div>
        </div>` : ''}
      <div class="row">
        <div class="label">Last ${ctxs.length} context snapshot(s) dropped by autocompact</div>
        <div class="ctxs">
          ${ctxs.map((c) => html`<pre data-context-snapshot>${c}</pre>`)}
        </div>
      </div>
      <div class="row">
        <div class="label">Manual context for retry (optional)</div>
        <textarea .value=${this.manualContext} @input=${(e: Event) => (this.manualContext = (e.target as HTMLTextAreaElement).value)} placeholder="Paste a trimmed context to use on the next attempt..."></textarea>
      </div>
      <div class="row" style="display:flex;gap:8px">
        <button data-action="skip" @click=${() => this.skip()}>Skip step</button>
        <button data-action="retry" @click=${() => this.retry()}>Retry with manual context</button>
        <span style="flex:1"></span>
        <span style="font-size:12px;color:var(--text-secondary)">${this.status}</span>
      </div>
    `;
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/workflows/step-recovery-panel.test.ts` → 4 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/components/workflows/lexi-step-recovery-panel.ts tests/lexi/workflows/step-recovery-panel.test.ts
git commit -m "feat(lexi): step recovery panel surfaces failing prompt + dropped contexts"
```

---

## Task 8 — `lexi-workflow-runs` live runs panel (SSE-driven)

**Files:** Create `src/lexi-dashboard/ui/components/workflows/lexi-workflow-runs.ts`. (Test deferred — Plan 3 owns SSE infra; we assert wiring only.)

- [ ] **Step 1:** Create `src/lexi-dashboard/ui/components/workflows/lexi-workflow-runs.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface RunRow { runId: string; ts: number; stepId?: string; status: string; message?: string; }

@customElement('lexi-workflow-runs')
export class LexiWorkflowRuns extends LitElement {
  @property({ type: String, attribute: 'workflow-id' }) workflowId = '';
  @state() private rows: RunRow[] = [];
  @state() private connected = false;
  private es: EventSource | null = null;

  static styles = css`
    :host { display: grid; grid-template-columns: 1fr 320px; gap: 12px; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    li { padding: 6px 10px; border: 1px solid var(--border-subtle); border-radius: 6px; font-size: 12px; display: flex; gap: 10px; align-items: center; }
    li[data-status="error"] { border-color: var(--danger); }
    li[data-status="running"] { border-color: var(--success); }
    .ts { color: var(--text-tertiary); font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .side { border-left: 1px solid var(--border-subtle); padding-left: 12px; }
    .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--bg-elevated); color: var(--text-secondary); }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    if (typeof EventSource === 'undefined') return;
    try {
      this.es = new EventSource('/api/events/stream');
      this.es.onopen = () => { this.connected = true; };
      this.es.onerror = () => { this.connected = false; };
      this.es.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { type: string; ts: number; payload: { workflowId?: string; runId?: string; stepId?: string; status?: string; message?: string } };
          if (data.type !== 'workflow_state') return;
          if (data.payload.workflowId && this.workflowId && data.payload.workflowId !== this.workflowId) return;
          this.rows = [
            { runId: data.payload.runId ?? '?', ts: data.ts, stepId: data.payload.stepId, status: data.payload.status ?? 'unknown', message: data.payload.message },
            ...this.rows,
          ].slice(0, 100);
          this.dispatchEvent(new CustomEvent('workflow-step', { detail: data.payload, bubbles: true, composed: true }));
        } catch { /* ignore malformed frame */ }
      });
    } catch { this.connected = false; }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.es?.close();
    this.es = null;
  }

  render() {
    return html`
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span class="badge">${this.connected ? 'live' : 'offline'}</span>
          <span style="font-size:12px;color:var(--text-secondary)">${this.rows.length} event(s)</span>
        </div>
        <ul>
          ${this.rows.map((r) => html`
            <li data-status="${r.status}">
              <span class="ts">${new Date(r.ts).toLocaleTimeString()}</span>
              <span>${r.stepId ?? ''}</span>
              <span style="flex:1">${r.message ?? r.status}</span>
              <span class="badge">${r.runId}</span>
            </li>`)}
        </ul>
      </div>
      <aside class="side">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-tertiary);margin-bottom:6px">Latest payload</div>
        <pre style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:6px;padding:8px;font:11px/1.4 'JetBrains Mono',monospace;max-height:400px;overflow:auto">${JSON.stringify(this.rows[0] ?? {}, null, 2)}</pre>
      </aside>
    `;
  }
}
```

- [ ] **Step 2:** Quick smoke: `npm run build:lexi` → no esbuild errors.
- [ ] **Step 3:** Commit:

```bash
git add src/lexi-dashboard/ui/components/workflows/lexi-workflow-runs.ts
git commit -m "feat(lexi): live workflow runs panel subscribed to SSE workflow_state"
```

---

## Task 9 — `lexi-workflow-detail` master view with tabs

**Files:** Create `src/lexi-dashboard/ui/components/workflows/lexi-workflow-detail.ts`. Modify `src/lexi-dashboard/ui/main.ts` to register the workflows view + handle `#/workflows/:id` routing minimally.

- [ ] **Step 1:** Create `src/lexi-dashboard/ui/components/workflows/lexi-workflow-detail.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './lexi-workflow-builder.js';
import './lexi-workflow-runs.js';
import './lexi-step-recovery-panel.js';

interface StuckStep { workflowId: string; stepId: string; reason: string; lastError: string; thrashingEvents: number; }

@customElement('lexi-workflow-detail')
export class LexiWorkflowDetail extends LitElement {
  @property({ type: String, attribute: 'workflow-id' }) workflowId = '';
  @state() private tab: 'builder' | 'runs' | 'recovery' = 'builder';
  @state() private stuck: StuckStep[] = [];
  @state() private activeRunId = '';

  static styles = css`
    :host { display: block; }
    .tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 12px; }
    .tab { padding: 8px 14px; cursor: pointer; color: var(--text-secondary); border-bottom: 2px solid transparent; font-size: 13px; }
    .tab.active { color: var(--text-primary); border-color: var(--accent); }
    .badge { background: var(--warning); color: var(--bg-canvas); border-radius: 999px; font-size: 10px; padding: 1px 6px; margin-left: 6px; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.refreshStuck();
    this.addEventListener('workflow-step', (ev: Event) => {
      const detail = (ev as CustomEvent<{ runId?: string; stepId?: string; status?: string }>).detail;
      if (detail.runId) this.activeRunId = detail.runId;
      const builder = this.querySelector('lexi-workflow-builder') as (HTMLElement & { highlightStep?: (id: string | null) => void }) | null;
      if (builder?.highlightStep) builder.highlightStep(detail.status === 'running' ? (detail.stepId ?? null) : null);
    });
    this.addEventListener('step-recovered', () => { void this.refreshStuck(); });
  }

  private async refreshStuck() {
    try {
      const res = await fetch('/api/workflows/stuck-steps');
      const all = (await res.json()) as StuckStep[];
      this.stuck = all.filter((s) => s.workflowId === this.workflowId);
      if (this.stuck.length > 0 && this.tab === 'builder') this.tab = 'recovery';
    } catch { /* ignore */ }
  }

  private setTab(t: 'builder' | 'runs' | 'recovery') { this.tab = t; }

  render() {
    return html`
      <div class="tabs">
        <div class="tab ${this.tab === 'builder' ? 'active' : ''}" @click=${() => this.setTab('builder')}>Builder</div>
        <div class="tab ${this.tab === 'runs' ? 'active' : ''}" @click=${() => this.setTab('runs')}>Runs</div>
        <div class="tab ${this.tab === 'recovery' ? 'active' : ''}" @click=${() => this.setTab('recovery')}>
          Recovery${this.stuck.length > 0 ? html`<span class="badge">${this.stuck.length}</span>` : ''}
        </div>
      </div>
      <div ?hidden=${this.tab !== 'builder'}>
        <lexi-workflow-builder workflow-id="${this.workflowId}"></lexi-workflow-builder>
      </div>
      <div ?hidden=${this.tab !== 'runs'}>
        <lexi-workflow-runs workflow-id="${this.workflowId}"></lexi-workflow-runs>
      </div>
      <div ?hidden=${this.tab !== 'recovery'}>
        ${this.stuck.length === 0
          ? html`<div style="color:var(--text-secondary);font-size:13px">No stuck steps. The recovery surface activates when autocompact thrashing is detected.</div>`
          : this.stuck.map((s) => html`
              <div style="margin-bottom:16px;padding:12px;border:1px solid var(--border-subtle);border-radius:8px">
                <lexi-step-recovery-panel
                  workflow-id="${s.workflowId}"
                  step-id="${s.stepId}"
                  run-id="${this.activeRunId}"></lexi-step-recovery-panel>
              </div>`)}
      </div>
    `;
  }
}
```

- [ ] **Step 2:** Edit `src/lexi-dashboard/ui/main.ts`. Append:

```ts
import './components/workflows/lexi-workflows-view.js';
import './components/workflows/lexi-workflow-detail.js';
```

- [ ] **Step 3:** `npm run build:lexi` → no errors.
- [ ] **Step 4:** Commit:

```bash
git add src/lexi-dashboard/ui/components/workflows/lexi-workflow-detail.ts src/lexi-dashboard/ui/main.ts
git commit -m "feat(lexi): tabbed workflow detail view (Builder | Runs | Recovery)"
```

---

## Task 10 — End-to-end smoke + upstream-clean check

- [ ] **Step 1:** `npm run build` → succeeds.
- [ ] **Step 2:** `npm test -- tests/lexi/workflows/` → all green.
- [ ] **Step 3:** `LEXI_PORT=3032 node dist/cli/index.js lexi dashboard` (background). Verify:
  - `curl -s localhost:3032/api/workflows/stuck-steps` → `[]` (or current contents).
  - `curl -s localhost:3032/api/builder/workflows` → upstream JSON.
  - `curl -s localhost:3032/assets/vendor/drawflow.min.js | head -c 80` → starts with Drawflow's IIFE preamble (no 404).
- [ ] **Step 4:** Manual: open `http://localhost:3032/#/workflows`, confirm list renders. Click a workflow → detail loads with three tabs. Drawflow canvas mounts (no console errors).
- [ ] **Step 5:** Stuck-step injection test: write a fake entry to `~/.clementine/lexi-stuck-steps.json` and reload — banner appears, Recovery tab gets the badge.
- [ ] **Step 6:** `git fetch upstream && git diff upstream/main..HEAD --name-only | sort` → only files under `docs/lexi/`, `src/lexi-dashboard/`, `tests/lexi/workflows/`, plus the documented edits to `package.json`, `package-lock.json`, `scripts/esbuild-lexi.mjs`, `src/lexi-dashboard/server.ts`, `src/lexi-dashboard/ui/index.html`, `src/lexi-dashboard/ui/main.ts`. **Zero edits to `src/cli/dashboard.ts` or `src/dashboard/builder/**`.**
- [ ] **Step 7:** `git merge-tree --write-tree upstream/main HEAD | head -5` → tree hash, no `<<<<<<<` markers.

---

## Definition of done for Plan 6

- [ ] All 10 implementation tasks committed.
- [ ] `npm test -- tests/lexi/workflows/` all green.
- [ ] Drawflow vendored (`dist/lexi-dashboard/ui/vendor/drawflow.min.{js,css}` exist; `index.html` references local paths only).
- [ ] `lexi-workflows-view` lists workflows from upstream `/api/builder/workflows` with status dots; `needs-review` overrides status when stuck.
- [ ] `lexi-workflow-detail` exposes Builder / Runs / Recovery tabs; auto-jumps to Recovery when a stuck step exists.
- [ ] Drawflow canvas loads + saves via existing upstream `/api/builder/workflows/:id/save-from-drawflow`. Validate / Test / Dry-run buttons hit existing upstream endpoints.
- [ ] `lexi-workflow-runs` subscribes to `/api/events/stream` (Plan 3) and dispatches `workflow-step` events that highlight the running step on the canvas.
- [ ] `GET /api/workflows/runs/:runId/diagnostics` returns step traces, autocompact events, and last failure with context.
- [ ] `GET /api/workflows/stuck-steps` + `DELETE /api/workflows/stuck-steps/:wfId/:stepId` work.
- [ ] Thrashing detector flips to "needs human review" after >=3 events in 30 min on the same step; persists to `~/.clementine/lexi-stuck-steps.json`; survives Lexi restart.
- [ ] `lexi-step-recovery-panel` shows failing prompt + last 3 contexts + Skip / Retry buttons; both clear the stuck marker.
- [ ] No upstream files modified (no `src/cli/dashboard.ts`, no `src/dashboard/builder/*` edits).
- [ ] `git merge-tree upstream/main HEAD` → no conflict markers.

## Hand-off to Plan 7

Plan 7 (Vault / Memory / Cron / Settings) inherits the same patterns: light-DOM Lit components, light-touch upstream API consumption via Lexi-side proxy, persistent Lexi-only state files in `~/.clementine/lexi-*.json`. The thrashing-detector pattern from Task 3 is the template for Cron's `insight-check` "stuck job" recovery in §7.
