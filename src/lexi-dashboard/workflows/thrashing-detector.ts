import type { StuckStepsStore } from './stuck-steps-store.js';

export interface ThrashEvent {
  workflowId: string;
  stepId: string;
  kind: 'autocompact_thrash' | 'step_complete' | 'step_error';
  ts: number;
  message: string;
}

export interface SseEvent {
  type: string;
  ts: number;
  payload: unknown;
}

export interface ThrashingDetectorOptions {
  store: StuckStepsStore;
  emit: (event: SseEvent) => void;
  windowMs?: number;
  threshold?: number;
}

export interface ThrashingDetector {
  observe(event: ThrashEvent): Promise<void>;
}

export function createThrashingDetector(opts: ThrashingDetectorOptions): ThrashingDetector {
  const windowMs = opts.windowMs ?? 30 * 60_000;
  const threshold = opts.threshold ?? 3;
  const eventWindow: Map<string, ThrashEvent[]> = new Map();

  const key = (e: ThrashEvent) => `${e.workflowId}::${e.stepId}`;

  return {
    async observe(event) {
      if (event.kind !== 'autocompact_thrash') return;
      const k = key(event);
      const recent = (eventWindow.get(k) ?? []).filter((e) => event.ts - e.ts <= windowMs);
      recent.push(event);
      eventWindow.set(k, recent);

      if (recent.length >= threshold) {
        await opts.store.mark({
          workflowId: event.workflowId,
          stepId: event.stepId,
          reason: 'autocompact-thrashing',
          detectedAt: event.ts,
          lastError: event.message,
          thrashingEvents: recent.length,
        });
        opts.emit({
          type: 'workflow_step_stuck',
          ts: event.ts,
          payload: {
            workflowId: event.workflowId,
            stepId: event.stepId,
            reason: 'autocompact-thrashing',
            thrashingEvents: recent.length,
            lastError: event.message,
          },
        });
        // Reset the window so we don't re-emit on every subsequent event.
        eventWindow.delete(k);
      }
    },
  };
}
