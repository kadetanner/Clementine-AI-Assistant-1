# Lexi Dashboard — Plan 4: Agents Section

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Lexi **Agents** section — a unified surface that consolidates everything an operator needs to inspect, configure, and operate the agents living under `~/.clementine/vault/00-System/agents/<slug>/agent.md`. Replaces the upstream split of `Team > Agents`, `Build > Skills`, and parts of `Settings > Channels`.

The section ships as a **master/detail** view: list on the left (with live activity dots fed by the SSE bus from Plan 3), tabbed detail on the right (Prompt / Tools / Memory / Logs / Activity). Restart is gated behind a confirm prompt because it spawns a `safe-restart` helper that may interrupt in-flight tool calls.

**Architecture:** Pure additions under `src/lexi-dashboard/`. Five new API routes mounted by `server.ts`. Three new Lit components. One new helper module `agents/vault-store.ts` that owns all filesystem access (atomic writes, directory scanning). Zero edits to upstream files.

**Spec reference:** `docs/lexi/specs/2026-05-02-lexi-dashboard-design.md` §4 IA "Agents" row.
**Depends on:** Plan 1 (foundation, Lit shell, theme, CLI). Plan 3 (SSE event bus — used for activity dots; if Plan 3 has not landed, the dots stay grey and the rest of the section works).

---

## Conventions inherited from Plan 1

- Files: kebab-case. Components: `lexi-` prefixed Lit elements.
- API routes: `/api/<resource>` (no `/lexi/` prefix).
- Tests in `tests/lexi/**/*.test.ts`. Use `execFileSync` (never the shell variant). Use `replaceChildren()` + `appendChild()` (never `innerHTML`) when constructing DOM in tests.
- Commits: conventional (`feat(lexi):`, `test(lexi):`, etc.).
- Imports of upstream code go through relative `../<area>/<file>.js` paths. Only `package.json` and `src/cli/index.ts` may be modified upstream — both already done in Plan 1.

## File structure (created in this plan)

```
src/lexi-dashboard/
  agents/
    vault-store.ts                  ← scan, read, atomic write of agent.md files
    activity-log.ts                 ← in-memory ring buffer of recent agent events
    restart.ts                      ← thin wrapper around upstream safe-restart
  routes/
    agents.ts                       ← all 5 /api/agents* routes
  ui/components/
    lexi-agents-view.ts             ← master/detail container (mounted on #/agents)
    lexi-prompt-editor.ts           ← textarea + save/cancel + dirty indicator
    lexi-tool-toggle-list.ts        ← searchable tool list with switches
tests/lexi/agents/
  vault-store.test.ts
  routes.test.ts
  view.test.ts
  prompt-editor.test.ts
  tool-toggle-list.test.ts
```

Modified files in this plan: `src/lexi-dashboard/server.ts` (mount the agents router), `src/lexi-dashboard/ui/components/lexi-app.ts` (route `#/agents` to `<lexi-agents-view>`). Both are Lexi-only files created in Plan 1.

---

## Task 1 — Vault store: scan + read

**Files:** Create `src/lexi-dashboard/agents/vault-store.ts`, `tests/lexi/agents/vault-store.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/agents/vault-store.test.ts` with a fixture vault under `os.tmpdir()`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { listAgents, readAgent } from '../../../src/lexi-dashboard/agents/vault-store.js';

let vaultRoot: string;

beforeEach(() => {
  vaultRoot = mkdtempSync(path.join(os.tmpdir(), 'lexi-vault-'));
  const agentsDir = path.join(vaultRoot, '00-System', 'agents');
  mkdirSync(path.join(agentsDir, 'lexi'), { recursive: true });
  mkdirSync(path.join(agentsDir, 'jonah'), { recursive: true });
  writeFileSync(
    path.join(agentsDir, 'lexi', 'agent.md'),
    `---\nname: lexi\nmodel: claude-opus-4-7\nallowedTools:\n  - vault_read\n  - memory_recall\ndisabledTools:\n  - bash\n---\n\nYou are Lexi.\n`,
  );
  writeFileSync(
    path.join(agentsDir, 'jonah', 'agent.md'),
    `---\nname: jonah\nmodel: claude-sonnet-4-5\n---\n\nYou are Jonah.\n`,
  );
});
afterEach(() => rmSync(vaultRoot, { recursive: true, force: true }));

