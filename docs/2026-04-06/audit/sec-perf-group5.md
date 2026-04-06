# Security & Performance Audit — Group 5

**Auditor:** Claude Sonnet 4.6  
**Date:** 2026-04-06  
**Scope:** UI components, contexts, hooks, and lib test files as listed in the audit brief.

---

## Findings

---

### [MODERATE] Raw API Error Messages Exposed to User-Facing State

**Category:** Security  
**Files:** `src/hooks/useAiInsights.ts:354-357`  
**Description:** When an AI analysis call fails, `getErrorMessage(err)` extracts `err.message` and passes it directly to `setAiAnalysisStatus("error", message)`. This error string is then surfaced as UI state and shown to the user. OpenAI API errors routinely include request IDs, model names, rate-limit quotas, account tier information, and occasionally fragments of the request payload in their `message` field. Leaking these to the user is a defence-in-depth concern: it discloses internal infrastructure detail and can reveal quota ceilings or model configurations.  
**Suggested Fix:** Sanitize the error before surfacing it. Map known OpenAI error classes to user-friendly strings (e.g. rate limit → "Too many requests — please try again later.", auth → "API key problem — check Settings") and fall back to a generic "Analysis failed" for unrecognised errors. The `sanitizeApiKeyError` function in `useApiKey.ts` shows the right instinct; apply the same pattern here.

---

### [MODERATE] Client-Supplied `timestamp: Date.now()` in Convex Mutations

