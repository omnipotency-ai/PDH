# Fix Food Logging Pipeline

## Context

The food logging pipeline has three interconnected bugs that make the raw-text input path produce wrong results. The user types "8 sl toast" in the NutritionCard, it logs, but shows **25 kcal instead of 751 kcal** and displays as "8sl." instead of "8 slices (240g)". Meanwhile, the staging path (search -> select -> confirm) works but **loses the original unit** -- "8 slices" becomes "240g" in the log. Additionally, the generic registry data (313 kcal/100g toast) doesn't match the user's actual bread (Bon Preu: 259 kcal/100g, 31.5g/slice).

## Root Causes

### Bug 1: `getEffectivePortionG()` ignores units

- **File**: `src/lib/nutritionUtils.ts:93-101`
- When item has `{ quantity: 8, unit: "sl" }`, returns `8` (treating as grams)
- Should return `8 x 30g = 240g` using `FOOD_PORTION_DATA.unitWeightG`
- Affects: `calculateTotalCalories`, `calculateTotalMacros`, `getItemMacros`

### Bug 2: Staging path discards original units

- **File**: `src/components/track/nutrition/nutritionLogging.ts:22-28`
- `buildStagedNutritionLogData` stores `{ quantity: item.portionG, unit: "g" }`
- Loses "8 slices" context -- log shows "240g Toast" not "8 slices (240g) Toast"

### Bug 3: Display formatting for discrete units

- **File**: `src/components/track/today-log/editors/FoodSubRow.tsx` (buildPortionText)
- Renders `"8sl"` (no space, no expansion, no gram equivalent)
- Should render `"8 slices (240g)"`

### Issue 4: Generic registry data vs real products

- Registry toast: 313 kcal/100g, 30g/slice
- User's Bon Preu bread: 259 kcal/100g, ~31.5g/slice (820g / 26 slices)
- No mechanism for per-user nutritional overrides

---

## Plan -- Iterative Phases

### Phase 1: Fix unit-aware portion calculation (highest impact)

**What**: Make `getEffectivePortionG()` convert discrete units to grams.

**File**: `src/lib/nutritionUtils.ts`

**Logic**:

```
getEffectivePortionG(item):
  if no quantity -> use defaultPortionG

  unit = item.unit (normalized)
  if unit is "g" or empty -> return quantity as-is
  if unit is "kg" -> quantity x 1000
  if unit is "oz" -> quantity x 28.35
  if unit is "lb" -> quantity x 453.6
  if unit is "ml" -> quantity (approximate)
  if unit is "l" -> quantity x 1000

  // Discrete units (sl, pc, cup, tbsp, tsp, sm, med, lg, xl)
  look up FOOD_PORTION_DATA[canonicalName].unitWeightG
  if found -> return quantity x unitWeightG
  else -> return quantity (best guess)
```

**Also fix**: `getItemMacros()` (~line 403) duplicates the same broken logic. Make it call the shared function.

**Impact**: Fixes all calorie/macro calculations for server-parsed items. Zero data migration.

**Test**: `{ canonicalName: "toast", quantity: 8, unit: "sl" }` -> portionG=240, calories=751

---

### Phase 2: Fix portion display text

**What**: Expand unit abbreviations and show gram equivalents in timeline.

**File**: `src/components/track/today-log/editors/FoodSubRow.tsx`

**Unit display map**: `sl -> slice/slices`, `pc -> piece/pieces`, etc.

**Output**: `"8 slices (240g)"` for discrete units, `"200g"` for gram units.

---

### Phase 3: Preserve original units in staging path

**What**: Store user's original unit instead of converting to grams.

**File**: `src/components/track/nutrition/nutritionLogging.ts:22-28`

Store `{ quantity: 8, unit: "sl" }` instead of `{ quantity: 240, unit: "g" }` when item has a naturalUnit. Phase 1's conversion handles calorie calc correctly.

**Also check**: `useNutritionStore.ts` -- `StagedItem` / `createStagedItem` may need `naturalUnit` and `unitWeightG` fields.

---

### Phase 4: Custom food nutritional data (scope TBD)

**What**: Per-user nutritional overrides for specific products.

**User's need**: Bon Preu bread = 820g/26 slices (~31.5g/slice), 259 kcal/100g, carbs 46, sugars 2.6, fiber 3.3, protein 10, salt 1.2.

**Options to discuss**:

- A) Extend `foodAliases` table with optional nutrition fields
- B) Defer until phases 1-3 are solid

---

## Execution Order

```
Phase 1 (unit conversion fix)       <- highest impact, standalone
Phase 2 (display fix)               <- small, depends on Phase 1 logic
Phase 3 (staging unit preservation) <- changes data shape, needs Phase 1
Phase 4 (custom food data)          <- scope TBD
```

Each phase: independently committable and testable.

## Key Files

- `src/lib/nutritionUtils.ts` -- getEffectivePortionG, getItemMacros, calculateTotalCalories
- `src/components/track/nutrition/nutritionLogging.ts` -- buildStagedNutritionLogData
- `src/components/track/today-log/editors/FoodSubRow.tsx` -- buildPortionText, ItemPortionCalorie
- `shared/foodPortionData.ts` -- FOOD_PORTION_DATA (unitWeightG, caloriesPer100g)
- `shared/foodParsing.ts` -- MEASURE_UNIT_MAP (unit abbreviations)
- `src/types/domain.ts:317` -- FoodItem interface
- `src/components/track/nutrition/useNutritionStore.ts` -- StagedItem, createStagedItem

## Verification (per phase)

1. `bun run typecheck` + `bun run build` -- clean
2. Type "8 sl toast" in NutritionCard -> Enter -> verify 751 kcal in timeline
3. Stage 8 slices toast via search -> verify same calories + unit preserved
4. Visual check via Claude-in-Chrome on localhost:3005




# Fix Food Logging Pipeline: Unit-Aware Portions
 
## Context
 
When a user types "8 sl toast", the parser correctly produces `{ quantity: 8, unit: "sl", canonicalName: "toast" }`. But `getEffectivePortionG()` ignores the unit and returns `8` (as grams) instead of `8 * 30g = 240g`. This cascades into wrong calories (25 kcal instead of 751 kcal), wrong macros, and wrong display ("8sl." instead of "8 slices (240g)"). The staging path (search -> select -> confirm) separately loses the original unit by converting everything to grams before storing.
 
## Data flow (before and after)
 
```
                         BEFORE                              AFTER
                         ──────                              ─────
 
  User types: "8 sl toast"
       │
  Parser: { qty: 8, unit: "sl", canonical: "toast" }
       │
  getEffectivePortionG ──► returns 8          ──►  returns 8 × 30 = 240
       │                                                │
  calculateTotalCalories   313 × 8/100 = 25 kcal       313 × 240/100 = 751 kcal
       │                                                │
  buildPortionText ──────► "8sl"              ──►  "8 slices (240g)"
 
 
  Staging path: user selects toast, portion = 60g (2 slices)
       │
  buildStagedNutritionLogData
       │
  BEFORE: { qty: 60, unit: "g" }   ──►  AFTER: { qty: 2, unit: "sl" }
       │                                          │
  Display: "60g"                          Display: "2 slices (60g)"
```
 
## Phase 1: Fix unit-aware portion calculation
 
**File**: `src/lib/nutritionUtils.ts`
 
### 1a. Rewrite `getEffectivePortionG` (lines 93-101)
 
The function currently returns `item.quantity` as-is. Add unit-based conversion:
 
