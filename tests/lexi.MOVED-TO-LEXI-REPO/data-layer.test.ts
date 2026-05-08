/**
 * Smoke tests for Phase 13 data layer.
 * These run without a live daemon — adapters return graceful empty results
 * when their backing modules aren't available.
 */
import { describe, it, expect } from 'vitest';

describe('data layer barrel', () => {
  it('exports the expected namespaces', async () => {
    const data = await import('../../src/lexi-dashboard/data/index.js');
    expect(typeof data.agents.listAgents).toBe('function');
    expect(typeof data.builder.listWorkflows).toBe('function');
    expect(typeof data.cron.listJobs).toBe('function');
    expect(typeof data.memory.memoryHealth).toBe('function');
    expect(typeof data.vault.listFiles).toBe('function');
    expect(typeof data.traceStore.appendEvent).toBe('function');
    expect(typeof data.pinStore.listPins).toBe('function');
    expect(typeof data.notifications.listNotifications).toBe('function');
    expect(typeof data.clementineHome).toBe('function');
  });
});

describe('trace-store', () => {
  it('rings events per run and lists newest first', async () => {
    const mod = await import('../../src/lexi-dashboard/data/lexi-native/trace-store.js');
    mod._resetForTest();
    mod.appendEvent({ runId: 'r1', agentSlug: 'a', type: 'run.started', ts: 1 });
    mod.appendEvent({ runId: 'r1', agentSlug: 'a', type: 'run.step', ts: 2 });
    mod.appendEvent({ runId: 'r2', agentSlug: 'b', type: 'run.started', ts: 3 });
    expect(mod.getRun('r1').length).toBe(2);
    const runs = mod.listRuns();
    expect(runs[0].runId).toBe('r2');
    expect(runs[0].status).toBe('running');
    mod.appendEvent({ runId: 'r2', agentSlug: 'b', type: 'run.completed', ts: 4 });
    expect(mod.listRuns()[0].status).toBe('completed');
  });

  it('filters by agent', async () => {
    const mod = await import('../../src/lexi-dashboard/data/lexi-native/trace-store.js');
    mod._resetForTest();
    mod.appendEvent({ runId: 'r1', agentSlug: 'a', type: 'run.started', ts: 1 });
    mod.appendEvent({ runId: 'r2', agentSlug: 'b', type: 'run.started', ts: 2 });
    expect(mod.listRuns({ agent: 'a' }).length).toBe(1);
    expect(mod.listRuns({ agent: 'b' }).length).toBe(1);
  });
});

describe('paths', () => {
  it('honors CLEMENTINE_HOME env', async () => {
    const original = process.env.CLEMENTINE_HOME;
    process.env.CLEMENTINE_HOME = '/tmp/test-clementine';
    // Re-import for env to take effect on subsequent imports — but path module is sync,
    // so the module cache persists. Just verify the static function reads env at call time.
    const mod = await import('../../src/lexi-dashboard/data/paths.js');
    expect(mod.clementineHome()).toBe('/tmp/test-clementine');
    expect(mod.vaultRoot()).toBe('/tmp/test-clementine/vault');
    expect(mod.lexiStateDir()).toBe('/tmp/test-clementine/lexi');
    if (original) process.env.CLEMENTINE_HOME = original;
    else delete process.env.CLEMENTINE_HOME;
  });
});

describe('cron + builder data', () => {
  it('returns arrays even when upstream unavailable', async () => {
    const cron = await import('../../src/lexi-dashboard/data/from-upstream/cron.js');
    const builder = await import('../../src/lexi-dashboard/data/from-upstream/builder.js');
    expect(Array.isArray(await cron.listJobs())).toBe(true);
    expect(Array.isArray(await builder.listWorkflows())).toBe(true);
  });
});

describe('vault listFiles', () => {
  it('returns array (possibly empty) when vault unreadable', async () => {
    const mod = await import('../../src/lexi-dashboard/data/from-upstream/vault.js');
    const r = await mod.listFiles({ limit: 5, sinceDays: 9999 });
    expect(Array.isArray(r)).toBe(true);
  });
});
