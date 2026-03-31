# Food System Rebuild — Working Document

**Started:** 2026-03-12 10:00AM GMT+1
**Status:** Phase 2.5 complete. Phase 3 next.
**ADR:** [ADR-0002](../adrs/0002-food-registry-and-canonicalization.md)
**Assessment:** [food-system-legacy-assessment.md](./food-system-legacy-assessment.md)

This document tracks which files belong to the new food canonicalization and
zone system, which are legacy, and which are shared utilities. Its purpose is
to ensure the rebuild can be safely rolled back or completed within a working
day if something breaks.

---

## File manifest

### ✅ New system — stable and complete

| File                                                   | Description                                                                                                                                                                                                                                                                                               | Tests       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `src/lib/foodRegistry.ts`                              | Single source of truth. ~101 canonical foods across Zones 1A, 1B, 2, 3. Each entry has `group` (FoodGroup), `line` (FoodLine), and `lineOrder`. Exports typed entries, group/line helpers, and `CANONICAL_FOOD_NAMES` set. **Phase 2.5: `TransitLine` replaced with `FoodGroup` + `FoodLine` hierarchy.** | —           |
| `src/lib/foodCanonicalization.ts`                      | Deterministic canonicalization derived from the registry. Returns `string \| null`. Re-exports all registry types and helpers.                                                                                                                                                                            | ✅ 25 tests |
| `src/lib/foodLlmCanonicalization.ts`                   | LLM canonicalization using registry vocabulary. Builds system prompt from `FOOD_REGISTRY`. `postProcessCanonical` resolves LLM output against registry.                                                                                                                                                   | —           |
| ~~`src/lib/foodCategoryMapping.ts`~~                   | **Deleted in Phase 2.5.** Was a legacy bridge mapping registry types to old `LineCategory`. Redundant now that `group`/`line` are on every entry.                                                                                                                                                         | —           |
| `src/lib/__tests__/foodCanonicalization.test.ts`       | Test suite covering all zones, quantity stripping, collapsed canonicals, and null returns for unknowns.                                                                                                                                                                                                   | ✅          |
| `docs/research/food-zone-phase.md`                     | Clinical research basis for zone assignments (NHS, UCSF, Leeds, Bowel Cancer Australia).                                                                                                                                                                                                                  | —           |
| `docs/adrs/0002-food-registry-and-canonicalization.md` | ADR. Rationale, decision record, consequences.                                                                                                                                                                                                                                                            | —           |
| `docs/plans/food-system-legacy-assessment.md`          | Deep assessment of all legacy files. Problems, what to keep, what to remove.                                                                                                                                                                                                                              | —           |
| `docs/plans/transit-map-and-reward-model.md`           | Transit map design: station colours, reward model, per-line progression, zone geography.                                                                                                                                                                                                                  | —           |

### ✅ Migrated — Phase 2 complete

| File                                 | What changed                                                                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/foodParsing.ts`             | SYSTEM_PROMPT replaced with `buildFoodParseSystemPrompt()` from registry. `correctZoneAssignment`/`correctItemZones` removed. `postProcessCanonical` wired into normalize functions. 312 lines (was 427).                   |
| `src/lib/foodStatusThresholds.ts`    | `DEFAULT_FOOD_ZONES`, `defaultZoneForFood`, `DEFAULT_FOOD_CATEGORIES`, `CATEGORY_KEYWORD_RULES`, `defaultCategoryForFood`, `LineCategory` removed. 160 lines (was 506). All threshold constants and Bristol math preserved. |
| `src/pages/secondary_pages/Menu.tsx` | Replaced `defaultZoneForFood`/`defaultCategoryForFood` with `getFoodZone`/`FoodGroup`/`FoodLine` from registry. (`lineCategoryForFood` removed in Phase 2.5.)                                                               |
| `src/pages/Patterns.tsx`             | Same replacement as Menu.tsx.                                                                                                                                                                                               |

### 🔧 Shared utilities — kept, not changed

| File                       | Description                                                                                                    | Why kept                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/lib/foodNormalize.ts` | String normalization: lowercase, trim, singularize, strip quantity prefixes and filler words, synonym mapping. | New canonicalization calls `normalizeFoodName` directly. Well-written, no domain logic. |

### ⚠️ Legacy — assessed, migration planned

Deep assessment: [food-system-legacy-assessment.md](./food-system-legacy-assessment.md)
Do **not** delete these — the app depends on them at runtime.

