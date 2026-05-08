/**
 * Session log tailer — bridges upstream daemon's append-only session JSONL
 * files into Lexi's in-memory trace store and SSE event bus.
 *
 * Why tail files instead of hooking the upstream emitter directly?
 *   The upstream `EventLog` class writes JSONL to `~/.clementine/sessions/`
 *   without exposing an EventEmitter. Tailing the durable on-disk log is
 *   upstream-clean (zero edits to upstream files), survives daemon restart,
 *   and matches upstream's own crash-recovery contract for these logs.
 *
 * Mapping (upstream SessionEvent type → Lexi TraceEvent type):
 *   query_start                 → run.started
 *   query_end                   → run.completed   (or run.failed if error reason)
 *   tool_call                   → run.tool-call
 *   tool_result                 → run.tool-result
 *   error                       → run.failed
 *   phase_start | phase_end     → run.step
 *   checkpoint | decision       → run.step
 *   compaction                  → run.step
 *
 * The session's `sessionKey` is used as the runId; an agent slug is derived
 * heuristically from the key prefix (cron:<agent>:..., team-task:...->X,
 * unleashed:..., discord:user:..., default 'clementine').
 */

import { existsSync, readdirSync, statSync, watch, type FSWatcher, openSync, readSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { appendEvent, type TraceEvent, type TraceEventType } from './trace-store.js';
import { getEventBus } from '../../events/bus.js';

const SESSIONS_DIR = path.join(homedir(), '.clementine', 'sessions');

/** Minimal subset of upstream's SessionEvent shape we rely on. */
interface RawSessionEvent {
  type: string;
  timestamp: string;
  sessionKey: string;
  data: Record<string, unknown>;
}

interface FileState {
  path: string;
  position: number;
  watcher?: FSWatcher;
}

const STATE = new Map<string, FileState>();
let dirWatcher: FSWatcher | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let started = false;

// macOS `fs.watch` (kqueue) is unreliable for new-file-creation in a watched
// directory and for in-place file appends. Polling every few seconds is the
// minimum-viable backstop. The cost is trivial — readdirSync + statSync on
// a small directory.
const POLL_INTERVAL_MS = 1500;

/**
 * Derive an agent slug from a session key. Matches the conventions in
 * upstream's run-agent-cron.ts and run-agent-team-task.ts.
 */
export function deriveAgentSlug(sessionKey: string): string {
  if (!sessionKey) return 'clementine';
  if (sessionKey.startsWith('cron:')) {
    const parts = sessionKey.split(':');
    // cron:<agent>:<job>  → parts[1] is agent (when present, non-job-like)
    if (parts.length >= 3 && parts[1] && !/^\d/.test(parts[1])) return parts[1];
    return 'clementine';
  }
  if (sessionKey.startsWith('team-task:')) {
    const m = sessionKey.match(/^team-task:[^->]+->(.+)$/);
    if (m) return m[1];
    return 'clementine';
  }
  if (sessionKey.startsWith('discord:')) return 'clementine';
  if (sessionKey.startsWith('unleashed:deep')) return 'unleashed-deep';
  if (sessionKey.startsWith('unleashed:bg')) return 'unleashed-bg';
  if (sessionKey.startsWith('unleashed:')) return 'unleashed';
  // generic prefix
  const colon = sessionKey.indexOf(':');
  if (colon > 0) return sessionKey.slice(0, colon);
  return sessionKey;
}

/** Map an upstream SessionEvent to a Lexi TraceEvent type. Returns null to skip. */
export function mapEventType(ev: RawSessionEvent): TraceEventType | null {
  switch (ev.type) {
    case 'query_start':  return 'run.started';
    case 'tool_call':    return 'run.tool-call';
    case 'tool_result':  return 'run.tool-result';
    case 'error':        return 'run.failed';
    case 'query_end': {
      const reason = (ev.data && typeof ev.data === 'object' && 'terminalReason' in ev.data)
        ? String((ev.data as { terminalReason?: unknown }).terminalReason ?? '')
        : '';
      return /error|crash|abort|fail/i.test(reason) ? 'run.failed' : 'run.completed';
    }
    case 'phase_start':
    case 'phase_end':
    case 'checkpoint':
    case 'decision':
    case 'compaction':
      return 'run.step';
    default:
      return null;
  }
}

function ingestRawLine(line: string): void {
  if (!line) return;
  let parsed: RawSessionEvent;
  try {
    parsed = JSON.parse(line) as RawSessionEvent;
  } catch {
    return; // malformed — skip
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.sessionKey || !parsed.type) return;

  const traceType = mapEventType(parsed);
  if (!traceType) return;

  const ts = parsed.timestamp ? Date.parse(parsed.timestamp) : Date.now();
  const traceEvent: TraceEvent = {
    runId: parsed.sessionKey,
    agentSlug: deriveAgentSlug(parsed.sessionKey),
    type: traceType,
    ts: Number.isFinite(ts) ? ts : Date.now(),
    payload: parsed.data,
  };

  appendEvent(traceEvent);
  try {
    getEventBus().emit('agent_run_event', traceEvent);
  } catch {
    /* bus may reject if types desync — don't take the tailer down */
  }
}

function readNewBytes(state: FileState): void {
  let fd: number | null = null;
  try {
    const stat = statSync(state.path);
    if (stat.size < state.position) {
      // file rotated/truncated — reset
      state.position = 0;
    }
    if (stat.size === state.position) return;
    const len = stat.size - state.position;
    const buf = Buffer.alloc(len);
    fd = openSync(state.path, 'r');
    readSync(fd, buf, 0, len, state.position);
    state.position = stat.size;
    const text = buf.toString('utf8');
    // Split on newlines; drop a trailing partial line by re-buffering its bytes.
    const lines = text.split('\n');
    const trailing = lines.pop() ?? '';
    for (const line of lines) ingestRawLine(line);
    if (trailing) state.position -= Buffer.byteLength(trailing, 'utf8');
  } catch {
    /* file may have been deleted between stat and read — ignore */
  } finally {
    if (fd !== null) { try { closeSync(fd); } catch { /* ignore */ } }
  }
}

function attachFile(filePath: string, opts: { backfill: boolean }): void {
  if (STATE.has(filePath)) return;
  let initialPos = 0;
  if (!opts.backfill) {
    try { initialPos = statSync(filePath).size; } catch { initialPos = 0; }
  }
  const state: FileState = { path: filePath, position: initialPos };
  STATE.set(filePath, state);

  // Initial read of any pending bytes (or full content when backfilling)
  readNewBytes(state);

  try {
    state.watcher = watch(filePath, { persistent: false }, () => readNewBytes(state));
  } catch {
    /* watcher may fail on transient files — initial read still captured what was there */
  }
}

function scanDir(opts: { backfill: boolean }): void {
  if (!existsSync(SESSIONS_DIR)) return;
  let files: string[] = [];
  try {
    files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.jsonl') && !f.endsWith('.bak'));
  } catch {
    return;
  }
  for (const f of files) attachFile(path.join(SESSIONS_DIR, f), opts);
}

export interface StartOptions {
  /** Read existing files from current end (false = no backfill) or from byte 0 (true). */
  backfillOnStart?: boolean;
  /** Override the sessions dir (test-only). */
  dir?: string;
}

/**
 * Start tailing. Idempotent — second call is a no-op while first is active.
 */
export function startSessionLogTailer(opts: StartOptions = {}): void {
  if (started) return;
  started = true;
  const dir = opts.dir ?? SESSIONS_DIR;
  if (!existsSync(dir)) return; // nothing to tail yet; the daemon will create the dir on first write

  // initial scan
  scanDirWithBase(dir, { backfill: !!opts.backfillOnStart });

  try {
    dirWatcher = watch(dir, { persistent: false }, (_evt, fname) => {
      if (!fname || typeof fname !== 'string') return;
      if (!fname.endsWith('.jsonl') || fname.endsWith('.bak')) return;
      // Files discovered after startup are by definition new — read them from
      // byte 0 so we don't lose their opening events.
      attachFile(path.join(dir, fname), { backfill: true });
    });
  } catch {
    /* fall back to polling — backstop below covers it */
  }

  // Periodic backstop: rescan dir for new files and read pending bytes from
  // tracked files. Belt-and-suspenders against fs.watch missing macOS events.
  pollTimer = setInterval(() => {
    try {
      scanDirWithBase(dir, { backfill: true });
      for (const s of STATE.values()) readNewBytes(s);
    } catch { /* swallow — never crash the daemon over a transient FS error */ }
  }, POLL_INTERVAL_MS);
  if (typeof pollTimer.unref === 'function') pollTimer.unref();
}

/** Stop all watchers + timers; useful for tests. */
export function stopSessionLogTailer(): void {
  if (dirWatcher) { try { dirWatcher.close(); } catch { /* ignore */ } dirWatcher = null; }
  if (pollTimer) { try { clearInterval(pollTimer); } catch { /* ignore */ } pollTimer = null; }
  for (const s of STATE.values()) {
    if (s.watcher) { try { s.watcher.close(); } catch { /* ignore */ } }
  }
  STATE.clear();
  started = false;
}

/** Test-only entry: ingest a JSONL line directly. */
export function _ingestLineForTest(line: string): void {
  ingestRawLine(line);
}

/**
 * Test-only entry: rescan the configured dir for new files and read any
 * pending bytes from tracked files. Useful where fs.watch is flaky (CI, vitest
 * on macOS). The launchd service relies on the watcher, not this helper.
 */
export function _pollNowForTest(dir?: string): void {
  // backfill=true so newly discovered files start from byte 0 — matches the
  // dir-watcher's behavior in production.
  if (dir) scanDirWithBase(dir, { backfill: true });
  for (const s of STATE.values()) readNewBytes(s);
}

// ── internals ────────────────────────────────────────────────────────────

function scanDirWithBase(base: string, opts: { backfill: boolean }): void {
  if (!existsSync(base)) return;
  let files: string[] = [];
  try {
    files = readdirSync(base).filter((f) => f.endsWith('.jsonl') && !f.endsWith('.bak'));
  } catch {
    return;
  }
  for (const f of files) attachFile(path.join(base, f), opts);
}

// keep the param-less helper exported as a no-op shim if anything imports it
void scanDir;
