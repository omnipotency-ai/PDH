# A2 — Shared Pure Logic Audit Report

**Date:** 2026-03-16
**Scope:** `shared/`, `shared/__tests__/`
**Files reviewed:** 16 (9 source, 7 test)

---

## Critical Issues

| #   | File              | Line/Function                            | Description                                                                                                                                                                                                                                                                                                                            | Suggested Fix                                                                                                                                       |
| --- | ----------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `foodRegistry.ts` | L1887–1890                               | **Duplicate example string.** `"lactose free spreadable cheese"` appears twice in the `cream cheese` examples array. The `mergeExamples` function deduplicates at runtime but the registry data is wrong at source.                                                                                                                    | Remove the duplicate from the `ZONE_2` `cream cheese` entry directly.                                                                               |
| C2  | `foodEvidence.ts` | L190, L201, L204, L216, L244, L290, L336 | **Multiple `as` type casts on `unknown` log data.** `log.data` is typed as `unknown` but repeatedly cast to `Record<string, unknown>` or accessed via inline `as { ... }` casts without structural validation. If malformed log data is stored, `Number()` conversions return `NaN`, which can produce incorrect digestion statistics. | Define a `DigestiveEventData` / `FoodLogItemData` interface and use a runtime check (`typeof data === 'object' && data !== null`) before narrowing. |
| C3  | `foodMatching.ts` | L282–286                                 | **AI-generated TODO comment with legacy rationale text.** `// TODO(review): the matcher currently projects from the legacy shared transit-map registry...` references aspirational state and "schema-food-zones.md" without clarity on required action.                                                                                | Either resolve the TODO and remove the comment, or convert to a tracked Linear issue and replace with a one-liner reference.                        |

---

## High Priority

| #   | File                          | Line/Function                        | Description                                                                                                                                                                                                                                                                          | Suggested Fix                                                                                                                                             |
| --- | ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | `foodRegistry.ts`             | L4004–4009, L3865                    | **`as` type casts on known-good `const` data.** `Object.keys(FOOD_GROUP_LINES) as FoodGroup[]`, `Object.values(...).flatMap(...) as FoodLine[]`, and `(FOOD_GROUP_LINES[group] as ReadonlyArray<FoodLine>)` are casts due to TypeScript's `Object.keys/values` returning `string[]`. | Replace with a typed helper that extracts keys/values safely, or add an explicit `satisfies` check.                                                       |
| H2  | `foodNormalize.ts`            | L171–177 (`SYNONYM_MAP`)             | **Synonym map has a reflexive self-mapping.** `["pureed potato", "pureed potato"]` maps a string to itself. Produces no normalisation effect and is confusing.                                                                                                                       | Remove `["pureed potato", "pureed potato"]` from the synonym map.                                                                                         |
| H3  | `foodEvidence.ts`             | L271–273 (`getDayBucket`)            | **No guard against `NaN` input.** `getDayBucket(NaN)` returns `NaN` which will never match any Map key, silently dropping all modifiers for that trial.                                                                                                                              | Add a `Number.isFinite(timestamp)` guard at the entry of `getDayBucket` and throw (or return a sentinel) on invalid input.                                |
| H4  | `foodEvidence.ts`             | L452–453 (`learnTransitCalibration`) | **Non-null assertion `!` on sorted array elements.** `values[Math.floor(values.length * 0.75)]!` could be `undefined` if `length * 0.75` rounds to exactly the array length for small arrays.                                                                                        | Add an explicit bounds check: `const p75Index = Math.min(Math.floor(values.length * 0.75), values.length - 1)`.                                           |
| H5  | `foodCanonicalName.ts`        | entire file                          | **Pure duplication of `resolveCanonicalFoodName` in `foodProjection.ts`.** Both export identical bodies. The same function is copy-pasted into three Convex files as a private helper.                                                                                               | Make `foodCanonicalName.ts` the single authoritative source. Delete from `foodProjection.ts` and fix the three Convex files to import the shared version. |
| H6  | `foodPipelineDisplay.test.ts` | L95–100, L106–125                    | **Tests labelled "BUG BASELINE" assert the buggy behaviour.** If the bug is fixed, they silently start failing. Also: `getFoodItemDisplayName` is re-implemented inline in the test file rather than imported from production code — the tests are not testing the shipped function. | Use `it.fails(...)` for bug-baseline tests. Import and test the real production function.                                                                 |

