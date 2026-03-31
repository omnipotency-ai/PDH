# Server-Side Food Pipeline

> **Status: IMPLEMENTED (2026-03-14)**
> All 11 tasks completed on `feature/v1-sprint` branch. 352 tests passing, typecheck clean, build compiles.
> See `docs/scratchpadprompts/transitmap.md` for implementation log.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent driven development to implement this plan.

**Goal:** Save the user's raw food text immediately and immutably, then process it server-side through a pipeline (parse → registry → LLM with web search → user) with partial release for display and total hold for evidence. The evidence engine waits 6 hours before processing any items from a meal.

**Architecture:** The client sends raw text to a Convex mutation that saves it instantly. A scheduled server action splits the text, extracts quantities, and matches against the food registry. Matched items show green on the Track page immediately (display-only feedback). Unmatched segments are sent to the LLM for segmentation, matching, and web search. Items the LLM can't match are surfaced to the user via a persistent notification. After 6 hours, the system processes the entire meal into the evidence engine: resolved items get `ingredientExposures`, unresolved items are flagged as `"unknown_food"` and ignored. No items enter the evidence engine before the 6-hour window closes — partial meal data would corrupt transit correlations because the Bayesian engine needs the full meal composition. The raw text is never modified or deleted by the system, but the user can edit it via a modal (triggering full reprocessing).

**Tech Stack:** Convex (mutations, actions, scheduler), shared/ (food registry, canonicalization, normalization), OpenAI API (`gpt-4o-mini-search-preview`), React (notification + matching UI).

---

## Design principles

1. **Raw text is system-immutable.** `rawInput` is never modified or deleted by the system, LLM, or any processing step. It is the permanent medical record of what the user reported eating. However, the user can edit their own raw text via a modal, which triggers full reprocessing from Stage 1.

2. **Partial release for display, total hold for evidence.** Resolved items show green on the Track page immediately (instant ADHD-friendly feedback). Unresolved items show amber. But NO items enter the evidence engine until the 6-hour processing window closes. This prevents partial meal data from corrupting transit correlations — the Bayesian engine needs the full meal composition.

3. **Display-only default portions.** If the user doesn't specify a quantity, we store `null`. The UI may show display hints (e.g., "~2 sl" for toast) based on registry `defaultPortion`, but these are never stored in data. `null` quantity means "1 standard trial exposure" in the Bayesian engine.

4. **Graceful degradation, not deletion.** After 6 hours, unresolved items become `"unknown_food"` — the raw text stays visible forever, but the evidence engine ignores it. No data is destroyed.

5. **Binary LLM matching with web search.** The LLM's job is binary: match to the registry or can't match. No confidence levels. But before giving up, the LLM searches the web for unknown terms (brand names, regional names). If it still can't match after web search, the item goes to the user.

6. **Registry is developer-controlled.** No user, LLM, or code can add registry entries at runtime. If a food doesn't exist in the registry, the user submits a ticket requesting it be added. Developers review and add the appropriate digestive category. No "other_protein_zone1" catch-all buckets.

---

## How this works — a concrete example

### The input

User types: **"one banana, two toast, mashed potatoes, chicken, pureed carrots, xylofruit"**

### Stage 1: Save raw text (instant)

The client sends the exact text to Convex. It's saved immediately:

```json
{
  "type": "food",
  "data": {
    "rawInput": "one banana, two toast, mashed potatoes, chicken, pureed carrots, xylofruit",
    "items": [],
    "notes": ""
  }
}
```

The user sees their entry on the Track page immediately. Processing happens in the background.

### Stage 2: Deterministic fast path (server-side)

If commas are present, split on commas and try registry lookup per segment. This is a fast path only — many inputs (especially voice) will not have commas. Matched items show green on the Track page immediately. Unmatched segments pass to the LLM.

| #   | userSegment     | parsedName      | quantity | unit | Registry match                         | Result          |
| --- | --------------- | --------------- | -------- | ---- | -------------------------------------- | --------------- |
| 1   | one banana      | banana          | 1        | null | YES → "ripe banana" (Zone 1)           | Green (display) |
| 2   | two toast       | toast           | 2        | null | YES → "toast" (Zone 1)                 | Green (display) |
| 3   | mashed potatoes | mashed potatoes | null     | null | YES → "mashed potato" (Zone 1)         | Green (display) |
| 4   | chicken         | chicken         | null     | null | YES → "grilled white meat" (Zone 2)    | Green (display) |
| 5   | pureed carrots  | pureed carrots  | null     | null | YES → "mashed root vegetable" (Zone 1) | Green (display) |
| 6   | xylofruit       | xylofruit       | null     | null | NO                                     | → LLM           |

**Field names explained:**

- **rawInput** — the full sentence, exactly as typed. System-immutable. Never changed by processing. User can edit via modal.
- **userSegment** — one piece of that sentence after comma-splitting
- **parsedName** — the food word after stripping "one", "two", "200g of", etc.
- **quantity / unit** — extracted numbers and measures, or `null` if not specified

**Second example — free-form input without commas:**

User dictates via voice: **"one banana two toasts and six kelitos and salt and pepper"**

Comma-splitting produces a single segment (the entire string) because there are no commas. The deterministic fast path cannot match this. The entire string goes to the LLM for segmentation.

### Stage 3: LLM parsing + matching (with web search)

The LLM now has a bigger job for unresolved segments. It handles both the comma-separated "xylofruit" from Example 1 and the entire free-form string from Example 2.

**Job 1: SEGMENT** free-form text into individual food items (handles no-comma input like "one banana two toasts and six kelitos and salt and pepper" → ["one banana", "two toasts", "six kelitos", "salt", "pepper"]).

**Job 2: MATCH** each item to the registry (binary: match or NOT_ON_LIST).

**Job 3: If can't match → SEARCH THE WEB** for the term (using `gpt-4o-mini-search-preview` or `gpt-5-search-api`).

