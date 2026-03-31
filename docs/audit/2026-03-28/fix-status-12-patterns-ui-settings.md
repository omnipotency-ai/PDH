# Fix Status 12: Patterns, UI, and Settings

**Date:** 2026-03-28
**Scope:** Audit findings from `21-full-codebase-review.md` — patterns/hero, patterns/database, patterns/transit-map, settings, and UI components.
**Typecheck:** PASS (no new errors in edited files; pre-existing errors in convex tests and other files unrelated to this batch)

---

## HIGH Priority Fixes

### 1. BristolTrendTile: `getScoreColor` range wrong
**File:** `src/components/patterns/hero/BristolTrendTile.tsx`
**Fix:** Bristol 3-5 now returns `text-emerald-400` (good). Borderline (2.5-3 and 5-5.5) returns `text-orange-300`. Outside returns `text-rose-400`.

### 2. BristolTrendTile: `getDeltaDisplay` direction logic
**File:** `src/components/patterns/hero/BristolTrendTile.tsx`
**Fix:** Delta now computed relative to NORMAL_MIDPOINT (4.0). Movement toward 4.0 is improving (green), away is concerning (rose). Function takes `currentAverage` as second parameter.

### 3. SmartViews: compound status filter broken
**File:** `src/components/patterns/database/SmartViews.tsx`
**Fix:** `rowMatchesStatusFilter` now handles `safe-loose` and `safe-hard` compound values by checking both `primaryStatus` and `tendency` fields.

### 4. StationMarker: pulse `transformOrigin` incorrect
**File:** `src/components/patterns/transit-map/StationMarker.tsx`
**Fix:** Removed `transformOrigin` style from pulse circles (already centered at 0,0 in group coordinates).

### 5. TransitMap: 147 duplicate clipPath elements
**File:** `src/components/patterns/transit-map/TransitMap.tsx`
**Fix:** Replaced per-station clipPaths with a single shared `<clipPath id="${svgIdPrefix}-station-clip">` in `<defs>`.

---

## MODERATE Priority Fixes

### 6. BristolTrendTile: duplicate `getDateKey`
**File:** `src/components/patterns/hero/BristolTrendTile.tsx`
**Fix:** Removed local `getDateKey`, imported from `./utils`.

### 7. BmFrequencyTile: duplicate `getDateKey` + timestamp cutoff
**File:** `src/components/patterns/hero/BmFrequencyTile.tsx`
**Fix:** Imported `getDateKey` from `./utils`. Fixed cutoff to use calendar midnight boundary instead of raw ms offset.

### 8. Sparkline: gradient ID collision
**File:** `src/components/patterns/hero/Sparkline.tsx`
**Fix:** Replaced string-concatenated gradient ID with `useId()` for uniqueness.

### 9. columns.tsx: Bristol 6 tier + dead export + timer TODO
**File:** `src/components/patterns/database/columns.tsx`
**Fix:** Changed Bristol 6 from borderline to warning tier (`avg < 6` instead of `avg <= 6`). Removed dead `export const columns = buildColumns()`. Added TODO on `formatRelativeTime`.

### 10. database/index.ts: dead re-exports
**File:** `src/components/patterns/database/index.ts`
**Fix:** Removed `columns` and `FoodRow` re-exports.

### 11. FoodRow.tsx: dead component
**File:** `src/components/patterns/database/FoodRow.tsx`
**Fix:** Deleted entirely (no callers outside barrel).

### 12. FilterSheet: misleading button text
**File:** `src/components/patterns/database/FilterSheet.tsx`
**Fix:** Renamed "Clear all" to "Clear filters".

### 13. BristolBreakdown: unvalidated Bristol codes
**File:** `src/components/patterns/database/BristolBreakdown.tsx`
**Fix:** Added `.filter((e) => e.count > 0 && e.code >= 1 && e.code <= 7)`.

### 14. DatabaseTable: keyboard-unreachable rows
**File:** `src/components/patterns/database/DatabaseTable.tsx`
**Fix:** Added `tabIndex={0}`, `role="button"`, and `onKeyDown` (Enter/Space) on table rows.

### 15. useTransitScene: O(N^2) distribute()
**File:** `src/components/patterns/transit-map/useTransitScene.ts`
**Fix:** Precomputed arrays before `.map()` for Zone Two tracks, eliminating O(N^2) recomputation.

### 16. ZoneCard: `index` prop too wide
**File:** `src/components/patterns/transit-map/ZoneCard.tsx`
**Fix:** Narrowed `index` prop type from `number` to `0 | 1 | 2`.

### 17. TransitMapCanvas: keyboard-unreachable hitboxes
**File:** `src/components/patterns/transit-map/TransitMapCanvas.tsx`
**Fix:** Added `tabIndex={0}` and `onKeyDown` for Enter/Space on line hitbox paths and station hitbox circles.

### 18. TransitMap: @keyframes not hoisted
**File:** `src/components/patterns/transit-map/TransitMap.tsx`
**Fix:** Hoisted `@keyframes transit-pulse` to module-level constant `TRANSIT_PULSE_KEYFRAMES`.

### 19. StationMarker: onFocus commits selection
**File:** `src/components/patterns/transit-map/StationMarker.tsx`
**Fix:** Removed `onFocus={onSelect}` (focus should preview, not commit).

### 20. TimeInput: suppressed focus rings
**File:** `src/components/ui/TimeInput.tsx`
**Fix:** Replaced `outline-none border-none focus:ring-0 focus:outline-none` with `border-none outline-none` on inputs. Added `focus-within:ring-2 focus-within:ring-[var(--section-food)]/40` on parent wrapper.

### 21. TrackingForm: single-tap habit deletion
**File:** `src/components/settings/TrackingForm.tsx`
**Fix:** Added two-tap confirmation. First tap shows "Del?" text, second tap confirms deletion. Confirmation resets on blur.

### 22. DrPooSection: missing label text
**File:** `src/components/settings/tracking-form/DrPooSection.tsx`
**Fix:** Replaced empty Label (containing only an icon) with `sr-only` Label containing "Preferred name" text. Icon moved outside label.

### 23. PregnancySection: postpartum notes field reuse
**File:** `src/components/settings/repro/PregnancySection.tsx`
**Fix:** Added TODO comment documenting that postpartum uses `pregnancyMedicationNotes` field and noting need for a dedicated `postpartumMedicationNotes` field.

### 24. StationInspector: duplicated formatTransitHours
**File:** `src/components/patterns/transit-map/StationInspector.tsx`
**Fix:** Replaced inline `Math.round(minutes / 6) / 10` with import of `formatTransitHours` from `@/lib/trialFormatters`.

### 25. TrackSegment/StationMarker: inline arrows prevent memoization
**File:** `src/components/patterns/transit-map/StationMarker.tsx`
**Fix:** Wrapped `StationMarker` in `React.memo()`. Stations not being hovered/selected will skip re-renders.

---

## Summary

- **25 findings fixed** (5 HIGH, 20 MODERATE)
- **1 file deleted** (FoodRow.tsx)
- **0 new typecheck errors** introduced
- Pre-existing errors in convex test files and other files remain unchanged
