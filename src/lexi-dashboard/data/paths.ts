/**
 * Single source for all daemon-managed paths.
 * Honors CLEMENTINE_HOME just like upstream so dev/prod environments line up.
 */
import path from 'node:path';
import { homedir } from 'node:os';

export function clementineHome(): string {
  return process.env.CLEMENTINE_HOME ?? path.join(homedir(), '.clementine');
}

export function vaultRoot(): string {
  return path.join(clementineHome(), 'vault');
}

export function memoryDbPath(): string {
  // Upstream's MemoryStore writes to .memory.db at the daemon root.
  return path.join(clementineHome(), '.memory.db');
}

export function graphDbDir(): string {
  return path.join(clementineHome(), '.graph.db');
}

export function lexiStateDir(): string {
  return path.join(clementineHome(), 'lexi');
}

export function agentsDir(): string {
  return path.join(vaultRoot(), '00-System', 'agents');
}

export function cronConfigPath(): string {
  // Upstream stores cron jobs as YAML/JSON in vault. The exact filename is
  // resolved by upstream getCronJobs(); we don't read this directly.
  return path.join(clementineHome(), 'cron.yaml');
}
