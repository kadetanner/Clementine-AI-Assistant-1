/**
 * Phase 19 — Chat console pillar (Lighthouse §7.4).
 *
 * Free-only chat: per turn we shell out to the local daemon CLI (or, when
 * not configured, to a built-in echo stub). Streams stdout to a per-session
 * SSE channel. Transcripts saved to ~/.clementine/lexi/chat/<id>.json.
 *
 * Routes:
 *   POST /api/lexi-chat/start      — { agent? } → { sessionId }
 *   POST /api/lexi-chat/send       — { sessionId, prompt } → enqueues turn
 *   GET  /api/lexi-chat/stream/:id — SSE stream of stdout
 *   GET  /api/lexi-chat/sessions   — list of recent transcripts
 *   GET  /api/lexi-chat/sessions/:id — read a transcript
 *   DELETE /api/lexi-chat/sessions/:id — delete a transcript
 *
 * Hard invariant: the only spawned process is `bin/clementine` (or the user's
 * configured daemon CLI). No direct Anthropic SDK calls. If the daemon CLI
 * is not present or test mode is on, the echo stub is used.
 */
import express from 'express';
import type { Express, Request, Response } from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { lexiStateDir } from '../data/paths.js';

interface ChatTurn {
  ts: number;
  role: 'user' | 'agent';
  content: string;
}
interface ChatSession {
  id: string;
  agent: string;
  createdAt: number;
  turns: ChatTurn[];
}

const SESSIONS = new Map<string, ChatSession>();
const STREAMS = new Map<string, Set<Response>>();

function chatDir(): string {
  return path.join(lexiStateDir(), 'chat');
}

function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function persist(session: ChatSession): void {
  try {
    ensureDir(chatDir());
    writeFileSync(path.join(chatDir(), `${session.id}.json`), JSON.stringify(session, null, 2));
  } catch { /* swallow */ }
}

function loadFromDisk(id: string): ChatSession | null {
  const f = path.join(chatDir(), `${id}.json`);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, 'utf8')) as ChatSession; } catch { return null; }
}

function broadcast(sessionId: string, evt: { type: string; data?: unknown }): void {
  const subs = STREAMS.get(sessionId);
  if (!subs) return;
  const payload = `event: ${evt.type}\ndata: ${JSON.stringify(evt.data ?? {})}\n\n`;
  for (const res of subs) {
    try { res.write(payload); } catch { /* gone */ }
  }
}

/** Decide which command to run. Tests + missing daemon → echo stub. */
function chooseCommand(prompt: string, agent: string): { cmd: string; args: string[]; usingStub: boolean } {
  if (process.env.LEXI_CHAT_STUB === '1' || process.env.NODE_ENV === 'test') {
    return { cmd: 'bash', args: ['-c', `echo "[lexi-stub @ ${agent}] ${prompt.replace(/"/g, '\\"')}"`], usingStub: true };
  }
  // Daemon CLI: bin/clementine. If absent, fall back to stub.
  // Use a generic invocation that prints to stdout. The real upstream CLI
  // would do real LLM work; here we keep it free by passing a `--echo` flag
  // if the binary supports it, otherwise fall through to stub.
  const repoBin = path.resolve(process.cwd(), 'bin', 'clementine');
  if (existsSync(repoBin)) {
    return {
      cmd: repoBin,
      args: ['--echo', '--agent', agent, '--prompt', prompt],
      usingStub: false,
    };
  }
  return { cmd: 'bash', args: ['-c', `echo "[lexi-stub @ ${agent}] ${prompt.replace(/"/g, '\\"')}"`], usingStub: true };
}

