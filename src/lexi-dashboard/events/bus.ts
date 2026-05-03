import { EVENT_TYPES, isLexiEventType, type LexiEvent, type LexiEventType } from './types.js';

export interface EventBusOptions { capacity?: number; }
export type LexiEventHandler = (ev: LexiEvent) => void;

export class EventBus {
  private buffer: LexiEvent[] = [];
  private readonly capacity: number;
  private handlers = new Set<LexiEventHandler>();

  constructor(opts: EventBusOptions = {}) {
    this.capacity = Math.max(1, opts.capacity ?? 200);
  }

  emit(type: LexiEventType, payload: unknown): LexiEvent {
    if (!isLexiEventType(type)) {
      throw new Error(`unknown event type: ${type as string} (allowed: ${EVENT_TYPES.join(', ')})`);
    }
    const ev: LexiEvent = { type, ts: Date.now(), payload };
    this.buffer.push(ev);
    if (this.buffer.length > this.capacity) this.buffer.splice(0, this.buffer.length - this.capacity);
    for (const h of this.handlers) {
      try { h(ev); } catch { /* swallow handler errors so emit() never throws */ }
    }
    return ev;
  }

  subscribe(handler: LexiEventHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  recent(limit?: number): LexiEvent[] {
    const slice = this.buffer.slice();
    return typeof limit === 'number' ? slice.slice(-limit) : slice;
  }

  size(): number { return this.buffer.length; }
}

let singleton: EventBus | null = null;
export function getEventBus(): EventBus {
  if (!singleton) singleton = new EventBus({ capacity: 200 });
  return singleton;
}
