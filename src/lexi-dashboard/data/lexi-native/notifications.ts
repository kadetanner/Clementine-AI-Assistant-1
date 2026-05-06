/**
 * Aggregated notifications source — queries multiple data adapters and emits
 * a unified feed. Used by lexi-notifications-drawer.
 */
import { listStuck } from '../from-upstream/cron.js';

export interface Notification {
  id: string;
  tone: 'ok' | 'warn' | 'error' | 'accent';
  title: string;
  body?: string;
  ts: number;
  href?: string;
}

interface StuckJob {
  job?: string;
  reason?: string;
  firstSeenAt?: number;
}

export async function listNotifications(): Promise<Notification[]> {
  const out: Notification[] = [];
  const stuck = (await listStuck()) as StuckJob[];
  for (const job of stuck) {
    out.push({
      id: `cron-stuck:${job.job ?? 'unknown'}`,
      tone: 'warn',
      title: `Cron stuck: ${job.job ?? '(unknown)'}`,
      body: job.reason ?? 'Cron job has stopped progressing',
      ts: job.firstSeenAt ?? Date.now(),
      href: '#/cron',
    });
  }
  // Future phases: failed runs, budget alerts, MCP red dots.
  return out.sort((a, b) => b.ts - a.ts);
}