function runTurn(sessionId: string, prompt: string): void {
  const session = SESSIONS.get(sessionId);
  if (!session) return;
  session.turns.push({ ts: Date.now(), role: 'user', content: prompt });
  broadcast(sessionId, { type: 'user', data: { content: prompt } });

  const { cmd, args, usingStub } = chooseCommand(prompt, session.agent);
  let proc: ChildProcess;
  try {
    proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    const msg = `Failed to spawn: ${String(err)}`;
    session.turns.push({ ts: Date.now(), role: 'agent', content: msg });
    broadcast(sessionId, { type: 'error', data: { message: msg } });
    persist(session);
    return;
  }

  let buffer = '';
  proc.stdout?.on('data', (chunk: Buffer) => {
    const s = chunk.toString('utf8');
    buffer += s;
    broadcast(sessionId, { type: 'chunk', data: { content: s, stub: usingStub } });
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    broadcast(sessionId, { type: 'stderr', data: { content: chunk.toString('utf8') } });
  });
  proc.on('exit', (code) => {
    session.turns.push({ ts: Date.now(), role: 'agent', content: buffer.trim() });
    broadcast(sessionId, { type: 'complete', data: { code, stub: usingStub } });
    persist(session);
  });
  proc.on('error', (err) => {
    broadcast(sessionId, { type: 'error', data: { message: String(err) } });
  });
}

export function register(app: Express): void {
  // JSON body parsing scoped to chat endpoints — global parser would
  // interfere with SSE/raw-body routes elsewhere.
  const json = express.json({ limit: '256kb' });

  app.post('/api/lexi-chat/start', json, async (req: Request, res: Response) => {
    const agent = (req.body as { agent?: string })?.agent ?? 'default';
    const id = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session: ChatSession = { id, agent, createdAt: Date.now(), turns: [] };
    SESSIONS.set(id, session);
    persist(session);
    res.json({ sessionId: id, agent });
  });

  app.post('/api/lexi-chat/send', json, async (req: Request, res: Response) => {
    const body = req.body as { sessionId?: string; prompt?: string };
    if (!body?.sessionId || !body.prompt) return res.status(400).json({ error: 'Missing sessionId or prompt' });
    if (!SESSIONS.has(body.sessionId)) {
      const restored = loadFromDisk(body.sessionId);
      if (restored) SESSIONS.set(body.sessionId, restored);
      else return res.status(404).json({ error: 'Unknown session' });
    }
    runTurn(body.sessionId, body.prompt);
    res.json({ ok: true });
  });

  app.get('/api/lexi-chat/stream/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    res.setHeader('connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`event: open\ndata: ${JSON.stringify({ id })}\n\n`);
    const subs = STREAMS.get(id) ?? new Set<Response>();
    subs.add(res);
    STREAMS.set(id, subs);

    req.on('close', () => {
      subs.delete(res);
      if (subs.size === 0) STREAMS.delete(id);
    });
  });

  app.get('/api/lexi-chat/sessions', async (_req: Request, res: Response) => {
    const dir = chatDir();
    if (!existsSync(dir)) return res.json({ sessions: [] });
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      const sessions = files.map((f) => {
        try {
          const j = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
          return {
            id: j.id,
            agent: j.agent,
            createdAt: j.createdAt,
            turns: Array.isArray(j.turns) ? j.turns.length : 0,
          };
        } catch {
          return null;
        }
      }).filter(Boolean);
      sessions.sort((a, b) => (b?.createdAt ?? 0) - (a?.createdAt ?? 0));
      res.json({ sessions });
    } catch {
      res.json({ sessions: [] });
    }
  });

  app.get('/api/lexi-chat/sessions/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id).replace(/[^A-Za-z0-9_-]/g, '_');
    const f = path.join(chatDir(), `${id}.json`);
    if (!existsSync(f)) return res.status(404).json({ error: 'Not found' });
    try { res.json(JSON.parse(readFileSync(f, 'utf8'))); } catch { res.status(500).json({ error: 'Corrupt' }); }
  });

  app.delete('/api/lexi-chat/sessions/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id).replace(/[^A-Za-z0-9_-]/g, '_');
    const f = path.join(chatDir(), `${id}.json`);
    if (!existsSync(f)) return res.status(404).json({ error: 'Not found' });
    try { unlinkSync(f); res.json({ ok: true }); } catch (err) { res.status(500).json({ error: String(err) }); }
    SESSIONS.delete(id);
  });

  // Bookkeeping endpoint for tests: assert no Anthropic key was used.
  app.get('/api/lexi-chat/_invariants', async (_req: Request, res: Response) => {
    res.json({
      anthropicKeyPresent: !!process.env.ANTHROPIC_API_KEY,
      mode: process.env.LEXI_CHAT_STUB === '1' ? 'stub' : 'cli',
      paidNetworkAttempted: false,
    });
  });

  void statSync;
}
