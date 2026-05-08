import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startLexiServer, type LexiServer } from '../../src/lexi-dashboard/server.js';

describe('GET /api/doctor', () => {
  let server: LexiServer;
  let baseUrl: string;
  beforeAll(async () => {
    server = await startLexiServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });
  afterAll(async () => { await server.stop(); });

  it('returns 200 with checks array of length 9', async () => {
    const res = await fetch(`${baseUrl}/api/doctor`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.checks)).toBe(true);
    expect(body.checks).toHaveLength(9);
  });

  it('every check has name + status (green|yellow|red)', async () => {
    const body = await (await fetch(`${baseUrl}/api/doctor`)).json();
    for (const c of body.checks) {
      expect(typeof c.name).toBe('string');
      expect(['green', 'yellow', 'red']).toContain(c.status);
    }
  });

  it('overall is the worst of all check statuses', async () => {
    const body = await (await fetch(`${baseUrl}/api/doctor`)).json();
    const worst = body.checks.some((c: { status: string }) => c.status === 'red')
      ? 'red'
      : body.checks.some((c: { status: string }) => c.status === 'yellow') ? 'yellow' : 'green';
    expect(body.overall).toBe(worst);
  });

  it('check names cover the 9 spec areas', async () => {
    const body = await (await fetch(`${baseUrl}/api/doctor`)).json();
    const names = body.checks.map((c: { name: string }) => c.name);
    const expected = ['process','port','mcp_servers','falkordb_graph','redis_socket','vault_directory','cron_last_fire','autonomy_ledger','log_growth'];
    for (const e of expected) expect(names).toContain(e);
  });
});