```
getEffectivePortionG(item: FoodItem): number
  if no quantity or quantity <= 0 → fall back to defaultPortionG (existing behavior)
 
  normalize unit = (item.unit ?? "").toLowerCase().trim()
 
  // Weight units: direct conversion
  "g" or ""  → return quantity
  "kg"       → return quantity × 1000
  "oz"       → return quantity × 28.35
  "lb"       → return quantity × 453.6
 
  // Volume units: approximate as grams
  "ml"       → return quantity
  "l"        → return quantity × 1000
 
  // Discrete/measuring units: food-specific lookup
  look up FOOD_PORTION_DATA[item.canonicalName].unitWeightG
  if found  → return quantity × unitWeightG
  else      → return quantity  (best-effort fallback, same as current)
```
 
The set of "discrete/measuring units" that reach the lookup: `sl`, `pc`, `cup`, `tbsp`, `tsp`, `sm`, `med`, `lg`, `xl`, and any unrecognized string. This covers all MEASURE_UNIT_MAP and SIZE_UNIT_MAP outputs from the parser in `shared/foodParsing.ts`.
 
### 1b. Refactor `getItemMacros` (lines 403-428)
 
Currently duplicates the broken logic. Replace the inline portion resolution with a call to `getEffectivePortionG`:
 
```typescript
export function getItemMacros(item: FoodItem) {
  const canonical = item.canonicalName;
  if (canonical == null) return { ...ZERO_ITEM_MACROS };
  if (!FOOD_PORTION_DATA.has(canonical)) return { ...ZERO_ITEM_MACROS };
 
  const portionG = getEffectivePortionG(item);
  const macros = computeMacrosForPortion(canonical, portionG);
  return { ...macros, portionG };
}
```
 
This eliminates the duplicated code flagged in `docs/plans/archive/Worktree spec/2026-04-04/agent-02-report.md`.
 
### 1c. Add tests to `src/lib/__tests__/nutritionUtils.test.ts`
 
Add to existing `calculateTotalCalories` describe block:
- `{ canonicalName: "toast", quantity: 8, unit: "sl" }` → 751 kcal (8 × 30g × 313/100)
- `{ canonicalName: "toast", quantity: 2, unit: "sl" }` → 188 kcal
 
Add to existing `getItemMacros` describe block:
- `{ canonicalName: "toast", quantity: 8, unit: "sl" }` → portionG=240, calories=751
- `{ canonicalName: "toast", quantity: 1, unit: "sl" }` → portionG=30, calories=94
- `{ canonicalName: "white rice", quantity: 200, unit: "g" }` → portionG=200, calories=260 (regression guard)
- `{ canonicalName: "toast", quantity: 0.5, unit: "kg" }` → portionG=500, calories=1565
 
---
 
## Phase 2: Fix portion display text
 
**File**: `src/components/track/today-log/editors/FoodSubRow.tsx`
 
### 2a. Add unit display map (above `buildPortionText`)
 
```typescript
const UNIT_DISPLAY: Record<string, { one: string; many: string }> = {
  sl:   { one: "slice",  many: "slices"  },
  pc:   { one: "piece",  many: "pieces"  },
  cup:  { one: "cup",    many: "cups"    },
  tbsp: { one: "tbsp",   many: "tbsp"    },
  tsp:  { one: "tsp",    many: "tsp"     },
  sm:   { one: "small",  many: "small"   },
  med:  { one: "medium", many: "medium"  },
  lg:   { one: "large",  many: "large"   },
  xl:   { one: "XL",     many: "XL"      },
};
```
 
### 2b. Fix `buildPortionText` (line 180-183)
 
Current code for non-standard units:
```typescript
if (unit) {
  return `${qty}${unit}`;  // → "8sl"
}
```
 
Replace with:
```typescript
if (unit) {
  const display = UNIT_DISPLAY[unit];
  const label = display
    ? (qty === 1 ? display.one : display.many)
    : unit;  // unknown unit: show as-is
  const gramNote = effectivePortionG > 0 && effectivePortionG !== qty
    ? ` (${Math.round(effectivePortionG)}g)`
    : "";
  return `${qty} ${label}${gramNote}`;
}
```
 
Result: "8 slices (240g)" for discrete units, "200g" for gram units (handled earlier in the function).
 
---
 
## Phase 3: Preserve original units in staging path
 
**File**: `src/components/track/nutrition/nutritionLogging.ts`
 
### 3a. Add natural-unit-to-abbreviation map
 
```typescript
const NATURAL_UNIT_ABBR: Record<string, string> = {
  slice: "sl",
  cup: "cup",
  tbsp: "tbsp",
  tsp: "tsp",
};
```
 
Units not in this map (egg, banana, bowl, pot, carrot, etc.) default to `"pc"`.
 
### 3b. Fix `buildStagedNutritionLogData` (lines 22-28)
 
Current code always stores grams:
```typescript
quantity: item.portionG,
unit: item.isLiquid ? "ml" : "g",
```
 
Replace with:
```typescript
// Preserve natural unit when available (e.g., "2 slices" not "60g")
...(item.naturalUnit && item.unitWeightG && item.unitWeightG > 0
  ? {
      quantity: Math.round((item.portionG / item.unitWeightG) * 10) / 10,
      unit: NATURAL_UNIT_ABBR[item.naturalUnit] ?? "pc",
    }
  : {
      quantity: item.portionG,
      unit: item.isLiquid ? "ml" : "g",
    }),
```
 
Phase 1's `getEffectivePortionG` correctly converts back: count × unitWeightG = portionG. So calorie calculations stay correct regardless of which path produced the data.
 
---
 
## Phase 4: Custom food data (deferred)
 
Out of scope for this PR. The registry toast (313 kcal/100g, 30g/slice) vs user's Bon Preu bread (259 kcal/100g, 31.5g/slice) requires a per-user nutritional override mechanism. This belongs in a separate task once phases 1-3 are solid.
 
---
 
## Execution order and dependencies
 
```
Phase 1 ──► Phase 2
   │
   └──────► Phase 3
```
 
Phase 2 and 3 both depend on Phase 1 (correct gram calculation) but are independent of each other.
 
## Key files
 
| File | Change |
|------|--------|
| `src/lib/nutritionUtils.ts` | Rewrite `getEffectivePortionG`, refactor `getItemMacros` |
| `src/lib/__tests__/nutritionUtils.test.ts` | Add discrete-unit test cases |
| `src/components/track/today-log/editors/FoodSubRow.tsx` | Fix `buildPortionText` display |
| `src/components/track/nutrition/nutritionLogging.ts` | Preserve natural units in staging |
 
## Verification
 
1. `bun run typecheck` + `bun run build` clean
2. `bun run test` — existing tests pass, new unit tests pass
3. Manual: type "8 sl toast" in NutritionCard → 751 kcal in timeline, display "8 slices (240g)"
4. Manual: stage 2 slices toast via search → same calories, display shows "2 slices (60g)"
5. Manual: type "200g rice" → 260 kcal (regression check, gram path unchanged)
 

The user's needs have shifted significantly beyond the bug fix plan I drafted. Let me find the existing planning docs they referenced.


Read 4 files, searched 3 patterns
Read 4 files, searched 3 patterns

The user's request has changed significantly. You already have extensive planning docs:

PRD: docs/prd/2026-04-06-food-page-and-meal-system.md — covers Food page with search, favourites, filters, food detail editing (US-016), seed data (US-027), meal templates
Implementation plan: docs/plans/2026-04-06-food-page-and-meal-system.md — 7 waves from schema extension through seed data
Wave JSON files: Task breakdowns for waves 0-6
Your core request — custom food database with your macros, your portion sizes, inline editing — maps to parts of that plan, particularly:

