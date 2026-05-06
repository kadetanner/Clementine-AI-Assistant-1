import type { Express } from 'express';
import path from 'node:path';
import { homedir } from 'node:os';
import { registerDailyPlan } from './daily-plan.js';
import { registerVoiceSynthesize } from './voice-synthesize.js';
import { registerDigestRoot } from './digest-root.js';
import { registerGoalsRoot } from './goals-root.js';
import { registerCronRecovery } from './cron-recovery.js';
import { getEventBus } from '../events/bus.js';
import { isLexiEventType } from '../events/types.js';

let stopFn: (() => void) | undefined;

/**
 * Plan 8 aggregator: wires the 5 bug-fix endpoints + cron stuck-job detector
 * into the Express app. Reads CLEMENTINE_HOME lazily (inside this function,
 * not at module load) so tests can sandbox it via process.env before calling
 * startLexiServer.
 */
export function register(app: Express): void {
  const baseDir = process.env.CLEMENTINE_HOME ?? path.join(homedir(), '.clementine');
  const bus = getEventBus();
  const emit = (ev: { type: string; ts: number; payload: unknown }): void => {
    if (!isLexiEventType(ev.type)) return;
    try { bus.emit(ev.type, ev.payload); } catch { /* swallow */ }
  };
  registerDailyPlan(app, { baseDir });
  registerVoiceSynthesize(app, { baseDir });
  registerDigestRoot(app, { baseDir });
  registerGoalsRoot(app, { vaultDir: path.join(baseDir, 'vault') });
  stopFn = registerCronRecovery(app, { baseDir, emit });
}

export function stopFixes(): void {
  if (stopFn) { stopFn(); stopFn = undefined; }
}
