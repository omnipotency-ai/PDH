# W0-02 Pipeline Analysis -- Agent Alpha

> Research agent output for cross-validation. Answers 5 questions about the
> food parsing pipeline with exact file paths, function signatures, and line
> numbers.

---

## 1. Full text-to-log flow: "chicken, 200g rice" -> Log Food

### Call sequence diagram (ASCII)

```
User types "chicken, 200g rice", clicks Log Food
  |
  v
[CLIENT] FoodSection form calls handleLogFood(notes, rawText, timestampMs?)
  |  src/hooks/useFoodParsing.ts:32
  |
  v
[CLIENT] useFoodParsing.handleLogFood()
  |  Trims notes, sets ts = timestampMs ?? Date.now()
  |  Calls addSyncedLog({ timestamp, type: "food", data: { rawInput, items: [], notes } })
  |  src/hooks/useFoodParsing.ts:39-47
  |
  v
[CLIENT] useAddSyncedLog() -- returns a wrapper around api.logs.add mutation
  |  src/lib/syncLogs.ts:42-49
  |  Calls sanitizeLogData("food", data) before sending to Convex
  |  src/lib/syncCore.ts:132-153 -- converts FoodItem null->undefined for canonicalName,
  |    includes mealSlot if present via conditional spread
  |
  v
[SERVER] logs.add mutation
  |  convex/logs.ts:819-857
  |  Auth check, sanitize, insert into "logs" table
  |  Detects: type === "food" && rawInput present && items.length === 0
  |  Schedules: ctx.scheduler.runAfter(0, internal.foodParsing.processLogInternal, { logId })
  |  convex/logs.ts:834-845
  |
  v
[SERVER] foodParsing.processLogInternal (internalAction)
  |  convex/foodParsing.ts:1239-1357
  |  1. Reads log snapshot via getFoodLogForProcessing (line 407-422)
  |  2. Runs preprocessMealText(rawInput) -> PreprocessedFoodPhrase[]
  |     shared/foodMatching.ts:233-254
  |     - splitMealIntoFoodPhrases: splits on comma/and/with/semicolon
  |     - parseLeadingQuantity per phrase (shared/foodParsing.ts:172-289)
  |     - normalizeFoodMatchText per phrase
  |  3. Loads learned aliases via listFoodAliasesForUser (line 1259-1264)
  |  4. Creates FoodMatcherContext with createFoodMatcherContext(aliases)
  |     shared/foodMatching.ts:358-392
  |  5. Fetches phrase embeddings from OpenAI (if API key available, lines 1267-1282)
  |  6. Per phrase:
  |     a. fuzzySearchFoodCandidates (shared/foodMatching.ts:427-449)
  |     b. searchEmbeddingCandidates via vectorSearch (line 1114-1149)
  |     c. mergeFoodMatchCandidates (shared/foodMatching.ts:562-625)
  |     d. routeFoodMatchConfidence -> { level: "high"|"medium"|"low", ... }
  |        shared/foodMatching.ts:666-715
  |     e. If high confidence -> toResolvedItem (line 868-888)
  |     f. If low + structurally ambiguous -> tryLlmFallback (line 1151-1175)
  |     g. Otherwise -> toPendingItem (line 890-922)
  |  7. Writes items via writeProcessedItems mutation (line 577-721)
  |  8. Schedules processEvidence after 6 hours (line 1349-1355)
  |
  v
[CLIENT] useFoodLlmMatching hook (runs on Track page)
  |  src/hooks/useFoodLlmMatching.ts:77-169
  |  Monitors logs for food entries with unresolved items (no canonicalName, no resolvedBy)
  |  Within 6-hour window, fires matchUnresolvedItems action once per log ID
  |  Sends: { logId, rawInput, unresolvedSegments }
  |
  v
[SERVER] foodLlmMatching.matchUnresolvedItems (action)
  |  convex/foodLlmMatching.ts:542-719
  |  1. Auth + resolve API key (server profile or client fallback)
  |  2. Read itemsVersion for optimistic concurrency (line 597-606)
  |  3. Fuzzy pre-match via Fuse.js (threshold 0.15) -- skips LLM for trivial matches
  |     convex/foodLlmMatching.ts:214-246
  |  4. Build LLM prompt with full registry vocabulary (line 267-318)
  |  5. Call OpenAI gpt-4.1-nano (line 639-654)
  |  6. Parse + validate JSON response (line 328-409)
  |  7. Post-process: verify against registry, deterministic fallback (line 425-501)
  |  8. Write via applyLlmResults mutation (line 698-712)
  |     convex/foodParsing.ts:1363-1549
  |
  v
[CLIENT] useUnresolvedFoodToast detects remaining unresolved items
  |  src/hooks/useUnresolvedFoodToast.ts:62-155
  |  Shows persistent warning toast with "Review" action button
  |
  v
[CLIENT] User taps "Review" -> opens FoodMatchingModal in queue mode
  |  src/pages/Track.tsx:237-253, 649-653
  |  src/components/track/FoodMatchingModal.tsx:49-571
  |
  v
[SERVER] foodParsing.resolveItem mutation (user picks canonical)
  |  convex/foodParsing.ts:1649-1748+
  |  Sets resolvedBy: "user", learns alias, schedules embedAliasInternal
```

