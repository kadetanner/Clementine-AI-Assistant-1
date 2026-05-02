# Lexi Dashboard — Plan 8: Bug Fixes for the 5 Broken Endpoints

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every endpoint that the diagnostic flagged 404 (excluding `/api/doctor`, owned by Plan 2) and add a systemic recovery surface for stuck cron jobs. After this plan, the home Today panel renders, the speak-digest button produces audio, root list endpoints respond, and a runaway cron (e.g. `insight-check` "Prompt is too long") gets quarantined instead of burning forever.

**Architecture:** All net-new files in `src/lexi-dashboard/fixes/` (server) and `src/lexi-dashboard/ui/components/` (banner). Every route is registered through Plan 1's `startLexiServer` via a `registerFixes(app, deps)` aggregator; **no upstream files are touched** beyond the additive edits already authorised in Plan 1. Routes coexist with upstream — when Lexi runs on its own port (3030) the upstream router is irrelevant. When the user runs the legacy `clementine dashboard` separately, our routes never collide because they live under a different process.

**Tech stack:** Same as Plan 1 (TypeScript, Express, Lit). New runtime deps: none. New dev deps: none (uses `vitest` + `node:fs` only).

**Spec reference:** `docs/lexi/specs/2026-05-02-lexi-dashboard-design.md` §7 (Bug fixes), §9 item 6 (DoD).

**Plans depended on:** 1 (foundation/server), 2 (introduces `src/lexi-dashboard/fixes/` directory pattern with `doctor.ts`).

---

## Conventions inherited from Plan 1

- Files: kebab-case under `src/lexi-dashboard/fixes/` and `src/lexi-dashboard/ui/components/`.
- Components: `lexi-` prefixed Lit elements rendering into the light DOM (`createRenderRoot() { return this; }`).
- API routes: `/api/<resource>` — no `/lexi/` prefix.
- SSE event shape: `{ type: string; ts: number; payload: unknown }`.
- Tests: `tests/lexi/fixes/*.test.ts` and `tests/lexi/components/*.test.ts`. Use `execFileSync`, `replaceChildren()` + `createElement()`, never `innerHTML`.
- Imports from upstream are read-only and reach into `../<area>/<file>.js`. We never re-export upstream identifiers.
- Commits: conventional (`feat(lexi):`, `fix(lexi):`, `test(lexi):`).

## File structure (created in this plan)

```
src/lexi-dashboard/
  fixes/
    daily-plan.ts             ← GET /api/daily-plan
    voice-synthesize.ts       ← POST /api/voice/synthesize
    digest-root.ts            ← GET /api/digest
    goals-root.ts             ← GET /api/goals
    cron-recovery.ts          ← stuck-job detector + GET /api/cron/stuck
    register.ts               ← aggregator: registerFixes(app, deps)
  ui/components/
    lexi-stuck-banner.ts      ← red banner shown on Home + Cron when stuck jobs exist
tests/lexi/
  fixes/
    daily-plan.test.ts
    voice-synthesize.test.ts
    digest-root.test.ts
    goals-root.test.ts
    cron-recovery.test.ts
  components/
    lexi-stuck-banner.test.ts
```

State files written under `~/.clementine/`:

- `~/.clementine/cache/voice/<sha256[:16]>.mp3` — TTS output (path matches upstream's `/api/voice/audio/:hash` serve — verified in Task 2).
- `~/.clementine/lexi-stuck-jobs.json` — `{ jobs: [{ name, errorMessage, errorCount, firstSeenAt, lastSeenAt, suspendedUntil }] }`.

---

## Task 1 — `/api/daily-plan` GET (Today panel)

**Files:** Create `src/lexi-dashboard/fixes/daily-plan.ts`, `tests/lexi/fixes/daily-plan.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/fixes/daily-plan.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { registerDailyPlan } from '../../../src/lexi-dashboard/fixes/daily-plan.js';

let dir: string; let server: Server; let baseUrl: string;

async function listen(app: express.Express): Promise<{ server: Server; url: string }> {
  return await new Promise((resolve) => {
    const s = createServer(app);
    s.listen(0, () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server: s, url: `http://localhost:${port}` });
    });
  });
}

