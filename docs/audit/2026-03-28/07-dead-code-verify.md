Perfect! Now I have a complete picture. Let me compile the findings for all three items.

## Verification Report: Dead Code Items

### WQ-150: `toLegacyFoodStatus` in `shared/foodEvidence.ts`

**Status: NOT DEAD — actively used**

**Import sites found:**
- `src/lib/analysis.ts` (line 1)
- `convex/computeAggregates.ts` (import statement implied)
- `convex/foodLibrary.ts` (import statement implied)

**Usages:**
- `src/lib/analysis.ts:146` — converts `primaryStatus` + `tendency` to legacy status for `FoodStat`
- `convex/computeAggregates.ts:147` — maps Bayesian status to legacy format for `foodTrialSummary` insert
- `convex/foodLibrary.ts:806` — same pattern in full rebuild flow

**Correctness of usage:**
All three usages are correct. The function bridges between the new Bayesian `primaryStatus`/`tendency` model and the legacy 6-state `FoodStatus` union type ("testing" | "safe" | "safe-loose" | "safe-hard" | "watch" | "risky"). This is necessary because the `foodTrialSummary` schema stores `currentStatus` as this legacy type for backward compatibility.

**Recommended action: KEEP** — This is an intentional compatibility bridge. Do NOT delete.

---

### WQ-151: `columns` stale export in `patterns/database/columns.tsx`

**Status: DEAD — no consumers found**

**Export location:** `src/components/patterns/database/columns.tsx:390`
```typescript
export const columns = buildColumns();
```

**Import sites found:** None
- Not imported in `DatabaseTable.tsx` (uses `buildColumns()` directly)
- Not imported in barrel export `src/components/patterns/database/index.ts` (re-exports the symbol but nothing else imports it from the barrel)
- Not referenced anywhere else in the codebase

**Analysis:**
The `columns` export is a static snapshot created at module load time. As noted in the audit, this is problematic because:
1. `buildColumns()` should be called at render time for runtime configuration
2. Static snapshots ignore runtime configuration changes
3. The actual consuming code (`DatabaseTable.tsx`) imports and calls `buildColumns()` directly (line 18)

**Recommended action: DELETE** — Remove line 390 from `columns.tsx`. Consumers should call `buildColumns()` directly.

---

### WQ-153: `FILTER_OPTIONS`, `SortKey`, `SortDir` in `patterns/database/foodSafetyUtils.ts`

**Status: MIXED**

**Export location:** `src/components/patterns/database/foodSafetyUtils.ts`
- Line 21: `export type SortKey = "name" | "status" | "transits" | "lastEaten";`
- Line 22: `export type SortDir = "asc" | "desc";`
- Lines 24-30: `export const FILTER_OPTIONS: Array<{ value: FilterStatus; label: string }> = [...]`

**Import sites:**
- `src/components/patterns/database/index.ts:18, 21-22` — re-exported via barrel
- No direct imports from consuming code found

**Correctness Analysis:**

1. **`SortKey` and `SortDir` types:** DEAD
   - These types were designed for a custom sorting system ("name", "status", "transits", "lastEaten")
   - The actual code uses **TanStack Table's native `SortingState`** (imported in `FilterSheet.tsx:2` and `DatabaseTable.tsx:2`)
   - `TanStack Table` manages sorting with its own `SortDirection` type ("asc" | "desc")
   - References to `handleSortDirectionToggle` in FilterSheet are just function names, not uses of the `SortDir` type

2. **`FILTER_OPTIONS` constant:** DEAD
   - Exported but never imported or used
   - `FilterSheet.tsx` defines its own `STATUS_OPTIONS` constant (lines 23-33) with the actual filter values
   - Audit reports noted this was a legacy snapshot that should be removed

**Recommended action:**
- **DELETE `FILTER_OPTIONS`** — never used; FilterSheet defines its own `STATUS_OPTIONS`
- **DELETE `SortKey` type** — unused; TanStack Table drives sorting
- **KEEP `SortDir` type** (or DELETE if it's only in the barrel) — technically unused but a reasonable helper type. However, since it's not used anywhere and TanStack Table has its own, delete it too for cleanliness.

**Summary:** All three exports (FILTER_OPTIONS, SortKey, SortDir) are dead code artifacts from a previous UI pattern. Remove them.

---

### Summary Table

| Item | Status | Consumer Count | Action |
|------|--------|----------------|--------|
| **WQ-150**: `toLegacyFoodStatus` | ALIVE | 3 active (backend + frontend) | **KEEP** — intentional compatibility bridge |
| **WQ-151**: `columns` export | DEAD | 0 | **DELETE** from line 390 of `columns.tsx` |
| **WQ-153**: `FILTER_OPTIONS` | DEAD | 0 | **DELETE** from `foodSafetyUtils.ts` |
| **WQ-153**: `SortKey` type | DEAD | 0 | **DELETE** from `foodSafetyUtils.ts` |
| **WQ-153**: `SortDir` type | DEAD | 0 | **DELETE** from `foodSafetyUtils.ts` |