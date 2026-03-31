---
name: vite-react-implementer
description: Project-specific patterns and conventions for implementing features in the PDH codebase (React + Vite + Convex + Zustand). Read this before implementing any feature to understand schema patterns, hook conventions, store shape, food pipeline, transit map domain, and key file locations.
---

# Vite React Implementer — Project Context

## Stack & Commands

| Command             | Purpose                             |
| ------------------- | ----------------------------------- |
| `bun run dev`       | Vite dev server (port 3005)         |
| `npx convex dev`    | Convex backend dev                  |
| `bun run build`     | Production build                    |
| `bun run typecheck` | `tsc --noEmit` + `convex typecheck` |
| `bun run lint:fix`  | Biome linter with auto-fix          |
| `bun run format`    | Biome formatter                     |
| `bun run test:unit` | Vitest unit tests                   |
| `bun run test:e2e`  | Playwright E2E tests                |

**Stack:** React 19, Vite, Convex 1.32, Tailwind v4, Zustand 5, Clerk 5, TanStack React Table, Biome 2.4, Bun, TypeScript 5.8 (strict).

---

## Project Structure

```
convex/           # Backend: schema, mutations, actions, validators
  __tests__/      # Convex unit tests (convex-test + vitest)
shared/           # Pure TS shared between client + server (food system)
  __tests__/      # Shared module unit tests
src/
  components/
    ui/           # Shared shadcn/Radix-style primitives (Button, Card, Drawer, Tabs, etc.)
    track/        # Track page ecosystem
      quick-capture/  # Habit tiles, duration popovers, weight drawer
      today-log/      # Log display, grouping, inline editing
        editors/      # Sub-row editors (FoodSubRow, HabitSubRow, etc.)
        groups/       # Group rows (FoodGroupRow, CounterHabitRow, etc.)
        rows/         # LogEntry (individual entry with inline edit)
      panels/         # Input forms (FoodSection, BowelSection, FluidSection)
      dr-poo/         # Bristol Scale companion UI
    patterns/     # Patterns page ecosystem
      database/   # Food database table, filters, columns, trial history
      hero/       # Dashboard metric tiles
      transit-map/# Both transit map variants (RegistryTransitMap + static TransitMap)
    settings/     # User configuration forms
    landing/      # Public pages + legal
  hooks/          # Custom hooks
    __tests__/    # Hook tests
  lib/            # Utility modules (habitTemplates, habitAggregates, sync, featureFlags, etc.)
  types/          # Domain types (domain.ts, transitMap.ts)
  pages/          # Route pages (Track.tsx, Patterns.tsx)
  contexts/       # React contexts (SyncedLogs, Profile, ApiKey, Theme)
  store.ts        # Zustand store (ephemeral only)
e2e/              # Playwright E2E tests + auth setup
docs/             # Plans, research, working docs
```

---

## TypeScript Configuration

- **Strict mode** enabled everywhere (root + convex tsconfig)
- **`exactOptionalPropertyTypes: true`** — Use conditional spread: `...(value !== undefined && { prop: value })`
- **`isolatedModules: true`**, `moduleResolution: "bundler"`
- **Path aliases:** `@/*` -> `./src/*`, `@shared/*` -> `./shared/*`
- **No `any` types.** No `// @ts-ignore`. No `// biome-ignore` unless genuinely unavoidable and documented.

---

## Convex Patterns

### Schema Overview

**Core tables:** `logs` (all user events), `profiles` (user settings), `foodAliases` (learned mappings), `foodEmbeddings` (vector search), `ingredientExposures` (evidence), `ingredientOverrides` (user status overrides), `foodAssessments` (AI verdicts), `foodTrialSummary` (aggregated evidence), `aiAnalyses` (AI reports), `conversations` (chat threads), `foodLibrary` (ingredient compositions), `foodRequests` (unmapped food submissions).

**Key patterns:**

- **Indexes:** Composite `(userId, field)` for multi-tenant queries. Vector index on `foodEmbeddings`.
- **Validators:** Union literals for enums (`v.union(v.literal("food"), v.literal("fluid"), ...)`). Query args matching index fields must use the same `v.union(v.literal(...))` validator, not `v.string()`.
- **Auth:** Every public mutation/query calls `requireAuth(ctx)` or `ctx.auth.getUserIdentity()`.
- **OCC:** Food items use `itemsVersion` counter, incremented on every items mutation.

