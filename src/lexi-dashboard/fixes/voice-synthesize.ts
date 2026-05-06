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