US-016: Food detail editing (tap a food → edit calories, grams, macros, portion info)
US-027: Seed data (pre-populate your ~30 foods with accurate data)
Wave 5: Food Page (search, views, editing)
Wave 6: Seed Data
But the existing plan wraps this in a 7-wave restructure (new nav, Home page, Track simplification, etc.) that's much bigger than what you're describing.


Used a tool
Used a tool

Let me explore the codebase to understand what infrastructure already exists for user-editable food data, and what the wave plans specify.


Ran 3 agents
Ran 3 agents

Good — the exploration reveals a lot of existing infrastructure. Let me clarify scope before writing the plan, because the existing wave plans bundle food database management with a full app restructure (4-tab nav, Home page, Track simplification, Insights tab).


Used a tool
Used a tool

Good. Now I have clear direction:

Scope: Food DB + nav restructure (Waves 0-1, then Wave 5)
Data: Fully user-managed — move to Convex ingredientProfiles, away from static FOOD_PORTION_DATA
Bugs: Fix unit conversion alongside
Let me design the implementation plan.


Design food DB + nav plan
Design food DB + nav plan

The plan agent has finished. Let me read its output.


Ran 8 commands, read 2 files, searched code
Ran 8 commands, read 2 files, searched code

The plan agent explored extensively but didn't produce a final summary. I have more than enough context from my own exploration and the three explore agents to write the plan directly. Let me also check a few more key files to ensure accuracy.


Searched 8 patterns, read 5 files
Searched 8 patterns, read 5 files

Now I have a thorough understanding of every piece. Let me write the final plan.


Read a file, created a file
Read a file, created a file

The plan is complete. It covers six phases:

Schema extension — add portion fields to ingredientProfiles
Seed data — migrate static FOOD_PORTION_DATA into Convex
Food data layer — hook + context to replace static imports
Pipeline refactor + bug fixes — unit-aware calories, display fixes, all functions accept user data
Nav restructure — 4-tab layout
Food page — CRUD with inline editing

Finished plan
Finished plan

Good question. Let me clarify the roles of both data sources in the plan.

Currently the codebase has two distinct static data sources that serve different purposes:

FOOD_PORTION_DATA — nutrition per 100g + portion sizes (what you eat and how much)
FOOD_REGISTRY — clinical classification: zone (when to introduce), category, digestion metadata, texture
Let me look at how FOOD_REGISTRY is actually used to design this properly.


Searched 2 patterns, read 2 files
Searched 2 patterns, read 2 files

Great question. The plan needs to be explicit about the role of FOOD_REGISTRY vs ingredientProfiles. Let me trace its current usage and propose the mapping.

Current FOOD_REGISTRY usage (5 files):

Usage	File	Purpose
FOOD_REGISTRY_CANONICALS	useNutritionStore.ts	Validates food names before staging
LIQUID_CANONICALS	useNutritionStore.ts	Detects drinks for "ml" vs "g"
searchFoodRegistry() (Fuse.js)	useNutritionStore.ts	NutritionCard food search
COMMON_DRINKS filter	NutritionCard.tsx	Drink suggestions
"All" tab list	FoodFilterView.tsx	Browsable food list
LLM canonicalization prompt	foodLlmCanonicalization.ts	Name normalization
Zone/group/category	foodRegistryData.ts	Clinical classification
The key question is: after the refactor, when a user searches for food to log, do they search their own ingredientProfiles or FOOD_REGISTRY?


Used a tool
Used a tool

Perfect — this clarifies everything massively. Let me draw the full picture with diagrams. Let me first re-read the current plan and the full registry structure.


Read 4 files
Read 4 files

Now let me look at the FOOD_PORTION_DATA structure to understand the merge.


Explore FOOD_PORTION_DATA structure
Explore FOOD_PORTION_DATA structure
are you still researching


Are you still researching


Ruminating...
R
u
m
i
n
a
t
i
n
g
.
.
.



Excellent! Now I have a comprehensive view. Let me compile the thorough report:
## Thorough Exploration: Convex Food Schema and Backend
Show less
I've completed a comprehensive analysis of the food-related Convex schema and backend infrastructure. Here's what I found:
---
### 1. **`convex/schema.ts` — Food-Related Tables**
#### **`ingredientProfiles` Table**
- **Purpose**: User-specific customization layer for ingredients. Tracks personalized metadata beyond the registry.
- **Fields**:
  - `userId: string` — owner of the profile
  - `canonicalName: string` — normalized identifier (lowercase, trimmed)
  - `displayName: string` — custom display label
  - `tags: string[]` — user-supplied labels (normalized, sorted, deduplicated)
  - `foodGroup: FoodGroup | null` — one of: `"protein"`, `"carbs"`, `"fats"`, `"seasoning"`
  - `foodLine: FoodLine | null` — one of 11 sub-lines (e.g., `"meat_fish"`, `"eggs_dairy"`, `"vegetables"`, `"grains"`, `"fruit"`, `"oils"`, `"dairy_fats"`, `"nuts_seeds"`, `"sauces_condiments"`, `"herbs_spices"`, `"vegetable_protein"`)
  - `lowResidue: boolean | null` — post-op diet classification
  - `source: "manual" | "openfoodfacts" | null` — data provenance
  - `externalId: string | null` — third-party reference ID (e.g., OpenFoodFacts barcode)
  - `ingredientsText: string | null` — raw ingredient list
  - `nutritionPer100g: { kcal, fatG, saturatedFatG, carbsG, sugarsG, fiberG, proteinG, saltG }` — all `number | null`
  - `createdAt, updatedAt: number` — timestamps
- **Indexes**: `by_userId`, `by_userId_canonicalName`
#### **`foodLibrary` Table**
- **Purpose**: User-curated composite foods and custom ingredient groupings.
- **Fields**:
  - `userId: string`
  - `canonicalName: string` — normalized food name
  - `type: "ingredient" | "composite"` — atomic food or multi-ingredient meal
  - `ingredients: string[]` — array of canonical ingredient names
  - `createdAt: number`
- **Indexes**: `by_userId`, `by_userId_name`
- **Concurrency note**: Race conditions can create duplicates. The `list()` query deduplicates on read by keeping the earliest created entry.
#### **`profiles` Table**
- **Purpose**: User configuration and settings (1:1 per user).
- **Food-related fields**:
  - `foodPersonalisation: { cautionLevel, upgradeSpeed }` — exploration style (`"conservative"`, `"balanced"`, `"adventurous"`)
  - `knownFoods: string[] | undefined` — set of all canonical food names ever logged (optimizes "new foods" detection)
  - `foodFavourites: string[] | undefined` — bookmarked/starred foods
  - `nutritionGoals: { dailyCalorieGoal, dailyWaterGoalMl } | undefined`
