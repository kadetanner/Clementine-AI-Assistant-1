import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/agent/mcp-bridge.js', () => ({
  discoverMcpServers: () => [
    { name: 'neon', type: 'stdio', command: 'echo', args: ['ok'], enabled: true },
    { name: 'figma', type: 'http', url: 'http://127.0.0.1:1', enabled: true },
    { name: 'broken', type: 'stdio', command: '/nonexistent/path/clearly', args: [], enabled: true },
  ],
  getClaudeIntegrations: () => [],
}));

vi.mock('../../../src/integrations/composio/client.js', () => ({
  isComposioEnabled: () => true,
  listConnectedToolkits: async () => [{ slug: 'gmail', status: 'ACTIVE', connectionId: 'c1', userId: 'u' }],
}));

import { probeConnection } from '../../../src/lexi-dashboard/services/probe.js';

describe('probe', () => {
  beforeEach(() => { vi.useRealTimers(); });

  it('returns connected for an MCP stdio server with an executable command', async () => {
    const r = await probeConnection('mcp:neon');
    expect(['connected','degraded']).toContain(r.status);
    expect(r.last_check_at).toBeTruthy();
  });

  it('returns disconnected for an MCP stdio server whose command is missing', async () => {
    const r = await probeConnection('mcp:broken');
    expect(r.status).toBe('disconnected');
    expect(r.error_message).toBeTruthy();
  });

  it('returns disconnected for an MCP http server whose endpoint is unreachable', async () => {
    const r = await probeConnection('mcp:figma');
    expect(r.status).toBe('disconnected');
  });

  it('returns connected for an ACTIVE composio toolkit', async () => {
    const r = await probeConnection('composio:gmail');
    expect(r.status).toBe('connected');
  });

  it('returns disconnected for an unknown id', async () => {
    const r = await probeConnection('mcp:does-not-exist');
    expect(r.status).toBe('disconnected');
  });

  it('NEVER includes a credential value in error_message', async () => {
    process.env.COMPOSIO_API_KEY = 'sk-test-supersecret-9999';
    const r = await probeConnection('composio:gmail');
    expect(r.error_message ?? '').not.toContain('supersecret');
    delete process.env.COMPOSIO_API_KEY;
  });
});
