# Lexi Repo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the Lexi web dashboard out of the Clementine fork into a clean monorepo `kadetanner/lexi` with `lexi/web/` (full git history), `lexi/shared/` (cross-client tokens + types), and `lexi/mac/` (buildable SwiftUI skeleton with no real views).

**Architecture:** Three phases. **Phase A** (pre-flight in current repo) audits and cuts cross-tree imports while paths still match what tests expect. **Phase B** uses `git filter-repo` to rewrite paths into a new repo, preserving history and the freeze tag. **Phase C** layers `lexi/shared/` and `lexi/mac/` onto the migrated tree, wires CI, archives the old fork.

**Tech Stack:** Lit + TypeScript (web), SwiftUI + macOS 14 (mac), xcodegen, npm workspaces, GitHub Actions, `git filter-repo`.

**Source spec:** [`docs/superpowers/specs/2026-05-07-lexi-repo-migration.md`](../specs/2026-05-07-lexi-repo-migration.md)

**Pre-conditions:** Run from `~/projects/clementine-fork/` on branch `lexi-dashboard`. Tag `web-frozen-2026-05-07` exists. Working tree clean. `git filter-repo`, `gh`, `xcodegen` installed (`brew install git-filter-repo gh xcodegen`).

---

## File Structure (terminal state in new repo)

```
~/projects/lexi/                        # new repo, kadetanner/lexi (private)
├── package.json                        # npm workspace root: lexi/web, lexi/shared
├── .github/workflows/ci.yml            # web (Linux) + mac (macOS) checks
├── .gitignore
├── README.md
├── docs/
│   ├── audit/
│   │   ├── 2026-05-web-polish-audit.md         (carried by filter-repo)
│   │   └── 2026-05-web-polish-ui-review.md     (carried by filter-repo)
│   ├── superpowers/
│   │   ├── specs/
│   │   │   ├── 2026-05-06-lexi-vision-roadmap.md
│   │   │   ├── 2026-05-06-lexi-web-polish-heavy-design.md
│   │   │   └── 2026-05-07-lexi-repo-migration.md
│   │   └── plans/
│   │       └── 2026-05-07-lexi-repo-migration-plan.md
│   └── migration/
│       ├── 2026-05-lexi-seam-audit.md
│       └── 2026-05-lexi-migration-log.md
├── lexi/
│   ├── web/                            # was src/lexi-dashboard/
│   │   ├── package.json                # @kade/lexi-web, slim deps
│   │   ├── tsconfig.json
│   │   ├── server.ts
│   │   ├── routes.ts
│   │   ├── routes/, agents/, data/, events/, fixes/, launch/, proxy/,
│   │   │   services/, ui/, workflows/, upstream-omissions.ts
│   │   └── tests/                      # was tests/lexi/
│   ├── shared/
│   │   ├── package.json                # @kade/lexi-shared
│   │   ├── design/
│   │   │   ├── tokens.css              # source of truth
│   │   │   └── tokens.swift            # generated, committed
│   │   ├── types/
│   │   │   ├── api.ts                  # source of truth
│   │   │   └── api.swift               # generated, committed
│   │   └── scripts/
│   │       ├── gen-swift-tokens.mjs
│   │       └── gen-swift-types.mjs
│   └── mac/
│       ├── project.yml                 # xcodegen spec
│       ├── Lexi.xcodeproj              # gitignored except project.yml
│       ├── App/
│       │   ├── LexiApp.swift
│       │   └── ContentView.swift
│       ├── Shell/
│       │   ├── RootNavigationView.swift
│       │   └── Sidebar.swift
│       ├── Net/
│       │   ├── HTTPClient.swift
│       │   └── APIEndpoints.swift
│       ├── Design/
│       │   └── DesignTokens.swift
│       ├── Resources/
│       │   ├── Assets.xcassets/
│       │   └── Info.plist
│       └── README.md
```

In the **old fork** (`kadetanner/Clementine-AI-Assistant-1`), after migration:
- `LEXI-MOVED.md` (new, top-level redirect notice)
- `src/lexi-dashboard.MOVED-TO-LEXI-REPO/` (renamed; redirect cue)

---

## Phase A — Pre-flight on current repo (`~/projects/clementine-fork/`, branch `lexi-dashboard`)

### Task 1: Seam audit document

**Files:**
- Create: `docs/migration/2026-05-lexi-seam-audit.md`

- [ ] **Step 1: Create the audit directory and run discovery commands**

```bash
mkdir -p docs/migration
cd ~/projects/clementine-fork

# A. Imports leaving src/lexi-dashboard/
grep -rho "from ['\"]\.\.[^'\"]*" src/lexi-dashboard --include="*.ts" \
  | sort -u > /tmp/lexi-imports-out.txt

# B. Reverse — anything outside lexi-dashboard that imports INTO it
grep -rh "from ['\"].*lexi-dashboard" src --include="*.ts" \
  | grep -v "src/lexi-dashboard" > /tmp/lexi-imports-in.txt || true

# C. package.json scripts touching lexi-dashboard
grep -nE "lexi-dashboard|/lexi/" package.json > /tmp/lexi-pkg-scripts.txt

# D. Dependencies actually imported by lexi-dashboard
grep -rho "from ['\"]\([^.][^'\"]*\)['\"]" src/lexi-dashboard --include="*.ts" \
  | sed -E "s/from ['\"]([^'\"]*)['\"]/\1/" \
  | grep -v "^[./]" | sort -u > /tmp/lexi-deps.txt
```

- [ ] **Step 2: Verify expected baseline output**

Run: `cat /tmp/lexi-imports-out.txt | wc -l`
Expected: ≥ 3 (matches the three known seams: `agent/mcp-bridge`, `events/bus`, `integrations/composio/client`).
Run: `grep "agent/mcp-bridge\|events/bus\|integrations/composio" /tmp/lexi-imports-out.txt`
Expected: all three appear.

- [ ] **Step 3: Write the seam audit doc**

Write `docs/migration/2026-05-lexi-seam-audit.md` with this structure:

```markdown
# Lexi Seam Audit — 2026-05-07

**Source repo:** clementine-fork @ lexi-dashboard branch
**Target:** clean cut of `src/lexi-dashboard/` for migration to `kadetanner/lexi`

## §A — Imports leaving `src/lexi-dashboard/`

| Import | Call sites | Decision | Notes |
|---|---|---|---|
| `../../agent/mcp-bridge.js` | <count from grep> | inline → `lexi/web/agents/mcp-bridge.ts` | Used by connections view; drop unused exports |
| `../../events/bus.js` | <count> | inline → `lexi/web/events/bus.ts` | Lexi has its own event surface |
| `../../integrations/composio/client.js` | <count> | drop + stub | Composio not on Lexi roadmap |
| <any others discovered> | | | |

## §B — Imports entering `src/lexi-dashboard/` from outside

(paste contents of /tmp/lexi-imports-in.txt; classify each as leave/shim/drop)

## §C — package.json scripts referencing lexi-dashboard

(paste /tmp/lexi-pkg-scripts.txt)

| Script | New repo treatment |
|---|---|
| `build:assets` | Rewrite for new path |
| `build:lexi` | Carry forward, update paths |
| `dev` (`tsx src/index.ts`) | Drop — Clementine entrypoint |
| `dashboard` | Drop |
| `desktop:*` | Drop |
| `test:e2e` | Carry forward, update path |
| `audit:inventory` | Carry forward, update path |
| `parity*` | Drop — Clementine-specific |

## §D — Runtime deps actually imported by lexi-dashboard

(paste /tmp/lexi-deps.txt)

These become `lexi/web/package.json` dependencies + devDependencies. Everything
else in current `package.json` does NOT carry over.

## §E — Surprises / unknowns

(empty unless audit surfaces something new. If non-empty, add seam-cut tasks
to the migration plan before filter-repo runs.)
```

- [ ] **Step 4: Verify all known seams classified**

Run: `grep -c "Decision" docs/migration/2026-05-lexi-seam-audit.md`
Expected: ≥ 3.

- [ ] **Step 5: If §E surprises section is non-empty, STOP and update this plan**

If the audit found imports beyond the three known ones, update the plan to add seam-cut tasks (following the inline / shared / shim / drop framework) before proceeding to Task 2.

- [ ] **Step 6: Commit**

```bash
git add docs/migration/2026-05-lexi-seam-audit.md
git commit -m "docs(migration): seam audit for Lexi repo extraction"
```

---

### Task 2: ~~Inline mcp-bridge~~ → Drag mcp-bridge cascade via filter-repo (Option C)

