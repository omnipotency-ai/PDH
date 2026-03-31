# Audit Fix Status: convex/logs.ts, convex/profiles.ts, convex/migrations.ts

**Date:** 2026-03-28
**Files:** `convex/logs.ts`, `convex/profiles.ts`, `convex/migrations.ts`
**Typecheck:** Clean (no new errors introduced; 2 pre-existing errors in unrelated files)

---

## Fixed

### HIGH: Auth migration to requireAuth(ctx)

**convex/logs.ts** — 18 occurrences of raw `ctx.auth.getUserIdentity()` + manual null check + `identity.subject` replaced with `const { userId } = await requireAuth(ctx)`. Import added: `import { requireAuth } from "./lib/auth";`

**convex/profiles.ts** — 2 mutations (`setApiKey`, `removeApiKey`) migrated to `requireAuth(ctx)`. `hasServerApiKey` intentionally kept with raw auth because it returns `false` (not throws) when unauthenticated. `getServerApiKey` is an `internalQuery` with explicit `userId` arg — no auth needed.

### HIGH: Unbounded queries (convex/logs.ts)

- `listAll`: `.collect()` replaced with `.take(5000)` + comment referencing WQ-087.
- `count`: `.collect()` replaced with `.take(10000)` + TODO comment for Convex aggregate.
- `listFoodLogs`: `.collect()` replaced with `.take(5000)` + comment referencing WQ-087.

### HIGH: Date.now() in mutations (convex/logs.ts)

- `replaceProfile`: Added `now: v.optional(v.number())` arg. Uses `args.now ?? Date.now()` as transitional pattern. TODO comment added.
- `patchProfile`: Same treatment — optional `now` arg with `Date.now()` fallback.

### MODERATE: normalizeStoredAiModel silently overwrites user model selections

Changed from mapping everything non-`gpt-5-mini` to `gpt-5.4`, to:
- Known legacy names (`gpt-4o-mini`, `gpt-4o`, `gpt-4.1-nano`, `gpt-4.1-mini`) mapped to current equivalents.
- Unknown/unrecognized model strings passed through unchanged.
- Empty/non-string values default to `gpt-5.4`.

### MODERATE: batchUpdateFoodItems silently skips items

Added `skipped` counter to track items where: record not found, userId doesn't match, or type is not "food". Return value now: `{ updated, skipped }`.

### MODERATE: migrations.ts unbounded .collect()

4 migration functions updated with `.take(1000)` safety caps:
- `stripCalibrations`
- `normalizeProfileHabits`
- `normalizeProfileDomainV1`
- `normalizeLegacyTopLevelLogTypesV1`

---

## Not touched (out of scope)

- `convex/seedTestData.ts` — No auth migration needed (all `internalMutation` with explicit `userId` arg). Pre-existing type error (`bristolCode: number` vs strict union) not addressed per scope.
- `convex/testFixtures.ts` — Pure data fixtures, no auth or query patterns to fix.
- `convex/migrations.ts` auth in `backfillConversations` and `backfillDigestionLogFields` — These are `internalMutation` functions that use `ctx.auth.getUserIdentity()`. Internal mutations called from the dashboard lack auth context, making these functions broken-by-design. Not addressed because they weren't in the findings and fixing them requires changing the function signature (add explicit `userId` arg), which could break existing scheduled jobs.

---

## Deferred

- **WQ-087:** Pagination for `listAll`, `count`, `listFoodLogs` — safety caps are a stop-gap.
- **Client-side `Date.now()` pass-through:** Callers of `replaceProfile`/`patchProfile` should pass `now: Date.now()` for deterministic replay. Not done because client files were out of scope.