- **Other fields**: `unitSystem`, `habits`, `fluidPresets`, `sleepGoal`, `healthProfile` (surgery type, age, gender), `aiPreferences`, `transitCalibration`, `encryptedApiKey`, `aiRateLimits`
- **Index**: `by_userId`
#### **Related Tables Used in Food Context**
- **`ingredientExposures`** — logs each ingredient exposure event (when food was eaten) with quantity, preparation, spice level
- **`ingredientOverrides`** — per-user overrides for ingredient status (`"safe"`, `"watch"`, `"avoid"`) with optional notes
- **`foodAssessments`** — AI verdicts on foods (culprit/safe/watch/avoid) with confidence and reasoning
- **`foodTrialSummary`** — aggregated trial status per food
- **`foodRequests`** — user submissions for new foods to add to registry
- **`logs`** — all user logs (food, liquid, fluid, habit, activity, digestion, weight) with nested food items
- **`foodEmbeddings`** — vector embeddings for semantic food matching (1536 dimensions)
---
### 2. **Convex CRUD Functions for Food Data**
#### **`convex/ingredientProfiles.ts`**
- **`list()`** (query) — Get all user's ingredient profiles, sorted by `updatedAt` DESC
- **`byIngredient(canonicalName)`** (query) — Fetch profile for a specific ingredient
- **`upsert(canonicalName, displayName?, tags?, lowResidue?, source?, externalId?, ingredientsText?, nutritionPer100g?, now)`** (mutation)
  - Creates or updates an ingredient profile
  - Merges partial nutrition updates with existing data
  - Derives `foodGroup` and `foodLine` from canonical name via `getCanonicalFoodProjection()`
  - Normalizes tags (lowercase, unique, sorted)
#### **`convex/foodLibrary.ts`**
- **`list()`** (query) — Get all user's food library entries; deduplicates on read
- **`addEntry(canonicalName, type, ingredients, createdAt)`** (mutation)
  - Inserts new composite food
  - Handles race condition deduplication
- **`updateEntry(canonicalName, type, ingredients, now)`** (mutation)
  - Upserts with auto-creation if missing
- **`addBatch(entries[], now)`** (mutation)
  - Bulk insert up to 100 entries with deduplication per entry
- **`mergeDuplicates(...)`** (action) — Multi-phase merge operation:
  - Phases rename across `foodAssessments`, `ingredientExposures`, `ingredientOverrides`, `ingredientProfiles`, `foodLibrary`, `logs`
  - Builds a merge map, resolves transitive merges, handles cycles
#### **`convex/ingredientOverrides.ts`**
- **`list()`** (query) — Get all user's overrides; deduplicates by keeping most-recently-updated per ingredient
- **`upsert(canonicalName, status, note?, now)`** (mutation)
  - Upserts override with sanitized input
  - Status: `"safe"`, `"watch"`, `"avoid"`
  - Note max 500 chars
- **`remove(canonicalName)`** (mutation) — Delete all overrides for an ingredient
#### **`convex/foodRequests.ts`**
- **`submitRequest(foodName, rawInput?, note?, logId?, itemIndex?, now)`** (mutation)
  - User request to add new food to registry
  - Includes optional link to originating log entry
#### **`convex/ingredientExposures.ts`**
- **`historyByIngredient(canonicalName, limit?)`** (query) — Recent exposures for a food
- **`allIngredients(limit?)`** (query) — Aggregated exposure counts grouped by canonical name
#### **`convex/profileMutations.ts`**
- **`replaceProfile(unitSystem, habits, fluidPresets?, sleepGoal?, healthProfile?, aiPreferences?, foodPersonalisation?, transitCalibration?, now)`** (mutation)
  - Full profile replacement (excludes `nutritionGoals` and `foodFavourites` to prevent overwrites)
- **`patchProfile(..., foodPersonalisation?, foodFavourites?, ...)`** (mutation)
  - Partial update; can set `foodFavourites` independently
- **`getProfile()`** (query) — Fetch current user's profile
#### **`convex/profiles.ts`** (AI rate limiting)
- **`getAiRateLimits()`** (internal query) — Read rate limit state
- **`updateAiRateLimit(featureType, calledAt)`** (internal mutation) — Track DrPoo/Coaching call times
---
### 3. **`shared/foodPortionData.ts` — Static Portion Reference Data**
**Structure**: A `PortionData` interface that describes static nutrition and portion reference for each canonical food.
```typescript
interface PortionData {
  defaultPortionG: number;           // Initial slider weight
  naturalUnit?: string;              // e.g., "1 medium egg", "1 slice"
  unitWeightG?: number;              // Weight of one natural unit
  
  // Nutrition per 100g (cooked weight where relevant)
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  sugarsPer100g?: number;
  fiberPer100g?: number;             // Displayed as "Fibre" in UI
  
  source: "usda" | "openfoodfacts" | "estimated";  // Provenance
}
```
**File structure**: Organized by zone/subzone (Zone 1A liquids, Zone 1B soft solids, Zone 2, Zone 3), with each zone containing a `PortionRecord` (Map-like structure keyed by canonical name). At file end, all zones are merged into a single exported `FOOD_PORTION_DATA` map.
**Sources cited**: USDA FoodData Central, Open Food Facts, estimated for ambiguous entries.
---
### 4. **`shared/foodRegistryData.ts` — Canonical Food Registry**
**`FoodRegistryEntry` Type** (discriminated union):
```typescript
interface FoodRegistryEntryBase extends FoodDigestionMetadata {
  canonical: string;                        // Tracking unit ("rice", "water", etc.)
  zone: 1 | 2 | 3;
  subzone?: "1A" | "1B";                   // Only for Zone 1
  category: FoodCategory;                   // 16 categories
  subcategory: FoodSubcategory;            // 27 subcategories
  macros: readonly ("protein" | "carbohydrate" | "fat")[];
  examples: readonly string[];              // User-phrase mappings
  group: FoodGroup;                        // "protein" | "carbs" | "fats" | "seasoning"
  line: FoodLine;                          // 11 sub-lines (meat_fish, vegetables, etc.)
  lineOrder: number;                        // Exploration order (1=try first)
  notes?: string;                          // Clinical/contextual notes
}
```
**`FoodDigestionMetadata`** (optional per-food):
- `osmoticEffect, totalResidue, fiberTotalApproxG, fiberInsolubleLevel, fiberSolubleLevel, gasProducing, dryTexture, irritantLoad, highFatRisk, lactoseRisk`
**Food Hierarchy**:
- 4 **groups**: `protein`, `carbs`, `fats`, `seasoning`
- 11 **lines** (sub-categories):
  - Protein: `meat_fish`, `eggs_dairy`, `vegetable_protein`
  - Carbs: `grains`, `vegetables`, `fruit`
  - Fats: `oils`, `dairy_fats`, `nuts_seeds`
  - Seasoning: `sauces_condiments`, `herbs_spices`
**Clinical Basis**: <2g fiber per serving for Zones 1–2; no skins/seeds/hulls; no strong spices (NHS low-residue diet, UCSF ileostomy guide, Leeds Teaching Hospitals).
---
### 5. **Existing Convex Functions for Food Editing/Creating**
#### **Primary CRUD**
| Function | Type | Purpose |
|----------|------|---------|
| `ingredientProfiles.upsert()` | Mutation | Create/update ingredient metadata (nutrition, tags, source) |
| `foodLibrary.addEntry()` | Mutation | Add composite food or custom ingredient group |
| `foodLibrary.updateEntry()` | Mutation | Update or insert composite food |
| `foodLibrary.addBatch()` | Mutation | Bulk add up to 100 entries |
| `ingredientOverrides.upsert()` | Mutation | Set safe/watch/avoid status for ingredient |
| `foodRequests.submitRequest()` | Mutation | Submit user request to add new food to registry |
#### **Merging & Deduplication**
- **`foodLibrary.mergeDuplicates()`** — Comprehensive multi-phase rename:
  1. Phase 1: Rename foodAssessments
  2. Phase 2: Rename ingredientExposures  
  3. Phase 3: Rename ingredientOverrides
  4. Phase 4: Merge ingredientProfiles (conflict resolution)
  5. Phase 5: Merge/rename foodLibrary ingredients
  6. Phase 6: Rebuild foodTrialSummaries
