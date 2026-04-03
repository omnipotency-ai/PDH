# W0-02 Analysis: Food Parsing Pipeline (Agent Gamma)

> Cross-validation report for Nutrition Card integration.
> All citations are `file:line` from the PDH repository root.

---

## 1. Full text-to-log Flow

When the user types "chicken, 200g rice" and hits Log Food, the following
call sequence fires end-to-end.

### ASCII Call Sequence Diagram

```
USER types "chicken, 200g rice" → presses Log Food
  │
  ▼
FoodSection.onLogFood(notes, rawText, timestampMs?)
  │                                  [src/pages/Track.tsx:591]
  ▼
useFoodParsing.handleLogFood(notes, rawText, timestampMs?)
  │  signature: (notes: string, rawText: string, timestampMs?: number) => Promise<void>
  │                                  [src/hooks/useFoodParsing.ts:31-51]
  │
  │  1. Trims notes, defaults ts = Date.now()
  │  2. Calls addSyncedLog({
  │       timestamp: ts,
  │       type: "food",
  │       data: { rawInput: rawText, items: [], notes: trimmedNotes }
  │     })
  │  3. Calls afterSave() (celebration callback)
  │
  ▼
useAddSyncedLog → api.logs.add mutation
  │  signature: (payload: { timestamp: number, type: LogType, data: LogPayloadData }) => Promise<Id<"logs">>
  │                                  [src/lib/syncLogs.ts:42-49]
  │
  │  Internally:
  │    - sanitizeLogData("food", data) converts FoodItem.canonicalName null→undefined
  │                                  [src/lib/syncCore.ts:132-153]
  │    - Calls api.logs.add Convex mutation
  │
  ▼
convex/logs.ts :: add mutation
  │                                  [convex/logs.ts:819-858]
  │
  │  1. requireAuth(ctx) → { userId }
  │  2. sanitizeUnknownStringsDeep(args.data)
  │  3. ctx.db.insert("logs", { userId, timestamp, type, data }) → logId
  │  4. Detects: type === "food" AND rawInput present AND items.length === 0
  │  5. Schedules: ctx.scheduler.runAfter(0, internal.foodParsing.processLogInternal, { logId })
  │
  ▼
convex/foodParsing.ts :: processLogInternal (internalAction)
  │                                  [convex/foodParsing.ts:1239-1357]
  │
  │  Phase 1: Read snapshot
  │    - getFoodLogForProcessing(logId) → { logId, userId, rawInput }
  │                                  [convex/foodParsing.ts:407-422]
  │
  │  Phase 2: Preprocess raw text
  │    - preprocessMealText(rawInput) → PreprocessedFoodPhrase[]
  │      Splits on commas/conjunctions, parses quantity/unit per phrase
  │                                  [shared/foodMatching.ts:233-254]
  │      For "chicken, 200g rice":
  │        phrase[0] = { rawPhrase: "chicken", parsedName: "chicken", quantity: null, unit: null }
  │        phrase[1] = { rawPhrase: "200g rice", parsedName: "rice", quantity: 200, unit: "g" }
  │
  │  Phase 3: Load user aliases + build matcher context
  │    - listFoodAliasesForUser(userId) → LearnedFoodAlias[]
  │    - createFoodMatcherContext(aliases) → FoodMatcherContext (Fuse.js index)
  │                                  [shared/foodMatching.ts:358-392]
  │
  │  Phase 4: Embedding layer (optional, needs OPENAI_API_KEY env var)
  │    - ensureFoodEmbeddings(ctx) → seeds/refreshes vector index if stale
  │    - fetchOpenAiEmbeddings(parsedNames, apiKey) → number[][]
  │                                  [convex/foodParsing.ts:1267-1282]
  │
  │  Phase 5: Per-phrase matching loop
  │    For each phrase:
  │      a. fuzzySearchFoodCandidates(parsedName, matcherContext)
  │                                  [shared/foodMatching.ts:427-449]
  │      b. searchEmbeddingCandidates(ctx, embedding)
  │                                  [convex/foodParsing.ts:1114-1149]
  │      c. mergeFoodMatchCandidates(fuzzy, embedding, context)
  │                                  [shared/foodMatching.ts:562-625]
  │      d. routeFoodMatchConfidence(phrase, mergedCandidates) → ConfidenceRoute
  │                                  [shared/foodMatching.ts:666-715]
  │
  │      If route.level === "high":
  │        → toResolvedItem(phrase, topCandidate, "registry")  [convex/foodParsing.ts:868-888]
  │      If route.level === "low" AND structurally ambiguous AND has candidates:
  │        → tryLlmFallback(phrase, candidates) via gpt-4o-mini  [convex/foodParsing.ts:1151-1175]
  │      Else:
  │        → toPendingItem(phrase, route)  [convex/foodParsing.ts:890-922]
  │
  │  Phase 6: Write results
  │    - writeProcessedItems(logId, items.map(serializeProcessedItem))
  │                                  [convex/foodParsing.ts:577-721]
  │      Patches log.data.items with full ProcessedFoodItem[] and increments itemsVersion
  │
  │  Phase 7: Schedule evidence window closer (6 hours)
  │    - ctx.scheduler.runAfter(EVIDENCE_WINDOW_MS, processEvidence, { logId })
  │                                  [convex/foodParsing.ts:1349-1355]
  │
  ▼
CLIENT SIDE: useFoodLlmMatching (separate reactive hook)
  │                                  [src/hooks/useFoodLlmMatching.ts:77-169]
  │
  │  Monitors SyncedLogs context. When it detects food logs with:
  │    - rawInput present AND items.length > 0
  │    - At least one item where canonicalName is empty AND resolvedBy is null
  │    - Log age < 6 hours
  │  Calls:
  │    api.foodLlmMatching.matchUnresolvedItems({
  │      logId, rawInput, unresolvedSegments
  │    })
  │                                  [convex/foodLlmMatching.ts:542-719]
  │
  │  Server-side LLM action:
  │    1. Fuzzy pre-match (Fuse.js, threshold 0.15) → trivial matches skip LLM
  │    2. Build prompt with full registry vocabulary
  │    3. Call OpenAI (gpt-4.1-nano default)
  │    4. Parse/validate JSON response
  │    5. Verify canonicals against registry
  │    6. applyLlmResults mutation → patches items in-place with optimistic concurrency
  │                                  [convex/foodParsing.ts:1363-1550]
```

