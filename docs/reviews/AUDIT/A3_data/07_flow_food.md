# Flow Traces: Food Logging + LLM Matching

**Traced on:** 2026-03-16
**Branch:** `main`
**Methodology:** Read every file in the chain, following actual imports and function calls.

---

## Flow 1: User Logs a Food Item

### Happy Path

**1. `src/components/track/panels/FoodSection.tsx` -- `submitFood()` (line 45)**

User types text into the food input field and presses Enter or clicks "Log Food." The `submitFood()` closure:

- Validates `foodName.trim()` is non-empty (toast + inline error if empty).
- Saves all input state for error rollback (`savedName`, `savedTimeValue`, `savedActivePreset`, `savedTimestampMs`).
- Checks if the input matches an active custom food preset badge (case-insensitive comparison). If so, marks the item with `fromPreset: true` and attaches `presetIngredients`.
- Builds a `ParsedItem` object: `{ name, quantity: "", unit: "", fromPreset?, presetIngredients? }`.
- **Optimistically clears** the input field, active preset, and time picker to keep the UI responsive.
- Calls `onLogFood([item], "", savedName, savedTimestampMs)` -- a Promise. On `.catch`, restores all saved input state and shows a toast error. On `.finally`, sets `saving = false`.

**2. `src/pages/Track.tsx` -- wiring (line 251 + 608)**

The Track page instantiates `useFoodParsing({ afterSave })` and passes `handleLogFood` to `<FoodSection onLogFood={handleLogFood} />`.

```
const { handleLogFood } = useFoodParsing({ afterSave });
// afterSave = celebrateLog() -- triggers a confetti burst
```

**3. `src/hooks/useFoodParsing.ts` -- `handleLogFood()` (line 28)**

This hook is thin. It:

- Ignores the `_items` parameter entirely (the `ParsedItem[]` from FoodSection is unused).
- Trims `notes`, defaults timestamp to `Date.now()`.
- Calls `addSyncedLog()` with:
  ```ts
  {
    timestamp: ts,
    type: "food",
    data: {
      rawInput: rawText,   // the original user-typed string
      items: [],           // always empty -- server handles parsing
      notes: trimmedNotes,
    },
  }
  ```
- After the Promise resolves, calls `afterSave()` (confetti).

**Key observation:** The `ParsedItem[]` built in FoodSection (with `fromPreset`, `presetIngredients`) is never sent to the server. The server only receives `rawInput` (the raw text string). Preset metadata is discarded here.

**4. `src/lib/sync.ts` -- `useAddSyncedLog()` (line 142)**

A thin wrapper around `useMutation(api.logs.add)`. It:

- Sanitizes the `data` payload via `sanitizeLogData()` (which calls `sanitizeUnknownStringsDeep()` -- strips control characters, normalizes Unicode, caps string lengths).
- Calls the Convex mutation `api.logs.add` with `{ timestamp, type: "food", data }`.

**5. `convex/logs.ts` -- `add` mutation (line 831)**

The server-side Convex mutation:

- Authenticates the user via `ctx.auth.getUserIdentity()`.
- Sanitizes strings again with `sanitizeUnknownStringsDeep()`.
- Inserts a row into the `"logs"` table: `{ userId, timestamp, type: "food", data }`.
- **Detects new-style food logs:** checks `foodData.rawInput && (!foodData.items || items.length === 0)`.
  - **If true (normal path):** Schedules `internal.foodParsing.processLogInternal` via `ctx.scheduler.runAfter(0, ...)` -- the server-side food matching pipeline runs asynchronously.
  - **If false (legacy path):** Calls `rebuildIngredientExposuresForFoodLog()` synchronously (items were already pre-parsed by old client code).
- Returns the new `logId`.

**6. `convex/foodParsing.ts` -- `processLogInternal` internalAction (line 877)**

This is the server-side food matching pipeline, running as a Convex action (can call external APIs). Steps:

**6a. Load snapshot** (line 880): Queries `getFoodLogForProcessing` to get `{ logId, userId, rawInput }`.

**6b. Preprocess** (line 886): Calls `preprocessMealText(rawInput)` from `shared/foodMatching.ts`:

- Splits raw text on commas, `and`, `with`, `&`, newlines (via `splitMealIntoFoodPhrases`).
- Protects multi-word food names (e.g. "fish and chips") from being split.
- For each phrase, calls `parseLeadingQuantity()` from `shared/foodParsing.ts` to extract quantity/unit.
- Normalizes the parsed name (lowercase, strip accents, collapse whitespace).
- Returns `PreprocessedFoodPhrase[]`.

If no phrases are found, writes empty items and returns.

