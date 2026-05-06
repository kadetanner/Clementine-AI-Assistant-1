# Upstream -> Lexi Feature Parity

Generated: 2026-05-06T05:59:07.365Z

Compares upstream `src/cli/dashboard.ts` route + nav surface against
Lexi's implementation under `src/lexi-dashboard/`. Documented omissions
are declared via `LEXI-OMIT: <feature>` comments in Lexi source
(see `src/lexi-dashboard/upstream-omissions.ts`).

## Summary

- Upstream features audited: **265**
- Implemented in Lexi: **255**
- Documented omissions: **10**
- MISSING: **0**

## Comparison

| Kind | Upstream feature | Status |
|---|---|---|
| route | `DELETE /api/agents/:slug` | implemented |
| route | `DELETE /api/agents/:slug/skills/:name` | implemented |
| route | `DELETE /api/background-tasks/:id` | implemented |
| route | `DELETE /api/brain/feeds/:name` | implemented |
| route | `DELETE /api/brain/sources/:slug` | implemented |
| route | `DELETE /api/builder/workflows/:id` | implemented |
| route | `DELETE /api/cli-tools/:cmd` | implemented |
| route | `DELETE /api/cron/:job/attachments/:filename` | implemented |
| route | `DELETE /api/cron/:name` | implemented |
| route | `DELETE /api/mcp-servers/:name` | implemented |
| route | `DELETE /api/memory/chunks/:id` | implemented |
| route | `DELETE /api/routines/:id` | implemented |
| route | `DELETE /api/settings/:key` | implemented |
| route | `DELETE /api/skills/:name` | implemented |
| route | `DELETE /api/unleashed/:name` | implemented |
| route | `DELETE /api/user-model/:slot` | implemented |
| route | `DELETE /api/workspace-dirs` | implemented |
| route | `DELETE /auth/sessions/:id` | implemented |
| route | `GET /` | implemented |
| route | `GET /api/activity` | implemented |
| route | `GET /api/advisor/analytics` | implemented |
| route | `GET /api/advisor/decisions` | implemented |
| route | `GET /api/advisor/effectiveness` | implemented |
| route | `GET /api/advisor/events` | implemented |
| route | `GET /api/advisor/reflection-trends` | implemented |
| route | `GET /api/advisor/status` | implemented |
| route | `GET /api/agent-heartbeats` | implemented |
| route | `GET /api/agents` | implemented |
| route | `GET /api/agents/:slug/activity` | implemented |
| route | `GET /api/agents/:slug/audit-summary` | implemented |
| route | `GET /api/agents/:slug/budget` | implemented |
| route | `GET /api/agents/:slug/detail` | implemented |
| route | `GET /api/agents/:slug/execution-log` | implemented |
| route | `GET /api/agents/:slug/health` | implemented |
| route | `GET /api/agents/:slug/kpis` | implemented |
| route | `GET /api/agents/:slug/pipeline` | implemented |
| route | `GET /api/agents/:slug/revisions` | implemented |
| route | `GET /api/agents/:slug/skills` | implemented |
| route | `GET /api/agents/:slug/stats` | implemented |
| route | `GET /api/agents/:slug/transcripts` | implemented |
| route | `GET /api/agents/compare` | implemented |
| route | `GET /api/analytics/tool-usage` | implemented |
| route | `GET /api/approvals` | implemented |
| route | `GET /api/assistant-preferences` | implemented |
| route | `GET /api/auth/anthropic/status` | implemented |
| route | `GET /api/autonomy` | implemented |
| route | `GET /api/available-tools` | implemented |
| route | `GET /api/background-tasks` | implemented |
| route | `GET /api/brain/artifacts/:id` | implemented |
| route | `GET /api/brain/connectors` | implemented |
| route | `GET /api/brain/credentials` | implemented |
| route | `GET /api/brain/feeds` | implemented |
| route | `GET /api/brain/library/search` | implemented |
| route | `GET /api/brain/runs` | implemented |
| route | `GET /api/brain/sources` | implemented |
| route | `GET /api/browse-dir` | implemented |
| route | `GET /api/budgets` | implemented |
| route | `GET /api/build/operations` | implemented |
| route | `GET /api/build/usage` | implemented |
| route | `GET /api/builder/mcp-discovery` | implemented |
| route | `GET /api/builder/workflows` | implemented |
| route | `GET /api/builder/workflows/:id` | implemented |
| route | `GET /api/channels/status` | implemented |
| route | `GET /api/claims` | implemented |
| route | `GET /api/claude-integrations` | implemented |
| route | `GET /api/cli-tools` | implemented |
| route | `GET /api/composio/status` | implemented |
| route | `GET /api/composio/toolkits` | implemented |
| route | `GET /api/cron` | implemented |
| route | `GET /api/cron/:job/attachments` | implemented |
| route | `GET /api/cron/:job/attachments/:filename` | implemented |
| route | `GET /api/cron/:job/prompt-history` | implemented |
| route | `GET /api/cron/broken-jobs` | implemented |
| route | `GET /api/cron/traces/:job` | implemented |
| route | `GET /api/discord/channels` | implemented |
| route | `GET /api/events` | implemented |
| route | `GET /api/fs/browse` | implemented |
| route | `GET /api/graph/visualization` | implemented |
| route | `GET /api/heartbeat` | implemented |
| route | `GET /api/heartbeat/agent/:slug` | implemented |
| route | `GET /api/heartbeat/control` | implemented |
| route | `GET /api/home-digest` | implemented |
| route | `GET /api/init` | implemented |
| route | `GET /api/logs` | implemented |
| route | `GET /api/mcp-permissions` | implemented |
| route | `GET /api/mcp-servers` | implemented |
| route | `GET /api/mcp-status` | implemented |
| route | `GET /api/memory` | implemented |
| route | `GET /api/memory/chunks/:id` | implemented |
| route | `GET /api/memory/chunks/:id/history` | implemented |
| route | `GET /api/memory/commitments` | implemented |
| route | `GET /api/memory/coverage` | implemented |
| route | `GET /api/memory/episodes` | implemented |
| route | `GET /api/memory/graph-stats` | implemented |
| route | `GET /api/memory/health` | implemented |
| route | `GET /api/memory/learnings` | implemented |
| route | `GET /api/memory/search` | implemented |
| route | `GET /api/memory/session-bridge` | implemented |
| route | `GET /api/memory/supersedes` | implemented |
| route | `GET /api/memory/writes/recent` | implemented |
| route | `GET /api/metrics` | implemented |
| route | `GET /api/metrics/usage` | implemented |
| route | `GET /api/office` | implemented |
| route | `GET /api/ping` | implemented |
| route | `GET /api/plans` | implemented |
| route | `GET /api/plans/:date` | documented omission |
| route | `GET /api/plans/diff` | implemented |
| route | `GET /api/plans/today` | implemented |
| route | `GET /api/profiles` | implemented |
| route | `GET /api/projects` | implemented |
| route | `GET /api/recall-traces` | implemented |
| route | `GET /api/recall-traces/:id` | implemented |
| route | `GET /api/remote-access` | implemented |
| route | `GET /api/routines` | implemented |
| route | `GET /api/routines/:id` | implemented |
| route | `GET /api/routines/:id/runs` | implemented |
| route | `GET /api/routines/cli-tools` | implemented |
| route | `GET /api/routines/mcp-tools` | implemented |
| route | `GET /api/routing-audit` | implemented |
| route | `GET /api/salesforce/status` | implemented |
| route | `GET /api/salesforce/sync-history` | implemented |
| route | `GET /api/self-improve` | implemented |
| route | `GET /api/sessions` | implemented |
| route | `GET /api/sessions/:key/messages` | documented omission |
| route | `GET /api/sessions/:key/usage` | documented omission |
| route | `GET /api/settings` | implemented |
| route | `GET /api/setup/discord/invite-url` | implemented |
| route | `GET /api/skills` | implemented |
| route | `GET /api/skills/:name` | implemented |
| route | `GET /api/skills/pending` | implemented |
| route | `GET /api/slack/channels` | implemented |
| route | `GET /api/status` | implemented |
| route | `GET /api/team/agents` | implemented |
| route | `GET /api/team/messages` | implemented |
| route | `GET /api/team/pending-requests` | implemented |
| route | `GET /api/team/status` | implemented |
| route | `GET /api/team/topology` | implemented |
| route | `GET /api/timers` | implemented |
| route | `GET /api/tool-preferences` | implemented |
| route | `GET /api/unleashed` | implemented |
| route | `GET /api/unleashed/:name/status` | implemented |
| route | `GET /api/user-model` | implemented |
| route | `GET /api/vault-file` | implemented |
| route | `GET /api/vault-files` | implemented |
| route | `GET /api/version` | implemented |
| route | `GET /api/voice/audio/:hash` | documented omission |
| route | `GET /api/webhook-actions` | implemented |
| route | `GET /api/workspace-dirs` | implemented |
| route | `GET /auth/logout` | implemented |
| route | `GET /auth/sessions` | implemented |
| route | `GET /health` | implemented |
| route | `GET /icon.svg` | implemented |
| route | `GET /manifest.json` | implemented |
| route | `GET /sw.js` | implemented |
| route | `POST /api/agents` | implemented |
| route | `POST /api/agents/:slug/revisions/:id/restore` | implemented |
| route | `POST /api/agents/:slug/skills` | implemented |
| route | `POST /api/agents/:slug/status` | implemented |
| route | `POST /api/approvals/:id/:action` | documented omission |
| route | `POST /api/auth/anthropic/login` | implemented |
| route | `POST /api/auth/anthropic/wait` | implemented |
| route | `POST /api/background-tasks/:id/cancel` | implemented |
| route | `POST /api/bot/derive-invite` | implemented |
| route | `POST /api/brain/credentials` | implemented |
| route | `POST /api/brain/feeds` | implemented |
| route | `POST /api/brain/feeds/:name/run` | implemented |
| route | `POST /api/brain/mcp/probe` | implemented |
| route | `POST /api/brain/seed/commit` | implemented |
| route | `POST /api/brain/seed/commit/stream` | implemented |
| route | `POST /api/brain/seed/preview` | implemented |
| route | `POST /api/brain/seed/preview/stream` | implemented |
| route | `POST /api/brain/seed/upload` | implemented |
| route | `POST /api/brain/sources` | implemented |
| route | `POST /api/brain/sources/:slug/run` | implemented |
| route | `POST /api/budgets/1m` | implemented |
| route | `POST /api/budgets/doctor-fix` | implemented |
| route | `POST /api/budgets/preset` | implemented |
| route | `POST /api/budgets/safe` | implemented |
| route | `POST /api/budgets/set` | implemented |
| route | `POST /api/builder/chat` | implemented |
| route | `POST /api/builder/chat/stream` | implemented |
| route | `POST /api/builder/reset` | implemented |
| route | `POST /api/builder/runs/:runId/cancel` | implemented |
| route | `POST /api/builder/save` | implemented |
| route | `POST /api/builder/test` | implemented |
| route | `POST /api/builder/workflows` | implemented |
| route | `POST /api/builder/workflows/:id/dry-run` | implemented |
| route | `POST /api/builder/workflows/:id/run` | implemented |
| route | `POST /api/builder/workflows/:id/save-from-drawflow` | implemented |
| route | `POST /api/builder/workflows/:id/test` | implemented |
| route | `POST /api/builder/workflows/:id/validate` | implemented |
| route | `POST /api/chat` | implemented |
| route | `POST /api/chat/stream` | implemented |
| route | `POST /api/claims/:id/dismiss` | implemented |
| route | `POST /api/claims/:id/mark-failed` | implemented |
| route | `POST /api/claims/:id/mark-verified` | implemented |
| route | `POST /api/cli-tools` | implemented |
| route | `POST /api/composio/connections/:id/rename` | implemented |
| route | `POST /api/composio/refresh` | implemented |
| route | `POST /api/composio/toolkits/:slug/authorize` | documented omission |
| route | `POST /api/composio/toolkits/:slug/disconnect` | documented omission |
| route | `POST /api/cron` | implemented |
| route | `POST /api/cron/:job/attachments` | implemented |
| route | `POST /api/cron/:name/toggle` | implemented |
| route | `POST /api/cron/broken-jobs/:jobName/apply-fix` | implemented |
| route | `POST /api/cron/broken-jobs/:jobName/dismiss-diagnosis` | implemented |
| route | `POST /api/cron/run/:job` | implemented |
| route | `POST /api/cron/train` | implemented |
| route | `POST /api/dashboard/restart` | implemented |
| route | `POST /api/heartbeat/queue` | implemented |
| route | `POST /api/launch` | implemented |
| route | `POST /api/leads/import` | implemented |
| route | `POST /api/mcp-servers` | implemented |
| route | `POST /api/memory/chunks/:id/pin` | implemented |
| route | `POST /api/memory/chunks/:id/restore` | implemented |
| route | `POST /api/memory/commitments/action` | implemented |
| route | `POST /api/memory/health/action` | implemented |
| route | `POST /api/memory/learnings/action` | implemented |
| route | `POST /api/memory/quick-add` | implemented |
| route | `POST /api/plans/apply` | implemented |
| route | `POST /api/profiles/switch` | implemented |
| route | `POST /api/projects/link` | implemented |
| route | `POST /api/projects/unlink` | implemented |
| route | `POST /api/remote-access/disable` | implemented |
| route | `POST /api/remote-access/enable` | implemented |
| route | `POST /api/remote-access/regenerate-token` | implemented |
| route | `POST /api/remote-access/toggle-auto-post` | implemented |
| route | `POST /api/restart` | implemented |
| route | `POST /api/routines` | implemented |
| route | `POST /api/routines/:id/dry-run` | implemented |
| route | `POST /api/routines/:id/run` | implemented |
| route | `POST /api/routines/:id/test` | implemented |
| route | `POST /api/routines/:id/toggle` | implemented |
| route | `POST /api/runagent/test` | implemented |
| route | `POST /api/self-improve/apply/:id` | implemented |
| route | `POST /api/self-improve/deny/:id` | implemented |
| route | `POST /api/self-improve/run` | implemented |
| route | `POST /api/sessions/:key/clear` | documented omission |
| route | `POST /api/setup/discord/save` | implemented |
| route | `POST /api/setup/discord/test` | implemented |
| route | `POST /api/skills` | implemented |
| route | `POST /api/skills/pending/:name/approve` | documented omission |
| route | `POST /api/skills/pending/:name/reject` | documented omission |
| route | `POST /api/stop` | implemented |
| route | `POST /api/team/message` | implemented |
| route | `POST /api/team/request` | implemented |
| route | `POST /api/timers/:id/cancel` | implemented |
| route | `POST /api/unleashed/:name/cancel` | implemented |
| route | `POST /api/user-model/seed` | implemented |
| route | `POST /api/workspace-dirs` | implemented |
| route | `POST /auth/login` | implemented |
| route | `POST /webhook-action/:source` | implemented |
| route | `POST /webhook/:slug` | implemented |
| route | `PUT /api/agents/:slug` | implemented |
| route | `PUT /api/assistant-preferences` | implemented |
| route | `PUT /api/builder/workflows/:id` | implemented |
| route | `PUT /api/cli-tools/:cmd` | implemented |
| route | `PUT /api/cron/:name` | implemented |
| route | `PUT /api/heartbeat/control` | implemented |
| route | `PUT /api/mcp-servers/:name` | implemented |
| route | `PUT /api/memory/chunks/:id` | implemented |
| route | `PUT /api/routines/:id` | implemented |
| route | `PUT /api/settings/:key` | implemented |
| route | `PUT /api/tool-preferences` | implemented |
| route | `PUT /api/user-model/:slot` | implemented |

