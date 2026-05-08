import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';

describe('Lexi routes aggregator', () => {
  let server: LexiServer;
  let baseUrl: string;
  beforeAll(async () => {
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });
  afterAll(async () => { await server.stop(); });

  it('mounts /api/doctor (route exists, returns 200 or 5xx not 404)', async () => {
    const res = await fetch(`${baseUrl}/api/doctor`);
    expect(res.status).not.toBe(404);
  });
});
