# Spec 2A — Lexi Repo Migration to `lexi/` Monorepo

**Date:** 2026-05-07
**Track:** 2A of the [Lexi vision roadmap](./2026-05-06-lexi-vision-roadmap.md)
**Estimated duration:** 1 week
**Status:** Design complete, ready for plan-writing
**Predecessor:** Track 1 web polish complete; freeze tag `web-frozen-2026-05-07` is the cut point.

---

## §1 — Goals & Done Bar

**Goal**
Cut the Lexi web dashboard out of the Clementine fork and land it (with full git history) in a new clean monorepo `kadetanner/lexi`. Initialize `lexi/mac/` as a buildable SwiftUI Xcode skeleton with no real views yet. Stand up `lexi/shared/` for cross-client design tokens and TypeScript types. Leave Track 2B able to start writing SwiftUI views on day one without further infrastructure work.

**Done bar — concrete, all eight must hold:**

1. **New repo exists.** `github.com/kadetanner/lexi` is created (private), `main` branch is the post-migration tree, no upstream relationship.
2. **`lexi/web/` is the working web dashboard.** `npm install && npm run dev` starts the Lexi Express server. `npm run build && npm test && npm run test:e2e` all pass. All 24 routes mount. All 265 D-suite tests pass. Visual baselines (`tests/.../*.png`) re-pass after path rewrites. Bundle stays under 400KB.
3. **Git history preserved.** `git log lexi/web/ui/components/lexi-cron-view.ts` shows the same commit chain that previously existed at `src/lexi-dashboard/ui/components/lexi-cron-view.ts`. `web-frozen-2026-05-07` tag exists in the new repo at the equivalent commit.
4. **Clementine seam cut cleanly.** `lexi/web/` has zero imports that resolve outside the `lexi/` tree. Required Clementine code (`agent/mcp-bridge`, `events/bus`, `integrations/composio/client`) is either (a) inlined into `lexi/web/`, (b) extracted into `lexi/shared/`, or (c) replaced with a stub. The choice is per-import, justified in the migration log.
5. **`lexi/mac/` is buildable.** Open `lexi/mac/Lexi.xcodeproj` in Xcode → Run → app launches showing a placeholder window titled "Lexi". Bundle ID `com.kadetanner.lexi`, code signing set to "Development", deployment target macOS 14. App entry, root navigation shell scaffold, design tokens loaded from `lexi/shared/`, basic HTTP client stub configured to point at `http://127.0.0.1:8765`. No real views.
6. **`lexi/shared/` is consumed by both clients.** Design tokens (currently `src/lexi-dashboard/ui/design/tokens.css`) live in `lexi/shared/design/tokens.css` + a generated `lexi/shared/design/tokens.swift`. `lexi/web/` imports the CSS; `lexi/mac/` imports the Swift. TypeScript types for the API surface live in `lexi/shared/types/api.ts`; mac side reads a generated Swift mirror.
7. **CI passes on the new repo.** GitHub Actions runs typecheck + unit tests + E2E for `lexi/web/` and `xcodebuild` for `lexi/mac/` on every PR. Zero red checks at done time.
8. **Old fork archived.** `kadetanner/Clementine-AI-Assistant-1` is set to read-only / archived after upstream PR #2 is resolved (merged or closed). Until that PR resolves, the fork stays alive but no new Lexi work happens there.

**Out of scope (deferred or never)**

