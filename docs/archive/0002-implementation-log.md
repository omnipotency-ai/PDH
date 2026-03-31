# ADR-0002 Implementation Log (Archived)

Extracted from `docs/adrs/0002-food-registry-and-canonicalization.md` on 2026-03-17. The core ADR decision remains in the original file; this archive preserves the phase-by-phase implementation history.

---

## Files changed

### Phase 1 (registry + deterministic canonicalization)

| File                                            | Status       | Notes                                                                                                     |
| ----------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| `shared/foodRegistry.ts`                        | **Created**  | Single source of truth. Historical note: registry has since expanded far beyond the original 100 entries. |
| `shared/foodCanonicalization.ts`                | **Replaced** | Derives from registry. Returns `string \| null`.                                                          |
| `shared/__tests__/foodCanonicalization.test.ts` | **Replaced** | Canonicalization regression suite aligned to collapsed canonicals.                                        |
| `shared/foodNormalize.ts`                       | **Kept**     | Shared utility. Used by new system as dependency.                                                         |
| `docs/research/food-zone-phase.md`              | **Created**  | Clinical research basis for zone assignments.                                                             |

### Phase 2 (LLM canonicalization + legacy cleanup)

| File                                 | Status                                | Notes                                                                                                             |
| ------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/lib/foodLlmCanonicalization.ts` | **Created**                           | Builds LLM prompt from registry. `postProcessCanonical` resolves LLM output.                                      |
| `src/lib/foodCategoryMapping.ts`     | **Created then deleted in Phase 2.5** | Mapped `FoodCategory`/`FoodSubcategory` → UI `LineCategory`. Redundant after `group`/`line` added to every entry. |
| `src/lib/foodParsing.ts`             | **Updated**                           | Registry-aware prompt. Legacy zone correction removed.                                                            |
| `src/lib/foodStatusThresholds.ts`    | **Updated**                           | Legacy zone/category lookups removed (~350 lines). Thresholds + math kept.                                        |
| `src/pages/secondary_pages/Menu.tsx` | **Updated**                           | Uses `getFoodZone`/`FoodGroup`/`FoodLine` from registry. (`lineCategoryForFood` removed in Phase 2.5.)            |
| `src/pages/Patterns.tsx`             | **Updated**                           | Same as Menu.tsx.                                                                                                 |

### Phase 2.5 (hierarchy revision)

| File                                            | Status      | Notes                                                                              |
| ----------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `shared/foodRegistry.ts`                        | **Updated** | `TransitLine` → `FoodGroup` + `FoodLine`. All entries get `group` + revised `line` |
| `src/lib/foodCategoryMapping.ts`                | **Deleted** | Redundant — `group`/`line` on every entry replaces the mapping layer               |
| `shared/foodCanonicalization.ts`                | **Updated** | Re-exports new types, updated helpers                                              |
| `src/types/domain.ts`                           | **Updated** | Legacy `LineCategory` and related transit types removed                            |
| `src/pages/secondary_pages/Menu.tsx`            | **Updated** | Uses `FoodGroup`/`FoodLine` from registry                                          |
| `src/pages/Patterns.tsx`                        | **Updated** | Same as Menu.tsx                                                                   |
| `src/lib/transitMapLayout.ts`                   | **Deleted** | Legacy transit map layout — will be rebuilt in Phase 5 on new hierarchy            |
| `src/lib/pointsEngine.ts`                       | **Deleted** | Legacy points engine — tied to broken flat model                                   |
| `src/components/transit/StationDetailPanel.tsx` | **Deleted** | Legacy transit UI component — will be rebuilt in Phase 5                           |
| `src/components/transit/TransitMap.tsx`         | **Deleted** | Legacy transit map component — will be rebuilt in Phase 5                          |
| `src/components/transit/TransitMapTest.tsx`     | **Deleted** | Legacy transit map test page — will be rebuilt in Phase 5                          |
| `src/hooks/useFoodParsing.ts`                   | **Fixed**   | Preserve original food name in logs (was overwriting with canonical)               |

## Research basis

Primary sources used for zone assignment decisions:

- NHS Trust low-residue and ileostomy diet leaflets (Leeds, UCSF, Torbay,
  Bowel Cancer Australia)
- _Pmc.ncbi.nlm.nih.gov_ review on ileostomy dietary management (2025)
- Academy of Nutrition and Dietetics low-fibre handout (UPenn)
- FOWUSA (Friends of Ostomy) diet and nutrition guide
- Full citations in `docs/research/food-zone-phase.md`

## Verification Audit (2026-03-12)

Audited ADR against the live codebase on `feature/v1-sprint`.

### Fixes applied in this audit

1. **Interface field order corrected.** The `FoodRegistryEntry` interface in the ADR now matches the actual field order in `shared/foodRegistry.ts`: `canonical`, `zone`, `subzone`, `category`, `subcategory`, `macros`, digestion metadata fields, `examples`, `group`, `line`, `lineOrder`, `notes`. Previously the ADR placed `group`/`line` before `category`/`subcategory` and `examples`, and did not yet list the digestion metadata.
2. **Type aliases corrected.** `zone` field type changed from inline `1 | 2 | 3` to `FoodZone`; `subzone` from inline `"1A" | "1B"` to `FoodSubzone`. Both are exported type aliases in the actual code.
3. **Example mappings corrected.** "boiled chicken" maps to `"boiled white meat"` (not `"plain chicken"`). "grilled chicken" maps to `"grilled white meat"` (not `"grilled chicken"`). The canonical `"plain chicken"` does not exist in the registry.
4. **Entry count corrected.** Registry contains 100 entries, not 101.
5. **Test count corrected.** `foodCanonicalization.test.ts` contains 30 tests, not 25.

### Verified accurate (no changes needed)

- `FoodGroup` and `FoodLine` types match the code exactly.
- All Phase 2.5 deleted files confirmed absent: `transitMapLayout.ts`, `pointsEngine.ts`, `StationDetailPanel.tsx`, `TransitMap.tsx`, `TransitMapTest.tsx`, `foodCategoryMapping.ts`.
- `LineCategory` confirmed removed from `src/types/domain.ts`.
- `foodCanonicalization.ts` re-exports `FoodGroup`, `FoodLine`, and all registry helpers as described.
- `foodLlmCanonicalization.ts` builds vocabulary from registry with `group` and `line` columns; `postProcessCanonical` resolves against registry as described.
- `canonicalizeKnownFoodName` returns `string | null` as documented.
- `CANONICAL_FOOD_NAMES: ReadonlySet<string>` exists as described.
- Duplicate normalized aliases are rejected at load/test time; collisions are treated as registry errors rather than runtime tie-breaks.
- `Menu.tsx` and `Patterns.tsx` both import from the registry via `foodCanonicalization.ts`.
- `useFoodParsing.ts` preserves original food name in logs.
- `docs/research/food-zone-phase.md` exists.
- `foodNormalize.ts` exists and is used as a dependency.
- Zone model description matches code comments in the registry header.
- 4 groups / 11 sub-lines hierarchy confirmed in the type definitions and registry data.

### Codebase note (not an ADR issue)

`src/lib/foodStatusThresholds.ts` (lines 151-159) had a stale comment referencing
`foodCategoryMapping.ts` and `LineCategory`. Fixed in the 2026-03-12 code review.

### Phase 3: Evidence pipeline canonicalization (complete, 2026-03-12)

Phase 3 wired the registry into the Bayesian evidence pipeline.

**What was done:**

1. `foodEvidence.ts:buildFoodTrials()` and `normalizeAssessmentRecord()` — registry
   lookup via `canonicalizeKnownFoodName` with `normalizeFoodName` fallback for unknown foods
2. `analysis.ts` BRAT baseline: `"plain white toast"` → `"toast"`
3. `foodEvidence.ts:primaryStatusFromSignals` — split avoid/watch: `severeLowConfounderCount >= 2`
   → `"avoid"`, `effectiveEvidence >= 3.0` alone → `"watch"`
4. Dead correlation code deleted from `analysis.ts`: `resolveAllCorrelations`, `buildCorrelations`,
   `outcomeFromTransitAndCategory`, `ResolvedTrial`, `CorrelationRow`, transit time constants,
   `correlations` field from `AnalysisResult`

| File                                     | Change                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/lib/foodEvidence.ts`                | Registry lookup + fallback in `buildFoodTrials` and `normalizeAssessmentRecord`. Avoid/watch split. |
| `src/lib/analysis.ts`                    | BRAT baseline fix. Dead correlation code deleted (~150 lines). `correlations` removed.              |
| `src/lib/__tests__/foodEvidence.test.ts` | Updated "rice" → "white rice" (registry canonical). "Avoid" test now passes.                        |