**6c. Load learned aliases** (line 895): Queries `listFoodAliasesForUser` to get both global and user-specific food aliases from the `foodAliases` table.

**6d. Create matcher context** (line 899): Calls `createFoodMatcherContext(learnedAliases)` from `shared/foodMatching.ts`:

- Builds `FoodSearchDocument[]` from `FOOD_REGISTRY` (static registry) + learned aliases.
- Creates a Fuse.js instance for fuzzy search.
- Builds `exactAliasMap` (normalized text -> document) and `documentMap` (canonical name -> document).

**6e. Generate embeddings** (line 901-916): Attempts to ensure food embeddings are up-to-date in the `foodEmbeddings` table, then fetches OpenAI embeddings for each phrase's `parsedName` using `text-embedding-3-small`. Falls back to fuzzy-only if the embedding layer fails (missing API key, API error).

**6f. Per-phrase matching loop** (line 920-976):

For each preprocessed phrase:

1. **Fuzzy search** (line 922): `fuzzySearchFoodCandidates(phrase.parsedName, matcherContext)` -- checks exact alias map first (instant match), then Fuse.js fuzzy search.

2. **Embedding search** (line 932-942): `searchEmbeddingCandidates(ctx, phraseEmbeddings[index])` -- Convex vector search over `foodEmbeddings` table, returns top 5 candidates with cosine similarity scores.

3. **Merge candidates** (line 944): `mergeFoodMatchCandidates(fuzzy, embedding, context)` -- combines fuzzy and embedding scores (65% fuzzy + 35% embedding for overlapping candidates), sorts by combined confidence.

4. **Route confidence** (line 949): `routeFoodMatchConfidence(phrase, mergedCandidates)`:
   - **High confidence** (>= 0.86 with sufficient gap): Auto-resolve as `"registry"` via `toResolvedItem()`.
   - **Medium confidence** (>= 0.56): Store as pending with candidates/buckets for user review.
   - **Low confidence** (< 0.56): If `isStructurallyAmbiguousPhrase()` (5+ tokens or contains "mixed"/"stuffed"/etc.) AND has candidates, try LLM fallback.

5. **LLM fallback** (line 956-973): `tryLlmFallback(phrase, route.candidates)` -- calls OpenAI `gpt-4o-mini` with a minimal prompt asking it to pick the best candidate from the top 3. If it returns a valid canonical name, resolves as `"llm"`. Uses the server's `OPENAI_API_KEY` env var (not the client's BYOK key).

6. **Pending items** (line 975): If no match is found, stores the item as pending via `toPendingItem()` with `matchCandidates` and `bucketOptions` for the user review modal.

**6g. Write results** (line 978): `writeProcessedItems` internalMutation -- patches the log document's `data.items` array with the processed items, increments `itemsVersion`.

**6h. Schedule evidence processing** (line 983): `ctx.scheduler.runAfter(EVIDENCE_WINDOW_MS, ...)` -- schedules `processEvidence` to run after 6 hours.

**7. `convex/foodParsing.ts` -- `processEvidence` internalMutation (line 1044)**

Runs 6 hours after the food log was created:

- Marks any still-unresolved items as `canonicalName: "unknown_food"`, `resolvedBy: "expired"`.
- Creates `ingredientExposures` records for all resolved items (used for transit timing and food evidence analysis).
- Sets `evidenceProcessedAt` timestamp on the log data.

### Error/Fallback Branches

- **At step 1 (FoodSection):** If text is empty, shows inline error + toast, does not proceed.
- **At step 1 (FoodSection):** If `onLogFood` Promise rejects, restores all input fields from saved state and shows toast error.
- **At step 5 (logs.add):** If user is not authenticated, throws `"Not authenticated"`. Client receives error, FoodSection restores input.
- **At step 6e (embeddings):** If `OPENAI_API_KEY` is not set on the server, the embedding layer is skipped entirely -- matching proceeds with fuzzy-only (no semantic search). Logged to console.
- **At step 6f.2 (embedding search):** If vector search fails for a specific phrase, that phrase proceeds with fuzzy-only candidates. Logged to console.
- **At step 6f.5 (LLM fallback):** If the OpenAI call fails, the phrase stays as a pending item for user review. Logged to console.
- **At step 6g (writeProcessedItems):** If the log was deleted between steps, the mutation silently returns (checks `if (!log || log.type !== "food") return`).

### Files Involved