**Job 4: After web search, try matching again.** Still can't match → flag for user.

This is where brand names get resolved. "Biscoff" → web search → sweet biscuit brand → registry: "sweet biscuit". "Kelitos" → web search → breadstick snack → registry: "plain cracker".

The LLM receives the full context plus the unmatched segment(s):

> Here is a food entry: "one banana two toasts and six kelitos and salt and pepper"
> Here is the full meal for context: "one banana two toasts and six kelitos and salt and pepper"
> Here is a list of food categories with examples: [registry vocabulary table]
>
> **Step 1:** Segment this text into individual food items with quantities.
> **Step 2:** Match each item to one of these categories, or search the web if you don't recognize it.
> **Step 3:** If you still can't match after searching, respond NOT_ON_LIST.

The LLM either:

- **Returns registry matches** → items are resolved, `resolvedBy: "llm"`, show green on Track page (display only)
- **Returns NOT_ON_LIST** → item goes to the user

### Stage 4: User resolution (0-6 hour window)

If an item comes back as NOT_ON_LIST:

**Hours 0-3:** Persistent toast notification: "Kelitos couldn't be matched — tap to fix"

The user taps and sees a matching UI:

- The unresolved food name (e.g., "kelitos")
- The full meal context (the `rawInput`)
- A searchable dropdown of all registry canonical names (alphabetical)
- A "Request new category" button → submits a ticket for developers to review and add the food to the registry

Three resolution options:

a) **Edit raw text** (modal) → user corrects the text, triggers full reprocessing from Stage 1
b) **Manually match** item to registry dropdown (searchable list of all canonicals) → `resolvedBy: "user"`
c) **Submit ticket:** "Add this food to registry" → developer reviews and adds the appropriate digestive category

If the user picks "plain cracker" from the dropdown → `canonicalName: "plain cracker"`, `resolvedBy: "user"`, shows green on Track page.

**Hours 3-6:** Toast changes: "Your entry has issues — [Fix now] [Dismiss]"

### Stage 5: Evidence processing (at 6 hours)

At the 6-hour mark, a scheduled mutation processes the meal into the evidence engine:

- **Resolved items** → `ingredientExposures` rows created, evidence pipeline active. These items now participate in transit correlations and food trial analysis.
- **Unresolved items** → expire to `canonicalName: "unknown_food"`, `resolvedBy: "expired"`. Evidence engine ignores them.
- **Raw text** stays visible forever.

This is the critical architectural difference: the evidence engine sees the full meal composition at once. A meal of "toast, butter, honey, kelitos" where kelitos resolves at hour 4 — the engine gets all four items together at hour 6, not toast/butter/honey at hour 0 and kelitos at hour 4.

### Stage 6: Graceful expiration (NOT deletion)

**Hour 6:** Any still-unresolved items are automatically assigned `canonicalName: "unknown_food"`, `resolvedBy: "expired"`.

- The `rawInput` text stays visible in the UI forever
- The `userSegment` stays visible next to the amber icon
- The evidence engine **ignores** items with `canonicalName: "unknown_food"` — they don't affect transit calculations
- No data is destroyed. The user can still manually match the item later if they want (the amber icon stays, matching UI still accessible). If matched after evidence processing, the evidence engine recalculates.

### What each item looks like when fully resolved

```typescript
{
  userSegment: "two toast",
  parsedName: "toast",
  canonicalName: "toast",
  resolvedBy: "registry",
  quantity: 2,
  unit: null,
  defaultPortionDisplay: "sl",  // display hint only, not stored in data
  recoveryStage: 1,
}
```

### Editing

**Users can edit on a food log:**

- Timestamp (when they ate)
- Quantities and units (per item, inline)
- Raw text (via modal → triggers full reprocessing)

**Editing raw text:**

The user taps an edit button on the food log. A modal shows the current `rawInput`. The user edits the text and saves. This replaces the `rawInput` and triggers full reprocessing from Stage 1. The previous `rawInput` is not preserved (the user is making a conscious correction).

**Editing old logs (already in evidence engine):**

Allowed without restriction. Editing a log that has already been processed will:

1. Reprocess the food items from the new raw text
2. Rebuild `ingredientExposures` for this log
3. Recalculate any affected food trial evidence

This is acceptable because the user is correcting their own data. Evidence shifts are expected when data is corrected.

---

## What does NOT change

- **Food registry** — same entries, same `shared/` directory, immutable at runtime
- **Evidence pipeline** — `buildFoodEvidenceResult()` unchanged, reads from `ingredientExposures`. Items with `canonicalName: "unknown_food"` are filtered out.
- **AI analysis flow** — Dr. Poo reports unchanged, reads from logs
- **`ingredientExposures` schema** — same fields, same indexes
- **`foodTrialSummary` / `computeAggregates`** — unchanged, still recomputes from assessments

---

## Data model changes

### `foodItemValidator` — rename fields, add `resolvedBy`

Current (`convex/validators.ts:283-292`):

```typescript
const foodItemValidator = v.object({
  name: v.string(),
  rawName: v.optional(v.union(v.string(), v.null())),
  quantity: v.union(v.number(), v.null()),
  unit: v.union(v.string(), v.null()),
  canonicalName: v.optional(v.string()),
  preparation: v.optional(v.string()),
  recoveryStage: v.optional(recoveryStageValidator),
  spiceLevel: v.optional(spiceLevelValidator),
});
```

New:

```typescript
const foodItemValidator = v.object({
  userSegment: v.string(),
  parsedName: v.string(),
  canonicalName: v.optional(v.string()),
  resolvedBy: v.optional(
    v.union(
      v.literal("registry"),
      v.literal("llm"),
      v.literal("user"),
      v.literal("expired"),
    ),
  ),
  quantity: v.union(v.number(), v.null()),
  unit: v.union(v.string(), v.null()),
  defaultPortionDisplay: v.optional(v.string()),
  preparation: v.optional(v.string()),
  recoveryStage: v.optional(recoveryStageValidator),
  spiceLevel: v.optional(spiceLevelValidator),
});
```