### Mutation Types

| Type               | Callable From | Auth     | Use Case                              |
| ------------------ | ------------- | -------- | ------------------------------------- |
| `mutation`         | Client        | Required | User-initiated CRUD                   |
| `internalMutation` | Server only   | None     | Scheduled tasks, pipeline writes      |
| `action`           | Client        | Required | External I/O (OpenAI calls)           |
| `internalAction`   | Server only   | None     | Background I/O (embeddings, pipeline) |

**Handler reuse:** Extract shared logic into standalone async functions typed with `MutationCtx` + `Id` from `_generated/`. Both `mutation` and `internalMutation` call the shared function.

**Scheduling:** `ctx.scheduler.runAfter(0, internal.foo.bar, args)` for immediate background work. `ctx.scheduler.runAfter(DELAY_MS, ...)` for timed (e.g., 6h evidence window).

---

## State Management

### Zustand Store (`src/store.ts`)

Ephemeral only — no persist middleware, lost on page refresh.

| Field                | Type                                          | Purpose                                  |
| -------------------- | --------------------------------------------- | ---------------------------------------- |
| `habitLogs`          | `HabitLog[]`                                  | Derived from SyncedLogs + Profile habits |
| `baselineAverages`   | `BaselineAverages \| null`                    | Computed digestive baseline stats        |
| `baselineTodayHash`  | `string \| null`                              | Hash for baseline cache validation       |
| `lastInsightRunHash` | `string \| null`                              | Last AI insights run timestamp           |
| `aiAnalysisStatus`   | `"idle" \| "loading" \| "success" \| "error"` | AI analysis UI state                     |
| `aiAnalysisError`    | `string \| null`                              | AI error message                         |

### Context Providers

| Context             | Purpose                           | Source                                  |
| ------------------- | --------------------------------- | --------------------------------------- |
| `SyncedLogsContext` | All Convex logs → app             | `useAllSyncedLogs()` query              |
| `ProfileContext`    | Health profile + preferences      | `api.logs.getProfile`, `patchProfile()` |
| `ApiKeyContext`     | OpenAI BYOK key                   | IndexedDB via `useApiKey()`             |
| `AutoEditContext`   | Which log should auto-open editor | Local to Track page                     |
| `ThemeProvider`     | Dark/light mode                   | localStorage                            |

### Sync Hooks (`src/lib/sync.ts`)

**Read:** `useSyncedLogs(limit?)`, `useAllSyncedLogs()`, `useSyncedLogsByRange(start, end)`, `useFoodLibrary()`, `useAiAnalysisHistory(limit?)`, `useCulprits()`, `useSafeFoods()`

**Write:** `useAddSyncedLog()`, `useUpdateSyncedLog()`, `useRemoveSyncedLog()`, `useAddAiAnalysis()`

**Pattern:** Every mutation runs through `sanitizeLogData()` + `sanitizeUnknownStringsDeep()` at the boundary.

---

## Food System

### Registry (`shared/foodRegistry.ts`)

Single source of truth for all canonical foods. The registry is organized as:

- **4 Groups:** protein, carbs, fats, seasoning
- **11 Lines:** meat_fish, eggs_dairy, vegetable_protein, grains, vegetables, fruit, oils, dairy_fats, nuts_seeds, sauces_condiments, herbs_spices
- **3 Zones** (clinical recovery stages, NOT permission gates):
  - Zone 1: Liquids (1A) + soft solids (1B) — immediate post-op
  - Zone 2: Expanded diet — mild herbs, peeled veg, no garlic/onion/chili/fried
  - Zone 3: Experimental — introduce one at a time

Each entry has: `canonical`, `zone`, `group`, `line`, `macros`, `examples` (aliases), `lineOrder`, `notes?`, and `FoodDigestionMetadata`.

### Matching Pipeline (Server-Side)