describe('vault-store', () => {
  it('listAgents returns one entry per agent.md directory', async () => {
    const agents = await listAgents({ vaultRoot });
    expect(agents.map((a) => a.slug).sort()).toEqual(['jonah', 'lexi']);
  });
  it('listAgents extracts name, model, tools_enabled, tools_disabled', async () => {
    const agents = await listAgents({ vaultRoot });
    const lexi = agents.find((a) => a.slug === 'lexi')!;
    expect(lexi.name).toBe('lexi');
    expect(lexi.model).toBe('claude-opus-4-7');
    expect(lexi.tools_enabled).toBe(2);
    expect(lexi.tools_disabled).toBe(1);
  });
  it('readAgent returns the full prompt body and tool arrays', async () => {
    const lexi = await readAgent('lexi', { vaultRoot });
    expect(lexi.prompt).toContain('You are Lexi.');
    expect(lexi.allowedTools).toEqual(['vault_read', 'memory_recall']);
    expect(lexi.disabledTools).toEqual(['bash']);
  });
  it('readAgent throws for unknown slug', async () => {
    await expect(readAgent('ghost', { vaultRoot })).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/agents/vault-store.test.ts` → 4 failures (module missing).
- [ ] **Step 3:** Create `src/lexi-dashboard/agents/vault-store.ts`:

```ts
import { readdir, readFile, stat, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface VaultOpts { vaultRoot?: string; }

export interface AgentSummary {
  slug: string;
  name: string;
  model: string;
  tools_enabled: number;
  tools_disabled: number;
  memory_size_bytes: number;
  last_modified_at: number;
}

export interface AgentDetail extends AgentSummary {
  prompt: string;
  allowedTools: string[];
  disabledTools: string[];
  raw: string;
}

const DEFAULT_ROOT = path.join(os.homedir(), '.clementine', 'vault');

function root(opts?: VaultOpts): string { return opts?.vaultRoot ?? DEFAULT_ROOT; }
function agentsDir(opts?: VaultOpts): string { return path.join(root(opts), '00-System', 'agents'); }
function agentFile(slug: string, opts?: VaultOpts): string { return path.join(agentsDir(opts), slug, 'agent.md'); }

interface ParsedFrontmatter { data: Record<string, unknown>; body: string; }

function parseFrontmatter(raw: string): ParsedFrontmatter {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match) return { data: {}, body: raw };
  const data: Record<string, unknown> = {};
  let currentList: string | null = null;
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const listItem = /^\s*-\s+(.+)$/.exec(line);
    if (listItem && currentList) {
      const arr = (data[currentList] as string[]) ?? [];
      arr.push(listItem[1].trim());
      data[currentList] = arr;
      continue;
    }
    const kv = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (!kv) { currentList = null; continue; }
    const [, key, val] = kv;
    if (val === '') { data[key] = []; currentList = key; }
    else { data[key] = val.trim(); currentList = null; }
  }
  return { data, body: match[2] ?? '' };
}

export async function listAgents(opts?: VaultOpts): Promise<AgentSummary[]> {
  const dir = agentsDir(opts);
  let entries: string[];
  try { entries = await readdir(dir); } catch { return []; }
  const out: AgentSummary[] = [];
  for (const slug of entries) {
    try {
      const file = agentFile(slug, opts);
      const st = await stat(file);
      if (!st.isFile()) continue;
      const raw = await readFile(file, 'utf8');
      const { data } = parseFrontmatter(raw);
      out.push({
        slug,
        name: String(data.name ?? slug),
        model: String(data.model ?? 'unknown'),
        tools_enabled: Array.isArray(data.allowedTools) ? data.allowedTools.length : 0,
        tools_disabled: Array.isArray(data.disabledTools) ? data.disabledTools.length : 0,
        memory_size_bytes: st.size,
        last_modified_at: st.mtimeMs,
      });
    } catch { /* skip malformed */ }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function readAgent(slug: string, opts?: VaultOpts): Promise<AgentDetail> {
  const file = agentFile(slug, opts);
  let raw: string;
  try { raw = await readFile(file, 'utf8'); }
  catch { throw new Error(`agent not found: ${slug}`); }
  const st = await stat(file);
  const { data, body } = parseFrontmatter(raw);
  const allowedTools = Array.isArray(data.allowedTools) ? (data.allowedTools as string[]) : [];
  const disabledTools = Array.isArray(data.disabledTools) ? (data.disabledTools as string[]) : [];
  return {
    slug,
    name: String(data.name ?? slug),
    model: String(data.model ?? 'unknown'),
    tools_enabled: allowedTools.length,
    tools_disabled: disabledTools.length,
    memory_size_bytes: st.size,
    last_modified_at: st.mtimeMs,
    prompt: body.trim(),
    allowedTools,
    disabledTools,
    raw,
  };
}

export async function writeAgentPrompt(
  slug: string,
  newPrompt: string,
  opts?: VaultOpts,
): Promise<void> {
  const file = agentFile(slug, opts);
  const raw = await readFile(file, 'utf8');
  const match = /^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/.exec(raw);
  const next = match
    ? `${match[1]}\n${newPrompt.trim()}\n`
    : `${newPrompt.trim()}\n`;
  const tmp = `${file}.tmp`;
  await writeFile(tmp, next, 'utf8');
  await rename(tmp, file);
}

export async function setToolEnabled(
  slug: string,
  toolId: string,
  enabled: boolean,
  opts?: VaultOpts,
): Promise<AgentDetail> {
  const file = agentFile(slug, opts);
  const raw = await readFile(file, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const allowed = new Set(Array.isArray(data.allowedTools) ? (data.allowedTools as string[]) : []);
  const disabled = new Set(Array.isArray(data.disabledTools) ? (data.disabledTools as string[]) : []);
  if (enabled) { allowed.add(toolId); disabled.delete(toolId); }
  else { disabled.add(toolId); allowed.delete(toolId); }
  const lines: string[] = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (k === 'allowedTools' || k === 'disabledTools') continue;
    if (Array.isArray(v)) { lines.push(`${k}:`); for (const item of v) lines.push(`  - ${item}`); }
    else lines.push(`${k}: ${String(v)}`);
  }
  lines.push('allowedTools:'); for (const t of [...allowed].sort()) lines.push(`  - ${t}`);
  lines.push('disabledTools:'); for (const t of [...disabled].sort()) lines.push(`  - ${t}`);
  lines.push('---');
  const next = `${lines.join('\n')}\n\n${body.trim()}\n`;
  const tmp = `${file}.tmp`;
  await writeFile(tmp, next, 'utf8');
  await rename(tmp, file);
  return readAgent(slug, opts);
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/agents/vault-store.test.ts` → 4 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/agents/vault-store.ts tests/lexi/agents/vault-store.test.ts
git commit -m "feat(lexi): vault-store for agent.md scan and parse"
```

---

## Task 2 — Vault store: atomic write + tool toggle

**Files:** Append to `tests/lexi/agents/vault-store.test.ts`. (Implementation already in Task 1.)

- [ ] **Step 1:** Append to the existing describe block in `tests/lexi/agents/vault-store.test.ts`:

```ts
  it('writeAgentPrompt overwrites prompt body via tmp+rename', async () => {
    const { writeAgentPrompt } = await import('../../../src/lexi-dashboard/agents/vault-store.js');
    await writeAgentPrompt('lexi', 'You are Lexi v2.', { vaultRoot });
    const lexi = await readAgent('lexi', { vaultRoot });
    expect(lexi.prompt).toBe('You are Lexi v2.');
    expect(lexi.allowedTools).toEqual(['vault_read', 'memory_recall']); // frontmatter preserved
  });
  it('setToolEnabled adds to allowed and removes from disabled', async () => {
    const { setToolEnabled } = await import('../../../src/lexi-dashboard/agents/vault-store.js');
    const updated = await setToolEnabled('lexi', 'bash', true, { vaultRoot });
    expect(updated.allowedTools).toContain('bash');
    expect(updated.disabledTools).not.toContain('bash');
  });
  it('setToolEnabled false moves tool from allowed to disabled', async () => {
    const { setToolEnabled } = await import('../../../src/lexi-dashboard/agents/vault-store.js');
    const updated = await setToolEnabled('lexi', 'vault_read', false, { vaultRoot });
    expect(updated.allowedTools).not.toContain('vault_read');
    expect(updated.disabledTools).toContain('vault_read');
  });
  it('writeAgentPrompt does not leave a .tmp file behind', async () => {
    const { writeAgentPrompt } = await import('../../../src/lexi-dashboard/agents/vault-store.js');
    const { existsSync } = await import('node:fs');
    await writeAgentPrompt('lexi', 'roundtrip', { vaultRoot });
    expect(existsSync(path.join(vaultRoot, '00-System/agents/lexi/agent.md.tmp'))).toBe(false);
  });
```

- [ ] **Step 2:** `npm test -- tests/lexi/agents/vault-store.test.ts` → 8 PASS total.
- [ ] **Step 3:** Commit:

```bash
git add tests/lexi/agents/vault-store.test.ts
git commit -m "test(lexi): vault-store atomic write and tool toggle coverage"
```

---

## Task 3 — Activity log + restart wrapper

**Files:** Create `src/lexi-dashboard/agents/activity-log.ts`, `src/lexi-dashboard/agents/restart.ts`, `tests/lexi/agents/activity-log.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/agents/activity-log.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { recordActivity, tailActivity, clearActivity } from '../../../src/lexi-dashboard/agents/activity-log.js';

describe('activity-log', () => {
  beforeEach(() => clearActivity());
  it('returns empty array for unknown slug', () => {
    expect(tailActivity('ghost')).toEqual([]);
  });
  it('records and returns most-recent first up to limit', () => {
    for (let i = 0; i < 5; i++) recordActivity('lexi', { type: 'tool_call', summary: `t${i}` });
    const tail = tailActivity('lexi', 3);
    expect(tail).toHaveLength(3);
    expect(tail[0].summary).toBe('t4');
    expect(tail[2].summary).toBe('t2');
  });
  it('caps ring buffer at 200 entries per agent', () => {
    for (let i = 0; i < 250; i++) recordActivity('lexi', { type: 'x', summary: `${i}` });
    expect(tailActivity('lexi', 1000).length).toBe(200);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/agents/activity-log.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/agents/activity-log.ts`:

```ts
export interface ActivityEvent { ts: number; type: string; summary: string; payload?: unknown; }

const RING_MAX = 200;
const buffers = new Map<string, ActivityEvent[]>();

export function recordActivity(slug: string, ev: Omit<ActivityEvent, 'ts'> & { ts?: number }): void {
  const buf = buffers.get(slug) ?? [];
  buf.push({ ts: ev.ts ?? Date.now(), type: ev.type, summary: ev.summary, payload: ev.payload });
  if (buf.length > RING_MAX) buf.splice(0, buf.length - RING_MAX);
  buffers.set(slug, buf);
}

export function tailActivity(slug: string, limit = 50): ActivityEvent[] {
  const buf = buffers.get(slug) ?? [];
  return buf.slice(-limit).reverse();
}

export function clearActivity(): void { buffers.clear(); }

export function lastActiveAt(slug: string): number | null {
  const buf = buffers.get(slug);
  return buf && buf.length ? buf[buf.length - 1].ts : null;
}
```

- [ ] **Step 4:** Create `src/lexi-dashboard/agents/restart.ts` (thin wrapper — does NOT directly import the upstream restart orchestrator because that module restarts the *whole process*; instead we expose a request hook that a runtime adapter can subscribe to):

```ts
import { recordActivity } from './activity-log.js';

export interface RestartResult { slug: string; requested_at: number; status: 'queued' | 'unsupported'; }

type RestartHandler = (slug: string) => Promise<void> | void;
let handler: RestartHandler | null = null;

export function registerRestartHandler(fn: RestartHandler): void { handler = fn; }

export async function requestRestart(slug: string): Promise<RestartResult> {
  recordActivity(slug, { type: 'restart_requested', summary: `restart requested for ${slug}` });
  if (!handler) return { slug, requested_at: Date.now(), status: 'unsupported' };
  await handler(slug);
  recordActivity(slug, { type: 'restart_completed', summary: `restart completed for ${slug}` });
  return { slug, requested_at: Date.now(), status: 'queued' };
}
```

(Plan 5 or a follow-up wires `registerRestartHandler` to the upstream safe-restart orchestrator. For now the route returns `unsupported` if no runtime is wired, which the UI surfaces honestly.)

- [ ] **Step 5:** `npm test -- tests/lexi/agents/activity-log.test.ts` → 3 PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/lexi-dashboard/agents/activity-log.ts src/lexi-dashboard/agents/restart.ts tests/lexi/agents/activity-log.test.ts
git commit -m "feat(lexi): in-memory agent activity log + pluggable restart hook"
```

---

## Task 4 — REST routes for /api/agents

**Files:** Create `src/lexi-dashboard/routes/agents.ts`, `tests/lexi/agents/routes.test.ts`. Modify `src/lexi-dashboard/server.ts`.

- [ ] **Step 1:** Create `tests/lexi/agents/routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

let server: LexiServer; let baseUrl: string; let vaultRoot: string;

beforeAll(async () => {
  vaultRoot = mkdtempSync(path.join(os.tmpdir(), 'lexi-routes-'));
  const dir = path.join(vaultRoot, '00-System', 'agents', 'lexi');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'agent.md'),
    `---\nname: lexi\nmodel: claude-opus-4-7\nallowedTools:\n  - vault_read\ndisabledTools:\n  - bash\n---\n\nYou are Lexi.\n`);
  process.env.LEXI_VAULT_ROOT = vaultRoot;
  server = await startLexiServer({ port: 0 });
  baseUrl = `http://localhost:${server.port}`;
});
afterAll(async () => { await server.stop(); rmSync(vaultRoot, { recursive: true, force: true }); delete process.env.LEXI_VAULT_ROOT; });

describe('agents API', () => {
  it('GET /api/agents returns the list', async () => {
    const res = await fetch(`${baseUrl}/api/agents`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.agents)).toBe(true);
    expect(body.agents[0].slug).toBe('lexi');
    expect(body.agents[0].tools_enabled).toBe(1);
  });
  it('GET /api/agents/:slug returns full detail', async () => {
    const res = await fetch(`${baseUrl}/api/agents/lexi`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prompt).toContain('You are Lexi.');
    expect(body.allowedTools).toEqual(['vault_read']);
  });
  it('GET /api/agents/ghost returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/agents/ghost`);
    expect(res.status).toBe(404);
  });
  it('PUT /api/agents/:slug/prompt persists', async () => {
    const res = await fetch(`${baseUrl}/api/agents/lexi/prompt`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'You are Lexi v3.' }),
    });
    expect(res.status).toBe(200);
    const verify = await (await fetch(`${baseUrl}/api/agents/lexi`)).json();
    expect(verify.prompt).toBe('You are Lexi v3.');
  });
  it('PUT /api/agents/:slug/tools/:toolId toggles', async () => {
    const res = await fetch(`${baseUrl}/api/agents/lexi/tools/bash`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allowedTools).toContain('bash');
    expect(body.disabledTools).not.toContain('bash');
  });
  it('POST /api/agents/:slug/restart returns status', async () => {
    const res = await fetch(`${baseUrl}/api/agents/lexi/restart`, { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(['queued', 'unsupported']).toContain(body.status);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/agents/routes.test.ts` → fail (404 on all).
- [ ] **Step 3:** Create `src/lexi-dashboard/routes/agents.ts`:

```ts
import { Router, type Request, type Response } from 'express';
import express from 'express';
import { listAgents, readAgent, writeAgentPrompt, setToolEnabled } from '../agents/vault-store.js';
import { tailActivity, lastActiveAt } from '../agents/activity-log.js';
import { requestRestart } from '../agents/restart.js';

function vaultOpts() {
  const vaultRoot = process.env.LEXI_VAULT_ROOT;
  return vaultRoot ? { vaultRoot } : undefined;
}

export function createAgentsRouter(): Router {
  const router = Router();
  router.use(express.json({ limit: '256kb' }));

  router.get('/', async (_req, res) => {
    const agents = await listAgents(vaultOpts());
    const enriched = agents.map((a) => ({ ...a, last_active_at: lastActiveAt(a.slug), uptime_ms: Date.now() - a.last_modified_at }));
    res.json({ agents: enriched });
  });

  router.get('/:slug', async (req: Request, res: Response) => {
    try {
      const detail = await readAgent(req.params.slug, vaultOpts());
      res.json({ ...detail, recent_activity: tailActivity(req.params.slug, 25), last_active_at: lastActiveAt(req.params.slug) });
    } catch (err) {
      res.status(404).json({ error: 'not_found', slug: req.params.slug, message: (err as Error).message });
    }
  });

  router.put('/:slug/prompt', async (req: Request, res: Response) => {
    const { prompt } = req.body ?? {};
    if (typeof prompt !== 'string') { res.status(400).json({ error: 'prompt_required' }); return; }
    try {
      await writeAgentPrompt(req.params.slug, prompt, vaultOpts());
      const detail = await readAgent(req.params.slug, vaultOpts());
      res.json({ ok: true, ...detail });
    } catch (err) {
      res.status(404).json({ error: 'not_found', message: (err as Error).message });
    }
  });

  router.put('/:slug/tools/:toolId', async (req: Request, res: Response) => {
    const { enabled } = req.body ?? {};
    if (typeof enabled !== 'boolean') { res.status(400).json({ error: 'enabled_required' }); return; }
    try {
      const updated = await setToolEnabled(req.params.slug, req.params.toolId, enabled, vaultOpts());
      res.json({ ok: true, ...updated });
    } catch (err) {
      res.status(404).json({ error: 'not_found', message: (err as Error).message });
    }
  });

  router.post('/:slug/restart', async (req: Request, res: Response) => {
    const result = await requestRestart(req.params.slug);
    res.json(result);
  });

  return router;
}
```

- [ ] **Step 4:** Edit `src/lexi-dashboard/server.ts` — import and mount the router. Inside `startLexiServer`, immediately after `app.use('/assets', ...)`:

```ts
import { createAgentsRouter } from './routes/agents.js';
// ...inside startLexiServer:
app.use('/api/agents', createAgentsRouter());
```

- [ ] **Step 5:** `npm run build && npm test -- tests/lexi/agents/routes.test.ts` → 6 PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/lexi-dashboard/routes/agents.ts src/lexi-dashboard/server.ts tests/lexi/agents/routes.test.ts
git commit -m "feat(lexi): /api/agents routes for list, detail, prompt, tools, restart"
```

---

## Task 5 — `lexi-prompt-editor` component

**Files:** Create `src/lexi-dashboard/ui/components/lexi-prompt-editor.ts`, `tests/lexi/agents/prompt-editor.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/agents/prompt-editor.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/lexi-prompt-editor.js');
});

function mount(initial = 'hello'): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-prompt-editor') as HTMLElement & { value: string };
  el.setAttribute('value', initial);
  document.body.appendChild(el);
  return el;
}

describe('lexi-prompt-editor', () => {
  beforeEach(() => { document.body.replaceChildren(); });

  it('renders a textarea with the initial value', async () => {
    const el = mount('You are Lexi.');
    await new Promise((r) => requestAnimationFrame(r));
    const ta = el.querySelector('textarea')!;
    expect(ta.value).toBe('You are Lexi.');
  });

  it('marks itself dirty when the textarea changes', async () => {
    const el = mount('a');
    await new Promise((r) => requestAnimationFrame(r));
    const ta = el.querySelector('textarea')!;
    ta.value = 'b'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.querySelector('[data-dirty]')).toBeTruthy();
  });

  it('emits prompt-save on Save click with the new value', async () => {
    const el = mount('a');
    await new Promise((r) => requestAnimationFrame(r));
    const ta = el.querySelector('textarea')!;
    ta.value = 'c'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    const handler = vi.fn();
    el.addEventListener('prompt-save', handler as EventListener);
    (el.querySelector('[data-save]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(handler).toHaveBeenCalled();
    expect((handler.mock.calls[0][0] as CustomEvent).detail.value).toBe('c');
  });

  it('Cancel reverts to the original value and clears dirty', async () => {
    const el = mount('original');
    await new Promise((r) => requestAnimationFrame(r));
    const ta = el.querySelector('textarea')!;
    ta.value = 'mut'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    (el.querySelector('[data-cancel]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect((el.querySelector('textarea')! as HTMLTextAreaElement).value).toBe('original');
    expect(el.querySelector('[data-dirty]')).toBeNull();
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/agents/prompt-editor.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-prompt-editor.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('lexi-prompt-editor')
export class LexiPromptEditor extends LitElement {
  @property({ type: String }) value = '';
  @state() private draft = '';
  @state() private dirty = false;

  static styles = css`
    :host { display: block; }
    .toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .toolbar .label { font-size: 12px; color: var(--text-secondary); }
    [data-dirty] { color: var(--warning); font-size: 11px; font-family: 'JetBrains Mono', monospace; }
    textarea {
      width: 100%; min-height: 360px;
      background: var(--bg-surface); color: var(--text-primary);
      border: 1px solid var(--border-default); border-radius: 8px;
      padding: 12px; font: 13px/1.5 'JetBrains Mono', monospace; resize: vertical;
    }
    textarea:focus { outline: 0; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
    button { background: transparent; color: var(--text-primary); border: 1px solid var(--border-subtle);
      padding: 4px 10px; border-radius: 6px; font: inherit; font-size: 12px; cursor: pointer; }
    button[data-save] { background: var(--accent); color: #fff; border-color: var(--accent); }
    button[disabled] { opacity: 0.5; cursor: not-allowed; }
  `;

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('value') && !this.dirty) this.draft = this.value;
  }

  private onInput = (ev: Event) => {
    this.draft = (ev.target as HTMLTextAreaElement).value;
    this.dirty = this.draft !== this.value;
  };

  private onSave = () => {
    this.dispatchEvent(new CustomEvent('prompt-save', { detail: { value: this.draft }, bubbles: true, composed: true }));
    this.value = this.draft; this.dirty = false;
  };

  private onCancel = () => { this.draft = this.value; this.dirty = false; };

  render() {
    return html`
      <div class="toolbar">
        <span class="label">System prompt</span>
        ${this.dirty ? html`<span data-dirty>● unsaved</span>` : null}
        <span style="flex:1"></span>
        <button data-cancel @click=${this.onCancel} ?disabled=${!this.dirty}>Cancel</button>
        <button data-save @click=${this.onSave} ?disabled=${!this.dirty}>Save</button>
      </div>
      <textarea spellcheck="false" .value=${this.draft} @input=${this.onInput}></textarea>
    `;
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/agents/prompt-editor.test.ts` → 4 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-prompt-editor.ts tests/lexi/agents/prompt-editor.test.ts
git commit -m "feat(lexi): prompt editor component with dirty state"
```

---

## Task 6 — `lexi-tool-toggle-list` component

**Files:** Create `src/lexi-dashboard/ui/components/lexi-tool-toggle-list.ts`, `tests/lexi/agents/tool-toggle-list.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/agents/tool-toggle-list.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/lexi-tool-toggle-list.js');
});

function mount(): HTMLElement & { allowed: string[]; disabled: string[]; tools: string[] } {
  document.body.replaceChildren();
  const el = document.createElement('lexi-tool-toggle-list') as HTMLElement & {
    allowed: string[]; disabled: string[]; tools: string[];
  };
  el.tools = ['bash', 'vault_read', 'memory_recall', 'web_fetch'];
  el.allowed = ['vault_read', 'memory_recall'];
  el.disabled = ['bash'];
  document.body.appendChild(el);
  return el;
}

describe('lexi-tool-toggle-list', () => {
  beforeEach(() => { document.body.replaceChildren(); });

  it('renders one row per tool', async () => {
    const el = mount();
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.querySelectorAll('[data-tool]').length).toBe(4);
  });

  it('shows allowed tools as enabled and disabled tools as off', async () => {
    const el = mount();
    await new Promise((r) => requestAnimationFrame(r));
    const vault = el.querySelector('[data-tool="vault_read"] input') as HTMLInputElement;
    const bash = el.querySelector('[data-tool="bash"] input') as HTMLInputElement;
    expect(vault.checked).toBe(true);
    expect(bash.checked).toBe(false);
  });

  it('filters with search input', async () => {
    const el = mount();
    await new Promise((r) => requestAnimationFrame(r));
    const search = el.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'mem'; search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(r));
    const visible = el.querySelectorAll('[data-tool]');
    expect(visible.length).toBe(1);
    expect(visible[0].getAttribute('data-tool')).toBe('memory_recall');
  });

  it('emits tool-toggle when a switch is clicked', async () => {
    const el = mount();
    await new Promise((r) => requestAnimationFrame(r));
    const handler = vi.fn();
    el.addEventListener('tool-toggle', handler as EventListener);
    const bash = el.querySelector('[data-tool="bash"] input') as HTMLInputElement;
    bash.checked = true; bash.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(r));
    expect(handler).toHaveBeenCalled();
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ toolId: 'bash', enabled: true });
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/agents/tool-toggle-list.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-tool-toggle-list.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('lexi-tool-toggle-list')
export class LexiToolToggleList extends LitElement {
  @property({ type: Array }) tools: string[] = [];
  @property({ type: Array }) allowed: string[] = [];
  @property({ type: Array }) disabled: string[] = [];
  @state() private query = '';

  static styles = css`
    :host { display: block; }
    input[type="search"] {
      width: 100%; padding: 8px 12px; margin-bottom: 8px;
      background: var(--bg-surface); color: var(--text-primary);
      border: 1px solid var(--border-default); border-radius: 6px; font: inherit; font-size: 13px;
    }
    input[type="search"]:focus { outline: 0; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
    .row { display: flex; align-items: center; gap: 12px; padding: 6px 8px; border-radius: 6px; }
    .row:hover { background: var(--bg-elevated); }
    .row .id { flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-primary); }
    .empty { color: var(--text-tertiary); font-size: 12px; padding: 8px; }
    .switch { position: relative; width: 32px; height: 18px; display: inline-block; }
    .switch input { opacity: 0; width: 100%; height: 100%; cursor: pointer; }
    .switch .track { position: absolute; inset: 0; background: var(--border-default); border-radius: 999px; transition: background 0.15s; }
    .switch input:checked + .track { background: var(--accent); }
    .switch .knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform 0.15s; }
    .switch input:checked ~ .knob { transform: translateX(14px); }
  `;

  private get filtered(): { id: string; enabled: boolean }[] {
    const allowedSet = new Set(this.allowed);
    const q = this.query.trim().toLowerCase();
    return this.tools
      .filter((t) => !q || t.toLowerCase().includes(q))
      .map((id) => ({ id, enabled: allowedSet.has(id) }));
  }

  private onToggle(toolId: string, ev: Event) {
    const enabled = (ev.target as HTMLInputElement).checked;
    this.dispatchEvent(new CustomEvent('tool-toggle', {
      detail: { toolId, enabled }, bubbles: true, composed: true,
    }));
  }

  render() {
    const rows = this.filtered;
    return html`
      <input type="search" placeholder="Filter tools..." .value=${this.query}
        @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)} />
      ${rows.length === 0
        ? html`<div class="empty">No tools match.</div>`
        : rows.map((t) => html`
            <div class="row" data-tool="${t.id}">
              <span class="id">${t.id}</span>
              <label class="switch">
                <input type="checkbox" .checked=${t.enabled} @change=${(ev: Event) => this.onToggle(t.id, ev)} />
                <span class="track"></span>
                <span class="knob"></span>
              </label>
            </div>
          `)}
    `;
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/agents/tool-toggle-list.test.ts` → 4 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-tool-toggle-list.ts tests/lexi/agents/tool-toggle-list.test.ts
git commit -m "feat(lexi): tool toggle list component with search"
```

---

## Task 7 — `lexi-agents-view` master/detail container

**Files:** Create `src/lexi-dashboard/ui/components/lexi-agents-view.ts`, `tests/lexi/agents/view.test.ts`. Modify `src/lexi-dashboard/ui/components/lexi-app.ts` to route `#/agents`.

- [ ] **Step 1:** Create `tests/lexi/agents/view.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const fetchMock = vi.fn();

beforeAll(async () => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  await import('../../../src/lexi-dashboard/ui/components/lexi-agents-view.js');
});

beforeEach(() => {
  fetchMock.mockReset();
  document.body.replaceChildren();
});

function jsonRes(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }));
}

describe('lexi-agents-view', () => {
  it('fetches /api/agents on connect and renders the list', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/api/agents')) return jsonRes({ agents: [
        { slug: 'lexi', name: 'lexi', model: 'claude-opus-4-7', tools_enabled: 2, tools_disabled: 1, memory_size_bytes: 1024, last_active_at: null, uptime_ms: 0 },
        { slug: 'jonah', name: 'jonah', model: 'claude-sonnet-4-5', tools_enabled: 0, tools_disabled: 0, memory_size_bytes: 512, last_active_at: null, uptime_ms: 0 },
      ]});
      return jsonRes({});
    });
    const el = document.createElement('lexi-agents-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 30));
    const items = el.querySelectorAll('[data-agent-slug]');
    expect(items.length).toBe(2);
  });

  it('loads detail when an agent is clicked', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/api/agents')) return jsonRes({ agents: [
        { slug: 'lexi', name: 'lexi', model: 'claude-opus-4-7', tools_enabled: 1, tools_disabled: 0, memory_size_bytes: 1024, last_active_at: null, uptime_ms: 0 },
      ]});
      if (url.endsWith('/api/agents/lexi')) return jsonRes({
        slug: 'lexi', name: 'lexi', model: 'claude-opus-4-7',
        tools_enabled: 1, tools_disabled: 0, memory_size_bytes: 1024,
        prompt: 'You are Lexi.', allowedTools: ['vault_read'], disabledTools: [],
        recent_activity: [], last_active_at: null,
      });
      return jsonRes({});
    });
    const el = document.createElement('lexi-agents-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 30));
    (el.querySelector('[data-agent-slug="lexi"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(el.querySelector('[data-detail-slug="lexi"]')).toBeTruthy();
    expect(el.querySelector('lexi-prompt-editor')).toBeTruthy();
  });

  it('restart button asks for confirmation before POSTing', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/api/agents')) return jsonRes({ agents: [
        { slug: 'lexi', name: 'lexi', model: 'm', tools_enabled: 0, tools_disabled: 0, memory_size_bytes: 0, last_active_at: null, uptime_ms: 0 },
      ]});
      if (url.endsWith('/api/agents/lexi')) return jsonRes({
        slug: 'lexi', name: 'lexi', model: 'm', tools_enabled: 0, tools_disabled: 0, memory_size_bytes: 0,
        prompt: '', allowedTools: [], disabledTools: [], recent_activity: [], last_active_at: null,
      });
      if (url.endsWith('/api/agents/lexi/restart')) return jsonRes({ status: 'queued' });
      return jsonRes({});
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const el = document.createElement('lexi-agents-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 30));
    (el.querySelector('[data-agent-slug="lexi"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    (el.querySelector('[data-restart]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(confirmSpy).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/restart'))).toBe(false);
    confirmSpy.mockRestore();
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/agents/view.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-agents-view.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './lexi-prompt-editor.js';
import './lexi-tool-toggle-list.js';

interface AgentSummary { slug: string; name: string; model: string; tools_enabled: number; tools_disabled: number; memory_size_bytes: number; last_active_at: number | null; uptime_ms: number; }
interface ActivityEvent { ts: number; type: string; summary: string; }
interface AgentDetail extends AgentSummary { prompt: string; allowedTools: string[]; disabledTools: string[]; recent_activity: ActivityEvent[]; }

type Tab = 'prompt' | 'tools' | 'memory' | 'logs' | 'activity';

@customElement('lexi-agents-view')
export class LexiAgentsView extends LitElement {
  @state() private agents: AgentSummary[] = [];
  @state() private selected: AgentDetail | null = null;
  @state() private tab: Tab = 'prompt';
  @state() private loading = false;
  @state() private error: string | null = null;

  static styles = css`
    :host { display: grid; grid-template-columns: 280px 1fr; gap: 0; height: 100%; }
    aside { border-right: 1px solid var(--border-subtle); overflow: auto; }
    .agent-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--border-subtle); }
    .agent-row:hover { background: var(--bg-elevated); }
    .agent-row[aria-selected="true"] { background: var(--bg-elevated); border-left: 2px solid var(--accent); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-tertiary); flex-shrink: 0; }
    .dot[data-status="running"] { background: var(--success); box-shadow: 0 0 8px var(--success); }
    .dot[data-status="error"] { background: var(--danger); }
    .agent-meta { flex: 1; min-width: 0; }
    .agent-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .agent-sub { font-size: 11px; color: var(--text-tertiary); font-family: 'JetBrains Mono', monospace; }
    section { padding: 16px 20px; overflow: auto; }
    .detail-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .detail-header h2 { margin: 0; font-size: 18px; font-weight: 600; }
    .detail-header .model { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-tertiary); }
    .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 16px; }
    .tab { padding: 6px 12px; cursor: pointer; font-size: 12px; color: var(--text-secondary); border-bottom: 2px solid transparent; }
    .tab[aria-selected="true"] { color: var(--text-primary); border-bottom-color: var(--accent); }
    button.danger { background: transparent; color: var(--danger); border: 1px solid var(--danger); padding: 4px 10px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 12px; }
    .placeholder { color: var(--text-tertiary); font-size: 13px; padding: 24px 0; }
    .log-entry { font-family: 'JetBrains Mono', monospace; font-size: 12px; padding: 4px 0; border-bottom: 1px solid var(--border-subtle); color: var(--text-secondary); }
    .log-entry .ts { color: var(--text-tertiary); margin-right: 8px; }
  `;

  protected createRenderRoot() { return this; } // Light DOM so tests can query

  connectedCallback(): void { super.connectedCallback(); void this.loadList(); }

  private async loadList() {
    this.loading = true; this.error = null;
    try {
      const res = await fetch('/api/agents');
      const body = await res.json();
      this.agents = body.agents ?? [];
    } catch (e) { this.error = (e as Error).message; }
    finally { this.loading = false; }
  }

  private async select(slug: string) {
    this.loading = true; this.error = null;
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(`failed: ${res.status}`);
      this.selected = await res.json();
      this.tab = 'prompt';
    } catch (e) { this.error = (e as Error).message; }
    finally { this.loading = false; }
  }

  private async savePrompt(ev: CustomEvent<{ value: string }>) {
    if (!this.selected) return;
    const slug = this.selected.slug;
    const res = await fetch(`/api/agents/${encodeURIComponent(slug)}/prompt`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: ev.detail.value }),
    });
    if (res.ok) this.selected = await res.json();
  }

  private async toggleTool(ev: CustomEvent<{ toolId: string; enabled: boolean }>) {
    if (!this.selected) return;
    const slug = this.selected.slug;
    const res = await fetch(`/api/agents/${encodeURIComponent(slug)}/tools/${encodeURIComponent(ev.detail.toolId)}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: ev.detail.enabled }),
    });
    if (res.ok) this.selected = await res.json();
  }

  private async restart() {
    if (!this.selected) return;
    const slug = this.selected.slug;
    if (!window.confirm(`Restart agent "${slug}"? In-flight tool calls will be interrupted.`)) return;
    await fetch(`/api/agents/${encodeURIComponent(slug)}/restart`, { method: 'POST' });
  }

  private renderList() {
    if (!this.agents.length) return html`<div class="placeholder" style="padding:16px">No agents found.</div>`;
    return this.agents.map((a) => html`
      <div class="agent-row" data-agent-slug="${a.slug}"
        aria-selected=${this.selected?.slug === a.slug}
        @click=${() => this.select(a.slug)}>
        <span class="dot" data-status=${a.last_active_at ? 'running' : 'idle'}></span>
        <div class="agent-meta">
          <div class="agent-name">${a.name}</div>
          <div class="agent-sub">${a.model} · ${a.tools_enabled}/${a.tools_enabled + a.tools_disabled} tools</div>
        </div>
      </div>
    `);
  }

  private renderDetail() {
    if (!this.selected) return html`<div class="placeholder">Select an agent to inspect.</div>`;
    const s = this.selected;
    const tabBtn = (id: Tab, label: string) => html`
      <div class="tab" aria-selected=${this.tab === id} @click=${() => (this.tab = id)}>${label}</div>`;
    const allTools = [...new Set([...s.allowedTools, ...s.disabledTools])].sort();
    return html`
      <div data-detail-slug="${s.slug}">
        <div class="detail-header">
          <h2>${s.name}</h2>
          <span class="model">${s.model}</span>
          <span style="flex:1"></span>
          <button class="danger" data-restart @click=${this.restart}>Restart</button>
        </div>
        <div class="tabs">
          ${tabBtn('prompt', 'Prompt')}
          ${tabBtn('tools', `Tools (${s.allowedTools.length})`)}
          ${tabBtn('memory', 'Memory')}
          ${tabBtn('logs', 'Logs')}
          ${tabBtn('activity', 'Activity')}
        </div>
        ${this.tab === 'prompt' ? html`
          <lexi-prompt-editor .value=${s.prompt} @prompt-save=${(e: CustomEvent<{ value: string }>) => this.savePrompt(e)}></lexi-prompt-editor>
        ` : null}
        ${this.tab === 'tools' ? html`
          <lexi-tool-toggle-list .tools=${allTools} .allowed=${s.allowedTools} .disabled=${s.disabledTools}
            @tool-toggle=${(e: CustomEvent<{ toolId: string; enabled: boolean }>) => this.toggleTool(e)}></lexi-tool-toggle-list>
        ` : null}
        ${this.tab === 'memory' ? html`
          <div class="placeholder">agent.md size: ${s.memory_size_bytes} bytes · last modified ${new Date(s.last_active_at ?? Date.now()).toLocaleString()}</div>
        ` : null}
        ${this.tab === 'logs' ? html`
          <div class="placeholder">Log streaming wired in Plan 3 (SSE). Today: vault file size + frontmatter shown above.</div>
        ` : null}
        ${this.tab === 'activity' ? html`
          ${s.recent_activity.length === 0
            ? html`<div class="placeholder">No recent activity recorded.</div>`
            : s.recent_activity.map((ev) => html`
              <div class="log-entry"><span class="ts">${new Date(ev.ts).toLocaleTimeString()}</span>${ev.type} · ${ev.summary}</div>
            `)}
        ` : null}
      </div>
    `;
  }

  render() {
    return html`
      <aside>${this.renderList()}</aside>
      <section>${this.error ? html`<div class="placeholder">Error: ${this.error}</div>` : this.renderDetail()}</section>
    `;
  }
}
```

- [ ] **Step 4:** Edit `src/lexi-dashboard/ui/components/lexi-app.ts` to route `#/agents`. Add the import:

```ts
import './lexi-agents-view.js';
```

Add a hash-routed render. Replace the `<main>` block with:

```ts
private get section(): string {
  return (window.location.hash || '#/home').replace(/^#\//, '');
}
connectedCallback(): void { super.connectedCallback(); window.addEventListener('hashchange', () => this.requestUpdate()); }
// in render():
<main class="lexi-main">
  ${this.section === 'agents'
    ? html`<lexi-agents-view></lexi-agents-view>`
    : html`<h1 style="margin:0 0 8px 0;font-size:28px;font-weight:600">Welcome to Lexi</h1>
           <p style="color:var(--text-secondary)">Sections will be wired in Plans 3-7.</p>`}
</main>
```

- [ ] **Step 5:** `npm run build:lexi && npm test -- tests/lexi/agents/view.test.ts` → 3 PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-agents-view.ts src/lexi-dashboard/ui/components/lexi-app.ts tests/lexi/agents/view.test.ts
git commit -m "feat(lexi): agents master/detail view with tabbed editor"
```

---

## Task 8 — End-to-end smoke + upstream-clean verification

- [ ] **Step 1:** `npm run build` → no errors.
- [ ] **Step 2:** `npm test -- tests/lexi/agents/` → all green (vault-store 8 + activity-log 3 + routes 6 + prompt-editor 4 + tool-toggle-list 4 + view 3 = 28).
- [ ] **Step 3:** `LEXI_PORT=3031 node dist/cli/index.js lexi dashboard` → server up.
- [ ] **Step 4:** `curl -s localhost:3031/api/agents | jq '.agents | length'` → returns count > 0 (assuming `~/.clementine/vault/00-System/agents/` is populated).
- [ ] **Step 5:** Open `http://localhost:3031/#/agents`. Verify:
  - Left rail lists every agent with model + tool count + activity dot.
  - Click an agent → detail loads with 5 tabs (Prompt / Tools / Memory / Logs / Activity).
  - Edit prompt, click Save → reload page → edit persists. Verify `~/.clementine/vault/00-System/agents/<slug>/agent.md` body is updated; frontmatter is intact.
  - Toggle a tool in the Tools tab → switch state persists across reload; agent.md frontmatter `allowedTools`/`disabledTools` arrays reflect the change.
  - Click Restart → confirm prompt appears. Cancel → no POST. Confirm → POST returns `{status: "queued"}` or `{status: "unsupported"}` depending on whether a runtime handler is registered.