Changes:

- `name` → `parsedName` (food name after quantity stripping)
- `rawName` → `userSegment` (the comma-split piece)
- Added `resolvedBy` with four values: registry, llm, user, expired
- Added `defaultPortionDisplay` as a display-only hint field (e.g., "sl" for slices)
- `canonicalName` stays optional (undefined until resolved)

Legacy field names kept in validator for backwards compatibility:

```typescript
// Legacy fields (for existing data in database)
name: v.optional(v.string()),
rawName: v.optional(v.union(v.string(), v.null())),
```

### `foodLogDataValidator` — add `rawInput`

Current (`convex/validators.ts:294-305`):

```typescript
const foodLogDataValidator = v.object({
  items: v.array(foodItemValidator),
  notes: v.optional(v.string()),
  mealSlot: v.optional(v.union(...)),
});
```

New:

```typescript
const foodLogDataValidator = v.object({
  rawInput: v.optional(v.string()),
  items: v.array(foodItemValidator),
  notes: v.optional(v.string()),
  mealSlot: v.optional(v.union(...)),
});
```

`rawInput` is optional for backwards compatibility with existing logs.

### Derived state (no field needed)

Whether an item is "pending" is derived from its fields:

- `canonicalName === undefined` → pending (amber icon, matching UI accessible)
- `canonicalName === "unknown_food"` → expired (amber icon, still matchable but evidence engine ignores)
- `canonicalName` is a real registry value → resolved (green display)

No `parseStatus` field needed on the log itself.

### Evidence engine change

In `shared/foodEvidence.ts`, `buildFoodTrials` must filter out items with `canonicalName === "unknown_food"`:

```typescript
// Skip unknown/unresolved items — they don't affect transit calculations
if (item.canonicalName === "unknown_food") continue;
```

This is a one-line change. Null quantity is already handled by the Bayesian engine as "1 standard trial exposure."

---

## Tasks

### Task 1: Rename food item fields in the validator

Rename `name` → `parsedName` and `rawName` → `userSegment` in the validator, and add `resolvedBy`. Update all code that reads/writes these fields.

**Files:**

- Modify: `convex/validators.ts:283-292`
- Modify: `convex/logs.ts` (rebuildIngredientExposuresForFoodLog references `rawName`, `name`, `canonicalName`)
- Modify: `src/lib/foodParsing.ts` (buildParsedFoodData outputs `name`, `rawName`)
- Modify: all test files that reference `name` / `rawName` on food items
- Modify: Track page display components that read `name` / `rawName`

**This is a rename refactor.** No behaviour change. All existing food logs in the database have the old field names — Convex stores documents as JSON, so old documents keep their old field names. New documents use the new names. The reading code must handle both:

```typescript
// In rebuildIngredientExposuresForFoodLog and display code:
const segment = item.userSegment ?? item.rawName ?? item.name;
const parsed = item.parsedName ?? item.name;
```

#### Step 1: Update the validator

In `convex/validators.ts`, change `foodItemValidator`:

```typescript
const foodItemValidator = v.object({
  // New field names
  userSegment: v.optional(v.string()),
  parsedName: v.optional(v.string()),
  resolvedBy: v.optional(
    v.union(
      v.literal("registry"),
      v.literal("llm"),
      v.literal("user"),
      v.literal("expired"),
    ),
  ),
  // Legacy field names (for existing data)
  name: v.optional(v.string()),
  rawName: v.optional(v.union(v.string(), v.null())),
  // Unchanged fields
  canonicalName: v.optional(v.string()),
  quantity: v.union(v.number(), v.null()),
  unit: v.union(v.string(), v.null()),
  defaultPortionDisplay: v.optional(v.string()),
  preparation: v.optional(v.string()),
  recoveryStage: v.optional(recoveryStageValidator),
  spiceLevel: v.optional(spiceLevelValidator),
});
```

Both old and new field names are optional so existing data validates. New code writes the new names. Reading code checks new names first, falls back to old.

#### Step 2: Update `rebuildIngredientExposuresForFoodLog` in `convex/logs.ts`

Change lines 205-207:

```typescript
const ingredientName =
  asTrimmedString(item.userSegment) ??
  asTrimmedString(item.rawName) ??
  asTrimmedString(item.parsedName) ??
  asTrimmedString(item.name);
```

#### Step 3: Update `buildParsedFoodData` in `src/lib/foodParsing.ts`

Change the output field names (line 587-590):

```typescript
finalItems.push({
  parsedName: component.name.trim(),
  userSegment: item.original.trim(),
  canonicalName: component.canonicalName.trim(),
  resolvedBy: "registry" as const,
  // ... rest unchanged
});
```

#### Step 4: Update display components

Search for all references to `.name` and `.rawName` on food items in display components. Update to use new field names with fallback.

#### Step 5: Update all test files

Update food item fixtures in test files to use new field names.

#### Step 6: Run all tests + typecheck

```bash
bun run test:once && bun run typecheck
```

#### Step 7: Commit

```bash
git commit -m "refactor: rename food item fields for clarity

name -> parsedName (food name after quantity stripping)
rawName -> userSegment (comma-split piece of raw input)
Added resolvedBy field (registry | llm | user | expired).
Old field names kept in validator for backwards compatibility."
```

---

### Task 2: Add `rawInput` to food log data and save it from the client

**Files:**

- Modify: `convex/validators.ts:294-305` (add `rawInput` to `foodLogDataValidator`)
- Modify: `src/hooks/useFoodParsing.ts` (include `rawInput` when saving)
- Test: `convex/logs.test.ts`

#### Step 1: Write failing test

Add to `convex/logs.test.ts`:

```typescript
it("stores rawInput when adding a food log", async () => {
  const t = convexTest(schema);
  const userId = "test-user-raw";

  const logId = await t
    .withIdentity({ subject: userId })
    .mutation(api.logs.add, {
      timestamp: Date.now(),
      type: "food",
      data: {
        rawInput: "two toast, honey, butter",
        items: [
          {
            parsedName: "toast",
            userSegment: "two toast",
            quantity: 2,
            unit: null,
            canonicalName: "toast",
            resolvedBy: "registry",
          },
          {
            parsedName: "honey",
            userSegment: "honey",
            quantity: null,
            unit: null,
            canonicalName: "honey",
            resolvedBy: "registry",
          },
          {
            parsedName: "butter",
            userSegment: "butter",
            quantity: null,
            unit: null,
            canonicalName: "butter",
            resolvedBy: "registry",
          },
        ],
        notes: "",
      },
    });

  await t.run(async (ctx) => {
    const log = await ctx.db.get(logId);
    const data = log!.data as { rawInput?: string };
    expect(data.rawInput).toBe("two toast, honey, butter");
  });
});
```

#### Step 2: Run test to verify it fails

```bash
bun run test:once -- convex/logs.test.ts
```

Expected: validation error — `rawInput` not in validator.

#### Step 3: Add `rawInput` to validator

In `convex/validators.ts`, update `foodLogDataValidator`:

```typescript
const foodLogDataValidator = v.object({
  rawInput: v.optional(v.string()),
  items: v.array(foodItemValidator),
  notes: v.optional(v.string()),
  mealSlot: v.optional(
    v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack"),
    ),
  ),
});
```

#### Step 4: Include `rawInput` in client save

In `src/hooks/useFoodParsing.ts`, update `handleLogFood` (line 98-104):

```typescript
await addSyncedLog({
  timestamp: ts,
  type: "food",
  data: {
    rawInput: rawText,
    items: parsedFoodData.items,
    notes: trimmedNotes,
  },
});
```

#### Step 5: Run test to verify it passes

```bash
bun run test:once -- convex/logs.test.ts
```

#### Step 6: Typecheck

```bash
bun run typecheck
```

#### Step 7: Commit

```bash
git commit -m "feat: save rawInput with food logs

The user's original text is now stored immutably alongside parsed items.
Existing logs without rawInput are unaffected (field is optional)."
```

---

### Task 3: Extract shared parsing utilities to `shared/foodParsing.ts`

The deterministic parsing functions must be in `shared/` so both client and Convex server can use them. These deterministic functions handle the comma-present fast path. The LLM handles segmentation when commas are absent.

**Files:**

- Create: `shared/foodParsing.ts`
- Modify: `src/lib/foodParsing.ts` (import from shared)
- Test: `shared/__tests__/foodParsing.test.ts`

#### Functions to extract to `shared/foodParsing.ts`

From `src/lib/foodParsing.ts`:

- `sanitiseFoodInput(raw: string): string` (line 387)
- `splitRawFoodItems(text: string): string[]` (line 167)
- `parseLeadingQuantity(raw: string): { parsedName: string; quantity: number | null; unit: string | null }` (line 175)
- `buildDeterministicItem(...)` (line 331)
- Supporting constants: `COUNT_WORDS`, `SIZE_UNIT_MAP`, `MEASURE_UNIT_MAP` (lines 77-165)

#### Functions that stay in `src/lib/foodParsing.ts`

- `buildParsedFoodData()` — client-side data shaping
- `parseFood()` — orchestrator (eventually replaced by server action)

#### Step 1: Create `shared/foodParsing.ts`

Move the functions. Export them. Update imports to use `@shared/` paths for `canonicalizeKnownFoodName`, `normalizeFoodName`, etc.

#### Step 2: Update `src/lib/foodParsing.ts`

Replace local definitions with imports:

```typescript
import {
  sanitiseFoodInput,
  splitRawFoodItems,
  parseLeadingQuantity,
  buildDeterministicItem,
} from "@shared/foodParsing";
```

Delete the moved functions and constants from this file.

#### Step 3: Write tests for the extracted functions

Create `shared/__tests__/foodParsing.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  parseLeadingQuantity,
  sanitiseFoodInput,
  splitRawFoodItems,
} from "../foodParsing";

describe("sanitiseFoodInput", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitiseFoodInput("  toast ,  rice  ")).toBe("toast, rice");
  });
  it("strips leading punctuation", () => {
    expect(sanitiseFoodInput("/toast")).toBe("toast");
  });
});

describe("splitRawFoodItems", () => {
  it("splits on commas", () => {
    expect(splitRawFoodItems("toast, rice, chicken")).toEqual([
      "toast",
      "rice",
      "chicken",
    ]);
  });
  it("trims each item", () => {
    expect(splitRawFoodItems(" toast , rice ")).toEqual(["toast", "rice"]);
  });
  it("filters empty items", () => {
    expect(splitRawFoodItems("toast,,rice")).toEqual(["toast", "rice"]);
  });
});

describe("parseLeadingQuantity", () => {
  it("extracts numeric quantity with unit", () => {
    const result = parseLeadingQuantity("200g rice");
    expect(result.parsedName).toBe("rice");
    expect(result.quantity).toBe(200);
    expect(result.unit).toBe("g");
  });
  it("extracts word quantity", () => {
    const result = parseLeadingQuantity("two toast");
    expect(result.parsedName).toBe("toast");
    expect(result.quantity).toBe(2);
  });
  it("returns null quantity for bare food name", () => {
    const result = parseLeadingQuantity("chicken");
    expect(result.parsedName).toBe("chicken");
    expect(result.quantity).toBeNull();
  });
});
```

#### Step 4: Run all tests

```bash
bun run test:once && bun run typecheck
```

Verify: all existing tests still pass (the functions behave identically, just moved).

#### Step 5: Commit

