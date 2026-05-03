#!/usr/bin/env bash
#
# install-lexi-launchd.sh — installs com.lexi.dashboard LaunchAgent on macOS.
#
# Steps:
#   1. Render scripts/com.lexi.dashboard.plist with current paths
#   2. Copy to ~/Library/LaunchAgents/com.lexi.dashboard.plist
#   3. launchctl bootstrap gui/$UID    (replaces deprecated `load -w`)
#   4. launchctl enable    gui/$UID/com.lexi.dashboard
#   5. launchctl kickstart gui/$UID/com.lexi.dashboard
#   6. curl localhost:$LEXI_PORT/health to verify
#
# Re-runnable: bootstraps idempotently by bootout-then-bootstrap on existing label.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE="$SCRIPT_DIR/com.lexi.dashboard.plist"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET="$TARGET_DIR/com.lexi.dashboard.plist"
LABEL="com.lexi.dashboard"
DOMAIN="gui/$UID"
SERVICE="$DOMAIN/$LABEL"
LEXI_PORT="${LEXI_PORT:-3030}"
LOG_DIR="$HOME/.clementine/logs"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: This installer is macOS-only (launchd)." >&2
  exit 1
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: plist template missing at $TEMPLATE" >&2
  exit 1
fi

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "ERROR: node not found on PATH. Install Node 20+ and retry." >&2
  exit 1
fi

if [[ ! -f "$REPO_ROOT/dist/cli/index.js" ]]; then
  echo "WARN: $REPO_ROOT/dist/cli/index.js not present. Run 'npm run build' first." >&2
fi

mkdir -p "$TARGET_DIR" "$LOG_DIR"

echo "==> Rendering plist"
echo "    NODE_BIN  = $NODE_BIN"
echo "    REPO_ROOT = $REPO_ROOT"
echo "    HOME      = $HOME"
echo "    LEXI_PORT = $LEXI_PORT"

TMP="$(mktemp -t lexi-plist.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

awk -v node_bin="$NODE_BIN" \
    -v repo_root="$REPO_ROOT" \
    -v home="$HOME" \
    -v path_env="$PATH" '
{
  gsub(/__NODE_BIN__/, node_bin);
  gsub(/__REPO_ROOT__/, repo_root);
  gsub(/__HOME__/, home);
  gsub(/__PATH__/, path_env);
  print;
}' "$TEMPLATE" > "$TMP"

plutil -lint "$TMP" >/dev/null

mv -f "$TMP" "$TARGET"
trap - EXIT

echo "==> Installed plist to $TARGET"

if launchctl print "$SERVICE" >/dev/null 2>&1; then
  echo "==> Existing service found, removing"
  launchctl bootout "$SERVICE" || true
fi

echo "==> launchctl bootstrap $DOMAIN $TARGET"
launchctl bootstrap "$DOMAIN" "$TARGET"

echo "==> launchctl enable $SERVICE"
launchctl enable "$SERVICE"

echo "==> launchctl kickstart $SERVICE"
launchctl kickstart "$SERVICE"

echo "==> Waiting up to 10s for /health on :$LEXI_PORT"
ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://localhost:${LEXI_PORT}/health" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 1
done

if [[ "$ok" -ne 1 ]]; then
  echo "ERROR: /health did not respond within 10s. Check $LOG_DIR/lexi-dashboard.err.log" >&2
  echo "       launchctl print $SERVICE" >&2
  exit 2
fi

echo "==> /health OK"
echo
launchctl print "$SERVICE" | head -20 || true
echo
echo "Done. com.lexi.dashboard is loaded, enabled, and serving on :${LEXI_PORT}."
echo "Logs: $LOG_DIR/lexi-dashboard.{out,err}.log"
