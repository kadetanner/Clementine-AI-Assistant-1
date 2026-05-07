# Lexi — Vision & Roadmap

**Date:** 2026-05-06
**Status:** Vision recap; references the sequential implementation specs.
**Audience:** Future-Kade, future-Claude. This document exists so the strategic context is never lost between specs.

---

## Product framing

Lexi is the single primary tool: a personal agent platform layered with RevOps cockpit surfaces. **macOS is the canonical client.** Web exists as a fallback only.

Today, two products fragment the experience:

- **Lexi web dashboard** (TypeScript + Lit + Express) — personal agent platform with 24 mounted routes (one additional dead-code view-class flagged for cleanup in Track 1). Daily driver but not native, and was never *designed* to be a desktop product.
- **pipelinepulse iOS app** (SwiftUI + FastAPI) — RevOps cockpit. Killer feature is iOS Live Activities for closed-won deals.

The plan is to converge these into one canonical Mac app and freeze both legacy surfaces.

---

## Architecture (terminal state)

```
SwiftUI Lexi macOS app  (primary; full parity with web; absorbs RevOps surfaces)
    ├─ HTTP/SSE → Lexi Express backend
    │            (agents, memory, workflows, cron, routines, chat, trace,
    │             connections, vault-write, fixes, upstream-proxy)
    │
    ├─ HTTP    → pipelinepulse FastAPI on Render
    │            (Pulse, Funnel, Leaderboard, Feed, Ask)
    │
    └─ Native macOS shell:
         · menu bar app                   · multi-window / tear-off inspector
         · global hotkey HUD (⌘⌥L)        · dock badge + dock menu
         · ⌘K command palette (in-app)    · auto-launch on login (SMAppService)
         · native notifications           · desktop widgets (macOS 14+)
         · share / Services menu          · Spotlight indexing + Quick Look

Web Lexi dashboard       (frozen fallback after Track 1 polish; no net-new features)
pipelinepulse iOS app    (frozen, Live-Activities-only; no net-new features)
```

---

## Tracks

### Track 1 — Web dashboard polish (Heavy bar) — ✅ Complete (2026-05-07)
**Duration:** ~3 weeks (actual: ~2 days of focused work after D-suite scaffold landed)
**Spec:** [`2026-05-06-lexi-web-polish-heavy-design.md`](./2026-05-06-lexi-web-polish-heavy-design.md)
**Goal:** Bring the existing web dashboard to "good fallback" quality across all routes, then freeze. Heavy bar = full functional audit, full visual audit, ~120 Playwright E2E tests, accessibility/keyboard pass, explicit empty/error/loading states everywhere.
**Outcome:** 265/265 D-tests green across 24 routes (D1 mount, D2 axe, D3 visual baselines, D4 state coverage). gsd-ui-auditor 6-pillar review identified 3 cross-cutting BLOCKs; all resolved (lx-button + lx-card shadow DOM migration, dual-empty-pane collapse). Final score ~21-22/24 — at the freeze bar.
**Audit:** [`docs/audit/2026-05-web-polish-audit.md`](../../audit/2026-05-web-polish-audit.md), [`docs/audit/2026-05-web-polish-ui-review.md`](../../audit/2026-05-web-polish-ui-review.md)
**Freeze tag:** `web-frozen-2026-05-07`
**Then:** No net-new features on the web dashboard.

### Track 2A — Repo migration — Ready to design
**Duration:** ~1 week
**Spec:** TBD — write Spec 2A now that Track 1 has frozen.
**Goal:** Move the existing Clementine fork into a `lexi/` monorepo. Existing source becomes `lexi/web/`. New `lexi/mac/` Xcode project skeleton initialized. Branch + history preservation strategy decided when Spec 2A is written, with everything Track 1 taught us in hand.

### Track 2B — All-view scaffold
**Duration:** ~6 weeks
**Spec:** TBD, written after Track 2A lands.
**Goal:** SwiftUI scaffolds for all dashboard views + 5 RevOps views. Basic data display, navigation, no fancy interactions. Ship "ugly but real native" v0. Establish HTTP client layer, SSE client, state management pattern, design tokens.

### Track 2C — Native moments + per-view polish
**Duration:** ~3 months, parallel-friendly
**Spec:** TBD, written after Track 2B lands. Likely splits into multiple specs (one per native moment + one per view-cluster).
**Goal:** All 10 native moments implemented. Each view polished to production quality in priority order.

---

## Decisions snapshot

The seven binding choices made during the 2026-05-06 brainstorming session, recorded so they're not relitigated:

| # | Decision | Choice |
|---|---|---|
| 1 | Stack | SwiftUI, macOS-only |
| 2 | View scope | Full parity (every web view + 5 RevOps views) |
| 3 | Web dashboard's role | Polish to "good fallback" then freeze |
| 4 | Native moments | All 10 in scope (menu bar, hotkey HUD, notifications, multi-window, dock badge, auto-launch, widgets, share/Services, ⌘K palette, Spotlight) |
| 5 | Platforms | macOS only; iOS pipelinepulse stays for Live Activities only |
| 6 | pipelinepulse fate | Lexi-Mac absorbs RevOps UI; iOS pipelinepulse frozen at Live-Activities-only |
| 7 | Backend strategy | Keep both backends (Lexi Express + pipelinepulse FastAPI); Mac client speaks both |

Architectural approach: **Approach 3** — horizontal scaffold + polish. New monorepo, all views native from day 0 (ugly v0 first, then polish).

Spec strategy: **C** — one spec at a time, just-in-time. This vision doc provides the umbrella; each track gets its own spec written when there's maximum information available.

---

## Risks to watch (over the full multi-month arc)

- **v0 looks worse than today's web dashboard for ~6 weeks.** Discipline to keep using it (or to time-box scaffold phase) is required. Mitigation: the Heavy-polished web dashboard remains available as the fallback until Mac feels at least equal.
- **"Falling in love with scaffolds."** Real risk that the polish phase gets indefinitely deferred. Mitigation: every Track 2C sub-spec has a hard polish gate before declaring "done" — no view is "shipped" while it's still scaffold-quality.
- **Two-backend coordination.** Any Mac-side change that needs both backends working in lockstep needs care. Mitigation: Mac client treats them as independent services with clear adapter boundaries.
- **API drift during Track 1.** Web polish must not change the API surface, because the SwiftUI app will depend on it. Mitigation: explicit out-of-scope rule in Spec 1.
- **Re-litigating decisions across specs.** When Spec 2 is written, the temptation will be to revisit 2/3/5 decisions. Mitigation: this doc is the single source of truth for the seven binding choices; Spec 2 may *refine* but not *contradict* them without a new brainstorming pass.

---

## Done bar — full vision

SwiftUI Lexi-Mac is the daily driver. The web dashboard hasn't been opened in 30 days. Every native moment from the list of 10 works. RevOps surfaces live in Lexi-Mac, not pipelinepulse-iOS. iOS pipelinepulse is open only when you want to glance at a Live Activity.

---

## Pointers

- Sequential specs are written into `docs/superpowers/specs/` with the date prefix.
- Plans for each spec live alongside it: `docs/superpowers/plans/<spec-slug>-plan.md`.
- This vision doc updates only when a new track ships and the next track's spec is written, or when a binding decision is explicitly revisited.
