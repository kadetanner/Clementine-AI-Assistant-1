import { describe, it, expect, vi } from 'vitest';
import { listConnections, type Connection } from '../../../src/lexi-dashboard/services/connection-registry.js';

vi.mock('../../../src/agent/mcp-bridge.js', () => ({
  discoverMcpServers: () => [
    { name: 'neon', type: 'stdio', command: 'npx', args: ['neon-mcp'], enabled: true, description: 'Neon MCP' },
    { name: 'figma', type: 'http', url: 'https://figma.dev/mcp', enabled: false, description: 'Figma' },
  ],
  getClaudeIntegrations: () => [
    { name: 'Slack', label: 'Slack', tools: ['slack_send_message','slack_read_channel'], firstSeen: '2026-01-01', lastUsed: '2026-04-30', connected: true },
  ],
}));

vi.mock('../../../src/lexi-dashboard/services/composio-stub.js', () => ({
  isComposioEnabled: () => true,
  listConnectedToolkits: async () => [
    { slug: 'gmail', status: 'ACTIVE' },
    { slug: 'notion', status: 'INITIATED' },
  ],
}));

describe('connection-registry', () => {
  it('returns one entry per MCP server', async () => {
    const list = await listConnections();
    const mcp = list.filter((c: Connection) => c.kind === 'mcp');
    expect(mcp.map((c) => c.id).sort()).toEqual(['mcp:figma','mcp:neon']);
  });

  it('returns one entry per Composio toolkit with status mapped', async () => {
    const list = await listConnections();
    const composio = list.filter((c: Connection) => c.kind === 'composio');
    const gmail = composio.find((c) => c.id === 'composio:gmail');
    expect(gmail?.status).toBe('connected');
    const notion = composio.find((c) => c.id === 'composio:notion');
    expect(notion?.status).toBe('degraded');
  });

  it('returns OAuth entries for salesforce/discord/slack/gmail', async () => {
    const list = await listConnections();
    const oauthIds = list.filter((c) => c.kind === 'oauth').map((c) => c.id).sort();
    expect(oauthIds).toEqual(['oauth:discord','oauth:gmail','oauth:salesforce','oauth:slack']);
  });

  it('every entry has id, kind, name, status, tool_count, last_check_at', async () => {
    const list = await listConnections();
    for (const c of list) {
      expect(typeof c.id).toBe('string');
      expect(['mcp','composio','oauth']).toContain(c.kind);
      expect(typeof c.name).toBe('string');
      expect(['connected','degraded','disconnected']).toContain(c.status);
      expect(typeof c.tool_count).toBe('number');
      expect(typeof c.last_check_at === 'string' || c.last_check_at === null).toBe(true);
    }
  });
});