**Status:** Reframed 2026-05-07 after cascade audit revealed inlining `agent/mcp-bridge.ts` (661 LOC) would require pulling in transitive deps — `config.ts` (848 LOC), `types.ts` (1201 LOC), `config/env-parser.ts` (46 LOC), `config/clementine-json.ts` (190 LOC). Total cascade: 5 files, ~2946 LOC. The relative-path layout under the rename pattern preserves all internal imports.

Decision: drag the cascade into `lexi/web/` via `filter-repo --path` + `--path-rename` rules, and rewrite the 2 callsite paths + 3 test mock paths via `--replace-text` at filter-repo time. No source changes in Phase A; the heavy lifting moves to Phase B Task 6/7.

**Files this task touches:** none (verification only).

- [ ] **Step 1: Re-confirm cascade is bounded**

```bash
cd ~/projects/clementine-fork/.worktrees/lexi-migration
echo "mcp-bridge.ts non-builtin imports:"
grep -E "from '\\.\\.?/" src/agent/mcp-bridge.ts
echo "config.ts non-builtin imports:"
grep -E "from '\\.\\.?/" src/config.ts
echo "types.ts non-builtin imports:"
grep -E "from '\\.\\.?/" src/types.ts
echo "config/env-parser.ts non-builtin imports:"
grep -E "from '\\.\\.?/" src/config/env-parser.ts || echo "(leaf)"
echo "config/clementine-json.ts non-builtin imports:"
grep -E "from '\\.\\.?/" src/config/clementine-json.ts || echo "(leaf — only npm pkgs)"
```

Expected: every non-builtin import resolves inside the 5-file set. If any new external dep is found, STOP and update this plan.

- [ ] **Step 2: Re-confirm no in-tree files reach past mcp-bridge to types/config directly**

```bash
grep -rln "from '\\.\\./\\.\\./types\\.js\\|from '\\.\\./\\.\\./config\\.js\\|from '\\.\\./\\.\\./config/" src/lexi-dashboard --include="*.ts"
```

Expected: no output. (If any lexi-dashboard file imports types.js/config.js directly, that callsite also needs a path rewrite; add it to Phase B's `--replace-text` rules.)

- [ ] **Step 3: Document the filter-repo arguments needed for Task 6**

The cascade is dragged via additional `--path` and `--path-rename` arguments (added in Phase B Task 6 Step 2). The 2 callsites and 3 test mocks are rewritten via `--replace-text`. No commit in Phase A for mcp-bridge — the migration handles it atomically.

The arguments to add in Phase B Task 6 Step 2:

```
--path src/agent/mcp-bridge.ts
--path src/types.ts
--path src/config.ts
--path src/config/env-parser.ts
--path src/config/clementine-json.ts
--path-rename src/agent/:lexi/web/agents/
--path-rename src/types.ts:lexi/web/types.ts
--path-rename src/config.ts:lexi/web/config.ts
--path-rename src/config/:lexi/web/config/
```

The `--replace-text` rules (write to a file passed via `--replace-text rules.txt`):

```
literal:'../../agent/mcp-bridge.js'==>'../agents/mcp-bridge.js'
literal:'../../../src/agent/mcp-bridge.js'==>'../../agents/mcp-bridge.js'
```

(`literal:` prefix prevents regex interpretation; `==>` is the separator filter-repo uses.)

The first rule rewrites the 2 callsites in `src/lexi-dashboard/services/{probe,connection-registry}.ts`. The second rewrites the 3 test mocks in `tests/lexi/connections/{probe,routes,registry}.test.ts`.

- [ ] **Step 4: No commit, mark task done**

This task is verification-only. No file changes, no commit. Update the migration log (created in Task 15) to record:
- Cascade audit re-confirmed (5 files, no further deps)
- Filter-repo arguments captured for Task 6
- Reason for Option C: inlining 2946 LOC across 5 files is brittler than letting filter-repo carry them along with full git history.

---

### Task 3: ~~Inline `events/bus`~~ — SUPERSEDED (no seam exists)

**Status:** Cancelled by Task 1 audit (2026-05-07).

The seam audit revealed this "outside-tree import" is a depth-2 import that resolves *in-tree*: `src/lexi-dashboard/data/lexi-native/session-log-tailer.ts` imports `'../../events/bus.js'`, which resolves to `src/lexi-dashboard/events/bus.ts` — already inside the tree, will travel with the migration unchanged. There is no `src/events/bus.ts` at the Clementine root for this depth-2 path to escape to.

The original spec listed this seam in error (assumed all `../../` paths escape, which is only true for depth-1 files). Spec §3 shim table updated to reflect the corrected two-seam reality.

**No work to do.** Skip directly to Task 4.

---

### Task 4: Stub `integrations/composio/client`

**Files:**
- Create: `src/lexi-dashboard/services/composio-stub.ts`
- Modify: every file importing `'../../integrations/composio/client.js'`

- [ ] **Step 1: List call sites and consumed API surface**

Run: `grep -rln "from ['\"]\.\./\.\./integrations/composio/client" src/lexi-dashboard --include="*.ts"`
Run: `grep -rh "composio\." src/lexi-dashboard --include="*.ts" | sort -u`
Note the methods called against the composio client — those are what the stub must implement.

- [ ] **Step 2: Write the stub**

```ts
// src/lexi-dashboard/services/composio-stub.ts
//
// Stub replacement for src/integrations/composio/client during the Lexi
// migration. Composio integration is out of scope for the Lexi vision
// roadmap (Track 2C may revisit). All methods return a "not configured"
// sentinel so the connections view degrades gracefully.

export interface ComposioClient {
  isConfigured(): boolean;
  // Add the method signatures from Step 1's grep here, e.g.:
  // listConnections(): Promise<{ items: [] }>;
}

export const composioClient: ComposioClient = {
  isConfigured: () => false,
  // Each consumed method returns an empty/safe value:
  // listConnections: async () => ({ items: [] }),
};
```

Match the exact method signatures actually called from lexi-dashboard. Do not invent surface area.

- [ ] **Step 3: Rewrite call sites**

For each file from Step 1, replace the composio client import with the stub:

```bash
sed -i '' "s|from '\.\./\.\./integrations/composio/client\.js'|from '<correct-relative-path>/services/composio-stub.js'|g" <file>
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test -- --run`
Expected: 0 errors; all tests pass; connections view shows "not configured" empty state.
Run: `npm run test:e2e -- --grep connections`
Expected: connections-route specs still pass.
Run: `grep -rn "from ['\"]\.\./\.\./integrations/composio" src/lexi-dashboard --include="*.ts"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/lexi-dashboard/services/composio-stub.ts \
  $(grep -rln "composio-stub" src/lexi-dashboard --include="*.ts")
git commit -m "refactor(lexi): stub composio client (out of scope for Lexi)

Pre-migration seam-cut: connections view degrades to 'not configured'
when Composio is unavailable."
```

---

### Task 5: Final seam verification

- [ ] **Step 1: Confirm zero outside-tree imports remain**

```bash
grep -rho "from ['\"]\.\.[^'\"]*" src/lexi-dashboard --include="*.ts" | sort -u
```

For each line, mentally resolve the relative path. After Phase A's seam work, the only remaining outside-tree imports should be `'../../agent/mcp-bridge.js'` (Option C — handled by filter-repo's `--replace-text` in Task 6) — composio is fully stubbed and events/bus was a false alarm. Any other escaping import is a remaining seam that needs resolution before Phase B.

- [ ] **Step 2: Confirm all tests still green**

Run: `npm run typecheck && npm test -- --run && npm run test:e2e`
Expected: full suite passes including the 265 D-tests.

- [ ] **Step 3: Tag the seam-cut state**

```bash
git tag -a lexi-seam-cut-2026-05-07 -m "Lexi seam-cut complete

src/lexi-dashboard/ has zero imports leaving its tree. Ready for
git filter-repo path rewrite to lexi/web/."
git push origin lexi-seam-cut-2026-05-07
```

- [ ] **Step 4: Verify tag exists**

Run: `git tag --list "lexi-seam-cut-*"`
Expected: `lexi-seam-cut-2026-05-07`.


---

## Phase B — Filter-repo migration

### Task 6: Filter-repo dry run in throwaway clone

**Files:**
- Working in: `~/projects/lexi-dryrun/` (throwaway, deleted at end)

- [ ] **Step 1: Make a throwaway clone**

```bash
cd ~/projects
git clone --no-local clementine-fork lexi-dryrun
cd lexi-dryrun
```

- [ ] **Step 2: Write the `--replace-text` rules file**

```bash
cat > /tmp/lexi-replace-rules.txt <<'RULES'
literal:'../../agent/mcp-bridge.js'==>'../agents/mcp-bridge.js'
literal:'../../../src/agent/mcp-bridge.js'==>'../../agents/mcp-bridge.js'
RULES
```

