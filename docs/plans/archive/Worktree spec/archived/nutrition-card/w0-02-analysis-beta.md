# W0-02 Food Pipeline Analysis (Agent Beta)

## 1. Full Text-to-Log Flow

When the user types "chicken, 200g rice" and hits Log Food, the following
exact call sequence fires:

### Call Sequence Diagram (ASCII)

```
User types "chicken, 200g rice" → hits Log Food
    |
    v
[1] FoodSection component calls handleLogFood(notes, rawText, timestampMs?)
    ↓  (Track.tsx:263-265)
    v
[2] useFoodParsing.handleLogFood(notes, rawText, timestampMs?)
    │  (src/hooks/useFoodParsing.ts:32)
    │  - trimmedNotes = notes.trim() || ""
    │  - ts = timestampMs ?? Date.now()
    v
[3] addSyncedLog({ timestamp: ts, type: "food", data: { rawInput, items: [], notes } })
    │  (src/hooks/useFoodParsing.ts:39-47)
    │  addSyncedLog = useAddSyncedLog() (src/lib/syncLogs.ts:42-49)
    │  Internally wraps api.logs.add mutation
    │  sanitizeLogData("food", data) runs first (src/lib/syncCore.ts:132-153)
    │    → converts null canonicalName→undefined via toConvexFoodItem()
    │    → conditionally spreads rawInput, notes, mealSlot
    v
[4] convex/logs.ts → add mutation (convex/logs.ts:819-858)
    │  - requireAuth(ctx) → userId
    │  - sanitizeUnknownStringsDeep(args.data)
    │  - ctx.db.insert("logs", { userId, timestamp, type: "food", data })
    │  - Detects: rawInput present + items empty → NEW-STYLE path
    │  - ctx.scheduler.runAfter(0, internal.foodParsing.processLogInternal, { logId })
    v
[5] processLogInternal (convex/foodParsing.ts:1239-1357) — internalAction
    │  5a. getFoodLogForProcessing(logId) → { logId, userId, rawInput }
    │  5b. preprocessMealText(rawInput) → PreprocessedFoodPhrase[]
    │      (shared/foodMatching.ts:233-254)
    │      - splitMealIntoFoodPhrases("chicken, 200g rice") → ["chicken", "200g rice"]
    │      - parseLeadingQuantity per phrase → { parsedName, quantity, unit, ... }
    │  5c. listFoodAliasesForUser(userId) → LearnedFoodAlias[]
    │  5d. createFoodMatcherContext(aliases) → FoodMatcherContext
    │  5e. ensureFoodEmbeddings(ctx) — seeds/refreshes vector index
    │  5f. fetchOpenAiEmbeddings(parsedNames, apiKey) — if embeddings+key available
    │  5g. FOR EACH phrase:
    │      - fuzzySearchFoodCandidates(parsedName, matcherContext)
    │      - searchEmbeddingCandidates(ctx, embedding)
    │      - mergeFoodMatchCandidates(fuzzy, embedding, context)
    │      - routeFoodMatchConfidence(phrase, merged) → ConfidenceRoute
    │        {level: "high"|"medium"|"low", topCandidate, candidates, buckets}
    │      - If HIGH confidence: toResolvedItem → auto-matched (resolvedBy: "registry")
    │      - If LOW + structurally ambiguous: tryLlmFallback → if match, resolvedBy: "llm"
    │      - Else: toPendingItem(phrase, route) — item stored with candidates + buckets
    │  5h. writeProcessedItems(logId, items) — writes items + bumps itemsVersion
    │  5i. scheduler.runAfter(EVIDENCE_WINDOW_MS, processEvidence, { logId })
    │      (6 hours later: expires unresolved items, creates ingredientExposures)
    v
[6] afterSave() → celebrateLog() (Track.tsx:255-257)
    │  (confetti animation)
    v
[7] CLIENT-SIDE REACTIVE HOOKS (run continuously via useEffect):
    │
    ├── useFoodLlmMatching() (src/hooks/useFoodLlmMatching.ts:77-169)
    │   - Monitors logs for items with no canonicalName AND no resolvedBy
    │   - Calls server action: api.foodLlmMatching.matchUnresolvedItems
    │     Args: { logId, rawInput, unresolvedSegments }
    │   - Server: fuzzyPreMatch → LLM (OpenAI) → applyLlmResults mutation
    │   - Toast: "Matching foods with AI..." → "X food(s) matched automatically"
    │
    ├── useUnresolvedFoodToast(logs, nowMs, onReview)
    │   (src/hooks/useUnresolvedFoodToast.ts:62-155)
    │   - Shows persistent warning toast for unresolved items within 6-hour window
    │   - Hours 0-3: gentle message, Hours 3-6: urgent message with Review button
    │
    └── useUnresolvedFoodQueue(logs) → UnresolvedQueueItem[]
        (src/hooks/useUnresolvedFoodQueue.ts:20-53)
        - Builds flat list of pending items for FoodMatchingModal
```

