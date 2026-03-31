---
name: food-system-rebuild-progress
description: Tracks the food registry and canonicalization system rebuild — Phases 1-4 done, Phase 5 planned (transit map UI + bug fixes)
type: project
---

## Food System Rebuild — Progress Tracker

**Phase 1 (DONE):** Registry created, canonicalization replaced, 25 tests passing, ADR + assessment docs written.

**Phase 2 (DONE — 2026-03-12):** LLM canonicalization, lineOrder, legacy cleanup. 25/25 tests, typecheck clean.

**Phase 2.5 (DONE — 2026-03-12):** Hierarchy revision: flat `TransitLine` → `FoodGroup` + `FoodLine` (95 entries, 4 groups, 11 lines).

**Phase 3 (DONE — 2026-03-12):** Evidence pipeline: registry canonicalization in `foodEvidence.ts`, avoid/watch split, ~630 lines dead code deleted from `analysis.ts`. 33/33 tests pass.

**Phase 4 (DONE — 2026-03-13):** Game layer deleted, `shared/` created, Convex normalization unified. 33/33 tests pass.

**Phase 5 (PLANNED — 2026-03-13):** Transit map UI rebuild + evidence pipeline bug fixes.

### Phase 5 scope

**Transit map UI:**

1. New data-driven component (3 zoom levels: corridor cards → corridor detail → line detail)
2. `useTransitMapData()` hook (registry + evidence → map data)
3. "Next stop" logic using `lineOrder`
4. Station Inspector with transit-themed language
5. Pan/zoom via `react-zoom-pan-pinch`
6. Side-by-side toggle with existing map

**Bug fixes (prerequisite):** 7. Bristol 5 "loose" fix — DONE (evidence pipeline + inline edit) 8. Food name qty stripping — DONE (useFoodParsing) 9. Ghost entries from AI assessments — NOT YET FIXED 10. Transit window: 6h minimum not enforced, 18h cap too narrow 11. Bristol language audit — "firm" should never appear in UI 12. LLM forced canonicalization with confidence levels

**Why:** The existing transit map (1,311 lines) is completely disconnected from the data pipeline. Zero cross-linking between food surfaces. `lineOrder` unused. The map should be the connective tissue of the app.

**How to apply:** Read `docs/scratchpadprompts/transitmap.md` (Phase 5 Planning Session section) for full design decisions and context.

**Key files (Phase 4 onward):**

- Registry: `shared/foodRegistry.ts` (95 foods, 4 groups, 11 lines)
- Canonicalization: `shared/foodCanonicalization.ts`
- Evidence: `shared/foodEvidence.ts`
- Types: `shared/foodTypes.ts`
- Tests: `shared/__tests__/` (33 tests)
- Existing transit map: `src/components/patterns/transit-map/TransitMap.tsx` (keep for comparison)
- Existing transit data: `src/data/transitData.ts` (hardcoded, disconnected)
- Scratchpad: `docs/scratchpadprompts/transitmap.md`
- Rebuild plan: `docs/plans/food-system-rebuild.md`
- Transit map design: `docs/plans/transit-map-and-reward-model.md`
