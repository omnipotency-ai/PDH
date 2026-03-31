# Food System — Legacy Code Assessment

**Date:** 2026-03-12
**Purpose:** Deep assessment of every legacy file in the food system before migration.
**Context:** [ADR-0002](../adrs/0002-food-registry-and-canonicalization.md), [Rebuild Manifest](./food-system-rebuild.md)
**Staleness note:** This assessment was written before Phases 2 and 2.5 completed. References to `LineCategory`, `foodCategoryMapping.ts`, `TransitLine`, and `foodStatusThresholds.ts` problems 1–4 are now resolved. `LineCategory` was deleted in Phase 2.5. See the rebuild manifest for current state.

---

## The core problem in one sentence

There are **four competing sources of truth** for food zone/canonical assignment and **two competing normalization functions** — none of them agree with each other, and none of them use the new registry.

### The four competing sources of truth

| Source               | File                                     | What it claims                                                                                |
| -------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Food Registry        | `src/lib/foodRegistry.ts`                | **New.** ~104 foods, Zone 1A/1B/2/3, clinically grounded                                      |
| DEFAULT_FOOD_ZONES   | `src/lib/foodStatusThresholds.ts`        | ~30 foods, Zone 1/2/3, wrong assignments for several (all chicken = Zone 1)                   |
| SYSTEM_PROMPT        | `src/lib/foodParsing.ts`                 | Embedded LLM instructions, Zone 1/2/3, contradicts both of the above                          |
| INGREDIENT_TEMPLATES | `convex/data/ingredientTemplatesSeed.ts` | ~100 foods, Stage 1–10 (mapped to 3 zones via `legacyStageToZone`), different canonical names |

### The two competing normalization functions

| Function                 | File                       | What it does                                                           |
| ------------------------ | -------------------------- | ---------------------------------------------------------------------- |
| `normalizeFoodName`      | `src/lib/foodNormalize.ts` | Full: lowercase, trim, singularize, strip quantity/filler, synonym map |
| `normalizeCanonicalName` | `convex/foodLibrary.ts`    | Simple: `toLowerCase().trim().replace(/\s+/g, " ")` only               |

---

## File-by-file assessment

---

### `src/lib/foodParsing.ts` (427 lines)

**Role:** LLM-powered food parsing. Sole consumer is `useFoodParsing` hook. Takes raw user input, sanitises it, calls AI, validates JSON, normalises result.

**What's working:**

- `sanitiseFoodInput` — cleans voice-to-text artefacts. Clean and correct. Keep.
- `buildFallbackResult` — comma-split fallback when AI fails. Functional.
- `isValidFoodComponent` / `isValidParsedFoodItem` / `isValidFoodParseResult` — JSON validation guards. Well-written. Keep.
- `normalizeComponent` / `normalizeItem` — post-processes LLM output, fills in nulls. Keep.
- The overall LLM call structure, error handling, and fallback pattern. Keep.

**What's broken:**

**Problem 1 — SYSTEM_PROMPT contradicts the registry (critical)**  
The prompt explicitly instructs the LLM to treat preparations as separate canonicals:

> "boiled egg" ≠ "fried egg" ≠ "scrambled egg" (different preparations = different foods!)  
> "mashed potato" ≠ "boiled potato" ≠ "chips" (different preparations = different foods!)

This is the exact opposite of what the registry does. If `foodParsing.ts` runs, it will generate `"scrambled egg"` as a canonical name. The registry maps that to `"egg"`. The trial data will fragment.

**Problem 2 — Zone assignment embedded in the prompt (critical)**  
The prompt assigns zones via hardcoded descriptions: "chicken (ANY preparation) = Zone 1". But the registry says plain/boiled chicken = Zone 1 and grilled/baked chicken = Zone 2. The LLM has no knowledge of the registry and cannot be consistent with it.

**Problem 3 — correctZoneAssignment is a symptom-fix on top of a broken prompt**  
After the LLM returns, `correctZoneAssignment` calls `defaultZoneForFood` from `foodStatusThresholds.ts` to override the LLM's zones. This is a post-processing bandage on top of a misconfigured prompt. Removing `correctZoneAssignment` without fixing the prompt would make things worse. The two must be tackled together.

