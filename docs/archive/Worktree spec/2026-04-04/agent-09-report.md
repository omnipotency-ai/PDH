# Agent 09 — Security & Simplification: WaterModal.tsx + LogFoodModal.tsx

## Summary

Both files are broadly well-written. No `any` casts, no `ts-ignore`, no XSS vectors, and no dangerous type assertions exist. The main issues are: a missing server-side upper bound on water amounts, a portionG overflow path in LogFoodModal, duplicated focus-trap implementations, and a ref/state double-tracking pattern in WaterModal that is unnecessary.

---

## Findings

### Important: No upper-bound validation on water amount before Convex mutation

- **File**: `src/components/track/nutrition/WaterModal.tsx:138` and `src/components/track/nutrition/NutritionCard.tsx:524-539`
- **Issue**: `WaterModal` clamps `amount` to `MAX_ML = 2000` via UI buttons, but `handleLogWater` in `NutritionCard` receives `amountMl: number` and passes it directly to `addSyncedLog` with no server-side or pre-mutation guard. If the `onLogWater` prop is ever called from any other callsite (or via a test/storybook stub), an arbitrary integer reaches Convex.
- **Impact**: Low exploitability today (single callsite, button-only UI), but violates "Convex is the Boss" and "data correctness first" principles. A future refactor or alternative entry point could bypass the UI clamp silently.
- **Suggestion**: Add a guard in `handleLogWater` in NutritionCard: `if (amountMl <= 0 || amountMl > 2000) return;` — one line, no cleverness needed. The Convex mutation validator is the real place to enforce this, but the caller should also be explicit.

---

### Important: portionG can grow unboundedly in LogFoodModal

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:127-129` and `useNutritionStore.ts:258-268`
- **Issue**: The increment button in `FoodItemRow` has no `disabled` condition and no upper bound on `portionG`. A user can keep clicking `+` indefinitely: `portionG` is only constrained by `canDecrement` (lower bound). The reducer's `ADJUST_STAGING_PORTION` removes items when `newPortionG <= 0` but applies no upper limit. Very large values (e.g. 999,999g of butter) produce absurd calorie numbers that would be logged to Convex.
- **Impact**: No overflow in JavaScript number space, but unrealistic data reaches the database and would corrupt transit/digestion correlation logic. Macro pills would display numbers like "7,199g Fat".
- **Suggestion**: Add a `MAX_PORTION_G` constant (e.g. 2000g) and disable the increment button when `item.portionG >= MAX_PORTION_G`. Mirror this guard in the reducer's `ADJUST_STAGING_PORTION` case.

---

### Minor: Duplicate focus-trap implementations

- **File**: `src/components/track/nutrition/WaterModal.tsx:95-127` and `src/components/track/nutrition/LogFoodModal.tsx:191-215`
- **Issue**: Both files implement an identical focus-trap pattern: `querySelectorAll` for focusable elements, manual `first`/`last` tracking, `Tab`/`Shift+Tab` cycling. The two implementations are nearly line-for-line identical (minor structural difference: WaterModal uses a separate `useEffect` for Escape vs. Tab; LogFoodModal merges them into one).
- **Impact**: Not a security issue. It is straightforward duplication — a future accessibility bug would need to be fixed in two places.
- **Suggestion**: Extract a `useFocusTrap(ref, enabled, onEscape)` hook to `src/lib/useFocusTrap.ts`. Both modals become a single `useFocusTrap(dialogRef, open, onClose)` call. This is the "leave it better" rule applied to boring utility code.

---

### Minor: WaterModal ref/state double-tracking (amountRef + amount state)

- **File**: `src/components/track/nutrition/WaterModal.tsx:54-66` and `139`
- **Issue**: `amount` is tracked in `useState` (for re-renders) and also mirrored into `amountRef` (line 66: `amountRef.current = amount`). `handleLogWater` reads `amountRef.current` instead of `amount`. The comment says "Sync ref" but the ref is only used in one callback. The original motivation was likely to avoid a stale closure, but `useCallback` with `[onLogWater]` already means the callback does not include `amount` — reading the ref sidesteps adding `amount` to the dependency array. This is a subtle pattern that surprises readers.
- **Impact**: No bug today. But it is "clever code" — a future editor might remove the ref or the dependency array workaround and introduce a stale closure silently.
- **Suggestion**: Remove `amountRef` entirely. Change `handleLogWater` to: `if (amount <= 0) return; onLogWater(amount);` and add `amount` to its dependency array. The re-render cost of including `amount` in deps is zero — this callback is recreated on every amount change anyway via the ref sync on line 66.

---

### Minor: `setAmountState` listed as a dep in reset effect

- **File**: `src/components/track/nutrition/WaterModal.tsx:59-63`
- **Issue**: `useEffect(() => { if (open) { setAmountState(STEP_ML); } }, [open, setAmountState])` — `setAmountState` is a stable React dispatch function and never changes between renders. Listing it as a dependency is harmless but misleading: it implies to readers that the effect should re-run if the setter changes identity, which never happens.
- **Impact**: No bug, just noise in the dependency array.
- **Suggestion**: Remove `setAmountState` from the dependency array. The lint rule will not complain because stable `useState` setters are known to be stable.

---

### Minor: XSS surface — food displayName rendered via `capitalize()`

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:101-102`
- **Issue**: `capitalize(item.displayName)` is rendered as a React text node via `{capitalize(item.displayName)}`, which is safe — React escapes text content by default. However, `displayName` ultimately comes from `canonicalName` which is a key into `FOOD_REGISTRY` (a static compile-time data structure). No user-supplied string reaches this render path today.
- **Impact**: No current XSS risk. Worth noting for future: if `displayName` ever becomes user-editable (voice logging pivot), React text interpolation is still safe, but any `dangerouslySetInnerHTML` usage added later would create a risk.
- **Suggestion**: No action needed now. When voice logging is implemented, ensure `displayName` is stored as a raw string and never rendered via `dangerouslySetInnerHTML`.

