export const EVENT_TYPES = [
  'agent_activity',
  'mcp_call_start',
  'mcp_call_complete',
  'mcp_call_error',
  'cron_tick',
  'webhook_received',
  'workflow_state',
] as const;

export type LexiEventType = (typeof EVENT_TYPES)[number];

export interface LexiEvent {
  type: LexiEventType;
  ts: number;
  payload: unknown;
}

export function isLexiEventType(t: string): t is LexiEventType {
  return (EVENT_TYPES as readonly string[]).includes(t);
}