### Return Values

| Step | Function               | Returns                                     |
| ---- | ---------------------- | ------------------------------------------- |
| 3    | `addSyncedLog()`       | `Promise<Id<"logs">>` (from `api.logs.add`) |
| 4    | `logs.add` mutation    | `Id<"logs">` (the inserted document ID)     |
| 5    | `processLogInternal`   | `void` (scheduled, no return to caller)     |
| 7    | `matchUnresolvedItems` | `{ matched: number, unresolved: number }`   |

---

## 2. Staging Integration Analysis

### Option A: Pre-populate items with matched canonicals

The Nutrition card's staging modal would hold a list of `{ parsedName, canonicalName, quantity, unit, recoveryStage }` items. On "Log Food", it would pass these
pre-resolved items directly to `addSyncedLog` with both `rawInput` and populated `items[]`.

**Pipeline support:** The `logs.add` mutation at `convex/logs.ts:834-854` checks:

```
if (foodData.rawInput && (!foodData.items || items.length === 0))
  → schedule processLogInternal
else
  → legacy path: rebuildIngredientExposuresForFoodLog
```

If `items[]` is non-empty, the server takes the LEGACY PATH and does NOT run `processLogInternal`. It directly builds ingredient exposures from the provided items. This means items must already have canonical names, quantities, etc.

### Option B: Reconstruct rawInput string and send through full pipeline

Send `{ rawInput: "chicken, 200g rice", items: [], notes }` — exactly what the current `useFoodParsing.handleLogFood` does. The server runs the full parsing pipeline.

**Pipeline support:** Fully supported; this is the current production flow.

### Recommendation: Option A (pre-populated items)

Rationale:

1. The staging modal already has resolved canonical names from the search/selection
   UI (user picked from FOOD_REGISTRY). Re-parsing would be redundant.
2. The legacy path at `convex/logs.ts:846-853` is explicitly designed for
   pre-resolved items — it calls `rebuildIngredientExposuresForFoodLog` which
   creates `ingredientExposure` documents directly.
3. Avoids a round-trip through `processLogInternal` that could produce different
   canonical matches than what the user selected in the staging UI.