### Return values at each step

| Step                 | Function                 | Returns                                     |
| -------------------- | ------------------------ | ------------------------------------------- |
| handleLogFood        | `useFoodParsing.ts:32`   | `Promise<void>`                             |
| addSyncedLog         | `syncLogs.ts:43-49`      | `Promise<Id<"logs">>` (from `api.logs.add`) |
| logs.add             | `logs.ts:819`            | `Id<"logs">`                                |
| processLogInternal   | `foodParsing.ts:1239`    | `void` (scheduled action)                   |
| matchUnresolvedItems | `foodLlmMatching.ts:542` | `{ matched: number, unresolved: number }`   |
| resolveItem          | `foodParsing.ts:1649`    | `void`                                      |

---

## 2. Staging integration: Option A vs Option B

### What the existing pipeline supports

**Option B (reconstruct rawInput) is the current architecture.** The pipeline
is designed around a single entry point:

```typescript
// src/hooks/useFoodParsing.ts:39-47
await addSyncedLog({
  timestamp: ts,
  type: "food",
  data: {
    rawInput: rawText, // <-- raw text string
    items: [], // <-- always empty on creation
    notes: trimmedNotes,
  },
});
```

The `logs.add` mutation (convex/logs.ts:834-845) checks:

```
if (foodData.rawInput && (!foodData.items || items.length === 0))
```

...and only schedules `processLogInternal` when items is empty. If items are
pre-populated, it falls through to the **legacy path** which does NOT run the
matching pipeline at all -- it just creates ingredient exposures directly.

### Option A analysis (pre-populate with matched canonicals)

Option A would require:

- Skipping `processLogInternal` entirely (items already populated)
- Writing items in the exact `WriteProcessedFoodItem` shape (convex/foodParsing.ts:104-148)
- Including all required fields: `userSegment`, `parsedName`, `quantity`, `unit`,
  `canonicalName`, `resolvedBy`, `recoveryStage`
- Manually scheduling `processEvidence` for the 6-hour window
- The legacy path in `logs.add` only calls `rebuildIngredientExposuresForFoodLog`,
  which has a different contract than processLogInternal

**Option A is technically possible but NOT recommended.** It would duplicate the
pipeline's writeback logic on the client and bypass the server-side matching
quality (embeddings, learned aliases, confidence routing).

### Recommendation

**Use a hybrid of Option A and Option B:**

1. The staging modal's "Log Food" button should call `addSyncedLog` with
   `rawInput` set to the original raw text, `items: []`, and optionally
   `mealSlot` and `notes`.
2. This triggers the standard `processLogInternal` server pipeline.
3. The staging modal should NOT try to pre-populate items or bypass the pipeline.
4. If the Nutrition Card later wants to add `mealSlot`, it passes it in the
   `data` object -- the sanitizer (syncCore.ts:151) already handles it.

**Critical: the `mealSlot` field is the ONLY new data the Nutrition Card adds
to the pipeline.** Everything else (rawInput, items, notes) already exists.

---