```bash
git commit -m "refactor: extract deterministic parsing to shared/foodParsing.ts

sanitiseFoodInput, splitRawFoodItems, parseLeadingQuantity, and
buildDeterministicItem now in shared/ for use by both client and server."
```

---

### Task 4: Create server-side food processing mutation (display-only, no evidence)

The core change. A Convex mutation that reads `rawInput`, parses it, matches against registry, writes results back, and shows matched items as green on the Track page. NO `ingredientExposures` are created at this stage — the evidence engine waits 6 hours.

**Files:**

- Create: `convex/foodParsing.ts`
- Modify: `convex/logs.ts` (schedule action after food log insert)
- Test: `convex/foodParsing.test.ts`

#### Step 1: Write failing test

Create `convex/foodParsing.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("server-side food parsing", () => {
  it("parses deterministic foods and writes items back to log", async () => {
    const t = convexTest(schema);
    const userId = "test-user-parse";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "two toast, one banana, 125 grams of yogurt, honey",
          items: [],
          notes: "",
        },
      });

    await t
      .withIdentity({ subject: userId })
      .mutation(api.foodParsing.processLog, { logId });

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      const data = log!.data as {
        rawInput: string;
        items: Array<{
          parsedName: string;
          canonicalName?: string;
          resolvedBy?: string;
          quantity: number | null;
          unit: string | null;
        }>;
      };

      expect(data.rawInput).toBe(
        "two toast, one banana, 125 grams of yogurt, honey",
      );
      expect(data.items).toHaveLength(4);

      expect(data.items[0].parsedName).toBe("toast");
      expect(data.items[0].canonicalName).toBe("toast");
      expect(data.items[0].resolvedBy).toBe("registry");
      expect(data.items[0].quantity).toBe(2);

      expect(data.items[1].parsedName).toBe("banana");
      expect(data.items[1].canonicalName).toBe("ripe banana");
      expect(data.items[1].resolvedBy).toBe("registry");

      expect(data.items[2].parsedName).toBe("yogurt");
      expect(data.items[2].canonicalName).toBe("plain yogurt");
      expect(data.items[2].quantity).toBe(125);
      expect(data.items[2].unit).toBe("g");

      expect(data.items[3].parsedName).toBe("honey");
      expect(data.items[3].canonicalName).toBe("honey");
    });
  });

  it("does NOT create ingredientExposures at processing time (evidence waits 6 hours)", async () => {
    const t = convexTest(schema);
    const userId = "test-user-no-immediate-evidence";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "toast, honey",
          items: [],
          notes: "",
        },
      });

    await t
      .withIdentity({ subject: userId })
      .mutation(api.foodParsing.processLog, { logId });

    await t.run(async (ctx) => {
      // No exposures should exist yet — evidence waits 6 hours
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(0);

      // But items should be resolved in the log (display-only)
      const log = await ctx.db.get(logId);
      const data = log!.data as {
        items: Array<{ parsedName: string; canonicalName?: string }>;
      };
      expect(data.items).toHaveLength(2);
      expect(data.items[0].canonicalName).toBe("toast");
      expect(data.items[1].canonicalName).toBe("honey");
    });
  });

  it("flags unresolved items as pending without canonicalName", async () => {
    const t = convexTest(schema);
    const userId = "test-user-partial";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "toast, xylofruit",
          items: [],
          notes: "",
        },
      });

    await t
      .withIdentity({ subject: userId })
      .mutation(api.foodParsing.processLog, { logId });

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      const data = log!.data as {
        items: Array<{ parsedName: string; canonicalName?: string }>;
      };
      expect(data.items).toHaveLength(2);

      // Toast resolved for display
      expect(data.items[0].parsedName).toBe("toast");
      expect(data.items[0].canonicalName).toBe("toast");

      // Xylofruit unresolved
      expect(data.items[1].parsedName).toBe("xylofruit");
      expect(data.items[1].canonicalName).toBeUndefined();
    });
  });
});
```

#### Step 2: Run test to verify it fails

```bash
bun run test:once -- convex/foodParsing.test.ts
```

#### Step 3: Implement `convex/foodParsing.ts`

```typescript
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import {
  sanitiseFoodInput,
  splitRawFoodItems,
  parseLeadingQuantity,
} from "../shared/foodParsing";
import {
  canonicalizeKnownFoodName,
  getFoodZone,
} from "../shared/foodCanonicalization";

export const processLog = internalMutation({
  args: { logId: v.id("logs") },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log || log.type !== "food") return;

    const data = log.data as { rawInput?: string; items?: unknown[] };
    const rawInput = data.rawInput;
    if (!rawInput || typeof rawInput !== "string") return;

    const cleaned = sanitiseFoodInput(rawInput);
    const segments = splitRawFoodItems(cleaned);

    const items = segments.map((segment) => {
      const { parsedName, quantity, unit } = parseLeadingQuantity(segment);
      const canonical = canonicalizeKnownFoodName(parsedName);
      const zone = canonical !== null ? getFoodZone(canonical) : undefined;

      return {
        userSegment: segment,
        parsedName,
        ...(canonical !== null && {
          canonicalName: canonical,
          resolvedBy: "registry" as const,
        }),
        quantity,
        unit,
        ...(zone !== undefined && { recoveryStage: zone }),
      };
    });

    // Write items back to the log (display-only — no evidence yet)
    await ctx.db.patch(args.logId, {
      data: { ...data, items },
    });

    // If there are unresolved items, schedule LLM matching
    const unresolvedCount = items.filter(
      (item) => item.canonicalName === undefined,
    ).length;
    if (unresolvedCount > 0) {
      // Schedule LLM action for unresolved items
      // (wired in Task 5)
    }

    // Schedule 6-hour evidence processing for this log
    await ctx.scheduler.runAfter(
      6 * 60 * 60 * 1000,
      internal.foodParsing.processEvidence,
      { logId: args.logId },
    );
  },
});

export const processEvidence = internalMutation({
  args: { logId: v.id("logs") },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log || log.type !== "food") return;

    const data = log.data as {
      rawInput?: string;
      items?: Array<{
        canonicalName?: string;
        userSegment: string;
        parsedName: string;
        quantity: number | null;
        unit: string | null;
        recoveryStage?: number;
        resolvedBy?: string;
      }>;
    };
    if (!data.items) return;

    // Expire unresolved items to unknown_food
    const updatedItems = data.items.map((item) => {
      if (item.canonicalName !== undefined) return item;
      return { ...item, canonicalName: "unknown_food", resolvedBy: "expired" };
    });

    // Write updated items back
    await ctx.db.patch(args.logId, {
      data: { ...data, items: updatedItems },
    });

    // Create ingredientExposures for resolved items only
    for (let index = 0; index < updatedItems.length; index++) {
      const item = updatedItems[index];
      if (
        item.canonicalName === undefined ||
        item.canonicalName === "unknown_food"
      )
        continue;

      await ctx.db.insert("ingredientExposures", {
        userId: log.userId,
        logId: args.logId,
        itemIndex: index,
        logTimestamp: log.timestamp,
        ingredientName: item.userSegment,
        canonicalName: item.canonicalName,
        quantity: item.quantity,
        unit: item.unit,
        ...(item.recoveryStage !== undefined && {
          recoveryStage: item.recoveryStage,
        }),
        createdAt: Date.now(),
      });
    }
  },
});
```

