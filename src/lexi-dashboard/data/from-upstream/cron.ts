/**
 * Cron data source — wraps upstream getCronJobs + Lexi-native stuck-job
 * detection (already implemented in fixes/cron-recovery).
 */

export interface CronJob {
  name: string;
  schedule: string;
  prompt?: string;
  tier?: number;
  enabled?: boolean;
  [k: string]: unknown;
}

export async function listJobs(): Promise<CronJob[]> {
  // Upstream's serializer has the cron list. Use it as the truth.
  // Fall through to upstream proxy/upstream-routes.ts approach.
  try {
    const mod = await import('../../../dashboard/builder/serializer.js');
    const list = (mod as unknown as { listAllForBuilder: () => Array<{ id: string; isCron?: boolean; cron?: CronJob }> }).listAllForBuilder;
    if (typeof list !== 'function') return [];
    const all = list();
    return all.filter((w) => w.isCron && w.cron).map((w) => w.cron as CronJob);
  } catch {
    return [];
  }
}

/** Stuck-job detector backed by Lexi's existing fixes/cron-recovery store. */
export async function listStuck(): Promise<unknown[]> {
  try {
    const mod = await import('../../fixes/cron-recovery.js');
    const fn = (mod as unknown as { loadStuck?: () => { stuck: unknown[] } }).loadStuck;
    if (typeof fn !== 'function') return [];
    const r = fn();
    return Array.isArray(r.stuck) ? r.stuck : [];
  } catch {
    return [];
  }
}