These rules rewrite import strings atomically with the rename:
- Rule 1: callsites in `src/lexi-dashboard/services/{probe,connection-registry}.ts`
- Rule 2: vitest mocks in `tests/lexi/connections/{probe,routes,registry}.test.ts`

If the seam audit surfaced additional callsites/mocks during Phase A, add a rule per pattern. (`literal:` prefix prevents regex interpretation; `==>` is filter-repo's separator.)

- [ ] **Step 3: Run filter-repo with the candidate paths**

```bash
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
  --refs refs/heads/lexi-dashboard refs/heads/main refs/tags/web-frozen-2026-05-07 refs/tags/lexi-seam-cut-2026-05-07
```

Expected: filter-repo reports rewriting commits and creating refs. No errors.

**Note on path-rename ordering:** filter-repo applies path-renames in declaration order. The `src/lexi-dashboard/`→`lexi/web/` rename runs first; the dragged-along Clementine files (`src/agent/`, `src/types.ts`, `src/config.ts`, `src/config/`) get their own renames after, landing alongside under `lexi/web/`. The `agents/` rename merges Clementine's `src/agent/` into the same `lexi/web/agents/` namespace as lexi-dashboard's existing `agents/` subdirectory — the only file there is `mcp-bridge.ts` which doesn't collide with lexi-dashboard's `agents/{activity-log,restart,vault-store}.ts`.

- [ ] **Step 4: Verify the resulting tree**

```bash
ls lexi/web/                   # expect: agents/ (now contains mcp-bridge.ts + lexi's activity-log/restart/vault-store), data/, events/, fixes/, launch/, proxy/, routes/, server.ts, services/, ui/, workflows/, upstream-omissions.ts, routes.ts, types.ts, config.ts, config/
ls lexi/web/agents/            # expect: mcp-bridge.ts (from Clementine), activity-log.ts, restart.ts, vault-store.ts (from lexi-dashboard)
ls lexi/web/config/            # expect: env-parser.ts, clementine-json.ts
ls lexi/web/tests/             # expect: e2e/, agents/, components/, etc. (50+ entries)
ls docs/audit/                 # expect: 2 files
ls docs/superpowers/specs/     # expect: 3 files
git tag --list                 # expect: web-frozen-2026-05-07, lexi-seam-cut-2026-05-07
```

- [ ] **Step 4.5: Verify --replace-text rewrites landed**

```bash
# These two files should now import from '../agents/mcp-bridge.js' (not '../../agent/...')
grep "mcp-bridge" lexi/web/services/probe.ts lexi/web/services/connection-registry.ts
# Expected: both show "from '../agents/mcp-bridge.js'"

# These three test files should now mock '../../agents/mcp-bridge.js' (not '../../../src/agent/...')
grep "mcp-bridge" lexi/web/tests/connections/probe.test.ts lexi/web/tests/connections/routes.test.ts lexi/web/tests/connections/registry.test.ts
# Expected: all show "vi.mock('../../agents/mcp-bridge.js'"
```

- [ ] **Step 5: Verify history preserved**

```bash
# A canonical Track 1 file — should show f70a293 (cron modernization commit)
git log --oneline lexi/web/ui/components/lexi-cron-view.ts | head -10
# Expected: ≥ 5 commits including cron-view modernization
git log --oneline lexi/web/ui/components/ | wc -l
# Expected: > 100 commits (Track 1 dense polish history)
```

- [ ] **Step 6: Verify nothing unwanted dragged along**

```bash
ls -la                              # expect: NO node_modules, dist, vault, electron-builder.yml at root
find . -name "node_modules" -type d # expect: empty
find . -name "vault" -type d        # expect: empty
du -sh .                            # expect: < 100MB
```

- [ ] **Step 7: If anything is wrong, iterate**

If files missing → add to `--path` list. If extra files present → exclude (positive list approach: only listed paths survive). Re-run on a fresh dry-run clone.

- [ ] **Step 8: Save the working command**

Once dry-run is clean, save the exact filter-repo command to a script:

```bash
cd ~/projects/clementine-fork
mkdir -p scripts/migration
cat > scripts/migration/filter-repo-lexi.sh <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
# This script must run in a fresh clone — git filter-repo refuses to run
# on a repo with a remote unless --force is passed.

# Write the --replace-text rules file (idempotent; rewritten each run).
cat > /tmp/lexi-replace-rules.txt <<'RULES'
literal:'../../agent/mcp-bridge.js'==>'../agents/mcp-bridge.js'
literal:'../../../src/agent/mcp-bridge.js'==>'../../agents/mcp-bridge.js'
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
  --refs refs/heads/lexi-dashboard refs/heads/main refs/tags/web-frozen-2026-05-07 refs/tags/lexi-seam-cut-2026-05-07
SCRIPT
chmod +x scripts/migration/filter-repo-lexi.sh
```

- [ ] **Step 9: Clean up dry run**

```bash
rm -rf ~/projects/lexi-dryrun
```

- [ ] **Step 10: Commit the migration script**

```bash
cd ~/projects/clementine-fork
git add scripts/migration/filter-repo-lexi.sh
git commit -m "build(migration): add filter-repo script for Lexi extraction

Validated via dry-run clone. Produces lexi/web/ tree with full
git history including Track 1 polish commits and the
web-frozen-2026-05-07 tag. Drags mcp-bridge cascade (5 files,
~2946 LOC) and rewrites callsite + test mock paths via
--replace-text."
```

---

### Task 7: Filter-repo for real → `~/projects/lexi/`

**Files:**
- Working in: `~/projects/lexi/` (new working tree)

- [ ] **Step 1: Make the real clone**

```bash
cd ~/projects
git clone --no-local clementine-fork lexi-staging
cd lexi-staging
```

- [ ] **Step 2: Run the saved filter-repo script**

```bash
bash scripts/migration/filter-repo-lexi.sh
```

Expected: same output pattern as the dry run, no errors.

- [ ] **Step 3: Verify the result one more time**

```bash
ls lexi/web/ | wc -l                # expect: matches dry run
git log --oneline lexi/web/ui/components/lexi-cron-view.ts | wc -l   # expect: same as dry run
git tag --list                      # expect: web-frozen-2026-05-07, lexi-seam-cut-2026-05-07
```

- [ ] **Step 4: Move into place**

```bash
cd ~/projects
mv lexi-staging lexi
cd lexi
```

- [ ] **Step 5: Set the default branch to `main`**

```bash
git branch -m lexi-dashboard main
git branch                          # expect: * main
```

- [ ] **Step 6: Verify the working tree looks sane**

```bash
ls                                  # expect: lexi/, docs/, scripts/
ls lexi/                            # expect: web/  (only — mac/ and shared/ added in Phase C)
cat lexi/web/server.ts | head -5    # expect: real file content, no garbage
```

No commit yet — Phase B leaves the new repo in a single rewritten state. Phase C adds new commits.


---

## Phase C — Add `lexi/shared/`, `lexi/mac/`, slim `package.json`

### Task 8: Initialize npm workspace root

**Files:**
- Create: `~/projects/lexi/package.json`
- Create: `~/projects/lexi/.gitignore`
- Create: `~/projects/lexi/README.md`

- [ ] **Step 1: Write root package.json**

```json
{
  "name": "lexi-monorepo",
  "private": true,
  "version": "0.1.0",
  "description": "Lexi — personal agent platform with macOS-canonical client",
  "workspaces": ["lexi/web", "lexi/shared"],
  "scripts": {
    "build": "npm -ws --if-present run build",
    "test": "npm -ws --if-present run test",
    "typecheck": "npm -ws --if-present run typecheck",
    "codegen": "npm -w @kade/lexi-shared run codegen"
  }
}
```

- [ ] **Step 2: Write .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
playwright-report/
test-results/
coverage/
lexi/mac/Lexi.xcodeproj/
lexi/mac/build/
lexi/mac/DerivedData/
lexi/mac/*.xcworkspace/xcuserdata/
lexi/mac/*.xcodeproj/xcuserdata/
.vscode/
.idea/
```

- [ ] **Step 3: Write README.md**

```markdown
# Lexi

Personal agent platform with a macOS-canonical SwiftUI client and a frozen web fallback.

## Layout

- `lexi/web/` — Lit + TypeScript dashboard (frozen at `web-frozen-2026-05-07`; bug fixes only).
- `lexi/shared/` — design tokens + API types consumed by both clients (web reads source; mac reads generated mirrors).
- `lexi/mac/` — SwiftUI macOS app, scaffold only at this point.

## Quick start

​```bash
# Web dashboard
cd lexi/web && npm install && npm run dev    # http://127.0.0.1:8765

# Mac app
cd lexi/mac && xcodegen && open Lexi.xcodeproj    # ⌘R in Xcode

# Codegen tokens + types after editing lexi/shared/*
npm run codegen
​```

## Docs

- Vision: `docs/superpowers/specs/2026-05-06-lexi-vision-roadmap.md`
- This repo's history: extracted from `kadetanner/Clementine-AI-Assistant-1` via `git filter-repo` on 2026-05-07. The `web-frozen-2026-05-07` tag marks the Track 1 polish freeze.
```

- [ ] **Step 4: Verify and commit**

```bash
cat package.json | python3 -m json.tool   # expect: parses, no errors
git add package.json .gitignore README.md
git commit -m "chore: initialize Lexi monorepo workspace root"
```

---

### Task 9: Slim `lexi/web/package.json` to actual deps

**Files:**
- Replace: `lexi/web/package.json` (currently absent — filter-repo did not move root package.json)

- [ ] **Step 1: Identify the runtime + dev deps actually needed**

Re-read `docs/migration/2026-05-lexi-seam-audit.md` §D, plus inspect:

```bash
cd ~/projects/lexi
grep -rho "from ['\"]\([^.][^'\"]*\)['\"]" lexi/web --include="*.ts" \
  | sed -E "s/from ['\"]([^'\"]*)['\"]/\1/" \
  | grep -v "^[./]" | sort -u
```

Cross-reference with the original `~/projects/clementine-fork/package.json` for exact versions. Common expectations: `lit`, `express`, `playwright`/`@playwright/test`, `axe-playwright`, `vitest`, `tsx`, `esbuild`, `typescript`, `@types/node`, `@types/express`.

- [ ] **Step 2: Write the new package.json**

```json
{
  "name": "@kade/lexi-web",
  "version": "0.1.0",
  "private": true,
  "description": "Lexi web dashboard — Lit + Express",
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "tsc && node ../../scripts/esbuild-lexi.mjs",
    "build:lexi": "node ../../scripts/esbuild-lexi.mjs",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test --config=tests/e2e/playwright.config.ts",
    "audit:inventory": "tsx ../../scripts/audit/inventory-interactions.ts"
  },
  "dependencies": {
    "lit": "<version-from-original>",
    "express": "<version-from-original>"
  },
  "devDependencies": {
    "@playwright/test": "<version>",
    "axe-playwright": "<version>",
    "vitest": "<version>",
    "tsx": "<version>",
    "esbuild": "<version>",
    "typescript": "<version>",
    "@types/node": "<version>",
    "@types/express": "<version>"
  }
}
```

Replace `<version-from-original>` placeholders by looking up each pinned version:

```bash
cd ~/projects/clementine-fork
grep -E "\"lit\"|\"express\"|\"@playwright/test\"|\"axe-playwright\"|\"vitest\"|\"tsx\"|\"esbuild\"|\"typescript\"|\"@types/node\"|\"@types/express\"" package.json
```

Add any additional deps the Step 1 grep surfaced.

- [ ] **Step 3: Move build scripts the web package needs**

```bash
mkdir -p scripts/audit
cp ~/projects/clementine-fork/scripts/esbuild-lexi.mjs scripts/
cp ~/projects/clementine-fork/scripts/audit/inventory-interactions.ts scripts/audit/
```

Edit copied files to fix path references that pointed into `src/lexi-dashboard/` — they need to point at `lexi/web/` now:

```bash
grep -n "lexi-dashboard\|src/" scripts/esbuild-lexi.mjs scripts/audit/inventory-interactions.ts
```

For each match, rewrite to the new path.

- [ ] **Step 4: Add tsconfig.json**

```bash
cat > lexi/web/tsconfig.json <<'TSCONFIG'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "outDir": "dist",
    "rootDir": ".",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist", "tests/e2e"]
}
TSCONFIG
```

If the original tsconfig had additional flags worth carrying (check `~/projects/clementine-fork/tsconfig.json`), merge them in.

- [ ] **Step 5: Install deps and run typecheck**

```bash
cd ~/projects/lexi
npm install
cd lexi/web
npm run typecheck
```

Expected: 0 type errors. If errors: usually a transitive dep wasn't carried over — add to `package.json` and re-run.

- [ ] **Step 6: Run unit tests**

```bash
cd ~/projects/lexi/lexi/web && npm test
```
Expected: same test count as the old repo, all green.

- [ ] **Step 7: Verify build**

```bash
npm run build
```
Expected: 0 errors. `dist/` directory created.

- [ ] **Step 8: Run E2E (the real coverage gate)**

```bash
npm run test:e2e
```
Expected: all 265 D-suite tests pass at 1280×800 + 1440×900.

If visual baselines fail because of CI-vs-local rendering differences:

```bash
npm run test:e2e -- --update-snapshots
git add tests/e2e/visual/
```

Document the re-baseline in the migration log.

- [ ] **Step 9: Commit**

```bash
cd ~/projects/lexi
git add lexi/web/package.json lexi/web/tsconfig.json scripts/
[ -d lexi/web/tests/e2e/visual ] && git add lexi/web/tests/e2e/visual/
git commit -m "chore(web): slim package.json to Lexi-only deps + scoped tsconfig

Drops Clementine-specific deps (electron, better-sqlite3, anthropic-ai,
desktop installer toolchain). Adds workspace-aware build scripts.
All 265 D-suite tests pass post-migration."
```

---

### Task 10: Move design `tokens.css` to `lexi/shared/`

**Files:**
- Move: `lexi/web/ui/design/tokens.css` → `lexi/shared/design/tokens.css`
- Modify: web files that import tokens.css
- Create: `lexi/shared/package.json`

- [ ] **Step 1: Create the shared package**

```bash
mkdir -p lexi/shared/design lexi/shared/types lexi/shared/scripts
cat > lexi/shared/package.json <<'SHAREDPKG'
{
  "name": "@kade/lexi-shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./design/tokens.css": "./design/tokens.css",
    "./types/api": "./types/api.ts"
  },
  "scripts": {
    "codegen": "node scripts/gen-swift-tokens.mjs && node scripts/gen-swift-types.mjs",
    "codegen:check": "node scripts/gen-swift-tokens.mjs --check && node scripts/gen-swift-types.mjs --check"
  }
}
SHAREDPKG
```

- [ ] **Step 2: Move tokens.css**

```bash
git mv lexi/web/ui/design/tokens.css lexi/shared/design/tokens.css
```

`git mv` preserves the rename in history (`git log --follow` traces through).

- [ ] **Step 3: Update web imports of tokens.css**

```bash
grep -rln "tokens\.css" lexi/web
```

For each result, rewrite the import path. The new path from a file in `lexi/web/ui/design/` to `lexi/shared/design/tokens.css` is `'../../../shared/design/tokens.css'`. CSS imports in TS files (`import './design/tokens.css'`) and CSS files (`@import url('./tokens.css')`) both must be updated.

- [ ] **Step 4: Verify web still builds**

```bash
cd lexi/web && npm run build
```
Expected: 0 errors.

```bash
npm run test:e2e -- --grep "@/cron"
```
Expected: passes — visual baseline still matches (token values identical).

- [ ] **Step 5: Commit**

```bash
cd ~/projects/lexi
git add lexi/shared/package.json lexi/shared/design/tokens.css \
  $(grep -rln "shared/design/tokens" lexi/web)
git commit -m "refactor(shared): move design tokens.css to lexi/shared/

Web continues to consume the same tokens. Mac will consume a
generated Swift mirror built from this file."
```


---

### Task 11: Add Swift token codegen script

**Files:**
- Create: `lexi/shared/scripts/gen-swift-tokens.mjs`
- Create: `lexi/shared/design/tokens.swift` (generated, committed)

- [ ] **Step 1: Write the generator**

```js
// lexi/shared/scripts/gen-swift-tokens.mjs
//
// Reads lexi/shared/design/tokens.css and emits a Swift mirror with
// matching enum-like static accessors. Run via `npm run codegen`.
// Pass --check to fail when generated output drifts from the committed file.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'design', 'tokens.css');
const DST = join(__dirname, '..', 'design', 'tokens.swift');

const css = readFileSync(SRC, 'utf8');

// Extract --token-name: value; pairs from :root or .light/.dark blocks.
const lines = css.split(/\r?\n/);
const groups = [];
let current = null;
for (const line of lines) {
  const sel = line.match(/^\s*(:root|\.light|\.dark)\s*\{/);
  if (sel) {
    const scope = sel[1] === ':root' ? 'root' : sel[1].slice(1);
    current = { scope, tokens: [] };
    groups.push(current);
    continue;
  }
  if (line.match(/^\s*\}/)) { current = null; continue; }
  if (!current) continue;
  const m = line.match(/^\s*--([a-z0-9-]+)\s*:\s*([^;]+);/i);
  if (m) current.tokens.push({ name: m[1], value: m[2].trim() });
}

const header = `// AUTO-GENERATED — do not edit. Edit lexi/shared/design/tokens.css and run \`npm run codegen\`.
import SwiftUI

`;

let body = `enum DesignTokens {\n`;
for (const g of groups) {
  body += `  enum ${g.scope.charAt(0).toUpperCase() + g.scope.slice(1)} {\n`;
  for (const { name, value } of g.tokens) {
    const swiftName = name.replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase());
    const hex = value.match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
      body += `    static let ${swiftName} = Color(hex: "${value}")\n`;
      continue;
    }
    const px = value.match(/^(-?\d*\.?\d+)px$/);
    if (px) { body += `    static let ${swiftName}: CGFloat = ${px[1]}\n`; continue; }
    const rem = value.match(/^(-?\d*\.?\d+)rem$/);
    if (rem) { body += `    static let ${swiftName}: CGFloat = ${parseFloat(rem[1]) * 16}\n`; continue; }
    body += `    static let ${swiftName}: String = ${JSON.stringify(value)}\n`;
  }
  body += `  }\n`;
}
body += `}\n\n`;

body += `extension Color {
  init(hex: String) {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    var rgba: UInt64 = 0
    Scanner(string: s).scanHexInt64(&rgba)
    let r, g, b, a: Double
    switch s.count {
      case 3:
        r = Double((rgba >> 8) & 0xF) / 15
        g = Double((rgba >> 4) & 0xF) / 15
        b = Double(rgba & 0xF) / 15
        a = 1
      case 6:
        r = Double((rgba >> 16) & 0xFF) / 255
        g = Double((rgba >> 8) & 0xFF) / 255
        b = Double(rgba & 0xFF) / 255
        a = 1
      case 8:
        r = Double((rgba >> 24) & 0xFF) / 255
        g = Double((rgba >> 16) & 0xFF) / 255
        b = Double((rgba >> 8) & 0xFF) / 255
        a = Double(rgba & 0xFF) / 255
      default:
        (r, g, b, a) = (0, 0, 0, 1)
    }
    self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
  }
}
`;

const out = header + body;

const checkMode = process.argv.includes('--check');
if (checkMode) {
  const existing = (() => { try { return readFileSync(DST, 'utf8'); } catch { return ''; } })();
  if (existing !== out) {
    console.error('tokens.swift is out of date.\nRun: npm run codegen');
    process.exit(1);
  }
  console.log('tokens.swift up to date.');
  process.exit(0);
}
writeFileSync(DST, out);
console.log(`Wrote ${DST} (${groups.reduce((n, g) => n + g.tokens.length, 0)} tokens across ${groups.length} scopes).`);
```

- [ ] **Step 2: Run the generator**

```bash
cd ~/projects/lexi && npm run codegen
```
Expected: `Wrote .../tokens.swift (N tokens across M scopes).`

- [ ] **Step 3: Inspect the output**

```bash
head -40 lexi/shared/design/tokens.swift
```
Expected: Swift `enum DesignTokens { enum Root { ... } enum Light { ... } enum Dark { ... } }` plus `Color(hex:)` extension.

- [ ] **Step 4: Verify check mode catches drift**

```bash
echo "// drift" >> lexi/shared/design/tokens.swift
cd lexi/shared && npm run codegen:check
```
Expected: exit 1 with "out of date" message.

```bash
cd ~/projects/lexi && npm run codegen   # restore clean state
```

- [ ] **Step 5: Commit**

```bash
git add lexi/shared/scripts/gen-swift-tokens.mjs lexi/shared/design/tokens.swift
git commit -m "feat(shared): codegen Swift mirror of design tokens

tokens.css is source of truth; tokens.swift is generated and committed.
CI runs codegen:check to fail on drift."
```

---

### Task 12: Create `lexi/shared/types/api.ts`

**Files:**
- Create: `lexi/shared/types/api.ts`

- [ ] **Step 1: Identify the API surface**

```bash
grep -rE "app\.(get|post|put|delete|patch)\(['\"][^'\"]+['\"]" \
  lexi/web/server.ts lexi/web/routes lexi/web/routes.ts -h 2>/dev/null \
  | sed -E "s/.*['\"]([^'\"]+)['\"].*/\1/" | sort -u
```
Expected: list of API paths (`/api/agents`, `/api/cron/jobs`, `/api/memory`, etc.).

- [ ] **Step 2: Write the API types file**

Capture response shapes for the read-only endpoints first — those are what Track 2B's Mac views consume. For each path, find the handler in `lexi/web/routes/`, read its `res.json(...)` shape, transcribe.

```ts
// lexi/shared/types/api.ts
//
// Source of truth for HTTP API shapes consumed by both lexi/web/ and lexi/mac/.
// Mac side uses a generated Swift mirror (api.swift). When this file changes,
// run `npm run codegen` to regenerate Swift.

export interface Timestamp { iso: string; unix: number }

// ---- Agents ---------------------------------------------------------------

export interface AgentSummary {
  slug: string;
  name: string;
  status: 'idle' | 'running' | 'broken' | 'unknown';
  lastSeen: Timestamp | null;
}

export interface AgentsListResponse {
  items: AgentSummary[];
}

// ---- Cron -----------------------------------------------------------------

export interface CronJobSummary {
  id: string;
  schedule: string;
  description: string;
  status: 'healthy' | 'broken' | 'idle';
  lastRun: Timestamp | null;
  nextRun: Timestamp | null;
}

export interface CronListResponse {
  items: CronJobSummary[];
  brokenCount: number;
}

// ---- Memory ---------------------------------------------------------------

export interface MemoryStats {
  totalChunks: number;
  totalTokens: number;
  lastWrite: Timestamp | null;
}

export interface MemoryStatsResponse {
  stats: MemoryStats;
}

// (Add more endpoints as Track 2B needs them. Initial scope: read-only surfaces
// the SwiftUI scaffold needs to compile.)
```

If the actual server returns a different shape, capture exactly what's emitted. Read `lexi/web/routes/<endpoint>.ts` for each.

- [ ] **Step 3: Verify nothing breaks**

The web side does not yet import from `lexi/shared/types/api.ts`. Just confirm the file compiles:

```bash
cd lexi/shared && npx tsc --noEmit types/api.ts
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add lexi/shared/types/api.ts
git commit -m "feat(shared): API type surface for cross-client consumption

Initial scope covers read-only endpoints Track 2B will need first
(agents, cron, memory). Expand as new views are built."
```

---

### Task 13: Add `gen-swift-types.mjs` codegen and emit `api.swift`

**Files:**
- Create: `lexi/shared/scripts/gen-swift-types.mjs`
- Create: `lexi/shared/types/api.swift`

- [ ] **Step 1: Write the generator**

A full TS-to-Swift translator is its own project; for Track 2A, ship a deliberately limited generator that handles the patterns in `api.ts`: `interface { name: type }` with `string | number | boolean | "literal" | T[] | T | null` typed properties.

```js
// lexi/shared/scripts/gen-swift-types.mjs
//
// Limited TypeScript -> Swift generator for lexi/shared/types/api.ts.
// Handles: interface declarations with primitive properties, string-literal
// unions, arrays, and nullable types. Anything more exotic throws and
// requires a manual extension.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'types', 'api.ts');
const DST = join(__dirname, '..', 'types', 'api.swift');
const ts = readFileSync(SRC, 'utf8');

function tsTypeToSwift(t) {
  t = t.trim();
  if (/\|\s*null$/.test(t)) {
    return tsTypeToSwift(t.replace(/\|\s*null$/, '').trim()) + '?';
  }
  if (/\[\]$/.test(t)) {
    return `[${tsTypeToSwift(t.replace(/\[\]$/, ''))}]`;
  }
  if (/^['"][^'"]+['"]\s*(\|\s*['"][^'"]+['"]\s*)+$/.test(t)) {
    return 'String';
  }
  if (t === 'string') return 'String';
  if (t === 'number') return 'Double';
  if (t === 'boolean') return 'Bool';
  if (t === 'Timestamp') return 'Timestamp';
  if (/^[A-Z][A-Za-z0-9_]*$/.test(t)) return t;
  throw new Error(`Unsupported TS type for Swift codegen: ${t}`);
}

const interfaces = [];
const re = /export interface ([A-Z][A-Za-z0-9_]*)\s*\{([\s\S]*?)\n\}/g;
let m;
while ((m = re.exec(ts))) {
  const [, name, body] = m;
  const props = [];
  for (const line of body.split(/\r?\n/)) {
    const pm = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(\??):\s*([^;]+);/);
    if (!pm) continue;
    const [, propName, optional, propType] = pm;
    let swiftType = tsTypeToSwift(propType);
    if (optional === '?') swiftType += '?';
    props.push({ propName, swiftType });
  }
  interfaces.push({ name, props });
}

