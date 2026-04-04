# W0-02 Pipeline Integration: Cross-Validation Report

> Resolved from three independent agent analyses (Alpha, Beta, Gamma).
> Every factual claim cites `file:line` from the PDH repository root.

---

## 1. Consensus Findings

All three agents agree on the following:

### 1.1 Call sequence from user input to database

The food logging pipeline has one canonical entry point:

```
useFoodParsing.handleLogFood(notes, rawText, timestampMs?)
  -> addSyncedLog({ timestamp, type: "food", data: { rawInput, items: [], notes } })
    -> sanitizeLogData("food", data)         [src/lib/syncCore.ts:132-153]
    -> api.logs.add mutation                 [convex/logs.ts:819-858]
      -> if rawInput && items.length === 0:
           schedule processLogInternal       [convex/logs.ts:834-845]
      -> else: rebuildIngredientExposuresForFoodLog (legacy)
                                             [convex/logs.ts:846-854]
```

### 1.2 addSyncedLog signature

Defined at `src/lib/syncLogs.ts:42-49`:

```typescript
export function useAddSyncedLog() {
  const add = useMutation(api.logs.add);
  return (payload: {
    timestamp: number;
    type: SyncedLog["type"];
    data: LogPayloadData;
  }) =>
    add({
      timestamp: payload.timestamp,
      type: payload.type,
      data: sanitizeLogData(payload.type, payload.data),
    });
}
```

Re-exported from `src/lib/sync.ts` (barrel export).

### 1.3 mealSlot format

Lowercase string literals: `"breakfast" | "lunch" | "dinner" | "snack"`.
Confirmed at four independent locations:

| Location           | File:Line                      |
| ------------------ | ------------------------------ |
| Domain type        | `src/types/domain.ts:370`      |
| Convex validator   | `convex/validators.ts:377-384` |
| Server FoodLogData | `convex/foodParsing.ts:154`    |
| Client sanitizer   | `src/lib/syncCore.ts:151`      |

### 1.4 mealSlot is currently unused

`useFoodParsing.handleLogFood` does NOT pass `mealSlot` in its `addSyncedLog` call
(`src/hooks/useFoodParsing.ts:39-47`). The Nutrition Card will be the first consumer
to populate this field.

### 1.5 useFoodLlmMatching scope

The hook is mounted exclusively on the Track page (`src/pages/Track.tsx:38,119`).
If the Nutrition Card lives on a different route, LLM matching will not trigger
automatically for logs created from that route. The hook would need to be mounted
on that page too, or moved to a shared layout.

### 1.6 FoodMatchingModal trigger mechanism

All three agents agree on the lifecycle:

1. `useUnresolvedFoodQueue(logs)` builds pending item list (`src/hooks/useUnresolvedFoodQueue.ts:20-53`)
2. `useUnresolvedFoodToast(logs, now, onReview)` shows toast with "Review" button (`src/hooks/useUnresolvedFoodToast.ts:62-155`)
3. "Review" calls `handleReviewUnresolved` which sets `reviewQueueOpen = true` (`src/pages/Track.tsx:237-252`)
4. `FoodMatchingModal` opens in queue mode (`src/components/track/FoodMatchingModal.tsx:49-571`)
5. User picks canonical -> `resolveItem` mutation (`convex/foodParsing.ts:1649-1791`)

---

## 2. Resolved Contradictions

### 2.1 CRITICAL: Option A (pre-populate items) vs Option B (send rawInput + empty items)

**Agent Beta** recommends Option A. **Agents Alpha and Gamma** recommend Option B.

**Resolution: Option B is correct. Option A is unsound for the Nutrition Card.**

#### Evidence from source code

The branching logic in `logs.add` (`convex/logs.ts:834-854`):