---

### Nice-to-have: LogFoodModal focus-restore only works if the backdrop is not clicked

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:183-225`
- **Issue**: `previousFocusRef.current` is set on modal open and restored in the `useEffect` cleanup. But if the user clicks the backdrop (`<div onClick={onClose} />`), `onClose` fires, the modal unmounts, and the cleanup function restores focus. This works correctly. However, if `onClose` is called during the `setTimeout` delay (line 187-189) before `dialogRef.current?.focus()` fires, `clearTimeout(timer)` in cleanup prevents the focus being moved to the dialog — so the restore goes back to the previously focused element correctly. This is actually fine, but the 0ms `setTimeout` is unnecessarily indirect; the dialog has `tabIndex={-1}` and could be focused synchronously.
- **Impact**: No user-visible bug. The 0ms `setTimeout` is a micro-optimisation cargo-culted from patterns where DOM rendering requires a tick; here it is not needed because the dialog is conditionally rendered (`if (!open) return null` runs _before_ this effect, meaning the dialog is already in the DOM when the effect fires).
- **Suggestion**: Replace `setTimeout(() => { dialogRef.current?.focus(); }, 0)` with direct `dialogRef.current?.focus()`. Remove the `clearTimeout(timer)` cleanup accordingly.

---

### Nice-to-have: SVG ring constants are clear but scattered across the file header

- **File**: `src/components/track/nutrition/WaterModal.tsx:24-27`
- **Issue**: `RING_SIZE`, `RING_STROKE`, `RING_RADIUS`, `RING_CIRCUMFERENCE` are four separate top-level constants. `RING_RADIUS` and `RING_CIRCUMFERENCE` are derived values, not configuration. Grouping them communicates intent.
- **Impact**: Cosmetic only. No bug or security risk.
- **Suggestion**: Consider a single `RING` object: `const RING = { SIZE: 160, STROKE: 10 }` with `RING.RADIUS` and `RING.CIRCUMFERENCE` derived inline or from the object. Alternatively, keep as-is — this is truly cosmetic.

---

## No Issues Found

- No `any` casts, no `as unknown as X`, no `@ts-ignore` or `@ts-expect-error`.
- No `dangerouslySetInnerHTML` usage anywhere in either file.
- All food names are rendered as React text nodes — safe from XSS.
- No negative values can be sent to Convex from WaterModal (UI clamp + `if (amountRef.current <= 0) return` guard).
- No type assertions that widen to unsafe types.
- No third-party callbacks used without type guards.
- Modal patterns (custom overlay, focus trap, Escape) are appropriate for this codebase — Base UI Dialog was intentionally not used, matching the existing component conventions.