describe('/api/daily-plan', () => {
  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'lexi-dp-'));
    mkdirSync(path.join(dir, 'vault', '01-Daily-Notes'), { recursive: true });
    const app = express();
    registerDailyPlan(app, { baseDir: dir });
    const r = await listen(app);
    server = r.server; baseUrl = r.url;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty plan when today has no daily note', async () => {
    const res = await fetch(`${baseUrl}/api/daily-plan`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ goals: [], tasks: [], notes: '' });
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('parses goals, tasks and notes from todays note', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const note = [
      '---', 'date: ' + today, 'mood: focused', '---', '',
      '## Goals', '- Ship Lexi plan 8', '- Review Cantor PRs', '',
      '## Tasks', '- [ ] Wire daily-plan endpoint', '- [x] Read spec', '- [ ] Write tests', '',
      '## Notes', 'Sticky thought of the day.',
    ].join('\n');
    writeFileSync(path.join(dir, 'vault', '01-Daily-Notes', today + '.md'), note);
    const res = await fetch(`${baseUrl}/api/daily-plan`);
    const body = await res.json();
    expect(body.date).toBe(today);
    expect(body.goals).toEqual(['Ship Lexi plan 8', 'Review Cantor PRs']);
    expect(body.tasks).toEqual([
      { text: 'Wire daily-plan endpoint', done: false },
      { text: 'Read spec', done: true },
      { text: 'Write tests', done: false },
    ]);
    expect(body.notes).toContain('Sticky thought of the day');
    expect(body.frontmatter).toMatchObject({ date: today, mood: 'focused' });
  });

  it('falls back to ?date= query for any historical YYYY-MM-DD', async () => {
    const d = '2024-01-15';
    writeFileSync(path.join(dir, 'vault', '01-Daily-Notes', d + '.md'), '## Goals\n- Old goal\n');
    const res = await fetch(`${baseUrl}/api/daily-plan?date=${d}`);
    const body = await res.json();
    expect(body.date).toBe(d);
    expect(body.goals).toEqual(['Old goal']);
  });

  it('rejects malformed date with 400', async () => {
    const res = await fetch(`${baseUrl}/api/daily-plan?date=not-a-date`);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/fixes/daily-plan.test.ts` → fail (module missing).
- [ ] **Step 3:** Create `src/lexi-dashboard/fixes/daily-plan.ts`:

```ts
import type { Express } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface DailyPlanDeps { baseDir: string; }

export interface DailyPlan {
  date: string;
  goals: string[];
  tasks: Array<{ text: string; done: boolean }>;
  notes: string;
  frontmatter: Record<string, string>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseFrontmatter(src: string): { fm: Record<string, string>; body: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, body: src };
  const fm: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { fm, body: src.slice(m[0].length) };
}

function section(body: string, name: string): string {
  const re = new RegExp('##\\s+' + name + '\\s*\\n([\\s\\S]*?)(?:\\n##\\s|$)', 'i');
  const m = body.match(re);
  return m ? m[1].trim() : '';
}

export function parseDailyNote(src: string, date: string): DailyPlan {
  const { fm, body } = parseFrontmatter(src);
  const goals = section(body, 'Goals')
    .split('\n')
    .map((l) => l.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
  const tasks = section(body, 'Tasks')
    .split('\n')
    .map((l) => l.match(/^[-*]\s+\[( |x|X)\]\s+(.+)$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ text: m[2].trim(), done: m[1].toLowerCase() === 'x' }));
  const notes = section(body, 'Notes');
  return { date, goals, tasks, notes, frontmatter: fm };
}

export function registerDailyPlan(app: Express, deps: DailyPlanDeps): void {
  app.get('/api/daily-plan', (req, res) => {
    const q = typeof req.query.date === 'string' ? req.query.date : '';
    const date = q || new Date().toISOString().slice(0, 10);
    if (!DATE_RE.test(date)) {
      res.status(400).json({ ok: false, error: 'date must be YYYY-MM-DD' });
      return;
    }
    const file = path.join(deps.baseDir, 'vault', '01-Daily-Notes', date + '.md');
    if (!existsSync(file)) {
      res.json({ date, goals: [], tasks: [], notes: '', frontmatter: {} });
      return;
    }
    const src = readFileSync(file, 'utf-8');
    res.json(parseDailyNote(src, date));
  });
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/fixes/daily-plan.test.ts` → 4 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/fixes/daily-plan.ts tests/lexi/fixes/daily-plan.test.ts
git commit -m "fix(lexi): implement /api/daily-plan reading 01-Daily-Notes"
```

---

## Task 2 — `/api/voice/synthesize` POST (TTS)

**Files:** Create `src/lexi-dashboard/fixes/voice-synthesize.ts`, `tests/lexi/fixes/voice-synthesize.test.ts`.

**Decision (locked here):** Hash = `sha256(provider + ':' + voice + ':' + text).slice(0, 16)` (16 hex chars). This matches upstream's `/api/voice/audio/:hash` regex `[^a-f0-9]` filter (verified at `src/cli/dashboard.ts:8638`) — upstream uses 16-hex random bytes; ours is a content hash that fits the same shape and adds dedup. Files written to `<baseDir>/cache/voice/<hash>.mp3`, the exact path the existing serve route reads (verified at `src/cli/dashboard.ts:8639`).

**Provider selection:** Read `<baseDir>/claude-integrations.json` and `<baseDir>/.env`. If `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` set → ElevenLabs. Else if `OPENAI_API_KEY` set → OpenAI TTS (`tts-1`, voice = body.voice ?? `alloy`). Else 400 with `error: "no TTS provider configured"`.

**Timeout:** 10s via `AbortController`. Network failure → 502 with provider name + status.

- [ ] **Step 1:** Create `tests/lexi/fixes/voice-synthesize.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { registerVoiceSynthesize, hashFor } from '../../../src/lexi-dashboard/fixes/voice-synthesize.js';

let dir: string; let server: Server; let baseUrl: string;
const originalFetch = global.fetch;

async function listen(app: express.Express) {
  return await new Promise<{ server: Server; url: string }>((resolve) => {
    const s = createServer(app);
    s.listen(0, () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server: s, url: `http://localhost:${port}` });
    });
  });
}

function startApp(): Promise<void> {
  const app = express();
  registerVoiceSynthesize(app, { baseDir: dir });
  return listen(app).then((r) => { server = r.server; baseUrl = r.url; });
}