| File                                          | Purpose                                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/track/panels/FoodSection.tsx` | UI: food text input, submit handler, preset badges                                                                                            |
| `src/pages/Track.tsx`                         | Wiring: connects FoodSection to useFoodParsing hook                                                                                           |
| `src/hooks/useFoodParsing.ts`                 | Client hook: packages raw text for server                                                                                                     |
| `src/lib/sync.ts`                             | Client: `useAddSyncedLog()` -- sanitizes and calls `api.logs.add`                                                                             |
| `src/lib/inputSafety.ts`                      | Client: `sanitizeUnknownStringsDeep()` -- input sanitization                                                                                  |
| `convex/logs.ts`                              | Server: `add` mutation -- inserts log, schedules processing                                                                                   |
| `convex/foodParsing.ts`                       | Server: `processLogInternal` -- full matching pipeline                                                                                        |
| `shared/foodMatching.ts`                      | Shared: `preprocessMealText`, `fuzzySearchFoodCandidates`, `mergeFoodMatchCandidates`, `routeFoodMatchConfidence`, `createFoodMatcherContext` |
| `shared/foodParsing.ts`                       | Shared: `parseLeadingQuantity` -- quantity/unit extraction                                                                                    |
| `shared/foodRegistry.ts`                      | Shared: `FOOD_REGISTRY` static data, `getFoodZone`, `isCanonicalFood`                                                                         |

---

## Flow 2: LLM Food Matching

### Overview: Two Paths Exist (One Active, One Dormant)

There are **two** LLM matching paths in the codebase:

1. **Server-side LLM fallback** (ACTIVE) -- built into `processLogInternal` in `convex/foodParsing.ts`. Uses the server's `OPENAI_API_KEY` env var. Triggered automatically during server-side processing for structurally ambiguous phrases with low confidence.

2. **Client-initiated BYOK LLM matching** (DORMANT) -- the `useFoodLlmMatching` hook + `matchUnresolvedItems` action. This was the original design (client passes their own API key from IndexedDB), but it is currently **disabled**:
   - `useFoodLlmMatching` is defined in `src/hooks/useFoodLlmMatching.ts` but **never imported or called** from any component.
   - `matchUnresolvedItems` action in `convex/foodLlmMatching.ts` is a **no-op stub** (line 390-398): logs a warning and returns `{ matched: 0, unresolved: 0 }`.
   - `applyLlmResults` mutation in `convex/foodParsing.ts` (line 997-1038) **throws an error** if called.

### Flow 2A: Server-Side LLM Fallback (Active Path)

#### Trigger

During `processLogInternal` (step 6f above), when a phrase routes to `level: "low"` confidence AND `isStructurallyAmbiguousPhrase()` returns true AND there are candidates available.

#### Happy Path

1. **`convex/foodParsing.ts` -- `processLogInternal` loop (line 956)**

   Condition: `route.level === "low" && isStructurallyAmbiguousPhrase(phrase) && route.candidates.length > 0`.

2. **`convex/foodParsing.ts` -- `tryLlmFallback()` (line 790)**
   - Retrieves server API key via `getServerOpenAiApiKey()` (reads `process.env.OPENAI_API_KEY`).
   - If no key, returns `null` (phrase stays pending).

3. **`convex/foodParsing.ts` -- `fetchLlmFallbackChoice()` (line 540)**
   - Sends a request to `https://api.openai.com/v1/chat/completions` using `gpt-4o-mini`, `temperature: 0`.
   - **System prompt:** "You choose the closest food registry canonical from a short list. Reply with the exact canonical name or the single word none."
   - **User prompt:** JSON object with the phrase and top 3 candidates (canonical name, zone, group, line, bucket label, confidence, up to 4 examples each).
   - Parses response: strips quotes, normalizes text, looks up the returned name in the candidate list.
   - Returns the matched canonical name, or `null` if "none" or unrecognized.

4. **`convex/foodParsing.ts` -- `tryLlmFallback()` continues (line 804)**

   If a valid canonical name was returned:
   - Creates a modified candidate with `resolver: "llm"` and `combinedConfidence: Math.max(original, 0.6)`.
   - Returns this candidate.

5. **`convex/foodParsing.ts` -- `processLogInternal` loop (line 963-965)**

   If `tryLlmFallback` returned a candidate:
   - Calls `toResolvedItem(phrase, llmCandidate, "llm")` -- creates a `ProcessedFoodItem` with `resolvedBy: "llm"`, `matchStrategy: "llm"`.

6. **`convex/foodParsing.ts` -- `writeProcessedItems` (line 978)**

   Writes the resolved item to the log's `data.items` array (same as Flow 1 step 6g).

#### Error/Fallback Branch

