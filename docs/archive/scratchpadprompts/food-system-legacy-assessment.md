# Food System — Current State Assessment

**Date:** 2026-03-15 (updated — Phases 1–4.6 all complete)
**Branch:** `feature/v1-sprint`
**Context:** [ADR-0002](../adrs/0002-food-registry-and-canonicalization.md), [Rebuild Manifest](./food-system-rebuild.md)

---

> **Note (2026-03-15):** All legacy issues documented here have been resolved. Phases 1–4.6 complete. The server-side food pipeline (Tasks 1-11) is implemented. All parsing paths converge through `shared/foodCanonicalization.ts` → `shared/foodRegistry.ts`. Game layer deleted. `shared/` directory created. The "two competing sources of truth" concern is fully resolved. This file is now primarily historical record; treat the rebuild manifest and ADR-0002 as the live source of truth.

---

## 2026-03-13 Follow-up Note

This document started as a live legacy assessment before the shared-code move.
Some path references below still preserve that history. The current codebase
reality after the latest audit is:

- shared food system source now lives in `shared/`, not `src/lib/`
- runtime food parsing is deterministic-first and only escalates unresolved
  fragments to GPT-5 mini
- duplicate normalized aliases are rejected instead of being resolved by
  first-match-wins ordering
- client food evidence uses full synced logs, not a truncated client slice
- displayed food history preserves `rawName`
- automatic client-side transit calibration learning/persistence is no longer
  the active overwrite path described in earlier audit notes

**2026-03-14 updates:**

- `normalizeFoodName` now strips standalone unit words without digits, leading/
  trailing punctuation, and normalizes hyphens (Phase 4.5)
- `buildDeterministicItem` stores `parsedName` not `trimmedOriginal` in `name`
  field (Phase 4.5)
- Registry expanded: turkey, baguette, lactose-free cream cheese as examples;
  new canonicals `"peeled apple"` (Zone 2) and `"raw apple"` (Zone 3) (Phase 4.5)
- Server-side food pipeline implemented (Phase 4.6): `convex/foodParsing.ts` and
  `convex/foodLlmMatching.ts` created. All 11 tasks complete. The pipeline is
  now fully server-side with binary LLM matching and user manual matching UI.

Use this file as the historical assessment of what was wrong, but treat
`shared/*`, the ADR, and the rebuild manifest as the current source of truth.

---

## Remaining competing sources of truth

After Phases 1, 2, 2.5, and 3, the original four competing sources are reduced to two remaining conflicts:

| Source                   | File                                         | Status                                                                                       |
| ------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Food Registry            | `shared/foodRegistry.ts`                     | CANONICAL. ~100 entries, Zone 1A/1B/2/3, group/line hierarchy. All new code should use this. |
| ~~SYSTEM_PROMPT~~        | `src/lib/foodParsing.ts`                     | RESOLVED. Prompt now built dynamically from the registry via `foodLlmCanonicalization.ts`.   |
| ~~DEFAULT_FOOD_ZONES~~   | ~~`src/lib/foodStatusThresholds.ts`~~        | RESOLVED. Deleted.                                                                           |
| ~~INGREDIENT_TEMPLATES~~ | ~~`convex/data/ingredientTemplatesSeed.ts`~~ | RESOLVED. Game layer deleted in Phase 4.                                                     |

### Remaining competing normalization functions

