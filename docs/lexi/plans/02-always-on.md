# Lexi Dashboard — Plan 2: Always-on

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Lexi dashboard a permanent system service that survives crashes and login cycles, surfaces its own health via a `/api/doctor` endpoint, and offers a one-click "Restart Lexi" surface in Settings. Specifically: (1) ship a `/api/doctor` endpoint mirroring the `archon doctor` 9-check pattern, (2) install a `com.lexi.dashboard` LaunchAgent via a one-shot installer script, (3) add the `lexi-doctor-panel` Lit component to the Settings section, (4) add a `/api/restart-self` endpoint that detaches a `launchctl kickstart -k`. This is the operational backbone that satisfies §9 DoD items 12, 13, 14, 16, 17.

**Architecture:** New files only — `src/lexi-dashboard/fixes/` for the doctor + restart endpoints, `src/lexi-dashboard/routes.ts` as a single aggregator that Plan 1's `server.ts` calls once, `src/lexi-dashboard/ui/components/lexi-doctor-panel.ts` as a Lit web component, `scripts/com.lexi.dashboard.plist` as a LaunchAgent template, `scripts/install-lexi-launchd.sh` as the installer. Zero edits to upstream files. One additive line in Plan 1's `server.ts` to call `registerLexiRoutes(app)`.

**Tech Stack:** TypeScript 5+ · Node 20+ · Express 4 · Lit 3 · Vitest (existing) · macOS launchd · bash 3+ · `launchctl bootstrap` / `enable` / `kickstart`.

**Spec reference:** `docs/lexi/specs/2026-05-02-lexi-dashboard-design.md` §7 (doctor + bug fixes), §8 (always-on / launchd), §9 DoD items 12, 13, 14, 16, 17.

**Plan 1 dependency:** This plan assumes Plan 1's `src/lexi-dashboard/server.ts` exists and exports `startLexiServer`. The plan adds ONE line to `server.ts` to import and mount the routes aggregator. That one line is the only Plan-1 file we touch.

---

## Conventions inherited from Plan 1

- **Files:** kebab-case (`lexi-doctor-panel.ts`).
- **Components:** PascalCase Lit elements with `lexi-` prefix.
- **API routes:** `/api/<resource>` (no `/lexi/` prefix; Lexi owns the port).
- **Tests:** `tests/lexi/**/*.test.ts`. Use `execFileSync` (NEVER `execSync`). For DOM tests use `replaceChildren()` + `createElement()` + `appendChild()` (NEVER `innerHTML`).
- **Commits:** conventional (`feat(lexi):`, `fix(lexi):`, `test(lexi):`, `build(lexi):`, `docs(lexi):`).
- **TypeScript paths:** never edit upstream files. Plan 1's two upstream edits (`package.json`, `src/cli/index.ts`) stand. Plan 2 adds zero new upstream edits.

## Decision: routes aggregator

The spec says "extend by importing fix modules and calling them in server.ts (you can add a one-line import + call to server.ts since it's a Plan-1 file, OR introduce a `src/lexi-dashboard/routes.ts` aggregator — pick one and document; suggest the routes.ts approach to keep server.ts stable)."

**Decision: routes.ts aggregator.** Each fix module exports a `register(app)` function. `routes.ts` imports them all and exposes one `registerLexiRoutes(app)` function. `server.ts` gains exactly one import line and one call line. Future plans (Plans 3-7) add more fix modules to `routes.ts` without touching `server.ts` again. This keeps Plan 1's server stable as the parade of `/api/*` endpoints grows.

## File structure (created in this plan)

```
src/lexi-dashboard/
  routes.ts                              ← NEW: aggregator (this plan creates it)
  fixes/
    doctor.ts                            ← NEW: 9-check /api/doctor
    restart-self.ts                      ← NEW: POST /api/restart-self
  ui/
    components/
      lexi-doctor-panel.ts               ← NEW: Settings panel
scripts/
  com.lexi.dashboard.plist               ← NEW: LaunchAgent template
  install-lexi-launchd.sh                ← NEW: installer
tests/lexi/
  doctor.test.ts                         ← NEW
  restart-self.test.ts                   ← NEW
  install-launchd.test.ts                ← NEW
  doctor-panel.test.ts                   ← NEW
  routes.test.ts                         ← NEW
```

**Plan-1 file edited:** `src/lexi-dashboard/server.ts` — exactly two additive lines (one `import`, one call). Zero upstream files edited.

---

## Task 1 — Routes aggregator (TDD)

**Files:** Create `src/lexi-dashboard/routes.ts`, `tests/lexi/routes.test.ts`. Edit `src/lexi-dashboard/server.ts`.

- [ ] **Step 1:** Create `tests/lexi/routes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';

describe('Lexi routes aggregator', () => {
  let server: LexiServer;
  let baseUrl: string;
  beforeAll(async () => {
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });
  afterAll(async () => { await server.stop(); });

  it('mounts /api/doctor (route exists, even before implementation, returns 200 or 5xx not 404)', async () => {
    const res = await fetch(`${baseUrl}/api/doctor`);
    expect(res.status).not.toBe(404);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/routes.test.ts` → expect failure (404 currently).

