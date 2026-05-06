import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  _ingestLineForTest,
  _pollNowForTest,
  deriveAgentSlug,
  mapEventType,
  startSessionLogTailer,
  stopSessionLogTailer,
} from '../../src/lexi-dashboard/data/lexi-native/session-log-tailer.js';
import { _resetForTest, listRuns, getRun } from '../../src/lexi-dashboard/data/lexi-native/trace-store.js';
import { getEventBus } from '../../src/lexi-dashboard/events/bus.js';

describe('session-log-tailer · derivation helpers', () => {
  it('derives agent slug from cron sessionKeys', () => {
    expect(deriveAgentSlug('cron:lexi:hourly-digest')).toBe('lexi');
    expect(deriveAgentSlug('cron:nightly-rollup')).toBe('clementine');
    expect(deriveAgentSlug('cron:foo')).toBe('clementine');
  });

  it('derives agent slug from team-task sessionKeys (target wins)', () => {
    expect(deriveAgentSlug('team-task:lexi->jonah')).toBe('jonah');
  });

  it('derives sensible defaults from discord/unleashed prefixes', () => {
    expect(deriveAgentSlug('discord:user:abc123')).toBe('clementine');
    expect(deriveAgentSlug('unleashed:deep-1234')).toBe('unleashed-deep');
    expect(deriveAgentSlug('unleashed:bg-xyz')).toBe('unleashed-bg');
    expect(deriveAgentSlug('unleashed:other')).toBe('unleashed');
  });

  it('falls back to the prefix or whole key when no rule matches', () => {
    expect(deriveAgentSlug('weird:thing')).toBe('weird');
    expect(deriveAgentSlug('plainstring')).toBe('plainstring');
    expect(deriveAgentSlug('')).toBe('clementine');
  });

  it('maps upstream session event types to trace event types', () => {
    expect(mapEventType({ type: 'query_start', timestamp: '', sessionKey: 'k', data: {} })).toBe('run.started');
    expect(mapEventType({ type: 'tool_call', timestamp: '', sessionKey: 'k', data: {} })).toBe('run.tool-call');
    expect(mapEventType({ type: 'tool_result', timestamp: '', sessionKey: 'k', data: {} })).toBe('run.tool-result');
    expect(mapEventType({ type: 'error', timestamp: '', sessionKey: 'k', data: {} })).toBe('run.failed');
    expect(mapEventType({ type: 'phase_start', timestamp: '', sessionKey: 'k', data: {} })).toBe('run.step');
    expect(mapEventType({ type: 'checkpoint', timestamp: '', sessionKey: 'k', data: {} })).toBe('run.step');
    expect(mapEventType({ type: 'compaction', timestamp: '', sessionKey: 'k', data: {} })).toBe('run.step');
    expect(mapEventType({ type: 'unknown', timestamp: '', sessionKey: 'k', data: {} })).toBeNull();
  });

  it('maps query_end to completed by default and to failed on terminal-reason error', () => {
    expect(mapEventType({ type: 'query_end', timestamp: '', sessionKey: 'k', data: { terminalReason: 'normal' } })).toBe('run.completed');
    expect(mapEventType({ type: 'query_end', timestamp: '', sessionKey: 'k', data: { terminalReason: 'crash_recovery' } })).toBe('run.failed');
    expect(mapEventType({ type: 'query_end', timestamp: '', sessionKey: 'k', data: { terminalReason: 'error_aborted' } })).toBe('run.failed');
  });
});