**Problem 4 — existingNames matching**  
The prompt passes the user's `existingNames` (their food library) to the LLM and asks it to match against those. This means the LLM tries to match "scrambled eggs" against "scrambled egg" (in the library) rather than against the registry canonical "egg". The matching vocabulary is wrong.

**What needs to change:**

1. Replace SYSTEM_PROMPT with a version that gives the LLM the registry vocabulary (canonical names + examples + notes)
2. Tell the LLM to map inputs to registry canonicals, not free-form names
3. Remove `correctZoneAssignment` and `correctItemZones` — zone should come from a registry lookup after canonicalization
4. Remove import of `defaultZoneForFood` from `foodStatusThresholds`

**Risk:** High. This is the entry point for all new food data. Getting this wrong means bad canonicals propagate into the evidence pipeline.

---

### `src/lib/foodStatusThresholds.ts` (506 lines)

**Role:** Mixed-purpose. Contains food status thresholds, Bristol math, zone clamping utilities, AND two lookup tables (zone and category) for ~30 hardcoded foods.

**What's working (keep):**

- `MIN_RESOLVED_TRIALS`, `BRISTOL_HARD_UPPER`, `BRISTOL_LOOSE_LOWER`, `RISKY_BAD_COUNT`, `WATCH_BAD_COUNT` — pure configuration constants. Correct. Used widely.
- `computeBristolAverage` — pure math. Correct. Keep.
- `classifyConsistency` — pure classification. Correct. Keep.
- `clampZone` — utility. Keep.
- `legacyStageToZone` — maps the old 1–10 stage to 3-zone. Keep (needed until `ingredientTemplatesSeed.ts` is migrated).
- `Zone` type — but note this duplicates `FoodZone` from the registry.

**What's broken:**

**Problem 1 — DEFAULT_FOOD_ZONES has wrong zone assignments**  
All chicken preparations are Zone 1 (`"chicken": 1`, `"boiled chicken": 1`, `"grilled chicken": 1`). The registry correctly separates Zone 1 (plain/boiled/poached) from Zone 2 (grilled/baked/roasted). The lookup table is ~30 foods and misses ~70 registry entries.

**Problem 2 — defaultZoneForFood superseded by the registry**  
`defaultZoneForFood(canonicalName)` is a lookup against `DEFAULT_FOOD_ZONES`, returning Zone 3 for unknowns. This is exactly `getFoodZone(canonical) ?? 3` from the registry — but with wrong assignments and less coverage. It should be removed and callers should use `getFoodZone` from `foodRegistry.ts`.

**Problem 3 — DEFAULT_FOOD_CATEGORIES and defaultCategoryForFood duplicate the registry**  
The file has a `DEFAULT_FOOD_CATEGORIES` record (~30 entries) and a `CATEGORY_KEYWORD_RULES` array (keyword → category fallback). This duplicates the `category` and `subcategory` fields already on every registry entry. It should be removed and replaced by `getFoodEntry(canonical)?.category`.

**Problem 4 — LineCategory type is narrower than the registry**  
The file uses `"protein" | "veg" | "carb" | "fruit" | "fat" | "seasoning"`. The registry uses `"protein" | "carbohydrate" | "fat" | "dairy" | "condiment" | "drink"`. These don't map 1:1 — `"carbohydrate"` vs `"carb"`, `"condiment"` vs `"seasoning"`, and no registry equivalent of `"veg"` (it's `subcategory: "vegetable"` instead). This mismatch will cause confusion until the category system is unified.

**What needs to change:**

1. Remove `DEFAULT_FOOD_ZONES` and `defaultZoneForFood` — replace callers with `getFoodZone` from registry
2. Remove `DEFAULT_FOOD_CATEGORIES`, `CATEGORY_KEYWORD_RULES`, `defaultCategoryForFood` — replace callers with `getFoodEntry(canonical)?.category`
3. Keep all threshold constants and Bristol math — these are correct and widely used
4. Resolve `Zone` type vs `FoodZone` type duplication

**Risk:** Medium. Callers of `defaultZoneForFood` need to be updated. The food parsing `correctZoneAssignment` is the main caller — but that's being removed anyway.

---