describe('/api/voice/synthesize', () => {
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'lexi-tts-'));
    mkdirSync(path.join(dir, 'cache', 'voice'), { recursive: true });
  });

  afterEach(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    rmSync(dir, { recursive: true, force: true });
    global.fetch = originalFetch;
  });

  it('returns 400 when no provider is configured', async () => {
    writeFileSync(path.join(dir, '.env'), '');
    await startApp();
    const res = await fetch(`${baseUrl}/api/voice/synthesize`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no TTS provider/i);
  });

  it('uses ElevenLabs when configured and writes mp3 at the hash path', async () => {
    writeFileSync(path.join(dir, '.env'),
      'ELEVENLABS_API_KEY=sk-test\nELEVENLABS_VOICE_ID=voice-abc\n');
    let calledUrl = ''; const audio = new Uint8Array([1, 2, 3, 4, 5]);
    global.fetch = vi.fn(async (url: string) => {
      calledUrl = String(url);
      return new Response(audio, { status: 200, headers: { 'content-type': 'audio/mpeg' } });
    }) as unknown as typeof fetch;
    await startApp();
    const res = await fetch(`${baseUrl}/api/voice/synthesize`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hello world' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(calledUrl).toContain('elevenlabs.io');
    expect(calledUrl).toContain('voice-abc');
    expect(body.hash).toMatch(/^[a-f0-9]{16}$/);
    expect(body.url).toBe(`/api/voice/audio/${body.hash}`);
    const writtenPath = path.join(dir, 'cache', 'voice', body.hash + '.mp3');
    expect(existsSync(writtenPath)).toBe(true);
    // Hash matches the pure helper
    expect(body.hash).toBe(hashFor('elevenlabs', 'voice-abc', 'hello world'));
  });

  it('falls back to OpenAI when ElevenLabs absent and OPENAI_API_KEY present', async () => {
    writeFileSync(path.join(dir, '.env'), 'OPENAI_API_KEY=sk-openai\n');
    let calledUrl = '';
    global.fetch = vi.fn(async (url: string) => {
      calledUrl = String(url);
      return new Response(new Uint8Array([9, 9, 9]), { status: 200 });
    }) as unknown as typeof fetch;
    await startApp();
    const res = await fetch(`${baseUrl}/api/voice/synthesize`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'morning brief', voice: 'nova' }),
    });
    expect(res.status).toBe(200);
    expect(calledUrl).toContain('api.openai.com');
    const body = await res.json();
    expect(body.hash).toBe(hashFor('openai', 'nova', 'morning brief'));
  });

  it('returns 502 with a clear message when the provider errors', async () => {
    writeFileSync(path.join(dir, '.env'),
      'ELEVENLABS_API_KEY=sk-test\nELEVENLABS_VOICE_ID=v\n');
    global.fetch = vi.fn(async () => new Response('quota', { status: 429 })) as unknown as typeof fetch;
    await startApp();
    const res = await fetch(`${baseUrl}/api/voice/synthesize`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hi' }),
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/elevenlabs/i);
    expect(body.error).toMatch(/429/);
  });

  it('upstream serve route uses the same path: cache/voice/<hash>.mp3', () => {
    // This test pins the contract — if upstream changes the path we must update.
    // Read the upstream source rather than running it (we do not depend on dist).
    const { readFileSync } = require('node:fs');
    const src = readFileSync(path.resolve(__dirname, '../../../src/cli/dashboard.ts'), 'utf-8');
    expect(src).toMatch(/cache.*voice.*\$\{hash\}\.mp3|cache.,\s*'voice',\s*`\$\{hash\}\.mp3`/);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/fixes/voice-synthesize.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/fixes/voice-synthesize.ts`:

```ts
import express, { type Express } from 'express';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface VoiceSynthesizeDeps { baseDir: string; }

export function hashFor(provider: string, voice: string, text: string): string {
  return createHash('sha256').update(`${provider}:${voice}:${text}`).digest('hex').slice(0, 16);
}

interface ResolvedProvider {
  name: 'elevenlabs' | 'openai';
  apiKey: string;
  voice: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

function readEnv(baseDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const file = path.join(baseDir, '.env');
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
  }
  return out;
}

function resolveProvider(env: Record<string, string>, text: string, voiceOverride?: string): ResolvedProvider | null {
  const elKey = env.ELEVENLABS_API_KEY;
  const elVoice = voiceOverride || env.ELEVENLABS_VOICE_ID;
  if (elKey && elVoice) {
    return {
      name: 'elevenlabs', apiKey: elKey, voice: elVoice,
      url: `https://api.elevenlabs.io/v1/text-to-speech/${elVoice}`,
      headers: { 'xi-api-key': elKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_turbo_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    };
  }
  const oaKey = env.OPENAI_API_KEY;
  if (oaKey) {
    const voice = voiceOverride || 'alloy';
    return {
      name: 'openai', apiKey: oaKey, voice,
      url: 'https://api.openai.com/v1/audio/speech',
      headers: { authorization: `Bearer ${oaKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', voice, input: text, response_format: 'mp3' }),
    };
  }
  return null;
}

export function registerVoiceSynthesize(app: Express, deps: VoiceSynthesizeDeps): void {
  app.post('/api/voice/synthesize', express.json({ limit: '256kb' }), async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const voice = typeof req.body?.voice === 'string' ? req.body.voice : undefined;
    if (!text) { res.status(400).json({ ok: false, error: 'text is required' }); return; }

    const env = readEnv(deps.baseDir);
    const provider = resolveProvider(env, text, voice);
    if (!provider) {
      res.status(400).json({ ok: false, error: 'no TTS provider configured (set ELEVENLABS_API_KEY+ELEVENLABS_VOICE_ID or OPENAI_API_KEY in ~/.clementine/.env)' });
      return;
    }

    const hash = hashFor(provider.name, provider.voice, text);
    const cacheDir = path.join(deps.baseDir, 'cache', 'voice');
    if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
    const audioPath = path.join(cacheDir, `${hash}.mp3`);

    if (existsSync(audioPath)) {
      res.json({ ok: true, hash, url: `/api/voice/audio/${hash}`, durationMs: 0, cached: true });
      return;
    }

    const startedAt = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const r = await fetch(provider.url, { method: 'POST', headers: provider.headers, body: provider.body, signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        res.status(502).json({ ok: false, error: `${provider.name} ${r.status}: ${detail.slice(0, 200)}` });
        return;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      writeFileSync(audioPath, buf);
      res.json({ ok: true, hash, url: `/api/voice/audio/${hash}`, durationMs: Date.now() - startedAt, cached: false, provider: provider.name });
    } catch (e) {
      clearTimeout(timer);
      const msg = e instanceof Error && e.name === 'AbortError' ? `${provider.name} timed out after 10s` : String(e);
      res.status(502).json({ ok: false, error: msg });
    }
  });
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/fixes/voice-synthesize.test.ts` → 5 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/fixes/voice-synthesize.ts tests/lexi/fixes/voice-synthesize.test.ts
git commit -m "fix(lexi): implement /api/voice/synthesize with ElevenLabs/OpenAI fallback"
```

---

## Task 3 — `GET /api/digest` root list

**Files:** Create `src/lexi-dashboard/fixes/digest-root.ts`, `tests/lexi/fixes/digest-root.test.ts`.

The root path 404s because upstream's digest router only mounts `/preferences`, `/preview`, `/send`, `/test`, `/voice/*` — no `/`. Lexi's `GET /api/digest` returns a directory of available digest sub-resources plus a small status snapshot derived from `<baseDir>/digest-prefs.json` (the file upstream's digest router persists).

- [ ] **Step 1:** Create `tests/lexi/fixes/digest-root.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { registerDigestRoot } from '../../../src/lexi-dashboard/fixes/digest-root.js';

let dir: string; let server: Server; let baseUrl: string;

async function startApp() {
  const app = express();
  registerDigestRoot(app, { baseDir: dir });
  await new Promise<void>((resolve) => {
    server = createServer(app);
    server.listen(0, () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://localhost:${port}`;
}

describe('/api/digest root', () => {
  beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'lexi-digest-')); });
  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns the sub-endpoint catalog and an empty status when no prefs', async () => {
    await startApp();
    const res = await fetch(`${baseUrl}/api/digest`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.endpoints).toEqual(expect.arrayContaining([
      { method: 'GET', path: '/api/digest/preferences' },
      { method: 'GET', path: '/api/digest/preview' },
      { method: 'POST', path: '/api/digest/send' },
      { method: 'POST', path: '/api/digest/test' },
      { method: 'POST', path: '/api/voice/synthesize' },
    ]));
    expect(body.status).toMatchObject({ configured: false });
  });

  it('reports configured=true and channel summary when digest-prefs.json exists', async () => {
    writeFileSync(
      path.join(dir, 'digest-prefs.json'),
      JSON.stringify({ enabled: true, schedule: '0 8 * * *', channels: { email: true, discord: false, slack: true, voice: false } }),
    );
    await startApp();
    const res = await fetch(`${baseUrl}/api/digest`);
    const body = await res.json();
    expect(body.status.configured).toBe(true);
    expect(body.status.enabled).toBe(true);
    expect(body.status.channels).toEqual(['email', 'slack']);
    expect(body.status.schedule).toBe('0 8 * * *');
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/fixes/digest-root.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/fixes/digest-root.ts`:

```ts
import type { Express } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface DigestRootDeps { baseDir: string; }

export function registerDigestRoot(app: Express, deps: DigestRootDeps): void {
  app.get('/api/digest', (_req, res) => {
    const endpoints = [
      { method: 'GET',  path: '/api/digest/preferences' },
      { method: 'PUT',  path: '/api/digest/preferences' },
      { method: 'GET',  path: '/api/digest/preview' },
      { method: 'POST', path: '/api/digest/send' },
      { method: 'POST', path: '/api/digest/test' },
      { method: 'POST', path: '/api/voice/synthesize' },
      { method: 'GET',  path: '/api/voice/audio/:hash' },
    ];
    const prefsFile = path.join(deps.baseDir, 'digest-prefs.json');
    let status: Record<string, unknown> = { configured: false };
    if (existsSync(prefsFile)) {
      try {
        const prefs = JSON.parse(readFileSync(prefsFile, 'utf-8'));
        const channels: string[] = Object.entries(prefs.channels ?? {})
          .filter(([, v]) => v === true)
          .map(([k]) => k);
        status = {
          configured: true,
          enabled: Boolean(prefs.enabled),
          schedule: typeof prefs.schedule === 'string' ? prefs.schedule : null,
          channels,
        };
      } catch {
        status = { configured: false, error: 'digest-prefs.json malformed' };
      }
    }
    res.json({ ok: true, endpoints, status });
  });
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/fixes/digest-root.test.ts` → 2 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/fixes/digest-root.ts tests/lexi/fixes/digest-root.test.ts
git commit -m "fix(lexi): add GET /api/digest root list endpoint"
```

---

## Task 4 — `GET /api/goals` root list

**Files:** Create `src/lexi-dashboard/fixes/goals-root.ts`, `tests/lexi/fixes/goals-root.test.ts`.

Upstream's goals router has POST `/`, PUT `/:id`, DELETE `/:id`, POST `/:id/generate-crons`, POST `/:id/approve-crons`, GET `/progress` — but no GET `/`. Goals live as files under `<vaultDir>/00-System/goals/<id>.md` with YAML frontmatter `status: active|archived|paused` (per upstream pattern). We list them by reading the directory and parsing frontmatter.

- [ ] **Step 1:** Create `tests/lexi/fixes/goals-root.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { registerGoalsRoot } from '../../../src/lexi-dashboard/fixes/goals-root.js';

let dir: string; let server: Server; let baseUrl: string;

async function startApp() {
  const app = express();
  registerGoalsRoot(app, { vaultDir: path.join(dir, 'vault') });
  await new Promise<void>((resolve) => { server = createServer(app); server.listen(0, () => resolve()); });
  const addr = server.address();
  baseUrl = `http://localhost:${typeof addr === 'object' && addr ? addr.port : 0}`;
}

describe('/api/goals root', () => {
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'lexi-goals-'));
    mkdirSync(path.join(dir, 'vault', '00-System', 'goals'), { recursive: true });
  });
  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty list when no goals exist', async () => {
    await startApp();
    const res = await fetch(`${baseUrl}/api/goals`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, goals: [], count: 0 });
  });

  it('returns active+archived goals merged with status counts', async () => {
    const goalsDir = path.join(dir, 'vault', '00-System', 'goals');
    writeFileSync(path.join(goalsDir, 'g1.md'),
      '---\nid: g1\ntitle: Ship Lexi\nstatus: active\ncreated: 2026-04-01\n---\nbody');
    writeFileSync(path.join(goalsDir, 'g2.md'),
      '---\nid: g2\ntitle: Refactor cron\nstatus: archived\ncreated: 2025-11-12\n---\nbody');
    writeFileSync(path.join(goalsDir, 'g3.md'),
      '---\nid: g3\ntitle: Plan QBR\nstatus: paused\n---\nbody');
    await startApp();
    const res = await fetch(`${baseUrl}/api/goals`);
    const body = await res.json();
    expect(body.count).toBe(3);
    const ids = body.goals.map((g: { id: string }) => g.id).sort();
    expect(ids).toEqual(['g1', 'g2', 'g3']);
    expect(body.byStatus).toMatchObject({ active: 1, archived: 1, paused: 1 });
    const g1 = body.goals.find((g: { id: string }) => g.id === 'g1');
    expect(g1).toMatchObject({ id: 'g1', title: 'Ship Lexi', status: 'active' });
  });

  it('honors ?status=active filter', async () => {
    const goalsDir = path.join(dir, 'vault', '00-System', 'goals');
    writeFileSync(path.join(goalsDir, 'g1.md'), '---\nid: g1\ntitle: A\nstatus: active\n---');
    writeFileSync(path.join(goalsDir, 'g2.md'), '---\nid: g2\ntitle: B\nstatus: archived\n---');
    await startApp();
    const res = await fetch(`${baseUrl}/api/goals?status=active`);
    const body = await res.json();
    expect(body.goals.map((g: { id: string }) => g.id)).toEqual(['g1']);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/fixes/goals-root.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/fixes/goals-root.ts`:

```ts
import type { Express } from 'express';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export interface GoalsRootDeps { vaultDir: string; }

interface GoalSummary {
  id: string;
  title: string;
  status: string;
  created?: string;
  file: string;
}

function parseFrontmatter(src: string): Record<string, string> {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

export function registerGoalsRoot(app: Express, deps: GoalsRootDeps): void {
  app.get('/api/goals', (req, res) => {
    const dir = path.join(deps.vaultDir, '00-System', 'goals');
    const goals: GoalSummary[] = [];
    if (existsSync(dir)) {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.md')) continue;
        const full = path.join(dir, file);
        try {
          const fm = parseFrontmatter(readFileSync(full, 'utf-8'));
          if (!fm.id && !fm.title) continue;
          goals.push({
            id: fm.id || file.replace(/\.md$/, ''),
            title: fm.title || fm.id || file,
            status: fm.status || 'active',
            created: fm.created,
            file,
          });
        } catch { /* skip malformed */ }
      }
    }
    const filterStatus = typeof req.query.status === 'string' ? req.query.status : '';
    const filtered = filterStatus ? goals.filter((g) => g.status === filterStatus) : goals;
    const byStatus: Record<string, number> = {};
    for (const g of goals) byStatus[g.status] = (byStatus[g.status] ?? 0) + 1;
    res.json({ ok: true, goals: filtered, count: filtered.length, byStatus });
  });
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/fixes/goals-root.test.ts` → 3 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/fixes/goals-root.ts tests/lexi/fixes/goals-root.test.ts
git commit -m "fix(lexi): add GET /api/goals root list endpoint"
```

---

## Task 5 — Stuck-cron-job detector + recovery surface

**Files:** Create `src/lexi-dashboard/fixes/cron-recovery.ts`, `tests/lexi/fixes/cron-recovery.test.ts`.

**Detection rule:** Scan `<baseDir>/cron/runs/<job>.jsonl`. For each job, look at entries within the last 30 minutes. If ≥3 entries have `status !== 'ok'` AND share the same normalised error message → mark stuck. State persists at `<baseDir>/lexi-stuck-jobs.json`.

**Surface:**
- `GET /api/cron/stuck` → returns `{ jobs: [...] }`.
- `POST /api/cron/stuck/:job/clear` → removes entry (user pressed Investigate + acknowledged).
- SSE event `cron_job_stuck` emitted via the Plan 3 SSE bus when the detector first marks a job stuck (the bus is injected as `deps.emit?: (event) => void` so this module stays decoupled and unit-testable without SSE).

The detector runs on a 60s interval started by `registerCronRecovery` and stops on `app.on('close', ...)`. We expose `runStuckDetectionOnce(deps)` for tests.

- [ ] **Step 1:** Create `tests/lexi/fixes/cron-recovery.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { registerCronRecovery, runStuckDetectionOnce } from '../../../src/lexi-dashboard/fixes/cron-recovery.js';

let dir: string; let server: Server; let baseUrl: string;
let stopRecovery: (() => void) | undefined;

function writeRuns(job: string, entries: object[]) {
  const file = path.join(dir, 'cron', 'runs', `${job}.jsonl`);
  writeFileSync(file, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

async function startApp(emit?: (e: unknown) => void) {
  const app = express();
  stopRecovery = registerCronRecovery(app, { baseDir: dir, emit, intervalMs: 0 });
  await new Promise<void>((resolve) => { server = createServer(app); server.listen(0, () => resolve()); });
  const addr = server.address();
  baseUrl = `http://localhost:${typeof addr === 'object' && addr ? addr.port : 0}`;
}

describe('cron-recovery', () => {
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'lexi-cron-'));
    mkdirSync(path.join(dir, 'cron', 'runs'), { recursive: true });
  });
  afterEach(async () => {
    if (stopRecovery) stopRecovery();
    if (server) await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    rmSync(dir, { recursive: true, force: true });
  });

  it('does not mark a job stuck for <3 identical errors', async () => {
    const now = Date.now();
    writeRuns('insight-check', [
      { startedAt: new Date(now - 5 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long' },
      { startedAt: new Date(now - 2 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long' },
    ]);
    runStuckDetectionOnce({ baseDir: dir });
    expect(existsSync(path.join(dir, 'lexi-stuck-jobs.json'))).toBe(false);
  });

  it('marks a job stuck when 3+ identical errors occur within 30 min and emits SSE', async () => {
    const emit = vi.fn();
    const now = Date.now();
    writeRuns('insight-check', [
      { startedAt: new Date(now - 20 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long: 12345 tokens' },
      { startedAt: new Date(now - 10 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long: 12345 tokens' },
      { startedAt: new Date(now - 1 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long: 12345 tokens' },
    ]);
    runStuckDetectionOnce({ baseDir: dir, emit });
    const state = JSON.parse(readFileSync(path.join(dir, 'lexi-stuck-jobs.json'), 'utf-8'));
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0].name).toBe('insight-check');
    expect(state.jobs[0].errorCount).toBeGreaterThanOrEqual(3);
    expect(state.jobs[0].errorMessage).toMatch(/Prompt is too long/);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'cron_job_stuck',
      payload: expect.objectContaining({ name: 'insight-check' }),
    }));
  });

  it('does not re-emit SSE on subsequent detections of the same stuck job', async () => {
    const emit = vi.fn();
    const now = Date.now();
    writeRuns('insight-check', [
      { startedAt: new Date(now - 20 * 60_000).toISOString(), status: 'error', error: 'Boom' },
      { startedAt: new Date(now - 10 * 60_000).toISOString(), status: 'error', error: 'Boom' },
      { startedAt: new Date(now - 1 * 60_000).toISOString(), status: 'error', error: 'Boom' },
    ]);
    runStuckDetectionOnce({ baseDir: dir, emit });
    runStuckDetectionOnce({ baseDir: dir, emit });
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('exposes GET /api/cron/stuck and POST /api/cron/stuck/:job/clear', async () => {
    const now = Date.now();
    writeRuns('insight-check', [
      { startedAt: new Date(now - 20 * 60_000).toISOString(), status: 'error', error: 'X' },
      { startedAt: new Date(now - 10 * 60_000).toISOString(), status: 'error', error: 'X' },
      { startedAt: new Date(now - 1 * 60_000).toISOString(), status: 'error', error: 'X' },
    ]);
    runStuckDetectionOnce({ baseDir: dir });
    await startApp();
    const list = await fetch(`${baseUrl}/api/cron/stuck`).then((r) => r.json());
    expect(list.jobs).toHaveLength(1);
    const clear = await fetch(`${baseUrl}/api/cron/stuck/insight-check/clear`, { method: 'POST' });
    expect(clear.status).toBe(200);
    const after = await fetch(`${baseUrl}/api/cron/stuck`).then((r) => r.json());
    expect(after.jobs).toHaveLength(0);
  });

  it('normalises numeric noise so "12345 tokens" and "67890 tokens" group together', async () => {
    const now = Date.now();
    writeRuns('insight-check', [
      { startedAt: new Date(now - 20 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long: 12345 tokens' },
      { startedAt: new Date(now - 10 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long: 67890 tokens' },
      { startedAt: new Date(now - 1 * 60_000).toISOString(), status: 'error', error: 'Prompt is too long: 11111 tokens' },
    ]);
    runStuckDetectionOnce({ baseDir: dir });
    const state = JSON.parse(readFileSync(path.join(dir, 'lexi-stuck-jobs.json'), 'utf-8'));
    expect(state.jobs).toHaveLength(1);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/fixes/cron-recovery.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/fixes/cron-recovery.ts`:

```ts
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
  saveState(deps.baseDir, merged);
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
```

- [ ] **Step 4:** `npm test -- tests/lexi/fixes/cron-recovery.test.ts` → 5 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/fixes/cron-recovery.ts tests/lexi/fixes/cron-recovery.test.ts
git commit -m "fix(lexi): stuck-cron-job detector with /api/cron/stuck recovery surface"
```

---

## Task 6 — `<lexi-stuck-banner>` UI component

**Files:** Create `src/lexi-dashboard/ui/components/lexi-stuck-banner.ts`, `tests/lexi/components/lexi-stuck-banner.test.ts`.

The banner polls `/api/cron/stuck` every 30s and listens for `cron_job_stuck` events on `window` (the Plan 3 SSE client dispatches custom events at that scope). Renders a red bar with count + Investigate button. Investigate button dispatches a `lexi:navigate` event with `{ section: 'cron', focus: jobName }`. Hidden when zero stuck jobs.

- [ ] **Step 1:** Create `tests/lexi/components/lexi-stuck-banner.test.ts`:

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../../../src/lexi-dashboard/ui/components/lexi-stuck-banner.js');
});

const originalFetch = global.fetch;

function mount(): HTMLElement {
  document.body.replaceChildren();
  const el = document.createElement('lexi-stuck-banner');
  document.body.appendChild(el);
  return el;
}

describe('lexi-stuck-banner', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); global.fetch = originalFetch; });

  it('is hidden when there are zero stuck jobs', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, jobs: [] }), { status: 200 })) as unknown as typeof fetch;
    const el = mount();
    await Promise.resolve(); await Promise.resolve();
    await el.updateComplete!;
    expect(getComputedStyle(el).display === 'none' || el.hasAttribute('hidden')).toBe(true);
  });

  it('renders count and Investigate button when stuck jobs exist', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      jobs: [{ name: 'insight-check', errorMessage: 'Prompt is too long', errorCount: 4 }],
    }), { status: 200 })) as unknown as typeof fetch;
    const el = mount();
    await Promise.resolve(); await Promise.resolve();
    await el.updateComplete!;
    expect(el.textContent).toMatch(/1 cron job stuck/);
    expect(el.querySelector('button')?.textContent).toMatch(/Investigate/);
  });

  it('Investigate button dispatches lexi:navigate to cron section with focus', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      jobs: [{ name: 'insight-check', errorMessage: 'X', errorCount: 3 }],
    }), { status: 200 })) as unknown as typeof fetch;
    const el = mount();
    await Promise.resolve(); await Promise.resolve();
    await el.updateComplete!;
    const events: CustomEvent[] = [];
    window.addEventListener('lexi:navigate', (e) => events.push(e as CustomEvent));
    el.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(events).toHaveLength(1);
    expect(events[0].detail).toMatchObject({ section: 'cron', focus: 'insight-check' });
  });

  it('updates immediately when a cron_job_stuck window event fires', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, jobs: [] }), { status: 200 })) as unknown as typeof fetch;
    const el = mount();
    await Promise.resolve(); await el.updateComplete!;
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      ok: true, jobs: [{ name: 'x', errorMessage: 'y', errorCount: 3 }],
    }), { status: 200 })) as unknown as typeof fetch;
    window.dispatchEvent(new CustomEvent('cron_job_stuck', { detail: { name: 'x' } }));
    await Promise.resolve(); await Promise.resolve();
    await el.updateComplete!;
    expect(el.textContent).toMatch(/1 cron job stuck/);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/components/lexi-stuck-banner.test.ts` → fail.
- [ ] **Step 3:** Create `src/lexi-dashboard/ui/components/lexi-stuck-banner.ts`:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

interface StuckJob { name: string; errorMessage: string; errorCount: number; }

@customElement('lexi-stuck-banner')
export class LexiStuckBanner extends LitElement {
  @state() private jobs: StuckJob[] = [];
  private timer?: number;

  static styles = css`
    :host { display: block; }
    :host([hidden]) { display: none; }
    .bar {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 14px; margin: 0 0 12px 0;
      background: color-mix(in srgb, var(--danger) 14%, var(--bg-surface));
      border: 1px solid var(--danger); border-radius: 8px;
      color: var(--text-primary); font-size: 13px;
    }
    .bar strong { color: var(--danger); }
    .grow { flex: 1; }
    button {
      background: var(--danger); color: white;
      border: 0; border-radius: 6px; padding: 4px 10px;
      font: inherit; font-size: 12px; cursor: pointer;
    }
    button:hover { filter: brightness(1.1); }
    .meta { color: var(--text-tertiary); font-size: 11px; }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
    this.timer = window.setInterval(() => void this.refresh(), 30_000);
    window.addEventListener('cron_job_stuck', this.onStuck);
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.timer) window.clearInterval(this.timer);
    window.removeEventListener('cron_job_stuck', this.onStuck);
  }

  private onStuck = () => { void this.refresh(); };

  private async refresh(): Promise<void> {
    try {
      const r = await fetch('/api/cron/stuck');
      if (!r.ok) { this.jobs = []; return; }
      const body = await r.json();
      this.jobs = Array.isArray(body.jobs) ? body.jobs : [];
    } catch { this.jobs = []; }
    this.toggleAttribute('hidden', this.jobs.length === 0);
  }

  private investigate(): void {
    const first = this.jobs[0];
    window.dispatchEvent(new CustomEvent('lexi:navigate', {
      detail: { section: 'cron', focus: first?.name },
    }));
  }

  render() {
    if (this.jobs.length === 0) return html``;
    const top = this.jobs[0];
    const more = this.jobs.length > 1 ? ` (+${this.jobs.length - 1} more)` : '';
    return html`
      <div class="bar" role="alert">
        <strong>${this.jobs.length} cron job${this.jobs.length === 1 ? '' : 's'} stuck</strong>
        <span class="meta">${top.name} · ${top.errorMessage}${more}</span>
        <span class="grow"></span>
        <button type="button" @click=${() => this.investigate()}>Investigate</button>
      </div>
    `;
  }
}
```

- [ ] **Step 4:** `npm test -- tests/lexi/components/lexi-stuck-banner.test.ts` → 4 PASS.
- [ ] **Step 5:** Commit:

```bash
git add src/lexi-dashboard/ui/components/lexi-stuck-banner.ts tests/lexi/components/lexi-stuck-banner.test.ts
git commit -m "feat(lexi): stuck-job banner component for Home + Cron sections"
```

---

## Task 7 — Aggregator + server wiring + smoke

**Files:** Create `src/lexi-dashboard/fixes/register.ts`. Modify `src/lexi-dashboard/server.ts` (one-line addition + dep param). Modify `src/lexi-dashboard/ui/components/lexi-app.ts` (mount the banner above main). Create `tests/lexi/fixes/register.test.ts`.

- [ ] **Step 1:** Create `tests/lexi/fixes/register.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

