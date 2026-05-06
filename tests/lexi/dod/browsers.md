# Lexi Dashboard — Browser Matrix Smoke Test

Run this manual checklist before declaring DoD 8 complete. Take a screenshot at each ✅
and store under `docs/lexi/screenshots/dod-browsers/<browser>/<step>.png`.

**Prereqs:** `LEXI_PORT=3030 node dist/cli/index.js lexi dashboard` running locally.

## Matrix

| Browser | Min version | Tested? |
|---|---|---|
| Chrome | 120+ | [ ] |
| Safari | 17+ | [ ] |
| Firefox | 121+ | [ ] |

## Per-browser checklist (repeat for each)

1. [ ] Open `http://localhost:3030/` — page renders without console errors (DevTools → Console clean).
2. [ ] Default theme matches `prefers-color-scheme` (toggle OS theme, reload, verify).
3. [ ] Click theme toggle in top bar — verify:
   - Chrome / Safari 18+: View Transitions cross-fade visible.
   - Firefox / Safari 17: graceful fallback (token tween only, no error).
4. [ ] Spotlight wipe originates from toggle button location (Chrome only).
5. [ ] Toggle theme 5× rapidly — no stuck overlay, no console error.
6. [ ] Set OS to "reduce motion" → toggle theme — instant swap, no spotlight overlay remains in DOM.
7. [ ] Reload page — theme persists from localStorage (`lexi-theme`).
8. [ ] Press ⌘K (Mac) / Ctrl+K (Windows/Linux) — palette opens.
9. [ ] Press Escape — palette closes.
10. [ ] Navigate to each section via nav rail — each renders without console error.

## Sign-off

Mark this DoD item PASS when all three browsers complete every step. Record:

- Date tested:
- Tester:
- OS / version:
- Notes / deviations:

After successful sign-off, add this comment at the bottom of this file (the DoD orchestrator looks for it):

```
<!-- DOD-8-SIGNED: YYYY-MM-DD -->
```
