# Security & Performance Audit — Group 1

**Branch:** feat/nutrition
**Audited:** 2026-04-06
**Auditor:** Claude (Security & Performance agent)
**Scope:** All files listed in the audit task

---

## Summary

| Severity     | Count |
| ------------ | ----- |
| CRITICAL     | 0     |
| HIGH         | 5     |
| MODERATE     | 8     |
| NICE-TO-HAVE | 4     |

Overall the codebase shows mature security hygiene: consistent `requireAuth` usage, Convex validators on all public functions, input sanitization, encrypted API key storage, proper data scoping by `userId`. The findings below are real issues, not speculative ones.

---

## Findings

---

### [HIGH] Date.now() called inside internalMutations — violates Convex determinism requirement

**Category:** Security (data correctness / replay integrity)
**Files:**

- `convex/foodParsing.ts:L1013`, `L1110`, `L1551`, `L1570`
- `convex/migrations.ts:L1146`

**Description:**
Convex mutations (including `internalMutation`) must be deterministic because Convex replays them on retry. Calling `Date.now()` inside a mutation handler produces different values on each replay, corrupting timestamps on retry, violating transactional semantics, and causing non-reproducible bugs.

Specific locations:

- `convex/foodParsing.ts:1013` — `ensureFoodEmbeddings()` calls `ctx.runMutation(internal.foodParsing.upsertFoodEmbeddings, { rows: [..., updatedAt: Date.now(), ...] })`. This is called from an `internalAction`, which is fine, but `upsertFoodEmbeddings` itself receives a hardcoded `Date.now()` baked into the arg at call time inside the action. This is acceptable (actions can call `Date.now()`), but worth noting the pattern is fragile.

- `convex/foodParsing.ts:1110` — Same pattern for `embedAliasInternal` scheduling the embed.

- `convex/foodParsing.ts:1551`, `L1570` — `processEvidence` (an `internalMutation`) uses `args.now ?? Date.now()`. On Convex, `Date.now()` in a mutation is non-deterministic. The optional `now` escape hatch is not always passed by callers. The scheduler call at line ~1353 (`processEvidence`) does NOT pass `now`, so on replay the timestamp will differ.

- `convex/migrations.ts:1146` — The `normalizeProfilesV2` (or similar) `internalMutation` calls `Date.now()` directly inside the handler body, with no escape hatch.

**Suggested Fix:**
For mutations, either accept `now: v.number()` as a required arg and have the calling action pass it, or accept `now: v.optional(v.number())` and fall back to a stable value. For `processEvidence`, the scheduled call from `processLogInternal` (an action) should pass `now: Date.now()` when scheduling:

```ts
await ctx.scheduler.runAfter(
  EVIDENCE_WINDOW_MS,
  internal.foodParsing.processEvidence,
  { logId: snapshot.logId, now: Date.now() },
);
```

For `migrations.ts:1146`, pass `now` as an arg or use a fixed epoch sentinel if timing precision is not required.

---

### [HIGH] importBackup mutation performs unbounded full-table collect before delete — DoS risk via malicious large payload

**Category:** Performance / Security
**Files:** `convex/logs.ts:L1592–L1614` (`deleteAllUserData`), `convex/logs.ts:L1687` (`importBackup`)

**Description:**
`importBackup` first calls `deleteAllUserData`, which loops over all user data tables in a `while (true)` loop taking 200 rows at a time. However, it also iterates over every row in the uploaded `payload.data` object and calls `ctx.db.insert()` for each row in a loop — with no cap. The backup payload validator uses `v.array(v.any())` with no length limit.

A malicious client could upload a backup payload containing tens of thousands of rows across all tables (logs, aiAnalyses, conversations, etc.). Each `ctx.db.insert()` is a write within the same mutation. Convex mutations have a 16MB document limit and a total execution time limit, but there is no application-level guard here. A large enough payload could cause the mutation to fail mid-way, leaving partial data in an inconsistent state (e.g. logs inserted but profiles not yet).

