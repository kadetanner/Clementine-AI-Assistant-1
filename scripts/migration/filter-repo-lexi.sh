#!/usr/bin/env bash
set -euo pipefail
# This script must run in a fresh clone — git filter-repo refuses to run
# on a repo with a remote unless --force is passed.
#
# Usage (from ~/projects/):
#   git clone --no-local clementine-fork lexi
#   cd lexi
#   git checkout lexi-migration
#   bash ../clementine-fork/.worktrees/lexi-migration/scripts/migration/filter-repo-lexi.sh
#
# Validated via dry-run 2026-05-07. Produces lexi/web/ with full git history,
# web-frozen-2026-05-07 and lexi-seam-cut-2026-05-07 tags, and rewrites
# mcp-bridge.js + composio-stub.js callsite paths via --replace-text.
#
# NOTE: src/lexi-dashboard/agents/mcp-bridge.ts was added by commit 2877383
# ("build(migration): restore mcp-bridge.ts into lexi-dashboard/agents/")
# to avoid a path-collision with the reverted inline-shim commit. Without that
# commit, the revert would delete lexi/web/agents/mcp-bridge.ts at HEAD.

# Write the --replace-text rules file (idempotent; rewritten each run).
cat > /tmp/lexi-replace-rules.txt <<'RULES'
literal:'../../agent/mcp-bridge.js'==>'../agents/mcp-bridge.js'
literal:'../../../src/agent/mcp-bridge.js'==>'../../agents/mcp-bridge.js'
literal:'../../../src/lexi-dashboard/services/composio-stub.js'==>'../../services/composio-stub.js'
RULES

git filter-repo \
  --path src/lexi-dashboard/ \
  --path tests/lexi/ \
  --path src/agent/mcp-bridge.ts \
  --path src/types.ts \
  --path src/config.ts \
  --path src/config/env-parser.ts \
  --path src/config/clementine-json.ts \
  --path docs/audit/2026-05-web-polish-audit.md \
  --path docs/audit/2026-05-web-polish-ui-review.md \
  --path docs/superpowers/specs/2026-05-06-lexi-vision-roadmap.md \
  --path docs/superpowers/specs/2026-05-06-lexi-web-polish-heavy-design.md \
  --path docs/superpowers/specs/2026-05-07-lexi-repo-migration.md \
  --path docs/superpowers/plans/2026-05-07-lexi-repo-migration-plan.md \
  --path docs/migration/2026-05-lexi-seam-audit.md \
  --path-rename src/lexi-dashboard/:lexi/web/ \
  --path-rename tests/lexi/:lexi/web/tests/ \
  --path-rename src/agent/:lexi/web/agents/ \
  --path-rename src/types.ts:lexi/web/types.ts \
  --path-rename src/config.ts:lexi/web/config.ts \
  --path-rename src/config/:lexi/web/config/ \
  --replace-text /tmp/lexi-replace-rules.txt \
  --refs refs/heads/lexi-migration refs/tags/web-frozen-2026-05-07 refs/tags/lexi-seam-cut-2026-05-07
