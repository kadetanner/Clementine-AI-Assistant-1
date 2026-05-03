import type { EventEmitter } from 'node:events';
import type { Express } from 'express';
import { getEventBus, type EventBus } from './bus.js';
import type { LexiEventType } from './types.js';

export interface UpstreamSources {
  agentRuntime?: EventEmitter;
  mcpBridge?: EventEmitter;
  scheduler?: EventEmitter;
  webhooks?: EventEmitter;
  workflows?: EventEmitter;
}

interface Wiring { source: EventEmitter; event: string; handler: (payload: unknown) => void; }

export function wireUpstreamTaps(bus: EventBus, sources: UpstreamSources): () => void {
  const wirings: Wiring[] = [];

  const attach = (source: EventEmitter | undefined, event: string, type: LexiEventType): void => {
    if (!source) return;
    const handler = (payload: unknown): void => { bus.emit(type, payload ?? {}); };
    source.on(event, handler);
    wirings.push({ source, event, handler });
  };

  attach(sources.agentRuntime, 'activity', 'agent_activity');
  attach(sources.mcpBridge, 'call:start', 'mcp_call_start');
  attach(sources.mcpBridge, 'call:complete', 'mcp_call_complete');
  attach(sources.mcpBridge, 'call:error', 'mcp_call_error');
  attach(sources.scheduler, 'tick', 'cron_tick');
  attach(sources.webhooks, 'received', 'webhook_received');
  attach(sources.workflows, 'state', 'workflow_state');

  return (): void => { for (const w of wirings) w.source.off(w.event, w.handler); };
}

/**
 * Best-effort discovery of upstream emitters at server boot. Returns an empty
 * object if none are reachable — the bus still works (manual emit() and tests).
 */
export async function discoverUpstreamSources(): Promise<UpstreamSources> {
  const out: UpstreamSources = {};
  // Each probe is in its own try so a single missing module does not nuke the others.
  try {
    const mod = (await import('../../agent/runtime.js')) as { getRuntimeEmitter?: () => EventEmitter };
    if (typeof mod.getRuntimeEmitter === 'function') out.agentRuntime = mod.getRuntimeEmitter();
  } catch { /* upstream surface absent — that's OK */ }
  try {
    const mod = (await import('../../tools/mcp-bridge.js')) as { getBridgeEmitter?: () => EventEmitter };
    if (typeof mod.getBridgeEmitter === 'function') out.mcpBridge = mod.getBridgeEmitter();
  } catch { /* OK */ }
  return out;
}

/**
 * Registration entry point used by routes.ts. The Express `app` is unused — we
 * register no HTTP routes here, only background wiring. Kept in the same shape
 * as the other registrars so routes.ts remains the single boot-time aggregator.
 */
export function register(_app: Express): void {
  void (async () => {
    try {
      const sources = await discoverUpstreamSources();
      wireUpstreamTaps(getEventBus(), sources);
    } catch (err) {
      // upstream surfaces are optional; never fail boot
      // eslint-disable-next-line no-console
      console.warn('[lexi] upstream tap discovery failed:', err);
    }
  })();
}
