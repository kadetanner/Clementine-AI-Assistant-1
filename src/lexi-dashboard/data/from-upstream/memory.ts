/**
 * Memory data source — read-only access to the daemon's SQLite + FalkorDB.
 *
 * Per Lighthouse spec §3, Lexi reads daemon state without ever writing. We
 * open the SQLite database with `readonly: true` (better-sqlite3's equivalent
 * of SQLite's `?mode=ro` URI flag). All writes still go through the daemon's
 * MemoryStore. The handle is reopened every 30s so WAL-checkpointed updates
 * from the daemon become visible — better-sqlite3 caches schema across the
 * connection's lifetime, so a too-long-lived handle eventually drifts.
 *
 * `memoryFreshness()` returns mtimes of the .db / -wal / -shm files so the
 * UI can render a "last write was N seconds ago" indicator and warn when
 * Lexi's view may be stale.
 */
import Database from 'better-sqlite3';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { graphDbDir, vaultRoot } from '../paths.js';

const DB_TTL_MS = 30_000;
let dbCache: { db: Database.Database; openedAt: number; path: string } | null = null;

function dbPath(): string {
  // Upstream stores its SQLite at <vault>/.memory.db.
  return path.join(vaultRoot(), '.memory.db');
}

function openReadOnly(): Database.Database | null {
  const p = dbPath();
  if (dbCache && dbCache.path === p && Date.now() - dbCache.openedAt < DB_TTL_MS) {
    return dbCache.db;
  }
  if (dbCache) {
    try { dbCache.db.close(); } catch { /* ignore */ }
    dbCache = null;
  }
  if (!existsSync(p)) return null;
  try {
    const db = new Database(p, { readonly: true, fileMustExist: true });
    dbCache = { db, openedAt: Date.now(), path: p };
    return db;
  } catch {
    return null;
  }
}

/** Test-only: drop the cached handle so the next call reopens. */
export function _resetMemoryHandleForTest(): void {
  if (dbCache) { try { dbCache.db.close(); } catch { /* ignore */ } }
  dbCache = null;
}

export interface MemoryHealth {
  available: boolean;
  chunks: number;
  files: number;
  sizeBytes: number;
  consolidated: number;
  unconsolidated: number;
}

export async function memoryHealth(): Promise<MemoryHealth> {
  const db = openReadOnly();
  if (!db) return { available: false, chunks: 0, files: 0, sizeBytes: 0, consolidated: 0, unconsolidated: 0 };
  try {
    const chunks = (db.prepare('SELECT COUNT(*) AS c FROM chunks').get() as { c: number }).c;
    const files = (db.prepare('SELECT COUNT(DISTINCT source_file) AS c FROM chunks').get() as { c: number }).c;
    const { size } = statSync(dbPath());
    let consolidated = 0;
    try {
      consolidated = (db.prepare('SELECT COUNT(*) AS c FROM chunks WHERE consolidated = 1').get() as { c: number }).c;
    } catch { /* column may not exist on older schemas */ }
    return {
      available: true,
      chunks,
      files,
      sizeBytes: size,
      consolidated,
      unconsolidated: Math.max(0, chunks - consolidated),
    };
  } catch {
    return { available: false, chunks: 0, files: 0, sizeBytes: 0, consolidated: 0, unconsolidated: 0 };
  }
}

export interface MemoryFreshness {
  available: boolean;
  dbMtimeMs: number;
  walMtimeMs: number;
  shmMtimeMs: number;
  /** Milliseconds since the most recent write across .db / -wal / -shm. -1 when unavailable. */
  ageMs: number;
  /** True when the WAL file is more recent than the main DB — a strong signal of pending writes. */
  walAhead: boolean;
}

export function memoryFreshness(): MemoryFreshness {
  const p = dbPath();
  if (!existsSync(p)) return { available: false, dbMtimeMs: 0, walMtimeMs: 0, shmMtimeMs: 0, ageMs: -1, walAhead: false };
  const safeStat = (q: string): number => { try { return statSync(q).mtimeMs; } catch { return 0; } };
  const dbM  = safeStat(p);
  const walM = safeStat(p + '-wal');
  const shmM = safeStat(p + '-shm');
  const newest = Math.max(dbM, walM, shmM);
  return {
    available: true,
    dbMtimeMs: dbM,
    walMtimeMs: walM,
    shmMtimeMs: shmM,
    ageMs: newest > 0 ? Math.max(0, Date.now() - newest) : -1,
    walAhead: walM > dbM,
  };
}

export interface GraphSnapshot {
  available: boolean;
  nodes: number;
  edges: number;
  labels: { label: string; count: number }[];
}

export async function graphSnapshot(): Promise<GraphSnapshot> {
  try {
    const mod = await import('../../../memory/graph-store.js');
    const get = (mod as unknown as { getSharedGraphStore: (dir: string) => Promise<unknown> }).getSharedGraphStore;
    if (!get) return { available: false, nodes: 0, edges: 0, labels: [] };
    const store = (await get(graphDbDir())) as
      | { stats?: () => Promise<GraphSnapshot> }
      | null;
    if (!store) return { available: false, nodes: 0, edges: 0, labels: [] };
    if (typeof store.stats === 'function') {
      const s = await store.stats();
      return { ...s, available: true };
    }
    return { available: true, nodes: 0, edges: 0, labels: [] };
  } catch {
    return { available: false, nodes: 0, edges: 0, labels: [] };
  }
}
