# Architecture Review: Caca Traca

**Date:** 2026-02-24
**Reviewer:** Claude Opus 4.6
**Codebase Version:** Commit `6f9928c` (master)
**Stack:** React 19 + TypeScript 5.8 + Vite 6 + Convex + Zustand 5 + Tailwind CSS 4

---

## Executive Summary

Caca Traca is a well-structured personal health tracker with a clear domain focus. The architecture follows a pragmatic local-first pattern using Zustand with IndexedDB persistence for settings and Convex for cloud-synced log data. The AI integration layer (OpenAI GPT-5.2 for analysis, GPT-5-mini for food parsing) is thoughtfully designed with fallback strategies and structured JSON contracts.

The codebase is in an early-to-mid maturity stage. Core data flows are clean and the component hierarchy is logical. However, there are several architectural concerns that should be addressed before the application scales further: the OpenAI API key is stored in persisted client state and used directly from the browser, the Convex `data` field uses `v.any()` losing all type safety on the most critical field in the schema, validator definitions are duplicated across files, and the "sync key" authentication model has no access control. The application also lacks any test infrastructure.

Overall assessment: **Solid foundation with targeted improvements needed.** The architecture is appropriate for a personal-use application but requires hardening in security, type safety, and data validation before broader use.

---

## Architecture Diagram

```
+-----------------------------------------------------------+
|                     Browser (React 19)                     |
|                                                            |
|  +-------+  +----------+  +-----------+  +-----------+    |
|  | Track |  | Patterns |  | Settings  |  | App Shell |    |
|  | Page  |  | Page     |  | Page      |  | (Router)  |    |
|  +---+---+  +----+-----+  +-----+-----+  +-----+-----+   |
|      |           |               |              |          |
|  +---v-----------v---------------v--------------v------+   |
|  |              Component Layer                        |   |
|  |  track/*  patterns/*  AiInsightsSection  TodayLog   |   |
|  +---+-------------------------------------------+-----+  |
|      |                                           |         |
|  +---v---+  +--------+  +-------+  +----------+ |         |
|  |Zustand|  | Hooks  |  |  Lib  |  |    UI    | |         |
|  | Store |  |--------+  |-------+  |Components| |         |
|  |       |  |useAi   |  |analysis| +----------+ |         |
|  |Config |  |Insights|  |food   |                |         |
|  |Health |  |useCeleb|  |Parsing|                |         |
|  |AI St. |  +---+----+  |aiAnaly|                |         |
|  +---+---+      |       |sis    |                |         |
|      |          |       +---+---+                |         |
|      |          |           |                    |         |
|  +---v----------v-----------v--------------------v-----+   |
|  |                  src/lib/sync.ts                    |   |
|  |        (Convex hooks: queries + mutations)          |   |
|  +---+---------------------------------------------+--+   |
|      |                                             |       |
+------+---------------------------------------------+-------+
       |                                             |
       v                                             v
+------+------+                             +--------+-------+
|  IndexedDB  |                             |   OpenAI API   |
| (idb-keyval)|                             | (Browser-side) |
|  Settings   |                             | GPT-5.2 / mini |
+-------------+                             +----------------+
       |
+------v------+
|   Convex    |
|  (Cloud DB) |
|  logs       |
|  profiles   |
|  aiAnalyses |
|  foodLibrary|
+-------------+
```

### Data Flow

```
User Action --> Component --> Handler (Track.tsx)
  |
  +--> addSyncedLog() --> Convex mutation (logs.add)
  |
  +--> recordLogEntry() --> Zustand (gamification update)
  |
  +--> triggerAnalysis() --> useAiInsights hook
         |
         +--> fetchAiInsights() --> OpenAI API (browser-direct)
         |
         +--> setAiInsight() --> Zustand (latest insight)
         |
         +--> addAiAnalysis() --> Convex mutation (aiAnalyses.add)
```

---

## Findings

### CRITICAL

#### C1: OpenAI API Key Stored in Persisted Client State

