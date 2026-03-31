# Fix Status 11: Lib, Hooks, Contexts, Types, Route

**Scope:** `src/lib/`, `src/hooks/`, `src/contexts/`, `src/store.ts`, `src/routeTree.tsx`, `src/types/transitMap.ts`

## HIGH Fixes (13 items)

| # | File | Finding | Status | Notes |
|---|------|---------|--------|-------|
| 1 | `src/lib/sounds.ts` | AudioContext never closed on page unload | DONE | Added `pagehide` listener to close + null AudioContext |
| 2 | `src/lib/sounds.ts` | No `prefers-reduced-motion` check | DONE | Early return when reduced motion is preferred |
| 3 | `src/lib/sounds.ts` | AudioContext resume can silently fail | DONE | Check `ctx.state` after `resume()` and bail if still suspended |
| 4 | `src/lib/inputSafety.ts` | `sanitizePlainText` silently coerces non-string | DONE | Added dev-mode `console.warn` for non-string input |
| 5 | `src/lib/inputSafety.ts` | `assertMaxLength` error omits actual length | DONE | Error message now includes actual length |
| 6 | `src/lib/foodParsing.ts` | Fallback items tagged `resolvedBy: "llm"` instead of heuristic | TODO | Requires schema change to add `"heuristic"` to Convex validators; added TODO comment |
| 7 | `src/lib/reproductiveHealth.ts` | Trimester boundaries off by a week | DONE | Changed from `14*7`/`28*7` to `91`/`189` (week 13/27 boundaries) |
| 8 | `src/lib/habitAggregates.ts` | Streak computed on full `filtered` not `windowed` | DONE | Changed loop to iterate `windowed` instead of `filtered` |
| 9 | `src/lib/celebrations.ts` | Milestone only fires at exactly streak 7 | DONE | Changed to `streak >= 7 && streak % 7 === 0` with dynamic message |
| 10 | `src/hooks/useAiInsights.ts` | `stableEndMs` frozen at mount time | DONE | Derived from `boundaryMs + 7 days` inside `useMemo` |
| 11 | `src/hooks/useApiKey.ts` | `hasApiKey` returns `false` during loading | DONE | Returns `undefined` during loading |
| 12 | `src/hooks/useTransitMapGeometry.ts` | DOM leak in `interpolateStationsBrowser` | DONE | Wrapped `appendChild`/`removeChild` in `try/finally` |
| 13 | `src/types/transitMap.ts` | Bristol 7 excluded from loose count in `serviceRecord` | DONE | Changed filter to `n >= 6 && n <= 7`; removed `bad`/`cancelled` category |

## MODERATE Fixes (18 items)

| # | File | Finding | Status | Notes |
|---|------|---------|--------|-------|
| 1 | `src/lib/aiRateLimiter.ts` | Error says "few seconds" but cooldown is 5 min | DONE | Changed to "please wait 5 minutes between calls" |
| 2 | `src/lib/syncAi.ts` | Client-side `Date.now()` timestamps | TODO-COMMENT | Added TODO about server-side timestamp alternative |
| 3 | `src/lib/baselineAverages.ts` | Duplicate `fluidCalendarDays` logic | TODO-COMMENT | Added TODO about shared implementation with analysis.ts |
| 4 | `src/lib/analysis.ts` | `normalizeDigestiveCategory` accepts Bristol outside 1-7 | DONE | Added `code >= 1 && code <= 7` guard |
| 5 | `src/lib/habitCoaching.ts` | `heuristicSuggestions` sliced without sorting | DONE | Added `.sort((a, b) => a.date.localeCompare(b.date))` before `.slice(-7)` |
| 6 | `src/lib/habitTemplates.ts` | `dailyCap >= 0` allows cap of 0 | DONE | Changed to `dailyCap > 0` |
| 7 | `src/lib/habitTemplates.ts` | Coffee template unit/cap mismatch | DONE | Added clarifying comment about count/ml duality (semantics correct as-is) |
| 8 | `src/lib/formatWeight.ts` | No NaN/Infinity guard | DONE | Added `Number.isFinite()` guard to both `formatWeight` and `formatWeightDelta` |
| 9 | `src/lib/habitProgress.ts` | Fluid cap text mixes ml with unitless count | DONE | Added "cups" unit label to "left" and "over" text |
| 10 | `src/hooks/useWeeklySummaryAutoTrigger.ts` | Boundary recomputed every render | DONE | Wrapped `getCompletedPeriodBounds()` in `useMemo` |
| 11 | `src/hooks/useHabitLog.ts` | `handleLogFluid` default timestamp uses `Date.now()` | DONE | Changed to `captureNow()` for backdate support |
| 12 | `src/hooks/useHabitLog.ts` | `handleIncrementHabit` default timestamp uses `Date.now()` | DONE | Changed to `captureNow()` for backdate support |
| 13 | `src/hooks/useHabitLog.ts` | `getState()` race condition after await undocumented | DONE | Added comment documenting the race and why it's low-risk |
| 14 | `src/hooks/useUnresolvedFoodQueue.ts` | No guard on `foodData.items` | DONE | Added `Array.isArray(foodData?.items)` guard |
| 15 | `src/hooks/useFoodLlmMatching.ts` | Raw API key sent over wire | TODO-COMMENT | Added TODO; fix requires server-side action changes (out of scope) |
| 16 | `src/hooks/useFoodParsing.ts` | Unused `_items` parameter | DONE | Removed unused parameter, wrapped in `useCallback` |
| 17 | `src/contexts/ProfileContext.tsx` | `JSON.stringify` in dep array every render | TODO-COMMENT | Added TODO about optimization with `useMemo` or ref comparison |
| 18 | `src/routeTree.tsx` | `/archive` missing from `requiresSyncedLogs` | DONE | Added `pathname.startsWith("/archive")` |

## Summary

- **HIGH:** 12/13 fixed, 1 deferred (requires schema change)
- **MODERATE:** 14/18 fixed, 4 deferred as TODO comments (require cross-boundary changes)
- **Typecheck:** All pre-existing errors only. No new type errors introduced by these fixes.
- **Skipped files:** `src/store.ts` — no findings assigned to it in this batch.

## Risks

- `src/hooks/useFoodParsing.ts`: Removed unused `_items` parameter from `handleLogFood` callback. If any caller outside the allowed file list passes 4 arguments, this will cause a type error. The parameter was unused (`_items`), so runtime behavior is unchanged.
- `src/hooks/useApiKey.ts`: `hasApiKey` now returns `undefined` during loading instead of `false`. Callers that do strict `=== false` checks may need updating.