### Phase 4: Convex layer migration (complete, 2026-03-13)

Phase 4 deleted the broken game layer, moved shared code to `shared/`, and unified Convex normalization.

**Decision:** Delete game layer entirely rather than migrate. The game layer was built on the
old 6-line/10-stage taxonomy with wrong canonical names. Phase 5 will rebuild from scratch.

**What was done:**

1. Deleted game layer tables (`stationDefinitions`, `ingredientTemplates`, `trialSessions`,
   `gameState`) and all supporting code (6 Convex modules, seed data, `trialEngine.ts`,
   16 game layer hooks, 6 game layer types, `legacyStageToZone`, `lineCategoryValidator`,
   `TrialResultToast`, `MindTheGapBar`)
2. Moved shared food system code to `shared/` directory at repo root:
   `foodRegistry.ts`, `foodCanonicalization.ts`, `foodNormalize.ts`, `foodEvidence.ts`,
   `foodTypes.ts`. Added `@shared/*` path alias. Convex imports via `../shared/`.
3. Replaced divergent `normalizeCanonicalName()` in `foodLibrary.ts`, `ingredientOverrides.ts`,
   `ingredientExposures.ts`, `ingredientProfiles.ts`, and `extractInsightData.ts` with
   `canonicalizeKnownFoodName()` + `normalizeFoodName()` fallback
