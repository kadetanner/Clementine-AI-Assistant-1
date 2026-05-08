import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStuckStepsStore, type StuckStep } from '../../../src/lexi-dashboard/workflows/stuck-steps-store.js';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'lexi-stuck-'));
  file = path.join(dir, 'lexi-stuck-steps.json');
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('stuck-steps-store', () => {
  it('returns empty list when file does not exist', async () => {
    const store = createStuckStepsStore(file);
    expect(await store.list()).toEqual([]);
  });

  it('marks a step stuck and persists to disk', async () => {
    const store = createStuckStepsStore(file);
    const step: StuckStep = {
      workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing',
      detectedAt: 1700000000000, lastError: 'context refilled within 3 turns',
      thrashingEvents: 3,
    };
    await store.mark(step);
    expect(existsSync(file)).toBe(true);
    const persisted = JSON.parse(readFileSync(file, 'utf8'));
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ workflowId: 'wf-a', stepId: 's1' });
  });

  it('upserts on (workflowId, stepId) pair (no duplicates)', async () => {
    const store = createStuckStepsStore(file);
    const base = { workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing' as const, detectedAt: 1, lastError: 'a', thrashingEvents: 3 };
    await store.mark(base);
    await store.mark({ ...base, detectedAt: 2, lastError: 'b', thrashingEvents: 4 });
    const all = await store.list();
    expect(all).toHaveLength(1);
    expect(all[0].lastError).toBe('b');
    expect(all[0].thrashingEvents).toBe(4);
  });

  it('clears a step and rewrites the file', async () => {
    writeFileSync(file, JSON.stringify([
      { workflowId: 'wf-a', stepId: 's1', reason: 'autocompact-thrashing', detectedAt: 1, lastError: 'x', thrashingEvents: 3 },
      { workflowId: 'wf-b', stepId: 's2', reason: 'autocompact-thrashing', detectedAt: 2, lastError: 'y', thrashingEvents: 5 },
    ]));
    const store = createStuckStepsStore(file);
    await store.clear('wf-a', 's1');
    const all = await store.list();
    expect(all).toHaveLength(1);
    expect(all[0].workflowId).toBe('wf-b');
  });

  it('survives a corrupt file by treating it as empty', async () => {
    writeFileSync(file, '{not json');
    const store = createStuckStepsStore(file);
    expect(await store.list()).toEqual([]);
  });
});
