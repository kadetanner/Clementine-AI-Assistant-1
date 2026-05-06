# Lexi Dashboard — Build & Operate

Every command needed to install, build, run, restart, and verify the Lexi dashboard.

## Prerequisites

- macOS (launchd-based always-on)
- Node 20+
- `npm` (bundled)
- `~/projects/clementine-fork` checked out with the `lexi-dashboard` branch

## One-time install

```bash
cd ~/projects/clementine-fork
git checkout lexi-dashboard
npm install
npm run build           # tsc + assets + lexi UI bundle
bash scripts/install-lexi-launchd.sh
```

After install:
- `launchctl print gui/$UID/com.lexi.dashboard` shows the agent
- `curl http://127.0.0.1:3030/health` returns `{"status":"ok",...}`

## Day-to-day

| Task | Command |
|---|---|
| Build everything | `npm run build` |
| Build only Lexi UI bundle | `npm run build:lexi` |
| Run in foreground (dev) | `LEXI_PORT=3031 node dist/cli/index.js lexi dashboard` |
| Restart launchd service | `launchctl kickstart -k gui/$UID/com.lexi.dashboard` |
| Stop launchd service | `launchctl bootout gui/$UID/com.lexi.dashboard` |
| Re-enable after stop | `launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.lexi.dashboard.plist` |
| Tail logs | `tail -f ~/.clementine/logs/lexi-dashboard.{out,err}.log` |
| Check health | `curl http://127.0.0.1:3030/health` |
| Open dashboard | `open http://127.0.0.1:3030/` |

## Tests + DoD

| Task | Command |
|---|---|
| Run all Lexi tests | `npm test -- tests/lexi/` |
| Run a single test file | `npm test -- tests/lexi/dod/links.test.ts` |
| Run full DoD validation | `npm run dod` |
| Generate DoD report only | `npm run dod:report` |

## Files at a glance

| Path | Purpose |
|---|---|
| `src/lexi-dashboard/` | All Lexi source (server, UI, fixes, launch) |
| `dist/lexi-dashboard/` | Build output (UI bundle + assets) |
| `bin/lexi` | CLI shim |
| `scripts/install-lexi-launchd.sh` | One-time install |
| `scripts/com.lexi.dashboard.plist` | LaunchAgent template |
| `scripts/run-dod.mjs` | DoD orchestrator (Plan 9 Task 14) |
| `scripts/audit-upstream-features.mjs` | Upstream-parity audit |
| `scripts/audit-network.mjs` | External-network audit |
| `scripts/test-launchd-lifecycle.sh` | launchd lifecycle test |
| `scripts/verify-upstream-clean.sh` | Upstream-clean verification |
| `~/Library/LaunchAgents/com.lexi.dashboard.plist` | Installed plist |
| `~/.clementine/logs/lexi-dashboard.*.log` | stdout/stderr |
| `~/.clementine/lexi-allowed-hosts.txt` | External-host allowlist (DoD 11) |

## Troubleshooting

- **Port already in use** — set `LEXI_PORT` env var. Default 3030.
- **`npm run build:lexi` fails** — usually a missing font file under `src/lexi-dashboard/ui/fonts/`. Re-run the curl downloads from Plan 1 Task 6.
- **launchd shows pid 0** — check stderr log; usually a syntax error in the entry script. Run in foreground first to see the trace.
- **Doctor reports red** — see `/api/doctor` JSON body for the failing check name; each maps to a fixable subsystem. Yellow = warning (cron may be quiet); red = subsystem unreachable.
- **Cron yellow on doctor** — clementine cron runs are event-driven; if the install has been quiet, cron heartbeat will be stale. Threshold: yellow > 90min, red > 240min.
- **DoD test failing in CI without LaunchAgent** — `tests/lexi/dod/doctor-green.test.ts` skips gracefully when port 3030 isn't reachable; other DoD tests run against ephemeral test servers and are CI-safe.