---
### 6. **Relationship Between Static Registry (`shared/`) and Dynamic Convex Data (`convex/`)**
**Static Registry** (`shared/foodRegistryData.ts` + `shared/foodPortionData.ts`):
- Source of truth for **canonical food definitions** (zone, macros, examples, clinical metadata)
- Used for **deterministic food normalization** (user input → canonical name)
- Used as **LLM context** in food-matching prompts
- **Immutable** — updates require code deploy
- **O(1) lookups** via `FOOD_ENTRY_MAP` and `CANONICAL_FOOD_NAMES`
**Dynamic User Data** (`convex/ingredientProfiles`, `convex/foodLibrary`, etc.):
- **User customizations** layered atop the registry (custom names, tags, nutrition overrides)
- **Per-user food trials** and assessments (what they've eaten, verdicts, overrides)
- **Composite foods** (meals the user has created)
- **Mutable** — users can create/edit via mutations
- **Scoped to userId**
**Flow**:
1. User logs a food → matched against registry via `foodAliases`, fuzzy matching, embeddings, LLM
2. Match resolves to canonical name (from `FOOD_REGISTRY`)
3. `ingredientProfiles` row created (if needed) with zone/group/line from registry
4. User can later edit `ingredientProfiles` (nutrition, tags, source)
5. `ingredientOverrides` allow status (safe/watch/avoid) independent of trial data
6. `foodLibrary` captures composite meals for reuse
**Consistency mechanism**:
- `resolveCanonicalFoodName()` normalizes all user input to canonical
- `getCanonicalFoodProjection()` fetches zone/group/line from registry
- Migration scripts normalize stored canonicals when registry updates
---
### 7. **Key Design Patterns**
1. **Race Condition Deduplication**: `foodLibrary`, `ingredientProfiles`, `ingredientOverrides` can have duplicates from concurrent mutations. Handled by:
   - Collecting ALL matching rows
   - Selecting "keeper" (earliest created or most recently updated)
   - Deleting extras on read or write
2. **Validation & Normalization**: 
   - All mutations sanitize input (`sanitizePlainText`, `sanitizeUnknownStringsDeep`)
   - Tags, profiles, and presets normalized via dedicated functions
   - Ingredient names always passed through `resolveCanonicalFoodName()`
3. **Food Group/Line Assignment**:
   - Derived from canonical name via `getCanonicalFoodProjection()`
   - Stored in `ingredientProfiles` for quick UI access
   - Never manually overridden
4. **Nutrition Per 100g Convention**:
   - `ingredientProfiles.nutritionPer100g` and `foodPortionData` both use per-100g
   - Allows multiplication by weight for any portion
5. **Audit Trail**:
   - All tables have `createdAt` and `updatedAt` (or similar)
   - `foodEmbeddings` tracks `sourceText` and `sourceType` (registry vs. alias)
   - `foodRequests` includes `rawInput` for transparency
---
### Summary Table: Food Tables at a Glance
| Table | Rows | Mutable | Purpose |
|-------|------|---------|---------|
| `ingredientProfiles` | User-specific | Yes | Custom metadata per ingredient |
| `foodLibrary` | User-specific | Yes | Composite foods & custom groupings |
| `profiles` | 1 per user | Yes | User config (includes foodPersonalisation, foodFavourites) |
| `ingredientExposures` | Per log entry | No (append-only) | Food intake history |
| `ingredientOverrides` | User-specific | Yes | Status overrides (safe/watch/avoid) |
| `foodAssessments` | Per AI report | No (append-only) | AI verdicts & reasoning |
| `foodEmbeddings` | Registry static | No | Vector embeddings for semantic matching |
| `foodAliases` | Registry static | No | Phrase → canonical mappings |
| `foodTrialSummary` | User-specific | Yes | Aggregated trial status per food |
| `foodRequests` | Global | Yes | User submissions for new registry entries |
---
**Absolute file paths**:
- `/home/user/repo/convex/schema.ts` — Schema definitions
- `/home/user/repo/convex/ingredientProfiles.ts` — Ingredient customization CRUD
- `/home/user/repo/convex/foodLibrary.ts` — Composite food CRUD & merge logic
- `/home/user/repo/convex/ingredientOverrides.ts` — Status override CRUD
- `/home/user/repo/convex/foodRequests.ts` — New food submission
- `/home/user/repo/convex/profileMutations.ts` — Profile patching (includes foodPersonalisation, foodFavourites)
- `/home/user/repo/convex/profiles.ts` — AI rate limiting
- `/home/user/repo/shared/foodRegistryData.ts` — Canonical registry (4382 lines)
- `/home/user/repo/shared/foodPortionData.ts` — Static portion/nutrition reference
- `/home/user/repo/shared/foodRegistryUtils.ts` — O(1) registry lookups & helpers




Agent
Explore existing Food UI components
Perfect! Now I have a comprehensive understanding. Let me compile my findings:
---
Show less
## Comprehensive Food Management UI Components Exploration
Based on a thorough exploration of the codebase, here's what food-related UI building blocks already exist and can be reused for a food database management page:
### 1. **Food-Related Pages/Views**
Currently, there is **NO dedicated Food database management page**. Food management exists only as:
- **Track page** (`/home/user/repo/src/pages/Track.tsx`) — primary tracking interface
- **Secondary pages**: Archive, Menu, Settings, Patterns (no food management pages)
The routing is minimal (TanStack Router in `/home/user/repo/src/routeTree.tsx`):
- `/` (Track)
- `/patterns`
- `/settings`
- `/archive`
- `/menu`
- `/uimigrationlab` (dev-only)
**No existing Food page route — this would be a new addition.**
---
### 2. **Core Food-Related Components** (Reusable Building Blocks)
#### **FoodRow** (`/home/user/repo/src/components/track/nutrition/FoodRow.tsx`)
- **What it shows:**
  - Heart icon (toggleable favourite, or always-filled for FavouritesView)
  - Food name (truncated, single-line)
  - Portion + calories (e.g., "250g · 350 kcal")
  - Orange (+) button to add to staging
- **Props:** `canonicalName`, `displayName`, `portion`, `calories`, `isFavourite?`, `dataSlot`, `onAdd`, `onToggleFavourite?`
- **Memoized:** Yes (prevents re-renders when parent ticks but props unchanged)
- **Status:** Highly reusable — used by FavouritesView, FoodFilterView, NutritionCard search results, and zero-state recent foods
#### **FoodFilterView** (`/home/user/repo/src/components/track/nutrition/FoodFilterView.tsx`)
- **What it shows:**
  - Back button + header
  - 3-tab interface: **Recent** | **Frequent** | **All**
  - Tab counts in parentheses (e.g., "Recent (12)")
  - Lists up to 50 items per tab using `FoodRow`
  - Empty states for each tab
- **Key logic:**
  - Recent: canonicalNames from recent logs, filtered to known foods
  - Frequent: counts occurrences in logs, sorted descending, filtered to known foods
  - All: entire FOOD_REGISTRY sorted alphabetically
  - Shows "Logged Nx" notation in Frequent tab for count context
- **Utilities used:** `filterToKnownFoods`, `formatPortion`, `getDefaultCalories`, `titleCase`
- **Status:** Complete, functional browser—perfect template for database UI layout
#### **FavouritesView** (`/home/user/repo/src/components/track/nutrition/FavouritesView.tsx`)
- **What it shows:**
  - Back button + header
  - Heart icon (always-filled)
  - Empty state: "No favourites yet"
  - List of favourited foods using `FoodRow`
- **Status:** Simple, but shows empty state pattern well
#### **NutritionCard** (`/home/user/repo/src/components/track/nutrition/NutritionCard.tsx`) — Primary Hub
- **Views it provides:**
  - Calorie ring (collapsed mode, always visible)
  - Search bar (with focus states)
  - Log Food button (shows staging count badge)
  - Water progress bar
  - **Secondary panels (one-at-a-time):**
    - CalorieDetailView (meal breakdown, macro pills, per-meal accordions with food items)
    - FavouritesView
    - FoodFilterView
  - Search zero-state (recent foods + common drinks when focused, empty query)
  - Inline search results (FoodRegistryEntry rows with zone badges, confidence scores)
- **State management:** `useNutritionStore` (ephemeral UI state)
- **Data:** `useNutritionData` (read-only Convex-derived, plus `useFoodFavourites` for toggles)
---
### 3. **Food Editing & Inline Modification UI**
#### **LogFoodModal** (`/home/user/repo/src/components/track/nutrition/LogFoodModal.tsx`)
- **Purpose:** Staging confirmation modal before logging
- **Shows:**
  - List of staged items with memoized `FoodItemRow` (quantity ±/− buttons)
  - Per-item calories + portion display
  - **Aggregate totals** (calories, protein, carbs, fat, sugars, fiber)
  - Macro pills with color coding (from `nutritionConstants.ts`)
  - Action buttons: Log Food, Add More, Clear All, Remove individual items
- **Data source:** `useNutritionStore` (stagedItems, stagingTotals)
- **Uses:** Base UI Dialog for focus trapping, Escape to close, click-outside
#### **RawInputEditModal** (`/home/user/repo/src/components/track/RawInputEditModal.tsx`)
- **Purpose:** Edit raw food text input for a log
- **Behavior:** On save, clears `items` array and triggers server-side reprocessing from scratch
- **Used by:** FoodSubRow (in TodayLog) for editing unmatched/incorrectly matched foods
#### **FoodMatchingModal** (`/home/user/repo/src/components/track/FoodMatchingModal.tsx`)
- **Purpose:** Manual food matching UI (resolving pending/unmatched items)
- **Shows:**
  - Search box (server-powered)
  - Search results grouped by FoodGroup (protein, carbs, fats, seasoning) via BucketKey
  - Zone badges (Z1–Z4 color-coded)
  - Match confidence score
  - Queue mode (for bulk unresolved items)
  - Option to submit food request (for missing foods)
  - RawInputEditModal integration for correcting parsed text
#### **FoodSubRow** (`/home/user/repo/src/components/track/today-log/editors/FoodSubRow.tsx`)
- **Context:** Part of TodayLog (inline food logs viewer/editor)
- **Shows:**
  - Resolution dot (green=resolved, yellow=expired/unmatched, amber=pending+clickable)
  - Meal slot badge
  - Food name + parsed name
  - Portion + calorie display
  - Macros (via `getItemMacros`)
  - Delete button
  - Tap-to-match for pending items (opens FoodMatchingModal)
- **Status:** Inline editing within a larger log context (not standalone form)
---
### 4. **Food Data Structures & Utilities**
#### **Staging System** (`useNutritionStore.ts`)
```typescript
interface StagedItem {
  id: string;
  canonicalName: string;
  displayName: string;
  portionG: number;        // grams or ml for liquids
  isLiquid: boolean;       // affects suffix (ml vs g)
  naturalUnit?: string;    // e.g., "slice", "medium egg"
  unitWeightG?: number;    // grams per natural unit
  calories: number;
  protein/carbs/fat/sugars/fiber: number;  // computed from portionG
}
interface StagingTotals {
  calories/protein/carbs/fat/sugars/fiber: number;  // aggregated
}
```
#### **Reducer Actions** (useNutritionStore dispatch):
- `ADD_TO_STAGING` — aggregate (if exists) or create new StagedItem
- `REMOVE_FROM_STAGING`
- `ADJUST_STAGING_PORTION` — ±/− delta, auto-removes if <= 0
- `CLEAR_STAGING`
- `SET_VIEW` — toggle between "none" | "favourites" | "foodFilter" | "calorieDetail"
- `SET_SEARCH_QUERY` — triggers Fuse.js search
- `SET_ACTIVE_MEAL_SLOT` — breakfast/lunch/dinner/snack
- Search via Fuse.js (fuzzy match on canonical + examples, 3+ char minimum)
---
### 5. **Food Search & Staging Workflow**
**How food search/staging currently works:**
1. User types in search input (3+ chars triggers search)
2. `useNutritionStore` computes deferred search results via `searchFoodRegistry()`
3. Fuse.js searches FOOD_REGISTRY against canonical + examples (threshold 0.4)
4. Results displayed as `SearchResultRow` with:
   - Zone badge (color from `getZoneBadgeBackground`)
   - Confidence score (if available)
   - Heart button for toggling favourite
   - + button to add to staging
5. User adds items → **staging modal** opens to confirm
6. Quantity adjustment via ±/− buttons (clamped 1–500g per item)
7. On "Log Food" → `buildStagedNutritionLogData()` + `addSyncedLog()`
---
### 6. **NutritionCard & CalorieDetailView**
#### **CalorieDetailView** (`/home/user/repo/src/components/track/nutrition/CalorieDetailView.tsx`)
- **Shows:**
  - Segmented meal breakdown bar (breakfast/lunch/dinner/snack with colors)
  - 5-column macro display (proteins, carbs, sugars, fats, fiber) with color pills
  - One-open-at-a-time accordions per meal slot
  - Food items within each accordion
  - Delete button per food item
  - Meal time labels (7:00 breakfast, 13:00 lunch, 20:00 dinner, 15:00 snack)
- **Used by:** NutritionCard as secondary panel
#### **MACRO_COLORS** (nutritionConstants.ts)
```typescript
{
  protein: "#f97316",   // orange
  carbs: "#34d399",     // emerald
  fat: "#f87171",       // red
  sugars: "#fbbf24",    // amber
  fiber: "#818cf8",     // indigo
}
```
---
### 7. **Supporting Hooks & Utilities**
#### **Hooks:**
- `useNutritionStore()` — ephemeral UI state (view, search, staging, meal slot)
- `useNutritionData(targetDate?)` — read-only nutrition summaries
  - Returns: todayFoodLogs, totalCaloriesToday, totalMacrosToday, caloriesByMealSlot, logsByMealSlot, recentFoods, currentMealSlot, etc.
- `useFoodFavourites()` — favourite management
  - Methods: `toggleFavourite()`, `addFavourite()`, `removeFavourite()`, `isFavourite()`
- `useAddSyncedLog()`, `useRemoveSyncedLog()`, `useUpdateSyncedLog()` — log mutations
#### **Pure Utility Functions** (`nutritionUtils.ts`):
- `getMealSlot(timestamp)` — breakfast/lunch/dinner/snack from hour
- `calculateTotalCalories()` — from FOOD_PORTION_DATA
- `calculateTotalMacros()` — protein/carbs/fat/sugars/fiber breakdown
- `groupByMealSlot()` — group logs by meal slot
- `computeMacrosForPortion()` — compute macros for a food + grams
- `formatPortion()` — "250g" or "2 slices (72g)" from FOOD_PORTION_DATA
- `getDefaultCalories()` — calorie lookup from FOOD_PORTION_DATA
- `titleCase()` — canonical → display name
- `filterToKnownFoods()` — filter to foods in FOOD_PORTION_DATA
#### **Data Source:**
- `FOOD_REGISTRY` — static, canonical food names + examples + zone + subcategory
- `FOOD_PORTION_DATA` — Map<canonicalName, { defaultPortionG, caloriesPer100g, macrosPer100g, naturalUnit, unitWeightG }>
- `useSyncedLogsContext()` — all synced logs from Convex
---
### 8. **What Already Exists for Copy/Paste**
| Component | Path | Reusability | Status |
|-----------|------|-------------|--------|
| **FoodRow** | `nutrition/FoodRow.tsx` | Very High | Memoized, production-ready |
| **FoodFilterView** | `nutrition/FoodFilterView.tsx` | High | Tab browser, filtering, list layout |
| **FavouritesView** | `nutrition/FavouritesView.tsx` | High | Empty state, favourite list pattern |
| **LogFoodModal** | `nutrition/LogFoodModal.tsx` | High | Staging confirmation, macro display |
| **CalorieDetailView** | `nutrition/CalorieDetailView.tsx` | Medium | Accordion, macro pills, meal layout |
| **SearchResultRow** | `nutrition/NutritionCard.tsx` (inline) | Medium | Zone badge, confidence, heart toggle |
| **RawInputEditModal** | `track/RawInputEditModal.tsx` | High | Text edit + reprocessing trigger |
| **FoodMatchingModal** | `track/FoodMatchingModal.tsx` | High | Food search, grouping, matching UI |
| **FoodSubRow** | `today-log/editors/FoodSubRow.tsx` | Medium | Resolution dot, macros, actions |
| **useNutritionStore** | `nutrition/useNutritionStore.ts` | Very High | Staging logic, reducer, search |
| **useNutritionData** | `hooks/useNutritionData.ts` | Very High | Calorie totals, meal grouping |
| **useFoodFavourites** | `hooks/useProfile.ts` | Very High | Favourite toggle, persistence |
---
### 9. **Key Design Patterns Already in Place**
1. **Modular view panels** — NutritionCard manages multiple views as one-at-a-time secondary panels
2. **Search with Fuse.js** — Already integrated, 3+ char minimum, 20-result limit
3. **Zone coloring system** — `getZoneBadgeBackground()` utility exists
4. **Responsive shell** — `ResponsiveShell` component for modal-like UX on mobile
5. **Macro color consistency** — Centralized in `nutritionConstants.ts`
6. **Memoization discipline** — `React.memo` used on FoodRow and FoodItemRow to prevent thrashing
7. **Accessibility** — ARIA labels, roles, and focus trapping (Base UI Dialog)
8. **Error boundaries** — `NutritionCardErrorBoundary` exists
9. **Toast notifications** — `sonner` toast for user feedback
10. **Optimistic UI** — FoodSection clears input immediately, handles errors gracefully
---
### 10. **What DOES NOT Exist (Build from Scratch)**
- No Food database CRUD page
- No food editing inline form (only modals + sidebar matching)
- No bulk food operations UI
- No admin/curator interface for adding foods to registry
- No food category management
- No portion/macro override UI (except in staging context)
---
This foundation is robust and production-grade. For a food database management page, you could:
1. Reuse `FoodFilterView` layout (tabs, list, header) as your base template
2. Adapt `FoodRow` to show edit/delete actions instead of just add
3. Use `FoodMatchingModal` for picker dialogs
4. Leverage `useNutritionStore` patterns for local search/filtering state
5. Use existing `nutritionConstants.ts` and utility functions for display consistency


Perfect! Now I have all the information. Let me compile a comprehensive report of the food database management and seed data tasks.
## Comprehensive Report: Food Database Management, Editing, and Seed Data Planning
Show less
Based on the wave plans and PRD, here's the detailed breakdown of food-database-related tasks, especially for US-016 (food detail editing) and US-027 (seed data):
---
### **US-016: Food Detail Editing Modal (Wave 5, Task W5-T05)**
**File Location:** `/home/user/repo/docs/plans/2026-04-06-food-page-and-meal-system-waves-4-6.json` (lines 240-282) and `.md` (lines 1228-1270)
**Description:** As a user, I want to tap a food on the Food page to edit its calories, grams, macros, and portion info.
**Task ID:** W5-T05  
**Wave:** 5 (Food Page)  
**User Story:** US-016  
**Depends On:** W5-T02 (Food page search view)  
**Skill:** vite-react-implementer
**Acceptance Criteria:**
1. FoodDetailModal renders as modal/sheet with editable nutrition fields
2. Editable fields: name, portion size, unit, kcal, protein, fat, carbs, fibre, sugar, salt (all per 100g)
3. Tapping food name in any Food page view opens FoodDetailModal
4. Tapping heart or (+) does NOT open FoodDetailModal (only name tap)
5. Save writes to ingredientProfiles table via Convex mutation
6. Cancel discards changes and closes modal
7. Convex mutation updateIngredientProfile exists and upserts correctly
8. bun run typecheck passes
9. Browser verification: tap food name → modal opens → edit kcal → save → data persists
**Files to Create:**
- `src/components/food/FoodDetailModal.tsx` — editing modal component
- `convex/ingredientProfiles.ts` — backend mutation for updating ingredient profiles
**Files to Modify:**
- `src/pages/Food.tsx` — wire up modal on food name tap
- `src/components/track/nutrition/FoodRow.tsx` — may need onNameClick prop
**Implementation Details:**
- Modal/sheet opens when food name is tapped (NOT heart or + button)
- Shows editable fields for display name, default portion size, unit, kcal/protein/fat/carbs/fibre/sugar/salt per 100g
- Save writes to ingredientProfiles via upsert mutation
- Cancel discards all changes
- May need to add `onNameClick` prop to FoodRow or wrap name in clickable button
---
### **US-027: Pre-populate User's Food Registry (Wave 6, Tasks W6-T01 and W6-T02)**
**File Location:** `/home/user/repo/docs/plans/2026-04-06-food-page-and-meal-system-waves-4-6.json` (lines 284-350) and `.md` (lines 1274-1420)
**Description:** As a user, I want my known ~30 foods pre-loaded with accurate portion and nutrition data. Also includes two meal templates (Coffee, Toast) pre-seeded.
#### **W6-T01: Populate foodPortionData with ~30 foods**
**Task ID:** W6-T01  
**Wave:** 6 (Seed Data)  
**User Story:** US-027  
**Depends On:** W5-T02 (Food page search view)  
**Skill:** vite-react-implementer
**Acceptance Criteria:**
1. All ~30 foods from the PRD exist in FOOD_PORTION_DATA with defaultPortionG, naturalUnit, unitWeightG, kcalPer100g, and full macros
2. All ~30 foods have corresponding entries in FOOD_REGISTRY with canonical name, category, zone
3. tspToGrams values added for butter, jam, peanut butter, cream cheese, olive oil, sugar, salt
4. Nutrition data sourced from reliable sources (McCance & Widdowson / USDA / Open Food Facts)
5. No duplicate entries — audit existing data first, only add what's missing
6. bun run typecheck passes
7. bun run build succeeds
**Files to Modify:**
- `shared/foodPortionData.ts` — add/verify entries for all ~30 foods
- `shared/foodRegistryData.ts` — add/verify registry entries
**The ~30 Foods List:**
**Bread & carbs (8):**
- toast (slice, 30g)
- plain pasta (100g)
- rice (100g)
- wraps (1 wrap)
- breadsticks
- tostadas
- chaelitos (piece)
- bread snacks
**Protein (6):**
- lean meat (100g)
- lean fish (100g)
- chicken broth (250ml)
- eggs (1 large, 60g)
- grated cheddar (30g)
- sliced cheddar (20g slice)
**Fruit & veg (3):**
- banana (1 medium, 120g)
- mashed pumpkin (100g)
- mashed potato (100g)
**Spreads & fats with teaspoon-to-gram data (5):**
- butter (1 tsp, 5g) — 4.7g/tsp
- jam (1 tsp, 5g) — 7g/tsp
- peanut butter (1 tsp, 5g) — 5.4g/tsp
- cream cheese (1 tbsp, 10g) — 5g/tsp (15g/tbsp)
- olive oil (1 tsp, 5ml) — 4.5g/tsp
**Seasoning (3):**
- salt (pinch) — 6g/tsp
- pepper (pinch)
- fine herbs (pinch)
**Drinks (6):**
- coffee (espresso shot)
- milk (50ml)
- sugar (1 tsp, 5g) — 4.2g/tsp
- tea (cup, 240ml)
- diluted juice (cup, 240ml)
- carbonated drink (can, 330ml)
**Teaspoon-to-Gram Conversions (for density-varying ingredients):**
```
butter: 4.7 g/tsp
jam: 7 g/tsp
peanut butter: 5.4 g/tsp
cream cheese: 5 g/tsp (tbsp = 15g)
olive oil: 4.5 g/tsp (or ml)
sugar: 4.2 g/tsp
salt: 6 g/tsp
```
---
#### **W6-T02: Seed Coffee and Toast Meal Templates**
**Task ID:** W6-T02  
**Wave:** 6 (Seed Data)  
**User Story:** US-027 (last two acceptance criteria)  
**Depends On:** W0-T01 (Extend foodLibrary), W6-T01 (Populate foods)  
**Skill:** vite-react-implementer
**Acceptance Criteria:**
1. convex/seedMealTemplates.ts exports an internal mutation (e.g. internal.seedMealTemplates.seed)
2. Mutation creates Coffee composite with structuredIngredients, modifiers, and sizes
3. Mutation creates Toast composite with structuredIngredients and modifiers
4. Mutation is idempotent — skips if entries already exist for userId+canonicalName
5. Both entries have type: 'composite' and correct ingredients array for backward compat
6. bun run typecheck passes
7. Can be run via npx convex run seedMealTemplates:seed
**Files to Create:**
- `convex/seedMealTemplates.ts` — one-time seed script/internal mutation
**Meal Template Specifications:**
**Coffee (250ml):**
```typescript
{
  userId,
  canonicalName: "coffee-250ml",
  type: "composite",
  ingredients: ["espresso", "water", "milk"],
  structuredIngredients: [
    { canonicalName: "espresso", quantity: 1, unit: "shot" },
    { canonicalName: "water", quantity: 200, unit: "ml" },
    { canonicalName: "milk", quantity: 50, unit: "ml" },
  ],
  modifiers: [
    { canonicalName: "sugar", quantity: 5, unit: "g", isDefault: false },
    { canonicalName: "espresso", quantity: 1, unit: "shot", isDefault: false },
  ],
  sizes: [
    { name: "250ml cup", adjustments: [] },
    { name: "450ml cup", adjustments: [{ canonicalName: "water", quantity: 350, unit: "ml" }] },
  ],
  createdAt: Date.now(),
}
```
**Toast (2 slices):**
```typescript
{
  userId,
  canonicalName: "toast-2-slices",
  type: "composite",
  ingredients: ["toast"],
  structuredIngredients: [
    { canonicalName: "toast", quantity: 2, unit: "slice" },
  ],
  modifiers: [
    { canonicalName: "butter", quantity: 5, unit: "g", isDefault: false },
    { canonicalName: "jam", quantity: 5, unit: "g", isDefault: false },
    { canonicalName: "peanut butter", quantity: 5, unit: "g", isDefault: false },
    { canonicalName: "cream cheese", quantity: 10, unit: "g", isDefault: false },
  ],
  sizes: [],
  createdAt: Date.now(),
}
```
**Implementation Notes:**
- Create an internal mutation that inserts two foodLibrary entries with type: 'composite'
- Mutation should check for existing entries by userId+canonicalName and skip if already seeded
- Run via Convex dashboard or `npx convex run seedMealTemplates:seed`
- Both composites have backward-compatible `ingredients` array
---
### **Related Schema/Infrastructure (Wave 0)**
**Prerequisite Tasks for Food Database Management:**
**W0-T01: Extend foodLibrary table for composite meals**
- **User Story:** US-020 (data model only)
- Adds validators: structuredIngredientValidator, mealModifierValidator, sizeAdjustmentValidator, mealSizeValidator, slotDefaultValidator
- Extends foodLibrary table with optional fields: structuredIngredients, slotDefaults, modifiers, sizes
- Files: `convex/validators.ts`, `convex/schema.ts`
**W0-T02: Add tspToGrams field to ingredientProfiles**
- **User Stories:** US-020, US-027
- Adds optional `tspToGrams: v.optional(v.number())` field to ingredientProfiles table
- Supports per-ingredient portion calculations for W6 seed data and future meal system
- File: `convex/schema.ts`
---
### **Search Cap Removal (Wave 5)**
**W5-T02: Food page search view (no cap)**
- **User Story:** US-013
- Removes or raises the 50-item search result cap to 500
- Current cap is a UX guardrail; with ~300-400 foods, querying all is acceptable (negligible Convex bandwidth)
- File to modify: `src/components/track/nutrition/useNutritionStore.ts`
---
### **File Impact Summary**
**New Files (Food Database/Editing):**
- `src/components/food/FoodDetailModal.tsx` (W5) — Food editing modal
- `convex/ingredientProfiles.ts` (W5) — Ingredient profile mutation
- `convex/seedMealTemplates.ts` (W6) — Meal template seed mutation
**Modified Files (Food Database/Editing):**
- `src/pages/Food.tsx` (W5) — Wire up modal on food name tap
- `src/components/track/nutrition/FoodRow.tsx` (W5) — Add onNameClick prop if needed
- `src/components/track/nutrition/useNutritionStore.ts` (W5) — Remove 50-item search cap
- `shared/foodPortionData.ts` (W6) — Add ~30 foods with nutrition data
- `shared/foodRegistryData.ts` (W6) — Add ~30 food registry entries
- `convex/schema.ts` (W0) — Extend foodLibrary, ingredientProfiles
- `convex/validators.ts` (W0) — Add validators for meal system fields
---
### **Key Design Decisions**
**Food Editing Approach (US-016):**
- User-taps food name → FoodDetailModal opens
- Editable at per-100g nutrition level (kcal, macro breakdown)
- Changes persist to ingredientProfiles table (per-user overrides)
- Heart toggle (+) button excluded from modal trigger (different affordances)
**Seed Data Approach (US-027):**
- ~30 foods sourced from McCance & Widdowson / USDA / Open Food Facts
- Density-aware teaspoon conversions for spreads/fats/seasonings
- Two meal templates (Coffee, Toast) seeded as composite foodLibrary entries
- User can override any pre-seeded food via FoodDetailModal
- Idempotent seed mutation — safe to run multiple times
---
This planning establishes a clear path for:
1. **Food detail editing** via modal UI with nutritional field customization
2. **User-defined foods** with custom macros/portions via ingredientProfiles table
3. **Seed data** with ~30 curated foods and density-aware unit conversions
4. **Meal templates** (Coffee, Toast) as composite entries with structured ingredients and modifiers
All tasks are sequenced to allow Wave 5 schema work to complete before Wave 6 seeding begins.

