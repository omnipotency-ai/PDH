# Next Session Prompt 3: Execute Wave 1 — Bug Fixes + Data Layer Hook

> **Created:** 2026-04-08
> **Purpose:** Execute all 4 Wave 1 tasks (fix the 25 kcal bug, preserve units, fix display, create unified data hook).
> **Prerequisite:** Wave 0 (schema widening) complete — commit `33e17cc` on `odyssey/food-platform`.
> **Branch:** `odyssey/food-platform`

## Context

Wave 0 widened the schema. Wave 1 is the highest user-impact wave — it fixes the calorie calculation bug where "8 sl toast" shows 25 kcal instead of 751 kcal, and creates the Convex-first data bridge that all later waves depend on.

**Master plan:** `docs/plans/food-platform-master-plan.md`
**Quality backlog:** `docs/plans/quality-backlog.md`

## What to read first

1. `docs/plans/food-platform-master-plan.md` — Wave 1 section
2. `convex/_generated/ai/guidelines.md` — MANDATORY before writing any Convex code
3. `src/lib/nutritionUtils.ts` — `getEffectivePortionG` (line 93), `getItemMacros` (line 403)
4. `src/components/track/nutrition/nutritionLogging.ts` — `buildStagedNutritionLogData` (line 16)
5. `src/components/track/today-log/editors/FoodSubRow.tsx` — `buildPortionText` (line 164)
6. `shared/foodPortionData.ts` — `PortionData` interface, `FOOD_PORTION_DATA` map
7. `shared/foodRegistryData.ts` — types and `FOOD_REGISTRY`
8. `src/lib/__tests__/nutritionUtils.test.ts` — existing tests (700 lines)
9. `src/components/track/nutrition/__tests__/nutritionLogging.test.ts` — existing tests

## Wave 1 Tasks (4 tasks)

### W1-T01: Fix getEffectivePortionG to be unit-aware

**File:** `src/lib/nutritionUtils.ts`

**Current bug:** `getEffectivePortionG()` (line 93-101, private) treats `item.quantity` as grams regardless of `item.unit`. When a user logs "8 sl toast" with `quantity=8, unit="sl"`, it returns `8g` instead of `240g`. The same bug exists in `getItemMacros()` (line 403-428) which has its own inline copy of the broken logic.

**Fix — rewrite `getEffectivePortionG` to be unit-aware:**

```typescript
function getEffectivePortionG(
  item: FoodItem,
  customPortions?: Array<{ label: string; weightG: number }>,
): number {
  const qty = item.quantity != null && item.quantity > 0 ? item.quantity : null;
  const unit = item.unit?.toLowerCase().trim() ?? "";

  // Direct weight units — return as grams
  if (unit === "g" || unit === "")
    return qty ?? lookupDefaultPortionG(item.canonicalName);
  if (unit === "kg") return (qty ?? 0) * 1000;
  if (unit === "oz") return (qty ?? 0) * 28.3495;
  if (unit === "lb") return (qty ?? 0) * 453.592;

  // Volume units — return as ml (treated as grams for water-density foods)
  if (unit === "ml") return qty ?? lookupDefaultPortionG(item.canonicalName);
  if (unit === "l") return (qty ?? 0) * 1000;

  // Discrete units (sl, pc, cup, tbsp, tsp, etc.) — customPortions-first lookup chain
  if (qty != null) {
    // 1. Check customPortions for matching label
    if (customPortions) {
      const match = customPortions.find(
        (p) => normalizeUnitLabel(p.label) === normalizeUnitLabel(unit),
      );
      if (match) return qty * match.weightG;
    }
    // 2. Fallback to static FOOD_PORTION_DATA unitWeightG
    const portionData = FOOD_PORTION_DATA.get(item.canonicalName);
    if (portionData?.unitWeightG) return qty * portionData.unitWeightG;
    // 3. Final fallback: treat as grams (best guess)
    return qty;
  }

  return lookupDefaultPortionG(item.canonicalName);
}
```

**Helper to add:**

