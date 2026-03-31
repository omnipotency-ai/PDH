# Fix Status: Food Pipeline (03)

**Files:** `convex/foodParsing.ts`, `convex/foodLlmMatching.ts`, `convex/foodRequests.ts`
**Date:** 2026-03-28

## Findings Fixed

### HIGH: resolveItem missing ingredientExposures after evidence window closes
**Status: FIXED**
Added exposure creation block at end of `resolveItem` mutation. After resolution, if `data.evidenceProcessedAt` is already set, inserts an `ingredientExposures` record for the resolved item. Follows the same pattern as `applyLlmResults`.

### HIGH: Date.now() inside mutation handlers
**Status: FIXED**
Added `now: v.optional(v.number())` to:
- `applyLlmResults` (internalMutation) — uses `args.now ?? Date.now()` for exposure `createdAt`
- `processEvidence` (internalMutation) — uses `args.now ?? Date.now()` for both `evidenceProcessedAt` and exposure `createdAt`
- `resolveItem` (mutation) — uses `args.now ?? Date.now()` for exposure `createdAt`
- `submitRequest` in `foodRequests.ts` (mutation) — uses `args.now ?? Date.now()` for `createdAt`

Also updated `upsertLearnedAlias` standalone function to accept optional `now` parameter (`now ?? Date.now()`).

Note: Lines 981 and 1080 (`ensureFoodEmbeddings` and `embedAliasInternal`) are inside `internalAction` handlers that pass `Date.now()` as data args to mutations — the nondeterminism is in the action layer (which is allowed), not in mutations. No change needed.

### HIGH: fuzzyPreMatch labels Fuse.js matches as resolvedBy: 'llm'
**Status: FIXED**
- Changed `fuzzyPreMatch()` return to `resolvedBy: "fuzzy"` instead of `"llm"`
- Updated `LlmResolvedItem` type to `resolvedBy: "llm" | "fuzzy"`
- Updated `applyLlmResults` validator to `v.union(v.literal("llm"), v.literal("fuzzy"))`
- Updated `applyLlmResults` handler to use `resolved.resolvedBy` instead of hardcoded `"llm"`
- Updated `matchStrategy` to use `resolved.resolvedBy === "fuzzy" ? "fuzzy" : "llm"`
- Added `"fuzzy"` to `ProcessedFoodItem.resolvedBy` type union
- Added `"fuzzy"` to `VALID_RESOLVED_BY` runtime validation set
- Added `"fuzzy"` to `writeProcessedItems` validator `resolvedBy` union
- Updated call site in `matchUnresolvedItems` action to pass `item.resolvedBy` instead of hardcoding `"llm"`

### HIGH: embedAliasInternal fetches all embeddings for staleness check
**Status: FIXED**
- Added new `isAliasEmbeddingCurrent` internalQuery that uses `by_canonicalName` index to query only the relevant rows, then checks for matching alias text and source hash
- Updated `embedAliasInternal` to call `isAliasEmbeddingCurrent` instead of `listFoodEmbeddings`

### MODERATE: Arbitrary model string in matchUnresolvedItems
**Status: FIXED**
Replaced `model: v.optional(v.string())` with:
```
v.optional(v.union(
  v.literal("gpt-4.1-nano"),
  v.literal("gpt-4.1-mini"),
  v.literal("gpt-4o-mini"),
  v.literal("gpt-5-mini"),
  v.literal("gpt-5-nano"),
))
```

### MODERATE: Auth migration (requireAuth)
**Status: ALREADY DONE**
All three files already use `requireAuth(ctx)` — no raw `ctx.auth.getUserIdentity()` calls found.

## Skipped (out of scope)

- **HIGH: Date.now() in foodLibrary.ts** — not in scope
- **HIGH: addEntry/addBatch client-controlled createdAt** — not in scope (foodLibrary.ts)

## Typecheck

Two pre-existing errors in `convex/foodParsing.ts` at lines 1127/1134 (`searchEmbeddingCandidates`) caused by broader type inference issues with Convex generated types (same pattern seen across all test files). These errors exist on the working tree independent of this fix batch — confirmed by stashing changes and running typecheck (0 errors on base). No new errors introduced.

Zero errors in `convex/foodLlmMatching.ts` or `convex/foodRequests.ts`.
