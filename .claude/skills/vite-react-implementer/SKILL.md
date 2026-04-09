---
name: vite-react-implementer
description: Project-specific patterns and conventions for implementing features in the PDH codebase (React + Vite + Convex + Zustand). Read this before implementing any feature to understand schema patterns, hook conventions, store shape, food pipeline, and key file locations.
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

## TypeScript Configuration

- **Strict mode** enabled everywhere (root + convex tsconfig)
- **`exactOptionalPropertyTypes: true`** — Use conditional spread: `...(value !== undefined && { prop: value })`
- **`isolatedModules: true`**, `moduleResolution: "bundler"`
- **Path aliases:** `@/*` -> `./src/*`, `@shared/*` -> `./shared/*`
- **No `any` types.** No `// @ts-ignore`. No `// biome-ignore` unless genuinely unavoidable and documented.

---

## Convex Patterns

**Core tables:** `logs` (all user events), `profiles` (user settings), `foodAliases` (learned mappings), `foodEmbeddings` (vector search), `ingredientExposures` (evidence), `ingredientOverrides` (user status overrides), `foodAssessments` (AI verdicts), `foodTrialSummary` (aggregated evidence), `aiAnalyses` (AI reports), `conversations` (chat threads), `foodLibrary` (ingredient compositions), `foodRequests` (unmapped food submissions).

**Key patterns:**

- **Indexes:** Composite `(userId, field)` for multi-tenant queries. Vector index on `foodEmbeddings`.
- **Validators:** Union literals for enums (`v.union(v.literal("food"), v.literal("fluid"), ...)`). Query args matching index fields must use the same `v.union(v.literal(...))` validator, not `v.string()`.
- **Auth:** Every public mutation/query calls `requireAuth(ctx)` or `ctx.auth.getUserIdentity()`.
- **OCC:** Food items use `itemsVersion` counter, incremented on every items mutation.

| Type               | Callable From | Auth     | Use Case                              |
| ------------------ | ------------- | -------- | ------------------------------------- |
| `mutation`         | Client        | Required | User-initiated CRUD                   |
| `internalMutation` | Server only   | None     | Scheduled tasks, pipeline writes      |
| `action`           | Client        | Required | External I/O (OpenAI calls)           |
| `internalAction`   | Server only   | None     | Background I/O (embeddings, pipeline) |

**Handler reuse:** Extract shared logic into standalone async functions typed with `MutationCtx` + `Id` from `_generated/`. Both `mutation` and `internalMutation` call the shared function.

**Scheduling:** `ctx.scheduler.runAfter(0, internal.foo.bar, args)` for immediate background work.

---

## State Management

**Zustand store** (`src/store.ts`): Ephemeral only — no persist middleware, lost on page refresh. Contains habit logs, baseline averages, and AI analysis status.

**Context providers:** `SyncedLogsContext` (all Convex logs), `ProfileContext` (health profile + preferences), `ApiKeyContext` (OpenAI BYOK from IndexedDB), `AutoEditContext` (which log auto-opens editor), `ThemeProvider` (dark/light mode).

**Sync hooks** (`src/lib/sync.ts`): Read via `useSyncedLogs(limit?)`, `useAllSyncedLogs()`, `useSyncedLogsByRange(start, end)`, `useFoodLibrary()`. Write via `useAddSyncedLog()`, `useUpdateSyncedLog()`, `useRemoveSyncedLog()`. Every mutation runs through `sanitizeLogData()` + `sanitizeUnknownStringsDeep()` at the boundary.

---

## Food System

### Registry (`shared/foodRegistry.ts`)

Single source of truth for canonical foods. 4 groups (protein, carbs, fats, seasoning), 11 lines (meat_fish, eggs_dairy, etc.), 3 zones (clinical recovery stages, NOT permission gates). Each entry has: `canonical`, `zone`, `group`, `line`, `macros`, `examples` (aliases), `lineOrder`, `notes?`, and `FoodDigestionMetadata`.

### Matching Pipeline (Server-Side)

```
User types meal text
  -> processLog() mutation (schedules background action)
  -> processLogInternal() action:
       1. preprocessMealText() -> split on conjunctions, parse quantities
       2. For each phrase:
          a. Fuzzy search (Fuse.js on registry + learned aliases)
          b. Embedding search (OpenAI text-embedding-3-small)
          c. Merge candidates (0.65 * fuzzy + 0.35 * embedding)
          d. Route confidence:
             HIGH (>=0.86) -> auto-resolve
             MEDIUM (>=0.56) -> store candidates for UI
             LOW + ambiguous -> LLM fallback (gpt-4o-mini)
       3. writeProcessedItems() -> patch log with items + increment itemsVersion
       4. Schedule processEvidence() at 6 hours
```

**Evidence window:** After 6 hours, unresolved items -> "unknown_food". Resolved items -> `ingredientExposures` records.

**User resolution:** `resolveItem()` mutation validates canonical in registry, sets `resolvedBy: "user"`, learns alias via `upsertLearnedAlias()`.

---

## Habit System

Habits are stored in `profiles.habits[]` as `HabitConfig` objects with: `id`, `name`, `kind` (positive/destructive), `habitType` (sleep/count/activity/fluid/destructive/checkbox/weight), `unit`, `quickIncrement`, `dailyTarget?`, `dailyCap?`, `weeklyFrequencyTarget?`, `showOnTrack`, `color`, `logAs?` (cross-cutting: coffee logs as fluid).