4. Cleaned `mergeDuplicates` (removed dead `stationDefinitions` references)
5. Updated `Patterns.tsx`: `getFoodZone()` from registry replaces `legacyStageToZone(station.stage)`

**Tables kept:** `ingredientOverrides`, `ingredientExposures`, `ingredientProfiles`.
Raw logs never touched. No data migration.

| File                             | Change                                               |
| -------------------------------- | ---------------------------------------------------- |
| `shared/foodRegistry.ts`         | Moved from `src/lib/` (no code changes)              |
| `shared/foodCanonicalization.ts` | Moved from `src/lib/` (no code changes)              |
| `shared/foodNormalize.ts`        | Moved from `src/lib/` (no code changes)              |
| `shared/foodEvidence.ts`         | Moved from `src/lib/` (no code changes)              |
| `shared/foodTypes.ts`            | New — extracted shared type definitions              |
| `convex/foodLibrary.ts`          | Registry canonicalization, dead station refs removed |
| `convex/ingredientOverrides.ts`  | Registry canonicalization                            |
| `convex/ingredientExposures.ts`  | Registry canonicalization                            |
| `convex/ingredientProfiles.ts`   | Registry canonicalization                            |
| `convex/extractInsightData.ts`   | Registry canonicalization added                      |

Plan: `docs/plans/2026-03-13-phase-4-convex-migration.md` (archived)

## Audit Addendum (2026-03-13)

This addendum records the post-Phase-4 parser and evidence audit.

### Re-verified in code

1. Food parsing is now deterministic-first in runtime code, not AI-first.
2. GPT-5 mini is only called for unresolved fragments, not for every food log.
3. Duplicate normalized aliases are no longer tolerated in the registry.
4. Client food evidence uses full synced logs, not a truncated slice.
5. Automatic client-side transit calibration learning/persistence is no longer
   the active overwrite path; the client reads profile calibration and server
   recomputation remains the canonical write path.
6. Displayed food history preserves raw user-entered phrasing via `rawName`
   instead of collapsing everything to canonicals.

### Files touched in the follow-up

