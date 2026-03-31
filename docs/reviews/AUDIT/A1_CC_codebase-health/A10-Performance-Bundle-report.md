# A10 — Performance + Bundle Audit Report

**Date:** 2026-03-16
**Scope:** Cross-cutting performance analysis
**Files reviewed:** ~80 source files across `src/`, `convex/`, `shared/`

---

## Critical Issues

| # | File | Line/Function | Issue | Impact | Fix |
|---|------|---------------|-------|--------|-----|
| C1 | `convex/logs.ts:763–775` | `count` query | Loads ALL user logs via `.collect()` just to return `rows.length` — no limit, no index count | Full table scan on every render for any subscriber; grows with user data | Add a Convex `count` index or use `.take(1)` then `.paginate()` for count estimation; alternatively remove callers that use this for UI display |
| C2 | `convex/logs.ts:808–829` | `listFoodLogs` query | Fetches ALL logs with `.collect()`, then filters in JS for `type === "food"` | Full table scan; no food-type index; returns all fields including large `data` blobs | Add index `by_userId_type` and filter at the DB level, or use `.filter()` query predicate |
| C3 | `src/lib/sync.ts:124–127` + `src/contexts/SyncedLogsContext.tsx:10` | `useAllSyncedLogs` / `SyncedLogsProvider` | Calls `api.logs.listAll` which does `.collect()` with no limit — all logs for a user, every reactive update | Real-time delivery of entire log history on every mutation; payload grows unboundedly | Paginate or enforce a hard limit; the main Track page only needs recent logs |
| C4 | `src/hooks/useAiInsights.ts:40` | `REPORT_HISTORY_COUNT = 500` | Fetches 500 AI analysis records on every render of Track page via `useAiAnalysisHistory(500)` | 500-row Convex query running reactively; each record includes large prompt/response strings | Use a much smaller default (10–20) for UI; only fetch more when user explicitly browses history |

---

## High Priority

| # | File | Line/Function | Issue | Impact | Fix |
|---|------|---------------|-------|--------|-----|
| H1 | `src/routeTree.tsx:33` | `TrackPage` import | `TrackPage` is imported **eagerly** at the top of `routeTree.tsx`: `import TrackPage from "./pages/Track"`. All other pages are `lazy()`. | Track page and all its transitive imports (panels, hooks, motion library, etc.) land in the initial bundle | Wrap in `lazy()` + `Suspense` matching the pattern used for `PatternsPage` |
| H2 | `shared/foodRegistry.ts` | Module-level export | 4,057-line static food registry is a module-level constant. Any file importing from `@shared/foodRegistry` (including `FoodMatchingModal` via `getGroupDisplayName`) pulls it into that chunk. FoodMatchingModal is already lazy-loaded, but `Patterns.tsx` imports `getFoodEntry` / `pickFoodDigestionMetadata` from `@shared/foodCanonicalization` which itself imports the full registry at module evaluation time | Registry enters the initial bundle via Patterns.tsx | Extract registry lookups behind async imports, or ensure `Patterns.tsx` is always lazy (it currently is — verify the registry is not transitively pulled into the root chunk via `routeTree.tsx` imports) |
| H3 | `convex/aggregateQueries.ts:83–88` | `foodTrialsByStatus` | Fetches all `foodTrialSummary` rows with `.collect()`, then filters in JS by status | Full table scan for every status filter; no `by_userId_status` index | Add index or use Convex `.filter()` query predicate |
| H4 | `convex/aggregateQueries.ts:97–106` | `foodTrialByName` | Fetches all `foodTrialSummary` rows with `.collect()`, then `.find()` in JS | Full table scan for a single-row lookup | Use `withIndex("by_userId", q => q.eq("userId", userId))` + Convex `.filter()` for canonicalName, or add `by_userId_canonicalName` index |
| H5 | `src/lib/digestiveCorrelations.ts:354–363` | `buildDaysWithValues` | Inside `.map()` over days, calls `habits.find(h => h.id === id)` per habit per day — O(days × habits × habitIds) | Repeated linear scans; small today but scales with habit count | Pre-build a `Map<habitId, HabitConfig>` before the loop |
| H6 | `vite.config.ts:154–160` | `manualChunks` | No chunk defined for `recharts`, `motion/react`, `lucide-react`, `radix-ui`, `fuse.js` — all land in vendor or page chunks unpredictably | `recharts` alone is ~350 KB gzip; `motion` ~60 KB; `lucide-react` tree-shaking depends on build | Add explicit `manualChunks` entries for `recharts`, `motion`, and optionally `fuse.js` |
| H7 | `src/components/track/today-log/rows/LogEntry.tsx:68–74` | `LogEntry` render body | `getHabitIcon(habitConfig)` is called twice (lines 71 and 72) in every render — same argument, same result, no memoization | Double computation per render of every habit log entry in the list | Call once: `const habitIconResult = habitConfig ? getHabitIcon(habitConfig) : null` |

