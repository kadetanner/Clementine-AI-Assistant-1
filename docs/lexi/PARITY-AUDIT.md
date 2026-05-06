# Lexi Parity Audit

Generated: 2026-05-06T15:46:23.769Z

- Upstream routes: **265**
- Implemented in Lexi: **265**
- Explicitly internal (acknowledged): **0**
- **Missing: 0**
- Lexi-only routes (not in upstream): 50
- Coverage: **100.0%**
- Baseline ceiling: `0` (recorded 2026-05-06T05:47:54.919Z)

## Missing routes by namespace

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
- `POST /api/lexi-chat/start` — src/lexi-dashboard/routes/chat-v2.ts
- `POST /api/lexi-chat/send` — src/lexi-dashboard/routes/chat-v2.ts
- `GET /api/lexi-chat/stream/:_` — src/lexi-dashboard/routes/chat-v2.ts
- `GET /api/lexi-chat/sessions` — src/lexi-dashboard/routes/chat-v2.ts
- `GET /api/lexi-chat/sessions/:_` — src/lexi-dashboard/routes/chat-v2.ts
- `DELETE /api/lexi-chat/sessions/:_` — src/lexi-dashboard/routes/chat-v2.ts
- `GET /api/lexi-chat/_invariants` — src/lexi-dashboard/routes/chat-v2.ts
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
- `GET /api/lexi-search` — src/lexi-dashboard/routes/search-v2.ts
- `GET /api/runs` — src/lexi-dashboard/routes/trace-v2.ts
- `GET /api/runs/:_/events` — src/lexi-dashboard/routes/trace-v2.ts
- `POST /api/runs/_test-event` — src/lexi-dashboard/routes/trace-v2.ts
- `PUT /api/vault-file` — src/lexi-dashboard/routes/vault-write.ts