#### Step 4: Wire `logs.add` to schedule processing

In `convex/logs.ts`, update the food log handling (lines 597-604):

```typescript
if (args.type === "food") {
  const foodData = data as { rawInput?: string; items?: unknown[] };
  if (
    foodData.rawInput &&
    (!foodData.items || (foodData.items as unknown[]).length === 0)
  ) {
    // New-style: raw text provided, items empty -> schedule processing
    await ctx.scheduler.runAfter(0, internal.foodParsing.processLog, { logId });
  } else {
    // Legacy path: items already provided (old client code)
    await rebuildIngredientExposuresForFoodLog(ctx, {
      userId,
      logId,
      timestamp: args.timestamp,
      data,
    });
  }
}
```

#### Step 5: Run tests

```bash
bun run test:once -- convex/foodParsing.test.ts convex/logs.test.ts
```

#### Step 6: Typecheck

```bash
bun run typecheck
```

#### Step 7: Commit

```bash
git commit -m "feat: server-side food parsing with display-only partial release

processLog reads rawInput, splits, does deterministic registry matching,
writes items back for display. No ingredientExposures created at this stage.
Evidence processing scheduled for 6 hours later via processEvidence."
```

---

### Task 5: LLM extraction, matching, and web search action

A Convex action that takes unresolved segments, sends them to the LLM for segmentation, matching, and web search, then writes results back.

**Files:**

- Create: LLM action in `convex/foodParsing.ts`
- Modify: `src/lib/foodLlmCanonicalization.ts` (simplify prompt)

#### Step 1: Create the LLM prompt

The prompt handles segmentation (for comma-free input), matching, AND web search:

```typescript
function buildMatchingPrompt(
  rawInput: string,
  unresolvedSegments: string[],
  registryVocabulary: string,
): string {
  return `You are matching food items to a food category registry for a digestive health tracker.

## The meal
The user logged: "${rawInput}"

## Unmatched segments
These segments could not be matched automatically:
${unresolvedSegments.map((s) => `- "${s}"`).join("\n")}

## Food category registry
${registryVocabulary}

## Your task
For each unmatched segment:
1. If it contains MULTIPLE distinct foods (e.g. "steak and chips with bacon dressing"), extract each food separately.
2. If you don't recognize a term, SEARCH THE WEB for it (brand names, regional foods, slang). Examples:
   - "Biscoff" → sweet biscuit brand → registry: "sweet biscuit"
   - "Kelitos" → breadstick snack → registry: "plain cracker"
3. Match each food to a canonical name from the registry. Include typo corrections (e.g. "baban" -> banana -> "ripe banana").
4. If a food genuinely cannot be matched to anything in the registry even after web search, mark it as NOT_ON_LIST.

Respond with JSON only:
{
  "results": [
    {
      "segment": "original segment text",
      "foods": [
        { "parsedName": "extracted food name", "canonical": "registry canonical" | "NOT_ON_LIST" }
      ]
    }
  ]
}`;
}
```

#### Step 2: Create the LLM action

Use `gpt-4o-mini-search-preview` or `gpt-5-search-api` for web search capability:

```typescript
export const matchUnresolvedItems = action({
  args: {
    logId: v.id("logs"),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Read log, find unresolved items
    // 2. Build prompt with full rawInput context + registry vocabulary
    // 3. Call OpenAI with gpt-4o-mini-search-preview (web search enabled)
    //    - LLM segments free-form text if needed
    //    - LLM matches each segment to registry (binary: match or NOT_ON_LIST)
    //    - LLM searches web for unknown terms before giving up
    // 4. Parse JSON response
    // 5. For each match: update item via internal mutation (display-only, no exposure)
    // 6. For NOT_ON_LIST items: leave as pending (user will handle or 6hr expiry)
  },
});
```

#### Step 3: Wire into processing flow

After `processLog` runs, if there are unresolved items AND an API key is available, schedule `matchUnresolvedItems`.

#### Step 4: Commit

```bash
git commit -m "feat: LLM extraction, matching, and web search for unresolved segments

Sends unresolved segments to OpenAI (gpt-4o-mini-search-preview) with full
meal context. LLM segments free-form text, matches to registry, and searches
the web for brand names/regional foods before giving up. Binary: match or
NOT_ON_LIST. No evidence created — display only."
```

---