---

## Medium Priority

| # | File | Line/Function | Issue | Impact | Fix |
|---|------|---------------|-------|--------|-----|
| M1 | `src/pages/Track.tsx:161` | `useStore((s) => s.habitLogs)` | Track page subscribes to the entire `habitLogs` array. Any mutation (adding/removing a habit log) causes the full Track page component to re-render, even if only a single habit changed | Cascading re-renders across all child components that receive `habitLogs` as props | Use fine-grained selectors or memoize derived values (`todayHabitLogs`, `yesterdayHabitLogs`) |
| M2 | `src/lib/baselineAverages.ts:104` | `computeBaselineAverages` — habit loop | `habitLogs.filter((log) => log.habitId === habit.id)` inside a `for...of habits` loop — O(habits × totalHabitLogs) | With many habits and long log history this becomes expensive; runs on every `useBaselineAverages` recomputation | Pre-group `habitLogs` by `habitId` into a `Map` before the loop |
| M3 | `src/pages/Track.tsx:174–212` | `useEffect` destructive rollover check | `habitLogs.filter(e => e.habitId === habit.id && ...)` inside a loop over `destructiveHabits` — O(destructiveHabits × habitLogs) per effect run | Runs every time `habitLogs`, `habits`, or `todayStart` change | Pre-filter `habitLogs` into a per-habit Map; memoize the computation |
| M4 | `convex/logs.ts:808–829` | `listFoodLogs` | Returns all food log fields including potentially large `data` blobs (matchCandidates arrays, rawInput strings) across all time | Over-fetching; sends unnecessary data to client for pipelines that only need `id`, `timestamp`, `canonicalName` fields | Add a projection or a dedicated lean query returning only needed fields |
| M5 | `src/components/track/FoodMatchingModal.tsx:95–104` | `searchFoods` Convex query | Fires on every render while `open=true` with `deferredSearchQuery`; no explicit debounce beyond `useDeferredValue`. With empty query, requests up to 160 results | Potentially frequent Convex queries during rapid typing (mitigated by `useDeferredValue` but not fully debounced) | `useDeferredValue` is reasonable but consider adding a minimum 2-character threshold before querying |
| M6 | `src/components/patterns/transit-map/RegistryTransitMap.tsx:52–56` | `firstStation` useMemo | `network.corridors.flatMap(...).flatMap(...)` creates two intermediate arrays every time `network.corridors` changes | Unnecessary allocations on a data-heavy component | Use `find` with early exit, or flatten once during `useTransitMapData` |
| M7 | `convex/reportSuggestions.ts:5–23` | `byReport` query | Fetches all rows by `aiAnalysisId` index then filters by `userId` in JS | Potential security-adjacent issue and unnecessary in-JS filtering | Add `userId` to the index or include it in the query predicate |
| M8 | `src/components/settings/tracking-form/DrPooSection.tsx` | 993-line file | Large static preview data (hundreds of lines of hardcoded sample text strings) lives in the component module | Entire preset preview corpus loads eagerly with the Settings page, even when user never views this section | Extract preview data into a separate module that can be lazy-loaded or tree-shaken |
| M9 | `convex/migrations.ts` | 1,359 lines | Single giant file containing all migration functions, including historical one-time migrations | All migration code included in every server deployment build | Not urgent for client bundle (server-only), but consider splitting by era or archiving completed migrations |

