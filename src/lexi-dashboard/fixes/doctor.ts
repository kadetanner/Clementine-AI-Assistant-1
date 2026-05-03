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