- [ ] **Step 3:** Create `src/lexi-dashboard/routes.ts`:

```ts
import type { Express } from 'express';
import { register as registerDoctor } from './fixes/doctor.js';
import { register as registerRestartSelf } from './fixes/restart-self.js';

/**
 * Single aggregator for all Lexi /api/* routes.
 *
 * Plan 2 adds: doctor, restart-self.
 * Future plans add more imports + calls below — server.ts never changes again.
 */
export function registerLexiRoutes(app: Express): void {
  registerDoctor(app);
  registerRestartSelf(app);
}
```

- [ ] **Step 4:** Add minimal stub fixes so the import does not crash. Create `src/lexi-dashboard/fixes/doctor.ts`:

```ts
import type { Express } from 'express';

export function register(app: Express): void {
  app.get('/api/doctor', (_req, res) => {
    res.status(501).json({ error: 'not implemented yet' });
  });
}
```

Create `src/lexi-dashboard/fixes/restart-self.ts`:

```ts
import type { Express } from 'express';

export function register(app: Express): void {
  app.post('/api/restart-self', (_req, res) => {
    res.status(501).json({ error: 'not implemented yet' });
  });
}
```

- [ ] **Step 5:** Edit `src/lexi-dashboard/server.ts` — add ONE import line near other imports:

```ts
import { registerLexiRoutes } from './routes.js';
```

And ONE call line inside `startLexiServer`, AFTER `app.use('/assets', ...)` and BEFORE `app.get('/health', ...)`:

```ts
  registerLexiRoutes(app);
```

- [ ] **Step 6:** `npm test -- tests/lexi/routes.test.ts` → PASS (now returns 501, not 404).

- [ ] **Step 7:** Commit:

```bash
git add src/lexi-dashboard/routes.ts src/lexi-dashboard/fixes/doctor.ts src/lexi-dashboard/fixes/restart-self.ts src/lexi-dashboard/server.ts tests/lexi/routes.test.ts
git commit -m "feat(lexi): routes aggregator and stub fix modules"
```

---

## Task 2 — Implement /api/doctor with 9 health checks (TDD)

**Files:** Replace `src/lexi-dashboard/fixes/doctor.ts`. Create `tests/lexi/doctor.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/doctor.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';

describe('GET /api/doctor', () => {
  let server: LexiServer;
  let baseUrl: string;
  beforeAll(async () => {
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });
  afterAll(async () => { await server.stop(); });

  it('returns 200 with checks array of length 9', async () => {
    const res = await fetch(`${baseUrl}/api/doctor`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.checks)).toBe(true);
    expect(body.checks).toHaveLength(9);
  });

  it('every check has name + status (green|yellow|red)', async () => {
    const body = await (await fetch(`${baseUrl}/api/doctor`)).json();
    for (const c of body.checks) {
      expect(typeof c.name).toBe('string');
      expect(['green', 'yellow', 'red']).toContain(c.status);
    }
  });

  it('overall is the worst of all check statuses', async () => {
    const body = await (await fetch(`${baseUrl}/api/doctor`)).json();
    const worst = body.checks.some((c: { status: string }) => c.status === 'red')
      ? 'red'
      : body.checks.some((c: { status: string }) => c.status === 'yellow') ? 'yellow' : 'green';
    expect(body.overall).toBe(worst);
  });

  it('check names cover the 9 spec areas', async () => {
    const body = await (await fetch(`${baseUrl}/api/doctor`)).json();
    const names = body.checks.map((c: { name: string }) => c.name);
    const expected = [
      'process',
      'port',
      'mcp_servers',
      'falkordb_graph',
      'redis_socket',
      'vault_directory',
      'cron_last_fire',
      'autonomy_ledger',
      'log_growth',
    ];
    for (const e of expected) expect(names).toContain(e);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/doctor.test.ts` → fail.

- [ ] **Step 3:** Replace `src/lexi-dashboard/fixes/doctor.ts`:

