import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { discoverMcpServers } from '../agents/mcp-bridge.js';
import * as composio from '../../integrations/composio/client.js';
import { recordCheck, type Connection, type ConnectionStatus } from './connection-registry.js';

// Use execFile (no shell). We never use child_process with a shell here.
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
  // The command name is read from claude-integrations.json (operator-controlled
  // config), never from user input. We pass it as a single argv element so no shell
  // metacharacters are interpolated by us.
  if (command.startsWith('/') || command.startsWith('./') || command.startsWith('../')) {
    // Absolute / relative path — `which`-style check is just an access check.
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