**Category:** Security  
**Files:** `src/contexts/ProfileContext.tsx:157`, `src/hooks/usePendingReplies.ts:19`, `src/hooks/useAiInsights.ts:318`, `src/hooks/useAiInsights.ts:361`  
**Description:** Multiple mutations pass `timestamp: Date.now()` or `now: Date.now()` as client-supplied arguments. In Convex, mutation arguments arrive from the client and are treated as user-provided data — they are not authoritative. A user who can craft mutation calls (e.g. through browser DevTools or a modified client) can supply any timestamp value: past, future, or epoch 0. In `patchProfile`, the `now` field is presumably used to record when the profile was last updated; if it is stored and later used in ordering, deduplication, or cooldown logic, a spoofed timestamp can corrupt those invariants. In `addUserMessage` and `addAiAnalysis`, supplying a far-future timestamp could place entries out of order in time-sorted queries.  
**Suggested Fix:** Generate authoritative timestamps on the Convex server side using `Date.now()` inside the mutation handler itself (Convex allows `Date.now()` inside `mutation` since it is always deterministic within a mutation's execution context). Remove `now` and `timestamp` from the mutation argument schema and compute them internally. If the client genuinely needs to pass a user-intended time (e.g. backdating a log entry), validate and clamp the value server-side to a reasonable window (e.g. ±7 days from `Date.now()`).

---

### [MODERATE] Hardcoded `en-GB` Locale in AI Prompt Construction

**Category:** Security / Quality  
**Files:** `src/hooks/useWeeklySummaryAutoTrigger.ts:147`, `src/hooks/useWeeklySummaryAutoTrigger.ts:163`  
**Description:** Timestamps sent to the AI in the weekly summary payload are formatted with `toLocaleString("en-GB", ...)`. The CLAUDE.md states "no hard-coding personalisation — this is a future public product." Hardcoding `en-GB` means users in other locales will see inconsistently formatted dates in AI-generated summaries (since the AI may reason about day/month order). This is a personalisation violation and could produce confusing AI output for non-UK users when the product goes public.  
**Suggested Fix:** Use `Intl.DateTimeFormat` with the user's locale from their profile (or `navigator.language` as a fallback) rather than the literal `"en-GB"` string. Alternatively, format as ISO 8601 (`toISOString().slice(0, 16)`) which is unambiguous for the AI regardless of locale.

---

### [MODERATE] `usePanelTime` Allows Arbitrary Future Timestamps Without Validation

**Category:** Security  
**Files:** `src/hooks/usePanelTime.ts:17-35`  
**Description:** The `getTimestampMs()` function accepts a user-entered date string (from `<input type="date">`) and converts it to a timestamp without clamping or range validation. A user can backdate a log to January 1970 or forward-date it to December 9999. While Convex mutation handlers are the correct enforcement point, there is currently no client-side guard. Far-future timestamps break time-sorted queries (logs appear at the top of "recent" lists permanently), and epoch-0 timestamps confuse transit-time calculations. The `useHabitLog` and `useFoodParsing` hooks consume this timestamp directly and write it to Convex.  
**Suggested Fix:** Add client-side validation in `getTimestampMs()` that clamps the result to a sensible range — for example, no earlier than the user's registration date (or 5 years ago) and no later than tomorrow. Also add server-side validation in the relevant Convex mutations to reject out-of-bounds timestamps.

---

### [MODERATE] `useWeeklySummaryAutoTrigger` Computes Period Bounds Once at Mount (Stale Across Day Boundary)

**Category:** Performance  
**Files:** `src/hooks/useWeeklySummaryAutoTrigger.ts:110-114`  
**Description:** `getCompletedPeriodBounds()` is called inside `useMemo(() => ..., [])` — an empty dependency array — which means `startMs`, `endMs`, and `periodLabel` are computed once when the component mounts and never updated. If the app is left open across a half-week boundary (Sunday or Wednesday at 21:00), the hook will continue querying the stale period and never trigger generation for the newly completed period until the page is refreshed. For a health-tracking app, this means the summary for a completed period can be missed for the entire session.  
**Suggested Fix:** Track the boundary using a state variable that updates when the clock crosses it. The simplest fix is to use the same `todayDayKey()`-style approach employed in `SyncedLogsContext` — compute a `boundaryKey` (e.g. the ISO string of `getLastHalfWeekBoundary()`) and store it in state, then have a `setTimeout` or `visibilitychange` listener recompute it when a new boundary passes, similar to the pattern in `useTodayKey()` inside `useNutritionData.ts`.

---

### [MODERATE] `SyncedLogsContext` Date Bounds Are Not Stable Across Re-Renders

**Category:** Performance  
**Files:** `src/contexts/SyncedLogsContext.tsx:16`, `src/contexts/SyncedLogsContext.tsx:22-30`  
**Description:** `todayDayKey()` is called unconditionally on every render of `SyncedLogsProvider` (line 16). The result is passed to `useMemo(() => ..., [dayKey])`, but `dayKey` is a fresh string on every render — since `todayDayKey()` calls `new Date()` every time, the string value will always equal the current day, so the memo correctly only updates when the day changes. However, `startOfToday`, `fourteenDaysAgo`, `endOfToday`, `fourteenDaysAgoMs`, and `endOfTodayMs` (lines 22-30) are computed as plain `const` values outside of any memoization — they are derived from the `now` memo, so their numeric values are stable across re-renders within the same day. The issue is that these intermediate `Date` objects are allocated on every render even though their numeric values don't change. Each parent re-render of the provider will allocate 3 intermediate `Date` objects and compute 2 arithmetic operations, and then pass numerically identical values to `useSyncedLogsByRange`. Convex's `useQuery` does perform argument equality checks, so the Convex subscription itself will not re-fire — but the intermediate allocations are wasteful and could be eliminated by memoizing the numeric bounds.  
**Suggested Fix:** Wrap the four numeric bound computations inside the `now`-derived `useMemo` block, or derive all four from a single additional `useMemo([now])` call. This is a minor optimization but it removes 3 unnecessary `Date` allocations per render of a high-frequency provider.

---

### [MODERATE] `useNutritionData` — `currentMealSlot` Computed with `Date.now()` Outside Memo

**Category:** Performance  
**Files:** `src/hooks/useNutritionData.ts:244-246`, `src/hooks/useNutritionData.ts:291`  
**Description:** `currentMealSlot` is computed by calling `getMealSlot(Date.now())` directly in the function body (outside any `useMemo` or `useCallback`). This value is then used as a dependency of the `slotRecentFoods`/`allRecentFoods` memo at line 291: `[logs, currentMealSlot, activeDayEnd, activeDayStart]`. Because `currentMealSlot` is computed fresh on every render, and because `getMealSlot` bins time into one of four meal slots (breakfast/lunch/dinner/snack), the memo's dependency is effectively unstable: any parent re-render will recompute `currentMealSlot`, and if it happens to be called at a slot boundary, the memo referentially changes even though the slot value is identical. In the common case where all renders happen within the same slot, `getMealSlot` returns the same string and the memo is stable, but this is coincidental. Additionally, `getMealSlot` calls `Date.now()` inside the render path, which means the slot can theoretically differ between two synchronous reads in the same render.  
**Suggested Fix:** Derive `currentMealSlot` from the `todayKey`-based clock mechanism already in the hook. Since `todayKey` updates only at midnight, add a `currentSlotKey` state that updates at meal slot boundaries (approximately 06:00, 11:00, 14:00, 20:00). This prevents unnecessary memo invalidation and removes `Date.now()` from the render path.

---

### [MODERATE] `CalendarDayButton` Calls `getDefaultClassNames()` on Every Render

**Category:** Performance  
**Files:** `src/components/ui/calendar.tsx:145`  
**Description:** `CalendarDayButton` calls `getDefaultClassNames()` unconditionally at the top of the function body. This function is called once per calendar day cell on every render of the calendar. A month view renders 28-42 day cells; each cell renders a `CalendarDayButton`. If `getDefaultClassNames()` performs any non-trivial computation or object allocation (which it does — it returns an object literal), this is O(days-in-month) work per calendar render. The same pattern appears in the `Calendar` component itself (line 19), but that is a single call per render — the per-cell call in `CalendarDayButton` is more impactful.  
**Suggested Fix:** Hoist `getDefaultClassNames()` to module scope as a constant (since the return value is static and does not depend on props or state), or at minimum memoize it once outside the component using a module-level variable. This reduces the allocation from ~35 per render to 1 per module load.

```ts
// At module scope, outside both components:
const DEFAULT_CLASS_NAMES = getDefaultClassNames();
```

---

### [MODERATE] `ProfileContext` — `JSON.stringify` on Every Render for Reference Stability

**Category:** Performance  
**Files:** `src/contexts/ProfileContext.tsx:138-149`  
**Description:** The code includes a `TODO` comment acknowledging this: `JSON.stringify(nextProfile)` is called on every render to detect changes in the profile object. The comment notes this is O(n) and suggests a shallow comparison as an improvement. For a `ResolvedProfile` with arrays like `habits` (which can contain many `HabitConfig` objects) and `foodFavourites`, this serialization runs on every Convex re-delivery of the profile query. Convex queries can re-deliver on any server change to any document in their read set, meaning this serialization can fire frequently in an active session. Measuring the habits array at, say, 20 items, each with ~10 fields, plus other arrays, this is potentially serializing several kilobytes per delivery.  
**Suggested Fix:** Replace the `JSON.stringify` deep comparison with a shallow field-by-field check. `ResolvedProfile` has a known, flat-ish shape with a fixed list of top-level keys. Compare scalar fields directly (`===`) and arrays by length + last-element identity. This is O(1) for scalars and O(1) amortized for arrays with the length+tail heuristic. A 2-level structural comparison would be sufficient given the profile update semantics.

---

### [NICE-TO-HAVE] `"use client"` Directives in Vite SPA Components Are Dead Code

**Category:** Security  
**Files:** `src/components/ui/date-picker.tsx:1`, `src/components/ui/drawer.tsx:1`, `src/components/ui/switch.tsx:1`, `src/components/ui/tabs.tsx:1`, `src/components/ui/toggle-group.tsx:1`, `src/components/ui/toggle.tsx:1`  
**Description:** Six UI components begin with `"use client";`. This directive is a Next.js App Router convention that has no effect in a Vite SPA. It is not a security vulnerability, but it is dead code that signals these files are shadcn/ui template artifacts that were not cleaned up. The directive being present creates a false impression that server-side rendering guard rails are in place, which is misleading — there are none in a pure Vite SPA.  
**Suggested Fix:** Remove the `"use client";` directive from all six files. CLAUDE.md explicitly notes "No server-only code in client components — this is a client-side SPA, not SSR." The inverse also applies: SSR-only annotations have no meaning here.

---

### [NICE-TO-HAVE] `useAiInsights` Subscribes to Eight Independent Convex Queries Simultaneously

**Category:** Performance  
**Files:** `src/hooks/useAiInsights.ts:81-124`  
**Description:** `useAiInsights` opens 8 independent Convex subscriptions via hook composition: `useAiAnalysisHistory`, `useLatestSuccessfulAiAnalysis`, `useAllFoodTrials`, `useWeeklyDigests(4)`, `useConversationsByDateRange`, `useSuggestionsByDateRange`, `useLatestWeeklySummary`, and the inherited `useSyncedLogsContext`. Each subscription can independently re-deliver data to the client. The ref-based pattern (`dataRef.current = ...`) correctly prevents callback identity churn, but each re-delivery still triggers a full render cycle of the hook's consumer. The ref approach is the right mitigation and this is acknowledged in the code's comments. This is a flag for awareness: if the component tree that owns this hook re-renders frequently (e.g. because it also owns the `useLiveClock` tick), the 8 subscriptions each update Convex's internal state machinery per render, which has a non-zero cost.  
**Suggested Fix:** Ensure the component that calls `useAiInsights` does not also call `useLiveClock` or other high-frequency state. The current architecture with refs is the correct approach for keeping the callback stable. If more subscriptions are added, consider whether any can be replaced by a single aggregated Convex query that returns all needed data in one round-trip.

---

### [NICE-TO-HAVE] `useFoodLlmMatching` Error Parsing Depends on Error Message String Matching

**Category:** Security  
**Files:** `src/hooks/useFoodLlmMatching.ts:144-147`  
**Description:** Retry/non-retry classification relies on `message.includes("[NON_RETRYABLE]")` and `message.includes("Invalid OpenAI API key")` string matching. These are fragile: a minor change to the server-side error message format will silently change whether the hook retries. `"Not authorized"` is particularly broad — a network proxy or Convex auth failure could produce a message containing that substring and incorrectly be classified as non-retryable.  
**Suggested Fix:** Use structured error codes rather than message-string matching. Convex supports throwing `ConvexError` with a `data` payload (e.g. `{ code: "INVALID_API_KEY" }`). The client can then check `err.data?.code === "INVALID_API_KEY"` which is both more robust and does not depend on human-readable error message wording.

---

## Summary

| Severity     | Count |
| ------------ | ----- |
| CRITICAL     | 0     |
| HIGH         | 0     |
| MODERATE     | 8     |
| NICE-TO-HAVE | 3     |

**No critical or high-severity issues were found in this group.** The codebase demonstrates good security hygiene: API keys are sanitized before logging, no `dangerouslySetInnerHTML` is used, auth is handled by Convex+Clerk rather than manual token management, and there is no XSS surface in the audited components. The moderate findings are concentrated around (a) client-supplied timestamps that should be validated/generated server-side, (b) minor performance allocations in high-frequency render paths, and (c) hardcoded locale/timezone assumptions that violate the multi-user extensibility requirement.
