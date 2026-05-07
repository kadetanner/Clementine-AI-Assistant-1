import { discoverMcpServers, getClaudeIntegrations } from '../../agent/mcp-bridge.js';
import * as composio from './composio-stub.js';

export type ConnectionKind = 'mcp' | 'composio' | 'oauth';
export type ConnectionStatus = 'connected' | 'degraded' | 'disconnected';

export interface Connection {
  id: string;
  kind: ConnectionKind;
  name: string;
  status: ConnectionStatus;
  last_check_at: string | null;
  tool_count: number;
  error_message?: string;
}

const lastCheck = new Map<string, string>();

export function recordCheck(id: string, at: string = new Date().toISOString()): void {
  lastCheck.set(id, at);
}

function mcpStatus(server: { enabled?: boolean }): ConnectionStatus {
  if (server.enabled === false) return 'disconnected';
  return 'connected';
}

function composioStatus(raw: string): ConnectionStatus {
  if (raw === 'ACTIVE') return 'connected';
  if (raw === 'INITIATED' || raw === 'EXPIRED') return 'degraded';
  return 'disconnected';
}

const OAUTH_PROVIDERS: Array<{ slug: string; name: string }> = [
  { slug: 'salesforce', name: 'Salesforce' },
  { slug: 'discord', name: 'Discord' },
  { slug: 'slack', name: 'Slack' },
  { slug: 'gmail', name: 'Gmail' },
];

export async function listConnections(): Promise<Connection[]> {
  const out: Connection[] = [];

  // MCP servers
  let mcpServers: ReturnType<typeof discoverMcpServers> = [];
  try { mcpServers = discoverMcpServers(); } catch { /* upstream unavailable */ }
  const integrations = (() => { try { return getClaudeIntegrations(); } catch { return []; } })();
  const integrationByName = new Map(integrations.map((i) => [i.name.toLowerCase(), i]));
  for (const s of mcpServers) {
    const id = `mcp:${s.name}`;
    const integ = integrationByName.get(s.name.toLowerCase());
    out.push({
      id, kind: 'mcp', name: s.name,
      status: mcpStatus(s),
      last_check_at: lastCheck.get(id) ?? null,
      tool_count: integ?.tools.length ?? 0,
    });
  }

  // Composio toolkits
  if (composio.isComposioEnabled()) {
    try {
      const toolkits = await composio.listConnectedToolkits();
      for (const tk of toolkits) {
        const id = `composio:${tk.slug}`;
        out.push({
          id, kind: 'composio', name: tk.slug,
          status: composioStatus(tk.status),
          last_check_at: lastCheck.get(id) ?? null,
          tool_count: 0,
        });
      }
    } catch (err) {
      out.push({
        id: 'composio:_error', kind: 'composio', name: 'composio',
        status: 'disconnected', last_check_at: null, tool_count: 0,
        error_message: String(err),
      });
    }
  }

  // OAuth providers — surface as a per-provider entry; status filled in by probe
  for (const p of OAUTH_PROVIDERS) {
    const id = `oauth:${p.slug}`;
    out.push({
      id, kind: 'oauth', name: p.name,
      status: 'disconnected',
      last_check_at: lastCheck.get(id) ?? null,
      tool_count: 0,
    });
  }

  return out;
}
