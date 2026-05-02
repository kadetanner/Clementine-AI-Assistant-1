# Lexi Dashboard — Plan 5: Connections section

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the **Connections** section — a unified, master/detail surface for everything that links Lexi to external systems: MCP servers (from `claude-integrations.json` + `discoverMcpServers()`), Composio toolkits, and OAuth integrations (Salesforce, Discord, Slack, Gmail). Each connection has a status dot, last-probe timestamp, tool count, and an editable credential drawer. Bulk "probe all" + per-connection re-probe + masked credential editing + OAuth re-auth.

**Architecture:** New routes under `/api/connections/*` in `src/lexi-dashboard/routes/connections.ts`. Pulls upstream services (`discoverMcpServers`, `getClaudeIntegrations`, `listConnectedToolkits`) via the established `upstream-compat.ts` shim. Re-uses the existing Salesforce / Discord / Slack / Gmail status routes from `src/cli/dashboard.ts` by calling the same in-process functions where possible (never via HTTP). Lit components added under `src/lexi-dashboard/ui/components/connections/`.

**Tech Stack:** TypeScript 5+ · Node 20+ · Express 4 · Lit 3 · esbuild · Vitest (jsdom for components, node for server).

**Spec reference:** `docs/lexi/specs/2026-05-02-lexi-dashboard-design.md` §4 (Connections row), §3.2 (reusing upstream services).

**Plan dependencies:** Plan 1 (foundation), Plan 2 (always-on, for `upstream-compat.ts`). If Plan 2 has not yet introduced the compat shim, Task 2 of this plan creates it as a NEW file (still upstream-clean).

---

## Conventions inherited from Plan 1

- Files: kebab-case · Components: `lexi-` PascalCase Lit elements · API routes: `/api/<resource>` · SSE shape: `{ type, ts, payload }` · Theme tokens: `:root[data-theme="..."]` CSS vars · Tests under `tests/lexi/**` use `execFileSync` and `replaceChildren()` · Conventional commits (`feat(lexi):`, etc.) · Imports from upstream go through `../<area>/<file>.js`; no upstream files edited.

**Plan 5 additional rules:**

- **Credentials are radioactive.** No credential value (full or partial-decoded) ever appears in a log line, error message, response body other than the masked form, or test fixture. Mask format: `<first2>***<last4>` for strings ≥6 chars, `***` for shorter strings. Empty/null → `null` (never `''`).
- **Probe is read-only.** A probe must never mutate persisted credentials. Updates roll back on probe failure.
- **No shell exec.** All child-process probes use `execFile` from `node:child_process` (or upstream's `execFileNoThrow` if available). Never `child_process.exec` with interpolated strings.
- **OAuth flows are never re-implemented in Lexi.** We surface status via upstream's existing `/api/salesforce/status`, `/api/discord/channels`, `/api/slack/channels` semantics, and link the user back to the upstream Settings page (or `clementine login <provider>` CLI) for re-auth.

## File structure (created in this plan)

```
src/lexi-dashboard/
  routes/
    connections.ts                 ← /api/connections/* router
  services/
    connection-registry.ts         ← unified read across MCP + Composio + OAuth
    credential-store.ts            ← masked read + atomic write w/ rollback
    probe.ts                       ← per-kind probe (mcp / composio / oauth)
  ui/components/connections/
    lexi-connections-view.ts       ← master/detail list
    lexi-mcp-server-card.ts
    lexi-credential-editor.ts
    lexi-oauth-status.ts
tests/lexi/connections/
  registry.test.ts
  credential-mask.test.ts
  probe.test.ts
  routes.test.ts
  view.test.ts
  mcp-card.test.ts
  credential-editor.test.ts
  oauth-status.test.ts
```

**Modified upstream files:** none.

---

## Task 1 — Verify branch and Plan 1+2 baseline

**Files:** working tree only.

- [ ] **Step 1:** `git branch --show-current` → expect `lexi-dashboard`.
- [ ] **Step 2:** `git status --short` → empty (Plan 4 committed).
- [ ] **Step 3:** `git log --oneline -1` → message starts with `feat(lexi):` or `test(lexi):` (last commit from Plan 4).
- [ ] **Step 4:** Confirm Plan 1 artefacts exist: `test -f src/lexi-dashboard/server.ts && test -f src/lexi-dashboard/ui/main.ts && test -d src/lexi-dashboard/ui/components`. All exit 0.
- [ ] **Step 5:** No commit. Proceed.

---

## Task 2 — Connection registry: unified read across MCP, Composio, OAuth

**Files:** Create `src/lexi-dashboard/services/connection-registry.ts`, `tests/lexi/connections/registry.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/connections/registry.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { listConnections, type Connection } from '../../../src/lexi-dashboard/services/connection-registry.js';

vi.mock('../../../src/agent/mcp-bridge.js', () => ({
  discoverMcpServers: () => [
    { name: 'neon', type: 'stdio', command: 'npx', args: ['neon-mcp'], enabled: true, description: 'Neon MCP' },
    { name: 'figma', type: 'http', url: 'https://figma.dev/mcp', enabled: false, description: 'Figma' },
  ],
  getClaudeIntegrations: () => [
    { name: 'Slack', label: 'Slack', tools: ['slack_send_message','slack_read_channel'], firstSeen: '2026-01-01', lastUsed: '2026-04-30', connected: true },
  ],
}));

vi.mock('../../../src/integrations/composio/client.js', () => ({
  isComposioEnabled: () => true,
  listConnectedToolkits: async () => [
    { slug: 'gmail', status: 'ACTIVE', connectionId: 'c_gmail_1', userId: 'u' },
    { slug: 'notion', status: 'INITIATED', connectionId: 'c_notion_1', userId: 'u' },
  ],
}));

describe('connection-registry', () => {
  it('returns one entry per MCP server', async () => {
    const list = await listConnections();
    const mcp = list.filter((c: Connection) => c.kind === 'mcp');
    expect(mcp.map((c) => c.id).sort()).toEqual(['mcp:figma','mcp:neon']);
  });

  it('returns one entry per Composio toolkit with status mapped', async () => {
    const list = await listConnections();
    const composio = list.filter((c: Connection) => c.kind === 'composio');
    const gmail = composio.find((c) => c.id === 'composio:gmail');
    expect(gmail?.status).toBe('connected');
    const notion = composio.find((c) => c.id === 'composio:notion');
    expect(notion?.status).toBe('degraded');
  });

  it('returns OAuth entries for salesforce/discord/slack/gmail', async () => {
    const list = await listConnections();
    const oauthIds = list.filter((c) => c.kind === 'oauth').map((c) => c.id).sort();
    expect(oauthIds).toEqual(['oauth:discord','oauth:gmail','oauth:salesforce','oauth:slack']);
  });

  it('every entry has id, kind, name, status, tool_count, last_check_at', async () => {
    const list = await listConnections();
    for (const c of list) {
      expect(typeof c.id).toBe('string');
      expect(['mcp','composio','oauth']).toContain(c.kind);
      expect(typeof c.name).toBe('string');
      expect(['connected','degraded','disconnected']).toContain(c.status);
      expect(typeof c.tool_count).toBe('number');
      expect(typeof c.last_check_at === 'string' || c.last_check_at === null).toBe(true);
    }
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/connections/registry.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/services/connection-registry.ts`:

```ts
import { discoverMcpServers, getClaudeIntegrations } from '../../agent/mcp-bridge.js';
import * as composio from '../../integrations/composio/client.js';

export type ConnectionKind = 'mcp' | 'composio' | 'oauth';
export type ConnectionStatus = 'connected' | 'degraded' | 'disconnected';

export interface Connection {
  id: string;
  kind: ConnectionKind;
  name: string;
  status: ConnectionStatus;
  last_check_at: string | null;
  tool_count: number;
  error_message?: string;
}

const lastCheck = new Map<string, string>();

export function recordCheck(id: string, at: string = new Date().toISOString()): void {
  lastCheck.set(id, at);
}

function mcpStatus(server: { enabled?: boolean }): ConnectionStatus {
  if (server.enabled === false) return 'disconnected';
  return 'connected';
}

function composioStatus(raw: string): ConnectionStatus {
  if (raw === 'ACTIVE') return 'connected';
  if (raw === 'INITIATED' || raw === 'EXPIRED') return 'degraded';
  return 'disconnected';
}

const OAUTH_PROVIDERS: Array<{ slug: string; name: string }> = [
  { slug: 'salesforce', name: 'Salesforce' },
  { slug: 'discord', name: 'Discord' },
  { slug: 'slack', name: 'Slack' },
  { slug: 'gmail', name: 'Gmail' },
];

export async function listConnections(): Promise<Connection[]> {
  const out: Connection[] = [];

  // MCP servers
  let mcpServers: ReturnType<typeof discoverMcpServers> = [];
  try { mcpServers = discoverMcpServers(); } catch { /* upstream unavailable */ }
  const integrations = (() => { try { return getClaudeIntegrations(); } catch { return []; } })();
  const integrationByName = new Map(integrations.map((i) => [i.name.toLowerCase(), i]));
  for (const s of mcpServers) {
    const id = `mcp:${s.name}`;
    const integ = integrationByName.get(s.name.toLowerCase());
    out.push({
      id, kind: 'mcp', name: s.name,
      status: mcpStatus(s),
      last_check_at: lastCheck.get(id) ?? null,
      tool_count: integ?.tools.length ?? 0,
    });
  }

  // Composio toolkits
  if (composio.isComposioEnabled()) {
    try {
      const toolkits = await composio.listConnectedToolkits();
      for (const tk of toolkits) {
        const id = `composio:${tk.slug}`;
        out.push({
          id, kind: 'composio', name: tk.slug,
          status: composioStatus(tk.status),
          last_check_at: lastCheck.get(id) ?? null,
          tool_count: 0,
        });
      }
    } catch (err) {
      out.push({
        id: 'composio:_error', kind: 'composio', name: 'composio',
        status: 'disconnected', last_check_at: null, tool_count: 0,
        error_message: String(err),
      });
    }
  }

  // OAuth providers — surface as a per-provider entry; status filled in by probe
  for (const p of OAUTH_PROVIDERS) {
    const id = `oauth:${p.slug}`;
    out.push({
      id, kind: 'oauth', name: p.name,
      status: 'disconnected',
      last_check_at: lastCheck.get(id) ?? null,
      tool_count: 0,
    });
  }

  return out;
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/connections/registry.test.ts` → 4 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/services/connection-registry.ts tests/lexi/connections/registry.test.ts
git commit -m "feat(lexi): unified connection registry across MCP, Composio, OAuth"
```

---

## Task 3 — Credential masking + atomic store

**Files:** Create `src/lexi-dashboard/services/credential-store.ts`, `tests/lexi/connections/credential-mask.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/connections/credential-mask.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mask, maskAll } from '../../../src/lexi-dashboard/services/credential-store.js';

