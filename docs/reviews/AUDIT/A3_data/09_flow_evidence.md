# Flow Trace: Food Trial Evidence Processing

## Trigger

There are **two independent triggers** for ingredient exposure creation, plus a **higher-level evidence pipeline** in `shared/foodEvidence.ts` that computes trial summaries from logs + digestion events + AI assessments.

### Trigger 1: Food log creation/update (new-style with rawInput)

- When `logs.add()` or `logs.update()` processes a food log that has `rawInput` (raw text), it schedules `foodParsing.processLogInternal` which, after matching, schedules `foodParsing.processEvidence` with a **6-hour delay**.

### Trigger 2: Food log creation/update (legacy style with pre-resolved items)

- When `logs.add()`, `logs.update()`, or `logs.batchUpdateFoodItems()` processes a food log that already has `items` populated (legacy path), it calls `rebuildIngredientExposuresForFoodLog()` **synchronously** within the same mutation.

### Trigger 3: AI report generation (food trial summaries, separate from exposures)

- When `extractInsightData.extractFromReport()` inserts food assessments from an AI analysis, it schedules `computeAggregates.updateFoodTrialSummary` which calls `buildFoodEvidenceResult()` from `shared/foodEvidence.ts` -- a completely separate pipeline that correlates food logs with digestion events using transit timing.

---

## Happy Path (New-Style Pipeline)

### Step 1: Food log created

- **File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts`, line 831
- **Function:** `add` (mutation)
- User submits raw text (e.g., "chicken breast, rice, steamed broccoli")
- Log inserted to `logs` table with `type: "food"`, `data: { rawInput: "...", items: [] }`
- Condition: `rawInput` is present and `items` is empty/missing

### Step 2: Schedule server-side food parsing

- **File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts`, lines 855-858
- `ctx.scheduler.runAfter(0, internal.foodParsing.processLogInternal, { logId })`
- Runs immediately (delay = 0)

### Step 3: Parse and match food items

- **File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/foodParsing.ts`, line 877
- **Function:** `processLogInternal` (internalAction)
- Reads log via `getFoodLogForProcessing` (line 257)
- Preprocesses raw text into phrases via `preprocessMealText()` from `shared/foodMatching`
- Loads learned aliases via `listFoodAliasesForUser` (line 274)
- Creates matcher context via `createFoodMatcherContext(learnedAliases)` (line 899)

### Step 4: Multi-strategy matching per phrase

- **File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/foodParsing.ts`, lines 920-976
- For each phrase:
  1. **Fuzzy search** via `fuzzySearchFoodCandidates()` (line 922)
  2. **Embedding search** via `searchEmbeddingCandidates()` using Convex vector index (line 933)
  3. **Merge candidates** via `mergeFoodMatchCandidates()` (line 944)
  4. **Route confidence** via `routeFoodMatchConfidence()` (line 949)
  5. If high confidence: create resolved item via `toResolvedItem()` (line 952)
  6. If low confidence + structurally ambiguous: try LLM fallback via `tryLlmFallback()` (line 962)
  7. Otherwise: create pending/unresolved item via `toPendingItem()` (line 975)

### Step 5: Write processed items back to log

- **File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/foodParsing.ts`, lines 978-981
- `writeProcessedItems` (internalMutation, line 364): patches the log's `data.items` array with processed items and increments `itemsVersion`
- At this point, items may be resolved (have `canonicalName`) or unresolved (pending user action)

### Step 6: Schedule evidence processing (6-hour delay)

- **File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/foodParsing.ts`, lines 983-989
- `ctx.scheduler.runAfter(EVIDENCE_WINDOW_MS, internal.foodParsing.processEvidence, { logId })`
- `EVIDENCE_WINDOW_MS = 6 * 60 * 60 * 1000` (6 hours, line 51)
- This delay gives the user time to manually resolve unmatched items before evidence is finalized

### Step 7: Process evidence (create ingredientExposures)