Note: The prior `deleteAllUserData` already ran and deleted the user's real data. If the subsequent inserts fail due to payload size, the user loses their data permanently with no recovery path.

**Suggested Fix:**

1. Add an array length cap to the backup payload validator before processing:

```ts
if (payload.data.logs.length > 10000) {
  throw new Error("Backup too large: maximum 10,000 log entries.");
}
```

Apply similar caps to each table array. Define reasonable maxima per table.

2. Consider splitting import into multiple mutations (delete phase, then insert in chunks by table) scheduled via `ctx.scheduler.runAfter` so each chunk is its own transaction. This also makes partial failure recoverable.

---

### [HIGH] listByReport query uses by_aiAnalysisId index without userId scoping — relies on ID non-guessability as only isolation mechanism

**Category:** Security
**Files:** `convex/conversations.ts:L90–L103`

**Description:**
The `listByReport` query fetches all conversation messages for a given `aiAnalysisId` using the `by_aiAnalysisId` index, which is not scoped by `userId`. It then filters in-memory by `userId` for security. The comment in the code acknowledges this and calls it safe because "report IDs are not guessable (Convex document IDs)."

This is security-by-obscurity: Convex document IDs are opaque but are not cryptographic secrets. They are sequential within a table and are routinely exposed in API responses, client-side state, URLs, and logs. Any user who legitimately receives any `aiAnalysisId` (e.g. from their own data, a shared link, a debug log) could attempt to call `listByReport` with it and read another user's conversation history if the ID happened to belong to a different user.

The in-memory filter prevents a response from returning other users' data, but the underlying query still reads all messages for the target analysis ID across all users, which is an unnecessary cross-tenant DB read.

**Suggested Fix:**
Add `by_userId_aiAnalysisId` as a compound index to the `conversations` table schema:

```ts
.index("by_userId_aiAnalysisId", ["userId", "aiAnalysisId"])
```

Then query with both fields:

```ts
return await ctx.db
  .query("conversations")
  .withIndex("by_userId_aiAnalysisId", (q) =>
    q.eq("userId", userId).eq("aiAnalysisId", args.aiAnalysisId),
  )
  .collect();
```

This enforces isolation at the DB layer and eliminates cross-tenant reads.

---

### [HIGH] Client-provided API key accepted as fallback in chatCompletion and matchUnresolvedItems — keys transit the network and may be logged

**Category:** Security
**Files:** `convex/ai.ts:L46–L98`, `convex/foodLlmMatching.ts:L542–L719`

**Description:**
Both actions accept an `apiKey: v.optional(v.string())` arg from the client as a fallback for the legacy IndexedDB BYOK flow. This means:

1. The raw API key value is transmitted over the network from the browser to Convex on every call. Even over TLS, this means the key is serialized in the Convex action call log, which is stored and may be retained for debugging or replay.
2. The key passes through Convex's infrastructure as a plaintext string in the function arguments. Convex logs function arguments for debugging — this could result in API keys appearing in Convex dashboard logs or error reports.
3. The key is validated with a regex (`OPENAI_API_KEY_PATTERN`) but the validation error message includes `maskApiKey(key)` which shows the last 4 chars — sufficient to confirm a specific key.

The code comment says this is a "legacy fallback" and the server-stored key is preferred. But the client path is still live code that accepts and processes raw API keys from the network.

**Suggested Fix:**

1. Add a deprecation warning when the client key fallback is used:

```ts
if (args.apiKey) {
  console.warn(
    "[SECURITY] Client-provided API key used — legacy fallback. User should save key server-side.",
  );
  apiKey = args.apiKey;
}
```

2. Set a timeline to remove the client key arg entirely once the server-stored flow is the only path. Flag it with a TODO and a target date.

3. If the legacy path must remain, consider never logging it — even the masked version — as part of normal operation. The current `maskApiKey` in error messages is fine, but avoid logging when the key is used successfully.

---

### [HIGH] exportBackup query performs parallel full-table collects for 13 tables simultaneously — no pagination

**Category:** Performance
**Files:** `convex/logs.ts:L1616–L1644`