let out = `// AUTO-GENERATED — do not edit. Edit lexi/shared/types/api.ts and run \`npm run codegen\`.
import Foundation

`;
for (const { name, props } of interfaces) {
  out += `struct ${name}: Codable, Equatable {\n`;
  for (const { propName, swiftType } of props) {
    out += `  let ${propName}: ${swiftType}\n`;
  }
  out += `}\n\n`;
}

const checkMode = process.argv.includes('--check');
if (checkMode) {
  const existing = (() => { try { return readFileSync(DST, 'utf8'); } catch { return ''; } })();
  if (existing !== out) {
    console.error('api.swift is out of date.\nRun: npm run codegen');
    process.exit(1);
  }
  console.log('api.swift up to date.');
  process.exit(0);
}
writeFileSync(DST, out);
console.log(`Wrote ${DST} (${interfaces.length} types).`);
```

- [ ] **Step 2: Run codegen**

```bash
cd ~/projects/lexi && npm run codegen
```
Expected: `Wrote .../api.swift (3 types).` (or however many interfaces are in `api.ts`).

- [ ] **Step 3: Inspect output**

```bash
cat lexi/shared/types/api.swift
```
Expected: Swift `struct AgentSummary: Codable, Equatable { ... }` etc., one per TS interface.

- [ ] **Step 4: Verify check mode**

```bash
cd lexi/shared && npm run codegen:check
```
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add lexi/shared/scripts/gen-swift-types.mjs lexi/shared/types/api.swift
git commit -m "feat(shared): codegen Swift mirror of API types

Limited TS->Swift translator handles the api.ts shape. Exotic types
throw explicitly so failures surface, not silent."
```


