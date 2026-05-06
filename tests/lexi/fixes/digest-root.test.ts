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