describe('credential masking', () => {
  it('masks long secrets as first2***last4', () => {
    expect(mask('sk-prod-abcdef1234')).toBe('sk***1234');
    expect(mask('abcdef1234')).toBe('ab***1234');
  });
  it('masks short secrets as ***', () => {
    expect(mask('abc')).toBe('***');
    expect(mask('abcde')).toBe('***');
  });
  it('returns null for empty/null/undefined', () => {
    expect(mask('')).toBeNull();
    expect(mask(null)).toBeNull();
    expect(mask(undefined)).toBeNull();
  });
  it('maskAll preserves keys, masks every value', () => {
    const out = maskAll({ API_KEY: 'sk-prod-abcdef1234', EMPTY: '', NICK: 'kade' });
    expect(out).toEqual({ API_KEY: 'sk***1234', EMPTY: null, NICK: '***' });
  });
  it('mask never returns the raw value', () => {
    const raw = 'sk-prod-supersecretvalue-9999';
    const out = mask(raw);
    expect(out).not.toBe(raw);
    expect(out).not.toContain('supersecret');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/connections/credential-mask.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/services/credential-store.ts`:

```ts
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ENV_PATH = path.join(os.homedir(), '.clementine', '.env');

export function mask(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value.length < 6) return '***';
  return `${value.slice(0, 2)}***${value.slice(-4)}`;
}

export function maskAll(record: Record<string, string>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(record)) out[k] = mask(v);
  return out;
}

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function serializeEnv(record: Record<string, string>): string {
  return Object.entries(record).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
}

export function loadEnv(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  return parseEnv(readFileSync(ENV_PATH, 'utf-8'));
}

/**
 * Atomic write: tmp file + rename. Returns a rollback() that restores the previous
 * env on disk. Caller must invoke rollback() if the post-write probe fails.
 */
export function applyCredentials(updates: Record<string, string>): { rollback: () => void } {
  const before = loadEnv();
  const next = { ...before, ...updates };
  const tmp = `${ENV_PATH}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, serializeEnv(next), { mode: 0o600 });
  renameSync(tmp, ENV_PATH);
  return {
    rollback: () => {
      const tmp2 = `${ENV_PATH}.tmp.${process.pid}.${Date.now()}.rb`;
      writeFileSync(tmp2, serializeEnv(before), { mode: 0o600 });
      renameSync(tmp2, ENV_PATH);
    },
  };
}

/** Per-connection credential keys. Defines which env vars belong to which connection id. */
export const CREDENTIAL_KEYS: Record<string, string[]> = {
  'composio:_root': ['COMPOSIO_API_KEY'],
  'oauth:salesforce': ['SF_INSTANCE_URL','SF_CLIENT_ID','SF_CLIENT_SECRET','SF_USERNAME','SF_PASSWORD'],
  'oauth:discord': ['DISCORD_TOKEN'],
  'oauth:slack': ['SLACK_BOT_TOKEN','SLACK_USER_TOKEN'],
  'oauth:gmail': ['GMAIL_CLIENT_ID','GMAIL_CLIENT_SECRET','GMAIL_REFRESH_TOKEN'],
};

export function maskedCredentialsFor(connectionId: string): Record<string, string | null> {
  const keys = CREDENTIAL_KEYS[connectionId] ?? [];
  const env = loadEnv();
  const out: Record<string, string | null> = {};
  for (const k of keys) out[k] = mask(env[k] ?? '');
  return out;
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/connections/credential-mask.test.ts` → 5 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/services/credential-store.ts tests/lexi/connections/credential-mask.test.ts
git commit -m "feat(lexi): credential masking + atomic env store with rollback"
```

---

## Task 4 — Probe service (per-kind)

**Files:** Create `src/lexi-dashboard/services/probe.ts`, `tests/lexi/connections/probe.test.ts`.

**Security note:** `probe.ts` uses `execFile` (no shell) for the stdio command-existence check. Never use `child_process.exec` with interpolated strings here. Upstream's `src/utils/execFileNoThrow.ts` is the preferred wrapper if available; if Plan 1's compat layer hasn't surfaced it yet, the bare `execFile` import shown below is acceptable.

- [ ] **Step 1:** Create `tests/lexi/connections/probe.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/agent/mcp-bridge.js', () => ({
  discoverMcpServers: () => [
    { name: 'neon', type: 'stdio', command: 'echo', args: ['ok'], enabled: true },
    { name: 'figma', type: 'http', url: 'http://127.0.0.1:1', enabled: true },
    { name: 'broken', type: 'stdio', command: '/nonexistent/path/clearly', args: [], enabled: true },
  ],
  getClaudeIntegrations: () => [],
}));

