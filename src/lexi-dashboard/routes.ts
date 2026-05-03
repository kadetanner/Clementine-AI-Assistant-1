import type { Express } from 'express';
import { register as registerDoctor } from './fixes/doctor.js';
import { register as registerRestartSelf } from './fixes/restart-self.js';
import { register as registerEvents } from './events/sse.js';
import { register as registerUpstreamTaps } from './events/upstream-taps.js';

/**
 * Single aggregator for all Lexi /api/* routes.
 * Plan 2 adds: doctor, restart-self.
 * Plan 3 adds: events (SSE stream + recent fallback), upstream taps.
 * Future plans add more imports + calls below — server.ts never changes again.
 */
export function registerLexiRoutes(app: Express): void {
  registerDoctor(app);
  registerRestartSelf(app);
  registerEvents(app);
  registerUpstreamTaps(app);
}
