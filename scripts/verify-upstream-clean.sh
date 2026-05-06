#!/usr/bin/env bash
set -euo pipefail

# Allowed paths in the diff against upstream/main
ALLOWED_REGEX='^(src/lexi-dashboard/|bin/lexi$|scripts/(install-lexi-launchd\.sh|com\.lexi\.dashboard\.plist|esbuild-lexi\.mjs|audit-upstream-features\.mjs|audit-network\.mjs|test-launchd-lifecycle\.sh|verify-upstream-clean\.sh|run-dod\.mjs|generate-dod-report\.mjs|lexi-parity-audit\.mjs|lexi-parity-baseline\.json)$|docs/lexi/|tests/lexi/|package\.json$|package-lock\.json$|src/cli/index\.ts$|\.gitignore$)'

red()   { printf "\033[31m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }

# Ensure upstream remote exists
if ! git remote get-url upstream >/dev/null 2>&1; then
  red "FAIL: 'upstream' remote not configured"
  echo "Run: git remote add upstream https://github.com/Natebreynolds/Clementine-AI-Assistant.git"
  exit 1
fi

git fetch upstream main --quiet

# DoD 16 — diff scope
echo "Checking diff scope vs upstream/main..."
DISALLOWED=()
while IFS= read -r path; do
  if [[ -z "$path" ]]; then continue; fi
  if ! [[ "$path" =~ $ALLOWED_REGEX ]]; then
    DISALLOWED+=("$path")
  fi
done < <(git diff upstream/main..HEAD --name-only)

if [[ ${#DISALLOWED[@]} -gt 0 ]]; then
  red "FAIL DoD 16: disallowed paths in diff vs upstream/main:"
  for p in "${DISALLOWED[@]}"; do echo "  - $p"; done
  exit 1
fi
green "DoD 16 PASS — diff scope clean"

# DoD 17 — merge would be conflict-free
echo "Checking merge cleanliness..."
TREE=$(git merge-tree --write-tree upstream/main HEAD 2>&1) || {
  red "FAIL DoD 17: git merge-tree errored"
  echo "$TREE"
  exit 1
}

# git merge-tree --write-tree prints conflict markers when conflicts exist
if echo "$TREE" | grep -q '^<<<<<<<\|^=======\|^>>>>>>>'; then
  red "FAIL DoD 17: merge would produce conflicts"
  echo "$TREE" | grep -E '^(<<<<<<<|=======|>>>>>>>)' | head -20
  exit 1
fi
green "DoD 17 PASS — merge from upstream is conflict-free"