```ts
import type { Express, Request, Response } from 'express';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

type Status = 'green' | 'yellow' | 'red';
interface Check { name: string; status: Status; message?: string; }

const CLEM_HOME = join(homedir(), '.clementine');
const VAULT = join(CLEM_HOME, 'vault');
const REDIS_SOCK = join(CLEM_HOME, 'falkordb.sock');
const LOG_DIR = join(CLEM_HOME, 'logs');
const AUTONOMY_LEDGER = join(CLEM_HOME, 'autonomy', 'ledger.jsonl');
const CRON_HEARTBEAT = join(CLEM_HOME, 'cron', 'last-fire.json');
const MCP_REGISTRY = join(CLEM_HOME, 'mcp', 'servers.json');
const LEXI_PORT = Number(process.env.LEXI_PORT ?? '3030');

function ageMs(path: string): number | null {
  try { return Date.now() - statSync(path).mtimeMs; } catch { return null; }
}

function checkProcess(): Check {
  const uptimeS = process.uptime();
  if (uptimeS < 1) return { name: 'process', status: 'yellow', message: `uptime ${uptimeS.toFixed(1)}s` };
  return { name: 'process', status: 'green', message: `pid ${process.pid} · uptime ${Math.round(uptimeS)}s` };
}

async function checkPort(): Promise<Check> {
  return new Promise((resolve) => {
    const sock = createConnection({ host: '127.0.0.1', port: LEXI_PORT, timeout: 500 });
    sock.once('connect', () => { sock.destroy(); resolve({ name: 'port', status: 'green', message: `:${LEXI_PORT} reachable` }); });
    sock.once('timeout', () => { sock.destroy(); resolve({ name: 'port', status: 'red', message: `:${LEXI_PORT} timeout` }); });
    sock.once('error', (e) => { sock.destroy(); resolve({ name: 'port', status: 'red', message: `:${LEXI_PORT} ${e.message}` }); });
  });
}

function checkMcpServers(): Check {
  if (!existsSync(MCP_REGISTRY)) return { name: 'mcp_servers', status: 'yellow', message: 'no registry file' };
  try {
    const raw = JSON.parse(readFileSync(MCP_REGISTRY, 'utf8')) as { servers?: Array<{ name: string; status?: string }> };
    const servers = raw.servers ?? [];
    if (servers.length === 0) return { name: 'mcp_servers', status: 'yellow', message: '0 registered' };
    const down = servers.filter((s) => s.status && s.status !== 'connected');
    if (down.length === 0) return { name: 'mcp_servers', status: 'green', message: `${servers.length} connected` };
    if (down.length === servers.length) return { name: 'mcp_servers', status: 'red', message: `${down.length}/${servers.length} down` };
    return { name: 'mcp_servers', status: 'yellow', message: `${down.length}/${servers.length} degraded` };
  } catch (e) {
    return { name: 'mcp_servers', status: 'red', message: (e as Error).message };
  }
}

function checkFalkorGraph(): Check {
  if (!existsSync(REDIS_SOCK)) return { name: 'falkordb_graph', status: 'red', message: 'redis socket missing' };
  return { name: 'falkordb_graph', status: 'green', message: 'graph reachable via socket' };
}

function checkRedisSocket(): Check {
  if (!existsSync(REDIS_SOCK)) return { name: 'redis_socket', status: 'red', message: `${REDIS_SOCK} missing` };
  try {
    const s = statSync(REDIS_SOCK);
    if (!s.isSocket()) return { name: 'redis_socket', status: 'red', message: 'exists but not a socket' };
    return { name: 'redis_socket', status: 'green', message: REDIS_SOCK };
  } catch (e) {
    return { name: 'redis_socket', status: 'red', message: (e as Error).message };
  }
}

function checkVaultDirectory(): Check {
  if (!existsSync(VAULT)) return { name: 'vault_directory', status: 'red', message: `${VAULT} missing` };
  try {
    const s = statSync(VAULT);
    if (!s.isDirectory()) return { name: 'vault_directory', status: 'red', message: 'not a directory' };
    return { name: 'vault_directory', status: 'green', message: VAULT };
  } catch (e) {
    return { name: 'vault_directory', status: 'red', message: (e as Error).message };
  }
}

function checkCronLastFire(): Check {
  const age = ageMs(CRON_HEARTBEAT);
  if (age === null) return { name: 'cron_last_fire', status: 'yellow', message: 'no heartbeat file' };
  const minutes = age / 60000;
  if (minutes > 60) return { name: 'cron_last_fire', status: 'red', message: `${Math.round(minutes)}m since last fire` };
  if (minutes > 15) return { name: 'cron_last_fire', status: 'yellow', message: `${Math.round(minutes)}m since last fire` };
  return { name: 'cron_last_fire', status: 'green', message: `${Math.round(minutes)}m since last fire` };
}

function checkAutonomyLedger(): Check {
  if (!existsSync(AUTONOMY_LEDGER)) return { name: 'autonomy_ledger', status: 'yellow', message: 'no ledger yet' };
  try {
    const s = statSync(AUTONOMY_LEDGER);
    const ageH = (Date.now() - s.mtimeMs) / 3600000;
    if (ageH > 48) return { name: 'autonomy_ledger', status: 'yellow', message: `last write ${Math.round(ageH)}h ago` };
    return { name: 'autonomy_ledger', status: 'green', message: `${(s.size / 1024).toFixed(1)}KB · last write ${Math.round(ageH)}h ago` };
  } catch (e) {
    return { name: 'autonomy_ledger', status: 'red', message: (e as Error).message };
  }
}

function checkLogGrowth(): Check {
  const errLog = join(LOG_DIR, 'lexi-dashboard.err.log');
  if (!existsSync(errLog)) return { name: 'log_growth', status: 'green', message: 'no err log yet' };
  try {
    const s = statSync(errLog);
    const ageM = (Date.now() - s.mtimeMs) / 60000;
    const sizeMB = s.size / 1048576;
    if (sizeMB > 100) return { name: 'log_growth', status: 'red', message: `err log ${sizeMB.toFixed(1)}MB` };
    if (ageM < 1 && sizeMB > 1) return { name: 'log_growth', status: 'yellow', message: `err log growing (${sizeMB.toFixed(1)}MB)` };
    return { name: 'log_growth', status: 'green', message: `err log ${sizeMB.toFixed(2)}MB · ${Math.round(ageM)}m old` };
  } catch (e) {
    return { name: 'log_growth', status: 'red', message: (e as Error).message };
  }
}

function worst(statuses: Status[]): Status {
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('yellow')) return 'yellow';
  return 'green';
}

async function runDoctor(_req: Request, res: Response): Promise<void> {
  const checks: Check[] = [
    checkProcess(),
    await checkPort(),
    checkMcpServers(),
    checkFalkorGraph(),
    checkRedisSocket(),
    checkVaultDirectory(),
    checkCronLastFire(),
    checkAutonomyLedger(),
    checkLogGrowth(),
  ];
  res.json({ checks, overall: worst(checks.map((c) => c.status)) });
}

export function register(app: Express): void {
  app.get('/api/doctor', (req, res) => { void runDoctor(req, res); });
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/doctor.test.ts` → 4 PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/fixes/doctor.ts tests/lexi/doctor.test.ts
git commit -m "feat(lexi): /api/doctor 9-check health endpoint"
```

---

## Task 3 — POST /api/restart-self (TDD)

**Files:** Replace `src/lexi-dashboard/fixes/restart-self.ts`. Create `tests/lexi/restart-self.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/restart-self.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';