| Function                 | File                      | Status                                                                                                                                                                                    |
| ------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalizeFoodName`      | `shared/foodNormalize.ts` | Active. Full: lowercase, trim, singularize, strip quantity/filler, synonym map, standalone unit stripping, punctuation handling. Used by `foodEvidence.ts` and `foodCanonicalization.ts`. |
| `normalizeCanonicalName` | `convex/foodLibrary.ts`   | RESOLVED (Phase 4). Now delegates to `canonicalizeKnownFoodName` + `normalizeFoodName` fallback.                                                                                          |

---

## File-by-file current state

---

### `shared/foodRegistry.ts` (moved from `src/lib/foodRegistry.ts` in Phase 4)

- **Exists:** Yes
- **Lines:** 2858
- **Status:** Active — canonical source of truth
- **What it does:** Defines all canonical foods with zone, subzone, category, subcategory, macros, examples, group, line, and lineOrder. Exports lookup functions (`getFoodEntry`, `getFoodZone`, `getFoodGroup`, `getFoodLine`, `getFoodsByZone`, `getFoodsByLine`, `getLinesByGroup`, `isCanonicalFood`) and display name helpers. Exports type definitions (`FoodZone`, `FoodSubzone`, `FoodGroup`, `FoodLine`, `FoodCategory`, `FoodSubcategory`, `FoodRegistryEntry`). 117 canonicals total.
- **Changes from original assessment:** Was ~104 entries. Now ~117 canonicals. Moved to `shared/` in Phase 4. Grew from 2431 to 2858 lines with Phase 4.5 additions and expanded examples.
- **Remaining issues:** Standalone "chicken" and "bread" not in any examples array (gaps identified 2026-03-15). All other common standalone words (beef, pork, lamb, pasta, turkey, fish variants) are covered.

---

### `shared/foodCanonicalization.ts` (moved from `src/lib/` in Phase 4)

- **Exists:** Yes
- **Lines:** ~145
- **Status:** Active — deterministic canonicalization path
- **What it does:** Builds an example-to-canonical lookup map from the registry at module load. Exports `canonicalizeKnownFoodName(input)` which normalizes input, looks it up in the map (including quantity-word stripping), and returns the canonical name or `null` for unknowns. Re-exports all registry types and functions for convenience. Fails fast on duplicate normalized aliases.
- **Changes from original assessment:** Moved to `shared/`. Duplicate alias detection added in 2026-03-13 audit.
- **Remaining issues:** None.

---

### `src/lib/foodLlmCanonicalization.ts`

- **Exists:** Yes
- **Lines:** 218
- **Status:** Active — LLM canonicalization layer
- **What it does:** Builds the food-parse system prompt from the registry vocabulary (`buildFoodParseSystemPrompt`). Provides `postProcessCanonical(llmCanonical)` which resolves an LLM-returned name against the registry (deterministic match, then direct registry lookup, then fallback to zone 3 as new food).
- **Changes from original assessment:** The original document listed this as "needs to be built". It has been built and is fully integrated — imported and used by `foodParsing.ts`.
- **Remaining issues:** None.

---

### `src/lib/foodParsing.ts`

- **Exists:** Yes
- **Lines:** 311
- **Status:** Active — substantially refactored, most original problems resolved
- **What it does:** AI-powered food parsing. Takes raw user input, sanitises it, calls AI via Convex action with a registry-derived system prompt, validates JSON, then normalises results using `postProcessCanonical` for registry-based canonical/zone resolution. Falls back to comma-split heuristic with registry resolution on failure.
- **Changes from original assessment:** Down from 427 lines. Inline SYSTEM_PROMPT removed; now uses `buildFoodParseSystemPrompt()` from `foodLlmCanonicalization.ts`. `correctZoneAssignment`, `correctItemZones`, and `defaultZoneForFood` import all removed. `normalizeComponent` and `normalizeItem` now use `postProcessCanonical` for registry resolution. `buildFallbackResult` also uses `postProcessCanonical`.
- **Remaining issues:**
  - The `existingNames` array is still passed to the LLM and used for matching, though the prompt now prioritizes the registry vocabulary first. This is a minor concern — could cause the LLM to prefer a user's library name over the registry canonical in edge cases.

---

### `src/lib/foodStatusThresholds.ts`

- **Exists:** Yes
- **Lines:** 159
- **Status:** Active — cleaned, stable utility file
- **What it does:** Exports threshold constants (`MIN_RESOLVED_TRIALS`, `BRISTOL_HARD_UPPER`, `BRISTOL_LOOSE_LOWER`, `RISKY_BAD_COUNT`, `WATCH_BAD_COUNT`), zone constants (`ZONE_MIN`, `ZONE_MAX`), the `Zone` type, `clampZone`, `legacyStageToZone`, `computeBristolAverage`, and `classifyConsistency`.
- **Changes from original assessment:** Down from 506 lines. `DEFAULT_FOOD_ZONES`, `defaultZoneForFood`, `DEFAULT_FOOD_CATEGORIES`, `CATEGORY_KEYWORD_RULES`, `defaultCategoryForFood`, and the `LineCategory` type were all deleted. A comment block at the end documents the removal.
- **Remaining issues:**
  1. The `Zone` type (`1 | 2 | 3`) duplicates `FoodZone` from `foodRegistry.ts`. Should be consolidated.
  2. The trailing comment (lines 157-159) references `foodCategoryMapping.ts` and says `LineCategory` is in `domain.ts` — both are stale. `foodCategoryMapping.ts` was deleted and `LineCategory` no longer exists in `domain.ts`.

---

### `src/lib/foodEvidence.ts`

- **Exists:** Yes
- **Lines:** ~705
- **Status:** Active — Phase 3 COMPLETE, registry canonicalization wired in
- **What it does:** Bayesian evidence model. `buildFoodTrials` extracts food trials from logs. `resolveTrials` correlates food trials with digestive events using transit time windows and modifier signals. `buildFoodEvidenceResult` computes posterior safety scores, primary status, tendency, and per-food summaries. `normalizeAssessmentRecord` normalizes AI assessment records. `toLegacyFoodStatus` bridges new status to legacy UI labels.
- **Changes from Phase 3:**
  1. `buildFoodTrials` now uses `canonicalizeKnownFoodName` first, falling back to `normalizeFoodName` for unknowns. "scrambled eggs" correctly groups under registry canonical `"egg"`.
  2. `normalizeAssessmentRecord` now uses `canonicalizeKnownFoodName` first. AI assessments correlate with registry canonicals.
  3. Avoid/watch split fixed: `effectiveEvidence` alone caps at "watch"; "avoid" requires `severeLowConfounderCount >= 2` (stratified analysis) or AI assessment verdict.
- **Remaining issues:** None from Phase 3. Phase 4 will address the cross-boundary import from Convex.

---

### `src/lib/analysis.ts`

- **Exists:** Yes
- **Lines:** ~255 (reduced from 885 — ~630 lines of dead code deleted in Phase 3)
- **Status:** Active — Phase 3 COMPLETE, substantially simplified
- **What it does:** Reduced to `AnalysisResult` containing `foodStats` and `resolvedTrialsByKey`. Calls `buildFoodEvidenceResult` from `foodEvidence.ts`. Previously contained correlation rows, factor correlations, and text summaries — all deleted as dead code in Phase 3.
- **Changes from Phase 3:**
  1. `BRAT_BASELINES` fixed: `"plain white toast"` -> `"white bread"`, `"applesauce"` -> `"stewed apple"`.
  2. ~630 lines of dead code deleted (unused correlation/factor/summary functions).
  3. `AnalysisResult` simplified to only the fields actually consumed by UI.
- **Remaining issues:** `analyzeLogs` is called in two places (Patterns page and Menu page) — should be lifted to shared context (tracked as PERF-001/004).

---

### `src/lib/foodNormalize.ts`

- **Exists:** Yes
- **Lines:** 194
- **Status:** Active — stable shared utility
- **What it does:** Exports `normalizeFoodName` (lowercase, trim, collapse spaces, strip quantity prefix, strip filler words, singularize, apply synonyms) and `formatFoodDisplayName` (title-case).
- **Changes from original assessment:** None.
- **Remaining issues:** None. This file is correct and used appropriately by `foodCanonicalization.ts`. The problem is that `foodEvidence.ts` and `convex/foodLibrary.ts` use it (or their own simpler version) instead of the registry canonicalization layer.

---

### `convex/foodLibrary.ts`

- **Exists:** Yes
- **Lines:** ~735
- **Status:** Active — migrated in Phase 4
- **What it does:** Convex backend mutations and queries for the food library. Manages food records, batch insertion, merge mapping system (`mergeDuplicates` with `resolveMappedCanonicalName`), and food trial summary rebuilding. Imports `buildFoodEvidenceResult` and `normalizeAssessmentRecord` from `shared/foodEvidence.ts`.
- **Changes from Phase 4:** `normalizeCanonicalName` now delegates to `canonicalizeKnownFoodName` + `normalizeFoodName` fallback. Cross-boundary import fixed: now imports from `shared/` not `src/lib/`.
- **Remaining issues:** None from Phase 4.

---

### `convex/data/ingredientTemplatesSeed.ts`

- **Exists:** NO — DELETED in Phase 4
- **Status:** Deleted. Game layer seed data removed along with `stationDefinitions`, `ingredientTemplates`, `trialSessions`, and `gameState` tables.
- **Notes:** All concerns documented here (mismatched canonical names, 1-10 stage system, local `LineCategory` type) are resolved by deletion. The registry is the only food taxonomy.

---

### Deleted files (confirmed)

| File                                    | Status  | Notes                                                                                                                                 |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/foodCategoryMapping.ts`        | Deleted | Mapped `FoodCategory`/`FoodSubcategory` to `LineCategory`. Redundant after `group`/`line` added to every registry entry in Phase 2.5. |
| `LineCategory` in `src/types/domain.ts` | Deleted | The type no longer exists in `domain.ts`. Only survives as a local type in `ingredientTemplatesSeed.ts`.                              |