Key files: `src/lib/habitTemplates.ts` (types + built-ins), `src/lib/habitAggregates.ts` (streaks + summaries), `src/lib/habitProgress.ts` (UI rendering), `src/lib/habitCoaching.ts` (AI + heuristic messages).

---

## Component Patterns

### Styling

- **Tailwind v4** with CSS custom properties (`--primary`, `--background`, `--section-food`, `--surface-0`, etc.)
- **CVA** for multi-variant components (Button, Badge)
- **`data-slot="component-name"`** on every component for CSS targeting
- **Section colors:** `--section-food`, `--section-bowel`, `--section-observe`, `--section-quick`
- **Fonts:** Bricolage Grotesque (display), Nunito (sans), JetBrains Mono (mono)

### UI Conventions

- Import UI primitives directly from `src/components/ui/*.tsx` (not barrel)
- `cn()` for className merging, `data-slot` on every component
- Compose shadcn/ui primitives, don't extend them
- Accessibility: `aria-*` attributes, keyboard navigation, focus states
- Conditional spread for `exactOptionalPropertyTypes`

---

## Implementation Discipline

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

### WIP Update (MANDATORY)

After every task completion, prepend a new entry to `docs/WIP.md` under the active initiative header (the `<!-- Implementer agents: prepend new entries HERE -->` comment). **This is non-negotiable — the WIP is how the system tracks what happened.**

**Entry format:**

```markdown
### YYYY-MM-DD — TaskName complete

- **Tasks:** W#-T##
- **Commit:** `{short hash}`
- **Files:** list key files changed
- **What:**
  - Bullet summary of each change
- **Verification:** `bun run typecheck` PASS (or note failures)
```

Rules:

- **Prepend** — newest entry goes at the top of the active initiative section, never at the bottom.
- Use the wave+task ID (e.g. `W2-T01`) from `docs/WORK-QUEUE.md`.
- Always include the commit hash after committing.
- Update the task's `Status` and `Commit` columns in `docs/WORK-QUEUE.md` at the same time.

### Workflow

1. Read all referenced files to understand current state
2. Read related files (imports, types, adjacent components)
3. Plan approach before writing
4. Implement methodically, following file reading protocol
5. Verify: type correctness, no suppressed errors, correct imports, no unused variables
6. Update `docs/WIP.md` and `docs/WORK-QUEUE.md` (see WIP Update above)
7. Report completion with decisions made and open questions

### What NOT to Do

- Don't add dependencies without instruction
- Don't change project structure unless instructed
- Don't write clever or abstract code
- Don't skip reading files
- Don't assume business logic — ask if ambiguous
- Don't follow a surrounding pattern if it contradicts the target architecture

---

## Biome Configuration

- **Formatter:** 2 spaces, 100 char width, double quotes, trailing commas, semicolons always
- **Linter:** `noUnusedImports: warn`, `useExhaustiveDependencies: warn`, `noExplicitAny: error`, `noNonNullAssertion: warn`
- **Scope:** `src/**`, `convex/**`, `shared/**`, `e2e/**`, `docs/**`
- `src/components/ui/**`: linter disabled (shadcn-generated code)
- `convex/_generated/**`: linter/formatter/assist disabled (generated code)

---

## Testing

- **Convex tests:** `convex/__tests__/` — uses `convexTest(schema)` for isolated DB. Fake timers for evidence windows.
- **Shared tests:** `shared/__tests__/` — pure function testing, no mocks
- **Hook tests:** `src/hooks/__tests__/` — extract pure functions for testing
- **E2E tests:** `e2e/` — Playwright, Clerk auth setup, role queries preferred, timestamp-based isolation

---

## Hook Patterns

Key custom hooks in `src/hooks/` — check before creating new ones:

| Hook                            | Purpose                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `useNutritionData`              | Read-only: derives calorie/macro summaries from SyncedLogs + profile goals                   |
| `useFoodData`                   | Convex-first food search: merges clinicalRegistry + ingredientProfiles + static fallback     |
| `useProfile`                    | Thin wrapper around ProfileContext; exports `useHabits`, `useHealthProfile`, `useUnitSystem` |
| `useHabitLog`                   | Writes habit log entries; handles toasts and increment logic                                 |
| `useHabitStreaks`               | Computes streak and day summary from habit logs                                              |
| `useDayStats`                   | Aggregates episodes, activity, and sleep for a given day                                     |
| `useSlotScopedFoods`            | Derives recent/frequent foods filtered by meal slot from SyncedLogs                          |
| `useUnresolvedFoodQueue`        | Returns food log items that still need resolution (pending/low-confidence)                   |
| `useQuickCapture`               | Handles quick-capture chip interactions and celebration triggers                             |
| `useAiInsights`                 | Triggers AI analysis action and tracks loading/result state                                  |
| `useMediaQuery` / `useIsMobile` | Responsive breakpoint detection (SSR-safe)                                                   |
| `useLongPress`                  | Unified tap + long-press handler for habit chips                                             |
| `usePendingReplies`             | Tracks optimistic Dr. Poo reply state                                                        |
| `useDetailSheetController`      | Controls open/close state for log detail sheets                                              |