```typescript
if (args.type === "food") {
  const foodData = data as { rawInput?: string; items?: unknown[] };
  if (
    foodData.rawInput &&
    (!foodData.items || (foodData.items as unknown[]).length === 0)
  ) {
    // New-style: raw text provided, items empty -> schedule server-side processing
    await ctx.scheduler.runAfter(0, internal.foodParsing.processLogInternal, {
      logId,
    });
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

If items are non-empty, the code takes the **legacy path** (line 846-853). This path
calls `rebuildIngredientExposuresForFoodLog` (`convex/logs.ts:271-305`) which:

1. Clears existing ingredient exposures for the log.
2. Calls `getCanonicalizedFoodItems(data)` (`convex/logs.ts:224-253`).
3. **Critically**: `getCanonicalizedFoodItems` validates that EVERY item has both
   an `ingredientName` (from `userSegment`, `rawName`, `parsedName`, or `name`)
   AND a non-empty `canonicalName` (`convex/logs.ts:240-250`). If ANY item lacks
   a `canonicalName`, the function returns `null` and NO exposures are created.
4. It does NOT schedule `processEvidence` (no 6-hour expiry).
5. It does NOT run the server-side matching pipeline (no fuzzy/embedding/LLM).
6. It does NOT set `itemsVersion` (stays `undefined`).
7. It does NOT learn aliases or schedule alias embedding.

#### Why Option A fails for the Nutrition Card

Agent Beta's rationale was that "the staging modal already has resolved canonical
names from the search/selection UI." But this assumes the staging UI will always
produce fully resolved items with valid `canonicalName` values. The current
Nutrition Card design (per the PRD) supports freeform text entry, not exclusively
registry selection.

Even if all items could be pre-resolved, Option A would:

- **Skip learned alias creation** -- the pipeline normally calls `upsertLearnedAlias`
  on resolved items. The legacy path does not.
- **Skip itemsVersion initialization** -- downstream hooks like `applyLlmResults`
  (`convex/foodParsing.ts:1420-1425`) rely on `itemsVersion` for optimistic
  concurrency. An undefined `itemsVersion` could cause silent bugs if the log is
  later edited.
- **Skip processEvidence scheduling** -- the 6-hour evidence window that creates
  `ingredientExposure` documents for resolved items through the standard pipeline
  path would not run.
- **Violate "Convex is the Boss"** -- CLAUDE.md explicitly states that Convex is
  the single source of truth. Pre-populating items on the client duplicates the
  server's matching logic.

#### Why Option B is correct

Option B sends `rawInput` with `items: []`, triggering the standard
`processLogInternal` pipeline. This path:

- Runs server-side fuzzy + embedding + LLM matching (best quality)
- Sets `itemsVersion` via `writeProcessedItems` (`convex/foodParsing.ts:695-703`)
- Learns aliases for resolved items
- Schedules `processEvidence` for the 6-hour window (`convex/foodParsing.ts:1349-1355`)
- Works with `useFoodLlmMatching` and `useUnresolvedFoodToast` automatically

### 2.2 Legacy path characterization

Agent Beta described the legacy path as "explicitly designed for pre-resolved items."
Agents Alpha and Gamma described it as vestigial ("old client code").

**Resolution: The legacy path is vestigial.** The comment in the source code at
`convex/logs.ts:847` literally reads: `"Legacy path: items already provided (old client code)"`.
It exists for backward compatibility with logs created before the server-side
matching pipeline was built. New code should NOT intentionally route through it.

---

## 3. Call Sequence Diagram (Definitive)

```
User types food text, clicks "Log Food" on Nutrition Card
  |
  v
[CLIENT] Nutrition Card composes call:
  |  addSyncedLog({
  |    timestamp: Date.now() or user-selected,
  |    type: "food",
  |    data: {
  |      rawInput: "chicken, 200g rice",     // <-- food text
  |      items: [],                           // <-- MUST be empty
  |      notes: "",                           // <-- optional
  |      mealSlot: "lunch",                  // <-- NEW from Nutrition Card
  |    }
  |  })
  |
  v
[CLIENT] sanitizeLogData("food", data)      [src/lib/syncCore.ts:132-153]
  |  - assertField(sanitized, "items")       // items is required
  |  - maps items through toConvexFoodItem   // no-op for empty array
  |  - conditional spread: rawInput, notes, mealSlot
  |
  v
[SERVER] logs.add mutation                   [convex/logs.ts:819-858]
  |  - requireAuth(ctx) -> userId
  |  - sanitizeUnknownStringsDeep(data)
  |  - ctx.db.insert("logs", {...}) -> logId
  |  - Detects: rawInput present + items.length === 0
  |  - ctx.scheduler.runAfter(0, processLogInternal, { logId })
  |
  v
[SERVER] processLogInternal (internalAction) [convex/foodParsing.ts:1239-1357]
  |  1. getFoodLogForProcessing(logId) -> { logId, userId, rawInput }
  |                                          [convex/foodParsing.ts:407-422]
  |  2. preprocessMealText(rawInput)
  |     -> splits "chicken, 200g rice" into phrases
  |                                          [shared/foodMatching.ts:233-254]
  |  3. Load user aliases, build FoodMatcherContext
  |  4. Fetch embeddings (if OPENAI_API_KEY available)
  |  5. Per phrase: fuzzy -> embedding -> merge -> confidence route
  |     - HIGH confidence -> toResolvedItem  [convex/foodParsing.ts:868-888]
  |     - LOW + ambiguous -> tryLlmFallback  [convex/foodParsing.ts:1151-1175]
  |     - else -> toPendingItem              [convex/foodParsing.ts:890-922]
  |  6. writeProcessedItems(logId, items)    [convex/foodParsing.ts:577-721]
  |     Patches log.data with: { ...existingData, items, itemsVersion }
  |     ** mealSlot preserved via spread **  [convex/foodParsing.ts:697-703]
  |  7. Schedule processEvidence (6 hours)   [convex/foodParsing.ts:1349-1355]
  |
  v