- `shared/foodRegistry.ts` — ambiguous aliases removed so the registry remains injective after normalization
- `shared/foodCanonicalization.ts` — duplicate normalized aliases now throw at load/test time
- `src/lib/foodParsing.ts` — deterministic-first parsing, unresolved-fragment GPT fallback, normalized existing-name fast path
- `src/hooks/useFoodParsing.ts` — `rawName` preserved in enriched food logs
- `shared/foodEvidence.ts` — display names prefer `rawName` while evidence still groups by canonical
- `src/components/track/today-log/helpers.ts` — UI detail/history prefers `rawName`
- `src/components/track/today-log/editors/FoodSubRow.tsx` — editing refreshes `rawName` too
- `shared/__tests__/foodCanonicalization.test.ts` — alias uniqueness and corrected chili/rice-cake/herb expectations
- `src/lib/__tests__/foodParsing.behavior.test.ts` — deterministic-first parser behavior coverage
- `src/lib/__tests__/foodParsing.test.ts` — parser regressions and user-entered name expectations

### Architectural clarification

The food system should now be understood as:

- registry-first for known-food resolution
- deterministic-first for runtime parsing
- LLM-assisted only for unresolved or ambiguous input
- canonical-internal but raw-name-preserving at the user-facing log layer

## Server-Side Food Pipeline (completed 2026-03-14)

**Status:** Complete — All 11 tasks implemented on `feature/v1-sprint`.

The food system now has a server-side parsing pipeline that replaces client-side parsing:

**Architecture:**

- Raw text saved immutably as `rawInput` on food logs
- Server-side deterministic parsing via `convex/foodParsing.ts` using `shared/foodParsing.ts` utilities
- LLM binary matching (match to registry or NOT_ON_LIST) via `convex/foodLlmMatching.ts` with web search
- Manual user resolution via `FoodMatchingModal` component
- 6-hour evidence processing window — no partial meals in evidence engine

**Data model additions:**

- `resolvedBy`: `"registry" | "llm" | "user" | "expired"` — tracks how each food item was resolved
- `userSegment`, `parsedName` fields replace legacy `name`/`rawName` (backwards-compatible)
- `rawInput` on food log data — user's exact text, system-immutable

**Evidence filtering:**

- Items with `canonicalName: "unknown_food"` are excluded from `ingredientExposures`, `buildFoodTrials`, `computeAggregates`, and AI analysis prompts

**Key files:**

- `convex/foodParsing.ts` — Server mutations (processLog, processEvidence, resolveItem)
- `convex/foodLlmMatching.ts` — LLM action with web search
- `shared/foodParsing.ts` — Shared deterministic parsing utilities
- `src/components/track/FoodMatchingModal.tsx` — Manual matching UI

**See:** `docs/scratchpadprompts/transitmap.md` for full implementation log.

## Addendum (2026-03-16)

This ADR was re-verified after the food-registry follow-up and Dr. Poo alignment work.

### What changed since the 2026-03-13 / 2026-03-14 state

1. The registry now carries broader typed digestion metadata and additional canonicals used by the live system, including `plain biscuit`, `dark chocolate`, `high-sugar refined snack`, `refined confectionery`, `roast ham`, and `stewed apple`.
2. Stored-data recanonicalization and aggregate backfills have been used to migrate older logs and summaries onto the newer canonicals rather than leaving mixed historical names in place.
3. The evidence model now applies zone-aware negative weighting and zone-aware `safe` thresholds, while AI assessment influence still decays over time rather than remaining permanent.
4. Dr. Poo's visible food verdicts and backend structured verdicts are now treated as one contract: if the report tells the patient a food is safe, suspicious, or next-to-try, the backend is expected to receive the equivalent structured `foodAssessments` row too.
5. `convex/extractInsightData.ts` now contains a repair path for historical or partial reports, so canonicalizable visible labels that were omitted from `foodAssessments` can still be inserted without duplicating already-extracted rows.

### Current architectural understanding

The food system should now be understood as:

- registry-first for canonical food identity
- deterministic-first for routine parsing and matching
- LLM-assisted for unresolved or ambiguous food parsing
- prompt-constrained and extraction-repaired for Dr. Poo report food verdicts
- canonical-internal but raw-name-preserving where user-facing history benefits from the original phrasing
