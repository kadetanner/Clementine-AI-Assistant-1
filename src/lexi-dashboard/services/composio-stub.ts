/**
 * Stub replacement for src/integrations/composio/client during the Lexi
 * migration. Composio integration is out of scope for the Lexi vision
 * roadmap (Track 2C may revisit). All methods return a "not configured"
 * sentinel so the connections view degrades gracefully.
 *
 * Consumed API surface (from connection-registry.ts and probe.ts):
 *   - isComposioEnabled() → boolean
 *   - listConnectedToolkits() → Promise<ConnectedToolkit[]>
 */

export interface ConnectedToolkit {
  slug: string;
  connectionId: string;
  status: string;
  alias?: string;
  accountLabel?: string;
  accountEmail?: string;
  accountName?: string;
  accountAvatarUrl?: string;
  createdAt?: string;
}

export function isComposioEnabled(): boolean {
  return false;
}

export async function listConnectedToolkits(): Promise<ConnectedToolkit[]> {
  return [];
}
