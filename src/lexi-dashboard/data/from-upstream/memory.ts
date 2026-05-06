/**
 * Memory data source — wraps upstream MemoryStore + GraphStore (read-mostly).
 *
 * Per Lighthouse spec §3, Lexi reads daemon's SQLite + FalkorDB. Writes still
 * go through the daemon. Reads through this module are the only place that
 * touches MemoryStore.
 */
import { graphDbDir } from '../paths.js';

interface MemoryStoreLike {
  countChunks?: (...args: unknown[]) => number;
  searchByQuery?: (...args: unknown[]) => unknown[];
}

let memCache: { store: MemoryStoreLike; loadedAt: number } | null = null;

async function importStore(): Promise<MemoryStoreLike | null> {
  try {
    if (memCache && Date.now() - memCache.loadedAt < 60_000) return memCache.store;
    const mod = await import('../../../memory/store.js');
    const Store = (mod as unknown as { MemoryStore: new () => MemoryStoreLike }).MemoryStore;
    if (!Store) return null;
    const store = new Store();
    memCache = { store, loadedAt: Date.now() };
    return store;
  } catch {
    return null;
  }
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
  const store = await importStore();
  if (!store) return { available: false, chunks: 0, files: 0, sizeBytes: 0, consolidated: 0, unconsolidated: 0 };
  // Upstream's MemoryStore exposes a health snapshot via `db()` — but to keep
  // this stable we delegate to whatever the upstream getStore handler returns.
  // (Concrete shape resolved by Phase 15.)
  const counts = (store as unknown as { health?: () => MemoryHealth }).health?.() ?? null;
  if (counts) return counts;
  return { available: true, chunks: 0, files: 0, sizeBytes: 0, consolidated: 0, unconsolidated: 0 };
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
