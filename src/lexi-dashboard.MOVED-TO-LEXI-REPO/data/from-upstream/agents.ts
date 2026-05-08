/**
 * Agents data source — reads agent definitions from the vault.
 *
 * Wraps existing src/lexi-dashboard/agents/vault-store.ts so callers don't
 * need to know it exists. Future expansion (per-agent KPIs, transcripts,
 * audit summary, etc.) lands here in Phase 14.
 */

export interface AgentSummary {
  slug: string;
  name: string;
  model: string;
  toolsEnabled: number;
  toolsDisabled: number;
  memorySizeBytes: number;
  lastModifiedAt: number;
  lastActiveAt: number | null;
  uptimeMs: number;
}

export async function listAgents(): Promise<AgentSummary[]> {
  try {
    const mod = await import('../../agents/vault-store.js');
    const list = (mod as unknown as { listAgentsFromVault: () => Promise<unknown[]> }).listAgentsFromVault;
    if (typeof list !== 'function') return [];
    const raw = await list();
    return (raw as Record<string, unknown>[]).map((a) => ({
      slug: String(a.slug ?? ''),
      name: String(a.name ?? ''),
      model: String(a.model ?? 'unknown'),
      toolsEnabled: Number(a.tools_enabled ?? a.toolsEnabled ?? 0),
      toolsDisabled: Number(a.tools_disabled ?? a.toolsDisabled ?? 0),
      memorySizeBytes: Number(a.memory_size_bytes ?? 0),
      lastModifiedAt: Number(a.last_modified_at ?? 0),
      lastActiveAt: a.last_active_at == null ? null : Number(a.last_active_at),
      uptimeMs: Number(a.uptime_ms ?? 0),
    }));
  } catch {
    return [];
  }
}

export async function getAgent(slug: string): Promise<AgentSummary | null> {
  const agents = await listAgents();
  return agents.find((a) => a.slug === slug) ?? null;
}
