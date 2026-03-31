# Fix Status: Food, Ingredients, Validators & API Keys

**Date:** 2026-03-28
**Files:** `convex/foodAssessments.ts`, `convex/foodLibrary.ts`, `convex/ingredientExposures.ts`, `convex/ingredientOverrides.ts`, `convex/ingredientProfiles.ts`, `convex/ingredientNutritionApi.ts`, `convex/validators.ts`, `convex/lib/apiKeys.ts`

## Summary

All 12 audit findings fixed. Typecheck passes on all modified source files (pre-existing errors in test files only).

## HIGH Findings

### Bristol range enforcement (validators.ts) -- FIXED
- Replaced `v.number()` with `v.union(v.literal(1), ..., v.literal(7))` for `bristolCode` in `digestiveLogDataValidator`.
- Exported as `bristolCodeValidator` for reuse.

### Auth migration -- FIXED
- Replaced raw `ctx.auth.getUserIdentity()` + null check + `.subject` with `requireAuth(ctx)` from `convex/lib/auth.ts` in all 8 files:
  - `foodAssessments.ts`: 6 queries
  - `foodLibrary.ts`: 5 mutations/queries
  - `ingredientExposures.ts`: 2 queries
  - `ingredientOverrides.ts`: 3 mutations/queries
  - `ingredientProfiles.ts`: 3 mutations/queries
  - `ingredientNutritionApi.ts`: 1 action

### Encryption key cache rejection poisoning (lib/apiKeys.ts) -- FIXED
- Added `.catch()` handler to the cached promise that clears `cachedEncryptionKey` and `cachedEncryptionSecret` on rejection, preventing permanent cache poisoning.

### Date.now() in apiKeys.ts -- FIXED
- Added optional `now?: number` parameter to `storeApiKey()` and `deleteApiKey()` with `Date.now()` fallback. Callers unchanged (parameter is optional).

### Date.now() in foodLibrary.ts -- FIXED
- Added `now: v.optional(v.number())` to `updateEntry` and `mergeDuplicates` mutation args with `Date.now()` fallback.

### Client-controlled createdAt in addEntry/addBatch (foodLibrary.ts) -- FIXED
- Changed `createdAt` from `v.number()` to `v.optional(v.number())` in both `addEntry` and `addBatch` args (transitional: accepted but ignored).
- Server now generates `createdAt` via `Date.now()`.

## MODERATE Findings

### allFoods unbounded collect (foodAssessments.ts) -- FIXED
- Replaced `.collect()` with `.take(2000)` safety cap.

### mergeDuplicates unbounded log scan (foodLibrary.ts) -- FIXED
- Replaced `.collect()` with `.take(5000)` safety cap on the logs query inside `mergeDuplicates`.

### Note field unsanitized in ingredientOverrides.upsert -- FIXED
- Imported `sanitizePlainText` from `convex/lib/inputSafety.ts`.
- Applied sanitization + `.slice(0, 500)` max length to `note` field before storage.

### Query string max length in searchOpenFoodFacts -- FIXED
- Added `.slice(0, 200)` to the trimmed query string.

### addBatch no limit (foodLibrary.ts) -- FIXED
- Added guard: `if (args.entries.length > 100) throw new Error("Batch too large: maximum 100 entries per call.")`.

### canonicalName unsanitized in ingredientOverrides -- FIXED
- Applied `sanitizePlainText()` + `.slice(0, 200)` to `canonicalName` input in both `upsert` and `remove` mutations before passing to `resolveCanonicalFoodName`.

### foodAssessmentVerdictValidator out of sync with schema -- FIXED
- Added missing legacy values `v.literal("culprit")` and `v.literal("next_to_try")` to `foodAssessmentVerdictValidator` in `validators.ts` to match the 6-value schema definition.

## Typecheck Result

All modified source files pass typecheck. Pre-existing type errors exist only in test files (`*.test.ts`) which are outside scope.
