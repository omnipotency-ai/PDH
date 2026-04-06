# Agent 06 — Performance & Maintainability: useNutritionStore.ts + useNutritionData.ts

## Summary

Both files are well-structured and follow good patterns overall. The `useNutritionStore.ts` correctly separates pure reducer logic from the hook, exports helpers for testability, and initialises the Fuse.js index as a module-level singleton — the right choice. `useNutritionData.ts` is a clean read-only projection layer that chains `useMemo` appropriately. The main risks are: an unbounded `listAll` query fetching up to 5 000 documents that all downstream memos re-process; a missing search debounce that fires Fuse on every keystroke; the `todayKey` memo is effectively a no-op (it never re-runs, so it never reacts to the day rolling over); and a dependency array bug in `currentMealSlot` that silently ignores real-time. None of these are blockers today, but the `listAll` pattern is a known tracked debt item (WQ-087) that will become more expensive as the user's log history grows.

---

## Findings

### Important: `listAll` fetches up to 5 000 documents for every subscription re-run

- **File**: `src/lib/syncLogs.ts:24-27` (Convex query `convex/logs.ts:754`)
- **Issue**: `useAllSyncedLogs` calls `api.logs.listAll`, which issues a single `take(5000)` query with no date filter. Every write to the `logs` table causes Convex to re-run the query and push a new snapshot to the client. All memos in `useNutritionData` (today filter, macro totals, water intake, meal-slot grouping, recent-foods scan) execute on the new array reference every time any log anywhere in the user's history is mutated.
- **Impact**: For a user who has used the app for months, the subscription payload can be large. Writes trigger full re-delivery and full re-derivation even when the mutated log is months old and outside today's date range. The Convex team comment ("Safety cap … Proper pagination tracked as WQ-087") confirms this is recognised debt.
- **Suggestion**: Introduce a bounded `useLogsByRange` variant that only subscribes to the last N days (e.g. 8 days covers the 7-day recents window plus today). Use it as the source for `useNutritionData`. The full `listAll` can remain for export/backup screens. This is already partially available as `useSyncedLogsByRange` in `syncLogs.ts`.

---

### Important: No debounce on search input — Fuse runs on every keystroke

- **File**: `src/components/track/nutrition/useNutritionStore.ts:350-353`
- **Issue**: `searchResults` is a `useMemo` keyed on `state.searchQuery`. `state.searchQuery` is updated with `SET_SEARCH_QUERY` which fires on every character typed. Fuse.js searches 148 registry entries synchronously on each render triggered by any character change. There is no debounce at the store or hook layer; if the consuming component calls `dispatch({ type: "SET_SEARCH_QUERY", query: e.target.value })` directly on `onChange`, it fires on every keystroke.
- **Impact**: 148 entries is currently small enough that the latency is imperceptible, but the pattern does not scale if the registry grows. More importantly, each `SET_SEARCH_QUERY` dispatch also triggers a full React re-render of whatever component subscribes to the store return value, including `stagingTotals` and the full `state` object, even though those are unrelated to the search.
- **Suggestion**: (1) Debounce the search query at the call site (e.g. 150–200 ms using `useDeferredValue` or a simple `setTimeout`/`useRef` approach in the parent component). (2) Consider splitting the hook's return into a stable `dispatch` + `state` pair and a separate `useSearchResults(query)` selector so unrelated components do not re-render when the query changes.

---

### Important: `todayKey` memo never recomputes — day rollover is not handled

- **File**: `src/hooks/useNutritionData.ts:94-98`
- **Issue**: `todayKey` is computed with `useMemo(() => ..., [])` — an empty dependency array. It captures `getTodayMidnight()` once at mount and never updates. If the app remains open across midnight (plausible for a health-tracking app on a bedside device), `todayKey` stays as yesterday's midnight. All downstream memos that use `todayKey` as a cache key — the food/fluid split, calorie totals, water intake, meal-slot grouping — will silently show yesterday's data labelled as "today".
- **Impact**: Silent data incorrectness across a day boundary. This is particularly harmful for a post-surgical food tracker where the user might log a late-night snack and expect to see it in today's totals.
- **Suggestion**: Drive `todayKey` from a clock signal rather than a one-time computation. A simple approach: store the day string in a `useState` and update it with a `setInterval` or a `visibilitychange` listener that checks whether the date has changed. Alternatively, derive it directly from the `logs` array timestamp range so it at least refreshes whenever Convex pushes a new snapshot.