**Description:** The OpenAI API key is stored in the Zustand store, which is persisted to IndexedDB. It is then used directly from the browser (`dangerouslyAllowBrowser: true` in both `aiAnalysis.ts` and `foodParsing.ts`). This means the key is accessible to any JavaScript running on the page and persists across sessions in unencrypted local storage.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts:97` (`openAiApiKey` in state)
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts:529` (`dangerouslyAllowBrowser: true`)
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/foodParsing.ts:191` (`dangerouslyAllowBrowser: true`)

**Impact:** API key exposure via XSS, browser extensions, or any code with access to IndexedDB. Financial liability if the key is leaked since OpenAI charges per-token.

**Recommendation:** Move OpenAI calls to Convex server-side actions. Store the API key as a Convex environment variable (`OPENAI_API_KEY`). The client sends log data to a Convex action, which calls OpenAI server-side and returns the result. This eliminates browser-side key exposure entirely.

---

#### C2: No Authentication or Access Control on Sync Keys

**Description:** The entire data model relies on a user-provided "sync key" string for data isolation. Any user who guesses or knows another user's sync key can read and write all their health data, including AI analysis history. There is no authentication layer.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/convex/schema.ts:71` (syncKey on logs table)
- `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts:82-96` (query filters only by syncKey)
- `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts:209` (default key: `"my-recovery-key"`)

**Impact:** Complete data exposure for any user whose sync key is guessed. The default key `"my-recovery-key"` means any new user shares the same data namespace until they change it. Health data is extremely sensitive.

