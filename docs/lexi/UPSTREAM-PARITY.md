# Upstream -> Lexi Feature Parity

Generated: 2026-05-06T04:38:33.129Z

Compares upstream `src/cli/dashboard.ts` route + nav surface against
Lexi's implementation under `src/lexi-dashboard/`. Documented omissions
are declared via `LEXI-OMIT: <feature>` comments in Lexi source
(see `src/lexi-dashboard/upstream-omissions.ts`).

## Summary

- Upstream features audited: **265**
- Implemented in Lexi: **12**
- Documented omissions: **253**
- MISSING: **0**

## Comparison

| Kind | Upstream feature | Status |
|---|---|---|
| route | `DELETE /api/agents/:slug` | documented omission |
| route | `DELETE /api/agents/:slug/skills/:name` | documented omission |
| route | `DELETE /api/background-tasks/:id` | documented omission |
| route | `DELETE /api/brain/feeds/:name` | documented omission |
| route | `DELETE /api/brain/sources/:slug` | documented omission |
| route | `DELETE /api/builder/workflows/:id` | documented omission |
| route | `DELETE /api/cli-tools/:cmd` | documented omission |
| route | `DELETE /api/cron/:job/attachments/:filename` | documented omission |
| route | `DELETE /api/cron/:name` | documented omission |
| route | `DELETE /api/mcp-servers/:name` | documented omission |
| route | `DELETE /api/memory/chunks/:id` | documented omission |
| route | `DELETE /api/routines/:id` | documented omission |
| route | `DELETE /api/settings/:key` | documented omission |
| route | `DELETE /api/skills/:name` | documented omission |
| route | `DELETE /api/unleashed/:name` | documented omission |
| route | `DELETE /api/user-model/:slot` | documented omission |
| route | `DELETE /api/workspace-dirs` | documented omission |
| route | `DELETE /auth/sessions/:id` | documented omission |
| route | `GET /` | implemented |
| route | `GET /api/activity` | documented omission |
| route | `GET /api/advisor/analytics` | documented omission |
| route | `GET /api/advisor/decisions` | documented omission |
| route | `GET /api/advisor/effectiveness` | documented omission |
| route | `GET /api/advisor/events` | documented omission |
| route | `GET /api/advisor/reflection-trends` | documented omission |
| route | `GET /api/advisor/status` | documented omission |
| route | `GET /api/agent-heartbeats` | documented omission |
| route | `GET /api/agents` | implemented |
| route | `GET /api/agents/:slug/activity` | documented omission |
| route | `GET /api/agents/:slug/audit-summary` | documented omission |
| route | `GET /api/agents/:slug/budget` | documented omission |
| route | `GET /api/agents/:slug/detail` | documented omission |
| route | `GET /api/agents/:slug/execution-log` | documented omission |
| route | `GET /api/agents/:slug/health` | documented omission |
| route | `GET /api/agents/:slug/kpis` | documented omission |
| route | `GET /api/agents/:slug/pipeline` | documented omission |
| route | `GET /api/agents/:slug/revisions` | documented omission |
| route | `GET /api/agents/:slug/skills` | documented omission |
| route | `GET /api/agents/:slug/stats` | documented omission |
| route | `GET /api/agents/:slug/transcripts` | documented omission |
| route | `GET /api/agents/compare` | documented omission |
| route | `GET /api/analytics/tool-usage` | documented omission |
| route | `GET /api/approvals` | documented omission |
| route | `GET /api/assistant-preferences` | documented omission |
| route | `GET /api/auth/anthropic/status` | documented omission |
| route | `GET /api/autonomy` | documented omission |
| route | `GET /api/available-tools` | documented omission |
| route | `GET /api/background-tasks` | documented omission |
| route | `GET /api/brain/artifacts/:id` | documented omission |
| route | `GET /api/brain/connectors` | documented omission |
| route | `GET /api/brain/credentials` | documented omission |
| route | `GET /api/brain/feeds` | documented omission |
| route | `GET /api/brain/library/search` | documented omission |
| route | `GET /api/brain/runs` | documented omission |
| route | `GET /api/brain/sources` | documented omission |
| route | `GET /api/browse-dir` | documented omission |
| route | `GET /api/budgets` | documented omission |
| route | `GET /api/build/operations` | documented omission |
| route | `GET /api/build/usage` | documented omission |
| route | `GET /api/builder/mcp-discovery` | documented omission |
| route | `GET /api/builder/workflows` | implemented |
| route | `GET /api/builder/workflows/:id` | documented omission |
| route | `GET /api/channels/status` | documented omission |
| route | `GET /api/claims` | documented omission |
| route | `GET /api/claude-integrations` | documented omission |
| route | `GET /api/cli-tools` | documented omission |
| route | `GET /api/composio/status` | documented omission |
| route | `GET /api/composio/toolkits` | documented omission |
| route | `GET /api/cron` | implemented |
| route | `GET /api/cron/:job/attachments` | documented omission |
| route | `GET /api/cron/:job/attachments/:filename` | documented omission |
| route | `GET /api/cron/:job/prompt-history` | documented omission |
| route | `GET /api/cron/broken-jobs` | implemented |
| route | `GET /api/cron/traces/:job` | documented omission |
| route | `GET /api/discord/channels` | documented omission |
| route | `GET /api/events` | documented omission |
| route | `GET /api/fs/browse` | documented omission |
| route | `GET /api/graph/visualization` | documented omission |
| route | `GET /api/heartbeat` | documented omission |
| route | `GET /api/heartbeat/agent/:slug` | documented omission |
| route | `GET /api/heartbeat/control` | documented omission |
| route | `GET /api/home-digest` | documented omission |
| route | `GET /api/init` | documented omission |
| route | `GET /api/logs` | documented omission |
| route | `GET /api/mcp-permissions` | documented omission |
| route | `GET /api/mcp-servers` | documented omission |
| route | `GET /api/mcp-status` | documented omission |
| route | `GET /api/memory` | implemented |
| route | `GET /api/memory/chunks/:id` | documented omission |
| route | `GET /api/memory/chunks/:id/history` | documented omission |
| route | `GET /api/memory/commitments` | documented omission |
| route | `GET /api/memory/coverage` | documented omission |
| route | `GET /api/memory/episodes` | documented omission |
| route | `GET /api/memory/graph-stats` | implemented |
| route | `GET /api/memory/health` | implemented |
| route | `GET /api/memory/learnings` | documented omission |
| route | `GET /api/memory/search` | documented omission |
| route | `GET /api/memory/session-bridge` | documented omission |
| route | `GET /api/memory/supersedes` | documented omission |
| route | `GET /api/memory/writes/recent` | documented omission |
| route | `GET /api/metrics` | documented omission |
| route | `GET /api/metrics/usage` | documented omission |
| route | `GET /api/office` | documented omission |
| route | `GET /api/ping` | documented omission |
| route | `GET /api/plans` | documented omission |
| route | `GET /api/plans/:date` | documented omission |
| route | `GET /api/plans/diff` | documented omission |
| route | `GET /api/plans/today` | documented omission |
| route | `GET /api/profiles` | documented omission |
| route | `GET /api/projects` | documented omission |
| route | `GET /api/recall-traces` | implemented |
| route | `GET /api/recall-traces/:id` | documented omission |
| route | `GET /api/remote-access` | documented omission |
| route | `GET /api/routines` | documented omission |
| route | `GET /api/routines/:id` | documented omission |
| route | `GET /api/routines/:id/runs` | documented omission |
| route | `GET /api/routines/cli-tools` | documented omission |
| route | `GET /api/routines/mcp-tools` | documented omission |
| route | `GET /api/routing-audit` | documented omission |
| route | `GET /api/salesforce/status` | documented omission |
| route | `GET /api/salesforce/sync-history` | documented omission |
| route | `GET /api/self-improve` | documented omission |
| route | `GET /api/sessions` | documented omission |
| route | `GET /api/sessions/:key/messages` | documented omission |
| route | `GET /api/sessions/:key/usage` | documented omission |
| route | `GET /api/settings` | documented omission |
| route | `GET /api/setup/discord/invite-url` | documented omission |
| route | `GET /api/skills` | documented omission |
| route | `GET /api/skills/:name` | documented omission |
| route | `GET /api/skills/pending` | documented omission |
| route | `GET /api/slack/channels` | documented omission |
| route | `GET /api/status` | documented omission |
| route | `GET /api/team/agents` | documented omission |
| route | `GET /api/team/messages` | documented omission |
| route | `GET /api/team/pending-requests` | documented omission |
| route | `GET /api/team/status` | documented omission |
| route | `GET /api/team/topology` | documented omission |
| route | `GET /api/timers` | documented omission |
| route | `GET /api/tool-preferences` | documented omission |
| route | `GET /api/unleashed` | documented omission |
| route | `GET /api/unleashed/:name/status` | documented omission |
| route | `GET /api/user-model` | documented omission |
| route | `GET /api/vault-file` | documented omission |
| route | `GET /api/vault-files` | implemented |
| route | `GET /api/version` | documented omission |
| route | `GET /api/voice/audio/:hash` | documented omission |
| route | `GET /api/webhook-actions` | documented omission |
| route | `GET /api/workspace-dirs` | documented omission |
| route | `GET /auth/logout` | documented omission |
| route | `GET /auth/sessions` | implemented |
| route | `GET /health` | implemented |
| route | `GET /icon.svg` | documented omission |
| route | `GET /manifest.json` | documented omission |
| route | `GET /sw.js` | documented omission |
| route | `POST /api/agents` | documented omission |
| route | `POST /api/agents/:slug/revisions/:id/restore` | documented omission |
| route | `POST /api/agents/:slug/skills` | documented omission |
| route | `POST /api/agents/:slug/status` | documented omission |
| route | `POST /api/approvals/:id/:action` | documented omission |
| route | `POST /api/auth/anthropic/login` | documented omission |
| route | `POST /api/auth/anthropic/wait` | documented omission |
| route | `POST /api/background-tasks/:id/cancel` | documented omission |
| route | `POST /api/bot/derive-invite` | documented omission |
| route | `POST /api/brain/credentials` | documented omission |
| route | `POST /api/brain/feeds` | documented omission |
| route | `POST /api/brain/feeds/:name/run` | documented omission |
| route | `POST /api/brain/mcp/probe` | documented omission |
| route | `POST /api/brain/seed/commit` | documented omission |
| route | `POST /api/brain/seed/commit/stream` | documented omission |
| route | `POST /api/brain/seed/preview` | documented omission |
| route | `POST /api/brain/seed/preview/stream` | documented omission |
| route | `POST /api/brain/seed/upload` | documented omission |
| route | `POST /api/brain/sources` | documented omission |
| route | `POST /api/brain/sources/:slug/run` | documented omission |
| route | `POST /api/budgets/1m` | documented omission |
| route | `POST /api/budgets/doctor-fix` | documented omission |
| route | `POST /api/budgets/preset` | documented omission |
| route | `POST /api/budgets/safe` | documented omission |
| route | `POST /api/budgets/set` | documented omission |
| route | `POST /api/builder/chat` | documented omission |
| route | `POST /api/builder/chat/stream` | documented omission |
| route | `POST /api/builder/reset` | documented omission |
| route | `POST /api/builder/runs/:runId/cancel` | documented omission |
| route | `POST /api/builder/save` | documented omission |
| route | `POST /api/builder/test` | documented omission |
| route | `POST /api/builder/workflows` | documented omission |
| route | `POST /api/builder/workflows/:id/dry-run` | documented omission |
| route | `POST /api/builder/workflows/:id/run` | documented omission |
| route | `POST /api/builder/workflows/:id/save-from-drawflow` | documented omission |
| route | `POST /api/builder/workflows/:id/test` | documented omission |
| route | `POST /api/builder/workflows/:id/validate` | documented omission |
| route | `POST /api/chat` | documented omission |
| route | `POST /api/chat/stream` | documented omission |
| route | `POST /api/claims/:id/dismiss` | documented omission |
| route | `POST /api/claims/:id/mark-failed` | documented omission |
| route | `POST /api/claims/:id/mark-verified` | documented omission |
| route | `POST /api/cli-tools` | documented omission |
| route | `POST /api/composio/connections/:id/rename` | documented omission |
| route | `POST /api/composio/refresh` | documented omission |
| route | `POST /api/composio/toolkits/:slug/authorize` | documented omission |
| route | `POST /api/composio/toolkits/:slug/disconnect` | documented omission |
| route | `POST /api/cron` | documented omission |
| route | `POST /api/cron/:job/attachments` | documented omission |
| route | `POST /api/cron/:name/toggle` | documented omission |
| route | `POST /api/cron/broken-jobs/:jobName/apply-fix` | documented omission |
| route | `POST /api/cron/broken-jobs/:jobName/dismiss-diagnosis` | documented omission |
| route | `POST /api/cron/run/:job` | documented omission |
| route | `POST /api/cron/train` | documented omission |
| route | `POST /api/dashboard/restart` | documented omission |
| route | `POST /api/heartbeat/queue` | documented omission |
| route | `POST /api/launch` | documented omission |
| route | `POST /api/leads/import` | documented omission |
| route | `POST /api/mcp-servers` | documented omission |
| route | `POST /api/memory/chunks/:id/pin` | documented omission |
| route | `POST /api/memory/chunks/:id/restore` | documented omission |
| route | `POST /api/memory/commitments/action` | documented omission |
| route | `POST /api/memory/health/action` | documented omission |
| route | `POST /api/memory/learnings/action` | documented omission |
| route | `POST /api/memory/quick-add` | documented omission |
| route | `POST /api/plans/apply` | documented omission |
| route | `POST /api/profiles/switch` | documented omission |
| route | `POST /api/projects/link` | documented omission |
| route | `POST /api/projects/unlink` | documented omission |
| route | `POST /api/remote-access/disable` | documented omission |
| route | `POST /api/remote-access/enable` | documented omission |
| route | `POST /api/remote-access/regenerate-token` | documented omission |
| route | `POST /api/remote-access/toggle-auto-post` | documented omission |
| route | `POST /api/restart` | documented omission |
| route | `POST /api/routines` | documented omission |
| route | `POST /api/routines/:id/dry-run` | documented omission |
| route | `POST /api/routines/:id/run` | documented omission |
| route | `POST /api/routines/:id/test` | documented omission |
| route | `POST /api/routines/:id/toggle` | documented omission |
| route | `POST /api/runagent/test` | documented omission |
| route | `POST /api/self-improve/apply/:id` | documented omission |
| route | `POST /api/self-improve/deny/:id` | documented omission |
| route | `POST /api/self-improve/run` | documented omission |
| route | `POST /api/sessions/:key/clear` | documented omission |
| route | `POST /api/setup/discord/save` | documented omission |
| route | `POST /api/setup/discord/test` | documented omission |
| route | `POST /api/skills` | documented omission |
| route | `POST /api/skills/pending/:name/approve` | documented omission |
| route | `POST /api/skills/pending/:name/reject` | documented omission |
| route | `POST /api/stop` | documented omission |
| route | `POST /api/team/message` | documented omission |
| route | `POST /api/team/request` | documented omission |
| route | `POST /api/timers/:id/cancel` | documented omission |
| route | `POST /api/unleashed/:name/cancel` | documented omission |
| route | `POST /api/user-model/seed` | documented omission |
| route | `POST /api/workspace-dirs` | documented omission |
| route | `POST /auth/login` | documented omission |
| route | `POST /webhook-action/:source` | documented omission |
| route | `POST /webhook/:slug` | documented omission |
| route | `PUT /api/agents/:slug` | documented omission |
| route | `PUT /api/assistant-preferences` | documented omission |
| route | `PUT /api/builder/workflows/:id` | documented omission |
| route | `PUT /api/cli-tools/:cmd` | documented omission |
| route | `PUT /api/cron/:name` | documented omission |
| route | `PUT /api/heartbeat/control` | documented omission |
| route | `PUT /api/mcp-servers/:name` | documented omission |
| route | `PUT /api/memory/chunks/:id` | documented omission |
| route | `PUT /api/routines/:id` | documented omission |
| route | `PUT /api/settings/:key` | documented omission |
| route | `PUT /api/tool-preferences` | documented omission |
| route | `PUT /api/user-model/:slot` | documented omission |

