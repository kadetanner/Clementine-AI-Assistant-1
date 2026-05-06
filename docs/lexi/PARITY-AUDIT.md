# Lexi Parity Audit

Generated: 2026-05-06T05:42:52.617Z

- Upstream routes: **265**
- Implemented in Lexi: **112**
- Explicitly internal (acknowledged): **0**
- **Missing: 153**
- Lexi-only routes (not in upstream): 10
- Coverage: **42.3%**
- Baseline ceiling: `153` (recorded 2026-05-06T05:42:45.497Z)

## Missing routes by namespace

### `/api/skills` — 7 missing

- `GET /api/skills/pending`
- `POST /api/skills/pending/:name/approve`
- `POST /api/skills/pending/:name/reject`
- `GET /api/skills`
- `POST /api/skills`
- `DELETE /api/skills/:name`
- `GET /api/skills/:name`

### `/api/team` — 7 missing

- `GET /api/team/agents`
- `GET /api/team/status`
- `GET /api/team/messages`
- `GET /api/team/topology`
- `POST /api/team/message`
- `GET /api/team/pending-requests`
- `POST /api/team/request`

### `/auth` — 6 missing

- `POST /auth/login`
- `GET /auth/logout`
- `DELETE /auth/sessions/:id`
- `GET /api/auth/anthropic/status`
- `POST /api/auth/anthropic/login`
- `POST /api/auth/anthropic/wait`

### `/api/composio` — 6 missing

- `GET /api/composio/status`
- `GET /api/composio/toolkits`
- `POST /api/composio/toolkits/:slug/authorize`
- `POST /api/composio/toolkits/:slug/disconnect`
- `POST /api/composio/connections/:id/rename`
- `POST /api/composio/refresh`

### `/api/budgets` — 6 missing

- `GET /api/budgets`
- `POST /api/budgets/set`
- `POST /api/budgets/preset`
- `POST /api/budgets/safe`
- `POST /api/budgets/1m`
- `POST /api/budgets/doctor-fix`

### `/api/advisor` — 6 missing

- `GET /api/advisor/decisions`
- `GET /api/advisor/analytics`
- `GET /api/advisor/reflection-trends`
- `GET /api/advisor/events`
- `GET /api/advisor/effectiveness`
- `GET /api/advisor/status`

### `/api/heartbeat` — 5 missing

- `GET /api/heartbeat`
- `GET /api/heartbeat/control`
- `PUT /api/heartbeat/control`
- `GET /api/heartbeat/agent/:slug`
- `POST /api/heartbeat/queue`

### `/api/plans` — 5 missing

- `GET /api/plans/today`
- `GET /api/plans/:date`
- `GET /api/plans`
- `POST /api/plans/apply`
- `GET /api/plans/diff`

### `/api/remote-access` — 5 missing

- `GET /api/remote-access`
- `POST /api/remote-access/enable`
- `POST /api/remote-access/disable`
- `POST /api/remote-access/regenerate-token`
- `POST /api/remote-access/toggle-auto-post`

### `/api/sessions` — 4 missing

- `GET /api/sessions`
- `POST /api/sessions/:key/clear`
- `GET /api/sessions/:key/messages`
- `GET /api/sessions/:key/usage`

### `/api/claims` — 4 missing

- `GET /api/claims`
- `POST /api/claims/:id/mark-verified`
- `POST /api/claims/:id/mark-failed`
- `POST /api/claims/:id/dismiss`

### `/api/unleashed` — 4 missing

- `GET /api/unleashed`
- `POST /api/unleashed/:name/cancel`
- `DELETE /api/unleashed/:name`
- `GET /api/unleashed/:name/status`

### `/api/user-model` — 4 missing

- `GET /api/user-model`
- `PUT /api/user-model/:slot`
- `DELETE /api/user-model/:slot`
- `POST /api/user-model/seed`

### `/api/mcp-servers` — 4 missing

- `GET /api/mcp-servers`
- `POST /api/mcp-servers`
- `PUT /api/mcp-servers/:name`
- `DELETE /api/mcp-servers/:name`

### `/api/cli-tools` — 4 missing

- `GET /api/cli-tools`
- `POST /api/cli-tools`
- `PUT /api/cli-tools/:cmd`
- `DELETE /api/cli-tools/:cmd`

### `/api/self-improve` — 4 missing

- `GET /api/self-improve`
- `POST /api/self-improve/run`
- `POST /api/self-improve/apply/:id`
- `POST /api/self-improve/deny/:id`

### `/api/background-tasks` — 3 missing

- `GET /api/background-tasks`
- `POST /api/background-tasks/:id/cancel`
- `DELETE /api/background-tasks/:id`

### `/api/projects` — 3 missing

- `GET /api/projects`
- `POST /api/projects/link`
- `POST /api/projects/unlink`

### `/api/workspace-dirs` — 3 missing

- `GET /api/workspace-dirs`
- `POST /api/workspace-dirs`
- `DELETE /api/workspace-dirs`

### `/api/settings` — 3 missing

- `GET /api/settings`
- `PUT /api/settings/:key`
- `DELETE /api/settings/:key`