[CLIENT] Reactive hooks detect items (runs on Track page)
  |
  +---> useFoodLlmMatching                   [src/hooks/useFoodLlmMatching.ts:77-169]
  |     Condition: rawInput present AND items.length > 0 AND has unresolved items
  |                                          [src/hooks/useFoodLlmMatching.ts:58]
  |     Sends to: api.foodLlmMatching.matchUnresolvedItems
  |
  +---> useUnresolvedFoodToast               [src/hooks/useUnresolvedFoodToast.ts:62-155]
  |     Shows "Review" toast if unresolved items within 6-hour window
  |
  +---> useUnresolvedFoodQueue               [src/hooks/useUnresolvedFoodQueue.ts:20-53]
        Builds pending items list for FoodMatchingModal
```

---

## 4. addSyncedLog Specification

### Minimum viable call from Nutrition Card

```typescript
const addSyncedLog = useAddSyncedLog();

await addSyncedLog({
  timestamp: Date.now(), // or user-selected time
  type: "food",
  data: {
    rawInput: "chicken, 200g rice", // REQUIRED: raw text string
    items: [], // REQUIRED: must be empty array
    notes: "", // OPTIONAL: user notes
    mealSlot: "lunch", // OPTIONAL: new from Nutrition Card
  },
});
```

### Required fields breakdown

| Field      | Type                                      | Required | Constraint                                  |
| ---------- | ----------------------------------------- | -------- | ------------------------------------------- |
| `items`    | `FoodItem[]`                              | YES      | `assertField` throws if missing. Pass `[]`. |
| `rawInput` | `string`                                  | NO\*     | Must be set to trigger processLogInternal.  |
| `notes`    | `string`                                  | NO       | Conditional spread in sanitizer.            |
| `mealSlot` | `"breakfast"\|"lunch"\|"dinner"\|"snack"` | NO       | Conditional spread in sanitizer. New field. |

\*rawInput is technically optional in the type system but functionally required
for the server pipeline to fire. Without it, the legacy path executes.

### Return value

`addSyncedLog` returns `Promise<Id<"logs">>` -- the inserted document ID from
`api.logs.add` (`convex/logs.ts:856`).

---

## 5. mealSlot Handling Through the Pipeline

### Is mealSlot preserved through writeProcessedItems?

**Yes.** The `writeProcessedItems` handler (`convex/foodParsing.ts:697-703`) spreads
the existing `data` before overwriting `items` and `itemsVersion`:

```typescript
const data = log.data as FoodLogData;
const nextVersion = (data.itemsVersion ?? 0) + 1;

await ctx.db.patch(args.logId, {
  data: {
    ...data, // <-- preserves mealSlot, rawInput, notes, etc.
    items: args.items,
    itemsVersion: nextVersion,
  } as typeof log.data,
});
```

The spread `...data` copies all existing fields from the log's data object,
including `mealSlot` if it was set during `logs.add`. Only `items` and
`itemsVersion` are overwritten.

### Pipeline touchpoints for mealSlot

1. **Client sanitizer** (`src/lib/syncCore.ts:151`): passes through via conditional spread
2. **logs.add** (`convex/logs.ts:828-832`): stored as part of the `data` field
3. **getFoodLogForProcessing** (`convex/foodParsing.ts:407-422`): does NOT extract mealSlot
   (only returns `logId`, `userId`, `rawInput`) -- this is fine because mealSlot is
   not needed for food matching
4. **writeProcessedItems** (`convex/foodParsing.ts:697-703`): preserves via `...data` spread
5. **applyLlmResults** (`convex/foodParsing.ts:1363-1550`): also uses `...data` spread pattern

**Conclusion:** mealSlot set at creation time survives all pipeline mutations.

---

## 6. FoodMatchingModal Lifecycle (Definitive)

### Trigger path

```
processLogInternal writes items with unresolved entries
  |
  v (Convex subscription updates SyncedLogs context)
  |
  +---> useUnresolvedFoodQueue(logs)         [src/hooks/useUnresolvedFoodQueue.ts:20-53]
  |     - Iterates food logs, checks getFoodItemResolutionStatus(item)
  |     - Status "pending": no valid canonicalName AND resolvedBy !== "expired"
  |     - Builds UnresolvedQueueItem[]: { logId, itemIndex, foodName, rawInput, item }
  |
  +---> useUnresolvedFoodToast(logs, nowMs, onReview)
  |                                          [src/hooks/useUnresolvedFoodToast.ts:62-155]
  |     - Scans food logs within 6-hour window
  |     - Hours 0-3: gentle toast
  |     - Hours 3-6: urgent toast
  |     - "Review" button calls onReview callback
  |
  v
  handleReviewUnresolved -> setReviewQueueOpen(true)
                                             [src/pages/Track.tsx:237-252]
  |
  v
  FoodMatchingModal opens with queue={unresolvedQueue}
                                             [src/components/track/FoodMatchingModal.tsx:49-571]
  |  - Queue mode: iterates items one at a time (queueIndex state)
  |  - Shows matchCandidates + bucketOptions (pre-computed by processLogInternal)
  |  - Server-side search via api.foodParsing.searchFoods
  |  - "Match" -> resolveItem mutation
  |  - "Skip" -> advance to next item
  |
  v
  resolveItem mutation                       [convex/foodParsing.ts:1649-1791]
  - Sets resolvedBy: "user", matchStrategy: "user", matchConfidence: 1
  - Clears matchCandidates + bucketOptions
  - Upserts learned alias
  - Schedules embedAliasInternal
  - Adds to knownFoods
