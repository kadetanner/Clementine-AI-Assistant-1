import type { Express } from 'express';
import { register as registerDoctor } from './fixes/doctor.js';
import { register as registerRestartSelf } from './fixes/restart-self.js';
import { register as registerEvents } from './events/sse.js';
import { register as registerUpstreamTaps } from './events/upstream-taps.js';
import { register as registerAgents } from './routes/agents.js';
import { register as registerConnections } from './routes/connections.js';
import { register as registerWorkflows } from './routes/workflows.js';
import { register as registerVaultWrite } from './routes/vault-write.js';
import { register as registerFixes } from './fixes/register.js';
import { register as registerUpstreamProxy } from './proxy/upstream-routes.js';

/**
 * Single aggregator for all Lexi /api/* routes.
 * Plan 2 adds: doctor, restart-self.
 * Plan 3 adds: events (SSE stream + recent fallback), upstream taps.
 * Plan 4 adds: agents (list, detail, prompt, tools, restart).
 * Plan 5 adds: connections (list, probe, credentials read+update).
 * Plan 6 adds: workflows (diagnostics, stuck-steps).
 * Plan 7 adds: vault-write (PUT /api/vault-file).
 * Plan 8 adds: bug-fix endpoints (daily-plan, voice/synthesize, digest, goals, cron/stuck) + cron stuck-job detector.
 * Plan 10 adds: in-process proxy for 10 upstream API endpoints required by Plan 4-7 components.
 * Future plans add more imports + calls below — server.ts never changes again.
 */
export function registerLexiRoutes(app: Express): void {
  registerDoctor(app);
  registerRestartSelf(app);
  registerEvents(app);
  registerUpstreamTaps(app);
  registerAgents(app);
  registerConnections(app);
  registerWorkflows(app);
  registerVaultWrite(app);
  registerFixes(app);
  registerUpstreamProxy(app);
}
