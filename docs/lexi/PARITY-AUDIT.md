# Lexi Parity Audit

Generated: 2026-05-06T05:45:19.149Z

- Upstream routes: **265**
- Implemented in Lexi: **169**
- Explicitly internal (acknowledged): **0**
- **Missing: 96**
- Lexi-only routes (not in upstream): 39
- Coverage: **63.8%**
- Baseline ceiling: `96` (recorded 2026-05-06T05:45:19.148Z)

## Missing routes by namespace

### `/api/budgets` — 6 missing

- `GET /api/budgets`
- `POST /api/budgets/set`
- `POST /api/budgets/preset`
- `POST /api/budgets/safe`
- `POST /api/budgets/1m`
- `POST /api/budgets/doctor-fix`

### `/api/team` — 6 missing

- `GET /api/team/agents`
- `GET /api/team/messages`
- `GET /api/team/topology`
- `POST /api/team/message`
- `GET /api/team/pending-requests`
- `POST /api/team/request`

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

### `/api/remote-access` — 5 missing

- `GET /api/remote-access`
- `POST /api/remote-access/enable`
- `POST /api/remote-access/disable`
- `POST /api/remote-access/regenerate-token`
- `POST /api/remote-access/toggle-auto-post`

### `/api/composio` — 4 missing

- `POST /api/composio/toolkits/:slug/authorize`
- `POST /api/composio/toolkits/:slug/disconnect`
- `POST /api/composio/connections/:id/rename`
- `POST /api/composio/refresh`

### `/api/claims` — 3 missing

- `POST /api/claims/:id/mark-verified`
- `POST /api/claims/:id/mark-failed`
- `POST /api/claims/:id/dismiss`

### `/api/sessions` — 3 missing

- `POST /api/sessions/:key/clear`
- `GET /api/sessions/:key/messages`
- `GET /api/sessions/:key/usage`

### `/api/skills` — 3 missing

- `GET /api/skills/pending`
- `POST /api/skills/pending/:name/approve`
- `POST /api/skills/pending/:name/reject`

### `/api/self-improve` — 3 missing

- `POST /api/self-improve/run`
- `POST /api/self-improve/apply/:id`
- `POST /api/self-improve/deny/:id`

### `/api/setup` — 3 missing

- `POST /api/setup/discord/test`
- `POST /api/setup/discord/save`
- `GET /api/setup/discord/invite-url`

### `/api/plans` — 3 missing

- `GET /api/plans/today`
- `POST /api/plans/apply`
- `GET /api/plans/diff`

### `/api/timers` — 2 missing

- `GET /api/timers`
- `POST /api/timers/:id/cancel`

### `/api/projects` — 2 missing

- `POST /api/projects/link`
- `POST /api/projects/unlink`

### `/api/unleashed` — 2 missing

- `POST /api/unleashed/:name/cancel`
- `GET /api/unleashed/:name/status`

### `/api/chat` — 2 missing

- `POST /api/chat`
- `POST /api/chat/stream`

### `/api/build` — 2 missing

- `GET /api/build/usage`
- `GET /api/build/operations`

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

### `/auth` — 1 missing

- `DELETE /auth/sessions/:id`

### `/api/version` — 1 missing

- `GET /api/version`

### `/api/status` — 1 missing

- `GET /api/status`

### `/api/webhook-actions` — 1 missing

- `GET /api/webhook-actions`

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

### `/api/graph` — 1 missing

- `GET /api/graph/visualization`

### `/api/profiles` — 1 missing

- `POST /api/profiles/switch`

### `/api/recall-traces` — 1 missing

- `GET /api/recall-traces/:id`

### `/api/user-model` — 1 missing

- `POST /api/user-model/seed`

### `/api/analytics` — 1 missing

- `GET /api/analytics/tool-usage`

### `/api/metrics` — 1 missing

- `GET /api/metrics/usage`

### `/api/agents` — 1 missing

- `GET /api/agents`

### `/api/office` — 1 missing

- `GET /api/office`

### `/api/approvals` — 1 missing

- `POST /api/approvals/:id/:action`

### `/api/leads` — 1 missing

- `POST /api/leads/import`

### `/api/salesforce` — 1 missing

- `GET /api/salesforce/sync-history`

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
- `PUT /api/skills/:_` — src/lexi-dashboard/routes/operate-v2.ts
- `GET /api/skills/:_/info` — src/lexi-dashboard/routes/operate-v2.ts
- `POST /api/approvals/:_/decision` — src/lexi-dashboard/routes/operate-v2.ts
- `GET /api/setup/status` — src/lexi-dashboard/routes/operate-v2.ts
- `POST /api/setup` — src/lexi-dashboard/routes/operate-v2.ts
- `POST /api/setup/complete` — src/lexi-dashboard/routes/operate-v2.ts
- `POST /api/user-model` — src/lexi-dashboard/routes/operate-v2.ts
- `POST /api/unleashed` — src/lexi-dashboard/routes/operate-v2.ts
- `PUT /api/unleashed/:_` — src/lexi-dashboard/routes/operate-v2.ts
- `PUT /api/profiles` — src/lexi-dashboard/routes/operate-v2.ts
- `POST /api/metrics` — src/lexi-dashboard/routes/operate-v2.ts
- `DELETE /api/sessions/:_` — src/lexi-dashboard/routes/operate-v2.ts
- `GET /api/slack/status` — src/lexi-dashboard/routes/operate-v2.ts
- `POST /api/plans` — src/lexi-dashboard/routes/operate-v2.ts
- `PUT /api/plans/:_` — src/lexi-dashboard/routes/operate-v2.ts
- `DELETE /api/plans/:_` — src/lexi-dashboard/routes/operate-v2.ts
- `POST /api/projects` — src/lexi-dashboard/routes/operate-v2.ts
- `GET /api/projects/:_` — src/lexi-dashboard/routes/operate-v2.ts
- `POST /api/claims` — src/lexi-dashboard/routes/operate-v2.ts
- `PUT /api/claims/:_` — src/lexi-dashboard/routes/operate-v2.ts
- `DELETE /api/claims/:_` — src/lexi-dashboard/routes/operate-v2.ts
- `GET /api/team` — src/lexi-dashboard/routes/operate-v2.ts
- `POST /api/team` — src/lexi-dashboard/routes/operate-v2.ts
- `PUT /api/team/:_` — src/lexi-dashboard/routes/operate-v2.ts
- `DELETE /api/team/:_` — src/lexi-dashboard/routes/operate-v2.ts
- `GET /api/team/leaderboard` — src/lexi-dashboard/routes/operate-v2.ts
- `POST /api/self-improve` — src/lexi-dashboard/routes/operate-v2.ts
- `PUT /api/self-improve/:_` — src/lexi-dashboard/routes/operate-v2.ts
- `DELETE /api/self-improve/:_` — src/lexi-dashboard/routes/operate-v2.ts
- `PUT /api/vault-file` — src/lexi-dashboard/routes/vault-write.ts