## 3. FoodMatchingModal trigger: unresolved item lifecycle

### Step-by-step trace

**Step 1: useUnresolvedFoodQueue builds the queue**

- File: `src/hooks/useUnresolvedFoodQueue.ts:20-53`
- Iterates all logs where `type === "food"`
- For each food item, calls `getFoodItemResolutionStatus(item)` (from
  `src/components/track/today-log/helpers`)
- Includes items with status `"pending"` only (not "expired" or "resolved")
- Returns `UnresolvedQueueItem[]` with: `logId`, `itemIndex`, `foodName`,
  `rawInput`, `logTimestamp`, `logNotes`, `item`

**Step 2: useUnresolvedFoodToast shows notification**

- File: `src/hooks/useUnresolvedFoodToast.ts:62-155`
- Signature: `useUnresolvedFoodToast(logs: SyncedLog[], nowMs: number, onReview?: () => void): void`
- Scans for food logs within 6-hour window with unresolved items
- Hours 0-3: gentle message ("couldn't be matched")
- Hours 3-6: urgent message ("still unmatched", dismissible)
- Toast has "Review" action button that calls `onReview` callback
- Auto-dismisses when all items resolve or window closes

**Step 3: Toast "Review" -> opens modal**

- File: `src/pages/Track.tsx:237-253`
- `handleReviewUnresolved` callback sets `setReviewQueueOpen(true)`
- This opens `FoodMatchingModal` with `queue={unresolvedQueue}` prop

**Step 4: FoodMatchingModal processes queue**

- File: `src/components/track/FoodMatchingModal.tsx:49-571`
- When `queue` prop is provided and non-empty, enters "queue mode" (line 75)
- Iterates through queue items via `queueIndex` state
- For each item, shows candidates from `item.matchCandidates` and
  `item.bucketOptions` (pre-computed by processLogInternal)
- Uses `api.foodParsing.searchFoods` query for server-side search (line 95-104)
- "Match" button calls `resolveItem` mutation (line 159-199)
- On success, advances to next queue item or closes if done

**Step 5: resolveItem mutation**

- File: `convex/foodParsing.ts:1649-1748+`
- Validates item is not expired or already resolved
- Sets `resolvedBy: "user"`, `matchStrategy: "user"`, `matchConfidence: 1`
- Clears `matchCandidates` and `bucketOptions`
- Learns alias via `upsertLearnedAlias`
- Schedules `embedAliasInternal` to embed the alias for future vector search
- Adds to `knownFoods`

### Parallel path: useFoodLlmMatching

The LLM matching hook (`src/hooks/useFoodLlmMatching.ts:77-169`) runs
independently on the Track page. It monitors the same logs and fires
`matchUnresolvedItems` for logs with unresolved items. If the LLM resolves
items, the toast/queue automatically update because both hooks react to the
same `logs` data from `useSyncedLogsContext`.

---

## 4. mealSlot field format

**Format: lowercase strings.** Confirmed at three levels:

| Location              | Definition                                                                                                 | Line                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Domain type           | `mealSlot?: "breakfast" \| "lunch" \| "dinner" \| "snack"`                                                 | src/types/domain.ts:370      |
| Convex validator      | `v.optional(v.union(v.literal("breakfast"), v.literal("lunch"), v.literal("dinner"), v.literal("snack")))` | convex/validators.ts:377-384 |
| Server-side type      | `mealSlot?: "breakfast" \| "lunch" \| "dinner" \| "snack"`                                                 | convex/foodParsing.ts:154    |
| Sanitizer passthrough | `...(d.mealSlot !== undefined && { mealSlot: d.mealSlot })`                                                | src/lib/syncCore.ts:151      |

**Where it is set in the pipeline:**

Currently, `mealSlot` is **NOT set anywhere in the active food logging flow**.
The field exists in the schema and type system but `useFoodParsing.handleLogFood`
does not pass it (src/hooks/useFoodParsing.ts:39-47). The Nutrition Card will be
the **first consumer** to actually populate this field.

To set it, the Nutrition Card must include `mealSlot` in the `data` object
passed to `addSyncedLog`:

```typescript
await addSyncedLog({
  timestamp: ts,
  type: "food",
  data: {
    rawInput: rawText,
    items: [],
    notes: trimmedNotes,
    mealSlot: "breakfast", // <-- new field from Nutrition Card
  },
});
```

The sanitizer at `syncCore.ts:151` already passes it through via conditional
spread, so no pipeline changes are needed.

---

## 5. addSyncedLog: exact signature and required fields

### Definition

```typescript
// src/lib/syncLogs.ts:42-49
export function useAddSyncedLog() {
  const add = useMutation(api.logs.add);
  return (payload: {
    timestamp: number;
    type: SyncedLog["type"]; // "food" | "fluid" | "digestion" | "habit" | "activity" | "weight"
    data: LogPayloadData;
  }) =>
    add({
      timestamp: payload.timestamp,
      type: payload.type,
      data: sanitizeLogData(payload.type, payload.data),
    });
}
```

### Re-export path

- Hook: `useAddSyncedLog` defined at `src/lib/syncLogs.ts:42`
- Re-exported from: `src/lib/sync.ts:72`
- Import used in useFoodParsing: `import { useAddSyncedLog } from "@/lib/sync"` (line 2)

### Required fields for type='food'

The `sanitizeLogData("food", data)` path at `src/lib/syncCore.ts:139-153`
requires:

| Field      | Type                                            | Required?     | Notes                                                                         |
| ---------- | ----------------------------------------------- | ------------- | ----------------------------------------------------------------------------- |
| `items`    | `FoodItem[]`                                    | YES           | Must be present (assertField check). Pass `[]` for new-style logs.            |
| `rawInput` | `string`                                        | NO (optional) | But MUST be set to trigger server pipeline. Without it, falls to legacy path. |
| `notes`    | `string`                                        | NO (optional) | Included via conditional spread if present.                                   |
| `mealSlot` | `"breakfast" \| "lunch" \| "dinner" \| "snack"` | NO (optional) | Included via conditional spread if present.                                   |

### Critical contract for triggering the pipeline

The server-side detection in `logs.add` (convex/logs.ts:834-845):

```typescript
if (foodData.rawInput && (!foodData.items || items.length === 0)) {
  // schedules processLogInternal
}
```

**Both conditions must hold:**

1. `rawInput` must be a non-empty string
2. `items` must be empty (`[]`) or absent

If items are pre-populated, the legacy path runs instead (no matching pipeline).

---

## Assumptions Requiring Validation

1. **mealSlot first-use assumption:** This analysis assumes `mealSlot` has never
   been populated in production data. If any existing logs have `mealSlot` set
   (e.g., from a previous experiment or import), the Nutrition Card's use of it
   would not be the first. Verify with: `npx convex run --help` or dashboard query.

2. **useFoodParsing is the only client entry point:** The analysis traces from
   `useFoodParsing.handleLogFood` but the Track page may have other code paths
   (e.g., quick capture, voice logging) that call `addSyncedLog` with
   `type: "food"` differently. The Nutrition Card should use `useFoodParsing`
   (or a derivative) to stay on the standard path.

3. **processLogInternal scheduling is immediate:** `ctx.scheduler.runAfter(0, ...)`
   means "as soon as possible" but Convex scheduling is not synchronous. There
   may be a 50-200ms delay before items appear. The UI must handle the
   "items: []" intermediate state gracefully.

4. **LLM matching hook scope:** `useFoodLlmMatching` runs on the Track page.
   If the Nutrition Card is rendered on a different page/route, LLM matching
   may not trigger automatically. Confirm whether the hook needs to be added
   to the Nutrition Card's page component.

5. **sanitizeLogData food branch completeness:** The sanitizer at
   syncCore.ts:139-153 builds the Convex-compatible payload. If the Nutrition
   Card introduces additional data fields beyond `mealSlot`, each must be added
   to the sanitizer's conditional spread block.

6. **Legacy path vs new path:** The `logs.add` handler has two branches. The
   Nutrition Card MUST pass `items: []` to trigger the new pipeline. If it
   accidentally passes pre-populated items (even from staging), it will hit the
   legacy `rebuildIngredientExposuresForFoodLog` path which skips the matching
   pipeline entirely.
