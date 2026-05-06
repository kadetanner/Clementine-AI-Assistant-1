/**
 * User pin store — small JSON file at ~/.clementine/lexi/pins.json.
 *
 * Pin types are open-ended (agents, vault paths, cron jobs, memory chunks).
 * Phase 13 ships the API; Phase 20 surfaces pinned items in the command
 * palette and a quick-access strip on Today.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { lexiStateDir } from '../paths.js';

export interface Pin {
  id: string;
  kind: 'agent' | 'cron' | 'vault' | 'memory' | 'other';
  label: string;
  href: string;
  pinnedAt: number;
}

function pinsPath(): string {
  return path.join(lexiStateDir(), 'pins.json');
}

function ensureDir(): void {
  const dir = lexiStateDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function read(): Pin[] {
  try {
    const raw = readFileSync(pinsPath(), 'utf8');
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

function write(pins: Pin[]): void {
  ensureDir();
  writeFileSync(pinsPath(), JSON.stringify(pins, null, 2));
}

export function listPins(): Pin[] {
  return read();
}

export function addPin(pin: Omit<Pin, 'pinnedAt'>): Pin {
  const pins = read();
  const exists = pins.find((p) => p.id === pin.id && p.kind === pin.kind);
  if (exists) return exists;
  const next: Pin = { ...pin, pinnedAt: Date.now() };
  pins.unshift(next);
  write(pins);
  return next;
}

export function removePin(id: string, kind: Pin['kind']): boolean {
  const pins = read();
  const i = pins.findIndex((p) => p.id === id && p.kind === kind);
  if (i < 0) return false;
  pins.splice(i, 1);
  write(pins);
  return true;
}
