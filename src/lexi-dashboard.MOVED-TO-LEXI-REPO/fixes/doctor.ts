import type { Express, Request, Response } from 'express';
import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';

type Status = 'green' | 'yellow' | 'red';
interface Check { name: string; status: Status; message?: string; }

// Paths reflect the ACTUAL clementine layout under ~/.clementine/ as of 2026-05.
// Discovered by inspection — these differ from what the spec originally guessed.
const CLEM_HOME = join(homedir(), '.clementine');
const VAULT = join(CLEM_HOME, 'vault');
const GRAPH_DB_DIR = join(CLEM_HOME, '.graph.db');           // FalkorDB embedded mode lives here; sockets are fdb-*.sock files inside
const LOG_DIR = join(CLEM_HOME, 'logs');
const HEARTBEAT_STATE = join(CLEM_HOME, '.heartbeat_state.json'); // reflects autonomy/agent activity (proxy for "ledger")
const CRON_RUNS_DIR = join(CLEM_HOME, 'cron', 'runs');       // dir mtime advances each tick
const CLAUDE_INTEGRATIONS = join(CLEM_HOME, 'claude-integrations.json'); // canonical integration registry
const LEXI_PORT = Number(process.env.LEXI_PORT ?? '3030');

function findFalkorSocket(): string | null {
  if (!existsSync(GRAPH_DB_DIR)) return null;
  try {
    const entries = readdirSync(GRAPH_DB_DIR);
    const sock = entries.find((f) => f.startsWith('fdb-') && f.endsWith('.sock'));
    return sock ? join(GRAPH_DB_DIR, sock) : null;
  } catch { return null; }
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
  if (!existsSync(CLAUDE_INTEGRATIONS)) {
    return { name: 'mcp_servers', status: 'yellow', message: 'no claude-integrations.json' };
  }
  try {
    const raw = JSON.parse(readFileSync(CLAUDE_INTEGRATIONS, 'utf8')) as Record<string, unknown>;
    // claude-integrations.json holds top-level toolkits + an optional `mcpServers` block.
    const integrationKeys = Object.keys(raw).filter((k) => k !== 'mcpServers');
    const mcpKeys = raw.mcpServers && typeof raw.mcpServers === 'object'
      ? Object.keys(raw.mcpServers as object)
      : [];
    const total = integrationKeys.length + mcpKeys.length;
    if (total === 0) return { name: 'mcp_servers', status: 'yellow', message: 'no integrations configured' };
    return { name: 'mcp_servers', status: 'green', message: `${integrationKeys.length} integrations · ${mcpKeys.length} mcp servers` };
  } catch (e) {
    return { name: 'mcp_servers', status: 'red', message: (e as Error).message };
  }
}

function checkFalkorGraph(): Check {
  const sock = findFalkorSocket();
  if (!sock) {
    if (!existsSync(GRAPH_DB_DIR)) return { name: 'falkordb_graph', status: 'red', message: `${GRAPH_DB_DIR} missing` };
    return { name: 'falkordb_graph', status: 'yellow', message: 'graph dir exists, no live socket (daemon may be down)' };
  }
  return { name: 'falkordb_graph', status: 'green', message: `socket ${sock.split('/').pop()}` };
}

function checkRedisSocket(): Check {
  const sock = findFalkorSocket();
  if (!sock) return { name: 'redis_socket', status: 'yellow', message: 'no fdb-*.sock under .graph.db (clementine daemon down?)' };
  try {
    const s = statSync(sock);
    if (!s.isSocket()) return { name: 'redis_socket', status: 'red', message: 'fdb-*.sock exists but not a socket' };
    return { name: 'redis_socket', status: 'green', message: sock };
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
  // Walk cron/runs/ and use the most recent file mtime.
  // APFS does not advance directory mtime when files inside are merely written-to
  // (only on add/remove), so a long-lived heartbeat file getting appended doesn't
  // bump the dir mtime.
  if (!existsSync(CRON_RUNS_DIR)) {
    return { name: 'cron_last_fire', status: 'yellow', message: `${CRON_RUNS_DIR} missing` };
  }
  let newest = 0;
  try {
    for (const f of readdirSync(CRON_RUNS_DIR)) {
      try {
        const m = statSync(join(CRON_RUNS_DIR, f)).mtimeMs;
        if (m > newest) newest = m;
      } catch { /* skip */ }
    }
  } catch {
    return { name: 'cron_last_fire', status: 'yellow', message: `${CRON_RUNS_DIR} unreadable` };
  }
  if (newest === 0) return { name: 'cron_last_fire', status: 'yellow', message: 'no run files yet' };
  const minutes = (Date.now() - newest) / 60000;
  // Calibrated to realistic install cadence on a solo-dev box where the daemon
  // may sit quiet overnight or across long stretches without intervention.
  // >12h = clearly dead; >90min = sparse; ≤90min = healthy. Cron quietness
  // alone is non-blocking (yellow) per DoD 14 — RED is reserved for evidence
  // the scheduler is wedged outright.
  if (minutes > 720) return { name: 'cron_last_fire', status: 'red', message: `${Math.round(minutes)}m since last fire` };
  if (minutes > 90) return { name: 'cron_last_fire', status: 'yellow', message: `${Math.round(minutes)}m since last fire` };
  return { name: 'cron_last_fire', status: 'green', message: `${Math.round(minutes)}m since last fire` };
}

function checkAutonomyLedger(): Check {
  // The closest equivalent to a continuous "ledger" in the actual clementine layout is
  // .heartbeat_state.json — updated every heartbeat tick by the daemon.
  if (!existsSync(HEARTBEAT_STATE)) return { name: 'autonomy_ledger', status: 'yellow', message: 'no .heartbeat_state.json yet' };
  try {
    const s = statSync(HEARTBEAT_STATE);
    const ageH = (Date.now() - s.mtimeMs) / 3600000;
    if (ageH > 24) return { name: 'autonomy_ledger', status: 'yellow', message: `heartbeat stale ${Math.round(ageH)}h` };
    return { name: 'autonomy_ledger', status: 'green', message: `${(s.size / 1024).toFixed(1)}KB · last heartbeat ${Math.round(ageH * 60)}m ago` };
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
