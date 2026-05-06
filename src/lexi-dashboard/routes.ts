import type { Express } from 'express';
import { register as registerDoctor } from './fixes/doctor.js';
import { register as registerRestartSelf } from './fixes/restart-self.js';
import { register as registerEvents } from './events/sse.js';
import { register as registerUpstreamTaps } from './events/upstream-taps.js';
import { register as registerAgents } from './routes/agents.js';
import { register as registerAgentsV2 } from './routes/agents-v2.js';
import { register as registerMemoryBrainV2 } from './routes/memory-brain-v2.js';
import { register as registerWorkflowsCronRoutinesV2 } from './routes/workflows-cron-routines-v2.js';
import { register as registerOperateV2 } from './routes/operate-v2.js';
import { register as registerObservabilityMiscV2 } from './routes/observability-misc-v2.js';
import { register as registerChatV2 } from './routes/chat-v2.js';
import { register as registerSearchV2 } from './routes/search-v2.js';
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
  // V2 must register before V1: V1 router has a catch-all `/:slug` that
  // would otherwise swallow Lighthouse routes like `/api/agents/compare`.
  registerAgentsV2(app);
  registerAgents(app);
  registerMemoryBrainV2(app);
  registerWorkflowsCronRoutinesV2(app);
  registerOperateV2(app);
  registerObservabilityMiscV2(app);
  registerChatV2(app);
  registerSearchV2(app);
  registerConnections(app);
  registerWorkflows(app);
  registerVaultWrite(app);
  registerFixes(app);
  registerUpstreamProxy(app);
}