**However:** The staging modal MUST also set `rawInput` (for display in TodayLog
and the FoodMatchingModal's "Full meal" section). The items array must contain
fully valid `ProcessedFoodItem`-shaped objects with at minimum:

- `userSegment` (string, required)
- `parsedName` (string, required)
- `quantity` (number | null, required)
- `unit` (string | null, required)
- `canonicalName` (string, for resolved items)
- `resolvedBy` ("user" for staging-selected items)
- `recoveryStage` (1 | 2 | 3)

**Critical detail:** If items are pre-populated AND non-empty, `processLogInternal`
will NOT run. The `mealSlot` field must be passed in `data` alongside items/rawInput/notes.

---

## 3. FoodMatchingModal Trigger: Unresolved Item Lifecycle

### Step-by-step trace:

1. **Server writes items with unresolved entries**
   `processLogInternal` (convex/foodParsing.ts:1341) calls `toPendingItem(phrase, route)`
   for items where confidence routing yields "medium" or "low". These items are
   stored with `matchCandidates`, `bucketOptions`, `matchConfidence`, etc. but
   WITHOUT `canonicalName` or `resolvedBy`.

2. **Client detects unresolved items via reactive query**
   `useSyncedLogsContext()` provides live Convex-subscribed logs.

3. **useUnresolvedFoodQueue(logs)** (src/hooks/useUnresolvedFoodQueue.ts:20-53)
   - Iterates all food logs
   - For each item, calls `getFoodItemResolutionStatus(item)` (helpers.ts:20-30)
   - Status = "pending" if: no valid canonicalName AND resolvedBy is not "expired"
   - Builds `UnresolvedQueueItem[]`: `{ logId, itemIndex, foodName, rawInput, logTimestamp, item }`

4. **useUnresolvedFoodToast(logs, nowMs, handleReviewUnresolved)**
   (src/hooks/useUnresolvedFoodToast.ts:62-155)
   - Scans food logs within the 6-hour window (`PROCESSING_WINDOW_MS`)
   - If unresolved items exist, shows a persistent `toast.warning`
   - Toast has a "Review" action button bound to `handleReviewUnresolved`

5. **User taps "Review" on toast** (Track.tsx:237-252)
   - `handleReviewUnresolved` calls `setReviewQueueOpen(true)`
   - This opens FoodMatchingModal with `queue={unresolvedQueue}`

6. **FoodMatchingModal** (src/components/track/FoodMatchingModal.tsx:49-571)
   - Enters "queue mode" when `queue` prop has length > 0 (line 75)
   - Iterates through queue items one at a time (`queueIndex` state)
   - Shows candidates from `item.matchCandidates` and `item.bucketOptions`
   - User selects a canonical name → calls `resolveItem` mutation

7. **resolveItem mutation** (convex/foodParsing.ts:1649-1791)
   Args: `{ logId: Id<"logs">, itemIndex: number, canonicalName: string }`
   - Sets `resolvedBy: "user"`, `matchStrategy: "user"`
   - Clears `matchCandidates` and `bucketOptions` (set to undefined)
   - Upserts a learned alias (parsedName → canonicalName)
   - Schedules `embedAliasInternal` for future vector similarity
   - If evidence window already closed, directly creates `ingredientExposure`

8. **Parallel LLM path** — useFoodLlmMatching (src/hooks/useFoodLlmMatching.ts:77-169)
   - Also monitors for unresolved items (different criteria: no canonicalName AND no resolvedBy)
   - Calls `api.foodLlmMatching.matchUnresolvedItems` action
   - This action: fuzzy pre-match (Fuse.js, threshold 0.15) → remaining to OpenAI LLM
   - Results written back via `applyLlmResults` internal mutation
   - Items resolved by LLM get `resolvedBy: "llm"` or `resolvedBy: "fuzzy"`

### Lifecycle diagram:

```
processLogInternal writes items
    │
    ├─→ HIGH confidence → resolvedBy: "registry" (done)
    │
    ├─→ MEDIUM/LOW confidence → pending item (no canonicalName)
    │       │
    │       ├──→ useFoodLlmMatching detects → sends to OpenAI
    │       │       └─→ applyLlmResults → resolvedBy: "llm" or "fuzzy"
    │       │
    │       ├──→ useUnresolvedFoodToast shows warning toast
    │       │       └─→ User taps "Review" → FoodMatchingModal opens
    │       │               └─→ resolveItem → resolvedBy: "user"
    │       │
    │       └──→ 6-hour expiry: processEvidence → resolvedBy: "expired"
    │
    └─→ LLM fallback (structurally ambiguous) → resolvedBy: "llm"
```

---

## 4. mealSlot Field Format

**Format:** lowercase string literal union: `"breakfast" | "lunch" | "dinner" | "snack"`

**Evidence from codebase:**

| Location                | File:Line                      | Definition                                                  |
| ----------------------- | ------------------------------ | ----------------------------------------------------------- |
| Domain type             | `src/types/domain.ts:370`      | `mealSlot?: "breakfast" \| "lunch" \| "dinner" \| "snack"`  |
| Convex validator        | `convex/validators.ts:377-384` | `v.optional(v.union(v.literal("breakfast"), ...))`          |
| Server-side FoodLogData | `convex/foodParsing.ts:154`    | `mealSlot?: "breakfast" \| "lunch" \| "dinner" \| "snack"`  |
| Client sanitization     | `src/lib/syncCore.ts:151`      | `...(d.mealSlot !== undefined && { mealSlot: d.mealSlot })` |

**Where it is set in the pipeline:**

- Currently, `mealSlot` is NOT set by `useFoodParsing.handleLogFood` (src/hooks/useFoodParsing.ts:39-47). The data object passed to `addSyncedLog` contains `{ rawInput, items: [], notes }` only.
- The Nutrition card must ADD `mealSlot` to the data payload when calling `addSyncedLog`.
- `sanitizeLogData` in `syncCore.ts:151` already handles conditional spreading of `mealSlot`.
- The `logs.add` mutation validator accepts it (via `logDataValidator` which uses `convex/validators.ts:377`).
- The `convex/logs.ts:981-991` update path also preserves `mealSlot` on edits.

---

## 5. addSyncedLog Exact Signature

**Defined at:** `src/lib/syncLogs.ts:42-49`

```typescript
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

**Re-exported from:** `src/lib/sync.ts` (barrel export)

**For type='food', the `data` field must conform to `FoodLogData`:**

```typescript
// src/types/domain.ts:365-371
export interface FoodLogData {
  rawInput?: string;
  items: FoodItem[];
  notes?: string;
  mealSlot?: "breakfast" | "lunch" | "dinner" | "snack";
}
```

**Required fields for a food log via Nutrition card (Option A, pre-populated):**

```typescript
await addSyncedLog({
  timestamp: Date.now(), // or user-selected time
  type: "food",
  data: {
    rawInput: "chicken, 200g rice", // original text for display
    items: [
      // pre-resolved items
      {
        userSegment: "chicken",
        parsedName: "chicken",
        name: "chicken", // legacy compat
        quantity: null,
        unit: null,
        canonicalName: "grilled chicken breast",
        resolvedBy: "user",
        recoveryStage: 2,
      },
      {
        userSegment: "200g rice",
        parsedName: "rice",
        name: "rice",
        quantity: 200,
        unit: "g",
        canonicalName: "white rice",
        resolvedBy: "user",
        recoveryStage: 1,
      },
    ],
    notes: "", // optional
    mealSlot: "lunch", // NEW: set by Nutrition card
  },
});
```

**Important:** When `items` is non-empty, the `logs.add` mutation takes the LEGACY path
(`convex/logs.ts:846-853`) and calls `rebuildIngredientExposuresForFoodLog` instead of
scheduling `processLogInternal`. This is the correct behavior for pre-resolved staging items.

---

## Assumptions Requiring Validation

1. **Legacy path compatibility with ProcessedFoodItem shape.** The legacy path in
   `logs.add` calls `rebuildIngredientExposuresForFoodLog`. This function expects
   items in a certain shape. Need to verify it handles the full `ProcessedFoodItem`
   fields (including `userSegment`, `parsedName`) or if it only uses the subset
   from the old `FoodItem` domain type (`name`, `canonicalName`, etc.).
   File: `convex/logs.ts` — `rebuildIngredientExposuresForFoodLog` internal function.

2. **itemsVersion initialization.** When items are pre-populated (Option A),
   `writeProcessedItems` is never called, so `itemsVersion` starts undefined.
   The `processEvidence` scheduler (invoked 6 hours later) may expect
   `itemsVersion` to exist. Need to verify `processEvidence` handles missing
   `itemsVersion` gracefully.

3. **useFoodLlmMatching skip condition.** The LLM hook at
   `src/hooks/useFoodLlmMatching.ts:58` checks
   `if (!foodLog.data.rawInput || foodLog.data.items.length === 0) continue;`
   — it requires BOTH rawInput present AND items non-empty to proceed. If the
   Nutrition card sends pre-resolved items with canonicalNames, the LLM hook
   should skip them (because `isItemUnresolvedForLlm` checks for missing
   canonicalName). But this depends on all items being resolved. If any item
   in the staging list is left unresolved, the LLM hook WILL fire for those.

4. **Evidence scheduling for pre-populated items.** The legacy path does NOT
   schedule `processEvidence` (the 6-hour expiry). Pre-resolved items don't
   need expiry, but the `ingredientExposure` creation timing may differ from
   the standard pipeline. Need to verify `rebuildIngredientExposuresForFoodLog`
   creates exposures immediately (which is the expected behavior).

5. **mealSlot not yet wired in any UI.** No existing component currently sets
   `mealSlot` on the data payload. The Nutrition card will be the first consumer.
   The server validator and `sanitizeLogData` already support it, but no E2E
   path has been tested with this field populated.

6. **FoodMatchingModal entry from staging.** If a user stages items but some
   cannot be matched (e.g., typed freeform into the staging search), those items
   would need to go through the unresolved flow. The Nutrition card design
   should prevent this (only allow selection from FOOD_REGISTRY), but if a
   "custom entry" feature is added later, the unresolved toast + modal flow
   would need to handle items that were partially resolved at staging time.
