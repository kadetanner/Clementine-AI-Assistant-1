import { recordActivity } from './activity-log.js';

export interface RestartResult { slug: string; requested_at: number; status: 'queued' | 'unsupported'; }

type RestartHandler = (slug: string) => Promise<void> | void;
let handler: RestartHandler | null = null;

export function registerRestartHandler(fn: RestartHandler): void { handler = fn; }

export async function requestRestart(slug: string): Promise<RestartResult> {
  recordActivity(slug, { type: 'restart_requested', summary: `restart requested for ${slug}` });
  if (!handler) return { slug, requested_at: Date.now(), status: 'unsupported' };
  await handler(slug);
  recordActivity(slug, { type: 'restart_completed', summary: `restart completed for ${slug}` });
  return { slug, requested_at: Date.now(), status: 'queued' };
}