---

### Task 14: Initialize `lexi/mac/` xcodegen project

**Files:**
- Create: `lexi/mac/project.yml`
- Create: `lexi/mac/App/LexiApp.swift`
- Create: `lexi/mac/App/ContentView.swift`
- Create: `lexi/mac/Shell/RootNavigationView.swift`
- Create: `lexi/mac/Shell/Sidebar.swift`
- Create: `lexi/mac/Net/HTTPClient.swift`
- Create: `lexi/mac/Net/APIEndpoints.swift`
- Create: `lexi/mac/Design/DesignTokens.swift`
- Create: `lexi/mac/Resources/Info.plist`
- Create: `lexi/mac/Resources/Assets.xcassets/Contents.json`
- Create: `lexi/mac/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json`
- Create: `lexi/mac/README.md`

- [ ] **Step 1: Write project.yml**

```bash
mkdir -p lexi/mac/{App,Shell,Net,Design,Resources/Assets.xcassets/AppIcon.appiconset}
```

```yaml
# lexi/mac/project.yml
name: Lexi
options:
  bundleIdPrefix: com.kadetanner
  deploymentTarget:
    macOS: "14.0"
  developmentLanguage: en

settings:
  base:
    SWIFT_VERSION: "5.9"
    MACOSX_DEPLOYMENT_TARGET: "14.0"
    CODE_SIGN_STYLE: Automatic
    CURRENT_PROJECT_VERSION: 1
    MARKETING_VERSION: "0.1.0"

targets:
  Lexi:
    type: application
    platform: macOS
    deploymentTarget: "14.0"
    sources:
      - path: App
      - path: Shell
      - path: Net
      - path: Design
      - path: ../shared/types/api.swift
        buildPhase: sources
      - path: ../shared/design/tokens.swift
        buildPhase: sources
    resources:
      - path: Resources
    settings:
      base:
        INFOPLIST_FILE: Resources/Info.plist
        PRODUCT_BUNDLE_IDENTIFIER: com.kadetanner.lexi
        ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
        ENABLE_HARDENED_RUNTIME: YES
        CODE_SIGN_ENTITLEMENTS: ""
```