---

## Low Priority

| # | File | Line/Function | Issue | Impact | Fix |
|---|------|---------------|-------|--------|-----|
| L1 | `src/data/transitData.ts` (2,112 lines) | Module-level `MAIN_CATEGORIES` | Large static data array eagerly bound at module import. TransitMap imports it directly | Any chunk loading TransitMap loads the full transit data | TransitMap is within the lazy `Patterns` chunk so this is acceptable; confirm it does not leak into the root chunk |
| L2 | `src/lib/aiAnalysis.ts` (1,953 lines) | Single file | Mixes prompt construction, response parsing, token estimation, and Dr. Poo conversation logic | Hard to tree-shake; all AI code (including prompt scaffolding) loads with any AI-related feature | Split into `aiPrompts.ts`, `aiParsing.ts`, `aiInsights.ts` for better code splitting potential |
| L3 | `vite.config.ts` | No `build.target` set | Default Vite target includes legacy transforms | Slightly larger output for modern browsers | Set `build.target: 'es2022'` to skip unnecessary polyfills |
| L4 | `src/lib/sync.ts` (529 lines) | Mixed concerns | Combines query hooks, mutation hooks, AI hooks, food library hooks, aggregate hooks — all exported from one file | Any import from `sync.ts` pulls all exports into scope; impedes tree-shaking analysis | Split into `syncLogs.ts`, `syncFood.ts`, `syncAi.ts` etc. |
| L5 | `vite.config.ts:96` | PWA workbox pattern `**/*.js` | All JS chunks are pre-cached by the service worker | Every new deploy will invalidate and re-cache all JS, including heavy chunks | Set `globPatterns` more selectively or exclude large infrequently-changing chunks |
| L6 | `src/components/track/today-log/TodayLog.tsx:73` | `[...logs].sort(...)` | Creates a copy of the entire logs array on every render | Minor; sorted inside `useMemo` so only runs on `logs` change — acceptable | Non-issue since it is properly memoized |

---

## Large Files (>500 lines)