### `src/lib/foodEvidence.ts` (706 lines)

**Role:** Bayesian evidence model. Computes food trial evidence, transit time calibration, and posterior safety scores. Called by `convex/foodLibrary.ts` and `analysis.ts`.

**What's working (do not touch):**

- The entire Bayesian math: `resolveTrials`, `learnTransitCalibration`, `buildFoodEvidenceResult`, `assessmentScore`, `recencyWeight`, `primaryStatusFromSignals`, `tendencyFromTrials`
- The modifier signals (habits, activity, fluids affecting transit time)
- All type definitions: `FoodEvidenceTrial`, `FoodEvidenceSummary`, `FoodEvidenceResult`, etc.
- `toLegacyFoodStatus` — bridges new status to legacy UI labels

**What's broken:**

**Problem 1 — canonical keys come from normalizeFoodName, not the registry**  
In `buildFoodTrials`, the canonical key is set as:

```typescript
const canonicalName = rawCanonical
  ? normalizeFoodName(rawCanonical)
  : normalizeFoodName(name);
```

`normalizeFoodName("scrambled eggs")` returns `"scrambled egg"` — NOT the registry canonical `"egg"`. So all scrambled egg trials group under `"scrambled egg"`, not under `"egg"`, and don't merge with boiled egg or omelette trials. The entire "collapsed canonicals" benefit of the new registry is lost at this ingestion point.

**Problem 2 — normalizeAssessmentRecord uses normalizeFoodName for canonical assignment**  
When an AI assessment comes in for "scrambled eggs", `normalizeAssessmentRecord` sets:

```typescript
canonicalName: normalizeFoodName(food); // → "scrambled egg", not "egg"
```

The AI assessment won't correlate with the registry canonical and won't show up in the correct food's evidence summary.

**What needs to change:**

1. `buildFoodTrials` should apply `canonicalizeKnownFoodName` first, falling back to `normalizeFoodName` for unknowns
2. `normalizeAssessmentRecord` should do the same — canonicalize against the registry before storing
3. The core Bayesian math does not change

**Risk:** Medium-low. The math is untouched. The change is localized to two functions at the ingestion boundary.

---

### `src/lib/analysis.ts` (~886 lines)

**Role:** Large aggregation module. Builds `FoodStat[]`, correlation rows, factor correlations, and text summaries. Consumed by the Track page and Patterns page.

**What's working:**

- The overall aggregation pipeline
- Factor correlation logic (walk, smoking, sleep, fluid)
- `STATUS_ORDER_SAFE_FIRST`, `STATUS_ORDER_RISKY_FIRST` — used by UI
- Transit time bucketing and classification
- `toLegacyFoodStatus` bridge
- `analyzeLogs` function structure

**What's broken:**

**Problem 1 — BRAT_BASELINES hardcoded in the module**

```typescript
const BRAT_BASELINES = [
  { key: "banana", name: "Banana" },
  { key: "white rice", name: "White Rice" },
  { key: "plain white toast", name: "Plain White Toast" },
  { key: "applesauce", name: "Applesauce" },
];
```

These four foods start with "safe" status (0 trials needed). But "plain white toast" and "applesauce" are not registry canonicals (`"white bread"` and `"stewed apple"` are). If a user logs "toast" or "white toast", they get canonical `"white bread"`, which doesn't match `"plain white toast"` in BRAT_BASELINES. The pre-populated safe status is silently lost.

**Problem 2 — canonical keys in FoodStat described as "from LLM or legacy normalization"**  
The `FoodStat.key` field comment says "canonical name (from LLM or legacy normalization)". This confirms the system knows its own canonical assignment is inconsistent. Once `foodEvidence.ts` is fixed to use registry canonicals, this inconsistency propagates upward and `analysis.ts` will automatically use correct keys — no direct changes needed to the math.

**Problem 3 — zone filtering reads recoveryStage from log data**  
Zone filtering reads the `recoveryStage` field stored on each log entry, which was written by the now-broken `foodParsing.ts`. Once parsing is fixed, the stored stages will be correct. But historically logged food entries will have wrong zone data until a migration is run.

**What needs to change:**

