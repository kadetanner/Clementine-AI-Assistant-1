// tests/lexi/e2e/helpers/route-list.ts
// Source of truth for the 24 mounted dashboard routes covered by the
// 2026-05 polish audit. Imported by every per-view E2E/a11y/visual spec.

export const LEXI_ROUTES = [
  { route: 'agents',     tag: 'lexi-agents-view' },
  { route: 'connections',tag: 'lexi-connections-view' },
  { route: 'cron',       tag: 'lexi-cron-view' },
  { route: 'memory',     tag: 'lexi-memory-view' },
  { route: 'settings',   tag: 'lexi-settings-view' },
  { route: 'vault',      tag: 'lexi-vault-view' },
  { route: 'workflows',  tag: 'lexi-workflows-view' },
  { route: 'advisor',    tag: 'lexi-advisor-view' },
  { route: 'approvals',  tag: 'lexi-approvals-view' },
  { route: 'brain',      tag: 'lexi-brain-view' },
  { route: 'budget',     tag: 'lexi-budget-view' },
  { route: 'build',      tag: 'lexi-build-view' },
  { route: 'chat',       tag: 'lexi-chat-view' },
  { route: 'claims',     tag: 'lexi-claims-view' },
  { route: 'heartbeat',  tag: 'lexi-heartbeat-view' },
  { route: 'logs',       tag: 'lexi-logs-view' },
  { route: 'plans',      tag: 'lexi-plans-view' },
  { route: 'projects',   tag: 'lexi-projects-view' },
  { route: 'routines',   tag: 'lexi-routines-view' },
  { route: 'search',     tag: 'lexi-search-view' },
  { route: 'skills',     tag: 'lexi-skills-view' },
  { route: 'team',       tag: 'lexi-team-view' },
  { route: 'today',      tag: 'lexi-today-view' },
  { route: 'trace',      tag: 'lexi-trace-view' },
] as const;

export type LexiRoute = typeof LEXI_ROUTES[number];