| File | Lines | Split Recommendation |
|------|-------|---------------------|
| `shared/foodRegistry.ts` | 4,057 | Registry data is already in `shared/` for server/client sharing. Consider splitting into `foodRegistryData.ts` (raw entries) + `foodRegistryUtils.ts` (lookup functions). Not urgent unless bundle profiling confirms it reaches the root chunk. |
| `src/data/transitData.ts` | 2,112 | Static transit metro data. Acceptable inside the lazy Patterns chunk. No action needed unless bundle profiling shows it in the root chunk. |
| `src/lib/aiAnalysis.ts` | 1,953 | Split into `aiPrompts.ts`, `aiParsing.ts`, `aiFetchInsights.ts`. All AI code is already lazy (only used by Track/Dr. Poo), so impact is medium priority. |
| `convex/logs.ts` | 2,017 | Single Convex module mixing CRUD, migrations, admin queries. Split into `logs/crudLogs.ts`, `logs/adminLogs.ts`, `logs/migrationLogs.ts` on the server. Server-only so no client bundle impact. |
| `convex/migrations.ts` | 1,359 | Server-only migration history. Archive completed migrations into a `convex/migrations/archive/` subdirectory. |
| `src/components/settings/tracking-form/DrPooSection.tsx` | 993 | Extract `PRESET_CARDS` and `ADVANCED_PREVIEW_MATRIX` static data into `drPooPreviewData.ts`. |
| `src/components/track/quick-capture/WeightEntryDrawer.tsx` | 906 | Extract SVG chart rendering into `WeightChart.tsx` and unit conversion helpers into `weightDrawerUtils.ts`. |
| `src/components/track/today-log/rows/LogEntry.tsx` | 832 | Extract per-type editor sections (ReproductiveEditor, FoodEditor, DigestiveEditor) into separate files. |
| `src/hooks/useQuickCapture.ts` | 742 | Extract `handleLogFluid`, `handleLogWeightKg`, `handleQuickCaptureTap` into sub-hooks. |
| `src/lib/habitTemplates.ts` | 707 | Extract `HABIT_TEMPLATES` data object into `habitTemplateData.ts`; keep logic in `habitTemplates.ts`. |
| `src/components/track/quick-capture/HabitDetailSheet.tsx` | 669 | Extract settings form into `HabitSettingsForm.tsx` and day summary chart into `HabitDayGrid.tsx`. |
| `src/pages/Track.tsx` | 668 | Already well-organized with extracted hooks; the length is acceptable but `handleDelete` and `handleSave` could move to a `useTrackMutations` hook. |
| `shared/foodEvidence.ts` | 965 | Split into `foodEvidenceCore.ts` (scoring logic) and `foodEvidenceFormatters.ts` (display). |
| `convex/foodParsing.ts` | 1,227 | Split server pipeline stages: `foodPipelineProcess.ts`, `foodPipelineSearch.ts`, `foodPipelineLlm.ts`. |

---

## Bundle Analysis

| Library | Import Pattern | Size Risk | Recommendation |
|---------|---------------|-----------|----------------|
| `recharts` | Named imports from root: `Area, AreaChart, ResponsiveContainer` etc. in `src/components/patterns/hero/Sparkline.tsx` | HIGH — ~350 KB gzip if not tree-shaken properly | Add `recharts` to `manualChunks` in vite.config.ts; recharts does support tree-shaking in v2.x but only with proper bundler config |
| `motion` (motion/react) | `AnimatePresence, motion` used in 17 files across Track/landing pages | MEDIUM — ~60 KB gzip; used on main bundle path via LogEntry | `motion` is already well tree-shaken; ensure landing page components are in the lazy LandingPage chunk |
| `openai` | Already in `manualChunks` — split to its own chunk | GOOD — isolated | No action needed |
| `convex` | Already in `manualChunks` | GOOD | No action needed |
| `lucide-react` | Named imports only (`import { Check, ... } from "lucide-react"`) | LOW — Lucide v0.577 supports per-icon tree shaking with named imports | Pattern is correct; verify no barrel `import * as` patterns exist |
| `fuse.js` | Used in `shared/foodMatching.ts` | MEDIUM — ~24 KB gzip | Used inside the food pipeline; check if it lands in the root chunk via any eager import path |
| `@tanstack/react-table` | Used in `Patterns.tsx` (already lazy) | LOW — lazy route, acceptable | No action needed |
| `react-markdown` | Check usage context | MEDIUM — markdown parser | Verify it is only used in lazy-loaded components |
| `papaparse` | Import not found in `src/` — likely only in Convex or scripts | LOW | Confirm it is not in client bundle |
| `date-fns` | Named imports across 28 files | LOW — excellent tree-shaking support | Pattern is correct; avoid `import * from 'date-fns'` |
| `idb-keyval` | API key storage only | LOW | Acceptable |

---

## Convex Query Patterns