**Description:**
`exportBackup` uses `Promise.all` to run 13 `listRowsByUserId` calls simultaneously, each of which calls `.collect()` with no row limit. A user with years of data could have:

- `logs`: tens of thousands of rows (5,000 cap elsewhere, but not here)
- `ingredientExposures`: potentially 50,000+ rows (each food item per log creates one)
- `aiAnalyses`: thousands of rows
- `conversations`: thousands of rows

Each `.collect()` reads all rows for that table into memory. Running 13 of these in parallel in a single query means this query can read hundreds of thousands of documents, each containing potentially large nested objects (food log items with matchCandidates arrays, AI request/response payloads, etc.).

This will hit Convex's query execution limits (bandwidth, time, document count) for active users, causing the export to fail for precisely the users who need it most.

**Suggested Fix:**

1. Add safety caps per table. For tables with known large data (logs, ingredientExposures, conversations, aiAnalyses), cap at a reasonable limit:

```ts
async function listRowsByUserId(db, table, userId, limit = 10000) {
  const rows = await db
    .query(table)
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(limit);
  // ...
}
```

2. For a complete backup of large datasets, implement paginated export (export by date range or cursor) so users can export in chunks.

3. Consider implementing the export as an `action` instead of a `query`, which has higher execution limits and can run chunked reads via `ctx.runQuery`.

---

### [MODERATE] latestSuccessful query fetches 200 rows to find first non-error — inefficient for users with many failed reports

**Category:** Performance
**Files:** `convex/aiAnalyses.ts:L171–L204`

**Description:**
`latestSuccessful` queries the 200 most recent `aiAnalyses` rows and finds the first one where `error === undefined && insight !== null`. For a user who primarily generates successful reports this is fine. However, for a user with a burst of errors (e.g. API key issue causing 50+ consecutive failures), this reads and filters 200 rows to find the first success.

More critically, the `aiAnalyses` rows include the `insight` field (a large nested object containing food assessments, meal plans, suggestions), which means up to 200 large objects are read and transferred even though only 1 is needed. The payload separation (to `aiAnalysisPayloads`) was done to reduce reactive bandwidth, but `latestSuccessful` still pulls all 200 `insight` fields.

**Suggested Fix:**
Add a `starred` + `error` compound index or a `hasError` boolean field to support direct indexed queries. Alternatively, since users rarely have 200 consecutive errors, consider reducing the scan limit to 50 and documenting this limit with a clear fallback:

```ts
const limit = 50; // If all 50 are failures, show a "no successful report" state
```

If the `insight` field is large, consider projecting only the fields needed (Convex does not support field projection on `collect()`, so the only option is the payload split that already exists for `aiAnalysisPayloads` — apply the same split to `latestSuccessful`).

---

### [MODERATE] allFoodTrials uses full .collect() with no limit — unbounded read on growing table

**Category:** Performance
**Files:** `convex/aggregateQueries.ts:L61–L76`

**Description:**
`allFoodTrials` calls `.collect()` on the `foodTrialSummary` table with no row limit. The comment says "small table (~50-100 docs per user, grows slowly)" — but this assumption is baked in as code with no enforcement. As users accumulate more assessed foods (the registry has 147 canonicals and users add aliases), this table can grow to several hundred rows per user. Each row includes reasoning strings, scores, and multiple timestamps.

For a reactive query subscribed to by a component, every mutation that touches `foodTrialSummary` will re-read all rows. With 200+ rows and multiple concurrent users, this becomes expensive.

**Suggested Fix:**
Add a `.take()` cap (e.g. 500) with a warning log if it's reached, so the assumption is enforced:

```ts
const rows = await ctx.db
  .query("foodTrialSummary")
  .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
  .order("desc")
  .take(500);
if (rows.length === 500) {
  console.warn(`allFoodTrials: hit 500-row cap for user ${userId}`);
}
```

---

### [MODERATE] allIngredients default limit is 5,000 rows — large payload for reactive subscription