- **Missing server API key:** `tryLlmFallback` returns `null`. Phrase stays as a pending item for manual user resolution.
- **OpenAI API error:** `fetchLlmFallbackChoice` throws. Caught at line 967-972, logged to console. Phrase stays pending.
- **LLM returns "none" or unrecognized name:** `fetchLlmFallbackChoice` returns `null`. Phrase stays pending.
- **LLM hallucinates a name not in candidates:** The lookup `candidates.find(c => c.canonicalName === canonicalName)` returns undefined, so `fetchLlmFallbackChoice` returns `null`. Phrase stays pending.

#### Files Involved

| File                     | Purpose                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| `convex/foodParsing.ts`  | `tryLlmFallback()`, `fetchLlmFallbackChoice()`, `getServerOpenAiApiKey()` |
| `shared/foodMatching.ts` | `isStructurallyAmbiguousPhrase()`, `routeFoodMatchConfidence()`           |

---

### Flow 2B: Client-Initiated BYOK LLM Matching (Dormant Path)

This path is fully coded but **not connected**. Documented here for completeness since it was the original design.

#### Trigger (Would Be)

The `useFoodLlmMatching` hook (if it were called) monitors all food logs via `useSyncedLogsContext()`. When it finds food logs from the last 6 hours with items that have no `canonicalName` and no `resolvedBy`, it fires the `matchUnresolvedItems` action.

#### Would-Be Happy Path

1. **`src/hooks/useFoodLlmMatching.ts` -- `useFoodLlmMatching()` (line 70)** [NOT CALLED]
   - Gets logs from `useSyncedLogsContext()`.
   - Gets API key from `useApiKeyContext()` (which reads from `useApiKey` hook, which loads from IndexedDB via `src/lib/apiKeyStore.ts`).
   - Calls `findLogsNeedingLlmMatching(logs, nowMs)` -- filters to food logs within 6 hours that have items with no `canonicalName` and no `resolvedBy`.
   - For each qualifying log (tracked by ref Set to avoid duplicates):
     - Extracts `unresolvedSegments` from items that pass `isItemUnresolvedForLlm()`.
     - Calls `matchItemsRef.current({ apiKey, logId, rawInput, unresolvedSegments })`.

2. **`src/lib/apiKeyStore.ts` -- IndexedDB storage (line 1-16)**

   Uses `idb-keyval` library with key `"caca-traca-openai-key"`:
   - `getApiKey()` -- reads from IndexedDB.
   - `setApiKey(key)` -- writes to IndexedDB.
   - `clearApiKey()` -- deletes from IndexedDB.

   This is wrapped by `src/hooks/useApiKey.ts` which loads the key on mount and exposes `{ apiKey, hasApiKey, loading, updateKey, removeKey }`, further wrapped by `src/contexts/ApiKeyContext.tsx`.

3. **`convex/foodLlmMatching.ts` -- `matchUnresolvedItems` action (line 383)** [CURRENTLY A NO-OP]

   The action currently just logs a warning and returns `{ matched: 0, unresolved: 0 }`. If it were active, it would:
   - Build a registry vocabulary prompt from `FOOD_REGISTRY` via `buildRegistryVocabularyForPrompt()`.
   - Build system + user messages via `buildMatchingPrompt()` -- sanitizes user input, creates structured JSON in user message (prevents prompt injection).
   - Call OpenAI chat completions API with the user's API key.
   - Parse the JSON response via `parseLlmResponse()` -- validates schema, strips code fences.
   - Process results via `processLlmResults()`:
     - Verifies each LLM-suggested canonical name against the registry via `getFoodZone()`.
     - Falls back to `canonicalizeKnownFoodName()` for hallucinated names.
     - Items the LLM marks as `"NOT_ON_LIST"` stay unresolved.
   - Write results back via `applyLlmResults` mutation (also currently throws an error).

#### Error/Fallback Branches (If Active)

- **No API key in IndexedDB:** Hook exits early at line 92 (`if (!hasApiKey || !apiKeyRef.current) return`). No matching attempted.
- **Non-retryable errors** (invalid key, auth failure): Log ID stays in `sentLogIdsRef` Set -- prevents retry loops.
- **Retryable errors** (rate limit, server error): Log ID is removed from `sentLogIdsRef` Set -- next render cycle will retry.
- **LLM returns invalid JSON:** `parseLlmResponse()` returns `null`. Matching fails silently.
- **LLM hallucinates canonicals not in registry:** `processLlmResults()` tries `canonicalizeKnownFoodName()` as a fallback. If that also fails, item stays unresolved.

#### Files Involved

