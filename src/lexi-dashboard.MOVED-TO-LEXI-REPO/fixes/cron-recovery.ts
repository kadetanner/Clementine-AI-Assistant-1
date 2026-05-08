import type { Express } from 'express';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface CronRecoveryDeps {
  baseDir: string;
  emit?: (event: { type: string; ts: number; payload: unknown }) => void;
  intervalMs?: number;
}

interface StuckJob {
  name: string;
  errorMessage: string;
  errorCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  suspendedUntil: string;
}

const WINDOW_MS = 30 * 60 * 1000;
const THRESHOLD = 3;
const SUSPEND_MS = 60 * 60 * 1000;

function statePath(baseDir: string): string { return path.join(baseDir, 'lexi-stuck-jobs.json'); }

function loadState(baseDir: string): { jobs: StuckJob[] } {
  const file = statePath(baseDir);
  if (!existsSync(file)) return { jobs: [] };
  try { return JSON.parse(readFileSync(file, 'utf-8')); } catch { return { jobs: [] }; }
}

function saveState(baseDir: string, state: { jobs: StuckJob[] }): void {
  if (!existsSync(baseDir)) mkdirSync(baseDir, { recursive: true });
  writeFileSync(statePath(baseDir), JSON.stringify(state, null, 2));
}

function normaliseError(msg: string): string {
  return msg.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 240);
}

interface RunEntry { startedAt?: string; completedAt?: string; timestamp?: string; status?: string; error?: string; }

function readRecent(baseDir: string, job: string, since: number): RunEntry[] {
  const file = path.join(baseDir, 'cron', 'runs', `${job}.jsonl`);
  if (!existsSync(file)) return [];
  const out: RunEntry[] = [];
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line) as RunEntry;
      const ts = Date.parse(String(e.completedAt || e.startedAt || e.timestamp || ''));
      if (Number.isFinite(ts) && ts >= since) out.push(e);
    } catch { /* skip */ }
  }
  return out;
}

export function runStuckDetectionOnce(deps: CronRecoveryDeps): { jobs: StuckJob[] } {
  const runsDir = path.join(deps.baseDir, 'cron', 'runs');
  const state = loadState(deps.baseDir);
  if (!existsSync(runsDir)) return state;
  const since = Date.now() - WINDOW_MS;
  const known = new Map(state.jobs.map((j) => [j.name, j] as const));

  for (const file of readdirSync(runsDir)) {
    if (!file.endsWith('.jsonl')) continue;
    const job = file.replace(/\.jsonl$/, '');
    const recent = readRecent(deps.baseDir, job, since);
    const errs = recent.filter((e) => e.status && e.status !== 'ok' && e.error);
    if (errs.length < THRESHOLD) continue;

    const buckets = new Map<string, RunEntry[]>();
    for (const e of errs) {
      const k = normaliseError(e.error!);
      const arr = buckets.get(k) ?? [];
      arr.push(e);
      buckets.set(k, arr);
    }
    let dominant: { key: string; entries: RunEntry[] } | null = null;
    for (const [key, entries] of buckets) {
      if (entries.length >= THRESHOLD && (!dominant || entries.length > dominant.entries.length)) {
        dominant = { key, entries };
      }
    }
    if (!dominant) continue;

    const sortedTs = dominant.entries
      .map((e) => Date.parse(String(e.completedAt || e.startedAt || e.timestamp || '')))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b);
    const firstSeenAt = new Date(sortedTs[0]).toISOString();
    const lastSeenAt = new Date(sortedTs[sortedTs.length - 1]).toISOString();
    const suspendedUntil = new Date(Date.now() + SUSPEND_MS).toISOString();

    const wasKnown = known.has(job);
    const next: StuckJob = {
      name: job,
      errorMessage: dominant.key,
      errorCount: dominant.entries.length,
      firstSeenAt: wasKnown ? known.get(job)!.firstSeenAt : firstSeenAt,
      lastSeenAt,
      suspendedUntil,
    };
    known.set(job, next);
    if (!wasKnown && deps.emit) {
      deps.emit({ type: 'cron_job_stuck', ts: Date.now(), payload: next });
    }
  }

  const merged = { jobs: Array.from(known.values()) };
  if (merged.jobs.length > 0 || existsSync(statePath(deps.baseDir))) {
    saveState(deps.baseDir, merged);
  }
  return merged;
}

export function registerCronRecovery(app: Express, deps: CronRecoveryDeps): () => void {
  app.get('/api/cron/stuck', (_req, res) => res.json({ ok: true, ...loadState(deps.baseDir) }));

  app.post('/api/cron/stuck/:job/clear', (req, res) => {
    const job = String(req.params.job || '');
    const state = loadState(deps.baseDir);
    const next = { jobs: state.jobs.filter((j) => j.name !== job) };
    saveState(deps.baseDir, next);
    res.json({ ok: true, cleared: job });
  });

  const intervalMs = deps.intervalMs ?? 60_000;
  let timer: NodeJS.Timeout | undefined;
  if (intervalMs > 0) {
    timer = setInterval(() => {
      try { runStuckDetectionOnce(deps); } catch { /* swallow */ }
    }, intervalMs);
    timer.unref();
  }
  return () => { if (timer) clearInterval(timer); };
}