### Return Values Summary

| Function               | Returns                                                  |
| ---------------------- | -------------------------------------------------------- |
| `handleLogFood`        | `Promise<void>`                                          |
| `useAddSyncedLog`      | `(payload) => Promise<Id<"logs">>` (from `api.logs.add`) |
| `api.logs.add`         | `Id<"logs">` (the new log document ID)                   |
| `processLogInternal`   | `void` (scheduled action, no return to client)           |
| `matchUnresolvedItems` | `{ matched: number, unresolved: number }`                |

---

## 2. Staging Integration Recommendation

### Option A: Pre-populate items with matched canonicals

The Nutrition Card staging modal could pre-match each item against the food
registry client-side (using `shared/foodMatching.ts` utilities) and send
pre-resolved items directly. This would BYPASS the `processLogInternal`
server pipeline entirely.

**Problem:** The existing `logs.add` mutation only schedules `processLogInternal`
when `items.length === 0` AND `rawInput` is present (convex/logs.ts:836-845).
If items are pre-populated, it falls through to the legacy path which calls
`rebuildIngredientExposuresForFoodLog` directly (convex/logs.ts:847-853). This
legacy path expects items to already have `canonicalName` set.

**Verdict:** Option A is technically possible but would require the client to
duplicate the server matching logic, handle embedding search, and maintain
consistency with the server pipeline. This contradicts the "Convex is the Boss"
principle from CLAUDE.md.

### Option B: Reconstruct rawInput string and send through full pipeline

The staging modal constructs the rawInput string from staged items (e.g.,
joining names with commas) and calls `addSyncedLog` with `items: []`, just
like the current `useFoodParsing.handleLogFood` does.

**Verdict:** This is the recommended approach and what the existing pipeline
supports natively. The call is:

```ts
await addSyncedLog({
  timestamp: ts,
  type: "food",
  data: {
    rawInput: reconstructedRawText,
    items: [],
    notes: trimmedNotes,
    ...(mealSlot !== undefined && { mealSlot }),
  },
});
```

The server handles all parsing, matching, embedding search, and evidence
scheduling. The `useFoodLlmMatching` hook automatically picks up any
unresolved items for LLM fallback.

### Hybrid Option (Recommended Enhancement)

