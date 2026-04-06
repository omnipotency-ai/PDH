# Agent 12 — Security & Simplification: useNutritionData.ts + useProfile.ts

## Summary

Both hooks are generally well-structured and follow the project's "boring code" principle. The main concerns are a cluster of unsafe type assertions in `useNutritionData.ts` that narrow `SyncedLog` without runtime proof, a stale-closure bug in `todayKey`, a discrepancy between the two meal-slot functions, and several minor over-engineering patterns in `useProfile.ts`. Nothing is critically broken, but the type assertions are the most likely source of a future runtime crash if the log shape evolves.

---

## Findings

### Important: Unsafe `as` casts narrow SyncedLog without runtime verification

- **File**: `src/hooks/useNutritionData.ts:109`, `src/hooks/useNutritionData.ts:163`
- **Issue**: After `isFoodPipelineType(log.type)` returns true, the log is cast with `log as FoodPipelineLog` (line 109) and `log as FoodPipelineLog` (line 163). Inside the loop at line 166, `foodLog.data.items` is then accessed directly with no null/undefined guard. `FoodPipelineLog` is a local intersection type `SyncedLog & { type: "food" | "liquid" }` — it does NOT guarantee that `data.items` is present or non-null. `SyncedLog` is a discriminated union, so `data` is `LogDataMap[K]` for the specific `K`. The cast effectively bypasses that discrimination.
- **Impact**: If a log with `type === "food"` somehow has a malformed or legacy `data` shape (e.g. missing `items`, which is possible during schema migrations or with legacy data), line 166 (`for (const item of foodLog.data.items)`) will throw at runtime with an uncatchable "Cannot read properties of undefined" error, crashing the nutrition UI entirely.
- **Suggestion**: Use a proper type guard or an optional-chaining access. Either narrow with a runtime check (`if (!Array.isArray(foodLog.data?.items)) continue;`) before iterating, or add a short type guard function that checks `data.items` exists. The cast on line 109 (building `todayFoodLogs`) is similarly unsafe but the downstream risk is lower since `calculateTotalCalories` likely handles empty arrays gracefully.

---

### Important: `todayKey` memo never invalidates — date boundary bug

- **File**: `src/hooks/useNutritionData.ts:94–97`
- **Issue**: `todayKey` is computed in a `useMemo` with an empty dependency array (`[]`). This means it is computed exactly once for the lifetime of the component mount. If the user leaves the app running across a calendar day boundary (e.g. logged in at 11pm and still open at 1am), `todayKey` will still hold yesterday's midnight timestamp. All the downstream memos that depend on `todayKey` (the split memo at line 100, `currentMealSlot` at line 145) will silently use stale date filtering until the component unmounts and remounts.
- **Impact**: Users who keep the app open overnight will see incorrect "today" totals — yesterday's data will continue to appear as today's, and the meal slot may be wrong. In a medical context (post-surgical food tracking), this is a trust issue.
- **Suggestion**: Either use a clock-based effect that updates a date state at midnight, or simply compute `getTodayMidnight()` inline inside each memo rather than caching it. If the goal is to avoid recomputing on every render, the date boundary only changes once per day so using a stable date state with a `setTimeout`/interval to advance it is the correct fix. At minimum, remove `todayKey` and call `getTodayMidnight()` directly inside the dependent memos — the perf cost is negligible (one `Date` construction per render).

---

### Important: `currentMealSlot` depends on `todayKey` but the dependency is spurious — it hides real staleness

- **File**: `src/hooks/useNutritionData.ts:145`
- **Issue**: `useMemo(() => getCurrentMealSlot(), [todayKey])` uses `todayKey` as a proxy to signal "the day has changed". But `todayKey` never changes (see finding above), so `currentMealSlot` also never updates. Even if `todayKey` were fixed, it changes at midnight — but `currentMealSlot` should update at every meal slot boundary (5am, 11am, 14am, etc), not just daily.
- **Impact**: If a user opens the app at breakfast time, `currentMealSlot` is locked to "breakfast" for the entire session. The "recent foods" slot fallback (`recentFoods` line 194–195) will serve breakfast suggestions even at dinner time.
- **Suggestion**: Remove the `useMemo` wrapper for `currentMealSlot` entirely — `getCurrentMealSlot()` is a pure, cheap function. Either call it inline, or if update-on-slot-change is needed, use a `useState` + interval that wakes at each slot boundary.