- **File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/foodParsing.ts`, line 1044
- **Function:** `processEvidence` (internalMutation)
- **Idempotency guard:** If `data.evidenceProcessedAt` is already set, returns early (line 1051)
- **Empty items:** If no items, just marks `evidenceProcessedAt` and returns (lines 1055-1061)
- **Expire unresolved items:** Any item without a `canonicalName` (or empty/null) is set to `canonicalName: "unknown_food"` with `resolvedBy: "expired"` (lines 1064-1083)
- **Write updated items:** Patches the log atomically with serialized items + `evidenceProcessedAt` timestamp (lines 1092-1098)
- **Insert exposures:** For each item that has a valid, non-"unknown_food" `canonicalName`, inserts a row into `ingredientExposures` (lines 1100-1129)

### ingredientExposure row inserted (line 1111):

```
{
  userId,
  logId,
  itemIndex: i,
  logTimestamp: log.timestamp,
  ingredientName: item.userSegment,    // original user text
  canonicalName: item.canonicalName,    // resolved canonical
  quantity: item.quantity,
  unit: item.unit,
  preparation?: item.preparation,
  recoveryStage?: item.recoveryStage,  // 1 | 2 | 3
  spiceLevel?: item.spiceLevel,        // "plain" | "mild" | "spicy"
  createdAt: Date.now(),
}
```

---

## Happy Path (Legacy Pipeline -- synchronous)

### Step 1: Food log with pre-resolved items

- **File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts`, lines 860-868
- When `add()` receives a food log where `items` is already populated (legacy client), it calls `rebuildIngredientExposuresForFoodLog()` synchronously

### Step 2: Rebuild exposures

