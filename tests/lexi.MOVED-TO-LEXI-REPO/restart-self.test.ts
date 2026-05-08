import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';

describe('POST /api/restart-self', () => {
  let server: LexiServer;
  let baseUrl: string;
  beforeAll(async () => {
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });
  afterAll(async () => { await server.stop(); });

  it('returns 202 with planned label when LEXI_NO_RESTART=1 (test mode)', async () => {
    const prev = process.env.LEXI_NO_RESTART;
    process.env.LEXI_NO_RESTART = '1';
    try {
      const res = await fetch(`${baseUrl}/api/restart-self`, { method: 'POST' });
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.label).toBe('com.lexi.dashboard');
      expect(body.dryRun).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.LEXI_NO_RESTART;
      else process.env.LEXI_NO_RESTART = prev;
    }
  });

  it('does not match GET (only POST is registered)', async () => {
    const res = await fetch(`${baseUrl}/api/restart-self`, { method: 'GET' });
    expect(res.status).toBe(404);
  });
});