1. Replace `BRAT_BASELINES` keys with registry canonical names
2. After `foodEvidence.ts` is fixed, verify that `FoodStat.key` values align with registry canonicals
3. Historical data zone correction is a Convex migration concern — document separately

**Risk:** Low-medium. Most changes are downstream consequences of fixing `foodEvidence.ts` and `foodParsing.ts`. Direct changes to `analysis.ts` are minimal.

---

### `convex/foodLibrary.ts` (676 lines)

**Role:** Convex backend mutations and queries for the food library database. Manages food records, merge mappings, and evidence computation for the Convex layer.

**What's working:**

- The merge mapping system (`resolveMappedCanonicalName`) — allows admin-level food canonical merging
- The database query/mutation structure

**What's broken:**

**Problem 1 — its own normalizeCanonicalName function**  
The file defines `normalizeCanonicalName` as:

```typescript
function normalizeCanonicalName(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}
```

This is missing the singularization, filler-word stripping, and synonym handling that `normalizeFoodName` provides. So `"scrambled eggs"` normalized by this function stays `"scrambled eggs"`, not `"scrambled egg"`. The Convex canonical keys may differ from the frontend keys, causing silent grouping failures.

**Problem 2 — cross-boundary import of frontend lib**  
`convex/foodLibrary.ts` imports directly from `src/lib/foodEvidence`:

```typescript
import { buildFoodEvidenceResult, ... } from "../src/lib/foodEvidence";
```

This means the Convex backend is calling a frontend library file. This is a boundary violation and creates fragile coupling. The evidence computation should either live in a shared location or be duplicated properly for the Convex context.

**What needs to change:**

1. Replace `normalizeCanonicalName` with `normalizeFoodName` (or better, `canonicalizeKnownFoodName`)
2. Resolve the cross-boundary import — either move `foodEvidence.ts` to a shared location or extract the relevant types/functions

**Risk:** Medium. This touches the Convex layer, which requires careful testing.

---

### `convex/data/ingredientTemplatesSeed.ts` (~1600 lines)

**Role:** Seed data for the transit map. ~100 ingredient templates with a 1–10 stage system, 6 line categories, and `prerequisites` for unlocking progression.

**What's broken:**

**Problem 1 — entirely separate food list with different canonical names**  
The seed data uses canonical names like `"poached white fish"`, `"plain yogurt"`, `"steamed zucchini"` — which don't all match the registry. For example:

- Seed: `"poached white fish"` vs Registry: `"steamed fish"` (covers both)
- Seed: `"plain yogurt"` vs Registry: `"plain yogurt"` ✓ (same)
- Seed: `"steamed zucchini"` vs Registry: `"courgette"` (different canonical)

When a user logs "courgette" and the transit map station is "steamed zucchini", their trial data won't connect to the station.

**Problem 2 — 1–10 stage system converted via legacyStageToZone**  
The seed uses stages 1–10 mapped to zones 1–3 via `legacyStageToZone`. This is the "legacy stage" format that the thresholds file translates. The registry uses a direct 3-zone system with subzones (1A, 1B). These need to be reconciled.

**Problem 3 — LineCategory vs registry Category**  
The seed uses `"protein" | "veg" | "carb" | "fruit" | "fat" | "seasoning"` — the same legacy LineCategory as `foodStatusThresholds.ts`. The registry uses a different category taxonomy.

**What needs to change:**

1. Long-term: regenerate this seed from `FOOD_REGISTRY` — every registry entry becomes a template
2. Medium-term: ensure canonical names in the seed match the registry canonical names exactly
3. Resolve `LineCategory` vs `FoodCategory` before regenerating the seed

**Risk:** High. This is seeded data — already in production databases. Changing canonical names means existing user stations won't match new log entries. Requires a data migration.

---

## Summary: what breaks what

```
foodRegistry.ts (new, correct)
    ↓ used by
foodCanonicalization.ts (new, correct)
    ↓ NOT YET used by
foodParsing.ts ──────────────────────┐
    ↓ uses (wrong)                    ↓ blocks correct canonicalization
defaultZoneForFood (thresholds)      foodEvidence.ts
    ↓ is a broken version of              ↓ uses normalizeFoodName (not registry)
getFoodZone (registry)               analysis.ts
                                          ↓ inherits wrong canonical keys
                                     convex/foodLibrary.ts
                                          ↓ cross-boundary import + own normalization
                                     ingredientTemplatesSeed.ts
                                          ↓ different canonical names + 1-10 stage system
```

