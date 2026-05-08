import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/lexi-dashboard/events/bus.js';
import type { LexiEvent } from '../../src/lexi-dashboard/events/types.js';

describe('EventBus', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus({ capacity: 4 }); });

  it('emits to subscribers with the locked envelope', () => {
    const seen: LexiEvent[] = [];
    bus.subscribe((ev) => seen.push(ev));
    bus.emit('agent_activity', { agent: 'lexi', text: 'hi' });
    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe('agent_activity');
    expect(typeof seen[0].ts).toBe('number');
    expect(seen[0].payload).toEqual({ agent: 'lexi', text: 'hi' });
  });

  it('keeps only the last N events in recent()', () => {
    for (let i = 0; i < 6; i++) bus.emit('cron_tick', { i });
    const recent = bus.recent();
    expect(recent).toHaveLength(4);
    expect((recent[0].payload as { i: number }).i).toBe(2);
    expect((recent[3].payload as { i: number }).i).toBe(5);
  });

  it('unsubscribe stops further deliveries', () => {
    const seen: LexiEvent[] = [];
    const off = bus.subscribe((ev) => seen.push(ev));
    bus.emit('cron_tick', { i: 1 });
    off();
    bus.emit('cron_tick', { i: 2 });
    expect(seen).toHaveLength(1);
  });

  it('rejects unknown event types', () => {
    // @ts-expect-error intentional
    expect(() => bus.emit('nope', {})).toThrow(/unknown event type/i);
  });
});