- [ ] **Step 2: Write LexiApp.swift**

```swift
// lexi/mac/App/LexiApp.swift
import SwiftUI

@main
struct LexiApp: App {
  var body: some Scene {
    WindowGroup {
      RootNavigationView()
        .frame(minWidth: 1024, minHeight: 700)
    }
    .windowStyle(.titleBar)
    .windowToolbarStyle(.unified)
  }
}
```

- [ ] **Step 3: Write ContentView.swift**

```swift
// lexi/mac/App/ContentView.swift
import SwiftUI

// Placeholder content used by RootNavigationView's detail pane.
// Real views land in Track 2B.
struct ContentView: View {
  var body: some View {
    VStack(spacing: 16) {
      Image(systemName: "sparkles")
        .font(.system(size: 48))
        .foregroundStyle(DesignTokens.Light.accent)
      Text("Lexi")
        .font(.largeTitle.weight(.semibold))
      Text("Scaffold ready. Views land in Track 2B.")
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

#Preview { ContentView() }
```

- [ ] **Step 4: Write RootNavigationView.swift and Sidebar.swift**

```swift
// lexi/mac/Shell/RootNavigationView.swift
import SwiftUI

struct RootNavigationView: View {
  @State private var selectedRoute: SidebarRoute? = .home
  var body: some View {
    NavigationSplitView {
      Sidebar(selection: $selectedRoute)
    } detail: {
      ContentView()
    }
  }
}
```

```swift
// lexi/mac/Shell/Sidebar.swift
import SwiftUI

enum SidebarRoute: String, CaseIterable, Identifiable {
  case home, agents, cron, today
  var id: String { rawValue }
  var label: String { rawValue.capitalized }
  var systemImage: String {
    switch self {
    case .home:   "house"
    case .agents: "person.2"
    case .cron:   "clock"
    case .today:  "calendar"
    }
  }
}

struct Sidebar: View {
  @Binding var selection: SidebarRoute?
  var body: some View {
    List(SidebarRoute.allCases, selection: $selection) { route in
      Label(route.label, systemImage: route.systemImage)
        .tag(route as SidebarRoute?)
    }
    .listStyle(.sidebar)
    .navigationTitle("Lexi")
    .frame(minWidth: 200)
  }
}
```

- [ ] **Step 5: Write HTTPClient.swift and APIEndpoints.swift**

```swift
// lexi/mac/Net/HTTPClient.swift
import Foundation

struct HTTPClient {
  let baseURL: URL
  let session: URLSession

  init(baseURL: URL = URL(string: "http://127.0.0.1:8765")!,
       session: URLSession = .shared) {
    self.baseURL = baseURL
    self.session = session
  }

  func get<T: Decodable>(_ path: String, as type: T.Type = T.self) async throws -> T {
    let url = baseURL.appendingPathComponent(path)
    let (data, response) = try await session.data(from: url)
    guard let http = response as? HTTPURLResponse,
          (200..<300).contains(http.statusCode) else {
      throw HTTPClientError.badStatus(response)
    }
    return try JSONDecoder.lexi.decode(T.self, from: data)
  }
}

enum HTTPClientError: Error {
  case badStatus(URLResponse)
}

extension JSONDecoder {
  static let lexi: JSONDecoder = {
    let d = JSONDecoder()
    d.dateDecodingStrategy = .iso8601
    return d
  }()
}
```

```swift
// lexi/mac/Net/APIEndpoints.swift
import Foundation

// Track 2B will populate concrete fetch methods. This file establishes the
// pattern so the first view added in 2B has a place to hang its fetch on.
struct LexiAPI {
  let client: HTTPClient
  init(client: HTTPClient = HTTPClient()) { self.client = client }

  // Pattern (no concrete views consume this yet — the type exercises the
  // Codable conformance from shared/types/api.swift):
  func listAgents() async throws -> AgentsListResponse {
    try await client.get("api/agents")
  }
}
```

- [ ] **Step 6: Write DesignTokens.swift wrapper**

```swift
// lexi/mac/Design/DesignTokens.swift
import SwiftUI

// The actual DesignTokens enum is generated into ../shared/design/tokens.swift
// and added to this target via project.yml's sources list. This file is a
// placeholder for any Swift-only extensions (e.g. dynamic light/dark
// resolution) added during Track 2C.
```

- [ ] **Step 7: Write Info.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>Lexi</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHumanReadableCopyright</key><string>Copyright © 2026 Kade Tanner.</string>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key><true/>
  </dict>
</dict>
</plist>
```

- [ ] **Step 8: Write Asset catalog placeholders**

```bash
cat > lexi/mac/Resources/Assets.xcassets/Contents.json <<'ASSETS'
{ "info" : { "author" : "xcode", "version" : 1 } }
ASSETS