```
User types meal text
  -> processLog() mutation (schedules background action)
  -> processLogInternal() action:
       1. preprocessMealText() -> split on conjunctions, parse quantities
       2. For each phrase:
          a. Fuzzy search (Fuse.js on registry + learned aliases)
          b. Embedding search (OpenAI text-embedding-3-small, vector query)
          c. Merge candidates (0.65 * fuzzy + 0.35 * embedding)
          d. Route confidence:
             HIGH (>=0.86) -> auto-resolve (resolvedBy: "registry")
             MEDIUM (>=0.56) -> store candidates + buckets for UI
             LOW + ambiguous -> LLM fallback (gpt-4o-mini)
       3. writeProcessedItems() -> patch log with items + increment itemsVersion
       4. Schedule processEvidence() at 6 hours
```

**Evidence window:** After 6 hours, unresolved items -> "unknown_food" (resolvedBy: "expired"). Resolved items -> `ingredientExposures` records.

**User resolution:** `resolveItem()` mutation validates canonical in registry, sets `resolvedBy: "user"`, learns alias via `upsertLearnedAlias()`.

### Key Food Files

| File                                         | Role                                                    |
| -------------------------------------------- | ------------------------------------------------------- |
| `shared/foodRegistry.ts`                     | Canonical food definitions + metadata                   |
| `shared/foodMatching.ts`                     | Fuzzy search, candidate merging, confidence routing     |
| `shared/foodNormalize.ts`                    | Rule-based name normalization                           |
| `shared/foodCanonicalization.ts`             | Deterministic lookup + collision detection              |
| `shared/foodEvidence.ts`                     | Bayesian evidence pipeline + trial resolution           |
| `shared/foodTypes.ts`                        | Canonical enums (FoodPrimaryStatus, FoodTendency, etc.) |
| `convex/foodParsing.ts`                      | Server pipeline: preprocess, match, LLM, evidence       |
| `src/components/track/FoodMatchingModal.tsx` | Candidate review + search + request UI                  |
| `src/hooks/useUnresolvedFoodQueue.ts`        | Flat queue of pending food items                        |
| `src/lib/foodDigestionMetadata.ts`           | Digestion metadata -> UI badges                         |

---

## Transit Map Domain

The transit map is the app's core visual metaphor — a **cumulative evidence record** (like a tube map showing every station visited), NOT a live journey or progression gate.

### Hierarchy

**Corridor** (FoodGroup) -> **Line** (FoodLine) -> **Station** (canonical food + evidence)

### Station Signals (from evidence)

| Signal | Color | Meaning                           |
| ------ | ----- | --------------------------------- |
| grey   | Grey  | Never trialled                    |
| blue   | Blue  | Trialling (insufficient evidence) |
| green  | Green | Safe (consistently good outcomes) |
| amber  | Amber | Watch (concerning outcomes)       |
| red    | Red   | Avoid (consistent bad outcomes)   |

**Tendency labels:** "On time" (neutral), "Express" (loose), "Delayed" (hard)

### Two Transit Map Components

1. **RegistryTransitMap** (`src/components/patterns/transit-map/RegistryTransitMap.tsx`) — Data-driven, built from registry + evidence via `useTransitMapData` hook. Corridors with colored lines, station buttons with signal dots, detail sidebar.
2. **TransitMap** (`src/components/patterns/transit-map/TransitMap.tsx`) — Static visual reference (original hardcoded anatomy). SVG canvas with positioned tracks.

### Key Types (`src/types/transitMap.ts`)

`TransitStation`, `TransitLine`, `TransitCorridor`, `TransitNetwork` — with helper functions: `stationSignalFromStatus()`, `tendencyLabel()`, `confidenceLabel()`, `serviceRecord()`.

### Critical Invariant

Zones are **suggested introduction order**, NOT permission gates. Users can eat anything at any time. The app records, correlates, and celebrates information gain. A red station is NOT a failure — it's useful detective work.

---

## Habit System

### HabitConfig Shape