let server: LexiServer; let baseUrl: string; let baseDir: string;

beforeAll(async () => {
  baseDir = mkdtempSync(path.join(tmpdir(), 'lexi-reg-'));
  mkdirSync(path.join(baseDir, 'vault', '01-Daily-Notes'), { recursive: true });
  mkdirSync(path.join(baseDir, 'cron', 'runs'), { recursive: true });
  process.env.CLEMENTINE_HOME = baseDir;
  server = await startLexiServer({ port: 0 });
  baseUrl = `http://localhost:${server.port}`;
});
afterAll(async () => {
  await server.stop();
  rmSync(baseDir, { recursive: true, force: true });
  delete process.env.CLEMENTINE_HOME;
});

describe('Plan 8 endpoints registered on the live server', () => {
  it('GET /api/daily-plan responds 200', async () => {
    const r = await fetch(`${baseUrl}/api/daily-plan`); expect(r.status).toBe(200);
  });
  it('POST /api/voice/synthesize responds 400 with no provider configured (not 404)', async () => {
    const r = await fetch(`${baseUrl}/api/voice/synthesize`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hi' }),
    });
    expect(r.status).toBe(400);
  });
  it('GET /api/digest responds 200', async () => {
    const r = await fetch(`${baseUrl}/api/digest`); expect(r.status).toBe(200);
  });
  it('GET /api/goals responds 200', async () => {
    const r = await fetch(`${baseUrl}/api/goals`); expect(r.status).toBe(200);
  });
  it('GET /api/cron/stuck responds 200', async () => {
    const r = await fetch(`${baseUrl}/api/cron/stuck`); expect(r.status).toBe(200);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/lexi/fixes/register.test.ts` → fail (5 endpoints all 404).
- [ ] **Step 3:** Create `src/lexi-dashboard/fixes/register.ts`:

```ts
import type { Express } from 'express';
import { registerDailyPlan } from './daily-plan.js';
import { registerVoiceSynthesize } from './voice-synthesize.js';
import { registerDigestRoot } from './digest-root.js';
import { registerGoalsRoot } from './goals-root.js';
import { registerCronRecovery } from './cron-recovery.js';

export interface RegisterFixesDeps {
  baseDir: string;
  emit?: (event: { type: string; ts: number; payload: unknown }) => void;
}

export function registerFixes(app: Express, deps: RegisterFixesDeps): () => void {
  registerDailyPlan(app, { baseDir: deps.baseDir });
  registerVoiceSynthesize(app, { baseDir: deps.baseDir });
  registerDigestRoot(app, { baseDir: deps.baseDir });
  registerGoalsRoot(app, { vaultDir: `${deps.baseDir}/vault` });
  return registerCronRecovery(app, { baseDir: deps.baseDir, emit: deps.emit });
}
```

- [ ] **Step 4:** Edit `src/lexi-dashboard/server.ts` — add the import and one wire-up line inside `startLexiServer`, keeping every existing line untouched. Insert immediately before the `app.get('/health', ...)` registration:

```ts
import os from 'node:os';
import { registerFixes } from './fixes/register.js';

// ... inside startLexiServer:
const baseDir = process.env.CLEMENTINE_HOME ?? path.join(os.homedir(), '.clementine');
const stopFixes = registerFixes(app, { baseDir });
```

And in the returned object's `stop`, call `stopFixes()` before `httpServer.close(...)`.

- [ ] **Step 5:** Edit `src/lexi-dashboard/ui/components/lexi-app.ts` — add `import './lexi-stuck-banner.js';` and place `<lexi-stuck-banner></lexi-stuck-banner>` as the first child inside `<main class="lexi-main">`.

- [ ] **Step 6:** `npm run build && npm test -- tests/lexi/` → all green.
- [ ] **Step 7:** Manual smoke:

```bash
LEXI_PORT=3031 node dist/cli/index.js lexi dashboard &
sleep 1
for p in /api/daily-plan /api/digest /api/goals /api/cron/stuck; do
  echo "$p:" $(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3031$p")
done
curl -s -o /dev/null -w '/api/voice/synthesize: %{http_code}\n' \
  -X POST -H 'content-type: application/json' \
  -d '{"text":"hi"}' http://localhost:3031/api/voice/synthesize
kill %1
```

Expect: four 200s and a 400 (NOT 404) for synthesize when no TTS keys configured.

- [ ] **Step 8:** Commit:

```bash
git add src/lexi-dashboard/fixes/register.ts \
        src/lexi-dashboard/server.ts \
        src/lexi-dashboard/ui/components/lexi-app.ts \
        tests/lexi/fixes/register.test.ts
git commit -m "feat(lexi): wire bug-fix endpoints + stuck-job banner into server"
```

---

## Definition of done for Plan 8

- [ ] All 7 implementation tasks committed
- [ ] `npm test -- tests/lexi/fixes tests/lexi/components/lexi-stuck-banner.test.ts` all green
- [ ] `npm run build` succeeds
- [ ] **Five endpoints from spec §7 verified (no longer 404):**
  - `GET  /api/daily-plan` — returns parsed Today plan from `~/.clementine/vault/01-Daily-Notes/YYYY-MM-DD.md`
  - `POST /api/voice/synthesize` — calls ElevenLabs or OpenAI per `~/.clementine/.env`, writes to `~/.clementine/cache/voice/<hash>.mp3` matching the existing `/api/voice/audio/:hash` serve route, 10s timeout, clear error when no provider configured
  - `GET  /api/digest` — returns endpoint catalog + status snapshot from `digest-prefs.json`
  - `GET  /api/goals` — returns merged goals list across statuses with `byStatus` counts; supports `?status=` filter
  - `GET  /api/cron/stuck` (and `POST /api/cron/stuck/:job/clear`) — surfaces the new stuck-cron recovery state
- [ ] Stuck-cron detector runs on a 60s interval, marks any job emitting ≥3 identical errors within 30 min as `stuck`, persists to `~/.clementine/lexi-stuck-jobs.json`, and emits a single `cron_job_stuck` SSE event per first detection
- [ ] `<lexi-stuck-banner>` mounts above the main content area, hidden by default, polls `/api/cron/stuck` every 30s, refreshes immediately on `cron_job_stuck` window events, and dispatches `lexi:navigate` to the Cron section on Investigate
- [ ] `git diff upstream/main..HEAD --name-only` adds only `src/lexi-dashboard/**` and `tests/lexi/**` files (no upstream files modified beyond Plan 1's authorised set)

## Hand-off to subsequent plans

- Plan 3 (Live view / SSE bus) wires the Plan 1 server's `emit` function through to `registerFixes(app, { baseDir, emit })`, completing the SSE delivery for `cron_job_stuck`. Until Plan 3 lands the banner still works via its 30s poll.
- Plan 7 (Cron section) renders the per-job "Investigate" drawer that the banner navigates to (`lexi:navigate { section: 'cron', focus: <jobName> }`) — drawer shows the failing prompt, the last 3 contexts, and the Clear button (POST `/api/cron/stuck/:job/clear`).
- Plan 6 (Workflows section) adds an analogous detector for autocompact-thrashing workflow steps; pattern is intentionally parallel to this plan's cron detector.