---

### Important: `getMealSlot` and `getCurrentMealSlot` define different slot boundaries

- **File**: `src/lib/nutritionUtils.ts:38–44` vs `src/lib/nutritionUtils.ts:64–71`
- **Issue**: The two functions have different, non-overlapping definitions of breakfast, lunch, and dinner:
  - `getMealSlot` (used to classify logged food timestamps): breakfast 5–9h, lunch 13–16h, dinner 20–23h, everything else = snack.
  - `getCurrentMealSlot` (used to determine the UI's current slot): breakfast 5–11h, lunch 11–14h, snack 14–17h, dinner 17–21h.
  - A log at 9:30am is classified as "snack" by `getMealSlot` but "breakfast" by `getCurrentMealSlot`. A log at 13:00 is "lunch" by `getMealSlot` but "lunch" by `getCurrentMealSlot` — lucky match.
- **Impact**: The "recent foods" feature in `useNutritionData` (lines 176–178) checks `logSlot === currentMealSlot` to populate slot-specific suggestions. Since the two functions disagree on boundaries, logged foods for a given slot will often fail to match the current slot, making the slot-specific list empty and silently falling back to `allRecentFoods`. The documentation for `getMealSlot` says "Breakfast: 5am to 9am" but `getCurrentMealSlot` says "Breakfast: 5am to 11am" — this gap is the direct source of the mismatch.
- **Suggestion**: Unify the slot boundary definitions into a single source of truth (a shared constant or a single function). `getCurrentMealSlot` and `getMealSlot` should use the same boundary table. Until unified, the slot-scoped `recentFoods` feature effectively never works as intended.

---

### Minor: `useNutritionGoals` spreads `profile.nutritionGoals` into its return value

- **File**: `src/hooks/useProfile.ts:224–229`
- **Issue**: The hook returns `{ ...profile.nutritionGoals, setNutritionGoals }`, spreading the object's fields flat. The `NutritionGoals` interface has two fields (`dailyCalorieGoal`, `dailyWaterGoalMl`). If `NutritionGoals` gains more fields later, the caller automatically gets them without any code change. This is convenient but means the return type of the hook is implicitly `NutritionGoals & { setNutritionGoals }` — the return type is not explicitly annotated, so callers relying on destructuring can silently access any added fields without knowing where they came from.
- **Impact**: Low risk currently, but the pattern makes the API surface invisible — the hook returns more than it declares. It also means `useNutritionData.ts` destructures `{ dailyCalorieGoal, dailyWaterGoalMl }` (line 90) relying on implicit spread.
- **Suggestion**: Either add an explicit return type annotation to the hook, or return the goals as a named nested property (`{ goals: profile.nutritionGoals, setNutritionGoals }`) to make the API surface explicit.

---

### Minor: `useMemo` wrapping return values in `useProfile.ts` hooks adds noise with minimal benefit

- **File**: `src/hooks/useProfile.ts:27–31`, `65–74`, `95–102`, `117–120`, `138–141`, `157–160`, `179–184`, `199–205`, `223–229`, `263–266`
- **Issue**: Every hook wraps its return object in `useMemo`. These memos depend on `profile.*` fields (themselves already stabilized in `ProfileContext` via JSON comparison) and `useCallback`-wrapped setters. The memos prevent a new object literal on every render — which is correct — but the stabilization is already happening upstream in `ProfileContext`'s JSON-hash comparison. The memos on the leaf hooks add a second layer of stabilization on top of already-stable inputs.
- **Impact**: Not harmful, but it's extra cognitive overhead. Every hook reader has to check all dependencies to be confident the memo is correct. When `profile.habits` (an array) is a dependency, the memo is stable as long as the array reference is stable — which it is because `ProfileContext` provides reference stability. So the memo provides no additional benefit in practice.
- **Suggestion**: Consider removing the `useMemo` wrappers in the simpler hooks (e.g. `useUnitSystem`, `useSleepGoal`, `useAiPreferences`). For hooks that return arrays of callbacks (e.g. `useHabits`, `useFoodFavourites`), the memo is more defensible. This is a nice-to-have cleanup, not a correctness issue.

---

### Minor: `useHealthProfile` uses `as HealthProfile` cast to merge partial updates

- **File**: `src/hooks/useProfile.ts:88–89`
- **Issue**: `setHealthProfile` merges `{ ...profile.healthProfile, ...updates }` and then asserts the result `as HealthProfile`. The spread produces `Partial<HealthProfile>` (because `profile.healthProfile` is typed as `HealthProfile` from the context, and `updates: Partial<HealthProfile>`) but the assertion forces it to `HealthProfile` without checking required fields are present.
- **Impact**: If `profile.healthProfile` ever has optional fields that are undefined and `updates` does not supply them, the `as HealthProfile` cast silently sends an incomplete object to `patchProfile`. The `ProfileContext` already applies defaults via `resolveProfile`, so in practice this rarely fires — but the cast is a soundness gap.
- **Suggestion**: If `HealthProfile` has required fields, document them clearly and check at runtime. If all fields are optional, reflect that in the type definition so the cast is unnecessary. Removing the cast and letting TypeScript infer the type directly would surface any genuine mismatch.

---

### Minor: `patchProfile` does not propagate `nutritionGoals` or `foodFavourites` updates

- **File**: `src/contexts/ProfileContext.tsx:151–183`
- **Issue**: The `patchProfile` function in `ProfileContext` builds its mutation args by explicitly spreading only known fields. `nutritionGoals` and `foodFavourites` are absent from the explicit spread list (lines 158–179), even though `PatchProfileArgs` includes them (visible from the interface at lines 65–72 in ProfileContext.tsx). This means `useNutritionGoals`'s `setNutritionGoals` and `useFoodFavourites`'s mutation callbacks pass updates through `patchProfile` that are silently dropped.
- **Impact**: Any call to `setNutritionGoals(...)` or `addFavourite(...)` / `removeFavourite(...)` will not persist the update to Convex. This is a functional bug — nutrition goals and favourites cannot be changed from the UI. (This finding is in `ProfileContext.tsx`, not in the two targeted files, but it is the direct upstream cause of `useNutritionGoals` and `useFoodFavourites` appearing to work while silently doing nothing.)
- **Suggestion**: Add the missing fields to the explicit spread in `patchProfile`: `nutritionGoals` and `foodFavourites`.

---

### Nice-to-have: `todayKey` as `String(midnight)` adds needless string conversion

- **File**: `src/hooks/useNutritionData.ts:94–101`
- **Issue**: `todayKey` converts the midnight timestamp to a string (`String(midnight)`), then the consuming memo immediately converts it back with `Number(todayKey)`. The round-trip `number → string → number` serves no purpose.
- **Impact**: None in practice, but it's misleading — it looks like the string form might be used as a cache key or serialized somewhere, when it is not.
- **Suggestion**: If `todayKey` is retained, store it as a `number` directly. If the stale-closure bug (first finding) is fixed by removing `todayKey` entirely, this issue disappears with it.

---

### Nice-to-have: Early-exit condition in recent foods loop can over-exit

- **File**: `src/hooks/useNutritionData.ts:183–184`
- **Issue**: The loop breaks when `allResult.length >= 50 && slotResult.length >= 50`. However `slotResult` is only populated for logs that match `currentMealSlot` — if there are fewer than 50 slot-specific entries in 7 days, `slotResult.length` never reaches 50 and the early-exit never fires, so the loop always runs through all 7 days of logs to fill `allResult`. This is correct behavior but the early-exit comment ("Early exit once both lists are full") misleads maintainers into thinking both lists will often hit 50.
- **Impact**: No correctness issue, but a minor documentation mismatch. The loop also iterates `i` from 0 but uses `const log = logs[i]` inside — this is equivalent to `for...of` but more verbose.
- **Suggestion**: Replace the indexed `for` loop with `for...of` for clarity (same as the earlier loop). Clarify the comment: "Early exit only if both lists are full — slot list may never reach 50."
