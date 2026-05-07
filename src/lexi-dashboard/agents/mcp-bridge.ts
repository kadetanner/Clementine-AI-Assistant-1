/**
 * Lexi — MCP Bridge shim (seam-cut boundary).
 *
 * Re-exports the subset of src/agent/mcp-bridge.ts that lexi-dashboard
 * consumes. This file is the single cross-tree import point; all lexi-
 * dashboard callers import from here instead of reaching directly into
 * src/agent/. When src/lexi-dashboard/ moves to the lexi monorepo, replace
 * this shim with a fully-inlined copy of the needed exports.
 *
 * Consumed by:
 *   src/lexi-dashboard/services/probe.ts           — discoverMcpServers
 *   src/lexi-dashboard/services/connection-registry.ts — discoverMcpServers, getClaudeIntegrations
 */

export type { ClaudeIntegration } from '../../agent/mcp-bridge.js';
export { discoverMcpServers, getClaudeIntegrations } from '../../agent/mcp-bridge.js';
