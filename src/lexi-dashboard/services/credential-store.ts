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