### `/api/setup` — 3 missing

- `POST /api/setup/discord/test`
- `POST /api/setup/discord/save`
- `GET /api/setup/discord/invite-url`

### `/api/timers` — 2 missing

- `GET /api/timers`
- `POST /api/timers/:id/cancel`

### `/api/tool-preferences` — 2 missing

- `GET /api/tool-preferences`
- `PUT /api/tool-preferences`

### `/api/assistant-preferences` — 2 missing

- `GET /api/assistant-preferences`
- `PUT /api/assistant-preferences`

### `/api/profiles` — 2 missing

- `GET /api/profiles`
- `POST /api/profiles/switch`

### `/api/chat` — 2 missing

- `POST /api/chat`
- `POST /api/chat/stream`

### `/api/metrics` — 2 missing

- `GET /api/metrics`
- `GET /api/metrics/usage`

### `/api/build` — 2 missing

- `GET /api/build/usage`
- `GET /api/build/operations`

### `/api/approvals` — 2 missing

- `GET /api/approvals`
- `POST /api/approvals/:id/:action`

### `/api/salesforce` — 2 missing

- `GET /api/salesforce/status`
- `GET /api/salesforce/sync-history`

### `/webhook` — 1 missing

- `POST /webhook/:slug`

### `/webhook-action` — 1 missing

- `POST /webhook-action/:source`

### `/api/ping` — 1 missing

- `GET /api/ping`

### `/api/init` — 1 missing

- `GET /api/init`

### `/api/events` — 1 missing

- `GET /api/events`

### `/api/version` — 1 missing

- `GET /api/version`

### `/api/status` — 1 missing

- `GET /api/status`

### `/api/webhook-actions` — 1 missing

- `GET /api/webhook-actions`

### `/api/autonomy` — 1 missing

- `GET /api/autonomy`

### `/api/home-digest` — 1 missing

- `GET /api/home-digest`

### `/api/vault-file` — 1 missing

- `GET /api/vault-file`

### `/api/logs` — 1 missing

- `GET /api/logs`

### `/api/activity` — 1 missing

- `GET /api/activity`

### `/api/routing-audit` — 1 missing

- `GET /api/routing-audit`

### `/api/fs` — 1 missing

- `GET /api/fs/browse`

### `/api/runagent` — 1 missing

- `POST /api/runagent/test`

### `/api/restart` — 1 missing

- `POST /api/restart`

### `/api/dashboard` — 1 missing

- `POST /api/dashboard/restart`

### `/api/stop` — 1 missing

- `POST /api/stop`

### `/api/launch` — 1 missing

- `POST /api/launch`

### `/api/available-tools` — 1 missing

- `GET /api/available-tools`

### `/api/browse-dir` — 1 missing

- `GET /api/browse-dir`

### `/api/graph` — 1 missing

- `GET /api/graph/visualization`

### `/api/recall-traces` — 1 missing

- `GET /api/recall-traces/:id`

### `/api/analytics` — 1 missing

- `GET /api/analytics/tool-usage`

### `/api/mcp-status` — 1 missing

- `GET /api/mcp-status`

### `/api/mcp-permissions` — 1 missing

- `GET /api/mcp-permissions`

### `/api/claude-integrations` — 1 missing

- `GET /api/claude-integrations`

### `/api/agents` — 1 missing

- `GET /api/agents`

### `/api/office` — 1 missing

- `GET /api/office`

### `/api/leads` — 1 missing

- `POST /api/leads/import`

### `/api/discord` — 1 missing

- `GET /api/discord/channels`

### `/api/channels` — 1 missing

- `GET /api/channels/status`

### `/api/slack` — 1 missing

- `GET /api/slack/channels`

### `/api/bot` — 1 missing

- `POST /api/bot/derive-invite`

### `/api/voice` — 1 missing

- `GET /api/voice/audio/:hash`

### `/api/manifest.json` — 1 missing

- `GET /manifest.json`

### `/api/icon.svg` — 1 missing

- `GET /icon.svg`

### `/api/sw.js` — 1 missing

- `GET /sw.js`

## Lexi-only routes (Lexi adds these on top of upstream)

- `GET /api/cron/stuck` — src/lexi-dashboard/fixes/cron-recovery.ts
- `POST /api/cron/stuck/:_/clear` — src/lexi-dashboard/fixes/cron-recovery.ts
- `GET /api/daily-plan` — src/lexi-dashboard/fixes/daily-plan.ts
- `GET /api/digest` — src/lexi-dashboard/fixes/digest-root.ts
- `GET /api/doctor` — src/lexi-dashboard/fixes/doctor.ts
- `GET /api/goals` — src/lexi-dashboard/fixes/goals-root.ts
- `POST /api/restart-self` — src/lexi-dashboard/fixes/restart-self.ts
- `POST /api/voice/synthesize` — src/lexi-dashboard/fixes/voice-synthesize.ts
- `GET /api/secrets/refs` — src/lexi-dashboard/proxy/upstream-routes.ts
- `PUT /api/vault-file` — src/lexi-dashboard/routes/vault-write.ts