---

## Remaining migration work

### ~~Phase 3 — Evidence pipeline~~ COMPLETE (2026-03-12)

All 4 items done: registry canonicalization wired into `buildFoodTrials` and `normalizeAssessmentRecord`, BRAT_BASELINES fixed, ~630 lines dead code deleted, avoid/watch split corrected. 33/33 food system tests pass.

### Phase 4 — Convex layer ~~(planned, not started)~~ COMPLETE (2026-03-13)

Completed since the original assessment:

1. `convex/foodLibrary.ts` now delegates canonical normalization to the shared
   canonicalization pipeline.
2. Shared food code moved to `shared/`, so the Convex/frontend boundary is now
   explicit and stable.
3. The broken game layer was deleted instead of migrated.
4. Registry canonicalization is used consistently across Convex food modules.

What still remains after the latest audit:

1. `ingredientTemplatesSeed.ts` remains only as archived legacy context and is
   not part of the live food/evidence system.
2. Phase 5 transit-map rebuild still needs new UI wiring on top of the shared
   registry/evidence pipeline.

### Minor cleanup

1. Consolidate `Zone` type in `foodStatusThresholds.ts` with `FoodZone` from `foodRegistry.ts`.
2. Keep documentation aligned with the shared-code paths (`shared/*`) instead of
   the pre-Phase-4 `src/lib/*` locations preserved in older notes.