- [ ] **Step 6:** `git fetch upstream && git diff upstream/main..HEAD --name-only | sort` → no upstream files modified beyond Plan 1's two (`package.json`, `src/cli/index.ts`).
- [ ] **Step 7:** `git merge-tree --write-tree upstream/main HEAD | head -5` → first line is a tree hash, no conflict markers.

---

## Definition of done for Plan 4

- [ ] All 8 tasks committed
- [ ] `npm test -- tests/lexi/agents/` all green (28 tests)
- [ ] `npm run build` succeeds
- [ ] All 5 routes return JSON with the documented shape:
  - `GET /api/agents` → `{ agents: [{slug, name, model, status?, tools_enabled, tools_disabled, memory_size_bytes, last_active_at, uptime_ms}, ...] }`
  - `GET /api/agents/:slug` → full detail with `prompt`, `allowedTools`, `disabledTools`, `recent_activity`
  - `PUT /api/agents/:slug/prompt` → 200 with updated detail; vault file mtime updates; `.tmp` file does not leak
  - `PUT /api/agents/:slug/tools/:toolId` → 200 with updated detail; frontmatter reflects toggle
  - `POST /api/agents/:slug/restart` → 200 with `{slug, requested_at, status}` where status is `queued` or `unsupported`
- [ ] Atomic write proven by test (`agent.md.tmp` never persists after `writeAgentPrompt`)
- [ ] Restart confirm dialog blocks the POST when user cancels (covered by view.test.ts)
- [ ] Activity dots in left rail wire-ready for Plan 3 SSE (currently lit by `last_active_at` from in-memory log; will be fed live once Plan 3 ships)
- [ ] `git diff upstream/main..HEAD` adds only files under `src/lexi-dashboard/agents/`, `src/lexi-dashboard/routes/`, `src/lexi-dashboard/ui/components/lexi-{agents-view,prompt-editor,tool-toggle-list}.ts`, `tests/lexi/agents/`, and modifies only Lexi-owned `server.ts` and `lexi-app.ts`
- [ ] `git merge-tree upstream/main HEAD` → no conflict markers

## Hand-off to Plan 5

Plan 5 (or whichever plan owns runtime wiring) registers a real `RestartHandler` via `registerRestartHandler()` in `src/lexi-dashboard/agents/restart.ts` so `POST /api/agents/:slug/restart` actually restarts the agent process via the upstream safe-restart orchestrator. Plan 3 (SSE bus) writes incoming agent events into `recordActivity()` so the activity dots and the Activity tab become live.