The staging modal's "Log Food" button should send `rawInput` plus `items: []`
through the standard pipeline (Option B). However, the staging UI itself
can use `shared/foodMatching.ts` utilities (e.g., `fuzzySearchFoodCandidates`,
`searchFoodDocuments`) purely for preview/display purposes -- showing the user
what zone each item falls into, estimated confidence, etc. This is display-only
and does not affect the server pipeline.

---

## 3. FoodMatchingModal Trigger: Unresolved Item Lifecycle

### Step-by-step trace

1. **`useSyncedLogsContext()`** provides reactive log data from Convex
   subscriptions. All food logs are `SyncedLog` objects with discriminated
   union type `"food"`.

2. **`useUnresolvedFoodQueue(logs)`** (src/hooks/useUnresolvedFoodQueue.ts:20-53)
   iterates all logs where `log.type === "food"`. For each food item, calls
   `getFoodItemResolutionStatus(item)` (src/components/track/today-log/helpers.ts:20-32).
   Items with status `"pending"` are collected into `UnresolvedQueueItem[]`:

   ```ts
   interface UnresolvedQueueItem {
     logId: string;
     itemIndex: number;
     foodName: string; // item.parsedName ?? item.name ?? item.userSegment ?? "Food"
     rawInput: string; // foodData.rawInput ?? ""
     logTimestamp: number;
     logNotes?: string;
     item: FoodItem;
   }
   ```

3. **`useUnresolvedFoodToast(logs, now, handleReviewUnresolved)`**
   (src/hooks/useUnresolvedFoodToast.ts:62-155)
   - Scans food logs within 6-hour window for unresolved items
   - Hours 0-3: gentle toast "X foods couldn't be matched"
   - Hours 3-6: urgent toast "X foods still unmatched"
   - Toast has "Review" action button that calls `handleReviewUnresolved`

4. **`handleReviewUnresolved`** callback (src/pages/Track.tsx:237-252)
   sets `reviewQueueOpen = true` if `unresolvedQueue.length > 0`.

5. **`FoodMatchingModal`** (src/components/track/FoodMatchingModal.tsx:49-571)
   opens with `queue={unresolvedQueue}` and `open={reviewQueueOpen}`.
   - In queue mode, iterates through items one at a time (`queueIndex` state)
   - Each item shows: server match candidates, bucket options, full registry search
   - "Match" button calls `api.foodParsing.resolveItem` mutation
   - "Skip" advances to next queue item

6. **`resolveItem` mutation** (convex/foodParsing.ts:1649-1791)
   - Validates: log exists, is food, belongs to user, item is pending (not expired/resolved)
   - Validates: canonicalName is in the food registry (`isCanonicalFood`)
   - Updates item: `resolvedBy: "user"`, `matchStrategy: "user"`, clears candidates
   - Learns alias: `upsertLearnedAlias(ctx, userId, aliasText, canonicalName, source)`
   - Schedules: `embedAliasInternal` to embed the alias for future vector search
   - Adds to `knownFoods` set
   - If evidence window already closed: creates `ingredientExposure` directly

---

## 4. mealSlot Field Format

**Format:** Lowercase string literals: `"breakfast" | "lunch" | "dinner" | "snack"`

**Type definition:** `src/types/domain.ts:370`

```ts
mealSlot?: "breakfast" | "lunch" | "dinner" | "snack";
```

**Where set in the pipeline:**

- **Client side:** `sanitizeLogData` in `src/lib/syncCore.ts:151` passes mealSlot
  through to Convex if present:

  ```ts
  ...(d.mealSlot !== undefined && { mealSlot: d.mealSlot }),
  ```

- **Server validator:** `convex/validators.ts:377` defines:

  ```ts
  mealSlot: v.optional(
    v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack"),
    ),
  );
  ```

- **logs.add mutation:** `convex/logs.ts:981-991` validates and passes through:

  ```ts
  const mealSlot =
    data.mealSlot === "breakfast" ||
    data.mealSlot === "lunch" ||
    data.mealSlot === "dinner" ||
    data.mealSlot === "snack"
      ? data.mealSlot
      : undefined;
  ```

- **FoodLogData interface:** `convex/foodParsing.ts:154` mirrors the type:
  ```ts
  mealSlot?: "breakfast" | "lunch" | "dinner" | "snack";
  ```

**Current state:** The `useFoodParsing.handleLogFood` hook does NOT currently
pass `mealSlot` in its `addSyncedLog` call (src/hooks/useFoodParsing.ts:39-47).
The Nutrition Card must add this field when calling `addSyncedLog`.

