# Fix Status: today-log Directory

**Scope:** `src/components/track/today-log/` (all subdirectories)
**Date:** 2026-03-28
**Typecheck:** PASS (no errors in scoped directory; pre-existing errors outside scope unchanged)

## HIGH Fixes

| File | Fix | Status |
|------|-----|--------|
| `rows/LogEntry.tsx` | Bristol consistencyTag mapping corrected (was only hard/normal, now covers all 7 codes) | DONE |
| `rows/LogEntry.tsx` | Removed JSON.stringify short-circuit that skipped saves when serialized data matched | DONE |
| `rows/LogEntry.tsx` | Added error toast on save failure (was empty catch block) | DONE |
| `rows/LogEntry.tsx` | Fixed reproductive periodStartDate — allow clearing by removing fallback to original value | DONE |
| `editors/EditableEntryRow.tsx` | Wrapped delete onClick in try/catch with error toast | DONE |
| `editors/FoodSubRow.tsx` | Fixed resolvedBy stamp — only sets `'user'` when name actually changed | DONE |
| `groups/HabitGroupRows.tsx` | Replaced fire-and-forget delete loop with `Promise.allSettled` + partial failure reporting | DONE |
| `grouping.ts` | Added fallthrough for non-cycle reproductive entries (were silently dropped) | DONE |
| `TodayLogContext.tsx` | Removed dead code: `TodayLogDataContext`, `TodayLogDataProvider`, `useTodayLogData` | DONE |

## MODERATE Fixes

| File | Fix | Status |
|------|-----|--------|
| `rows/LogEntry.tsx` | Fixed draft key from name-based (`draft-${draft.name || i}`) to index-based (`draft-${i}`) | DONE |
| `rows/LogEntry.tsx` | Fixed fluid name maxLength from 10 to 40 | DONE |
| `editors/FoodSubRow.tsx` | Fixed draft key from name-based to index-based | DONE |
| `editors/FluidSubRow.tsx` | Fixed name maxLength from 10 to 40 | DONE |
| `editors/WeightSubRow.tsx` | Added validation: `draftIsValid` guard, `aria-invalid`, red border, error text | DONE |
| `editors/ActivitySubRow.tsx` | Added `useEffect` to re-seed draft when entry data changes externally | DONE |
| `editors/ReproductiveSubRow.tsx` | Fixed periodStartDate — allow clearing by removing fallback to original | DONE |
| `editors/HabitSubRow.tsx` | Changed empty renderEditFields to show read-only habit name label | DONE |
| `helpers.ts` | Consolidated `formatItemDisplay` to delegate to `getFoodItemDisplayName` | DONE |
| `groups/WeightGroupRow.tsx` | Replaced Tooltip wrapping time with plain `<p>` element | DONE |
| `groups/HabitGroupRows.tsx` | Restructured DOM: uncheck button separated from toggle into sibling wrapper | DONE |
| `TodayLog.tsx` | Collapsed identical activity/sleep switch cases into shared fallthrough | DONE |
| `grouping.ts` | Fixed TS `never` type error on unknown-type fallback with explicit cast | DONE |

## Summary

All HIGH and MODERATE audit findings in the today-log directory have been addressed. The one TS error introduced by the grouping fallback (log narrowed to `never`) was resolved with an explicit `SyncedLog` cast since the fallback is a defensive guard for future log types.
