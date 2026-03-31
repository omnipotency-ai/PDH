# Fix Status: Aggregates, Waitlist, ExtractInsightData

**Files:** `convex/aggregateQueries.ts`, `convex/computeAggregates.ts`, `convex/waitlist.ts`, `convex/extractInsightData.ts`
**Also touched:** `src/lib/syncWeekly.ts` (client call-site), `convex/computeAggregates.test.ts` (test update)

## HIGH Fixes

### Auth migration — DONE
All `ctx.auth.getUserIdentity()` + `identity.subject` replaced with `const { userId } = await requireAuth(ctx)` in:
- `aggregateQueries.ts`: 6 queries (allFoodTrials, foodTrialsByStatus, foodTrialByName, allWeeklyDigests, weeklyDigestByWeek, currentWeekDigest)
- `computeAggregates.ts`: 3 public mutations (backfillFoodTrials, backfillWeeklyDigests, backfillKnownFoods)
- `extractInsightData.ts`: 1 public mutation (backfillAll)
- `waitlist.ts`: N/A — intentionally unauthenticated (public waitlist form)

### Date.now() inside mutations — DONE
- `computeAggregates.ts` `updateWeeklyDigestImpl`: `updatedAt` now uses `args.now ?? Date.now()`
- `computeAggregates.ts` `updateWeeklyDigest` internalMutation: added `now: v.optional(v.number())` arg
- `computeAggregates.ts` `backfillWeeklyDigestsWorker`: added `now: v.optional(v.number())` arg, uses `args.now ?? Date.now()`
- `waitlist.ts` `join`: added `now: v.optional(v.number())` arg, all `Date.now()` replaced with `args.now ?? Date.now()`
- `waitlist.ts` `unsubscribe`: added `now: v.optional(v.number())` arg, same pattern

### new Date() in query (currentWeekDigest) — DONE
- Removed all `new Date()` / `getDay()` wall-clock logic from the query
- Query now accepts `weekStartMs: v.number()` arg (client computes Monday 00:00:00)
- Updated `src/lib/syncWeekly.ts` `useCurrentWeekDigest()` to compute week start on client
- Updated `convex/computeAggregates.test.ts` to pass `weekStartMs` arg

### Date.now() fallback in internalMutation (windowAnchor) — DONE
- `computeAggregates.ts` `updateFoodTrialSummaryImpl`: replaced `aiAnalysis?.timestamp ?? Date.now()` with explicit null check that throws: `if (!aiAnalysis) throw new Error(...)`

## MODERATE Fixes

### Waitlist email validation — DONE
- Added `EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` validation in both `join` and `unsubscribe`
- Added TODO comment about rate limiting (requires HTTP action wrapper or per-email cooldown)

### Scheduler stagger in extractInsightData — DONE
- `scheduleMissingExtractionsForUser`: replaced `runAfter(0, ...)` with `runAfter(processed * 500, ...)` matching `backfillFoodTrialsWorker` pattern

### backfillFoodTrialsWorker unbounded collect — DONE
- Changed `.collect()` to `.take(5000)` safety cap

### Dead code: deleteOrphans redundant conditional — DONE
- Collapsed the `if (expectedCanonicalNames.has(canonicalName)) { delete } else { delete }` into a single `delete` call

### latestAiVerdict no-op ternary — DONE
- Replaced the 5-line ternary `summary.latestAiVerdict === "avoid" ? "avoid" : ...` with `summary.latestAiVerdict`

## Typecheck

All errors in target files: **0 new errors introduced**.
One pre-existing error at `extractInsightData.ts:277` (`exactOptionalPropertyTypes` on `buildAssessmentSeeds` call) — unchanged code, not from this fix batch.