---

## 5. addSyncedLog Exact Signature

**Defined at:** `src/lib/syncLogs.ts:42-49`

```ts
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

### Required fields for type='food'

The `LogPayloadData` for food is `FoodLogData` (src/types/domain.ts:366-371):

```ts
export interface FoodLogData {
  rawInput?: string; // The raw text the user typed/spoke
  items: FoodItem[]; // Must be [] for new-style pipeline triggering
  notes?: string; // Optional user notes
  mealSlot?: "breakfast" | "lunch" | "dinner" | "snack"; // Optional meal slot
}
```

**Critical constraint:** To trigger the server-side `processLogInternal`
pipeline, the call MUST pass `items: []` (empty array) AND include `rawInput`
with the food text. If items are non-empty, the legacy path fires instead.

### Minimum viable call from Nutrition Card

```ts
const addSyncedLog = useAddSyncedLog();

await addSyncedLog({
  timestamp: Date.now(),
  type: "food",
  data: {
    rawInput: "chicken, 200g rice",
    items: [],
    notes: "",
    mealSlot: "lunch",
  },
});
```

---

## Assumptions Requiring Validation

1. **mealSlot passthrough:** The `processLogInternal` action reads `rawInput`
   from the log via `getFoodLogForProcessing` (convex/foodParsing.ts:407-422)
   but does NOT read or propagate `mealSlot`. It calls `writeProcessedItems`
   which patches `data.items` and `data.itemsVersion` but preserves other
   data fields via spread (`...data`). **Assumption:** `mealSlot` set during
   `logs.add` is preserved through the processing pipeline because
   `writeProcessedItems` spreads the existing `data` before overwriting `items`.
   **Needs verification** that the spread at convex/foodParsing.ts:697-703
   does not clobber mealSlot.

2. **No client-side parsing needed:** The Nutrition Card's "Log Food" button
   should send raw text and `items: []`, relying entirely on the server
   pipeline. The staging UI can use `shared/foodMatching.ts` for display
   previews only. **Assumption:** The server pipeline (fuzzy + embedding +
   LLM) provides equal or better matching than any client-side pre-resolution.

3. **Concurrent log submissions:** If the user logs multiple meals quickly,
   each `logs.add` call schedules its own `processLogInternal` action.
   **Assumption:** These run independently without contention. Validated by
   the optimistic concurrency check in `applyLlmResults`
   (convex/foodParsing.ts:1420-1425) using `itemsVersion`.

4. **rawInput reconstruction:** If the staging modal aggregates multiple
   items (e.g., "2x chicken, 200g rice, salad"), the reconstructed rawInput
   string should use comma separation. **Assumption:** `preprocessMealText`
   in `shared/foodMatching.ts:233` handles comma-separated input correctly.
   Validated by `splitMealIntoFoodPhrases` (shared/foodMatching.ts:205-217)
   which splits on commas, semicolons, slashes, ampersands, and conjunctions.

5. **FoodItem type completeness:** The `FoodItem` type used by the queue
   and modal includes fields like `matchCandidates`, `bucketOptions`,
   `matchConfidence`, and `matchStrategy`. **Assumption:** These fields are
   populated by `processLogInternal` via `writeProcessedItems` and are
   available in the `SyncedLog` data returned by Convex subscriptions.
   Validated by the `writeProcessedItems` validator which includes all these
   fields (convex/foodParsing.ts:577-665).

6. **useFoodLlmMatching independence:** The client-side LLM matching hook
   is a separate concern from `processLogInternal`. It fires AFTER the
   server pipeline writes items, detecting any that remain unresolved.
   **Assumption:** The Nutrition Card does not need to call or configure
   this hook -- it is already mounted on the Track page
   (src/pages/Track.tsx:38). If the Nutrition Card lives on a different
   page, `useFoodLlmMatching` must be mounted there too.

7. **Evidence window:** The 6-hour evidence window
   (convex/foodParsing.ts:52, `EVIDENCE_WINDOW_MS = 6 * 60 * 60 * 1000`)
   is scheduled by `processLogInternal` at line 1349. After expiry,
   `processEvidence` marks unresolved items as `"expired"` with
   `canonicalName: "unknown_food"`. **Assumption:** The Nutrition Card
   does not need to manage this -- it is automatic.