- Any new web feature, refactor, or visual change. Polish bar held at `web-frozen-2026-05-07`.
- Any SwiftUI view implementation. Track 2B's job. `lexi/mac/` ships with placeholder window only.
- Backend extraction. The Express server stays inside `lexi/web/` (it's tightly coupled to the dashboard for now). When the mac client needs it independently, that becomes its own track.
- pipelinepulse. Stays where it is in `~/projects/pipelinepulse/`.
- Renaming the `clementine-agent` npm package. The new `lexi/web/` package is `@kade/lexi-web` (private, never published). The published `clementine-agent` v1.18.x stays on the fork.
- Migrating non-Lexi Clementine code (`src/agent/`, `src/desktop/`, `src/voice/`, `src/dashboard/`, etc.). It stays in the fork. Anything Lexi needs gets inlined or shimmed in step §4.
- Carrying the Electron desktop installer over. Lexi-Mac replaces it; the Electron bits stay with Clementine.
- Vault content (`vault/`). Belongs to Clementine; not Lexi.

---

## §2 — Migration Methodology

The procedural backbone — how we move 134 TypeScript files across two repos with full history without breaking the dashboard or the freeze tag.

### Migration unit: the seam audit

Before any `git filter-repo` runs, we produce a single seam audit document committed to the *current* repo at `docs/migration/2026-05-lexi-seam-audit.md`. It has four sections:

1. **Imports leaving `src/lexi-dashboard/`.** Every `from '../../...'` or `from '../../../...'` import. For each: target file, how many call sites, decision (inline / shared / shim / drop).
2. **Files in `src/lexi-dashboard/` referenced by anything outside it.** Reverse-direction grep. For each: caller, decision (will the caller break? do we leave a shim in the fork?).
3. **Build tool boundary.** Every `package.json` script that touches `src/lexi-dashboard/` (currently `build:assets`, `build:lexi`, `dev`, `dashboard`, `test:e2e`, `audit:inventory`, `parity`). For each: kept-as-is / rewritten / dropped.
4. **Dependency boundary.** Every `package.json` dep used by `src/lexi-dashboard/`. Rough categories: `lit`, `playwright`, `axe-playwright`, `express`, `vitest`, `tsx`, `esbuild`, etc. The new `lexi/web/package.json` carries only these. (Hand-audit, not automated — the dependency graph isn't clean enough for a tool to do it correctly.)

The audit becomes the source-of-truth for what moves, what stays, what gets rewritten. The plan-writing phase decomposes it into commit-sized tasks.

### Migration phases, in order

1. **Pre-flight on current repo (`lexi-dashboard` branch).** Land seam fixes *before* filter-repo, while the file paths still match what tests + tooling expect. Easier to debug a broken import in-place than after a rewrite.
2. **Seam-cut commit batch.** One commit per outside-`lexi-dashboard` dependency resolved (inlined / extracted / shimmed). All 134 files now self-contained inside `src/lexi-dashboard/`. Tag this point as `lexi-seam-cut-2026-05-XX` for forensic clarity. All tests still green.
3. **Filter-repo dry run.** In a throwaway clone, run the full filter-repo command. Inspect: does `git log lexi/web/some-file.ts` work? Does the freeze tag survive? Are unintended files dragged along? Iterate the filter expression until clean.
4. **Filter-repo for real.** Output: a new local repo `~/projects/lexi/` with rewritten paths. `web-frozen-2026-05-07` tag points at the equivalent commit on the new tree. `main` branch = post-migration HEAD.
5. **Add `lexi/mac/` and `lexi/shared/`.** Three commits: (a) `lexi/shared/` directory with tokens + types, (b) `lexi/web/` retrofitted to consume `lexi/shared/`, (c) `lexi/mac/` Xcode skeleton.
6. **Push to GitHub.** Create `kadetanner/lexi` private repo. Force-push initial state. Tag and push `web-frozen-2026-05-07`. Add CI workflow.
7. **Validation gate.** Clone fresh, run web build + test + e2e, run `xcodebuild` on mac project. Spot-check git log for representative files. Confirm freeze tag works. Sign off.
8. **Post-migration housekeeping.** Update `~/CLAUDE.md` project map (Clementine fork → archived; Lexi → primary). Update Lexi vision roadmap with new pointers. Mark Track 2A complete.

### The `git filter-repo` invocation (sketch)

```bash
# In throwaway clone of clementine-fork (after seam-cut tag exists)
git filter-repo \
  --path src/lexi-dashboard/ \
  --path tests/lexi/ \
  --path docs/audit/2026-05-web-polish-audit.md \
  --path docs/audit/2026-05-web-polish-ui-review.md \
  --path docs/superpowers/specs/2026-05-06-lexi-vision-roadmap.md \
  --path docs/superpowers/specs/2026-05-06-lexi-web-polish-heavy-design.md \
  --path docs/superpowers/specs/2026-05-07-lexi-repo-migration.md \
  --path-rename src/lexi-dashboard/:lexi/web/ \
  --path-rename tests/lexi/:lexi/web/tests/ \
  --tag-rename '':'lexi-' \
  --refs web-frozen-2026-05-07 main lexi-dashboard lexi-seam-cut
```

Refined during the dry-run phase. The exact `--path` list comes from the seam audit. `--path-rename` puts `src/lexi-dashboard/foo.ts` at `lexi/web/foo.ts`.

The freeze tag is preserved by listing it in `--refs`. The `--tag-rename` prefix avoids collision with existing tags in the new repo (defensive — there are none yet).

### Why filter-repo over alternatives

- `git subtree split` — works but produces commits that mix moved + dropped paths confusingly. Filter-repo is cleaner.
- Fresh repo with single import commit — loses the dense Track 1 polish history (commits f70a293, 31b652b, dcb2a40, etc.) that's the strongest evidence of "why does this code look the way it does."
- In-place `git mv` (option C from Spec 2A pre-write decisions) — we explicitly rejected this so the new repo isn't burdened by Clementine's history of unrelated work (~years of agent + voice + desktop commits).

### Why this structure

Cutting seams *before* moving paths means tests keep passing throughout. Moving paths *before* adding Mac + Shared means the filter-repo invocation is tight (single source repo, single output mapping). Adding Mac + Shared after the filter completes means those commits don't need to survive a rewrite.

---

## §3 — Scope: what moves, what gets shimmed, what stays

### Moves to `lexi/web/` (with full history)

**Source tree:** `src/lexi-dashboard/` → `lexi/web/`
- `lexi/web/agents/` (activity-log, restart, vault-store)
- `lexi/web/data/` (from-upstream/, lexi-native/, paths)
- `lexi/web/events/` (bus, types)
- `lexi/web/fixes/`
- `lexi/web/launch/`
- `lexi/web/proxy/`
- `lexi/web/routes/` + `routes.ts`
- `lexi/web/server.ts`
- `lexi/web/services/` (connection-registry, credential-store, probe)
- `lexi/web/ui/` (components, design, fonts, shell, state, styles, theme, vendor, views)
- `lexi/web/upstream-omissions.ts`
- `lexi/web/workflows/`

**Tests:** `tests/lexi/` → `lexi/web/tests/`
- All 50 top-level test files + `e2e/`, `agents/`, `connections/`, `components/`, `components-debug/`, `dod/`, `fixes/`, `workflows/` subdirectories.
- 83 spec/test files total.

**Docs:** the four Lexi-relevant markdown files in `docs/audit/` and `docs/superpowers/specs/`. Nothing else from `docs/`.

**Build assets:** the `scripts/esbuild-lexi.mjs`, `scripts/audit/`, and `scripts/lexi-parity-audit.mjs` — but only after seam-cutting confirms they don't reach into other Clementine paths.

### Shimmed or inlined (from Clementine into `lexi/web/`)

The 2026-05-07 seam audit confirmed **two** outside-tree imports (the `events/bus` import this spec originally listed turned out to be a depth-2 import that resolves *in-tree* — `src/lexi-dashboard/data/lexi-native/session-log-tailer.ts` → `../../events/bus.js` lands at `src/lexi-dashboard/events/bus.ts`, which travels with the migration as part of the moved tree):

| Import | Decision | Rationale |
|---|---|---|
| `../../agent/mcp-bridge.js` | **Inline** copy of the file into `lexi/web/agents/mcp-bridge.ts`. Drop unused exports. | Two use sites in `services/`. Lexi shouldn't depend on Clementine's agent abstraction. |
| `../../integrations/composio/client.js` | **Drop**, replace with a thin stub that returns "not configured" if Composio isn't wired. | Composio isn't a Lexi-track feature. Two use sites in `services/`. If the connections view needs to talk to Composio, that's a Track 2C decision. |

Decisions confirmed during the §2 step 1 seam audit (`docs/migration/2026-05-lexi-seam-audit.md`). If audit surfaces additional imports not listed above, the same inline / shared / shim / drop framework applies and the migration log records each.

### Lives in `lexi/shared/` (new)

**`lexi/shared/design/`**
- `tokens.css` — the canonical CSS custom-property palette (color, spacing, typography). Source-of-truth.
- `tokens.swift` — generated from `tokens.css` by a small build script (`lexi/shared/scripts/gen-swift-tokens.mjs`). `lexi/mac/` consumes it. Generation is part of `lexi/web/` build to keep the contract enforceable.

**`lexi/shared/types/`**
- `api.ts` — TypeScript types for the Express API surface (request/response shapes for `/api/agents`, `/api/cron`, `/api/memory`, etc.). Extracted from current `lexi/web/server.ts` + per-route types.
- `api.swift` — generated Swift mirror via the same generation step. Initially: only the types Track 2B will need (the simple read-only ones).

**`lexi/shared/scripts/`**
- `gen-swift-tokens.mjs` — CSS → Swift token generator.
- `gen-swift-types.mjs` — TypeScript → Swift type generator (limited subset; enough for Track 2B).

### `lexi/mac/` skeleton (new, **D4: Option B**)

Generated via `xcodegen` (consistent with pipelinepulse pattern). Project structure:

```
lexi/mac/
├── project.yml                     # xcodegen spec
├── Lexi.xcodeproj                  # generated, gitignored except project.yml
├── App/
│   ├── LexiApp.swift              # @main app entry
│   └── ContentView.swift          # placeholder "Hello Lexi" view
├── Shell/
│   ├── RootNavigationView.swift   # NavigationSplitView scaffold (no real views)
│   └── Sidebar.swift              # placeholder sidebar
├── Net/
│   ├── HTTPClient.swift           # URLSession wrapper, base URL config
│   └── APIEndpoints.swift         # uses lexi/shared/types/api.swift
├── Design/
│   └── DesignTokens.swift         # imports lexi/shared/design/tokens.swift
├── Resources/
│   ├── Assets.xcassets            # app icon placeholder
│   └── Info.plist
└── README.md                      # how to build, run, regenerate project
```

**Bundle ID:** `com.kadetanner.lexi`. **Deployment target:** macOS 14. **Code signing:** automatic with personal team. **Entitlements:** App Sandbox off for now (revisit when shipping). **Network client:** points at `http://127.0.0.1:8765` (Lexi Express default).

What the skeleton does **not** include (deferred to Track 2B):
- Any real RevOps or agent view.
- SSE client.
- State management beyond per-view `@State`.
- Menu bar app, hotkey HUD, dock badge, widgets, ⌘K palette, Spotlight indexing — all 10 native moments are Track 2C.
- Auto-launch via SMAppService.

### Stays in the fork (`kadetanner/Clementine-AI-Assistant-1`)

Everything not in the move-list above. Specifically:
- `src/agent/`, `src/dashboard/`, `src/desktop/`, `src/voice/`, `src/cli/`, `src/integrations/`, `src/brain/`, `src/channels/`, `src/config/`, `src/gateway/`, `src/memory/`, `src/secrets/`, `src/security/`, `src/tools/`, `src/types.ts`, `src/index.ts`, `src/vault-migrations/`.
- `vault/`, `electron-builder.yml`, `install.sh`, `bin/`.
- `node_modules/`, `dist/`, `playwright-report/`, `test-results/`, `vendor/`.
- All non-Lexi tests in `tests/` (which is most of them).
- Clementine's `roadmap.md`, `README.md`, `LICENSE`.
- The published `clementine-agent` npm package.

The fork remains operational for Clementine-track work until upstream PR #2 (the tool-inventory probe fix) resolves. Then archive.

---

## §4 — Migration Mechanics, in Detail

### Step 1: Seam audit (current repo)

Output: `docs/migration/2026-05-lexi-seam-audit.md`. Sections per §2. Generated semi-automatically:

```bash
# Imports leaving the tree
grep -rho "from '\\.\\.[^']*" src/lexi-dashboard --include="*.ts" | sort -u

# Reverse: who imports into the tree
grep -rh "from '.*lexi-dashboard" src --include="*.ts" | grep -v src/lexi-dashboard

# package.json scripts touching the tree
grep -E "lexi-dashboard|lexi/" package.json
```

Hand-classify each result. Estimated: 1 day.

### Step 2: Seam-cut commits (current repo)

One commit per resolution. Test suite green after each. Tag `lexi-seam-cut-2026-05-XX` on the last one. Push.

For each Clementine import: copy the source file into `src/lexi-dashboard/...` at an equivalent path, rewrite the import, delete the now-unused fields, run tests, commit. Composio: replace import with stub, run tests, commit.

Estimated: 1 day for 3 known imports + whatever the audit surfaces.

### Step 3: Filter-repo dry run

Throwaway clone. Iterate the `--path` and `--path-rename` arguments until:
- `git log` on a representative file (e.g. `lexi/web/ui/components/lexi-cron-view.ts`) shows the full history.
- `web-frozen-2026-05-07` tag points at a sensible commit.
- No unintended files dragged along (especially `node_modules/`, `dist/`, `vault/`).
- Repo size is reasonable (<200MB; current Clementine repo is larger because of vault content).

Estimated: half a day.

### Step 4: Filter-repo for real

Run the finalized command on a fresh clone, output to `~/projects/lexi/`. This becomes the working tree.

```bash
cd ~/projects
git clone --no-local clementine-fork lexi-staging
cd lexi-staging
git filter-repo \
  --path src/lexi-dashboard/ \
  --path tests/lexi/ \
  ... \
  --path-rename src/lexi-dashboard/:lexi/web/ \
  --path-rename tests/lexi/:lexi/web/tests/
mv ../lexi-staging ../lexi
```

### Step 5: Add Mac + Shared (in `~/projects/lexi/`)

Three commits in order:
1. `Add lexi/shared/ — design tokens + API types + codegen scripts`
2. `Wire lexi/web/ to consume lexi/shared/ tokens` (replaces `src/lexi-dashboard/ui/design/tokens.css` with import from shared)
3. `Add lexi/mac/ Xcode skeleton via xcodegen`

After commit 2, `lexi/web/` tests must still pass. After commit 3, `xcodebuild -project lexi/mac/Lexi.xcodeproj` must succeed.

### Step 6: New `package.json`

`lexi/web/package.json` is **not** the current Clementine `package.json`. It's a fresh document with:
- `"name": "@kade/lexi-web"` (private)
- `"version": "0.1.0"`
- Only the deps the seam audit identified: `lit`, `express`, `@playwright/test`, `axe-playwright`, `vitest`, `tsx`, `esbuild`, `typescript`, plus runtime deps actually imported by the moved code.
- Scripts: `dev`, `build`, `test`, `test:e2e`, `typecheck`, `audit:inventory`. Drop `desktop:*`, `dashboard`, `mcp`, `cli`, `dod*`, `parity*`, `prepublishOnly`, `postinstall` — all Clementine-specific.

Root-level `package.json` of the new repo is a workspace configuration (npm workspaces) listing `lexi/web` and `lexi/shared`. Mac doesn't need npm.

### Step 7: GitHub remote + CI

- Create private repo `kadetanner/lexi`.
- `git remote add origin git@github.com:kadetanner/lexi.git`
- `git push -u origin main && git push origin web-frozen-2026-05-07`
- Add `.github/workflows/ci.yml`:
  - `web`: `npm ci`, `npm run typecheck`, `npm test`, `npm run test:e2e`. Uploads Playwright report on failure.
  - `mac`: `xcodebuild -project lexi/mac/Lexi.xcodeproj -scheme Lexi -destination 'platform=macOS' build`. Skipped on Linux runners; runs on `macos-latest`.
- Branch protection on `main`: require both checks green before merge.

### Step 8: Validation gate

Fresh clone on a different machine path. Build, test, run dashboard, click through 3 representative views (`#/cron`, `#/agents`, `#/today`). Open `lexi/mac/Lexi.xcodeproj`, run, confirm placeholder window. `git log lexi/web/ui/components/lexi-cron-view.ts` shows full history. Then sign off.

---

## §5 — Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Filter-repo silently drops a file** because the `--path` list is incomplete. | Dry-run first. Diff the file list of the resulting tree against `find src/lexi-dashboard tests/lexi -type f` before running for real. Spot-check 5+ files for full git log. |
| **Seam-cut breaks runtime behavior** in a way tests don't catch. | After seam-cut tag exists, manually start the dashboard and click through every view. The Track 1 visual baselines + D-suite are dense enough that a real regression should fall out, but a manual pass is cheap insurance. |
| **Visual baselines re-fail after path move** due to OS-level rendering differences (CI macOS vs local). | Re-baseline once on the new repo's CI runner; commit those snapshots as the new canonical. Same pattern Track 1 used. |
| **`lexi/shared/` codegen breaks during normal `lexi/web/` development** because contributors edit `tokens.swift` directly instead of `tokens.css`. | Make `tokens.swift` generated-only with a header comment "// GENERATED — edit tokens.css and rerun npm run codegen". `lexi/web/` build runs codegen automatically. CI fails if `git diff` shows uncommitted codegen drift. |
| **Old fork keeps drifting** and someone (future-Kade, future-Claude) edits Lexi code there by mistake. | After Step 8 sign-off, push a single commit to the fork's `lexi-dashboard` branch that adds a top-level `LEXI-MOVED.md` pointing at the new repo, and rename `src/lexi-dashboard/` → `src/lexi-dashboard.MOVED-TO-LEXI-REPO/` so any IDE search surfaces the redirection. |
| **Upstream PR #2 lands during migration** and changes files in the new tree. | Track 2A doesn't depend on the PR. If it merges before Track 2A finishes, cherry-pick the relevant commits onto `main` of the new repo. If it doesn't merge, no action. |
| **xcodegen + Xcode version drift** on Kade's local machine vs future CI. | Pin xcodegen version in a `lexi/mac/.tool-versions` (or homebrew formula reference). Pin Xcode version in CI workflow. Document in `lexi/mac/README.md`. |
| **Bundle ID collision** with future App Store distribution. | `com.kadetanner.lexi` is reserved by personal Apple Developer account. Re-confirm in App Store Connect before doing real signing in Track 2C. |

---

## §6 — Done bar — concrete validation checklist

Mirrors §1 but is executable. The plan-writing phase decomposes this into per-task verification steps.

```bash
# 1. New repo exists and is the canonical
gh repo view kadetanner/lexi --json name,visibility,defaultBranchRef
# expect: { "name": "lexi", "visibility": "PRIVATE", "defaultBranchRef": { "name": "main" } }

# 2. Web works end-to-end
cd ~/projects/lexi
npm ci
cd lexi/web && npm run typecheck && npm test && npm run build && npm run test:e2e
# expect: all green; 265 D-tests pass; bundle < 400KB

# 3. Git history preserved
git log --oneline lexi/web/ui/components/lexi-cron-view.ts | wc -l
# expect: matches commit count from old repo for that file
git tag --list "web-frozen-*"
# expect: web-frozen-2026-05-07

# 4. Seam clean
grep -rho "from ['\"]\\.\\.[^'\"]*" lexi/web --include="*.ts" | grep -v "lexi/" | wc -l
# expect: 0 (no imports leaving the lexi tree)

# 5. Mac builds
xcodebuild -project lexi/mac/Lexi.xcodeproj -scheme Lexi -destination 'platform=macOS' build
# expect: BUILD SUCCEEDED; binary launches a window titled "Lexi"

# 6. Shared consumed by both
grep "lexi/shared/design/tokens.css" lexi/web -r | wc -l    # expect: > 0
grep "DesignTokens" lexi/mac -r | wc -l                      # expect: > 0
node lexi/shared/scripts/gen-swift-tokens.mjs --check        # expect: exit 0 (no drift)

# 7. CI green
gh run list --repo kadetanner/lexi --limit 3 --json conclusion
# expect: every run "success"

# 8. Old fork redirected
cat ~/projects/clementine-fork/LEXI-MOVED.md  # expect: points at kadetanner/lexi
ls ~/projects/clementine-fork/src/lexi-dashboard.MOVED-TO-LEXI-REPO 2>/dev/null  # expect: exists
```

When all eight commands return their expected results in a single sitting on a clean machine: Track 2A is done. Tag `lexi-track-2a-2026-05-XX` on `main`. Update the vision roadmap.

---

## §7 — Handoff to Track 2B

Track 2B can start as soon as Track 2A's done bar holds. The hand-off contract:

1. `lexi/web/` is frozen-bar-compliant and stable — Track 2B does not touch it.
2. `lexi/shared/` exists and is the place to add cross-client types as Track 2B builds views. Convention: every new API endpoint gets a TypeScript type in `lexi/shared/types/api.ts`, codegen produces the Swift mirror, both clients consume.
3. `lexi/mac/` has app shell + design tokens + HTTP client. Track 2B's first commit can be "Add agents view" without further infrastructure work.
4. There is one decision deliberately punted to Track 2B: **state management pattern.** `lexi/mac/` has only `@State` per view. `@Observable` vs SwiftData vs TCA vs hand-rolled stores is a Track 2B brainstorming output, not a Track 2A decision.

---

## §8 — Pointers

- This spec lives at `docs/superpowers/specs/2026-05-07-lexi-repo-migration.md`. After migration, it lives at `docs/superpowers/specs/2026-05-07-lexi-repo-migration.md` in the new `kadetanner/lexi` repo (filter-repo carries it).
- Plan: written next at `docs/superpowers/plans/2026-05-07-lexi-repo-migration-plan.md`. Decomposes §2 + §4 into commit-sized tasks with verification per task.
- Vision umbrella: [`2026-05-06-lexi-vision-roadmap.md`](./2026-05-06-lexi-vision-roadmap.md). Update after Track 2A's done bar holds.
- Track 1 evidence: [`docs/audit/2026-05-web-polish-audit.md`](../../audit/2026-05-web-polish-audit.md), [`docs/audit/2026-05-web-polish-ui-review.md`](../../audit/2026-05-web-polish-ui-review.md).