cat > lexi/mac/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json <<'APPICON'
{
  "images" : [
    { "idiom" : "mac", "scale" : "1x", "size" : "16x16" },
    { "idiom" : "mac", "scale" : "2x", "size" : "16x16" },
    { "idiom" : "mac", "scale" : "1x", "size" : "32x32" },
    { "idiom" : "mac", "scale" : "2x", "size" : "32x32" },
    { "idiom" : "mac", "scale" : "1x", "size" : "128x128" },
    { "idiom" : "mac", "scale" : "2x", "size" : "128x128" },
    { "idiom" : "mac", "scale" : "1x", "size" : "256x256" },
    { "idiom" : "mac", "scale" : "2x", "size" : "256x256" },
    { "idiom" : "mac", "scale" : "1x", "size" : "512x512" },
    { "idiom" : "mac", "scale" : "2x", "size" : "512x512" }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
APPICON
```

- [ ] **Step 9: Write README**

```markdown
# Lexi macOS app

Scaffold only. Real views land in Track 2B.

## Build

​```bash
brew install xcodegen   # one-time
cd lexi/mac
xcodegen                # generates Lexi.xcodeproj
open Lexi.xcodeproj
# ⌘R in Xcode
​```

Or via CLI:
​```bash
xcodebuild -project Lexi.xcodeproj -scheme Lexi -destination 'platform=macOS' build
​```

## Layout

- `App/` — app entry + placeholder content view
- `Shell/` — navigation split view + sidebar (no real routes yet)
- `Net/` — HTTPClient + APIEndpoints (pattern only)
- `Design/` — Swift design tokens (generated from `../shared/design/tokens.css`)
- `Resources/` — Info.plist, asset catalog

## Regenerating after editing project.yml

​```bash
xcodegen
​```
```

- [ ] **Step 10: Generate the Xcode project**

```bash
cd lexi/mac && xcodegen
```
Expected: `Created project at .../Lexi.xcodeproj`.

- [ ] **Step 11: Build via xcodebuild**

```bash
xcodebuild -project Lexi.xcodeproj -scheme Lexi -destination 'platform=macOS' build 2>&1 | tail -20
```
Expected: `BUILD SUCCEEDED`.

If build fails: most common cause is a typo in Swift files or a missing import. Read the error, fix the file, retry. Code-signing complaints: in `project.yml` ensure `CODE_SIGN_STYLE: Automatic`; Xcode picks the personal team on first open.

- [ ] **Step 12: Run the app once manually**

```bash
open lexi/mac/Lexi.xcodeproj
# In Xcode: ⌘R
# Expected: window opens titled "Lexi" showing sidebar + "Scaffold ready" content view.
```

- [ ] **Step 13: Commit**

```bash
cd ~/projects/lexi
git add lexi/mac/
git commit -m "feat(mac): xcodegen-managed SwiftUI scaffold

App entry, NavigationSplitView shell with placeholder sidebar,
HTTPClient + APIEndpoints pattern, design tokens consumed from
lexi/shared/. No real views — Track 2B's job."
```

---

### Task 15: Add migration log

**Files:**
- Create: `docs/migration/2026-05-lexi-migration-log.md`

- [ ] **Step 1: Write the log**

Capture per-task decisions that won't be obvious from git log later — extra seams the audit found, version pin choices, baseline diffs.

```markdown
# Lexi Migration Log — 2026-05-07

Forensic record of decisions made during execution that aren't in the spec or
plan. Read alongside docs/superpowers/specs/2026-05-07-lexi-repo-migration.md.

## Seam-cut decisions
- mcp-bridge inlined: <N callsites> → src/lexi-dashboard/agents/mcp-bridge.ts
- events/bus inlined: <N callsites>; collision with existing tree resolved by <merge | rename>
- composio stub: replaced <N callsites>; consumed surface was <list of methods>
- Surprise seams found by audit: <list or "none">

## Version pin decisions (lexi/web/package.json)
- lit: <pinned-version>
- express: <pinned-version>
(repeat for each)

## Visual baselines
- Re-baselined post-migration: <yes/no>
- If yes: <N> snapshots updated; spot-checks verified intentional

## filter-repo command (final)
<paste exact command from scripts/migration/filter-repo-lexi.sh>

## Validation (Step 8 of spec §6)
- web typecheck/test/build/e2e: <pass/fail with details>
- mac xcodebuild: <pass/fail>
- git log spot-check: <N commits on cron-view>
```

- [ ] **Step 2: Commit**

```bash
git add docs/migration/2026-05-lexi-migration-log.md
git commit -m "docs(migration): in-flight migration log"
```


---

## Phase D — GitHub remote + CI

### Task 16: Create the GitHub repo

- [ ] **Step 1: Create private repo**

```bash
gh repo create kadetanner/lexi --private \
  --description "Lexi — personal agent platform with macOS-canonical client" \
  --confirm
```
Expected: prints `https://github.com/kadetanner/lexi.git`.

- [ ] **Step 2: Add remote and push**

```bash
cd ~/projects/lexi
git remote add origin git@github.com:kadetanner/lexi.git
git push -u origin main
git push origin web-frozen-2026-05-07
git push origin lexi-seam-cut-2026-05-07
```

- [ ] **Step 3: Verify**

```bash
gh repo view kadetanner/lexi --json name,visibility,defaultBranchRef
# expect: { "name": "lexi", "visibility": "PRIVATE", "defaultBranchRef": { "name": "main" } }
gh api repos/kadetanner/lexi/tags --jq '.[].name'
# expect: web-frozen-2026-05-07, lexi-seam-cut-2026-05-07
```

---

### Task 17: Add CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/ci.yml
name: ci
on:
  push:
    branches: [main]
  pull_request:

jobs:
  web:
    name: Web (typecheck + tests + e2e)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: lexi/web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
        working-directory: .
      - run: npm run typecheck
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: lexi/web/playwright-report/
          retention-days: 7

  shared-codegen-check:
    name: Shared (codegen drift check)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run -w @kade/lexi-shared codegen:check

  mac:
    name: Mac (xcodebuild)
    runs-on: macos-14
    defaults:
      run:
        working-directory: lexi/mac
    steps:
      - uses: actions/checkout@v4
      - run: brew install xcodegen
      - run: xcodegen
      - run: |
          xcodebuild \
            -project Lexi.xcodeproj \
            -scheme Lexi \
            -destination 'platform=macOS' \
            CODE_SIGNING_ALLOWED=NO \
            build
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add web/shared/mac checks"
git push origin main
```

- [ ] **Step 3: Watch the first run**

```bash
gh run watch
```
Expected: all three jobs go green. If web e2e fails on Linux due to baseline-rendering differences from macOS-captured snapshots: re-baseline locally on Linux via `npm run test:e2e -- --update-snapshots` (run inside an Ubuntu container) *or* configure Playwright to skip OS-specific snapshot suffixes. Document the choice in the migration log.

If mac fails for code-signing reasons: confirm `CODE_SIGNING_ALLOWED=NO` is in the xcodebuild invocation (CI doesn't have signing certificates).

- [ ] **Step 4: Configure branch protection**

```bash
gh api -X PUT repos/kadetanner/lexi/branches/main/protection \
  -F required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=Web (typecheck + tests + e2e)' \
  -F 'required_status_checks.contexts[]=Shared (codegen drift check)' \
  -F 'required_status_checks.contexts[]=Mac (xcodebuild)' \
  -F enforce_admins=false \
  -F required_pull_request_reviews= \
  -F restrictions=
```

Expected: 200 response.

```bash
gh api repos/kadetanner/lexi/branches/main/protection --jq '.required_status_checks.contexts'
# expect: array of 3 contexts
```

---

## Phase E — Validation gate

### Task 18: Fresh-clone validation per spec §6

- [ ] **Step 1: Clone fresh on a different path**

```bash
cd /tmp
rm -rf lexi-fresh
git clone git@github.com:kadetanner/lexi.git lexi-fresh
cd lexi-fresh
```

- [ ] **Step 2: Run the §6 done-bar checklist**

```bash
# 1. Repo metadata
gh repo view kadetanner/lexi --json name,visibility,defaultBranchRef

# 2. Web works end-to-end
npm ci
cd lexi/web
npm run typecheck && npm test && npm run build && npm run test:e2e
cd ../..

# 3. Git history preserved
git log --oneline lexi/web/ui/components/lexi-cron-view.ts | head -10
git tag --list "web-frozen-*"

# 4. Seam clean
grep -rho "from ['\"]\.\.[^'\"]*" lexi/web --include="*.ts" \
  | grep -v "lexi/" | wc -l
# expect: 0

# 5. Mac builds
cd lexi/mac && xcodegen
xcodebuild -project Lexi.xcodeproj -scheme Lexi \
  -destination 'platform=macOS' CODE_SIGNING_ALLOWED=NO build 2>&1 | tail -5
cd ../..

# 6. Shared consumed
grep -rl "shared/design/tokens" lexi/web | wc -l   # > 0
grep -rl "DesignTokens" lexi/mac | wc -l            # > 0
npm run -w @kade/lexi-shared codegen:check          # exit 0

# 7. CI green
gh run list --repo kadetanner/lexi --limit 3 --json conclusion
```

Each command must return its expected output. If any fails, return to the relevant Phase A/B/C task, fix, push, re-run.

- [ ] **Step 3: Tag the milestone**

```bash
cd ~/projects/lexi
git tag -a lexi-track-2a-2026-05-07 -m "Track 2A complete

Lexi web dashboard migrated to kadetanner/lexi monorepo with full
git history preserved. lexi/shared/ + lexi/mac/ scaffolds in place.
CI green. Ready for Track 2B."
git push origin lexi-track-2a-2026-05-07
```

- [ ] **Step 4: Update migration log final section**

Edit `docs/migration/2026-05-lexi-migration-log.md` — append "Validation" with actual outputs from Step 2.

```bash
git add docs/migration/2026-05-lexi-migration-log.md
git commit -m "docs(migration): record Track 2A validation results"
git push
```

---

### Task 19: Update vision roadmap

**Files:**
- Modify: `docs/superpowers/specs/2026-05-06-lexi-vision-roadmap.md`

- [ ] **Step 1: Mark Track 2A complete**

Replace the Track 2A section with:

```markdown
### Track 2A — Repo migration — ✅ Complete (2026-05-07)
**Duration:** ~1 day (actual)
**Spec:** [`2026-05-07-lexi-repo-migration.md`](./2026-05-07-lexi-repo-migration.md)
**Plan:** [`docs/superpowers/plans/2026-05-07-lexi-repo-migration-plan.md`](../plans/2026-05-07-lexi-repo-migration-plan.md)
**Outcome:** `kadetanner/lexi` private repo created. `lexi/web/` carries full git history including `web-frozen-2026-05-07` tag. `lexi/shared/` + `lexi/mac/` scaffolds in place. CI green. Old fork redirected via `LEXI-MOVED.md`.
**Tag:** `lexi-track-2a-2026-05-07`
**Migration log:** [`docs/migration/2026-05-lexi-migration-log.md`](../../migration/2026-05-lexi-migration-log.md)
```

Mark Track 2B as "Ready to design" (replace any "TBD" status).

- [ ] **Step 2: Commit and push**

```bash
git add docs/superpowers/specs/2026-05-06-lexi-vision-roadmap.md
git commit -m "docs(roadmap): mark Track 2A complete, Track 2B ready"
git push
```

---

## Phase F — Old fork housekeeping

### Task 20: Add redirect notice to old fork

**Files:**
- Working in: `~/projects/clementine-fork/`
- Create: `LEXI-MOVED.md`
- Rename: `src/lexi-dashboard/` → `src/lexi-dashboard.MOVED-TO-LEXI-REPO/`

- [ ] **Step 1: Create the redirect**

```bash
cd ~/projects/clementine-fork
git checkout lexi-dashboard

cat > LEXI-MOVED.md <<'NOTICE'
# Lexi has moved

The Lexi web dashboard (`src/lexi-dashboard/`) and its tests (`tests/lexi/`)
were extracted to a new monorepo on 2026-05-07.

**Canonical home:** https://github.com/kadetanner/lexi

The migration preserved full git history via `git filter-repo`, including
the `web-frozen-2026-05-07` tag. See:
- Spec: docs/superpowers/specs/2026-05-07-lexi-repo-migration.md (carried)
- Migration log: docs/migration/2026-05-lexi-migration-log.md (carried)

This Clementine fork remains for upstream PR #2 (tool-inventory probe fix).
After PR #2 resolves, this fork will be archived.

No new Lexi work should land here. All Lexi changes happen in kadetanner/lexi.
NOTICE

git mv src/lexi-dashboard src/lexi-dashboard.MOVED-TO-LEXI-REPO
git mv tests/lexi tests/lexi.MOVED-TO-LEXI-REPO
```

- [ ] **Step 2: Commit and push**

```bash
git add LEXI-MOVED.md
git commit -m "chore: redirect Lexi to kadetanner/lexi

Lexi web dashboard extracted to its own monorepo on 2026-05-07.
src/lexi-dashboard/ renamed to surface the redirection in IDE
search results. Fork stays alive for upstream PR #2; archive
once that resolves."
git push origin lexi-dashboard
```

- [ ] **Step 3: Verify the redirect is visible**

```bash
cat ~/projects/clementine-fork/LEXI-MOVED.md | head -3
ls ~/projects/clementine-fork/src/ | grep MOVED
```
Expected: heading visible; `lexi-dashboard.MOVED-TO-LEXI-REPO` listed.

---

### Task 21: Update `~/CLAUDE.md` project map

**Files:**
- Modify: `~/CLAUDE.md`

- [ ] **Step 1: Add Lexi entry, demote Clementine**

In the project map table, add a `lexi` row:

```markdown
| `lexi` (`~/projects/lexi/`) | **Lexi monorepo (canonical 2026-05-07).** `lexi/web/` (frozen Lit dashboard, fallback only), `lexi/shared/` (design tokens + API types, codegen for Swift mirrors), `lexi/mac/` (SwiftUI macOS app, scaffold-only as of Track 2A). | Lit + TypeScript, SwiftUI + macOS 14, xcodegen, npm workspaces, GitHub Actions | **Primary / active dev** |
```

In the existing `clementine-agent` row, append: `**Lexi work moved to kadetanner/lexi on 2026-05-07.** Fork retained for upstream PR #2 only.`

- [ ] **Step 2: Verify**

```bash
grep -c "lexi" ~/CLAUDE.md
```
Expected: ≥ 3.

`~/CLAUDE.md` is not in a git repo, so no commit. The change is effective on the next Claude Code invocation.

---

## Self-review

Spec coverage check (each spec section maps to plan tasks):

| Spec section | Plan coverage |
|---|---|
| §1 Done bar #1 (new repo exists) | Task 16 |
| §1 Done bar #2 (web works e2e) | Task 9 + Task 18 step 2 |
| §1 Done bar #3 (history preserved) | Task 6/7 verify steps + Task 18 |
| §1 Done bar #4 (seam clean) | Tasks 2/3/4/5 |
| §1 Done bar #5 (mac builds) | Task 14 |
| §1 Done bar #6 (shared consumed) | Tasks 10/11/12/13 + 14 |
| §1 Done bar #7 (CI passes) | Task 17 |
| §1 Done bar #8 (old fork archived) | Task 20 (redirect now; archive deferred to PR #2 resolution) |
| §2 Methodology phases | Tasks 1–18 mirror the 8 phases |
| §3 Scope: moves | Task 7 (filter-repo) |
| §3 Scope: shimmed/inlined | Tasks 2/3/4 |
| §3 Scope: lexi/shared/ | Tasks 10/11/12/13 |
| §3 Scope: lexi/mac/ skeleton | Task 14 |
| §3 Scope: stays-in-fork | Task 20 implicit |
| §4 step-by-step mechanics | Distributed across Tasks 1–18 |
| §5 Risks | Tasks 6 (dry run), 9 step 8 (re-baseline), 11 step 4 (drift check), 17 (CI gate), 20 (redirect) |
| §6 done-bar checklist | Task 18 |
| §7 handoff to Track 2B | Task 19 (roadmap update) |

No placeholders remain. The single deliberate `<version-from-original>` placeholders in Task 9 step 2 are values looked up at execution time from the live source repo.

---

## Pre-execution checklist

Before starting Task 1, confirm:

- [ ] `git status` in `~/projects/clementine-fork/` is clean.
- [ ] On branch `lexi-dashboard`. (`git branch --show-current`)
- [ ] Tag `web-frozen-2026-05-07` exists. (`git tag --list web-frozen-2026-05-07`)
- [ ] Tools installed: `git filter-repo` (`brew install git-filter-repo`), `gh` (`brew install gh && gh auth status`), `xcodegen` (`brew install xcodegen`), Xcode (`xcodebuild -version`).
- [ ] No important uncommitted work elsewhere in `~/projects/clementine-fork/`.
- [ ] You're prepared to push commits to `kadetanner/Clementine-AI-Assistant-1` (Phase A) and create new repo `kadetanner/lexi` (Phase D).