- **File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts`, line 260
- **Function:** `rebuildIngredientExposuresForFoodLog` (private helper)
- First calls `clearIngredientExposuresForLog()` to delete any existing exposures for this logId (line 269)
- Then calls `getCanonicalizedFoodItems()` to extract items from the log data (line 273)
- For each item with valid `ingredientName` AND `canonicalName`:
  - Normalizes canonical name via `normalizeCanonicalIngredientName()` (line 289)
  - Skips `"unknown_food"` items (line 293)
  - Inserts into `ingredientExposures` (line 309)

### Also triggered by:

- `logs.update()` for legacy food logs (line 937)
- `logs.batchUpdateFoodItems()` (line 1007)
- `logs.backfillIngredientExposures()` -- iterates all food logs and rebuilds (line 1842)
- `logs.recanonicalizeAllFoodLogs()` -- re-canonicalizes items then rebuilds (line 1894)

---

## Error/Fallback Branches

### No rawInput on food log (legacy path)

- Falls through to synchronous `rebuildIngredientExposuresForFoodLog()` which handles items directly

### Items array is empty or null

- `getCanonicalizedFoodItems()` returns `[]` or `null` -> `rebuildIngredientExposuresForFoodLog()` returns 0 (line 274)
- In `processEvidence`: marks `evidenceProcessedAt` and returns (lines 1055-1061)

### Item missing ingredientName or canonicalName

- `getCanonicalizedFoodItems()` returns `null` if any item lacks both (line 236-238)
- In `rebuildIngredientExposuresForFoodLog()`: individual items with missing names are skipped (line 285)

### Food has canonicalName = "unknown_food"

- Explicitly skipped in both paths (legacy: line 293, new-style: line 1106)

### Matching failed (no high-confidence match, no LLM result)

- Item stored as pending (no `canonicalName`) via `toPendingItem()` (line 975)
- After 6 hours: `processEvidence` marks it as `resolvedBy: "expired"` with `canonicalName: "unknown_food"` (lines 1073-1076)
- No `ingredientExposure` row created for expired items

### OpenAI API unavailable

- Embedding search fails gracefully (catch block, lines 911-916) -- falls back to fuzzy-only matching
- LLM fallback fails gracefully (catch block, lines 967-972) -- item stays unresolved

### Evidence already processed (idempotency)

- `processEvidence` checks `data.evidenceProcessedAt` and returns early if already set (line 1051)

### Food log deleted

- `logs.remove()` calls `clearIngredientExposuresForLog()` to clean up exposures (line 890)

### Food log updated

- New-style: clears existing exposures, re-schedules `processLogInternal` (lines 926-934)
- Legacy: calls `rebuildIngredientExposuresForFoodLog()` which clears and rebuilds (lines 937-942)

### Manual resolution (resolveItem) DOES NOT trigger exposure creation

- `foodParsing.resolveItem()` (line 1137) only updates the item's `canonicalName` in the log data and upserts a learned alias
- It does NOT schedule `processEvidence` or create `ingredientExposures`
- Exposures are only created when `processEvidence` runs after the 6-hour window
- **Gap:** If a user resolves an item AFTER the 6-hour window has already closed (evidenceProcessedAt is set), that resolution will never generate an exposure record

---

## Data Model

### Input: Food log structure (`logs` table)

```typescript
{
  userId: string,
  timestamp: number,
  type: "food",
  data: {
    rawInput?: string,           // user's free-text input
    items: ProcessedFoodItem[],  // parsed/matched items
    notes?: string,
    mealSlot?: "breakfast" | "lunch" | "dinner" | "snack",
    evidenceProcessedAt?: number, // set when processEvidence runs
    itemsVersion?: number,        // incremented on each update
  }
}
```

### Processing: ProcessedFoodItem (in-flight within logs.data.items)

```typescript
{
  userSegment: string,       // original user text segment
  parsedName: string,        // cleaned/parsed food name
  quantity: number | null,
  unit: string | null,
  canonicalName?: string,    // resolved canonical (set on match or "unknown_food" on expiry)
  resolvedBy?: "registry" | "llm" | "user" | "expired",
  recoveryStage?: 1 | 2 | 3,
  bucketKey?: string,
  bucketLabel?: string,
  matchConfidence?: number,
  matchStrategy?: "alias" | "fuzzy" | "embedding" | "combined" | "llm" | "user",
  matchCandidates?: FoodMatchCandidate[],  // cleared on resolution/expiry
  bucketOptions?: FoodMatchBucketOption[],  // cleared on resolution/expiry
  preparation?: string,
  spiceLevel?: "plain" | "mild" | "spicy",
}
```

### Output: ingredientExposures table

```typescript
{
  userId: string,
  logId: Id<"logs">,
  itemIndex: number,
  logTimestamp: number,
  ingredientName: string,     // user's original text (userSegment/rawName/parsedName/name)
  canonicalName: string,      // normalized canonical food name
  quantity: number | null,
  unit: string | null,
  preparation?: string,
  recoveryStage?: 1 | 2 | 3,
  spiceLevel?: "plain" | "mild" | "spicy",
  createdAt: number,
}
```

### Indexes on ingredientExposures

- `by_userId` -- all exposures for a user
- `by_userId_logId` -- exposures for a specific log (used for clear/rebuild)
- `by_userId_canonicalName` -- exposures for a specific food (currently unused due to stale canonical issue)
- `by_userId_timestamp` -- time-ordered exposures (primary query path)

### Downstream consumers of ingredientExposures

1. **`ingredientExposures.allIngredients`** (query, line 69): Groups all exposures by canonical name, returns summary with counts, last seen, latest stage/preparation/spice
2. **`ingredientExposures.historyByIngredient`** (query, line 29): Returns full history for a specific canonical name
3. **Client hooks** in `src/lib/sync.ts`: `useAllIngredientExposures()` (line 375), `useIngredientExposureHistory()` (line 379)

### Separate from ingredientExposures: Food Trial Evidence (shared/foodEvidence.ts)

The `buildFoodEvidenceResult()` function in `shared/foodEvidence.ts` is a **completely separate evidence pipeline** that does NOT read from `ingredientExposures`. Instead it:

1. Reads raw `logs` data directly (food logs + digestion logs + habit logs + activity logs + fluid logs)
2. Builds food trials from `logs.data.items` (via `getLoggedFoodIdentity`)
3. Builds digestive events from digestion logs
4. Resolves trials against digestive events using transit window calculations
5. Combines with AI assessments from `foodAssessments` table
6. Produces `FoodEvidenceSummary[]` with Bayesian posterior scores, which are stored in `foodTrialSummary`

---

## Files Involved

| File                                                                           | Purpose                                                                                                                                                                           |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts`                 | Food log CRUD, `add`/`update`/`remove` mutations, `rebuildIngredientExposuresForFoodLog`, `clearIngredientExposuresForLog`, `backfillIngredientExposures`, `batchUpdateFoodItems` |
| `/Users/peterjamesblizzard/projects/caca_traca/convex/foodParsing.ts`          | Server-side food matching pipeline: `processLogInternal` (action), `processEvidence` (mutation), `resolveItem` (mutation), `writeProcessedItems`, OpenAI embedding/LLM helpers    |
| `/Users/peterjamesblizzard/projects/caca_traca/convex/ingredientExposures.ts`  | Read-only queries: `allIngredients`, `historyByIngredient`                                                                                                                        |
| `/Users/peterjamesblizzard/projects/caca_traca/convex/schema.ts`               | Table definitions for `ingredientExposures`, `logs`, `foodTrialSummary`, etc.                                                                                                     |
| `/Users/peterjamesblizzard/projects/caca_traca/shared/foodEvidence.ts`         | Separate evidence pipeline: `buildFoodEvidenceResult`, transit resolution, Bayesian scoring, `FoodEvidenceSummary`                                                                |
| `/Users/peterjamesblizzard/projects/caca_traca/convex/computeAggregates.ts`    | `updateFoodTrialSummary` (internalMutation) -- upserts `foodTrialSummary` rows from fused evidence                                                                                |
| `/Users/peterjamesblizzard/projects/caca_traca/convex/extractInsightData.ts`   | `extractFromReport` -- extracts food assessments from AI reports, schedules aggregate updates                                                                                     |
| `/Users/peterjamesblizzard/projects/caca_traca/convex/foodLibrary.ts`          | Also calls `buildFoodEvidenceResult` for library-level evidence queries                                                                                                           |
| `/Users/peterjamesblizzard/projects/caca_traca/src/lib/sync.ts`                | Client-side hooks: `useAllIngredientExposures`, `useIngredientExposureHistory`, `useBackfillIngredientExposures`                                                                  |
| `/Users/peterjamesblizzard/projects/caca_traca/shared/foodMatching.ts`         | Shared matching logic: `preprocessMealText`, `fuzzySearchFoodCandidates`, `mergeFoodMatchCandidates`, `routeFoodMatchConfidence`                                                  |
| `/Users/peterjamesblizzard/projects/caca_traca/shared/foodCanonicalization.ts` | `canonicalizeKnownFoodName` -- registry lookup                                                                                                                                    |
| `/Users/peterjamesblizzard/projects/caca_traca/shared/foodNormalize.ts`        | `normalizeFoodName`, `formatCanonicalFoodDisplayName`                                                                                                                             |
| `/Users/peterjamesblizzard/projects/caca_traca/shared/foodProjection.ts`       | `getLoggedFoodIdentity`, `getCanonicalFoodProjection`                                                                                                                             |

