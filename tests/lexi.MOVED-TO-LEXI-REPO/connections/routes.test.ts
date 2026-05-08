import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../../../src/agent/mcp-bridge.js', () => ({
  discoverMcpServers: () => [{ name: 'neon', type: 'stdio', command: 'echo', enabled: true }],
  getClaudeIntegrations: () => [],
}));
vi.mock('../../../src/integrations/composio/client.js', () => ({
  isComposioEnabled: () => false,
  listConnectedToolkits: async () => [],
}));

import { startLexiServer, type LexiServer } from '../../../src/lexi-dashboard/server.js';

describe('/api/connections routes', () => {
  let server: LexiServer; let baseUrl: string;
  beforeAll(async () => { server = await startLexiServer({ port: 0 }); baseUrl = `http://localhost:${server.port}`; });
  afterAll(async () => { await server.stop(); });

  it('GET /api/connections returns the unified list', async () => {
    const r = await fetch(`${baseUrl}/api/connections`);
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.connections)).toBe(true);
    expect(body.connections.find((c: { id: string }) => c.id === 'mcp:neon')).toBeTruthy();
  });

  it('POST /api/connections/:id/probe returns updated status', async () => {
    const r = await fetch(`${baseUrl}/api/connections/mcp:neon/probe`, { method: 'POST' });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(['connected','degraded','disconnected']).toContain(body.status);
    expect(body.last_check_at).toBeTruthy();
  });

  it('GET /api/connections/:id/credentials returns masked values only', async () => {
    process.env.SF_CLIENT_SECRET = 'sk-prod-supersecret-9999';
    const r = await fetch(`${baseUrl}/api/connections/oauth:salesforce/credentials`);
    expect(r.status).toBe(200);
    const body = await r.json();
    const blob = JSON.stringify(body);
    expect(blob).not.toContain('supersecret');
    delete process.env.SF_CLIENT_SECRET;
  });

  it('PUT /api/connections/:id/credentials with invalid body returns 400', async () => {
    const r = await fetch(`${baseUrl}/api/connections/oauth:salesforce/credentials`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ not_a_credentials_object: true }),
    });
    expect(r.status).toBe(400);
  });

  it('GET /api/connections/:id/credentials for unknown id returns 404', async () => {
    const r = await fetch(`${baseUrl}/api/connections/mcp:does-not-exist/credentials`);
    expect(r.status).toBe(404);
  });
});