describe('POST /api/restart-self', () => {
  let server: LexiServer;
  let baseUrl: string;
  beforeAll(async () => {
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });
  afterAll(async () => { await server.stop(); });

  it('returns 202 with planned label when LEXI_NO_RESTART=1 (test mode)', async () => {
    const prev = process.env.LEXI_NO_RESTART;
    process.env.LEXI_NO_RESTART = '1';
    try {
      const res = await fetch(`${baseUrl}/api/restart-self`, { method: 'POST' });
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.label).toBe('com.lexi.dashboard');
      expect(body.dryRun).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.LEXI_NO_RESTART;
      else process.env.LEXI_NO_RESTART = prev;
    }
  });

  it('does not match GET (only POST is registered)', async () => {
    // Express has no built-in 405; a GET to a path with only POST registered falls through to 404.
    const res = await fetch(`${baseUrl}/api/restart-self`, { method: 'GET' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/restart-self.test.ts` → fail.

- [ ] **Step 3:** Replace `src/lexi-dashboard/fixes/restart-self.ts`:

```ts
import type { Express } from 'express';
import { spawn } from 'node:child_process';

const LABEL = 'com.lexi.dashboard';

export function register(app: Express): void {
  app.post('/api/restart-self', (_req, res) => {
    const dryRun = process.env.LEXI_NO_RESTART === '1';
    const uid = process.getuid?.() ?? 0;
    const target = `gui/${uid}/${LABEL}`;

    if (dryRun) {
      res.status(202).json({ label: LABEL, target, dryRun: true, message: 'restart skipped (LEXI_NO_RESTART=1)' });
      return;
    }

    res.status(202).json({ label: LABEL, target, dryRun: false, message: 'restart queued' });

    // Detach so the running process can be killed by launchctl without
    // killing the child. Give the response 250ms to flush before kicking.
    setTimeout(() => {
      const child = spawn('launchctl', ['kickstart', '-k', target], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    }, 250);
  });
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/restart-self.test.ts` → 2 PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/fixes/restart-self.ts tests/lexi/restart-self.test.ts
git commit -m "feat(lexi): /api/restart-self detached launchctl kickstart"
```

---

## Task 4 — LaunchAgent plist template

**Files:** Create `scripts/com.lexi.dashboard.plist`.

- [ ] **Step 1:** Create `scripts/com.lexi.dashboard.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.lexi.dashboard</string>

  <key>ProgramArguments</key>
  <array>
    <string>__NODE_BIN__</string>
    <string>__REPO_ROOT__/dist/cli/index.js</string>
    <string>lexi</string>
    <string>dashboard</string>
  </array>

  <key>WorkingDirectory</key>
  <string>__REPO_ROOT__</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>LEXI_PORT</key>
    <string>3030</string>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>HOME</key>
    <string>__HOME__</string>
    <key>PATH</key>
    <string>__PATH__</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
    <key>Crashed</key>
    <true/>
  </dict>

  <key>ThrottleInterval</key>
  <integer>3</integer>

  <key>StandardOutPath</key>
  <string>__HOME__/.clementine/logs/lexi-dashboard.out.log</string>

  <key>StandardErrorPath</key>
  <string>__HOME__/.clementine/logs/lexi-dashboard.err.log</string>

  <key>ProcessType</key>
  <string>Interactive</string>
</dict>
</plist>
```

The four placeholders `__NODE_BIN__`, `__REPO_ROOT__`, `__HOME__`, `__PATH__` are rendered by the installer in Task 5.

- [ ] **Step 2:** Verify it parses as valid plist XML:

```bash
plutil -lint scripts/com.lexi.dashboard.plist
```

Expected output: `scripts/com.lexi.dashboard.plist: OK`.

- [ ] **Step 3:** Commit:

```bash
git add scripts/com.lexi.dashboard.plist
git commit -m "feat(lexi): com.lexi.dashboard LaunchAgent plist template"
```

---

## Task 5 — Installer script (TDD)

**Files:** Create `scripts/install-lexi-launchd.sh`, `tests/lexi/install-launchd.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/install-launchd.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, constants } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');
const script = path.join(repoRoot, 'scripts/install-lexi-launchd.sh');

describe('scripts/install-lexi-launchd.sh', () => {
  it('exists and is executable', () => {
    const s = statSync(script);
    expect(s.isFile()).toBe(true);
    // owner-execute bit
    expect((s.mode & constants.S_IXUSR) !== 0).toBe(true);
  });

  it('is bash and has set -euo pipefail', () => {
    const text = readFileSync(script, 'utf8');
    expect(text.startsWith('#!/usr/bin/env bash') || text.startsWith('#!/bin/bash')).toBe(true);
    expect(text).toContain('set -euo pipefail');
  });

  it('references all four template placeholders', () => {
    const text = readFileSync(script, 'utf8');
    expect(text).toContain('__NODE_BIN__');
    expect(text).toContain('__REPO_ROOT__');
    expect(text).toContain('__HOME__');
    expect(text).toContain('__PATH__');
  });

  it('uses the modern launchctl bootstrap/enable/kickstart trio', () => {
    const text = readFileSync(script, 'utf8');
    expect(text).toContain('launchctl bootstrap');
    expect(text).toContain('launchctl enable');
    expect(text).toContain('launchctl kickstart');
  });

  it('curls /health to verify after install', () => {
    const text = readFileSync(script, 'utf8');
    expect(text).toMatch(/curl.*localhost.*\$\{?LEXI_PORT\}?.*\/health/);
  });

  it('passes bash -n syntax check', () => {
    // bash -n parses the script without executing.
    execFileSync('bash', ['-n', script], { cwd: repoRoot });
  });

  it('passes shellcheck if shellcheck is installed', () => {
    let hasShellcheck = false;
    try {
      execFileSync('shellcheck', ['--version'], { stdio: 'pipe' });
      hasShellcheck = true;
    } catch { /* not installed; skip */ }
    if (!hasShellcheck) return;
    execFileSync('shellcheck', ['-x', script], { cwd: repoRoot });
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/install-launchd.test.ts` → fail (script missing).

- [ ] **Step 3:** Create `scripts/install-lexi-launchd.sh`:

```bash
#!/usr/bin/env bash
#
# install-lexi-launchd.sh — installs com.lexi.dashboard LaunchAgent on macOS.
#
# Steps:
#   1. Render scripts/com.lexi.dashboard.plist with current paths
#   2. Copy to ~/Library/LaunchAgents/com.lexi.dashboard.plist
#   3. launchctl bootstrap gui/$UID    (replaces deprecated `load -w`)
#   4. launchctl enable    gui/$UID/com.lexi.dashboard
#   5. launchctl kickstart gui/$UID/com.lexi.dashboard
#   6. curl localhost:$LEXI_PORT/health to verify
#
# Re-runnable: bootstraps idempotently by bootout-then-bootstrap on existing label.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE="$SCRIPT_DIR/com.lexi.dashboard.plist"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET="$TARGET_DIR/com.lexi.dashboard.plist"
LABEL="com.lexi.dashboard"
DOMAIN="gui/$UID"
SERVICE="$DOMAIN/$LABEL"
LEXI_PORT="${LEXI_PORT:-3030}"
LOG_DIR="$HOME/.clementine/logs"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: This installer is macOS-only (launchd)." >&2
  exit 1
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: plist template missing at $TEMPLATE" >&2
  exit 1
fi

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "ERROR: node not found on PATH. Install Node 20+ and retry." >&2
  exit 1
fi

if [[ ! -f "$REPO_ROOT/dist/cli/index.js" ]]; then
  echo "WARN: $REPO_ROOT/dist/cli/index.js not present. Run 'npm run build' first." >&2
fi

mkdir -p "$TARGET_DIR" "$LOG_DIR"

echo "==> Rendering plist"
echo "    NODE_BIN  = $NODE_BIN"
echo "    REPO_ROOT = $REPO_ROOT"
echo "    HOME      = $HOME"
echo "    LEXI_PORT = $LEXI_PORT"

# Render placeholders. Use a temp file then atomic mv.
TMP="$(mktemp -t lexi-plist.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

# Use awk for safe substitution (handles paths with slashes; no sed delimiter games).
awk -v node_bin="$NODE_BIN" \
    -v repo_root="$REPO_ROOT" \
    -v home="$HOME" \
    -v path_env="$PATH" '
{
  gsub(/__NODE_BIN__/, node_bin);
  gsub(/__REPO_ROOT__/, repo_root);
  gsub(/__HOME__/, home);
  gsub(/__PATH__/, path_env);
  print;
}' "$TEMPLATE" > "$TMP"

# Validate the rendered plist before installing.
plutil -lint "$TMP" >/dev/null

mv -f "$TMP" "$TARGET"
trap - EXIT

echo "==> Installed plist to $TARGET"

# Idempotent bootstrap: bootout if already loaded, then bootstrap fresh.
if launchctl print "$SERVICE" >/dev/null 2>&1; then
  echo "==> Existing service found, removing"
  launchctl bootout "$SERVICE" || true
fi

echo "==> launchctl bootstrap $DOMAIN $TARGET"
launchctl bootstrap "$DOMAIN" "$TARGET"

echo "==> launchctl enable $SERVICE"
launchctl enable "$SERVICE"

echo "==> launchctl kickstart $SERVICE"
launchctl kickstart "$SERVICE"

# Give launchd a moment, then verify HTTP.
echo "==> Waiting up to 10s for /health on :$LEXI_PORT"
ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://localhost:${LEXI_PORT}/health" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 1
done

if [[ "$ok" -ne 1 ]]; then
  echo "ERROR: /health did not respond within 10s. Check $LOG_DIR/lexi-dashboard.err.log" >&2
  echo "       launchctl print $SERVICE" >&2
  exit 2
fi

echo "==> /health OK"
echo
launchctl print "$SERVICE" | head -20 || true
echo
echo "Done. com.lexi.dashboard is loaded, enabled, and serving on :${LEXI_PORT}."
echo "Logs: $LOG_DIR/lexi-dashboard.{out,err}.log"
```

- [ ] **Step 4:** `chmod +x scripts/install-lexi-launchd.sh`.

- [ ] **Step 5:** `npm test -- tests/lexi/install-launchd.test.ts` → 7 PASS (shellcheck conditional).

- [ ] **Step 6:** Commit:

```bash
git add scripts/install-lexi-launchd.sh tests/lexi/install-launchd.test.ts
git commit -m "feat(lexi): install-lexi-launchd.sh installer with health verify"
```

---

## Task 6 — lexi-doctor-panel Lit component (TDD)

**Files:** Create `src/lexi-dashboard/ui/components/lexi-doctor-panel.ts`, `tests/lexi/doctor-panel.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/doctor-panel.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../../src/lexi-dashboard/ui/components/lexi-doctor-panel.js');
});

const FAKE_RESPONSE = {
  overall: 'yellow',
  checks: [
    { name: 'process', status: 'green', message: 'pid 1234 · uptime 42s' },
    { name: 'port', status: 'green', message: ':3030 reachable' },
    { name: 'mcp_servers', status: 'yellow', message: '1/3 degraded' },
    { name: 'falkordb_graph', status: 'green', message: 'graph reachable via socket' },
    { name: 'redis_socket', status: 'green', message: '/Users/x/.clementine/falkordb.sock' },
    { name: 'vault_directory', status: 'green', message: '/Users/x/.clementine/vault' },
    { name: 'cron_last_fire', status: 'green', message: '3m since last fire' },
    { name: 'autonomy_ledger', status: 'green', message: '12.4KB · last write 2h ago' },
    { name: 'log_growth', status: 'green', message: 'err log 0.01MB · 4m old' },
  ],
};

function mountPanel(): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-doctor-panel');
  document.body.appendChild(el);
  return el;
}

describe('lexi-doctor-panel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.endsWith('/api/doctor')) {
        return new Response(JSON.stringify(FAKE_RESPONSE), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (typeof url === 'string' && url.endsWith('/api/restart-self') && init?.method === 'POST') {
        return new Response(JSON.stringify({ label: 'com.lexi.dashboard', dryRun: true }), { status: 202 });
      }
      return new Response('not found', { status: 404 });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('registers the custom element', () => {
    expect(customElements.get('lexi-doctor-panel')).toBeDefined();
  });

  it('renders 9 check rows after fetch', async () => {
    mountPanel();
    // initial render: loading state
    await new Promise((r) => requestAnimationFrame(r));
    // wait for fetch microtask + re-render
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
    const rows = document.querySelectorAll('lexi-doctor-panel [data-check]');
    expect(rows.length).toBe(9);
  });

  it('renders coloured dots matching status', async () => {
    mountPanel();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
    const greens = document.querySelectorAll('lexi-doctor-panel [data-check][data-status="green"]');
    const yellows = document.querySelectorAll('lexi-doctor-panel [data-check][data-status="yellow"]');
    const reds = document.querySelectorAll('lexi-doctor-panel [data-check][data-status="red"]');
    expect(greens.length).toBe(8);
    expect(yellows.length).toBe(1);
    expect(reds.length).toBe(0);
  });

  it('Run Doctor button triggers a re-fetch', async () => {
    mountPanel();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
    const before = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    const btn = document.querySelector('lexi-doctor-panel [data-action="run"]') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    const after = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    expect(after).toBeGreaterThan(before);
  });

  it('Restart Lexi button POSTs /api/restart-self', async () => {
    mountPanel();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
    const btn = document.querySelector('lexi-doctor-panel [data-action="restart"]') as HTMLButtonElement;
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const restartCall = calls.find((c) => typeof c[0] === 'string' && (c[0] as string).endsWith('/api/restart-self'));
    expect(restartCall).toBeDefined();
    expect((restartCall![1] as RequestInit | undefined)?.method).toBe('POST');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/doctor-panel.test.ts` → fail.

- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-doctor-panel.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

type Status = 'green' | 'yellow' | 'red';
interface Check { name: string; status: Status; message?: string; }
interface DoctorResponse { overall: Status; checks: Check[]; }

const DOT_COLOR: Record<Status, string> = {
  green: 'var(--success)',
  yellow: 'var(--warning)',
  red: 'var(--danger)',
};

const FRIENDLY_NAMES: Record<string, string> = {
  process: 'Process',
  port: 'Port reachable',
  mcp_servers: 'MCP servers',
  falkordb_graph: 'FalkorDB graph',
  redis_socket: 'Redis socket',
  vault_directory: 'Vault directory',
  cron_last_fire: 'Cron last fire',
  autonomy_ledger: 'Autonomy ledger',
  log_growth: 'Log growth',
};

@customElement('lexi-doctor-panel')
export class LexiDoctorPanel extends LitElement {
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private result: DoctorResponse | null = null;
  @state() private restartMessage: string | null = null;

  protected createRenderRoot() { return this; }

  static styles = css``;

  connectedCallback(): void {
    super.connectedCallback();
    void this.runDoctor();
  }

  private async runDoctor(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const res = await fetch('/api/doctor');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.result = (await res.json()) as DoctorResponse;
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
    }
  }

  private async restart(): Promise<void> {
    this.restartMessage = 'Sending restart...';
    try {
      const res = await fetch('/api/restart-self', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      this.restartMessage = res.status === 202
        ? `Queued (${(body as { dryRun?: boolean }).dryRun ? 'dry run' : 'real'})`
        : `Failed: HTTP ${res.status}`;
    } catch (e) {
      this.restartMessage = `Error: ${(e as Error).message}`;
    }
  }

  private renderChecks() {
    if (!this.result) return null;
    return this.result.checks.map((c) => html`
      <div data-check="${c.name}" data-status="${c.status}"
        style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border-subtle);font-size:13px">
        <span aria-hidden="true"
          style="width:10px;height:10px;border-radius:50%;background:${DOT_COLOR[c.status]};flex:0 0 auto"></span>
        <span style="flex:0 0 160px;color:var(--text-primary)">${FRIENDLY_NAMES[c.name] ?? c.name}</span>
        <span style="color:var(--text-secondary);font-size:12px">${c.message ?? ''}</span>
      </div>
    `);
  }

  render() {
    const overall = this.result?.overall ?? 'green';
    return html`
      <section style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:10px;padding:16px;max-width:680px">
        <header style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <span aria-hidden="true"
            style="width:12px;height:12px;border-radius:50%;background:${DOT_COLOR[overall]}"></span>
          <h3 style="margin:0;font-size:16px;font-weight:600;color:var(--text-primary)">Lexi Doctor</h3>
          <span style="flex:1"></span>
          <button type="button" data-action="run"
            ?disabled=${this.loading}
            @click=${() => void this.runDoctor()}
            style="background:transparent;border:1px solid var(--border-default);color:var(--text-primary);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px">
            ${this.loading ? 'Running...' : 'Run Doctor'}
          </button>
          <button type="button" data-action="restart"
            @click=${() => void this.restart()}
            style="background:var(--accent);border:0;color:white;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px">
            Restart Lexi
          </button>
        </header>

        ${this.error
          ? html`<div style="color:var(--danger);font-size:13px;padding:8px 0">Error: ${this.error}</div>`
          : null}

        <div>${this.renderChecks()}</div>

        ${this.restartMessage
          ? html`<div style="margin-top:12px;font-size:12px;color:var(--text-secondary)">${this.restartMessage}</div>`
          : null}
      </section>
    `;
  }
}
```

- [ ] **Step 4:** `npm run build:lexi && npm test -- tests/lexi/doctor-panel.test.ts` → 5 PASS.

- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-doctor-panel.ts tests/lexi/doctor-panel.test.ts
git commit -m "feat(lexi): lexi-doctor-panel component with run + restart buttons"
```

---

## Task 7 — End-to-end verification on real launchd

> Note: this task touches the live user system (installs a LaunchAgent). Run only when you intend to install Lexi as the always-on dashboard. All previous tasks must be green first.

- [ ] **Step 1:** Build everything:

```bash
npm run build
```

Expected: completes without errors; `dist/cli/index.js` and `dist/lexi-dashboard/ui/main.js` exist.

- [ ] **Step 2:** Run the installer:

```bash
bash scripts/install-lexi-launchd.sh
```

Expected: ends with `==> /health OK` and prints `Done. com.lexi.dashboard is loaded, enabled, and serving on :3030.`

- [ ] **Step 3:** Confirm LaunchAgent registered:

```bash
launchctl print "gui/$UID/com.lexi.dashboard" | grep -E "state|program|last exit"
```

Expected: `state = running`.

- [ ] **Step 4:** Hit the doctor endpoint:

```bash
curl -s http://localhost:3030/api/doctor | jq '{overall, n: (.checks|length)}'
```

Expected: `{ "overall": "green", "n": 9 }` (or `yellow` if MCP/cron files are absent on your machine — both are acceptable for DoD §9.14 on a clean install where some optional files do not exist yet).

- [ ] **Step 5:** Verify auto-restart on kill (DoD §9.13):

```bash
PID=$(launchctl print "gui/$UID/com.lexi.dashboard" | awk '/pid =/ {print $3; exit}')
echo "Killing PID $PID"
kill -9 "$PID"
sleep 4
NEWPID=$(launchctl print "gui/$UID/com.lexi.dashboard" | awk '/pid =/ {print $3; exit}')
echo "New PID: $NEWPID"
test "$NEWPID" != "$PID" -a -n "$NEWPID"
curl -fsS http://localhost:3030/health >/dev/null && echo "OK"
```

Expected: new PID, `OK` printed.

- [ ] **Step 6:** Open `http://localhost:3030/`, navigate to Settings (clicking Settings in the nav rail or `#/settings`), confirm the Doctor Panel renders 9 rows with dots and both buttons work.

  > If Plan 1's Settings panel does not yet route the doctor component into the main area, this is expected — Plan 3+ wires the section views. For Plan 2 verification, open `http://localhost:3030/` with browser devtools console and run:

  ```js
  document.querySelector('main.lexi-main').replaceChildren(document.createElement('lexi-doctor-panel'));
  ```

  to manually mount the panel and verify rendering. Doing this in the console (not in code) keeps Plan 2 scoped to its deliverables.

- [ ] **Step 7:** Verify upstream-clean (DoD §9.16, §9.17):

```bash
git fetch upstream
git diff upstream/main..HEAD --name-only | sort | grep -v "^docs/lexi/" | grep -v "^src/lexi-dashboard/" | grep -v "^scripts/" | grep -v "^tests/lexi/" | grep -v "^bin/lexi$"
```

Expected output (Plan 1's two upstream edits + lockfile):

```
package-lock.json
package.json
src/cli/index.ts
```

No other paths.

- [ ] **Step 8:** Verify zero conflict on a hypothetical upstream merge:

```bash
git merge-tree --write-tree upstream/main HEAD | head -5
```

Expected: a tree hash on the first line, no `<<<<<<<` markers anywhere.

---

## Definition of done for Plan 2

- [ ] All 7 tasks committed (commits 1-6 from tasks 1-6; task 7 is verification only, no commit).
- [ ] `npm test -- tests/lexi/` all green (Plan 1 tests + 5 new Plan 2 test files).
- [ ] `GET /api/doctor` returns 200 with 9 checks, each `{name, status: green|yellow|red, message?}`, plus `overall` matching the worst status.
- [ ] `POST /api/restart-self` returns 202, then schedules a detached `launchctl kickstart -k gui/$UID/com.lexi.dashboard` (skipped under `LEXI_NO_RESTART=1` for tests).
- [ ] `scripts/com.lexi.dashboard.plist` is valid plist XML (`plutil -lint` OK) and has `Label`, `ProgramArguments` (node + dist/cli/index.js + lexi + dashboard), `RunAtLoad=true`, `KeepAlive={SuccessfulExit:false, Crashed:true}`, log paths under `~/.clementine/logs/`, `LEXI_PORT=3030`, `WorkingDirectory=<repo>`.
- [ ] `scripts/install-lexi-launchd.sh` is executable bash, passes `bash -n`, passes `shellcheck` if installed, renders the four placeholders, runs `launchctl bootstrap`, `enable`, `kickstart`, then verifies `/health` over HTTP.
- [ ] `lexi-doctor-panel` Lit component is registered, fetches `/api/doctor` on connect, renders 9 dot+name+message rows, the "Run Doctor" button re-fetches, and "Restart Lexi" POSTs `/api/restart-self`.
- [ ] DoD §9.12: `com.lexi.dashboard` is loaded, enabled, serves /health (verified by Task 7 step 2).
- [ ] DoD §9.13: kill -9 → restart within 3 seconds (verified by Task 7 step 5; `ThrottleInterval=3` in plist).
- [ ] DoD §9.14: doctor endpoint reports green on clean install (verified by Task 7 step 4; yellow acceptable when optional files like MCP registry are absent — green is achievable when all .clementine subsystems are present).
- [ ] DoD §9.16: `git diff upstream/main..HEAD --name-only` shows only the safe paths plus Plan 1's two upstream files (verified by Task 7 step 7).
- [ ] DoD §9.17: `git merge-tree upstream/main HEAD` produces no conflict markers (verified by Task 7 step 8).

## Hand-off to Plan 3

Plan 3 (Live view) will:
- Add the SSE endpoint `/api/events/stream` to `src/lexi-dashboard/fixes/events-stream.ts` and add `registerEventsStream(app)` to `routes.ts` (one new line in `routes.ts`, zero edits to `server.ts`).
- Wire the Settings panel layout so `lexi-doctor-panel` mounts automatically when the Settings section is active (removes the manual `replaceChildren` step from Task 7 step 6).
- Build `lexi-now-playing`, `lexi-system-map`, `lexi-activity-stream` Lit components in `src/lexi-dashboard/ui/components/` that consume the SSE stream.

The routes.ts pattern established in Plan 2 means Plan 3 never touches `server.ts` again.
