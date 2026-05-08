/**
 * In-memory trace store for live agent runs.
 *
 * Phase 13 lays the API; Phase 14 (agents pillar) wires real run lifecycle
 * events through the SSE bus into this store. Bounded ring per run.
 */

export type TraceEventType =
  | 'run.started'
  | 'run.step'
  | 'run.tool-call'
  | 'run.tool-result'
  | 'run.token-usage'
  | 'run.completed'
  | 'run.failed';

export interface TraceEvent {
  runId: string;
  agentSlug: string;
  type: TraceEventType;
  ts: number;
  payload?: unknown;
}

const MAX_EVENTS_PER_RUN = 2000;
const MAX_RUNS = 200;

const RUNS = new Map<string, TraceEvent[]>();
const RUN_ORDER: string[] = [];

export function appendEvent(ev: TraceEvent): void {
  let list = RUNS.get(ev.runId);
  if (!list) {
    list = [];
    RUNS.set(ev.runId, list);
    RUN_ORDER.unshift(ev.runId);
    if (RUN_ORDER.length > MAX_RUNS) {
      const drop = RUN_ORDER.pop();
      if (drop) RUNS.delete(drop);
    }
  }
  list.push(ev);
  if (list.length > MAX_EVENTS_PER_RUN) list.splice(0, list.length - MAX_EVENTS_PER_RUN);
}

export function getRun(runId: string): TraceEvent[] {
  return RUNS.get(runId) ?? [];
}

export function listRuns(opts: { agent?: string; limit?: number } = {}): { runId: string; agentSlug: string; startedAt: number; completedAt: number | null; status: 'running' | 'completed' | 'failed' }[] {
  const limit = Math.min(opts.limit ?? 50, MAX_RUNS);
  const out: { runId: string; agentSlug: string; startedAt: number; completedAt: number | null; status: 'running' | 'completed' | 'failed' }[] = [];
  for (const id of RUN_ORDER) {
    const events = RUNS.get(id) ?? [];
    if (events.length === 0) continue;
    const first = events[0];
    if (opts.agent && first.agentSlug !== opts.agent) continue;
    const completed = events.find((e) => e.type === 'run.completed');
    const failed = events.find((e) => e.type === 'run.failed');
    out.push({
      runId: id,
      agentSlug: first.agentSlug,
      startedAt: first.ts,
      completedAt: completed?.ts ?? failed?.ts ?? null,
      status: failed ? 'failed' : completed ? 'completed' : 'running',
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** For tests only. */
export function _resetForTest(): void {
  RUNS.clear();
  RUN_ORDER.length = 0;
}