```

### Parallel LLM path

`useFoodLlmMatching` (`src/hooks/useFoodLlmMatching.ts:77-169`) runs independently.
Its detection condition (`src/hooks/useFoodLlmMatching.ts:58`):

```typescript
if (!foodLog.data.rawInput || foodLog.data.items.length === 0) continue;
```

This means it only fires AFTER `processLogInternal` has written items (items must
be non-empty). An item is considered unresolved for LLM purposes if
(`src/hooks/useFoodLlmMatching.ts:31-39`):

```typescript
function isItemUnresolvedForLlm(item: FoodItem): boolean {
  if (item.canonicalName != null && item.canonicalName.length > 0) return false;
  if (item.resolvedBy != null) return false;
  return true;
}
```

Both `canonicalName` must be empty/null AND `resolvedBy` must be null. Once any
resolution path sets either field, the LLM hook skips that item.

---

## 7. Assumptions Requiring Validation

Merged and deduplicated from all three agents. Resolvable ones are marked as resolved.

### RESOLVED

| #   | Assumption                                               | Resolution                                                                                                                                                                                       |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | mealSlot preserved through writeProcessedItems           | **Confirmed.** The `...data` spread at `convex/foodParsing.ts:699` preserves all existing data fields.                                                                                           |
| R2  | rawInput reconstruction handles comma separation         | **Confirmed.** `splitMealIntoFoodPhrases` (`shared/foodMatching.ts:205-217`) splits on commas, semicolons, slashes, ampersands, and conjunctions.                                                |
| R3  | Legacy path is designed for pre-resolved items           | **Corrected.** It is vestigial code for old clients, not a designed pre-resolution path. The source comment at `convex/logs.ts:847` says "old client code."                                      |
| R4  | processLogInternal scheduling is immediate               | **Confirmed.** `ctx.scheduler.runAfter(0, ...)` means "as soon as possible" but is asynchronous. Expect 50-200ms latency. UI must handle `items: []` intermediate state.                         |
| R5  | useFoodLlmMatching skip condition for pre-resolved items | **Confirmed.** `isItemUnresolvedForLlm` (`src/hooks/useFoodLlmMatching.ts:31-39`) checks for empty canonicalName AND null resolvedBy. Pre-resolved items with canonicalName set will be skipped. |

### UNRESOLVED -- Require Runtime or Dashboard Verification

| #   | Assumption                                                                                  | Impact                                                                                                                                                  | Verification Method                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| U1  | mealSlot has never been populated in production data                                        | Low. If existing logs have mealSlot, Nutrition Card is not the "first consumer" but behavior is unchanged.                                              | Dashboard query: check for any food logs where `data.mealSlot` is defined.                                                          |
| U2  | useFoodLlmMatching must be mounted on the Nutrition Card's page if it is NOT the Track page | High. If the Nutrition Card is on a separate route, LLM matching will not fire for logs created there.                                                  | Check the Nutrition Card's route. If separate from Track, mount `useFoodLlmMatching` there or move it to a shared layout component. |
| U3  | processEvidence handles concurrent log submissions                                          | Low. Each `processLogInternal` schedules its own `processEvidence` independently. Optimistic concurrency via `itemsVersion` protects against conflicts. | No action needed unless concurrent editing is observed as a bug.                                                                    |
| U4  | Legacy path's `rebuildIngredientExposuresForFoodLog` handles ProcessedFoodItem shape        | Low (if Option B is used, the legacy path is never hit).                                                                                                | N/A -- Option B avoids the legacy path entirely.                                                                                    |
| U5  | sanitizeLogData food branch is complete for Nutrition Card                                  | Low. Currently supports `items`, `rawInput`, `notes`, `mealSlot` -- all fields the Nutrition Card needs.                                                | If new fields are added to FoodLogData, they must be added to the conditional spread block at `src/lib/syncCore.ts:147-152`.        |