---

## Medium Priority

| #   | File                      | Line/Function                                                                             | Description                                                                                                                                                                                      | Suggested Fix                                                                                                           |
| --- | ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| M1  | `foodNormalize.ts`        | L80–83 (`singularizeWord`, `ves` branch)                                                  | **`ves → f` branch silently produces wrong singularisations** for `ves` words not in `PLURAL_OVERRIDES` (e.g. `"knaves"` → `"knaf"`).                                                            | Enumerate all expected `ves` words in `PLURAL_OVERRIDES`, or document exactly which words the fallback handles.         |
| M2  | `foodNormalize.ts`        | L233–234                                                                                  | **Percentage pattern strips valid food descriptor words.** `cleaned.replace(/\d+%\s*\w*/g, "")` — the `\w*` after `%` is over-eager and can swallow adjacent words.                              | Use `\d+%` without the trailing `\s*\w*` and strip leading/trailing spaces after.                                       |
| M3  | `foodMatching.ts`         | L155–168 (`protectPhrases`)                                                               | **Stateful `.lastIndex` risk with `gi` RegExp.** `pattern.test()` advances `lastIndex`; safe in practice because pattern is per-phrase, but fragile.                                             | Use `pattern.source` with a fresh `new RegExp(...)` for the `replace`, or use `String.prototype.includes` for the test. |
| M4  | `foodEvidence.ts`         | L387–395, L398–412 (`negativeEvidenceMultiplierForZone`, `safePosteriorThresholdForZone`) | **Comments inside `switch` cases explain "what" not "why".** E.g. `// Zone 1: 15% reduction — inherently safer foods` restates the multiplier value without clinical rationale.                  | Replace inline comments with a reference to the clinical source or decision rationale.                                  |
| M5  | `foodRegistry.ts`         | `parsnip` entry, `lineOrder` comment                                                      | **Inline `// lineOrder 10: parsnip is well-tolerated early in vegetable reintroduction`** embedded in a property assignment explains "what" not "why" in code.                                   | Move the rationale to `notes`.                                                                                          |
| M6  | `foodMatching.ts`         | L487–491 (`searchFoodDocuments`)                                                          | **Creates a new `Fuse` instance on every call when `bucketKey` filter is active.** O(n) `Fuse` construction per keystroke per active bucket.                                                     | Cache bucket-filtered `Fuse` instances on the `FoodMatcherContext` keyed by `bucketKey`.                                |
| M7  | `foodEvidence.ts`         | L283–354 (`summarizeModifiers`)                                                           | **Habit modifier keyword matching against `habitId + habitName` uses hard-coded personal keywords** (`"tina"`, `"rec drug"`). Violates the "no hard-coding personalization" rule from CLAUDE.md. | Move habit modifier rules into a configurable registry.                                                                 |
| M8  | `foodRegistry.ts`         | `gelatin dessert` entry                                                                   | **`gelatin dessert` assigned to `group: "carbs", line: "grains"`.** Gelatin is a protein-derived collagen product with essentially zero carbohydrate. Clinically incorrect classification.       | Reassign to `group: "protein"` or document the deliberate choice in `notes`.                                            |
| M9  | `foodCanonicalization.ts` | L100–121 (`LEADING_QUANTITY_WORDS`)                                                       | **`"of"` is in the `LEADING_QUANTITY_WORDS` set.** Any food prefixed with `"of"` would have it silently stripped.                                                                                | Remove `"of"` from `LEADING_QUANTITY_WORDS` and handle it contextually, or add a test case.                             |
| M10 | `foodParsing.ts`          | L196–207 (`parseLeadingQuantity`)                                                         | **`MEASURE_UNIT_PATTERN` string is duplicated** across `foodNormalize.ts` and `foodParsing.ts`. A future unit addition in one place will silently diverge.                                       | Export from a single location and import in both files, or use a shared array to derive both regexes.                   |