| File | Query | Issue | Fix |
|------|-------|-------|-----|
| `convex/logs.ts:763–775` | `count` | `.collect()` entire log table to return `rows.length` | Use `ctx.db.query("logs").withIndex(...).paginate({ numItems: 1 })` and return `continueCursor` metadata, or add a dedicated counter document |
| `convex/logs.ts:808–829` | `listFoodLogs` | `.collect()` all logs then `.filter(row.type === "food")` in JS | Add `by_userId_type` index; filter at DB level |
| `convex/aggregateQueries.ts:74–88` | `foodTrialsByStatus` | `.collect()` all trial summaries then `.filter()` by status in JS | Add `by_userId_status` index or use Convex `.filter()` query predicate |
| `convex/aggregateQueries.ts:90–106` | `foodTrialByName` | `.collect()` all trial summaries then `.find()` by canonical name | Add `by_userId_canonicalName` index for O(1) lookup |
| `convex/reportSuggestions.ts:5–23` | `byReport` | Fetches by `aiAnalysisId` then filters by `userId` in JS | Add userId to the index; query `by_aiAnalysisId_userId` |
| `convex/foodParsing.ts:240–248` | `listFoodAliasesForUserFromDb` | Two separate `.collect()` queries (global aliases + user aliases) on every food match pipeline invocation | Acceptable for a server action (not a reactive query), but consider caching global aliases if they rarely change |

---

## Memoization Gaps

| File | Component/Function | Issue | Fix |
|------|-------------------|-------|-----|
| `src/components/track/today-log/rows/LogEntry.tsx:68–74` | `LogEntry` render | `getHabitIcon(habitConfig)` called twice with same argument in the render body (lines 71–72) | Call once: `const iconResult = habitConfig ? getHabitIcon(habitConfig) : null` |
| `src/lib/baselineAverages.ts:104` | `computeBaselineAverages` | `habitLogs.filter(l => l.habitId === habit.id)` inside `for...of habits` — O(habits × habitLogs) | Pre-build `Map<string, HabitLog[]>` by `habitId` before the loop |
| `src/lib/digestiveCorrelations.ts:357–359` | `buildDaysWithValues` | `habits.find(h => h.id === id)` called for every `(day, habitId)` pair | Pre-build `Map<string, HabitConfig>` by `habit.id` before entering the day loop |
| `src/pages/Track.tsx:174–196` | Destructive rollover `useEffect` | `habitLogs.filter(...)` loop inside effect without memoization — runs on every `habitLogs` change | Memoize destructive habit totals per day using `useMemo` outside the effect |
| `src/components/patterns/database/columns.tsx` | `FoodDatabaseRow` column defs | Column definitions are likely recreated on every render if not using `useMemo` at the call site | Verify the `columns` array is stable (defined at module scope or memoized); module-scope definition is preferred |
| `src/components/track/FoodMatchingModal.tsx:136–148` | `groupedOptions` | Recalculates `groupedOptions` from `filteredOptions` on every render; correctly uses `useMemo` | Pattern is fine |
| `src/contexts/SyncedLogsContext.tsx:21–35` | `SyncedLogsProvider` effect | `habitLogs.every(...)` O(n) comparison runs on every render that receives new `derivedHabitLogs` reference | Pattern is intentional for equality check before dispatch; acceptable but the O(n) equality check could be replaced with a hash comparison for very large log sets |

---

## Summary of Top Actions (Priority Order)

1. **C3 — Unbounded `listAll` query**: `SyncedLogsProvider` subscribes to every log ever written with no limit. This is the most impactful live query issue and will degrade as data grows.

2. **C1 — `count` query full table scan**: Replace with a paginate-based count or remove the reactive subscriber.

3. **C4 — `REPORT_HISTORY_COUNT = 500`**: Fetching 500 large AI analysis records reactively on Track page load. Reduce to 10 and paginate.

4. **H1 — `TrackPage` eager import**: The main landing page is not lazy-loaded, pulling all its transitive dependencies into the initial bundle. Wrap in `lazy()`.

5. **H6 — Missing `manualChunks` for `recharts`**: Add `recharts` to Vite's manual chunks to prevent it from landing unpredictably.

6. **H3/H4 — Missing Convex indexes**: `foodTrialsByStatus` and `foodTrialByName` both do full table scans.