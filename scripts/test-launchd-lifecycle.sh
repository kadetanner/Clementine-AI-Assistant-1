#!/usr/bin/env bash
set -euo pipefail

LABEL="com.lexi.dashboard"
PORT="${LEXI_PORT:-3030}"

red()   { printf "\033[31m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }

fail() { red "FAIL: $1"; exit 1; }

# DoD 12 — loaded
if ! launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  fail "$LABEL is not loaded. Run scripts/install-lexi-launchd.sh first."
fi
green "loaded · $LABEL"

# DoD 12 — health responds
if ! curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null; then
  fail "health endpoint not reachable on port $PORT"
fi
green "health · port $PORT"

# DoD 13 — kill -9 → restart in ≤3s
PID=$(launchctl print "gui/$UID/$LABEL" | awk '/pid =/ {print $3; exit}')
if [[ -z "$PID" || "$PID" == "0" ]]; then
  fail "could not read pid from launchctl print"
fi
echo "killing pid $PID with SIGKILL..."
kill -9 "$PID" || true

# Poll for restart
START=$(date +%s)
RESTARTED=0
for _ in $(seq 1 30); do
  sleep 0.1
  NEWPID=$(launchctl print "gui/$UID/$LABEL" 2>/dev/null | awk '/pid =/ {print $3; exit}' || echo "")
  if [[ -n "$NEWPID" && "$NEWPID" != "0" && "$NEWPID" != "$PID" ]]; then
    if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
      RESTARTED=1
      break
    fi
  fi
done
END=$(date +%s)
ELAPSED=$((END - START))

if [[ "$RESTARTED" -ne 1 ]]; then
  fail "process did not restart within 3s of SIGKILL (waited ${ELAPSED}s)"
fi
if [[ "$ELAPSED" -gt 3 ]]; then
  fail "restart took ${ELAPSED}s (>3s)"
fi
green "restart · ${ELAPSED}s after kill -9"

# DoD 12 — logout/login simulation (manual; we record the procedure)
cat <<'NOTE'

MANUAL VERIFICATION REQUIRED for full DoD 12:
  1. Log out of macOS (Apple menu → Log Out)
  2. Log back in
  3. Run: curl http://127.0.0.1:3030/health
  4. Expect: {"status":"ok",...}
  5. Mark DoD 12 PASS in docs/lexi/DOD-REPORT.md

NOTE

green "automated portion of DoD 12+13 PASS"