---

## Low Priority

| #   | File               | Line/Function                                             | Description                                                                                                                                                                                       | Suggested Fix                                                                                                        |
| --- | ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| L1  | `foodNormalize.ts` | L259–262 (`CANONICAL_DISPLAY_OVERRIDES`)                  | **Only one entry in `CANONICAL_DISPLAY_OVERRIDES`.** The override pattern is a side map of UX decisions rather than normalization rules.                                                          | Move display name overrides into the registry entries themselves (e.g. a `displayName?: string` field).              |
| L2  | `foodRegistry.ts`  | Vegetable `lineOrder` sequence                            | **Potential clinical incoherence in lineOrder.** `parsnip` (lineOrder 10) notes it is "early in vegetable reintroduction" but is listed after `peeled_cucumber` (lineOrder 9).                    | Audit the `vegetables` lineOrder sequence for clinical coherence.                                                    |
| L3  | `foodRegistry.ts`  | `battered fish` notes                                     | **"New entry."** in the `notes` field is an AI-generated placeholder. Describes "what" not "why".                                                                                                 | Replace with clinical rationale (e.g. "Deep-frying adds a high fat load to otherwise moderate-risk white fish").     |
| L4  | `foodRegistry.ts`  | Multiple Zone 3 notes                                     | **Zone-change notes** like `"Zone changed from 2 to 3 (roasted in fat)."` explain "what changed" not "why that zone is correct now". At least 8 entries have this pattern.                        | Replace with the clinical reason the current zone is correct, not a migration breadcrumb.                            |
| L5  | `foodMatching.ts`  | L86–94 (`CONJUNCTION_SPLIT_PATTERN`, `PROTECTED_PHRASES`) | **`PROTECTED_PHRASES` list is very small (4 entries)** with no mechanism for extension. Missing composites like "fish and chips" or "bread and butter".                                           | Document the protection mechanism's scope and add a test that validates which known composites are/aren't protected. |
| L6  | `foodEvidence.ts`  | L180                                                      | **Comment `// normalizeFoodName and formatFoodDisplayName are imported from @/lib/foodNormalize`** — stale path. Actual imports at L13 are from `"./foodNormalize"` (relative path in `shared/`). | Delete this comment — it is wrong and explains nothing.                                                              |
| L7  | `foodRegistry.ts`  | L1731–1733                                                | **Inline `// lineOrder 10: parsnip...` comment** inside a property assignment explains the value not the reason.                                                                                  | Move the rationale to `notes`.                                                                                       |
| L8  | `foodTypes.ts`     | entire file (29 lines)                                    | **`foodTypes.ts` is very thin** — 6 types all re-exported from `foodEvidence.ts`. Unclear if any consumer imports directly from here.                                                             | Verify direct importers; consolidate if none.                                                                        |

---

## Dead Code Report

| File                          | Export/Function                        | Status               | Notes                                                                                                                                                                        |
| ----------------------------- | -------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `foodCanonicalName.ts`        | `normalizeCanonicalName`               | Partially dead       | Exported and used in 2 Convex files, but identical logic is copy-pasted as private `function normalizeCanonicalName` in 3 other Convex files instead of importing from here. |
| `foodProjection.ts`           | `resolveCanonicalFoodName`             | Duplicate            | Identical implementation to `normalizeCanonicalName` in `foodCanonicalName.ts`. Neither is canonical over the other.                                                         |
| `foodNormalize.ts`            | `formatCanonicalFoodDisplayName`       | Thin wrapper         | One override entry. Function is used but the override map is nearly empty.                                                                                                   |
| `foodEvidence.ts`             | `toLegacyFoodStatus`                   | Potentially dead     | Exported but not tested. Verify it is still consumed by client code.                                                                                                         |
| `foodPipelineDisplay.test.ts` | `getFoodItemResolutionStatus` (inline) | Test-local dead code | Re-implemented in the test file rather than imported from `src/components/track/today-log/helpers.ts`. Tests validate a copy, not the shipped function.                      |
| `foodPipelineDisplay.test.ts` | `getFoodItemDisplayName` (inline)      | Test-local dead code | Same as above — re-implemented inline, not imported from production.                                                                                                         |