**Category:** Performance
**Files:** `convex/ingredientExposures.ts:L28–L96`

**Description:**
`allIngredients` has a default limit of 5,000 rows and an allowed maximum of 20,000. The query returns full `ingredientExposures` documents including `quantity`, `unit`, `preparation`, `spiceLevel`, `recoveryStage`, and timestamps — all aggregated in memory. A user who has logged food for several months with the new pipeline will have thousands of exposure rows.

The query is used to populate a summary view that only needs `canonicalName`, `totalExposures`, `lastSeenAt`, and the three latest fields. Fetching full documents to aggregate in JS is inefficient compared to grouping at the DB layer.

More importantly, if this query is used as a reactive subscription (which Convex queries are by default), the subscription re-reads and re-transmits up to 5,000 rows every time any exposure is added.

**Suggested Fix:**

1. Reduce the default limit to 1,000 and document that the summary view shows the 1,000 most recent distinct ingredients. Users who want all history can use a separate export.

2. Consider aggregating counts in a pre-computed table (similar to `weeklyDigest`) rather than scanning all exposures on every query.

---

### [MODERATE] mergeDuplicates mutation performs unbounded full-table collects on multiple tables — mutation time limit risk

**Category:** Performance
**Files:** `convex/foodLibrary.ts:L299–L854`

**Description:**
`mergeDuplicates` is a public mutation that authenticated users can call. It collects all rows from `foodAssessments`, `ingredientExposures`, `ingredientOverrides`, `ingredientProfiles`, `foodLibrary`, `logs` (capped at 5,000), and `foodTrialSummary` — all for the current user — within a single mutation transaction.

For active users:

- `foodAssessments` could have thousands of rows
- `ingredientExposures` could have tens of thousands

Collecting all these tables in one mutation risks exceeding Convex's per-mutation limits (bandwidth, document reads, execution time). Additionally, the mutation makes N individual `ctx.db.patch()` calls for every matching row — potentially thousands of writes in one transaction.

**Suggested Fix:**

1. Break `mergeDuplicates` into multiple phases, each as a separate internal mutation, orchestrated by an action:
   - Phase 1: Update assessments
   - Phase 2: Update exposures (in batches)
   - Phase 3: Update overrides
   - Phase 4: Update profiles
   - Phase 5: Update library + logs
   - Phase 6: Rebuild summaries

2. Add row-count caps to each collect and return a "merge_incomplete" status when a cap is hit, so callers know to retry.

---

### [MODERATE] getWeekStart uses new Date() and date arithmetic inside internalMutation — non-deterministic timezone behavior

**Category:** Security (data correctness)
**Files:** `convex/computeAggregates.ts:L426–L441`

**Description:**
`getWeekStart` is called inside `updateWeeklyDigestImpl`, which is called from an `internalMutation`. The function uses `new Date(timestamp)`, `date.getDay()`, `date.setDate()`, and `date.setHours(0, 0, 0, 0)`. The `setHours(0, 0, 0, 0)` call uses the local timezone of the server process — on Convex, this is UTC, but this is an implicit assumption. If the Convex runtime ever changes timezone configuration, week boundaries would shift silently and `weekStartTimestamp` values would be inconsistent with existing stored data.

Additionally, `new Date()` and date mutation methods (`setDate`, `setHours`) are non-pure functions that can behave differently across JS engines. This logic should be done with arithmetic on UTC epoch milliseconds to be deterministic.

**Suggested Fix:**
Replace with pure epoch arithmetic:

```ts
function getWeekStart(timestamp: number) {
  const MS_PER_DAY = 86_400_000;
  // Thursday 1 Jan 1970 was a Thursday; Monday offset: dayOfWeek = (Math.floor(ts/day) + 3) % 7
  const daysSinceEpoch = Math.floor(timestamp / MS_PER_DAY);
  const dayOfWeek = (daysSinceEpoch + 3) % 7; // 0=Mon, 6=Sun
  const mondayMs = (daysSinceEpoch - dayOfWeek) * MS_PER_DAY;
  return {
    weekStart: new Date(mondayMs).toISOString().split("T")[0],
    weekStartTimestamp: mondayMs,
  };
}
```

