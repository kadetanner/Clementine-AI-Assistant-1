import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { registerVoiceSynthesize, hashFor } from '../../../src/lexi-dashboard/fixes/voice-synthesize.js';

let dir: string; let server: Server | undefined; let baseUrl: string;
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
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    rmSync(dir, { recursive: true, force: true });
    global.fetch = originalFetch;
  });

  it('returns 400 when no provider is configured', async () => {
    writeFileSync(path.join(dir, '.env'), '');
    await startApp();
    const res = await originalFetch(`${baseUrl}/api/voice/synthesize`, {
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
    await startApp();
    global.fetch = vi.fn(async (url: string) => {
      calledUrl = String(url);
      return new Response(audio, { status: 200, headers: { 'content-type': 'audio/mpeg' } });
    }) as unknown as typeof fetch;
    const res = await originalFetch(`${baseUrl}/api/voice/synthesize`, {
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
    await startApp();
    global.fetch = vi.fn(async (url: string) => {
      calledUrl = String(url);
      return new Response(new Uint8Array([9, 9, 9]), { status: 200 });
    }) as unknown as typeof fetch;
    const res = await originalFetch(`${baseUrl}/api/voice/synthesize`, {
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
    await startApp();
    global.fetch = vi.fn(async () => new Response('quota', { status: 429 })) as unknown as typeof fetch;
    const res = await originalFetch(`${baseUrl}/api/voice/synthesize`, {
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
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(path.resolve(here, '../../../src/cli/dashboard.ts'), 'utf-8');
    expect(src).toMatch(/cache.*voice.*\$\{hash\}\.mp3|cache.,\s*'voice',\s*`\$\{hash\}\.mp3`/);
  });
});