| File                                     | Keep                                                   | Remove / Replace                                                                                         | Phase |
| ---------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----- |
| `src/lib/foodEvidence.ts`                | All Bayesian math, all type defs, `toLegacyFoodStatus` | Canonical resolution in `buildFoodTrials` + `normalizeAssessmentRecord` — replace with registry lookup   | 3     |
| `src/lib/analysis.ts`                    | Most of the file                                       | `BRAT_BASELINES` keys (wrong canonicals — `"plain white toast"` and `"applesauce"` don't match registry) | 3     |
| `convex/foodLibrary.ts`                  | Merge mapping system, DB queries                       | `normalizeCanonicalName` (replace with `normalizeFoodName`), cross-boundary import from `src/lib`        | 4     |
| `convex/data/ingredientTemplatesSeed.ts` | Progression prerequisites structure                    | All canonical names and stage assignments — derive from registry                                         | 4     |

### 🔲 Not yet started — new files to build

| File                                        | Purpose                                                                                                                                              | Phase |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `convex/data/ingredientTemplatesSeed.v2.ts` | Registry-derived seed. Replaces hand-authored 1–10 stage seed. Aligns all station canonical names with the registry. Requires Convex data migration. | 4     |

---

## Breaking change log

| Change                                                                   | Impact                                                                             | Affected callers                                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `canonicalizeKnownFoodName` returns `string \| null` instead of `string` | Callers that relied on fallback-to-input now receive `null` for unrecognised foods | `foodParsing.ts` now uses `postProcessCanonical` which handles null correctly |
| `defaultZoneForFood` removed from `foodStatusThresholds.ts`              | Callers must use `getFoodZone` from registry instead                               | `foodParsing.ts`, `Menu.tsx`, `Patterns.tsx` — all updated                    |
| `defaultCategoryForFood` removed from `foodStatusThresholds.ts`          | Callers must use `getFoodEntry(canonical)?.category` or `group`/`line` fields      | `Menu.tsx`, `Patterns.tsx` — all updated                                      |
| `LineCategory` type removed (Phase 2 → `domain.ts`, Phase 2.5 → deleted) | Was in `domain.ts` with mapping via `foodCategoryMapping.ts` — both deleted in 2.5 | All callers switched to `FoodGroup`/`FoodLine`                                |
| `TransitLine` type replaced with `FoodGroup` + `FoodLine` (Phase 2.5)    | All callers using `TransitLine` must switch to `FoodGroup`/`FoodLine`              | Registry, canonicalization, LLM prompt, Menu.tsx, Patterns.tsx                |
| `foodCategoryMapping.ts` deleted (Phase 2.5)                             | Callers must use `group`/`line` fields directly from registry entries              | Menu.tsx, Patterns.tsx                                                        |
| `LineCategory` and legacy transit types deleted from `domain.ts` (2.5)   | No backwards compatibility — legacy types served a broken engine                   | Any remaining consumers must switch to `FoodGroup`/`FoodLine`                 |

---

## Migration phases

### Phase 1 — Complete ✅

- `foodRegistry.ts` created
- `foodCanonicalization.ts` replaced
- Tests rewritten, 25 passing
- ADR and assessment docs written

### Phase 2 — Complete ✅

Affects only new food entries going forward. Does not touch stored data.

1. ✅ `line` (TransitLine) and `lineOrder` added to all 101 registry entries
2. ✅ `foodLlmCanonicalization.ts` built — LLM path using registry vocabulary
3. ✅ `foodCategoryMapping.ts` built — maps registry categories to UI LineCategory _(deleted in Phase 2.5 — redundant)_
4. ✅ `DEFAULT_FOOD_ZONES`, `defaultZoneForFood`, `DEFAULT_FOOD_CATEGORIES`, `defaultCategoryForFood` stripped from `foodStatusThresholds.ts`
5. ✅ `foodParsing.ts` SYSTEM_PROMPT replaced with registry-derived prompt
6. ✅ `correctZoneAssignment` and `correctItemZones` removed from `foodParsing.ts`
7. ✅ `postProcessCanonical` wired into `normalizeComponent`/`normalizeItem` in `foodParsing.ts`
8. ✅ `Menu.tsx` and `Patterns.tsx` updated to use registry functions
9. ✅ 25/25 tests pass, typecheck clean, 0 new failures

### Phase 2.5 — Hierarchy revision — Complete ✅

Replaced the flat `TransitLine` model with a two-level `FoodGroup` + `FoodLine` hierarchy.
No backwards compatibility with legacy types — the broken engine produced nothing worth keeping.

1. ✅ Define `FoodGroup` and `FoodLine` types in `foodRegistry.ts`
2. ✅ Add `group: FoodGroup` to every registry entry
3. ✅ Replace `line: TransitLine` with `line: FoodLine` on every registry entry
4. ✅ Update `lineOrder` to position within the new sub-line
5. ✅ Reassign foods per confirmed hierarchy (dairy split, garlic → herbs_spices, onion → vegetables, etc.)
6. ✅ Remove hub/liquid entries from transit map (tracked, not mapped)
7. ✅ Update helper functions: add `getFoodGroup`, `getLinesByGroup`, `getGroupDisplayName`
8. ✅ Delete `foodCategoryMapping.ts` (redundant)
9. ✅ Delete `LineCategory` and legacy transit types from `domain.ts`
10. ✅ Update `Menu.tsx` and `Patterns.tsx` consumers
11. ✅ Update `foodLlmCanonicalization.ts` prompt builder
12. ✅ Update tests

#### Deleted in Phase 2.5

| File                                            | Reason                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `src/lib/foodCategoryMapping.ts`                | Redundant — `group`/`line` on every entry replaces the mapping layer       |
| `src/lib/transitMapLayout.ts`                   | Legacy transit map layout — will be rebuilt in Phase 5 on new hierarchy    |
| `src/lib/pointsEngine.ts`                       | Legacy points engine — tied to broken flat model                           |
| `src/components/transit/StationDetailPanel.tsx` | Legacy transit UI component — will be rebuilt in Phase 5                   |
| `src/components/transit/TransitMap.tsx`         | Legacy transit map component — will be rebuilt in Phase 5 on new hierarchy |
| `src/components/transit/TransitMapTest.tsx`     | Legacy transit map test page — will be rebuilt in Phase 5                  |

### Phase 3 — Evidence pipeline (next after 2.5, medium risk)

Affects how trial data groups. Existing stored trials will re-group under new canonicals.

1. Update `buildFoodTrials` in `foodEvidence.ts` to use registry canonicalization
2. Update `normalizeAssessmentRecord` in `foodEvidence.ts`
3. Fix `BRAT_BASELINES` in `analysis.ts` — replace `"plain white toast"` → `"toast"`, `"applesauce"` → `"stewed apple"`
4. Verify end-to-end canonical key alignment

### Phase 4 — Convex layer (higher risk, data migration)

Requires Convex migration script. Not safe to do in a single day.

1. Replace `normalizeCanonicalName` in `convex/foodLibrary.ts`
2. Resolve cross-boundary import
3. Align `ingredientTemplatesSeed.ts` canonical names with registry
4. Write migration to re-canonicalize existing food library entries

---

## Safety notes

- Phases 1–2.5 are done. No stored data was touched. Legacy transit map files deleted.
- Phase 3 changes how trials group — existing history will re-group, which is the intended behaviour.
- Phase 4 requires a Convex migration. Do not start unless you have a full day and a tested rollback plan.
- `foodNormalize.ts` is unchanged throughout — all existing callers are safe.

---

## What "done" looks like

The food system rebuild is complete when:

1. ✅ `foodParsing.ts` uses `foodLlmCanonicalization.ts` and the registry for all canonical and zone assignment.
2. ✅ `foodStatusThresholds.ts` contains only threshold constants and Bristol math.
3. `foodEvidence.ts` uses registry canonicals as grouping keys.
4. `analysis.ts` `BRAT_BASELINES` uses correct registry canonicals.
5. `convex/foodLibrary.ts` uses `normalizeFoodName` and has no cross-boundary import.
6. `ingredientTemplatesSeed` canonical names match the registry.
7. All existing tests pass. New tests cover the LLM canonicalization path.
8. This document is updated to reflect completed status.

---

## Verification Audit (2026-03-12)

Audited every claim in this document against the actual codebase.

### File existence

| Claimed file                                           | Status                                        |
| ------------------------------------------------------ | --------------------------------------------- |
| `src/lib/foodRegistry.ts`                              | EXISTS (2431 lines)                           |
| `src/lib/foodCanonicalization.ts`                      | EXISTS (154 lines)                            |
| `src/lib/foodLlmCanonicalization.ts`                   | EXISTS (218 lines)                            |
| `src/lib/foodCategoryMapping.ts`                       | CONFIRMED DELETED                             |
| `src/lib/__tests__/foodCanonicalization.test.ts`       | EXISTS                                        |
| `docs/research/food-zone-phase.md`                     | EXISTS                                        |
| `docs/adrs/0002-food-registry-and-canonicalization.md` | EXISTS                                        |
| `docs/plans/food-system-legacy-assessment.md`          | EXISTS                                        |
| `docs/plans/transit-map-and-reward-model.md`           | EXISTS                                        |
| `src/lib/foodParsing.ts`                               | EXISTS (311 lines)                            |
| `src/lib/foodStatusThresholds.ts`                      | EXISTS (159 lines)                            |
| `src/pages/secondary_pages/Menu.tsx`                   | EXISTS                                        |
| `src/pages/Patterns.tsx`                               | EXISTS                                        |
| `src/lib/foodNormalize.ts`                             | EXISTS (194 lines)                            |
| `src/lib/foodEvidence.ts`                              | EXISTS (705 lines)                            |
| `src/lib/analysis.ts`                                  | EXISTS (885 lines)                            |
| `convex/foodLibrary.ts`                                | EXISTS (735 lines)                            |
| `convex/data/ingredientTemplatesSeed.ts`               | EXISTS (1615 lines)                           |
| `src/lib/transitMapLayout.ts`                          | CONFIRMED DELETED                             |
| `src/lib/pointsEngine.ts`                              | CONFIRMED DELETED                             |
| `src/components/transit/*`                             | CONFIRMED DELETED (entire directory gone)     |
| `convex/data/ingredientTemplatesSeed.v2.ts`            | DOES NOT EXIST (not yet created, as expected) |

### Files not mentioned in doc but part of food system

| File                                     | Description                                                           |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `src/lib/__tests__/foodParsing.test.ts`  | Food parsing test suite — not mentioned                               |
| `src/lib/__tests__/foodEvidence.test.ts` | Food evidence test suite — not mentioned                              |
| `convex/foodLibrary.test.ts`             | Convex food library test suite — not mentioned                        |
| `convex/foodAssessments.ts`              | Convex food assessments mutations/queries (138 lines) — not mentioned |
| `convex/foodAssessments.test.ts`         | Convex food assessments test suite — not mentioned                    |

### Factual corrections

| Claim                                 | Actual                                | Severity                  |
| ------------------------------------- | ------------------------------------- | ------------------------- |
| "~101 canonical foods"                | 95 canonical entries in FOOD_REGISTRY | Minor — count is wrong    |
| "25 tests" (test suite)               | 30 tests passing, 119 expect() calls  | Minor — count is outdated |
| "312 lines" (foodParsing.ts)          | 311 lines                             | Trivial                   |
| "160 lines" (foodStatusThresholds.ts) | 159 lines                             | Trivial                   |

### Stale comment found

`foodStatusThresholds.ts` lines 157-159 contain a stale comment referencing `foodCategoryMapping.ts` and `LineCategory` in `domain.ts`. Both were deleted in Phase 2.5. The comment says:

> "The LineCategory type is defined in src/types/domain.ts. A mapping function from the registry's FoodCategory/FoodSubcategory to LineCategory is provided by foodCategoryMapping.ts."

Neither `LineCategory` in `domain.ts` nor `foodCategoryMapping.ts` exists. This comment should be removed or corrected.

### Phase 2/2.5 verification

All Phase 2 and 2.5 claims verified:

- `correctZoneAssignment` / `correctItemZones`: confirmed absent from `foodParsing.ts`
- `buildFoodParseSystemPrompt` / `postProcessCanonical`: confirmed wired into `foodParsing.ts`
- `TransitLine` type: confirmed absent from entire `src/` tree
- `LineCategory` type: confirmed absent from `domain.ts`, only appears in stale comment in `foodStatusThresholds.ts`
- `getFoodGroup` / `getFoodZone`: confirmed used in `Menu.tsx` and `Patterns.tsx`
- `FoodGroup` / `FoodLine` types: confirmed defined in `foodRegistry.ts`, exported via `foodCanonicalization.ts`

### Phase 3 verification (not yet started)

- `buildFoodTrials` exists in `foodEvidence.ts` (line 186) — still uses raw log canonical names, not registry canonicalization
- `normalizeAssessmentRecord` exists in `foodEvidence.ts` (line 682) — still uses raw food string, not registry lookup
- `BRAT_BASELINES` in `analysis.ts` still uses `"plain white toast"` and `"applesauce"` (lines 168-173)
- `toLegacyFoodStatus` exists in `foodEvidence.ts` (line 490) — still needed

### Phase 4 verification (not yet started)

- `normalizeCanonicalName` still exists as a local function in `convex/foodLibrary.ts` (line 17)
- Cross-boundary import confirmed: `convex/foodLibrary.ts` imports from `"../src/lib/foodEvidence"` (line 10)
- `ingredientTemplatesSeed.ts` still has hand-authored canonical names (1615 lines)

### Conclusion

Document is broadly accurate. Main issues: entry count wrong (95 not 101), test count outdated (30 not 25), stale comment in foodStatusThresholds.ts, and five food-system files not mentioned (test suites + foodAssessments.ts). All phase completion claims verified correct. Archiving this document and replacing with current-state-only version.