```typescript
{
  id: string;                    // e.g., "habit_water"
  name: string;
  kind: "positive" | "destructive";
  habitType: "sleep" | "count" | "activity" | "fluid" | "destructive" | "checkbox" | "weight";
  unit: "count" | "ml" | "minutes" | "hours";
  quickIncrement: number;
  dailyTarget?: number;         // Positive habits
  dailyCap?: number;            // Destructive habits
  weeklyFrequencyTarget?: number; // Activities only
  showOnTrack: boolean;
  color: string;
  createdAt: number;
  archivedAt?: number;
  logAs?: "habit" | "fluid";    // Cross-cutting (coffee logs as fluid)
  templateKey?: string;
}
```

`HABIT_TEMPLATES` is the source of truth for built-in habits. Default setup includes water, sleep, weigh_in, walking, and medication.

### Key Habit Files

- `src/lib/habitTemplates.ts` — Types, built-in templates, `normalizeHabitConfig()`
- `src/lib/habitAggregates.ts` — Day summaries, streak calculations, `hasGoal()`, `computeStreakSummary()`
- `src/lib/habitProgress.ts` — Progress text, color coding, bar rendering
- `src/lib/habitCoaching.ts` — AI + heuristic coaching messages (3 tiers)
- `src/lib/habitConstants.ts` — `LONG_PRESS_THRESHOLD_MS = 300`

---

## Component Patterns

### UI Primitives (`src/components/ui/`)

Import directly from the `.tsx` files in this folder rather than a barrel. Follow the existing `cn()` and `data-slot` conventions when extending or composing them.

### Styling

- **Tailwind v4** with CSS custom properties (`--primary`, `--background`, `--section-food`, `--surface-0`, etc.)
- **CVA** for multi-variant components (Button, Badge)
- **`data-slot="component-name"`** on every component for CSS targeting
- **Section colors:** `--section-food`, `--section-bowel`, `--section-observe`, `--section-quick`
- **Fonts:** Bricolage Grotesque (display), Nunito (sans), JetBrains Mono (mono)

### Prop Conventions

- Polymorphism via Radix `Slot.Root` pattern (legacy `asChild` + new `render` prop)
- Conditional spread for `exactOptionalPropertyTypes`
- Descriptive props, not spread from parent types
- `accentColor` / `accentMuted` / `borderColor` CSS variable props on custom inputs

### Component Organization

Feature-based domains: `track/`, `patterns/`, `settings/`, `landing/`. Compose UI primitives, don't extend them.

---

## Hook Patterns

### Custom Hooks

| Hook                          | Purpose                                                              |
| ----------------------------- | -------------------------------------------------------------------- |
| `useAiInsights`               | Orchestrates AI analysis (fetch, abort, debounce, save)              |
| `useApiKey`                   | OpenAI BYOK from IndexedDB                                           |
| `useBaselineAverages`         | Computed baselines, throttled 5s, Zustand-cached                     |
| `useCelebration`              | Confetti + sound with auto-dismiss                                   |
| `useDayStats`                 | Today's habit counts, fluid totals, BM count                         |
| `useFoodLlmMatching`          | Client-initiated LLM for unresolved items (fire-and-forget)          |
| `useFoodParsing`              | Saves raw food text; server does parsing                             |
| `useHabitStreaks`             | Streak stats from habit logs                                         |
| `useLongPress`                | Long-press vs tap detection                                          |
| `useMappedAssessments`        | Memoized food assessment record mapping                              |
| `usePendingReplies`           | Unpaired user messages + reply mutation                              |
| `useProfile`                  | Bundled profile selectors and mutators (units, habits, health, etc.) |
| `useQuickCapture`             | Habit taps, duration logging, celebrations, toasts, undo             |
| `useTimePicker`               | Time input state machine                                             |
| `useTransitMapData`           | Fuses registry + evidence -> TransitNetwork                          |
| `useUnresolvedFoodQueue`      | Flat queue of pending food items                                     |
| `useUnresolvedFoodToast`      | Toast for unresolved items with 3h/6h transitions                    |
| `useWeeklySummaryAutoTrigger` | Auto-generates weekly summary at boundaries                          |

### Key Patterns

- **Snapshot refs:** Store mutable values in `useRef` to avoid dependency churn in callbacks
- **Fire-and-forget:** `.catch((err) => console.error(...))` for non-critical Convex saves
- **Throttling:** Built into mutation logic (e.g., baselineAverages 5s throttle), not via separate hooks
- **Conditional memoization:** `useMemo` for expensive computations; precise deps (e.g., `todayKey` not `now`)
- **Cleanup:** All timeout/interval refs have cleanup functions in `useEffect` returns