---

## What still needs to be built (new files)

| File                                        | Purpose                                                                                                    | Blocks                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `src/lib/foodLlmCanonicalization.ts`        | LLM canonicalization using registry vocabulary. Replaces the inline zone/canonical logic in SYSTEM_PROMPT. | `foodParsing.ts` update       |
| `convex/data/ingredientTemplatesSeed.v2.ts` | Registry-derived seed data. Replaces the hand-authored 1–10 stage seed.                                    | Transit map station alignment |

---

## Migration order (safe sequence)

### Phase 1 — Already done (isolated, no runtime risk)

- [x] `foodRegistry.ts` created
- [x] `foodCanonicalization.ts` replaced
- [x] Tests rewritten

### Phase 2 — Food parsing (medium risk, affects new entries only)

1. Build `foodLlmCanonicalization.ts` — new LLM path using registry
2. Strip `DEFAULT_FOOD_ZONES` and `defaultZoneForFood` from `foodStatusThresholds.ts`
3. Update `foodParsing.ts` SYSTEM_PROMPT to use registry vocabulary
4. Remove `correctZoneAssignment` and `correctItemZones` from `foodParsing.ts`
5. Add `canonicalizeKnownFoodName` as a pre/post-processing step in `foodParsing.ts`

### Phase 3 — Evidence pipeline (medium risk, affects grouping keys)

1. Update `buildFoodTrials` in `foodEvidence.ts` to use registry canonicalization
2. Update `normalizeAssessmentRecord` in `foodEvidence.ts`
3. Fix `BRAT_BASELINES` in `analysis.ts` to use correct registry canonical names
4. Verify that canonical keys align end-to-end

### Phase 4 — Convex layer (higher risk, data migration required)

1. Replace `normalizeCanonicalName` in `convex/foodLibrary.ts` with `normalizeFoodName`
2. Resolve cross-boundary import issue
3. Align `ingredientTemplatesSeed.ts` canonical names with registry
4. Write Convex migration to re-canonicalize existing food library entries
5. Unify `LineCategory` and `FoodCategory` types

---

## What not to touch (stable, correct)

- `src/lib/foodNormalize.ts` — shared utility, correct
- All Bristol math and threshold constants in `foodStatusThresholds.ts`
- The Bayesian scoring math in `foodEvidence.ts`
- The overall `buildFoodEvidenceResult` pipeline structure
- The `sanitiseFoodInput` function in `foodParsing.ts`
- The JSON validation guards in `foodParsing.ts`

---

## Verification Audit (2026-03-12)

This audit was performed by reading every file referenced in this document and verifying each claim against the current codebase on branch `feature/v1-sprint`.

### Overall staleness

The staleness note at the top of this document is partially accurate but incomplete. Phases 1, 2, and 2.5 have all been completed. The document's descriptions of what was "broken" in `foodStatusThresholds.ts` and `foodParsing.ts` are now stale — those problems have been fixed. However, the document's descriptions of problems in `foodEvidence.ts`, `analysis.ts`, `convex/foodLibrary.ts`, and `ingredientTemplatesSeed.ts` remain accurate.

### File-by-file verification

#### `src/lib/foodParsing.ts`

- **Claimed:** 427 lines. **Actual:** 311 lines. Significantly smaller — the inline SYSTEM_PROMPT, `correctZoneAssignment`, `correctItemZones`, and `defaultZoneForFood` import have all been removed.
- **SYSTEM_PROMPT contradiction (Problem 1):** RESOLVED. The file now imports `buildFoodParseSystemPrompt` from `foodLlmCanonicalization.ts`. The prompt is built dynamically from the registry vocabulary, not hardcoded.
- **Zone assignment in prompt (Problem 2):** RESOLVED. The new prompt includes the registry vocabulary table with zones, and instructs the LLM to match against it.
- **correctZoneAssignment (Problem 3):** RESOLVED. Removed entirely. Zone correction now happens via `postProcessCanonical` in `normalizeComponent` and `normalizeItem`.
- **existingNames matching (Problem 4):** PARTIALLY RESOLVED. The prompt still passes `existingNames` and asks the LLM to match against them, but only as a secondary check after the registry vocabulary. The LLM is told to use the vocabulary table first.
- **buildFallbackResult:** Now uses `postProcessCanonical` for registry resolution. Correct.
- **normalizeComponent/normalizeItem:** Now use `postProcessCanonical` to resolve canonicals and zones from the registry. Correct.