### 2026-03-13 parser/evidence audit deltas

The latest audit added four important clarifications beyond the original
legacy assessment:

1. The parsing layer is deterministic-first today. Earlier concerns about the
   parser being AI-first are now historical.
2. The registry no longer tolerates alias collisions such as `"chili"` /
   `"chili con carne"` and `"rice cake"` shadowing.
3. The displayed history layer intentionally preserves raw user-entered food
   names via `rawName`.
4. The client/server evidence divergence note is historical for the current
   UI surfaces because the client now analyzes full synced logs.

### Phase 4.5 — Data quality fixes (2026-03-14)

Three fixes implemented:

1. `normalizeFoodName` now strips standalone unit words without digits
   (`"G Pasta"` → `"pasta"`), leading/trailing punctuation, and normalizes
   hyphens to spaces. 14 new tests.
2. `buildDeterministicItem` stores `parsedName` (e.g. `"rice"`) in `name`
   field instead of `trimmedOriginal` (e.g. `"200 grams of rice"`). 2 new tests.
3. Registry expanded: turkey → `"grilled white meat"`, baguette → `"white bread"`,
   lactose-free cream cheese → `"cream cheese"`. New canonicals `"peeled apple"`
   (Zone 2) and `"raw apple"` (Zone 3). 8 new tests.

299/299 tests pass. This retroactively fixes all historical data since
normalization runs at every read boundary.

### Phase 4.6 — Server-side food pipeline (COMPLETE — 2026-03-14)

All 11 tasks implemented. The pipeline now works as designed:

1. Raw text saved immediately and immutably (`rawInput` field on log)
2. Server-side parsing: `convex/foodParsing.ts` handles splitting, quantity extraction, and registry matching via `ctx.scheduler.runAfter(0, ...)`
3. LLM binary matching: `convex/foodLlmMatching.ts` — sends unresolved items to OpenAI, binary match to registry or `NOT_ON_LIST`
4. Unresolved items surfaced to user via `FoodMatchingModal` with 6-hour resolution window
5. Entire meal held from downstream until fully resolved (no partial `ingredientExposures`)
6. Registry locked at runtime — no auto-additions from LLM or users
7. Default portions on registry entries
8. Field renames complete: `name` → `parsedName`, `rawName` → `userSegment`, new `resolvedBy` field

New files: `convex/foodParsing.ts` (491 lines), `convex/foodLlmMatching.ts` (461 lines)

Plan: `docs/plans/2026-03-14-server-side-food-pipeline.md` (all 11 tasks done)

### Remaining after Phase 4.6

All original competing sources of truth are now RESOLVED. No remaining
normalization conflicts. The food system has a clean, single pipeline:

```
rawInput → split → parse quantities → registry match → LLM binary match → user manual match → canonical
```

Remaining non-food-system work:

- `analyzeLogs` shared context lift (PERF-001/004)
- `Zone` type consolidation (`foodStatusThresholds.ts` vs `FoodZone`)
- Phase 5: Transit map UI + game layer rebuild