---

### Important: `currentMealSlot` dependency array is incorrect

- **File**: `src/hooks/useNutritionData.ts:145`
- **Issue**: `const currentMealSlot = useMemo(() => getCurrentMealSlot(), [todayKey])`. `getCurrentMealSlot()` reads `new Date()` internally (it does not accept a fixed clock). Its result depends on the current time, not on `todayKey`. Because `todayKey` never changes (see above finding), this memo also never recomputes during a session. A user who opens the app at 9 am will always see `currentMealSlot = "breakfast"` even if they come back at 1 pm, causing the recents list to show breakfast items instead of lunch items.
- **Impact**: Wrong slot-scoped recents shown to the user throughout the day after the slot boundary crosses. Subtle but directly degrades the main UX promise of meal-slot-aware food suggestions.
- **Suggestion**: Either (a) remove the memo entirely and call `getCurrentMealSlot()` inline (it is cheap), accepting that it recalculates on each render driven by the Convex subscription, or (b) introduce a clock-tick signal (every minute) as a dependency so the slot updates at the boundary.

---

### Minor: `caloriesByMealSlot` iterates `logsByMealSlot` via four separate `calculateTotalCalories` calls

- **File**: `src/hooks/useNutritionData.ts:131-143`
- **Issue**: The memo groups logs by slot (one pass) and then immediately calls `calculateTotalCalories` four times — one per slot. Each `calculateTotalCalories` call is itself a loop over the slot's logs. This is O(n) overall but involves four separate function call stacks and four separate array traversals over the already-grouped sublists.
- **Impact**: Negligible for current data sizes (today's logs are unlikely to exceed a few dozen). More of a readability concern: the code could be folded into `groupByMealSlot` or done in a single accumulation pass.
- **Suggestion**: Either compute calorie totals inside the same loop that groups by slot, or keep it as-is and document that it is intentionally simple. Not worth changing until profiling shows it is a hot path.

---

### Minor: `ADJUST_STAGING_PORTION` uses `.map().filter()` chain instead of a single pass

- **File**: `src/components/track/nutrition/useNutritionStore.ts:258-268`
- **Issue**: The reducer maps over `stagingItems` (converting items to `null` if the adjusted portion would be <= 0) then filters nulls. This is idiomatic TypeScript but creates an intermediate array.
- **Impact**: Negligible — staging lists will never exceed single digits. This is a readability note, not a performance concern.
- **Suggestion**: A `reduce` that accumulates directly, or a `flatMap`, would be a single pass. However, the current code is more readable. Leave it unless the team prefers a consistent iteration style.

---

### Minor: `recentFoods` fallback assignment is outside all memos — creates a new reference on every render

- **File**: `src/hooks/useNutritionData.ts:194-195`
- **Issue**: `const recentFoods = slotRecentFoods.length > 0 ? slotRecentFoods : allRecentFoods` is a plain assignment, not inside a `useMemo`. Both `slotRecentFoods` and `allRecentFoods` are stable references from their memo (they are only recomputed when `logs` or `currentMealSlot` changes). The ternary correctly returns the same array reference in the common case. However, if `slotRecentFoods.length` is zero and `allRecentFoods` is selected, a parent component that receives `recentFoods` as a prop would see the same object reference on re-renders driven by unrelated state — which is correct. This is fine but easy to misread as if a new reference is being produced.
- **Impact**: No functional issue. The comment is here for reviewers: this is safe because the memo above produces stable references.
- **Suggestion**: Add an inline comment confirming the reference-stability intent, or wrap in `useMemo(() => slotRecentFoods.length > 0 ? slotRecentFoods : allRecentFoods, [slotRecentFoods, allRecentFoods])` for explicitness.

---

### Nice-to-have: Store hook returns `state` as a whole object — consumers must destructure everything

- **File**: `src/components/track/nutrition/useNutritionStore.ts:360-367`
- **Issue**: `useNutritionStore()` returns `{ state, dispatch, searchResults, stagingTotals, stagingCount }`. Consumers that only need `state.view` (e.g. header collapse logic) still receive the entire state and will re-render whenever any field of `state` changes, including `searchQuery` updates on each keystroke.
- **Impact**: Minor extra renders for components that subscribe to the hook but only use a subset of its output. In React 18 with the concurrent scheduler this is often batched away, but it can cause perceptible flicker on lower-end devices.
- **Suggestion**: Either (a) export a selector pattern (e.g. `useNutritionStoreSelector(selector)`) mirroring Zustand's API, or (b) split the hook into `useNutritionView()`, `useNutritionSearch()`, `useNutritionStaging()` to allow components to subscribe to only what they need. This is an architectural decision and only matters once profiling reveals excessive re-renders.

---

### Nice-to-have: `createInitialState` calls `getMealSlot(Date.now())` — stale at mount if called during SSR or test

- **File**: `src/components/track/nutrition/useNutritionStore.ts:329-339`
- **Issue**: The lazy initialiser for `useReducer` calls `getMealSlot(Date.now())` once. In tests this produces a time-sensitive default that varies depending on when the test runs, making test behaviour non-deterministic unless the test mocks `Date.now`.
- **Impact**: Low — tests that do not care about the initial slot are unaffected. Tests that assert initial slot behaviour will be flaky without clock mocking.
- **Suggestion**: Accept an optional `initialSlot` parameter in `createInitialState` (defaulting to `getMealSlot(Date.now())`) so tests can inject a fixed slot without mocking the global clock.

---

### Nice-to-have: Module-level Fuse index constructed at import time — may slow initial bundle parse on low-end devices

- **File**: `src/components/track/nutrition/useNutritionStore.ts:307-314`
- **Issue**: `const fuseIndex = new Fuse(FOOD_REGISTRY, ...)` executes at module parse time. For 148 entries this is fast (sub-millisecond). If `FOOD_REGISTRY` grows to thousands of entries, or if the module is imported eagerly on app load rather than lazily on first render of the Nutrition card, the index construction blocks the main thread during hydration.
- **Impact**: Currently negligible. It becomes a concern if the registry grows significantly or if `useNutritionStore.ts` is imported unconditionally at the top of a large component tree.
- **Suggestion**: The module-level placement is correct for the current size — it avoids re-constructing the index on every mount. Add a comment documenting the intentional module-level initialisation so future maintainers do not accidentally move it inside the hook.

---

## Architecture Observations

1. **Separation of concerns is good.** `useNutritionStore` is purely ephemeral UI state. `useNutritionData` is purely a read-only Convex projection. The boundary is clean and consistent with the project's stated architecture.

2. **Reducer testability is good.** `nutritionReducer`, `createStagedItem`, `recalculateMacros`, `computeStagingTotals`, and `searchFoodRegistry` are all exported pure functions. Unit tests can exercise the full state machine without mounting React.

3. **The core risk is the `listAll` subscription.** All other findings are low-severity. The unbounded query is the most impactful issue and is already tracked as WQ-087. Swapping `useAllSyncedLogs` for a range-scoped variant in `useNutritionData` would eliminate the largest performance exposure without requiring any architectural change to the store or hook API.

4. **Day-rollover handling is the most likely source of a user-visible silent bug.** The empty-dependency-array on `todayKey` combined with the incorrect dependency on `currentMealSlot` means the entire nutrition summary stops updating at slot and day boundaries. This should be fixed before the app is used by additional users.
