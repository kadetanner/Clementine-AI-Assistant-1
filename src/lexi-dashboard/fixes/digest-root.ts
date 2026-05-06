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