---

## Observations

### Architecture: Two Independent Evidence Systems

There are **two separate "evidence" systems** that serve different purposes:

1. **`ingredientExposures` table** -- a flat log of which canonical foods the user has eaten, when, and with what preparation. Created by `processEvidence` (new-style) or `rebuildIngredientExposuresForFoodLog` (legacy). Used for exposure history queries (UI: "how many times have I eaten X?").

2. **`shared/foodEvidence.ts` / `foodTrialSummary` table** -- a Bayesian evidence engine that correlates food intake with digestive outcomes using transit timing, modifier signals (habits, activity, fluid), and AI assessments. Does NOT read from `ingredientExposures` at all -- reads raw logs directly. Used for food safety status (safe/watch/avoid/building).

These systems are not directly connected. The `ingredientExposures` table is purely an exposure ledger; the transit-based evidence system is the actual "food trial" engine.

### Timing: Synchronous vs Scheduled

- **Legacy path:** Synchronous within the mutation (immediate)
- **New-style path:** Three scheduled steps:
  1. `processLogInternal` runs immediately (delay = 0) as an internalAction
  2. `writeProcessedItems` called within processLogInternal as internalMutation
  3. `processEvidence` scheduled with **6-hour delay** -- this is the key design choice
- The 6-hour window allows users to manually resolve unmatched items before evidence is finalized

### Gap: resolveItem Does Not Create Exposures

- `foodParsing.resolveItem()` updates the item's canonical name in the log but does NOT:
  - Schedule a new `processEvidence` call
  - Directly insert into `ingredientExposures`
- If `processEvidence` has already run (evidenceProcessedAt is set) and the user then resolves an expired item, that resolution will never generate an exposure record
- The user would need to trigger `backfillIngredientExposures` to pick it up, but that uses the legacy `rebuildIngredientExposuresForFoodLog` path which expects items to already have canonical names

### Gap: No Exposure-Based Transit Correlation

- `ingredientExposures` are never used by the transit/evidence engine in `shared/foodEvidence.ts`
- The transit engine re-extracts food items from raw log data every time it runs
- This means `ingredientExposures` and the transit engine could theoretically disagree about what foods were in a log (though they use similar canonicalization logic)

### Complexity

- The pipeline has significant complexity:
  - Two separate code paths (new-style vs legacy)
  - Three scheduled functions in the new-style path
  - 6-hour delayed processing
  - Multiple matching strategies (alias, fuzzy, embedding, LLM)
  - Idempotency guards
  - Canonical name normalization at read time (to handle stale stored names)
  - The `by_userId_canonicalName` index is defined but intentionally NOT used by the primary queries due to stale canonical names (see TODO on line 45 of ingredientExposures.ts)

### Data Integrity

- The `clearIngredientExposuresForLog` function correctly deletes old exposures before rebuilding
- The `evidenceProcessedAt` guard prevents double-processing
- Log deletions correctly cascade to exposure deletion
- Log updates correctly clear and re-schedule/rebuild exposures