**Recommendation:** Implement Convex authentication (e.g., Clerk, Auth0, or Convex's built-in auth). Replace sync key with authenticated user IDs. If sync keys must remain for simplicity, at minimum hash them server-side and enforce minimum length/complexity.

---

#### C3: `v.any()` Used for Log Data Field Across the Entire Schema

**Description:** The most important field in the database -- `data` on the `logs` table -- uses `v.any()`. This means Convex performs zero validation on log payloads. The same applies to `request`, `response`, and `insight` on `aiAnalyses`. This undermines the entire Convex type system.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/convex/schema.ts:81` (`data: v.any()`)
- `/Users/peterjamesblizzard/projects/caca_traca/convex/schema.ts:89-90` (`request: v.any(), response: v.any(), insight: v.any()`)

**Impact:** Corrupt data can enter the database silently. Runtime errors when components read fields that don't exist. No ability to evolve the schema safely since the shape is unknown. Client-side code is littered with defensive `String(log.data?.field ?? "")` patterns as a consequence.

**Recommendation:** Define discriminated union validators for each log type:

```typescript
const foodDataValidator = v.object({
  items: v.array(
    v.object({
      name: v.string(),
      quantity: v.optional(v.number()),
      unit: v.optional(v.string()),
      canonicalName: v.optional(v.string()),
    }),
  ),
  notes: v.optional(v.string()),
});
// ... one per log type, then use v.union()
```

This is the single highest-leverage type safety improvement available.

---

### HIGH

#### H1: Hardcoded Patient Constants in AI Analysis Module

**Description:** Patient-specific constants (surgery date, weight, height) are hardcoded at the top of `aiAnalysis.ts` rather than read from the health profile stored in Zustand.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts:12-14`
  ```typescript
  const PATIENT_SURGERY_DATE = "2026-02-13";
  const PATIENT_WEIGHT_KG = 103;
  const PATIENT_HEIGHT_CM = 186;
  ```

**Impact:** The health profile settings page lets users configure surgery date, height, and weight, but these values are never actually used by the AI analysis. The AI will always report incorrect days-post-op and BMI if the user's actual values differ.

**Recommendation:** Accept `HealthProfile` as a parameter to `fetchAiInsights()` and use it to build the system prompt dynamically. Remove the hardcoded constants.

---

#### H2: Duplicated Validator Definitions Across Convex Files

**Description:** Convex validators for `habitConfig`, `habitCategory`, `habitGoalMode`, `habitType`, `earnedBadges`, `gamification`, and `sleepGoal` are defined identically in both `convex/schema.ts` and `convex/logs.ts`. This is a maintenance hazard.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/convex/schema.ts:4-67`
- `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts:4-75`

**Impact:** When a new habit type or category is added, it must be updated in two places. If they diverge, mutations will fail silently or accept invalid data.

**Recommendation:** Extract shared validators into a `convex/validators.ts` file and import them in both `schema.ts` and `logs.ts`.

---

#### H3: Missing `"sweets"` Habit Type in `logs.ts` Validator

**Description:** The `habitTypeValidator` in `schema.ts` includes `v.literal("sweets")` but the duplicate in `logs.ts` does not. This means the `replaceProfile` mutation in `logs.ts` would reject profiles containing habits with `habitType: "sweets"`.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/convex/schema.ts:25` (includes `"sweets"`)
- `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts:33` (missing `"sweets"`)

**Impact:** Data loss or mutation failure when saving profiles that contain habits typed as "sweets". This is a direct consequence of H2 (duplicated validators).

**Recommendation:** Fix immediately by adding `"sweets"` to `logs.ts`, then consolidate validators per H2.

---

#### H4: No Lazy Loading or Code Splitting

**Description:** All three pages (Track, Patterns, Settings) and all their dependencies are eagerly imported in `App.tsx`. There is no `React.lazy()` or dynamic import usage.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/App.tsx:14-16`
  ```typescript
  import PatternsPage from "./pages/Patterns";
  import SettingsPage from "./pages/Settings";
  import TrackPage from "./pages/Track";
  ```

**Impact:** The entire application (including the large AI analysis module with its multi-hundred-line system prompt, the analysis engine, all pattern components, papaparse for CSV export, etc.) is loaded on initial page load even when the user only visits the Track page.

**Recommendation:** Use `React.lazy()` with `Suspense` for the Patterns and Settings pages at minimum. The AI analysis module could also be dynamically imported since it is only needed after the first food/bowel log.

---

#### H5: `analyzeLogs()` Called on Every Render with Full Log Set

**Description:** `analyzeLogs(logs)` is called in Track.tsx with up to 1200 logs. While wrapped in `useMemo`, the memo depends on the entire `logs` array reference, which changes on every Convex reactive update. The analysis function iterates all logs multiple times (building digestive events, food trials, resolving correlations, analyzing factors).

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx:119` (`analyzeLogs(logs)`)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/FoodSafetyDatabase.tsx:356` (also calls `analyzeLogs(logs)`)

**Impact:** Potentially expensive recomputation on every new log entry. With 1200 logs, the correlation resolution algorithm (which is O(food_trials \* bowel_events)) could become noticeable.

**Recommendation:** Consider moving analysis to a web worker, or at minimum adding a shallow comparison on the logs array length + latest timestamp to avoid unnecessary recomputation. Also, the analysis result on Track.tsx is only used for badge counting (`allSafeCount`) -- this could be a much cheaper dedicated function.

---

#### H6: No Test Infrastructure

**Description:** There are zero test files in the codebase. No test framework is configured in `package.json` (no vitest, jest, playwright, or cypress). The complex analysis engine (`analysis.ts`, 900+ lines), food parsing, streak calculations, and transit correlation algorithms have no automated verification.

**Location:** Entire codebase.

**Impact:** Regressions in food safety classification, transit time correlation, or streak calculation could silently produce incorrect health guidance. The AI system prompt evolves based on these classifications.

**Recommendation:** Add Vitest (already Vite-native). Priority test targets:

1. `analysis.ts` -- food safety status classification, transit correlation resolution
2. `streaks.ts` -- streak counting, shield logic, badge checks
3. `foodParsing.ts` -- fallback parsing, validation functions
4. `habitTemplates.ts` -- normalization, inference logic

---

### MEDIUM

#### M1: `LogEntry.data` Typed as `any` on the Client Side

**Description:** The `LogEntry` interface defines `data: any`, and `SyncedLog` also types `data` as `any`. Every consumer of log data must defensively access fields with patterns like `String(log.data?.field ?? "")`.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts:89` (`data: any`)
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/sync.ts:12` (`data: any`)

**Impact:** No compile-time safety for log data access. Typos in field names are invisible. IDE autocomplete does not work on the most frequently accessed data structure.

**Recommendation:** Define discriminated union types for log data:

```typescript
type FoodLogData = { items: Array<{ name: string; canonicalName?: string; quantity: number | null; unit: string | null }>; notes: string };
type DigestionLogData = { bristolCode: number; urgencyTag: string; /* ... */ };
// ... etc
type LogData = { type: "food"; data: FoodLogData } | { type: "digestion"; data: DigestionLogData } | /* ... */;
```

---

#### M2: FluidSection Uses Hardcoded Presets Instead of User-Configured Ones

**Description:** `FluidSection.tsx` has its own hardcoded `FLUID_PRESETS` array (`["Aquarius", "Coffee", "Coke", "Juice"]`) instead of using the configurable `fluidPresets` from the Zustand store that the user manages in Settings.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/FluidSection.tsx:7`

**Impact:** Users who customize their fluid presets in Settings will not see their changes reflected on the Track page. The Settings page lets users add/remove fluid presets, but the Track page ignores this configuration.

**Recommendation:** Pass `fluidPresets` from the store as a prop to `FluidSection`, or have `FluidSection` read from the store directly.

---

#### M3: `REQUIRED_QUICK_HABITS` Duplicated Between Files

**Description:** The list of required quick habits is defined in both `habitTemplates.ts` (line 207) and `Track.tsx` (line 37), with different contents. Track.tsx includes `confectionery` while `habitTemplates.ts` does not.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitTemplates.ts:207-214`
- `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx:37-45`

**Impact:** Inconsistent quick habit display depending on which list is used. Components that call `mergeRequiredHabits()` (from `habitTemplates.ts`) get a different set than the Track page.

**Recommendation:** Use a single source of truth. Remove the duplicate from Track.tsx and import from `habitTemplates.ts`, adding the `confectionery` template there if needed.

---

#### M4: Zustand Store is a Monolithic Blob

**Description:** The entire application state (sync key, API key, unit system, habits, fluid presets, gamification, sleep goal, health profile, AI insight, AI analysis status, Dr. Poo replies) lives in a single Zustand store with 25+ actions. This makes it hard to reason about which parts of the state change together.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (entire file, 377 lines)

**Impact:** Any state change triggers subscription checks across all consumers. Component re-renders may be broader than necessary if selectors are not precise.

**Recommendation:** Consider splitting into domain slices using Zustand's slice pattern:

- `settingsSlice` (syncKey, apiKey, unitSystem, habits, fluidPresets)
- `healthSlice` (healthProfile)
- `gamificationSlice` (gamification, sleepGoal)
- `aiSlice` (latestAiInsight, aiAnalysisStatus, aiAnalysisError, drPooReplies)

This is not urgent but improves maintainability as the store grows.

---

#### M5: Convex Queries Fetched Multiple Times Across Components

**Description:** `useSyncedLogs(1200)` is called independently in Track.tsx, useAiInsights.ts, DaySummaryCard.tsx, FoodSafetyDatabase.tsx, HabitsStreaksWeight.tsx, and Settings.tsx. Convex deduplicates identical queries, but some calls use different limits (600, 1200) which creates separate subscriptions.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx:65` (1200)
- `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useAiInsights.ts:19` (1200)
- `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Settings.tsx:43` (600)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/DaySummaryCard.tsx:36` (1200)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/FoodSafetyDatabase.tsx:353` (1200)

**Impact:** Multiple Convex subscriptions with different parameters. The 600-limit call in Settings creates a separate subscription from the 1200-limit calls, doubling the reactive overhead.

**Recommendation:** Standardize on a single limit value and consider lifting log fetching to the page level, passing logs down as props or via context.

---

#### M6: Error Handling Swallows Details in Several Places

**Description:** Multiple catch blocks use `catch (err: any)` and only display `err?.message`, losing stack traces and error context. Some async operations use `.catch(console.error)` fire-and-forget patterns.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx:330-333` (`catch (err: any)`)
- `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx:220-221` (`.catch(console.error)`)
- `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useAiInsights.ts:88` (`.catch(console.error)`)

**Impact:** Silent failures in food library batch operations and AI analysis saves. Users may not know their data failed to sync.

**Recommendation:** Add a centralized error reporting utility. Consider a toast notification for failed background operations. Replace `catch (err: any)` with proper `unknown` typing per TypeScript best practices.

---

#### M7: `WeightFormState` Defined in Two Different Files with Different Shapes

**Description:** `WeightFormState` is defined in both `ActivitySection.tsx` and `WeightSection.tsx` with different fields. The one in `ActivitySection.tsx` only has `weightKg`, while `WeightSection.tsx` adds `notes`.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/ActivitySection.tsx:15-17`
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/WeightSection.tsx:8-11`

**Impact:** Confusion about which interface to use. The Track page imports from `ActivitySection.tsx` and ignores the `notes` field.

**Recommendation:** Consolidate into a single shared type definition file (e.g., `src/types/forms.ts`).

---

### LOW

#### L1: `noExplicitAny` Disabled in Biome Config

**Description:** The linter rule `noExplicitAny` is set to `"off"`, allowing `any` types throughout the codebase. There are many instances of `any` that could be properly typed.

**Location:** `/Users/peterjamesblizzard/projects/caca_traca/biome.json:22`

**Impact:** Reduced type safety across the codebase. Easy to introduce untyped code paths.

**Recommendation:** Enable as `"warn"` initially, then progressively fix occurrences. The highest-value fix is typing the log `data` field (M1).

---

#### L2: `vite` Listed in Both `dependencies` and `devDependencies`

**Description:** The `vite` package appears in both `dependencies` (line 40) and `devDependencies` (line 52) in `package.json`.

**Location:** `/Users/peterjamesblizzard/projects/caca_traca/package.json:40,52`

**Impact:** Minor: duplicate dependency, slightly larger install. Could cause version conflicts.

**Recommendation:** Remove from `dependencies` and keep only in `devDependencies`.

---

#### L3: Platform-Specific Dependencies in `dependencies`

**Description:** Several platform-specific packages are in `dependencies`: `@biomejs/cli-linux-arm64`, `@esbuild/linux-arm64`, `@rollup/rollup-linux-arm64-gnu`, `@tailwindcss/oxide-linux-arm64-gnu`, `lightningcss-linux-arm64-gnu`. These are build-tool native binaries for a specific platform.

**Location:** `/Users/peterjamesblizzard/projects/caca_traca/package.json:16-19,28`

**Impact:** These get installed on all platforms unnecessarily. They bloat `node_modules` and may fail on non-arm64 systems.

**Recommendation:** Move to `optionalDependencies` or remove entirely -- these are typically auto-resolved by their parent packages.

---

#### L4: `RouteErrorBoundary` Uses Non-Standard Class Component Pattern

**Description:** The error boundary uses `declare props` / `declare state` / `declare setState` which is unusual and relies on `experimentalDecorators` + `useDefineForClassFields: false`. The standard pattern would use proper constructor typing.

**Location:** `/Users/peterjamesblizzard/projects/caca_traca/src/App.tsx:45-48`

**Impact:** Fragile -- depends on specific TypeScript config flags. Not standard React class component pattern.

**Recommendation:** Use the standard `React.Component<Props, State>` generic pattern, or migrate to a library like `react-error-boundary`.

---

#### L5: Theme Provider Uses `data-theme` Attribute Instead of `class`

**Description:** The theme provider sets `data-theme="dark"` on the root element, but Tailwind CSS 4 uses `@media (prefers-color-scheme: dark)` by default. The CSS likely uses custom selectors like `[data-theme="dark"]` for styling.

**Location:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/theme-provider.tsx:40`

**Impact:** No functional issue, but if Tailwind's built-in dark mode class strategy is not configured to match, `dark:` variant classes may not work as expected.

**Recommendation:** Verify that Tailwind CSS 4 is configured to use the `data-theme` selector for dark mode, or switch to the standard `class="dark"` approach.

---

#### L6: `WeightSection` and `WeightTrendCard` Components Appear Unused

**Description:** `WeightSection.tsx` exports `WeightSection` but it is not imported anywhere. Weight logging is handled inline by `HealthSection` (in `ActivitySection.tsx`). Similarly, `WeightTrendCard` is not imported in any page.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/WeightSection.tsx`
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/WeightTrendCard.tsx`

**Impact:** Dead code increases bundle size (though tree-shaking may remove them) and maintenance burden.

**Recommendation:** Remove or integrate these components.

---

#### L7: `FoodDrinkSection.tsx` Exists but is Not Imported

**Description:** There is a `FoodDrinkSection.tsx` file that is not imported by any page or component.

**Location:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/FoodDrinkSection.tsx`

**Impact:** Dead code.

**Recommendation:** Remove if superseded by `FoodSection.tsx` and `FluidSection.tsx`.

---

#### L8: Multiple `formatWeight` Functions Across Files

**Description:** The `formatWeight` utility function (converting kg to display string) is defined independently in `WeightTrendCard.tsx` and `HabitsStreaksWeight.tsx`. Similarly, `formatWeightDelta` is duplicated.

**Location:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/WeightTrendCard.tsx:9-14`
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/HabitsStreaksWeight.tsx:9-23`

**Impact:** Maintenance burden. Risk of inconsistent formatting if one is updated but not the other.

**Recommendation:** Extract to a shared utility function in `src/lib/format.ts`.

---

## Strengths

### S1: Clean Separation of Data Layer

The `src/lib/sync.ts` file provides a clean abstraction over Convex queries and mutations. Components never call Convex APIs directly -- they use well-named hooks like `useSyncedLogs()`, `useAddSyncedLog()`, `useFoodLibrary()`. This makes it easy to swap the backend.

### S2: Thoughtful AI Integration Design

The AI analysis pipeline is well-architected:

- Conversation history is maintained (previous reports sent as assistant messages)
- Structured JSON output with fallback parsing (`applyFallbacks()`)
- Food parsing has proper validation (`isValidFoodParseResult()`) with graceful fallback to naive comma splitting
- Analysis results are persisted to Convex for audit and history
- Debouncing prevents excessive API calls

### S3: Robust Food Safety Analysis Engine

The `analysis.ts` module implements a sophisticated food-to-outcome correlation system with:

- Transit time windows (55min to 18h+)
- Rolling 3-trial status graduation
- BRAT baseline foods with safe defaults
- Factor correlation analysis (walking, smoking, sleep, fluids)
- Multiple status levels (safe, safe-loose, safe-hard, watch, risky, testing)

### S4: Error Boundaries Per Route

Each route is wrapped in a `RouteErrorBoundary` with a "Retry" button and "Reload app" fallback. This prevents a crash in one page from taking down the entire application.

### S5: Good Component Composition

The Track page uses a clear 3-column layout with well-separated concerns:

- Column 1: Input forms (Food, Fluid, Bowel, Health, Quick Capture)
- Column 2: Analysis display (Observation Window, AI Insights)
- Column 3: Log view (TodayLog with day navigation)

Each section is a self-contained component with clear props interfaces.

### S6: Gamification System

The streak tracking with weekly shield resets, badge system, sound effects (synthesized via Web Audio API -- no audio file dependencies), and confetti animations provide engaging feedback. The system is well-designed with proper state management.

### S7: Offline-First Architecture

Settings and configuration are persisted locally via IndexedDB (through Zustand's persist middleware). Log data syncs through Convex. The app functions without internet connectivity for core tracking operations.

### S8: Biome Linter and Formatter Configuration

The project uses Biome for both linting and formatting with sensible defaults. Import organization is automated. The configuration is well-tuned with appropriate overrides for UI components.

---

## Overall Architecture Assessment

### Rating: B- (Good foundation, needs targeted hardening)

The application demonstrates strong domain knowledge and pragmatic architectural choices for a personal health tracker. The data model is appropriate for the problem space, the AI integration is well-structured, and the component hierarchy is logical.

**Priority improvements (in order):**

1. **Security (C1, C2):** Move API calls server-side and add authentication. These are blocking issues for any multi-user deployment.
2. **Type Safety (C3, M1):** Define proper validators and TypeScript types for log data. This is the highest-leverage code quality improvement.
3. **Consolidation (H2, H3, M3):** Eliminate duplicated validators and constant definitions before they diverge further.
4. **Dynamic Health Profile (H1):** Wire the health profile settings to the AI analysis module so the user's actual data is used.
5. **Testing (H6):** Add Vitest and write tests for the analysis engine -- this code directly impacts health guidance.
6. **Performance (H4, H5):** Add lazy loading and optimize the analysis computation path.

The codebase is well-organized and follows its own stated conventions ("boring code"). The main risks are in the security model and type safety gaps, both of which are addressable without architectural changes.
