> **Ref:** `docs/WIP.md`
> **Updated:** 2026-04-06
> **Version:** 3.1
> **History:**
>
> - v3.1 (2026-04-06) — Nutrition Card W4-5 collapsed to summary, initiative complete
> - v3.0 (2026-04-05) — newest-first, timestamped, managed by project-ops + vite-react-implementer skills
> - v2.0 (2026-04-05) — trimmed completed work to summaries
> - v1.0 (2026-04-05) — standardized doc header

# Work In Progress — Execution Log

> Newest first. Timestamped. Prepend, never append.
> Implementer agents write per-task entries automatically (see `vite-react-implementer` skill).
> The `project-ops` skill manages initiative-level summaries and cleanup.
>
> **Flow:** ROADMAP -> WORK-QUEUE (plan attached) -> **WIP (you are here)** -> Archive

---

<!-- Implementer agents: prepend new entries HERE, above the completed summaries -->

### W0-10 — Add input length cap to matchUnresolvedItems (2026-04-06 16:01)

- **Commit:** `632727b`
- **Files:** `convex/foodLlmMatching.ts`
- **What:** Added a 50-item array cap (console.warn if exceeded, truncate to first 50) and a 200-char per-segment string cap to the `matchUnresolvedItems` handler, applied before any LLM or fuzzy processing. Updated the fuzzy pre-match loop to iterate over the capped `segments` variable rather than `args.unresolvedSegments`.
- **Decisions:** Truncation rather than rejection — a bugged client should still get partial results rather than a hard error; the warn surfaces the problem in server logs without degrading the user experience.

### W1-17 — Remove dead FILTER_OPTIONS/SortKey/SortDir exports (2026-04-06 16:00)

- **Commit:** `27e89a6`
- **Files:** `src/components/patterns/database/foodSafetyUtils.ts`, `src/components/patterns/database/index.ts`
- **What:** Verified zero import sites for FILTER_OPTIONS, SortKey, SortDir across entire codebase, then deleted them from foodSafetyUtils.ts and the barrel index.ts. Biome lint:fix also caught BRAT_KEYS (alias for BRAT_FOOD_KEYS with zero consumers) and FilterStatus as additionally unused — removed those too.
- **Decisions:** BRAT_KEYS removal was an unplanned side-effect — Biome detected it as an unused export after FILTER_OPTIONS was removed. It is safe: BRAT_FOOD_KEYS remains available directly from shared/foodProjection.ts.

### W0-17 — Add error handling to SubRow inline delete calls (2026-04-06 16:00)

- **Commit:** `beeed5f`
- **Files:** `src/components/track/today-log/editors/FoodSubRow.tsx`
- **What:** Wrapped the `FoodProcessingView` delete onClick in try/catch, surfacing failures via `toast.error(getErrorMessage(...))` to match the existing pattern in `EditableEntryRow`.
- **Decisions:** Added `toast` (sonner) and `getErrorMessage` (@/lib/errors) imports — both already used in the adjacent file.

---

## Completed Initiatives

### Nutrition Card (Meal Logging Redesign) — COMPLETE (2026-04-06)

Full meal logging redesign across 6 waves. Chip-based, slot-aware meal builder with search, staging, portions, 5-macro tracking, water modal, meal slot auto-detection, dark mode, accessibility, and edge case handling. Merged via PR #3.

Key commits: `a8f21d0` (schema), `38267d5` (portions), `f471c58` (goals/favs), `2bd26e5`-`034636f` (store+UI), `2c91729` (E2E), `714d586`-`809771c` (spec fix), `db1b2d4`-`66b74fe` (W4 drinks+TodayLog), `78c56fe`-`122ea23` (W5 polish).

69 commits, 1430 tests, 211 files changed (+24,199 / -1,958).
Decisions: `memory/project_nutrition_card_decisions.md` + `memory/project_wave0_decisions.md`.

### Adams Rib Branch — COMPLETE (2026-04-01)

Dead code cleanup, 4 AI fields stripped, ParsedItem removed, gpt-5.2 sunset, Tailwind v4 modernisation. All 4 ingredient subsystems kept.