describe('session-log-tailer · ingestion', () => {
  beforeEach(() => { _resetForTest(); });

  it('ingestLine writes to the trace store and bumps the run order', () => {
    _ingestLineForTest(JSON.stringify({
      type: 'query_start',
      timestamp: '2026-05-06T10:00:00.000Z',
      sessionKey: 'cron:lexi:job-x',
      data: { prompt: 'hello', source: 'cron' },
    }));
    _ingestLineForTest(JSON.stringify({
      type: 'tool_call',
      timestamp: '2026-05-06T10:00:01.000Z',
      sessionKey: 'cron:lexi:job-x',
      data: { tool: 'Bash', input: { command: 'ls' } },
    }));
    _ingestLineForTest(JSON.stringify({
      type: 'query_end',
      timestamp: '2026-05-06T10:00:02.000Z',
      sessionKey: 'cron:lexi:job-x',
      data: { terminalReason: 'normal', responseLength: 42, durationMs: 2000 },
    }));

    const runs = listRuns({ limit: 10 });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ runId: 'cron:lexi:job-x', agentSlug: 'lexi', status: 'completed' });

    const events = getRun('cron:lexi:job-x');
    expect(events.map((e) => e.type)).toEqual(['run.started', 'run.tool-call', 'run.completed']);
  });

  it('ingestLine emits agent_run_event onto the bus', () => {
    const bus = getEventBus();
    const seen: { type: string; payload: { runId?: string } }[] = [];
    const off = bus.subscribe((ev) => seen.push({ type: ev.type, payload: ev.payload as { runId?: string } }));
    _ingestLineForTest(JSON.stringify({
      type: 'query_start',
      timestamp: '2026-05-06T10:00:00.000Z',
      sessionKey: 'cron:lexi:bus-test',
      data: { prompt: 'h' },
    }));
    off();
    expect(seen.some((s) => s.type === 'agent_run_event' && s.payload.runId === 'cron:lexi:bus-test')).toBe(true);
  });

  it('classifies failed runs by error event presence even without query_end', () => {
    _ingestLineForTest(JSON.stringify({
      type: 'query_start',
      timestamp: '2026-05-06T10:00:00.000Z',
      sessionKey: 'cron:lexi:err-only',
      data: {},
    }));
    _ingestLineForTest(JSON.stringify({
      type: 'error',
      timestamp: '2026-05-06T10:00:01.000Z',
      sessionKey: 'cron:lexi:err-only',
      data: { message: 'boom' },
    }));
    const runs = listRuns({ limit: 10 });
    const r = runs.find((x) => x.runId === 'cron:lexi:err-only');
    expect(r?.status).toBe('failed');
  });

  it('skips malformed and unknown-type lines silently', () => {
    _ingestLineForTest('not json');
    _ingestLineForTest(JSON.stringify({ type: 'mystery', timestamp: '', sessionKey: 'cron:lexi:m', data: {} }));
    _ingestLineForTest(JSON.stringify({ /* missing required fields */ }));
    expect(listRuns().length).toBe(0);
  });
});

describe('session-log-tailer · file watching', () => {
  let tmp: string;

  beforeEach(() => {
    _resetForTest();
    tmp = mkdtempSync(path.join(tmpdir(), 'lexi-tailer-'));
  });

  afterEach(() => {
    stopSessionLogTailer();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('picks up appends to tracked files (deterministic poll)', () => {
    const file = path.join(tmp, 'cron:lexi:watch.jsonl');
    writeFileSync(file, '');
    startSessionLogTailer({ dir: tmp });

    appendFileSync(file, JSON.stringify({
      type: 'query_start',
      timestamp: '2026-05-06T10:00:00.000Z',
      sessionKey: 'cron:lexi:watch',
      data: {},
    }) + '\n');

    // fs.watch is flaky in test runners on macOS; force a deterministic poll.
    // The launchd service relies on the watcher in production.
    _pollNowForTest(tmp);

    expect(listRuns({ agent: 'lexi' }).some((r) => r.runId === 'cron:lexi:watch')).toBe(true);
  });

  it('discovers files added after start and tails them', () => {
    startSessionLogTailer({ dir: tmp });
    const file = path.join(tmp, 'cron:lexi:later.jsonl');
    writeFileSync(file, JSON.stringify({
      type: 'query_start',
      timestamp: '2026-05-06T10:00:00.000Z',
      sessionKey: 'cron:lexi:later',
      data: {},
    }) + '\n');
    _pollNowForTest(tmp);
    expect(listRuns({ agent: 'lexi' }).some((r) => r.runId === 'cron:lexi:later')).toBe(true);
  });

  it('survives file truncation/rotation by resetting position', () => {
    const file = path.join(tmp, 'cron:lexi:rot.jsonl');
    // Initial content: two events, ample bytes.
    const big = [
      JSON.stringify({ type: 'query_start',  timestamp: '2026-05-06T10:00:00.000Z', sessionKey: 'cron:lexi:rot-old', data: { prompt: 'old-run', extraPaddingForBytes: 'x'.repeat(200) } }),
      JSON.stringify({ type: 'query_end',    timestamp: '2026-05-06T10:00:01.000Z', sessionKey: 'cron:lexi:rot-old', data: { responseLength: 0, durationMs: 1, terminalReason: 'normal' } }),
    ].join('\n') + '\n';
    writeFileSync(file, big);
    startSessionLogTailer({ dir: tmp });
    _pollNowForTest(tmp);
    _resetForTest();

    // Simulate rotation: file is overwritten with strictly shorter content,
    // which is the upstream daemon's MAX_LOG_SIZE rotate-then-recreate path.
    const small = JSON.stringify({
      type: 'query_start',
      timestamp: '2026-05-06T11:00:00.000Z',
      sessionKey: 'cron:lexi:rot-new',
      data: {},
    }) + '\n';
    writeFileSync(file, small);
    _pollNowForTest(tmp);
    expect(listRuns({ agent: 'lexi' }).some((r) => r.runId === 'cron:lexi:rot-new')).toBe(true);
  });
});