#### `src/lib/foodStatusThresholds.ts`

- **Claimed:** 506 lines. **Actual:** 159 lines. Dramatically reduced.
- **Problem 1 (DEFAULT_FOOD_ZONES):** RESOLVED. Deleted. Only a comment remains explaining the removal.
- **Problem 2 (defaultZoneForFood):** RESOLVED. Deleted.
- **Problem 3 (DEFAULT_FOOD_CATEGORIES / CATEGORY_KEYWORD_RULES / defaultCategoryForFood):** RESOLVED. Deleted.
- **Problem 4 (LineCategory type):** RESOLVED. `LineCategory` was deleted from `domain.ts`. The comment in `foodStatusThresholds.ts` says it's "defined in src/types/domain.ts" — this is now a stale comment; the type no longer exists there. It also references `foodCategoryMapping.ts` which was deleted.
- **Remaining contents:** Only threshold constants (`MIN_RESOLVED_TRIALS`, `BRISTOL_HARD_UPPER`, `BRISTOL_LOOSE_LOWER`, `RISKY_BAD_COUNT`, `WATCH_BAD_COUNT`), Bristol math (`computeBristolAverage`, `classifyConsistency`), zone utilities (`clampZone`, `legacyStageToZone`), and the `Zone` type. All correct and stable.
- **Note:** The `Zone` type still exists here as `1 | 2 | 3`, duplicating `FoodZone` from `foodRegistry.ts`. This was flagged in the original assessment but remains unresolved.

#### `src/lib/foodEvidence.ts`

- **Claimed:** 706 lines. **Actual:** 705 lines. Essentially unchanged.
- **Problem 1 (buildFoodTrials uses normalizeFoodName, not registry):** STILL PRESENT. Lines 198-200 still use `normalizeFoodName(rawCanonical)` / `normalizeFoodName(name)` without any registry lookup. The registry canonicalization path is not used here.
- **Problem 2 (normalizeAssessmentRecord uses normalizeFoodName):** STILL PRESENT. Line 696 still uses `normalizeFoodName(food)` without registry resolution.
- **Bayesian math:** Untouched and correct, as described.
- **toLegacyFoodStatus:** Present and correct.

#### `src/lib/analysis.ts`

- **Claimed:** ~886 lines. **Actual:** 885 lines. Essentially unchanged.
- **Problem 1 (BRAT_BASELINES):** STILL PRESENT. The four entries are: `"banana"`, `"white rice"`, `"plain white toast"`, `"applesauce"`. Registry canonicals are `"banana"` (matches), `"white rice"` (matches), `"white bread"` (mismatch — BRAT says `"plain white toast"`), and `"stewed apple"` (mismatch — BRAT says `"applesauce"`, though `"applesauce"` is a registry example, not the canonical).
- **Problem 2 (FoodStat.key comment):** Still says "canonical name (from LLM or legacy normalization)". Accurate description of reality.
- **Problem 3 (zone filtering from recoveryStage):** The grep for `recoveryStage` or `zone filtering` in `analysis.ts` returned no matches. This claim in the original document appears to be wrong or was about a different mechanism. The file does not directly read `recoveryStage` from log data for zone filtering.

#### `convex/foodLibrary.ts`

- **Claimed:** 676 lines. **Actual:** 735 lines. Grew by ~60 lines.
- **Problem 1 (normalizeCanonicalName):** STILL PRESENT. The simple `toLowerCase().trim().replace(/\s+/g, " ")` function remains on line 17-19, used in 6 places throughout the file.
- **Problem 2 (cross-boundary import):** STILL PRESENT. Line 3-10 imports `buildFoodEvidenceResult`, `FoodEvidenceLog`, `HabitLike`, `normalizeAssessmentRecord`, `TransitCalibration`, `toLegacyFoodStatus` from `"../src/lib/foodEvidence"`.