```typescript
function lookupDefaultPortionG(canonicalName: string): number {
  return FOOD_PORTION_DATA.get(canonicalName)?.defaultPortionG ?? 0;
}

function normalizeUnitLabel(label: string): string {
  const l = label.toLowerCase().trim();
  // Map common abbreviations to canonical forms
  const UNIT_ALIASES: Record<string, string> = {
    sl: "slice",
    slices: "slice",
    slice: "slice",
    pc: "piece",
    pcs: "piece",
    pieces: "piece",
    piece: "piece",
    cup: "cup",
    cups: "cup",
    tbsp: "tablespoon",
    tablespoon: "tablespoon",
    tablespoons: "tablespoon",
    tsp: "teaspoon",
    teaspoon: "teaspoon",
    teaspoons: "teaspoon",
  };
  return UNIT_ALIASES[l] ?? l;
}
```

**Then refactor `getItemMacros` (line 403)** to call `getEffectivePortionG(item)` instead of its inline copy. Remove the duplicated logic.

**Export `getEffectivePortionG`** — it will be needed by `buildPortionText` in W1-T03.

**Tests to add** in `src/lib/__tests__/nutritionUtils.test.ts`:

```
describe("getEffectivePortionG — unit-aware", () => {
  test("8 sl toast -> 240g (via unitWeightG=30)", ...)  // static fallback
  test("2 pc egg -> 120g (via unitWeightG=60)", ...)
  test("quantity in grams passes through", ...)
  test("kg converts correctly", ...)
  test("ml passes through", ...)
  test("l converts correctly", ...)
  test("customPortions override static data", ...)
  test("unknown unit falls back to quantity as grams", ...)
  test("no quantity falls back to defaultPortionG", ...)
})

describe("getItemMacros — uses shared getEffectivePortionG", () => {
  test("8 sl toast -> ~751 kcal (not 25)", ...)
})
```

**Critical acceptance test:** `{ canonicalName: "toast", quantity: 8, unit: "sl" }` must return `portionG >= 240` and calories ~751 (not 25).

---

### W1-T02: Fix buildStagedNutritionLogData to preserve units

**File:** `src/components/track/nutrition/nutritionLogging.ts`

**Current bug (line 16-29):** Always stores `quantity: item.portionG` and `unit: "g"` (or `"ml"`). When a StagedItem has `naturalUnit="slice"` and `unitWeightG=30`, the log discards the discrete unit and stores `{ quantity: 240, unit: "g" }` instead of `{ quantity: 8, unit: "sl" }`.

**Fix:** When StagedItem has a naturalUnit, store the discrete quantity and unit abbreviation. Also pass `productId` if available (populating the W0-T03 schema field).

```typescript
export function buildStagedNutritionLogData(
  stagedItems: ReadonlyArray<StagedItem>,
  mealSlot: MealSlot,
): FoodLogData {
  return {
    mealSlot,
    items: stagedItems.map((item) => {
      // If the item has a natural unit and we can derive the count, store discrete
      if (item.naturalUnit && item.unitWeightG && item.unitWeightG > 0) {
        const count = Math.round(item.portionG / item.unitWeightG);
        const unitAbbrev = abbreviateUnit(item.naturalUnit);
        return {
          canonicalName: item.canonicalName,
          parsedName: item.displayName,
          quantity: count,
          unit: unitAbbrev,
          ...(item.productId ? { productId: item.productId } : {}),
        };
      }
      // Otherwise store as grams/ml
      return {
        canonicalName: item.canonicalName,
        parsedName: item.displayName,
        quantity: item.portionG,
        unit: item.isLiquid ? "ml" : "g",
        ...(item.productId ? { productId: item.productId } : {}),
      };
    }),
  };
}
```

**Helper to add (or co-locate in a shared unit utils file):**

```typescript
function abbreviateUnit(naturalUnit: string): string {
  const l = naturalUnit.toLowerCase().trim();
  const ABBREVS: Record<string, string> = {
    slice: "sl",
    "1 slice": "sl",
    piece: "pc",
    "1 piece": "pc",
    "medium egg": "pc",
    "1 medium egg": "pc",
    cup: "cup",
    tablespoon: "tbsp",
    teaspoon: "tsp",
  };
  return ABBREVS[l] ?? l;
}
```

**Note:** The `StagedItem` type (in `useNutritionStore.ts`) already has `naturalUnit?: string` and `unitWeightG?: number`. It does NOT yet have `productId`. Add `productId?: string` to StagedItem type — this will be populated in a later wave when the user selects from their product catalog.

**Tests to update** in `src/components/track/nutrition/__tests__/nutritionLogging.test.ts`:

```
test("StagedItem with naturalUnit stores discrete quantity and unit", ...)
  // input: { portionG: 240, naturalUnit: "slice", unitWeightG: 30, ... }
  // expected: { quantity: 8, unit: "sl" }

test("StagedItem without naturalUnit stores grams", ...)
  // existing behavior preserved

test("productId is included when present", ...)
```

---

### W1-T03: Fix buildPortionText display for discrete units

**File:** `src/components/track/today-log/editors/FoodSubRow.tsx`

**Current bug (line 164-198):** When `unit` is a non-standard abbreviation like `"sl"`, the function returns `"8sl"` — no space, no expansion to full word, no gram equivalent.

**Fix:** Create a `UNIT_DISPLAY_MAP` and update `buildPortionText` to produce human-readable output like `"8 slices (240g)"`.

```typescript
const UNIT_DISPLAY_MAP: Record<string, { singular: string; plural: string }> = {
  sl: { singular: "slice", plural: "slices" },
  pc: { singular: "piece", plural: "pieces" },
  cup: { singular: "cup", plural: "cups" },
  tbsp: { singular: "tbsp", plural: "tbsp" },
  tsp: { singular: "tsp", plural: "tsp" },
};
```

Update the "any other non-empty unit" branch (around line 183):

```typescript
// Was: return `${qty}${unit}`;
// Now:
const display = UNIT_DISPLAY_MAP[unit];
if (display) {
  const label = qty === 1 ? display.singular : display.plural;
  return `${qty} ${label} (${Math.round(effectivePortionG)}g)`;
}
return `${qty} ${unit} (${Math.round(effectivePortionG)}g)`;
```

**Note:** `effectivePortionG` is already passed as a parameter to `buildPortionText`. It comes from `getItemMacros(item).portionG` which will now be unit-aware thanks to W1-T01.

**Test:** Check FoodSubRow renders "8 slices (240g)" for a log entry with `quantity: 8, unit: "sl"`, and that effectivePortionG reflects the correct gram weight.

---

### W1-T04: Create useFoodData hook (Convex-first, static fallback)

This task has two parts: a server-side Convex query and a client-side hook.

#### Part A: Server-side `convex/search.ts:unifiedFoodSearch`

**New file:** `convex/search.ts`

Create a Convex query that merges results from multiple sources server-side:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const unifiedFoodSearch = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    const results: UnifiedFoodResult[] = [];
    const seen = new Set<string>();

    // 1. Search ingredientProfiles (user's products) — highest priority
    const userProducts = await ctx.db
      .query("ingredientProfiles")
      .filter((q) => q.neq(q.field("canonicalName"), undefined))
      .collect();
    // Filter client-side by query match (Convex doesn't support LIKE)
    const queryLower = args.query.toLowerCase();
    for (const p of userProducts) {
      if (
        p.canonicalName.toLowerCase().includes(queryLower) ||
        p.productName?.toLowerCase().includes(queryLower)
      ) {
        if (!seen.has(p.canonicalName)) {
          seen.add(p.canonicalName);
          results.push({
            canonicalName: p.canonicalName,
            source: "user" as const,
            productName: p.productName,
            profileId: p._id,
          });
        }
      }
    }

    // 2. Search clinicalRegistry — second priority
    const clinicalEntries = await ctx.db.query("clinicalRegistry").collect();
    for (const entry of clinicalEntries) {
      if (entry.canonicalName.toLowerCase().includes(queryLower)) {
        if (!seen.has(entry.canonicalName)) {
          seen.add(entry.canonicalName);
          results.push({
            canonicalName: entry.canonicalName,
            source: "clinical" as const,
            zone: entry.zone,
            category: entry.category,
          });
        }
      }
    }

    return results.slice(0, limit);
  },
});