---

## Test Coverage

| Function/Export                                   | Has Tests? | Notes                                                                           |
| ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| `normalizeFoodName`                               | Yes        | Thorough. Plural forms, filler words, accents, edge cases.                      |
| `formatFoodDisplayName`                           | Yes        | Basic title-case and edge cases.                                                |
| `prefersSummaryCandidate`                         | **No**     | Exported from `foodNormalize.ts`, not tested anywhere.                          |
| `canonicalizeKnownFoodName`                       | Yes        | Very thorough across all zones.                                                 |
| `splitRawFoodItems`                               | Yes        | Full coverage.                                                                  |
| `parseLeadingQuantity`                            | Yes        | Good coverage including decimals, word-numbers, size units.                     |
| `sanitiseFoodInput`                               | Yes        | Good coverage.                                                                  |
| `buildFoodEvidenceResult`                         | Yes        | 10 integration-level scenarios.                                                 |
| `toLegacyFoodStatus`                              | **No**     | Exported but not tested.                                                        |
| `normalizeAssessmentRecord`                       | **No**     | Exported but not tested.                                                        |
| `getFoodEmbeddingSourceHash`                      | Yes        | 1 case.                                                                         |
| `createFoodMatcherContext`                        | Yes        | Alias override and short-query cases.                                           |
| `mergeFoodMatchCandidates`                        | **No**     | Not tested. Embedding candidate merging path entirely untested.                 |
| `isStructurallyAmbiguousPhrase`                   | **No**     | Exported but not tested.                                                        |
| `preprocessMealText`                              | Yes        | 8 cases.                                                                        |
| `getFoodEntry`                                    | Yes        |                                                                                 |
| `getFoodZone`                                     | Yes        |                                                                                 |
| `getFoodsByZone`                                  | Yes        |                                                                                 |
| `getFoodGroup`                                    | Yes        |                                                                                 |
| `getFoodLine`                                     | Yes        |                                                                                 |
| `getFoodsByLine`                                  | Yes        |                                                                                 |
| `getLinesByGroup`                                 | Yes        |                                                                                 |
| `getLineDisplayName`                              | Yes        | All 11 lines.                                                                   |
| `getGroupDisplayName`                             | Yes        | All 4 groups.                                                                   |
| `isCanonicalFood`                                 | Yes        |                                                                                 |
| `getFoodDigestionMetadata`                        | Yes        | 2 cases.                                                                        |
| `getLoggedFoodIdentity`                           | Yes        | 5 cases in `foodPipelineDisplay.test.ts`.                                       |
| `resolveCanonicalFoodName`                        | Yes        | 3 cases.                                                                        |
| `getCanonicalFoodProjection`                      | Yes        | 5 cases.                                                                        |
| `normalizeCanonicalName` (`foodCanonicalName.ts`) | Indirectly | No direct test; covered via `resolveCanonicalFoodName` tests (identical logic). |
| `BRAT_BASELINE_CANONICALS` / `BRAT_FOOD_KEYS`     | **No**     | Exported constants, not tested.                                                 |

---

## Summary

**Total findings: 30** (3 Critical, 6 High, 10 Medium, 11 Low)

**Most important issues to address:**

1. **C2** — Replace unsafe `as` casts on `log.data` in `foodEvidence.ts` with runtime narrowing — the evidence engine is the core of the app; silent data corruption here produces wrong safety classifications.
2. **H5** — Consolidate three private copies of `normalizeCanonicalName` in Convex files to import from `shared/foodCanonicalName.ts`.
3. **H6** — Fix `foodPipelineDisplay.test.ts` to import real production functions instead of re-implementing them inline.
4. **C1** — Remove the duplicate registry example in `cream_cheese` (data correctness).
5. **M8** — `gelatin dessert` is wrongly classified under `carbs/grains`; it is a protein-derived product.
6. **C3 / L3 / L4** — Clean up stale and placeholder comments throughout the registry.
