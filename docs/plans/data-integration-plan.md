# Data Integration Plan

> Ties together the 4 build waves for food logging, filter bar, user data, and nutrition enrichment.
> Defines the shared data layer, wave dependencies, and handoff points.

## Wave Overview

| Wave                        | Scope                                                                                          | PRD                   | Dependencies                                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1: Meal Logging**         | Recipes, quick-log by slot, favourites, staging area, nutrition label capture                  | `meal-logging.md`     | None — builds on existing `foodLibrary` + `foodParsing` pipeline                                                                                                |
| **2: Filter Bar**           | Composable filter bar on Patterns page using static classification + digestion risk data       | `filter-prompt.md`    | None — static data exists in `shared/foodRegistry.ts` + `shared/foodRegistryData.ts` (types). User-specific fields like status and nutrition come in Waves 3-4. |
| **3: Live User Data**       | Wire `ingredientExposures` + `ingredientOverrides` to filter; expand status enum               | (section in this doc) | Waves 1 + 2                                                                                                                                                     |
| **4: Nutrition Enrichment** | Batch-populate `ingredientProfiles.nutritionPer100g` via OpenFoodFacts; wire nutrition filters | (section in this doc) | Wave 3                                                                                                                                                          |

**Waves 1 and 2 can run in parallel.** Different pages, different concerns.
**Waves 3 and 4 are sequential** — each builds on the prior wave's data.

## Shared Data Layer

### Tables involved

```
foodLibrary          ← composites (existing)
recipes              ← NEW: named combos with slot-aware portions (Wave 1)
ingredientExposures  ← per-food-per-log denormalized index (existing, writes active)
ingredientProfiles   ← per-food metadata + nutrition (existing, unpopulated)
ingredientOverrides  ← user-set food status (existing, no UI)
ingredientNutritionApi ← OpenFoodFacts lookup action (existing, untriggered)
```

### Data flow

```
User taps chips / types / speaks
        │
        ▼
  Staging area (client state — Zustand)
        │
        ▼
  Log Food (commit)
        │
        ▼
  processLogInternal() ← existing pipeline
        │
        ├──▶ Creates log entry
        ├──▶ Writes ingredientExposures (per food per log)
        ├──▶ Triggers LLM canonicalization (existing)
        └──▶ Updates recipe frequency count (NEW)
```

## Wave 3: Live User Data in Filter

### What changes

1. **Exposure queries → filter** — The `allIngredients` query in `ingredientExposures.ts` already returns exposure count + lastSeenAt per canonical food. Wire this to the filter bar's "Status" dimension so users can distinguish "never tried" from "tried 5 times."

2. **Override enum expansion** — Current: `safe | watch | avoid`. Needed: `building | like | dislike | watch | avoid`. The 2x2 of tolerated × taste preference:
   - `building` = currently testing (auto-set based on exposure count threshold)
   - `like` = tolerated + tastes good
   - `dislike` = tolerated + doesn't taste good
   - `watch` = uncertain, needs more data
   - `avoid` = causes problems

3. **Baseline flag** — Optional "baseline" marker on control foods (stable enough to pair with new foods for testing). Stored on `ingredientOverrides`.

4. **UI for overrides** — Simple inline action on the Patterns food table to set/change a food's status. No separate management page needed.

### Status enum migration plan

The codebase currently has multiple status-related enums that need reconciliation:

| Location                         | Current values                                                                       | Purpose                 |
| -------------------------------- | ------------------------------------------------------------------------------------ | ----------------------- |
| `ingredientOverrides` schema     | `safe \| watch \| avoid`                                                             | User-set manual status  |
| `foodPrimaryStatusValidator`     | `building \| safe \| watch \| avoid`                                                 | Computed primary status |
| `foodTrialSummary.currentStatus` | `testing \| safe \| safe-loose \| safe-hard \| watch \| risky \| culprit \| cleared` | Detailed trial status   |
| `foodAssessments.verdict`        | `culprit \| safe \| watch \| next_to_try \| avoid \| trial_next`                     | AI assessment verdict   |

**Proposed migration:**

- `ingredientOverrides.status`: expand to `building | like | dislike | watch | avoid`. Existing `safe` values migrate to `like` (assumption: if user marked it safe, they tolerate it and are okay with eating it).
- `foodPrimaryStatusValidator`: expand to match (`building | like | dislike | watch | avoid`). Existing `safe` values migrate to `like`.
- `foodTrialSummary` and `foodAssessments`: **no changes**. These are AI/computed statuses with different granularity. They feed into the override system but are not user-facing in the same way. The filter bar's "status" column reads from `ingredientOverrides` (user-set) with `foodTrialSummary` as a secondary signal.

A Convex migration mutation should be written to update existing `safe` → `like` values in both `ingredientOverrides` and any `foodTrialSummary` records that use `primaryStatus`.

### Handoff from Wave 2

Wave 2 builds the filter bar structure with static data. Wave 3 adds dynamic columns (status, exposure count) that query live user data.

## Wave 4: Nutrition Enrichment

### What changes

1. **Batch population job** — A Convex action that iterates `ingredientExposures` canonical names, looks each up via `ingredientNutritionApi` (OpenFoodFacts), and upserts into `ingredientProfiles.nutritionPer100g`. Run manually or on schedule.

2. **Nutrition label capture** — From Wave 1's meal logging PRD: user photographs a nutrition label, AI extracts data, saves to `ingredientProfiles`. This is the manual enrichment path for products not in OpenFoodFacts.

3. **Wire nutrition filters** — The filter bar (from Wave 2) gets numeric filters for kcal, protein, fat, fibre, etc. These read from `ingredientProfiles.nutritionPer100g`.

### Handoff from Wave 3

Wave 3 ensures user status data flows to the filter. Wave 4 adds the nutrition dimension alongside it.

## Orchestration Notes

- One agent/orchestrator per wave, not one mega-orchestrator
- Each wave's PRD is self-contained
- Waves 1 and 2 produce independent deliverables that don't conflict (different pages, different files)
- Wave 3 starts only after both Wave 1 (exposures are accumulating from meal logging) and Wave 2 (filter bar exists to receive the data) are complete
- Wave 4 starts only after Wave 3 (override enum is expanded, filter bar can show status)