// Also: lookupFood query for single-food lookup by canonicalName
export const lookupFood = query({
  args: { canonicalName: v.string() },
  handler: async (ctx, args) => {
    // 1. Check user's ingredientProfiles first
    const userProfile = await ctx.db
      .query("ingredientProfiles")
      .filter((q) => q.eq(q.field("canonicalName"), args.canonicalName))
      .first();
    if (userProfile) {
      return { source: "user" as const, profile: userProfile };
    }

    // 2. Check clinicalRegistry
    const clinical = await ctx.db
      .query("clinicalRegistry")
      .withIndex("by_canonicalName", (q) =>
        q.eq("canonicalName", args.canonicalName),
      )
      .first();
    if (clinical) {
      return { source: "clinical" as const, entry: clinical };
    }

    return null;
  },
});
```

**Important:** The clinicalRegistry table is empty until W2 seeds it. The query must gracefully handle empty results — the static fallback in the hook covers this.

#### Part B: Client-side `src/hooks/useFoodData.ts`

**New file:** `src/hooks/useFoodData.ts`

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FOOD_REGISTRY } from "@/shared/foodRegistryData";
import { FOOD_PORTION_DATA } from "@/shared/foodPortionData";
import Fuse from "fuse.js";

// Fuse index for static fallback (built once)
const fuse = new Fuse(FOOD_REGISTRY, {
  keys: ["canonical", "examples"],
  threshold: 0.4,
});

export function useFoodSearch(query: string) {
  // Convex query — returns empty until W2 seeds data
  const convexResults = useQuery(
    api.search.unifiedFoodSearch,
    query.length >= 2 ? { query, limit: 30 } : "skip",
  );

  // Static fallback — always available
  const staticResults =
    query.length >= 2
      ? fuse.search(query, { limit: 20 }).map((r) => ({
          canonicalName: r.item.canonical,
          source: "static" as const,
          zone: r.item.zone,
          category: r.item.category,
        }))
      : [];

  // Merge: Convex results first, then static results not already in Convex results
  if (convexResults && convexResults.length > 0) {
    const seen = new Set(convexResults.map((r) => r.canonicalName));
    const backfill = staticResults.filter((r) => !seen.has(r.canonicalName));
    return { results: [...convexResults, ...backfill], isLoading: false };
  }

  return { results: staticResults, isLoading: convexResults === undefined };
}

export function useFoodLookup(canonicalName: string | null) {
  const convexResult = useQuery(
    api.search.lookupFood,
    canonicalName ? { canonicalName } : "skip",
  );

  // Static fallback
  const staticEntry = canonicalName
    ? FOOD_REGISTRY.find((e) => e.canonical === canonicalName)
    : null;
  const portionData = canonicalName
    ? FOOD_PORTION_DATA.get(canonicalName)
    : null;

  return {
    convex: convexResult,
    static: staticEntry,
    portionData,
    isLoading: convexResult === undefined,
  };
}
```

**Note:** This hook is NOT wired into the staging flow yet — that happens in W5/W6. For now it's a standalone hook that later waves import. But DO write tests for it.

**Tests:** Create `src/hooks/__tests__/useFoodData.test.ts`:

- `useFoodSearch` returns static results when Convex returns empty/undefined
- `useFoodSearch` merges Convex + static results without duplicates
- `useFoodLookup` returns static fallback when Convex returns null
- Query skips when input is too short (< 2 chars)

---

## Execution order

Tasks have dependencies:

```
W1-T01 (getEffectivePortionG) -> W1-T02 (buildStagedNutritionLogData)
W1-T01 -> W1-T03 (buildPortionText)
W1-T04 (useFoodData) is independent — can run in parallel with T01-T03
```

**Phase 1:** W1-T01 + W1-T04 in parallel
**Phase 2:** W1-T02 + W1-T03 in parallel (both depend on T01)

## Verification

After all 4 tasks:

```bash
bun run format           # clean
bun run lint:fix         # clean
bun run typecheck        # zero errors
bun run test             # all tests pass including new ones
bun run build            # clean
```

**Smoke test (manual via Claude-in-Chrome on localhost:3005):**

1. Log "8 sl toast" -> calorie display should show ~751 kcal (not 25)
2. Check Today's Log -> should display "8 slices (240g)" not "8sl"

Then commit:

```
feat(nutrition): Wave 1 — unit-aware portions, preserved units, unified food data hook

- Fix getEffectivePortionG to handle sl/pc/cup/tbsp/tsp/kg/oz/lb/ml/l
- Fix buildStagedNutritionLogData to preserve discrete units in logs
- Fix buildPortionText to display "8 slices (240g)" not "8sl"
- Create useFoodData hook with Convex-first, static fallback
- Create convex/search.ts with unifiedFoodSearch + lookupFood queries
```

## After this session

Update tracking docs:

- Mark W1-T01 through W1-T04 as complete in `docs/WORK-QUEUE.md`
- Add WIP entry with commit hash
- Write next session prompt for Wave 2 (seed data + migration)
- Next up: Wave 2 (clinicalRegistry seed, ~30 foods, meal templates, slot tagging)
