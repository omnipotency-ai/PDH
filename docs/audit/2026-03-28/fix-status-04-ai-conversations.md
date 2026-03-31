# Fix Status: AI & Conversations Audit

**Files:** `convex/ai.ts`, `convex/aiAnalyses.ts`, `convex/conversations.ts`, `convex/weeklySummaries.ts`, `convex/validators.ts`
**Date:** 2026-03-28

## Findings Fixed

### HIGH: Auth migration (conversations.ts, weeklySummaries.ts) -- FIXED
- **conversations.ts:** Migrated `addUserMessage`, `addAssistantMessage`, `list`, `listByReport`, `listByDateRange`, `search` from raw `ctx.auth.getUserIdentity()` to `requireAuth(ctx)`. All 8 handlers now use consistent auth pattern.
- **weeklySummaries.ts:** Migrated `add`, `getLatest`, `getByWeek`, `listAll` from raw auth to `requireAuth(ctx)`. All 4 handlers now consistent.

### HIGH: Model arg unconstrained (ai.ts) -- FIXED
- Replaced `v.string()` with `v.union(v.literal("gpt-5.4"), v.literal("gpt-5-mini"), v.literal("gpt-5.2"))` inline validator.
- Also added `allowedModelsValidator` export to `convex/validators.ts` for reuse elsewhere.
- Note: Inline definition used in `ai.ts` to avoid circular type inference issues with the large `validators.ts` file under `"use node"`.

### HIGH: Client-supplied apiKey key-laundering (ai.ts) -- FIXED
- Changed `apiKey` arg from `v.string()` to `v.optional(v.string())`.
- Reversed preference order: server-stored key is now preferred, client key is fallback only.
- Added explicit error when no key is available from either source.
- Added documenting comments explaining the preference order and legacy fallback rationale.

### MODERATE: suggestionsByDateRange unbounded collect (aiAnalyses.ts) -- FIXED
- Replaced `.collect()` with `.take(500)`.

### MODERATE: latestSuccessful take(100) + in-JS filter (aiAnalyses.ts) -- FIXED
- Increased from `.take(100)` to `.take(200)`.
- Added `console.warn` when all 200 rows are failures (indicates systemic problem).

### MODERATE: listByReport reads across all users (conversations.ts) -- DOCUMENTED
- The `by_aiAnalysisId` index is not scoped by userId. In-memory filtering already exists and is correct.
- Added extensive comment documenting the limitation, explaining why a compound index wasn't added (schema already has 4 indexes + search), and noting that Convex document IDs are not guessable.
- A compound index `by_userId_aiAnalysisId` is tracked as a future improvement.

### MODERATE: Date.now() inside mutation handlers -- DOCUMENTED
- Verified: `addUserMessage` and `addAssistantMessage` accept `timestamp` as a client arg. This is the correct Convex pattern — mutations must be deterministic for replay, so `Date.now()` cannot be called inside them.
- Added documentation comments to both mutations explaining this design decision.

### MODERATE: Rate limiting on chatCompletion (ai.ts) -- DOCUMENTED
- Added TODO comment with specific approach: per-user rate limiting via a rate_limits table, 60 calls/hour threshold.
- No runtime implementation added (requires new table + schema migration).

## Typecheck Status

- `convex/aiAnalyses.ts`: Clean
- `convex/conversations.ts`: Clean
- `convex/weeklySummaries.ts`: Clean
- `convex/ai.ts`: 5 pre-existing circular inference errors from concurrent working tree changes in other convex files (not introduced by this audit). Clean on committed tree.
- `convex/validators.ts`: Clean (added `allowedModelsValidator` export)