vi.mock('../../../src/integrations/composio/client.js', () => ({
  isComposioEnabled: () => true,
  listConnectedToolkits: async () => [{ slug: 'gmail', status: 'ACTIVE', connectionId: 'c1', userId: 'u' }],
}));

import { probeConnection } from '../../../src/lexi-dashboard/services/probe.js';

describe('probe', () => {
  beforeEach(() => { vi.useRealTimers(); });

  it('returns connected for an MCP stdio server with an executable command', async () => {
    const r = await probeConnection('mcp:neon');
    expect(['connected','degraded']).toContain(r.status);
    expect(r.last_check_at).toBeTruthy();
  });

  it('returns disconnected for an MCP stdio server whose command is missing', async () => {
    const r = await probeConnection('mcp:broken');
    expect(r.status).toBe('disconnected');
    expect(r.error_message).toBeTruthy();
  });

  it('returns disconnected for an MCP http server whose endpoint is unreachable', async () => {
    const r = await probeConnection('mcp:figma');
    expect(r.status).toBe('disconnected');
  });

  it('returns connected for an ACTIVE composio toolkit', async () => {
    const r = await probeConnection('composio:gmail');
    expect(r.status).toBe('connected');
  });

  it('returns disconnected for an unknown id', async () => {
    const r = await probeConnection('mcp:does-not-exist');
    expect(r.status).toBe('disconnected');
  });

  it('NEVER includes a credential value in error_message', async () => {
    process.env.COMPOSIO_API_KEY = 'sk-test-supersecret-9999';
    const r = await probeConnection('composio:gmail');
    expect(r.error_message ?? '').not.toContain('supersecret');
    delete process.env.COMPOSIO_API_KEY;
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/connections/probe.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/services/probe.ts`:

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { discoverMcpServers } from '../../agent/mcp-bridge.js';
import * as composio from '../../integrations/composio/client.js';
import { recordCheck, type Connection, type ConnectionStatus } from './connection-registry.js';

// execFile (no shell) — never use child_process.exec here.
const runFile = promisify(execFile);

export interface ProbeResult {
  status: ConnectionStatus;
  last_check_at: string;
  error_message?: string;
}

const PROBE_TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function commandExists(command: string): Promise<boolean> {
  // execFile with `command -v <cmd>` via /bin/sh -c is acceptable here ONLY because
  // `command` is read from claude-integrations.json (operator-controlled config), never
  // from user input. We pass it as a single argv element so no shell metachars are
  // interpolated by us.
  if (command.startsWith('/') || command.startsWith('./') || command.startsWith('../')) {
    // Absolute / relative path — `which`-style check is just access check.
    const { access } = await import('node:fs/promises');
    try { await access(command); return true; } catch { return false; }
  }
  try {
    await withTimeout(runFile('/bin/sh', ['-c', `command -v -- "$0"`, command]), PROBE_TIMEOUT_MS, 'mcp.stdio');
    return true;
  } catch {
    return false;
  }
}

async function probeMcp(name: string): Promise<ProbeResult> {
  const at = new Date().toISOString();
  const server = discoverMcpServers().find((s) => s.name === name);
  if (!server) return { status: 'disconnected', last_check_at: at, error_message: 'unknown server' };
  if (server.enabled === false) return { status: 'disconnected', last_check_at: at, error_message: 'disabled' };
  try {
    if (server.type === 'http' && server.url) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
      try {
        const res = await fetch(server.url, { method: 'HEAD', signal: ctrl.signal });
        return { status: res.ok || res.status < 500 ? 'connected' : 'degraded', last_check_at: at };
      } finally { clearTimeout(t); }
    }
    if (server.type === 'stdio' && server.command) {
      const ok = await commandExists(server.command);
      if (!ok) return { status: 'disconnected', last_check_at: at, error_message: `command not found: ${server.command}` };
      return { status: 'connected', last_check_at: at };
    }
    return { status: 'degraded', last_check_at: at, error_message: 'unknown transport' };
  } catch (err) {
    return { status: 'disconnected', last_check_at: at, error_message: String((err as Error).message ?? err) };
  }
}

async function probeComposio(slug: string): Promise<ProbeResult> {
  const at = new Date().toISOString();
  if (!composio.isComposioEnabled()) {
    return { status: 'disconnected', last_check_at: at, error_message: 'composio disabled (no COMPOSIO_API_KEY)' };
  }
  try {
    const toolkits = await withTimeout(composio.listConnectedToolkits(), PROBE_TIMEOUT_MS, 'composio.list');
    const tk = toolkits.find((t) => t.slug === slug);
    if (!tk) return { status: 'disconnected', last_check_at: at, error_message: 'not connected' };
    if (tk.status === 'ACTIVE') return { status: 'connected', last_check_at: at };
    return { status: 'degraded', last_check_at: at, error_message: `composio status: ${tk.status}` };
  } catch (err) {
    // Sanitise: never echo back env var values.
    const apiKey = process.env.COMPOSIO_API_KEY;
    let msg = String((err as Error).message ?? err);
    if (apiKey) msg = msg.split(apiKey).join('***');
    return { status: 'disconnected', last_check_at: at, error_message: msg };
  }
}

async function probeOauth(provider: string): Promise<ProbeResult> {
  const at = new Date().toISOString();
  // Lexi defers to upstream's existing OAuth flows. We surface health via env-var
  // presence here as a coarse check; for richer status (token expiry, API quota), call
  // upstream's /api/salesforce/status etc. when the upstream dashboard is also running.
  const map: Record<string, string[]> = {
    salesforce: ['SF_INSTANCE_URL','SF_CLIENT_ID','SF_CLIENT_SECRET'],
    discord: ['DISCORD_TOKEN'],
    slack: ['SLACK_BOT_TOKEN'],
    gmail: ['GMAIL_CLIENT_ID','GMAIL_CLIENT_SECRET','GMAIL_REFRESH_TOKEN'],
  };
  const required = map[provider] ?? [];
  const missing = required.filter((k) => !(process.env[k] && process.env[k]!.length));
  if (missing.length === required.length) {
    return { status: 'disconnected', last_check_at: at, error_message: `${provider}: not configured` };
  }
  if (missing.length > 0) {
    return { status: 'degraded', last_check_at: at, error_message: `${provider}: missing ${missing.join(', ')}` };
  }
  return { status: 'connected', last_check_at: at };
}

export async function probeConnection(id: string): Promise<ProbeResult> {
  const [kind, ...rest] = id.split(':');
  const name = rest.join(':');
  let result: ProbeResult;
  if (kind === 'mcp') result = await probeMcp(name);
  else if (kind === 'composio') result = await probeComposio(name);
  else if (kind === 'oauth') result = await probeOauth(name);
  else result = { status: 'disconnected', last_check_at: new Date().toISOString(), error_message: `unknown kind: ${kind}` };
  recordCheck(id, result.last_check_at);
  return result;
}

export async function probeAll(connections: Connection[]): Promise<Record<string, ProbeResult>> {
  const out: Record<string, ProbeResult> = {};
  await Promise.all(connections.map(async (c) => { out[c.id] = await probeConnection(c.id); }));
  return out;
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/connections/probe.test.ts` → 6 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/services/probe.ts tests/lexi/connections/probe.test.ts
git commit -m "feat(lexi): per-kind probe service with timeouts and credential sanitisation"
```

---

## Task 5 — `/api/connections/*` routes

**Files:** Create `src/lexi-dashboard/routes/connections.ts`, `tests/lexi/connections/routes.test.ts`. Modify `src/lexi-dashboard/server.ts` to mount the router.

- [ ] **Step 1:** Create `tests/lexi/connections/routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../../../src/agent/mcp-bridge.js', () => ({
  discoverMcpServers: () => [{ name: 'neon', type: 'stdio', command: 'echo', enabled: true }],
  getClaudeIntegrations: () => [],
}));
vi.mock('../../../src/integrations/composio/client.js', () => ({
  isComposioEnabled: () => false,
  listConnectedToolkits: async () => [],
}));

import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

describe('/api/connections routes', () => {
  let server: LexiServer; let baseUrl: string;
  beforeAll(async () => { server = await startLexiServer({ port: 0 }); baseUrl = `http://localhost:${server.port}`; });
  afterAll(async () => { await server.stop(); });

  it('GET /api/connections returns the unified list', async () => {
    const r = await fetch(`${baseUrl}/api/connections`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.connections)).toBe(true);
    expect(body.connections.find((c: { id: string }) => c.id === 'mcp:neon')).toBeTruthy();
  });

  it('POST /api/connections/:id/probe returns updated status', async () => {
    const r = await fetch(`${baseUrl}/api/connections/mcp:neon/probe`, { method: 'POST' });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(['connected','degraded','disconnected']).toContain(body.status);
    expect(body.last_check_at).toBeTruthy();
  });

  it('GET /api/connections/:id/credentials returns masked values only', async () => {
    process.env.SF_CLIENT_SECRET = 'sk-prod-supersecret-9999';
    const r = await fetch(`${baseUrl}/api/connections/oauth:salesforce/credentials`);
    expect(r.status).toBe(200);
    const body = await r.json();
    const blob = JSON.stringify(body);
    expect(blob).not.toContain('supersecret');
    delete process.env.SF_CLIENT_SECRET;
  });

  it('PUT /api/connections/:id/credentials with invalid body returns 400', async () => {
    const r = await fetch(`${baseUrl}/api/connections/oauth:salesforce/credentials`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ not_a_credentials_object: true }),
    });
    expect(r.status).toBe(400);
  });

  it('GET /api/connections/:id/credentials for unknown id returns 404', async () => {
    const r = await fetch(`${baseUrl}/api/connections/mcp:does-not-exist/credentials`);
    expect(r.status).toBe(404);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/connections/routes.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/routes/connections.ts`:

```ts
import { Router, type Request, type Response } from 'express';
import { listConnections } from '../services/connection-registry.js';
import { probeConnection } from '../services/probe.js';
import {
  CREDENTIAL_KEYS,
  maskedCredentialsFor,
  applyCredentials,
} from '../services/credential-store.js';

export function connectionsRouter(): Router {
  const router = Router();

  router.get('/connections', async (_req: Request, res: Response) => {
    try {
      const connections = await listConnections();
      res.json({ connections });
    } catch (err) {
      res.status(500).json({ error: String((err as Error).message ?? err) });
    }
  });

  router.post('/connections/:id/probe', async (req: Request, res: Response) => {
    const id = req.params.id;
    const result = await probeConnection(id);
    res.json({ id, ...result });
  });

  router.get('/connections/:id/credentials', (req: Request, res: Response) => {
    const id = req.params.id;
    if (!CREDENTIAL_KEYS[id]) { res.status(404).json({ error: `no credentials for ${id}` }); return; }
    res.json({ id, credentials: maskedCredentialsFor(id) });
  });

  router.put('/connections/:id/credentials', async (req: Request, res: Response) => {
    const id = req.params.id;
    const keys = CREDENTIAL_KEYS[id];
    if (!keys) { res.status(404).json({ error: `no credentials for ${id}` }); return; }
    const body = req.body as { credentials?: Record<string, string> } | undefined;
    if (!body || typeof body !== 'object' || !body.credentials || typeof body.credentials !== 'object') {
      res.status(400).json({ error: 'body must be { credentials: { KEY: value, ... } }' }); return;
    }
    const updates: Record<string, string> = {};
    const priorEnv: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(body.credentials)) {
      if (!keys.includes(k)) continue; // ignore unknown keys
      if (typeof v !== 'string') { res.status(400).json({ error: `${k} must be a string` }); return; }
      updates[k] = v;
      priorEnv[k] = process.env[k];
      // Mirror into process.env so probeConnection sees the new value immediately.
      process.env[k] = v;
    }
    const txn = applyCredentials(updates);
    const probe = await probeConnection(id);
    if (probe.status === 'disconnected') {
      txn.rollback();
      // Restore prior process.env values so subsequent probes don't see the failed creds.
      for (const [k, prior] of Object.entries(priorEnv)) {
        if (prior === undefined) delete process.env[k]; else process.env[k] = prior;
      }
      res.status(400).json({ id, status: probe.status, error: probe.error_message ?? 'probe failed; rolled back' });
      return;
    }
    res.json({ id, status: probe.status, credentials: maskedCredentialsFor(id) });
  });

  return router;
}
```

- [ ] **Step 4:** Edit `src/lexi-dashboard/server.ts` — add the router. Insert after `app.use('/assets', ...)`:

```ts
import express from 'express';
// ...existing imports
import { connectionsRouter } from './routes/connections.js';

// inside startLexiServer, after existing middleware:
app.use(express.json());
app.use('/api', connectionsRouter());
```

(If `express.json()` is already mounted by an earlier plan, do not duplicate it.)

- [ ] **Step 5:** `npm run build && npm test -- tests/lexi/connections/routes.test.ts` → 5 PASS.
- [ ] **Step 6:** Commit:

```bash
git add src/lexi-dashboard/routes/connections.ts src/lexi-dashboard/server.ts tests/lexi/connections/routes.test.ts
git commit -m "feat(lexi): /api/connections list, probe, credentials read+update routes"
```

---

## Task 6 — `lexi-mcp-server-card` + `lexi-credential-editor` + `lexi-oauth-status` components

**Files:** Create `src/lexi-dashboard/ui/components/connections/{lexi-mcp-server-card,lexi-credential-editor,lexi-oauth-status}.ts`. Create `tests/lexi/connections/{mcp-card,credential-editor,oauth-status}.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/connections/mcp-card.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/connections/lexi-mcp-server-card.js');
});

describe('lexi-mcp-server-card', () => {
  it('renders name, status dot, tool count, and action buttons', async () => {
    document.body.replaceChildren();
    const el = document.createElement('lexi-mcp-server-card') as HTMLElement & { connection: unknown };
    (el as unknown as { connection: object }).connection = {
      id: 'mcp:neon', kind: 'mcp', name: 'neon', status: 'connected',
      tool_count: 12, last_check_at: '2026-05-02T12:00:00Z',
    };
    document.body.appendChild(el);
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.textContent).toContain('neon');
    expect(el.textContent).toContain('12');
    expect(el.querySelector('[data-action="probe"]')).toBeTruthy();
    expect(el.querySelector('[data-action="edit"]')).toBeTruthy();
    expect(el.querySelector('[data-action="view-tools"]')).toBeTruthy();
    expect(el.querySelector('[data-status="connected"]')).toBeTruthy();
  });

  it('renders the error_message when status is disconnected', async () => {
    document.body.replaceChildren();
    const el = document.createElement('lexi-mcp-server-card') as HTMLElement & { connection: unknown };
    (el as unknown as { connection: object }).connection = {
      id: 'mcp:bad', kind: 'mcp', name: 'bad', status: 'disconnected',
      tool_count: 0, last_check_at: '2026-05-02T12:00:00Z', error_message: 'command not found',
    };
    document.body.appendChild(el);
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.textContent).toContain('command not found');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/connections/mcp-card.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/connections/lexi-mcp-server-card.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

interface Connection {
  id: string; kind: 'mcp' | 'composio' | 'oauth'; name: string;
  status: 'connected' | 'degraded' | 'disconnected';
  tool_count: number; last_check_at: string | null; error_message?: string;
}

@customElement('lexi-mcp-server-card')
export class LexiMcpServerCard extends LitElement {
  @property({ attribute: false }) connection!: Connection;

  protected createRenderRoot() { return this; }

  private dot(status: string): string {
    if (status === 'connected') return 'var(--success)';
    if (status === 'degraded') return 'var(--warning)';
    return 'var(--danger)';
  }

  private emit(action: string) {
    this.dispatchEvent(new CustomEvent('card-action', { detail: { id: this.connection.id, action }, bubbles: true, composed: true }));
  }

  render() {
    const c = this.connection;
    if (!c) return html``;
    return html`
      <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-surface)">
        <span data-status="${c.status}" style="width:8px;height:8px;border-radius:50%;background:${this.dot(c.status)}"></span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--text-primary)">${c.name}</div>
          <div style="font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace">
            ${c.tool_count} tool${c.tool_count === 1 ? '' : 's'} · ${c.last_check_at ?? 'never probed'}
          </div>
          ${c.error_message ? html`<div style="font-size:11px;color:var(--danger);margin-top:4px">${c.error_message}</div>` : null}
        </div>
        <button data-action="probe" @click=${() => this.emit('probe')} style="background:transparent;border:1px solid var(--border-default);color:var(--text-primary);padding:4px 10px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Probe</button>
        <button data-action="edit" @click=${() => this.emit('edit')} style="background:transparent;border:1px solid var(--border-default);color:var(--text-primary);padding:4px 10px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Edit</button>
        <button data-action="view-tools" @click=${() => this.emit('view-tools')} style="background:transparent;border:1px solid var(--border-default);color:var(--text-primary);padding:4px 10px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Tools</button>
      </div>
    `;
  }
}
```

- [ ] **Step 4:** Create `tests/lexi/connections/credential-editor.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/connections/lexi-credential-editor.js');
});

describe('lexi-credential-editor', () => {
  function mount(): HTMLElement {
    document.body.replaceChildren();
    const el = document.createElement('lexi-credential-editor') as HTMLElement & { credentials: unknown };
    (el as unknown as { credentials: object }).credentials = { API_KEY: 'sk***1234', EMPTY: null };
    document.body.appendChild(el);
    return el;
  }

  it('renders one password input per credential key', async () => {
    const el = mount();
    await new Promise((r) => requestAnimationFrame(r));
    const inputs = el.querySelectorAll('input[type="password"], input[type="text"][data-key]');
    expect(inputs.length).toBe(2);
  });

  it('toggles input type when show/hide is clicked', async () => {
    const el = mount();
    await new Promise((r) => requestAnimationFrame(r));
    const toggle = el.querySelector('[data-toggle="API_KEY"]') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    toggle.click();
    await new Promise((r) => requestAnimationFrame(r));
    const input = el.querySelector('input[data-key="API_KEY"]') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('emits credential-save with only changed keys on save', async () => {
    const el = mount();
    let captured: unknown = null;
    el.addEventListener('credential-save', (ev: Event) => { captured = (ev as CustomEvent).detail; });
    await new Promise((r) => requestAnimationFrame(r));
    const input = el.querySelector('input[data-key="API_KEY"]') as HTMLInputElement;
    input.value = 'sk-new-value-aaaa';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    (el.querySelector('[data-action="save"]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    expect(captured).toEqual({ credentials: { API_KEY: 'sk-new-value-aaaa' } });
  });
});
```

- [ ] **Step 5:** `npm test -- tests/lexi/connections/credential-editor.test.ts` → fail.
- [ ] **Step 6:** Create `src/lexi-dashboard/ui/components/connections/lexi-credential-editor.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('lexi-credential-editor')
export class LexiCredentialEditor extends LitElement {
  @property({ attribute: false }) credentials: Record<string, string | null> = {};
  @property({ type: String }) validationStatus: 'idle' | 'saving' | 'ok' | 'error' = 'idle';
  @state() private revealed: Record<string, boolean> = {};
  @state() private edits: Record<string, string> = {};

  protected createRenderRoot() { return this; }

  private onInput(key: string, ev: Event) {
    this.edits = { ...this.edits, [key]: (ev.target as HTMLInputElement).value };
  }

  private onSave() {
    if (Object.keys(this.edits).length === 0) return;
    this.dispatchEvent(new CustomEvent('credential-save', {
      detail: { credentials: { ...this.edits } },
      bubbles: true, composed: true,
    }));
  }

  private onCancel() {
    this.edits = {};
    this.dispatchEvent(new CustomEvent('credential-cancel', { bubbles: true, composed: true }));
  }

  private toggle(key: string) {
    this.revealed = { ...this.revealed, [key]: !this.revealed[key] };
  }

  render() {
    const keys = Object.keys(this.credentials);
    const indicator = this.validationStatus === 'saving' ? '…'
      : this.validationStatus === 'ok' ? '✓'
      : this.validationStatus === 'error' ? '✗' : '';
    const indicatorColor = this.validationStatus === 'ok' ? 'var(--success)'
      : this.validationStatus === 'error' ? 'var(--danger)' : 'var(--text-tertiary)';
    return html`
      <div style="display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-elevated)">
        ${keys.map((k) => {
          const placeholder = this.credentials[k] ?? '(unset)';
          const revealed = this.revealed[k];
          return html`
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary)">
              <span style="width:160px;font-family:'JetBrains Mono',monospace">${k}</span>
              <input
                data-key="${k}"
                type="${revealed ? 'text' : 'password'}"
                placeholder="${placeholder}"
                .value=${this.edits[k] ?? ''}
                @input=${(e: Event) => this.onInput(k, e)}
                style="flex:1;background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-default);border-radius:6px;padding:4px 8px;font:inherit;font-size:12px"
              />
              <button data-toggle="${k}" type="button" @click=${() => this.toggle(k)}
                style="background:transparent;border:1px solid var(--border-default);color:var(--text-secondary);padding:2px 8px;border-radius:6px;font:inherit;font-size:11px;cursor:pointer">
                ${revealed ? 'hide' : 'show'}
              </button>
            </label>
          `;
        })}
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <span style="color:${indicatorColor};font-family:'JetBrains Mono',monospace;font-size:14px;width:16px">${indicator}</span>
          <span style="flex:1"></span>
          <button data-action="cancel" type="button" @click=${() => this.onCancel()}
            style="background:transparent;border:1px solid var(--border-default);color:var(--text-secondary);padding:4px 12px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Cancel</button>
          <button data-action="save" type="button" @click=${() => this.onSave()}
            style="background:var(--accent);border:1px solid var(--accent);color:#fff;padding:4px 12px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Save</button>
        </div>
      </div>
    `;
  }
}
```

- [ ] **Step 7:** Create `tests/lexi/connections/oauth-status.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/connections/lexi-oauth-status.js');
});

describe('lexi-oauth-status', () => {
  function mount(connection: object): HTMLElement {
    document.body.replaceChildren();
    const el = document.createElement('lexi-oauth-status') as HTMLElement & { connection: unknown };
    (el as unknown as { connection: object }).connection = connection;
    document.body.appendChild(el);
    return el;
  }

  it('shows a Re-auth button when status is degraded or disconnected', async () => {
    const el = mount({ id: 'oauth:salesforce', kind: 'oauth', name: 'Salesforce', status: 'disconnected', tool_count: 0, last_check_at: null });
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.querySelector('[data-action="reauth"]')).toBeTruthy();
  });

  it('hides Re-auth button when status is connected', async () => {
    const el = mount({ id: 'oauth:salesforce', kind: 'oauth', name: 'Salesforce', status: 'connected', tool_count: 0, last_check_at: '2026-05-02T12:00:00Z' });
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.querySelector('[data-action="reauth"]')).toBeNull();
  });

  it('emits oauth-reauth with provider id when re-auth clicked', async () => {
    const el = mount({ id: 'oauth:gmail', kind: 'oauth', name: 'Gmail', status: 'disconnected', tool_count: 0, last_check_at: null });
    let captured: unknown = null;
    el.addEventListener('oauth-reauth', (ev: Event) => { captured = (ev as CustomEvent).detail; });
    await new Promise((r) => requestAnimationFrame(r));
    (el.querySelector('[data-action="reauth"]') as HTMLButtonElement).click();
    expect(captured).toEqual({ id: 'oauth:gmail', provider: 'gmail' });
  });
});
```

- [ ] **Step 8:** `npm test -- tests/lexi/connections/oauth-status.test.ts` → fail.
- [ ] **Step 9:** Create `src/lexi-dashboard/ui/components/connections/lexi-oauth-status.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

interface Connection {
  id: string; kind: 'mcp' | 'composio' | 'oauth'; name: string;
  status: 'connected' | 'degraded' | 'disconnected';
  tool_count: number; last_check_at: string | null; error_message?: string;
}

@customElement('lexi-oauth-status')
export class LexiOauthStatus extends LitElement {
  @property({ attribute: false }) connection!: Connection;

  protected createRenderRoot() { return this; }

  private dotColor(status: string): string {
    if (status === 'connected') return 'var(--success)';
    if (status === 'degraded') return 'var(--warning)';
    return 'var(--danger)';
  }

  private onReauth() {
    const provider = this.connection.id.split(':')[1];
    this.dispatchEvent(new CustomEvent('oauth-reauth', { detail: { id: this.connection.id, provider }, bubbles: true, composed: true }));
  }

  render() {
    const c = this.connection;
    if (!c) return html``;
    const needsReauth = c.status !== 'connected';
    return html`
      <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-surface)">
        <span style="width:8px;height:8px;border-radius:50%;background:${this.dotColor(c.status)}"></span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--text-primary)">${c.name}</div>
          <div style="font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace">
            OAuth · ${c.last_check_at ?? 'never probed'}
          </div>
          ${c.error_message ? html`<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${c.error_message}</div>` : null}
        </div>
        ${needsReauth ? html`
          <button data-action="reauth" type="button" @click=${() => this.onReauth()}
            style="background:var(--accent);border:1px solid var(--accent);color:#fff;padding:4px 12px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Re-auth</button>
        ` : null}
      </div>
    `;
  }
}
```

- [ ] **Step 10:** `npm test -- tests/lexi/connections/{mcp-card,credential-editor,oauth-status}.test.ts` → all PASS.
- [ ] **Step 11:** Commit:

```bash
git add src/lexi-dashboard/ui/components/connections/ tests/lexi/connections/{mcp-card,credential-editor,oauth-status}.test.ts
git commit -m "feat(lexi): connection card, credential editor, oauth status components"
```

---

## Task 7 — `lexi-connections-view`: master/detail with filters and bulk probe

**Files:** Create `src/lexi-dashboard/ui/components/connections/lexi-connections-view.ts`, `tests/lexi/connections/view.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/connections/view.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/connections/lexi-connections-view.js');
});

const fixture = {
  connections: [
    { id: 'mcp:neon', kind: 'mcp', name: 'neon', status: 'connected', tool_count: 5, last_check_at: '2026-05-02T12:00:00Z' },
    { id: 'composio:gmail', kind: 'composio', name: 'gmail', status: 'degraded', tool_count: 0, last_check_at: null },
    { id: 'oauth:salesforce', kind: 'oauth', name: 'Salesforce', status: 'disconnected', tool_count: 0, last_check_at: null },
  ],
};

function mockFetchOk(body: unknown) {
  globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => body } as unknown as Response)) as typeof fetch;
}

describe('lexi-connections-view', () => {
  it('fetches /api/connections on connect and renders one row per connection', async () => {
    mockFetchOk(fixture);
    document.body.replaceChildren();
    const el = document.createElement('lexi-connections-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 20));
    await new Promise((r) => requestAnimationFrame(r));
    const rows = el.querySelectorAll('[data-connection-id]');
    expect(rows.length).toBe(3);
  });

  it('filters by kind when a kind filter is active', async () => {
    mockFetchOk(fixture);
    document.body.replaceChildren();
    const el = document.createElement('lexi-connections-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 20));
    (el.querySelector('[data-filter-kind="mcp"]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const rows = el.querySelectorAll('[data-connection-id]');
    expect(rows.length).toBe(1);
    expect(rows[0].getAttribute('data-connection-id')).toBe('mcp:neon');
  });

  it('filters by status', async () => {
    mockFetchOk(fixture);
    document.body.replaceChildren();
    const el = document.createElement('lexi-connections-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 20));
    (el.querySelector('[data-filter-status="disconnected"]') as HTMLButtonElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const rows = el.querySelectorAll('[data-connection-id]');
    expect(rows.length).toBe(1);
    expect(rows[0].getAttribute('data-connection-id')).toBe('oauth:salesforce');
  });

  it('clicking a row opens the detail panel for that connection', async () => {
    mockFetchOk(fixture);
    document.body.replaceChildren();
    const el = document.createElement('lexi-connections-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 20));
    (el.querySelector('[data-connection-id="mcp:neon"]') as HTMLElement).click();
    await new Promise((r) => requestAnimationFrame(r));
    const detail = el.querySelector('[data-detail-id]');
    expect(detail?.getAttribute('data-detail-id')).toBe('mcp:neon');
  });

  it('bulk probe button issues one POST per connection', async () => {
    let probes = 0;
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (init?.method === 'POST' && u.includes('/probe')) { probes += 1; return { ok: true, status: 200, json: async () => ({ status: 'connected' }) } as unknown as Response; }
      return { ok: true, status: 200, json: async () => fixture } as unknown as Response;
    }) as typeof fetch;
    document.body.replaceChildren();
    const el = document.createElement('lexi-connections-view');
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 20));
    (el.querySelector('[data-action="probe-all"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 30));
    expect(probes).toBe(3);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/connections/view.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/connections/lexi-connections-view.ts`:

```ts
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './lexi-mcp-server-card.js';
import './lexi-credential-editor.js';
import './lexi-oauth-status.js';

interface Connection {
  id: string; kind: 'mcp' | 'composio' | 'oauth'; name: string;
  status: 'connected' | 'degraded' | 'disconnected';
  tool_count: number; last_check_at: string | null; error_message?: string;
}

type KindFilter = 'all' | 'mcp' | 'composio' | 'oauth';
type StatusFilter = 'all' | 'connected' | 'degraded' | 'disconnected';

@customElement('lexi-connections-view')
export class LexiConnectionsView extends LitElement {
  @state() private connections: Connection[] = [];
  @state() private kindFilter: KindFilter = 'all';
  @state() private statusFilter: StatusFilter = 'all';
  @state() private selectedId: string | null = null;
  @state() private selectedCredentials: Record<string, string | null> | null = null;
  @state() private validationStatus: 'idle' | 'saving' | 'ok' | 'error' = 'idle';

  protected createRenderRoot() { return this; }

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
  }

  private async refresh() {
    const r = await fetch('/api/connections');
    if (!r.ok) return;
    const body = await r.json();
    this.connections = body.connections ?? [];
  }

  private async select(id: string) {
    this.selectedId = id;
    this.selectedCredentials = null;
    const r = await fetch(`/api/connections/${encodeURIComponent(id)}/credentials`);
    if (r.ok) {
      const body = await r.json();
      this.selectedCredentials = body.credentials ?? {};
    } else {
      this.selectedCredentials = {};
    }
  }

  private async probe(id: string) {
    await fetch(`/api/connections/${encodeURIComponent(id)}/probe`, { method: 'POST' });
    await this.refresh();
  }

  private async probeAll() {
    await Promise.all(this.filtered().map((c) => fetch(`/api/connections/${encodeURIComponent(c.id)}/probe`, { method: 'POST' })));
    await this.refresh();
  }

  private async saveCredentials(id: string, credentials: Record<string, string>) {
    this.validationStatus = 'saving';
    const r = await fetch(`/api/connections/${encodeURIComponent(id)}/credentials`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credentials }),
    });
    this.validationStatus = r.ok ? 'ok' : 'error';
    if (r.ok) {
      const body = await r.json();
      this.selectedCredentials = body.credentials ?? this.selectedCredentials;
      await this.refresh();
    }
  }

  private filtered(): Connection[] {
    return this.connections.filter((c) =>
      (this.kindFilter === 'all' || c.kind === this.kindFilter) &&
      (this.statusFilter === 'all' || c.status === this.statusFilter)
    );
  }

  render() {
    const kinds: KindFilter[] = ['all','mcp','composio','oauth'];
    const statuses: StatusFilter[] = ['all','connected','degraded','disconnected'];
    const filtered = this.filtered();
    const selected = this.connections.find((c) => c.id === this.selectedId) ?? null;
    const buttonStyle = (active: boolean) => `background:${active ? 'var(--accent)' : 'transparent'};border:1px solid ${active ? 'var(--accent)' : 'var(--border-default)'};color:${active ? '#fff' : 'var(--text-secondary)'};padding:4px 10px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer`;
    return html`
      <div style="display:grid;grid-template-columns:1fr 360px;gap:16px;height:100%">
        <section>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
            <span style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.6px">Kind</span>
            ${kinds.map((k) => html`<button data-filter-kind="${k}" type="button" @click=${() => (this.kindFilter = k)} style=${buttonStyle(this.kindFilter === k)}>${k}</button>`)}
            <span style="width:12px"></span>
            <span style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.6px">Status</span>
            ${statuses.map((s) => html`<button data-filter-status="${s}" type="button" @click=${() => (this.statusFilter = s)} style=${buttonStyle(this.statusFilter === s)}>${s}</button>`)}
            <span style="flex:1"></span>
            <button data-action="probe-all" type="button" @click=${() => this.probeAll()} style="background:var(--bg-elevated);border:1px solid var(--border-default);color:var(--text-primary);padding:4px 12px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer">Probe all</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${filtered.map((c) => html`
              <div data-connection-id="${c.id}" @click=${() => this.select(c.id)} style="cursor:pointer">
                ${c.kind === 'oauth'
                  ? html`<lexi-oauth-status .connection=${c}></lexi-oauth-status>`
                  : html`<lexi-mcp-server-card .connection=${c} @card-action=${(ev: CustomEvent) => { if (ev.detail.action === 'probe') void this.probe(c.id); else void this.select(c.id); }}></lexi-mcp-server-card>`}
              </div>
            `)}
            ${filtered.length === 0 ? html`<div style="color:var(--text-tertiary);font-size:12px;padding:24px;text-align:center">No connections match the current filters.</div>` : null}
          </div>
        </section>
        <aside>
          ${selected ? html`
            <div data-detail-id="${selected.id}" style="display:flex;flex-direction:column;gap:12px">
              <div style="font-size:13px;color:var(--text-primary);font-weight:600">${selected.name}</div>
              <div style="font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace">${selected.id}</div>
              ${this.selectedCredentials ? html`
                <lexi-credential-editor
                  .credentials=${this.selectedCredentials}
                  validationStatus=${this.validationStatus}
                  @credential-save=${(ev: CustomEvent) => this.saveCredentials(selected.id, ev.detail.credentials)}
                ></lexi-credential-editor>
              ` : html`<div style="color:var(--text-tertiary);font-size:12px">Loading credentials…</div>`}
            </div>
          ` : html`<div style="color:var(--text-tertiary);font-size:12px">Select a connection to view details.</div>`}
        </aside>
      </div>
    `;
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/connections/view.test.ts` → 5 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/components/connections/lexi-connections-view.ts tests/lexi/connections/view.test.ts
git commit -m "feat(lexi): connections master/detail view with filters and bulk probe"
```

---

## Task 8 — Wire view into the shell + smoke test

**Files:** Modify `src/lexi-dashboard/ui/components/lexi-app.ts` (or the section router added in Plan 3) to mount `lexi-connections-view` when `#/connections` is active. If a section router doesn't exist yet, add a hash-based switch in `lexi-app.ts` for the `connections` route only.

- [ ] **Step 1:** In `src/lexi-dashboard/ui/components/lexi-app.ts`, add an import:

```ts
import './connections/lexi-connections-view.js';
```

(adjust path if a sibling components folder owns the connections components; if Plan 3+ has already structured a router, register the route there instead).

- [ ] **Step 2:** In `lexi-app.ts`, add a hash-based route switch so `#/connections` renders the view. Inside the class:

```ts
@state() private route = (window.location.hash || '#/home').slice(2);
connectedCallback() {
  super.connectedCallback();
  window.addEventListener('hashchange', () => { this.route = (window.location.hash || '#/home').slice(2); });
}
// inside render(), replace the welcome block in <main> with:
${this.route === 'connections'
  ? html`<lexi-connections-view></lexi-connections-view>`
  : html`<h1 style="margin:0 0 8px 0;font-size:28px;font-weight:600">Welcome to Lexi</h1><p style="color:var(--text-secondary)">Sections will be wired in Plans 3-7.</p>`}
```

(If a later plan introduces a real router, drop this hash switch and register the route there.)

- [ ] **Step 3:** Build and start:

```bash
npm run build
LEXI_PORT=3032 node dist/cli/index.js lexi dashboard &
sleep 1
curl -s http://localhost:3032/api/connections | head -c 200
kill %1
```

Expect a JSON array of connections.

- [ ] **Step 4:** Open `http://localhost:3032/#/connections` in the browser (manual smoke). Verify:
  - List renders with at least one MCP server, optionally Composio toolkits, and the four OAuth providers.
  - Status dots are coloured per `--success` / `--warning` / `--danger`.
  - Clicking "Probe" updates the row's `last_check_at` within ~1s.
  - Clicking a row opens the detail panel; credential fields render as masked placeholders, never with real values.
  - "Probe all" runs concurrently and refreshes the list once.
  - Editing a credential and clicking Save: sees a `…` indicator, then `✓` on success or `✗` on probe failure (rolled back).
- [ ] **Step 5:** `npm run build && npm test -- tests/lexi/connections/` → all green.
- [ ] **Step 6:** Verify upstream-clean: `git fetch upstream && git diff upstream/main..HEAD --name-only | sort` → no upstream files modified by Plan 5 (only the additive `package.json` / `src/cli/index.ts` edits introduced by Plan 1 should still appear).
- [ ] **Step 7:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-app.ts
git commit -m "feat(lexi): mount connections view at #/connections"
```

---

## Definition of done for Plan 5

- [ ] All 8 tasks committed with conventional messages
- [ ] `npm test -- tests/lexi/connections/` all green
- [ ] `npm run build` succeeds
- [ ] `GET /api/connections` returns a unified list across MCP / Composio / OAuth
- [ ] `POST /api/connections/:id/probe` updates `last_check_at` and `status`
- [ ] `GET /api/connections/:id/credentials` returns ONLY masked values; raw secret never present in any HTTP body or log line
- [ ] `PUT /api/connections/:id/credentials` writes atomically; failed probe rolls back to prior env (both on disk and in `process.env`)
- [ ] `lexi-connections-view` renders the list with kind+status filters, master/detail layout, and a working "Probe all" button
- [ ] `lexi-mcp-server-card`, `lexi-credential-editor`, `lexi-oauth-status` are reusable Lit elements with isolated tests
- [ ] OAuth status reflects env-var presence + uses upstream's existing endpoints/CLI for re-auth (no re-implemented OAuth flow)
- [ ] Probe service uses `execFile` (no shell exec); operator-controlled command strings only
- [ ] `git diff upstream/main..HEAD --name-only` → no upstream files modified by Plan 5

## Hand-off to Plan 6

Plan 6 (Workflows) builds on the same routing pattern (`/api/<resource>` + Lit components) and re-uses the connection registry: the workflow editor needs to know which integrations are healthy before it lets the user pick a tool node. Plan 6 imports `listConnections()` from `src/lexi-dashboard/services/connection-registry.js` to gate the tool palette.
