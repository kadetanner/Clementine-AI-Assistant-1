# Lexi has moved

The Lexi web dashboard (`src/lexi-dashboard/`) and its tests (`tests/lexi/`)
were extracted to a new monorepo on 2026-05-07.

**Canonical home:** https://github.com/kadetanner/lexi

The migration preserved full git history via `git filter-repo`, including
the `web-frozen-2026-05-07` tag. The new repo also holds:
- `lexi/web/` — the dashboard (frozen at `web-frozen-2026-05-07`; bug fixes only)
- `lexi/shared/` — design tokens + API types consumed by web and Mac
- `lexi/mac/` — SwiftUI macOS app (scaffold; views built in Track 2B)

Migration log: see `kadetanner/lexi:docs/migration/2026-05-lexi-migration-log.md`.
Spec: `kadetanner/lexi:docs/superpowers/specs/2026-05-07-lexi-repo-migration.md`.

This Clementine fork remains for upstream PR #2 (tool-inventory probe fix).
After PR #2 resolves (merged or closed), this fork will be archived.

**No new Lexi work should land here.** All Lexi changes happen in
`kadetanner/lexi`.