| File                              | Purpose                                                           |
| --------------------------------- | ----------------------------------------------------------------- |
| `src/hooks/useFoodLlmMatching.ts` | Client hook: detects unresolved items, calls action (DORMANT)     |
| `src/contexts/ApiKeyContext.tsx`  | React context: wraps `useApiKey`                                  |
| `src/hooks/useApiKey.ts`          | Hook: loads API key from IndexedDB on mount                       |
| `src/lib/apiKeyStore.ts`          | IndexedDB CRUD for OpenAI API key via `idb-keyval`                |
| `convex/foodLlmMatching.ts`       | Server action: full LLM matching pipeline (STUBBED OUT)           |
| `convex/foodParsing.ts`           | `applyLlmResults` mutation (THROWS ERROR)                         |
| `shared/foodRegistry.ts`          | Registry data for vocabulary prompt and validation                |
| `shared/foodCanonicalization.ts`  | `canonicalizeKnownFoodName()` -- deterministic name normalization |
| `shared/foodParsing.ts`           | `parseLeadingQuantity()` -- quantity extraction                   |
| `convex/lib/inputSafety.ts`       | `sanitizePlainText()` -- input sanitization for prompts           |

---

## Flow 3: Manual User Resolution (Unresolved Item Review)

When the server pipeline leaves items as "pending" (medium or low confidence), the user can manually resolve them.

### Trigger

1. **`src/hooks/useUnresolvedFoodToast.ts`** -- monitors logs for unresolved items within a 6-hour window. Shows a persistent toast notification:
   - Hours 0-3: gentle message ("N foods couldn't be matched").
   - Hours 3-6: urgent message ("N foods still unmatched -- will be excluded from analysis").
   - Toast has a "Review" action button.

2. **`src/hooks/useUnresolvedFoodQueue.ts`** -- builds a flat queue of `UnresolvedQueueItem[]` from all food logs with "pending" status items.

3. **`src/pages/Track.tsx` (line 230-244)** -- wires the toast callback to open the `FoodMatchingModal`.

### Happy Path

1. User clicks "Review" on the toast (or the queue opens automatically).
2. **`src/components/track/FoodMatchingModal.tsx`** opens in queue mode, showing one unresolved item at a time.
3. Modal displays:
   - **Candidate suggestions** from the server pipeline's `matchCandidates` (with confidence %).
   - **Bucket options** for category-level navigation.
   - **Full registry search** via `api.foodParsing.searchFoods` query.
   - **"Request it be added"** link for foods not in the registry.
4. User selects a canonical name and clicks "Match".
5. **`FoodMatchingModal` -- `handleSave()` (line 159)**: calls `resolveItem` mutation.
6. **`convex/foodParsing.ts` -- `resolveItem` mutation (line 1137)**:
   - Validates auth, ownership, item index range.
   - Checks item is not already resolved (throws `ConvexError` if it is).
   - Validates canonical name exists in registry via `isCanonicalFood()`.
   - Updates the item with `resolvedBy: "user"`, `matchStrategy: "user"`, `matchConfidence: 1`.
   - Clears `matchCandidates` and `bucketOptions` from the item.
   - **Learns the alias:** calls `upsertLearnedAlias()` to save `parsedName -> canonicalName` in the `foodAliases` table, so future matching of the same text auto-resolves.

---

## Architectural Observations

### Surprising Findings

1. **Preset metadata is discarded.** `FoodSection` carefully builds `ParsedItem` objects with `fromPreset` and `presetIngredients`, but `useFoodParsing` ignores the `_items` parameter entirely and only sends `rawText`. The preset information never reaches the server.

2. **Two LLM paths, one dormant.** The BYOK client-initiated LLM path (`useFoodLlmMatching` hook + `matchUnresolvedItems` action + `applyLlmResults` mutation) is fully implemented but completely disconnected. The server pipeline's `tryLlmFallback` uses the server's own API key instead. This creates dead code (~400 lines in `convex/foodLlmMatching.ts` + ~140 lines in `src/hooks/useFoodLlmMatching.ts`).

3. **Double sanitization.** Input is sanitized both client-side (`src/lib/sync.ts` line 49) and server-side (`convex/logs.ts` line 841). This is defensive but means every string is processed twice through `sanitizeUnknownStringsDeep`.

4. **Evidence window is fire-and-forget.** The 6-hour `processEvidence` scheduler has no retry mechanism. If it fails (Convex outage, mutation error), unresolved items never get marked as expired and never produce `ingredientExposures` records.

5. **Embedding staleness check is expensive.** `ensureFoodEmbeddings` calls `listFoodEmbeddings` which pulls full 1536-dimension embedding vectors from all rows just to check `embeddingSourceHash` staleness. The comment at line 284-288 acknowledges this.