### Task 6: Simplify `useFoodParsing.ts` — client saves raw text + rawInput editing modal

**Files:**

- Modify: `src/hooks/useFoodParsing.ts`
- Create: `src/components/track/RawInputEditModal.tsx`

#### Step 1: Simplify the hook

Replace the current complex flow with:

```typescript
const handleLogFood = async (
  items: ParsedItem[],
  notes: string,
  timestampMs?: number,
) => {
  const rawText = items.map((i) => i.name).join(", ");
  const trimmedNotes = notes.trim() || "";
  const ts = timestampMs ?? Date.now();

  await addSyncedLog({
    timestamp: ts,
    type: "food",
    data: {
      rawInput: rawText,
      items: [],
      notes: trimmedNotes,
    },
  });

  afterSave();
};
```

Remove: `parseFood`, `buildParsedFoodData`, `openAiApiKey` usage in parsing, `callAi` for food parsing, `foodLibrary`, `existingCanonicalNames`, `pendingParseCount`, `isParsingFood`, `pendingFoodDraft` localStorage mechanism.

The API key needs to be passed for LLM matching. Add it as a transient argument to the `logs.add` mutation (never stored in the log row).

#### Step 2: Add rawInput editing modal support

Create `RawInputEditModal.tsx` — a modal that:

- Shows the current `rawInput` text in an editable text field
- On save: replaces `rawInput` on the log and triggers full reprocessing from Stage 1
- The previous `rawInput` is not preserved (the user is making a conscious correction)

#### Step 3: Run all tests + typecheck + build

```bash
bun run test:once && bun run typecheck && bun run build
```

#### Step 4: Commit

```bash
git commit -m "refactor: client saves raw text only, no client-side parsing

useFoodParsing now sends raw text to server. All parsing happens
server-side via processLog + matchUnresolvedItems.
Added RawInputEditModal for user-initiated raw text corrections."
```

---

### Task 7: Handle resolved and unresolved items in Track page UI (display-only)

**Files:**

- Modify: Track page food log display components

#### Step 1: Display states

When a food log has `items: []` (empty, still processing):

- Show `rawInput` with a subtle pulsing indicator

When items exist with mixed resolution:

- Resolved items (have `canonicalName`): green indicator, normal display. These are display-only — no evidence implications until 6-hour processing.
- Unresolved items (`canonicalName === undefined`): amber highlight, "tap to match" prompt
- Expired items (`canonicalName === "unknown_food"`): grey/muted, amber icon, still tappable

Display-only default portions: if `quantity` is null and the registry has a `defaultPortion`, show a muted hint like "~2 sl" next to the item. This is never stored in data.

#### Step 2: Persistent toast notification

When any food log has unresolved items, show a persistent toast:

**Hours 0-3:** "Some foods couldn't be matched — tap to fix"
**Hours 3-6:** "Your entry has issues — [Fix now] [Dismiss]"

The toast links to the first unresolved item. Timestamps checked against `log.timestamp` vs `Date.now()`.

#### Step 3: Commit

```bash
git commit -m "feat: show resolved and unresolved items in Track page

Resolved items display green (display-only, no evidence implications).
Unresolved items show amber indicator. Display-only default portion hints.
Persistent toast for 6 hours prompting user to match unknown items."
```

---

### Task 8: Build the manual matching UI (registry dropdown + ticket submission)

**Files:**

- Create: `src/components/track/FoodMatchingModal.tsx`

#### Step 1: The modal

When the user taps an unresolved or expired item, open a modal showing:

1. The unresolved food name (e.g., "kelitos" or "baban")
2. The full meal context (the `rawInput`)
3. Three resolution options:

**Option A: Registry dropdown**

- Searchable dropdown of all registry canonical names (alphabetical)
- User types to filter, selects one
- That becomes the `canonicalName`, `resolvedBy: "user"`

**Option B: Edit raw text**

- Opens the `RawInputEditModal` (from Task 6)
- User corrects the text → triggers full reprocessing from Stage 1

**Option C: Request new category**

- "This food isn't in the registry" button
- Opens a ticket submission form: food name, description, any context
- Developer reviews and adds the appropriate digestive category to the registry

No zone x group matrix. No catch-all "other_X_zoneY" buckets. If it's not in the registry, the user asks for it to be added.

#### Step 2: The resolve mutation

```typescript
export const resolveItem = mutation({
  args: {
    logId: v.id("logs"),
    itemIndex: v.number(),
    canonicalName: v.string(),
  },
  handler: async (ctx, args) => {
    // Read log, update the specific item's canonicalName and resolvedBy
    // Do NOT create ingredientExposure here — evidence waits for 6-hour processing
    // If all items are now resolved, the 6-hour processing will handle them all
  },
});
```

#### Step 3: Commit

```bash
git commit -m "feat: manual food matching UI for unresolved items

Modal with registry dropdown and ticket submission for missing categories.
resolveItem mutation updates items for display. No catch-all buckets —
users request new registry entries via ticket."
```

---

### Task 9: Evidence processing at 6 hours

The scheduled mutation that processes the full meal into the evidence engine.

**Files:**

- Modify: `convex/foodParsing.ts` (refine `processEvidence` from Task 4)
- Test: `convex/foodParsing.test.ts`

#### Step 1: Refine `processEvidence`

At 6 hours, the scheduled mutation:

1. Reads all items from the log
2. Expires any still-unresolved items to `canonicalName: "unknown_food"`, `resolvedBy: "expired"`
3. Creates `ingredientExposures` for all resolved items (the full meal enters evidence together)
4. Marks the log as evidence-processed

This is when food enters the evidence engine. The Bayesian engine sees the complete meal composition — toast, butter, honey, and the kelitos that was resolved at hour 4 — all at once.

#### Step 2: Handle post-evidence edits

If a user edits a log that has already been evidence-processed:

1. Delete existing `ingredientExposures` for this log
2. Reprocess food items from the new `rawInput`
3. Create new `ingredientExposures` for resolved items
4. Recalculate affected food trial evidence

#### Step 3: Test

Add test cases:

```typescript
it("creates ingredientExposures at 6-hour mark for resolved items", async () => {
  // Setup log with resolved items
  // Run processEvidence
  // Verify exposures created
});

it("expires unresolved items to unknown_food at 6-hour mark", async () => {
  // Setup log with mix of resolved and unresolved items
  // Run processEvidence
  // Verify unresolved items now have canonicalName: "unknown_food"
  // Verify no exposures for unknown_food items
});
```

#### Step 4: Commit

```bash
git commit -m "feat: evidence processing at 6-hour mark

processEvidence creates ingredientExposures for resolved items and
expires unresolved items. Full meal enters evidence engine together.
Post-evidence edits supported: reprocesses and rebuilds exposures."
```

---

### Task 10: Filter unknown_food from evidence pipeline

**Files:**

- Modify: `shared/foodEvidence.ts`
- Modify: `convex/logs.ts` (rebuildIngredientExposuresForFoodLog)

#### Step 1: Filter in evidence pipeline

In `shared/foodEvidence.ts`, in `buildFoodTrials`, skip items with `canonicalName === "unknown_food"`:

```typescript
if (canonicalName === "unknown_food") continue;
```

#### Step 2: Filter in exposure creation

In `convex/logs.ts`, `rebuildIngredientExposuresForFoodLog` should also skip unknown_food items.

#### Step 3: Test

Add a test case verifying that unknown_food items don't create exposures and don't appear in evidence results.

#### Step 4: Commit

```bash
git commit -m "fix: filter unknown_food from evidence pipeline and exposure creation

Items that expired without resolution are ignored by the Bayesian
engine. Raw text stays visible in UI for historical reference."
```

---

### Task 11: End-to-end verification

**Files:** None (verification only)

#### Step 1: Run all tests

```bash
bun run test:once
```

#### Step 2: Typecheck + build

```bash
bun run typecheck && bun run build
```

#### Step 3: Manual browser testing

Test these scenarios:

1. "two toast, honey, butter" — all deterministic, instant green display, NO evidence until 6 hours
2. "two toast, xylofruit" — toast shows green immediately, xylofruit shows amber. No evidence for either until 6 hours.
3. Free-form voice input: "one banana two toasts and six kelitos and salt and pepper" — no commas, entire string goes to LLM for segmentation
4. Brand name: "two Biscoff biscuits" — LLM web searches, finds "sweet biscuit" match
5. Voice-to-text typo: "baban, tost" — LLM should correct both to banana, toast
6. Complex input without commas: "steak and chips with bacon dressing" — LLM should extract steak, chips, bacon dressing separately
7. Tap unresolved item → manual matching UI → match to registry → shows green (no evidence yet)
8. Submit ticket for unknown food → developer workflow
9. Edit raw text via modal → full reprocessing from Stage 1
10. Wait 6 hours (or trigger manually) → evidence processing runs, exposures created for resolved items, unresolved expire to unknown_food
11. Match an expired item after 6 hours → evidence recalculates
12. Edit an old log already in evidence engine → reprocesses, rebuilds exposures
13. Edit quantity on a resolved item → no full reprocessing
14. Existing old-format food logs still display correctly (backwards compatibility)

---

## Task ordering and dependencies

```
Task 1 (rename fields) --> Task 2 (rawInput) --> Task 3 (extract shared)
                                                       |
                                                       v
                                                 Task 4 (server processing, display-only)
                                                       |
                                                       v
                                                 Task 5 (LLM matching + web search)
                                                       |
                                                       v
                                                 Task 6 (simplify client + edit modal)
                                                       |
                                                       v
                                          Task 7 (Track UI) + Task 8 (matching modal) + Task 9 (evidence at 6hr)
                                                       |
                                                       v
                                                 Task 10 (evidence filter)
                                                       |
                                                       v
                                                 Task 11 (verification)
```

**Recommended execution order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

Tasks 1 and 2 can run in parallel (independent validator changes). Tasks 7, 8, and 9 can run in parallel (independent work).

---

## Revision history

- **v1 (2026-03-14):** Original plan with 6-hour auto-delete, total meal hold, default portions, raw text editing modal.
- **v2 (2026-03-14):** Revised after adversarial critique. Key changes:
  1. **No auto-delete** → unresolved items expire to `"unknown_food"`, data never destroyed
  2. **Partial release** → resolved items enter evidence pipeline immediately, not held by unresolved siblings
  3. **No default portions** → null quantity = 1 standard trial exposure in Bayesian engine. No invented data.
  4. **rawInput truly immutable** → no editing modal. Typo fixes via item-level manual matching.
  5. **LLM extracts components** from complex segments ("steak and chips" → 3 items), not just binary match
  6. Task count reduced from 11 to 10 (removed raw text editing modal and default portions task)
- **v3 (2026-03-14):** Revised after adversarial review against transit map design document. Key changes:
  1. **Partial release is display-only** — resolved items show green immediately but evidence engine waits 6 hours. Prevents partial meal data from corrupting transit correlations.
  2. **LLM segments free-form text** — comma splitting is fast path only. Voice input often has no commas. LLM handles segmentation.
  3. **LLM web search** — before giving up on unknown terms, LLM searches the web (brand names, regional foods). Uses `gpt-4o-mini-search-preview`.
  4. **Raw text is user-editable** — "system-immutable" not "user-immutable". User can edit via modal, triggers reprocessing. Old logs can be edited too (evidence recalculates).
  5. **Display-only default portions** — stored as null, shown as "~2 sl" in UI.
  6. **No catch-all buckets** — removed 12 "other_X_zoneY" entries. Users submit ticket for missing categories.
  7. **Editing old logs allowed** — reprocesses and rebuilds evidence. User is correcting their own data.
