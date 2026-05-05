import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createThrashingDetector } from '../../../src/lexi-dashboard/workflows/thrashing-detector.js';
import { createStuckStepsStore } from '../../../src/lexi-dashboard/workflows/stuck-steps-store.js';

let dir: string; let file: string;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'lexi-detect-')); file = path.join(dir, 'stuck.json'); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('thrashing-detector', () => {
  it('marks step stuck after >=3 thrashing events on same step within 30 min', async () => {
    const store = createStuckStepsStore(file);
    const emitter = vi.fn();
    const detector = createThrashingDetector({ store, emit: emitter, windowMs: 30 * 60_000 });
    const t0 = 1_700_000_000_000;
    await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'autocompact_thrash', ts: t0, message: 'context refill 1' });
    await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'autocompact_thrash', ts: t0 + 1000, message: 'context refill 2' });
    expect((await store.list())).toHaveLength(0);
    await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'autocompact_thrash', ts: t0 + 2000, message: 'context refill 3' });
    const stuck = await store.list();
    expect(stuck).toHaveLength(1);
    expect(stuck[0]).toMatchObject({ workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing', thrashingEvents: 3 });
    expect(emitter).toHaveBeenCalledWith(expect.objectContaining({
      type: 'workflow_step_stuck',
      payload: expect.objectContaining({ workflowId: 'wf-a', stepId: 's1' }),
    }));
  });

  it('does NOT trigger if events span more than 30 min', async () => {
    const store = createStuckStepsStore(file);
    const detector = createThrashingDetector({ store, emit: vi.fn(), windowMs: 30 * 60_000 });
    const t0 = 1_700_000_000_000;
    await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'autocompact_thrash', ts: t0, message: 'm' });
    await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'autocompact_thrash', ts: t0 + 31 * 60_000, message: 'm' });
    await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'autocompact_thrash', ts: t0 + 62 * 60_000, message: 'm' });
    expect((await store.list())).toHaveLength(0);
  });

  it('isolates state per (workflowId, stepId)', async () => {
    const store = createStuckStepsStore(file);
    const detector = createThrashingDetector({ store, emit: vi.fn(), windowMs: 30 * 60_000 });
    const t0 = 1_700_000_000_000;
    for (const stepId of ['s1', 's2']) {
      await detector.observe({ workflowId: 'wf-a', stepId, kind: 'autocompact_thrash', ts: t0, message: 'm' });
      await detector.observe({ workflowId: 'wf-a', stepId, kind: 'autocompact_thrash', ts: t0 + 1, message: 'm' });
    }
    expect((await store.list())).toHaveLength(0);
  });

  it('ignores non-autocompact events', async () => {
    const store = createStuckStepsStore(file);
    const detector = createThrashingDetector({ store, emit: vi.fn(), windowMs: 30 * 60_000 });
    for (let i = 0; i < 5; i++) {
      await detector.observe({ workflowId: 'wf-a', stepId: 's1', kind: 'step_complete', ts: i, message: 'ok' });
    }
    expect((await store.list())).toHaveLength(0);
  });
});
