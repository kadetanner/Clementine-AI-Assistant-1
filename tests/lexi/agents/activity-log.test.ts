import { describe, it, expect, beforeEach } from 'vitest';
import { recordActivity, tailActivity, clearActivity } from '../../../src/lexi-dashboard/agents/activity-log.js';

describe('activity-log', () => {
  beforeEach(() => clearActivity());
  it('returns empty array for unknown slug', () => {
    expect(tailActivity('ghost')).toEqual([]);
  });
  it('records and returns most-recent first up to limit', () => {
    for (let i = 0; i < 5; i++) recordActivity('lexi', { type: 'tool_call', summary: `t${i}` });
    const tail = tailActivity('lexi', 3);
    expect(tail).toHaveLength(3);
    expect(tail[0].summary).toBe('t4');
    expect(tail[2].summary).toBe('t2');
  });
  it('caps ring buffer at 200 entries per agent', () => {
    for (let i = 0; i < 250; i++) recordActivity('lexi', { type: 'x', summary: `${i}` });
    expect(tailActivity('lexi', 1000).length).toBe(200);
  });
});