---

## Testing

### Unit Tests (Vitest)

- Config: `vitest.config.ts` — environment: `edge-runtime`, excludes `e2e/`
- **Convex tests:** `convex/__tests__/` — uses `convexTest(schema)` for isolated DB + scheduler. Fake timers for evidence windows.
- **Shared tests:** `shared/__tests__/` — pure function testing, no mocks, heavy describe/it nesting
- **Hook tests:** `src/hooks/__tests__/` — extract pure functions for testing (factory helpers like `makeFoodStat()`)

### E2E Tests (Playwright)

- Config: `playwright.config.ts` — 30s timeout, Clerk auth setup (serial), chromium project
- Auth: `.playwright/auth/user.json` storage state, `+clerk_test` suffix users with code `424242`
- Selectors: Role queries (`getByRole`) preferred, CSS selectors as fallback
- Isolation: Timestamp-based unique test data

---

## Implementation Discipline

### Identity

You are a disciplined, methodical implementer. You write boring, predictable, correct code. You never try to be clever. You never cut corners. You never suppress warnings, swallow errors, or hide problems.

### File Reading Protocol (CRITICAL)

- **ALWAYS read a file before editing it.** No exceptions.
- **ALWAYS re-read a file after editing it** before making subsequent edits. Biome reformats on save, so your next edit will fail without a re-read.
- Multiple changes to one file: either make all changes in a single edit, or Read -> Edit -> Re-read -> Edit for each.

### Refactor Awareness (CRITICAL)

The codebase is **actively being refactored**. Surrounding code may reflect old patterns or technical debt.

- **Do NOT assume surrounding code is correct** just because it exists. Treat it as evidence of what was tried, not truth.
- **Prioritize the target architecture** (as described in docs/plans/ and this skill) over local consistency with legacy patterns.
- **Refactor over patching** when a local fix would deepen existing contradictions.
- When in doubt, check `docs/plans/` and `docs/working/` for the intended direction.

### Code Quality

**TypeScript:** Full type safety. No `any`. Use discriminated unions + exhaustive checks. `exactOptionalPropertyTypes` requires conditional spread.

**Errors:** Never swallow. Every catch block handles meaningfully. Never `// @ts-ignore` or `// biome-ignore` without genuinely unavoidable documented reason. Surface errors to users or error boundaries.

**Style:** Boring, readable code. Clear names. Small functions. Early returns. No cleverness.

### UI Conventions

- `data-slot` attributes on every component
- CVA for variant styling
- `cn()` for className merging
- Compose shadcn/ui primitives, don't extend them
- Accessibility: `aria-*` attributes, keyboard navigation, focus states

### Workflow

1. Read all referenced files to understand current state
2. Read related files (imports, types, adjacent components)
3. Plan approach before writing
4. Implement methodically, following file reading protocol
5. Verify: type correctness, no suppressed errors, correct imports, no unused variables
6. Report completion with decisions made and open questions

### What NOT to Do

- Don't add dependencies without instruction
- Don't change project structure unless instructed
- Don't write clever or abstract code
- Don't skip reading files
- Don't assume business logic — ask if ambiguous
- Don't follow a surrounding pattern if it contradicts the target architecture

---

## Feature Flags

`src/lib/featureFlags.ts` — simple `FEATURE_FLAGS` const object with boolean flags.

Current: `transitMapV2: true` (live transit map enabled on Patterns page).

---

## Biome Configuration

- **Formatter:** 2 spaces, 100 char width, double quotes, trailing commas, semicolons always
- **Linter:** `noUnusedImports: warn`, `useExhaustiveDependencies: warn`, `noExplicitAny: error`, `noNonNullAssertion: warn`
- **Scope:** `src/**`, `convex/**`, `shared/**`, `e2e/**`, `docs/**`
- **CSS:** Parser supports Tailwind directives, linter/formatter disabled
- `src/components/ui/**`: linter disabled (shadcn-generated code)
- `convex/_generated/**`: linter/formatter/assist disabled (generated code)