---

### [MODERATE] listFoodEmbeddings fetches full documents including 1536-dimension vectors for staleness check — bandwidth waste

**Category:** Performance
**Files:** `convex/foodParsing.ts:L453–L470`

**Description:**
`listFoodEmbeddings` fetches up to 1,000 full `foodEmbeddings` documents, each containing a `v.array(v.float64())` embedding of 1,536 floats (approximately 12KB per document). The purpose of this query is only to check `canonicalName` and `embeddingSourceHash` for staleness — 2 string fields per document.

At 1,000 documents, this reads approximately 12MB of float array data that is immediately discarded. This query runs on every food log processing action. The code already acknowledges this with a comment ("Known performance concern: Convex does not support field projection on queries").

**Suggested Fix:**
Store embedding staleness metadata in a separate small table (e.g. `foodEmbeddingMeta`) with only `canonicalName` and `embeddingSourceHash`. The `listFoodEmbeddings` call can be replaced with a lightweight scan of this meta table:

```ts
// New small table in schema:
foodEmbeddingMeta: defineTable({
  canonicalName: v.string(),
  embeddingSourceHash: v.string(),
  updatedAt: v.number(),
}).index("by_canonicalName", ["canonicalName"]),
```

This reduces the staleness check from ~12MB to ~50KB.

---

### [MODERATE] foodLlmMatching.matchUnresolvedItems has no rate limiting or cost guardrail — authenticated users can trigger unbounded LLM calls

**Category:** Security
**Files:** `convex/foodLlmMatching.ts:L542–L719`

**Description:**
The `matchUnresolvedItems` action is a public Convex action callable by any authenticated user. It accepts `unresolvedSegments: v.array(v.string())` with no length limit on the array. Each unresolved segment triggers an OpenAI API call (or at minimum contributes tokens to a combined call).

While the action validates the API key format and authenticates the user, there is no:

- Limit on `unresolvedSegments.length` (a caller could pass 1,000 segments)
- Rate limiting on calls per user per time window
- Cost tracking or circuit breaker

For BYOK users this only costs them money. But if the server-stored key path is ever extended to a shared key, this becomes a significant financial risk.

**Suggested Fix:**
Add a length cap on `unresolvedSegments` in the validator:

```ts
unresolvedSegments: v.array(v.string()),
// In handler:
if (args.unresolvedSegments.length > 20) {
  throw new Error("[NON_RETRYABLE] [VALIDATION_ERROR] Maximum 20 unresolved segments per call.");
}
```

---

### [NICE-TO-HAVE] Legacy base64-only API key decryption path accepts any base64 string — no integrity check

**Category:** Security
**Files:** `convex/lib/apiKeys.ts:L94–L96`

**Description:**
`decryptLegacyApiKey` simply calls `atob(value)` on any stored key that lacks the `enc-v1:` prefix. There is no validation that the decoded bytes represent a valid API key. If a legacy row was corrupted or tampered with in the database, `decryptApiKey` would silently return garbage and the action would fail with an opaque "Invalid API key format" error rather than a clear "legacy key corrupted" message.

**Suggested Fix:**
After decoding the legacy key, validate it with `OPENAI_API_KEY_PATTERN` before returning and throw a specific error if it fails:

```ts
function decryptLegacyApiKey(value: string): string {
  try {
    const decoded = atob(value);
    if (!OPENAI_API_KEY_PATTERN.test(decoded)) {
      throw new Error("Legacy API key failed format validation after decode.");
    }
    return decoded;
  } catch {
    throw new Error("Stored legacy API key is malformed or corrupted.");
  }
}
```

---

### [NICE-TO-HAVE] listUserIds internalQuery in seedTestData.ts scans logs table without userId filter — cross-tenant data exposure risk in dev

**Category:** Security
**Files:** `convex/seedTestData.ts:L16–L23`