#### `convex/data/ingredientTemplatesSeed.ts`

- **Claimed:** ~1600 lines. **Actual:** 1615 lines. Essentially unchanged.
- **Problem 1 (different canonical names):** STILL PRESENT. The seed still uses its own canonical names that don't all match the registry.
- **Problem 2 (1-10 stage system):** STILL PRESENT. The seed still uses stages 1-10.
- **Problem 3 (LineCategory):** STILL PRESENT. The seed defines its own local `LineCategory` type on line 10 as `"protein" | "veg" | "carb" | "fruit" | "fat" | "seasoning"`, which does not match the registry's `FoodGroup` (`"protein" | "carbs" | "fats" | "seasoning"`) or `FoodLine` types.

#### `src/lib/foodRegistry.ts`

- **Claimed:** ~104 foods. **Actual:** ~100 canonical entries (based on `canonical:` count), 2431 lines. The registry has grown substantially since the original assessment (which described it as new with ~104 foods). It now includes `FoodGroup`, `FoodLine`, `lineOrder`, and the full hierarchy from Phase 2.5.

#### `src/lib/foodCanonicalization.ts`

- **Exists:** Yes, 154 lines. Provides `canonicalizeKnownFoodName` and re-exports registry functions. Working correctly as described in the migration plan.

#### `src/lib/foodLlmCanonicalization.ts`

- **Claimed in "What still needs to be built":** This file is listed as not yet existing. **Actual:** It exists (218 lines) and is complete. Provides `buildFoodParseSystemPrompt` and `postProcessCanonical`. Already imported and used by `foodParsing.ts`.

#### `src/lib/foodNormalize.ts`

- **Exists:** Yes, 194 lines. Contains `normalizeFoodName` and `formatFoodDisplayName`. Correct as described.

#### `src/lib/foodCategoryMapping.ts`

- **Referenced in staleness note and thresholds comment.** **Actual:** DELETED. Does not exist. The comment in `foodStatusThresholds.ts` (line 158-159) still references it, which is stale.

#### `LineCategory` in `src/types/domain.ts`

- **Referenced in original Problem 4 of foodStatusThresholds.** **Actual:** DELETED from `domain.ts`. Only exists as a local type in `ingredientTemplatesSeed.ts`.

### Summary of what the document got wrong (now stale)

1. `foodParsing.ts` — all 4 problems are resolved. The file is 311 lines, not 427.
2. `foodStatusThresholds.ts` — all 4 problems are resolved. The file is 159 lines, not 506.
3. `foodLlmCanonicalization.ts` — listed as "needs to be built" but already exists and is complete.
4. `foodCategoryMapping.ts` — referenced in staleness note as resolved; it was deleted entirely.
5. `LineCategory` — deleted from `domain.ts`, only survives in `ingredientTemplatesSeed.ts` locally.
6. `analysis.ts` Problem 3 — the claim about zone filtering reading `recoveryStage` from log data could not be verified in the current codebase.

### Summary of what the document got right (still accurate)

1. `foodEvidence.ts` Problems 1 and 2 — `buildFoodTrials` and `normalizeAssessmentRecord` still use `normalizeFoodName` instead of registry canonicalization. Phase 3 work.
2. `analysis.ts` Problem 1 — `BRAT_BASELINES` still has 2 mismatched canonical names.
3. `convex/foodLibrary.ts` Problems 1 and 2 — `normalizeCanonicalName` and cross-boundary import both still present. Phase 4 work.
4. `ingredientTemplatesSeed.ts` — all 3 problems still present. Phase 4 work.
5. The migration order (Phase 3 and Phase 4) remains valid and needed.
6. The "four competing sources of truth" table is partially resolved: SYSTEM_PROMPT and DEFAULT_FOOD_ZONES are fixed, but `normalizeCanonicalName` in Convex and `ingredientTemplatesSeed` canonical names remain competing sources.
7. The "two competing normalization functions" table is still accurate: `normalizeFoodName` (frontend) and `normalizeCanonicalName` (Convex) remain different and unreconciled.