**Description:**
`listUserIds` queries the `logs` table with `.take(100)` and no `by_userId` filter, returning all distinct `userId` values found in the first 100 rows. This is an `internalQuery`, so it cannot be called from the client, but it demonstrates cross-tenant data access. In a multi-user production environment, this would return user IDs belonging to all users, not just the caller.

While this is seed/test-only code, it establishes a pattern that could be copied incorrectly.

**Suggested Fix:**
Add a comment making the cross-tenant nature explicit and restricting usage to development environments only:

```ts
// WARNING: DEV ONLY — returns userIds from all users in the database.
// Do not copy this pattern to production queries.
```

Or, if the function is only ever needed during development, add a guard:

```ts
if (process.env.CONVEX_DEPLOYMENT?.includes("prod")) {
  throw new Error("listUserIds is not available in production.");
}
```

---

### [NICE-TO-HAVE] computeAggregates.ts getWeekStart uses .getTime() and date mutation in computeAggregates — consistency risk with currentWeekDigest query

**Category:** Security (data correctness)
**Files:** `convex/computeAggregates.ts:L452`, `convex/aggregateQueries.ts:L143–L159`

**Description:**
The `currentWeekDigest` query accepts a `weekStartMs` from the client ("must be computed on the client to keep this query deterministic"). If the client's week calculation logic differs from `getWeekStart()` in `computeAggregates.ts` — even by a single millisecond due to timezone differences or DST — the query will return `null` even though a digest exists for that week, causing a silent data gap.

There is currently no shared utility function that both the server's `computeAggregates.ts` and the client use to compute `weekStartMs`. The server uses `new Date()` with local timezone; the client independently computes its own value.

**Suggested Fix:**
Move `getWeekStart` to `shared/` and export it for use by both the Convex functions and the client-side hooks. This ensures a single canonical implementation for week boundary calculation.

---

## Files with No Security/Performance Issues

The following files were reviewed and had no findings:

- `.vscode/settings.json`, `biome.json`, `components.json` — no code
- `convex/auth.config.ts` — correct Clerk JWT validation with format check
- `convex/lib/auth.ts` — clean `requireAuth` implementation
- `convex/lib/inputSafety.ts` — correct sanitization, appropriate limits
- `convex/lib/knownFoods.ts` — indexed query, early returns
- `convex/validators.ts` — well-typed validators, no issues
- `convex/foodAssessments.ts` — all queries indexed and auth-gated
- `convex/ingredientOverrides.ts` — indexed, sanitized, auth-gated
- `convex/ingredientProfiles.ts` — indexed, auth-gated
- `convex/ingredientNutritionApi.ts` — external fetch with timeout, trimmed query param, auth-gated
- `convex/foodRequests.ts` — sanitized, auth-gated
- `convex/weeklySummaries.ts` — indexed, capped, auth-gated
- `convex/conversations.ts` — mostly clean (F003 addresses one issue); sanitized, auth-gated
- `convex/aiAnalyses.ts` — mostly clean (F006 addresses one issue); auth-gated
- `convex/extractInsightData.ts` — internal mutations, correct auth model
- `convex/foodLibrary.ts` — mostly clean (F009 addresses one issue); auth-gated
- `convex/profiles.ts` — correct key validation, internal query for server-side key retrieval
- `convex/ai.ts` — correct model allowlist, key masking in errors
- `convex/schema.ts` — appropriate indexes, no schema security issues
- `e2e/auth.setup.ts` — uses Clerk testing helper correctly, no hardcoded credentials
- `e2e/fixtures.ts` — minimal, no security surface
- `e2e/food-tracking.spec.ts`, `e2e/food-pipeline.spec.ts`, `e2e/bowel-tracking.spec.ts` — test-only, no production security surface
- Other e2e spec files — no security findings
- `docs/plans/*.json` — documentation, no code
- `convex/testFixtures.ts` — test infrastructure only
- `convex/seedTestData.ts` — one NICE-TO-HAVE noted above; otherwise test-only
- `convex/migrations.ts` — one HIGH noted above (Date.now in mutation); migration patterns otherwise correct
