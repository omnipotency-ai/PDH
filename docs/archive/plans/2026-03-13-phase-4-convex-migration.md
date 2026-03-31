# Phase 4: Convex Layer Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Delete the broken game layer, create a `shared/` directory for code used by both client and server, and unify food name normalization in Convex to use registry-based canonicalization.

**Architecture:** Three workstreams — (1) delete game layer tables/code/types, (2) move shared food system code to `shared/` at repo root, (3) replace divergent normalization in Convex with registry canonicalization. No data migrations. No backwards compatibility. Raw logs are never touched.

**Tech Stack:** Convex, TypeScript, Vite (path aliases), Bun

---

## Context

### What Phase 4 IS

- Delete the broken game layer (stations, templates, trials, game state)
- Create `shared/` directory for code imported by both `src/` and `convex/`
- Unify normalization so Convex uses the same registry canonicalization as the evidence pipeline

### What Phase 4 is NOT

- No data migration — the Bayesian engine recomputes from raw logs every time
- No UI rebuild — that's Phase 5
- No `buildFoodEvidenceResult` consolidation (the "runs in 4 places" issue) — separate optimisation
- No `analyzeLogs` shared context lift (PERF-001/004) — separate optimisation
- No transit map UI — Phase 5

### Raw data preservation

**CRITICAL:** Raw logs (`logs` table) are NEVER modified. All food entries, bowel movements, fluid logs, habit logs, and timestamps remain untouched. The evidence pipeline reads raw logs and computes results fresh.

### Tables being DELETED (game layer)

| Table                 | Reason                                                             |
| --------------------- | ------------------------------------------------------------------ |
| `stationDefinitions`  | Built on wrong 6-line/10-stage taxonomy with wrong canonical names |
| `ingredientTemplates` | 107 seed entries unreconciled with the 95-entry registry           |
| `trialSessions`       | Game trial tracking — UI was deleted in Phase 2.5                  |
| `gameState`           | Aggregate game state — orphaned, no UI consumer                    |

### Tables being KEPT

| Table                 | Reason                                                                            |
| --------------------- | --------------------------------------------------------------------------------- |
| `logs`                | Sacred raw data — never touched                                                   |
| `foodTrialSummary`    | Bayesian engine output — actively used by Patterns + Menu                         |
| `foodAssessments`     | AI assessment data — actively used                                                |
| `foodLibrary`         | User's food library — actively used                                               |
| `ingredientOverrides` | Manual user overrides (safe/watch/avoid) — clean, useful concept, wire in Phase 5 |
| `ingredientExposures` | Per-ingredient exposure tracking from food logs — useful data                     |
| `ingredientProfiles`  | Ingredient metadata — useful reference data                                       |

---

## Task 1: Delete game layer Convex modules

**Files:**

- Delete: `convex/stationDefinitions.ts`
- Delete: `convex/ingredientTemplates.ts`
- Delete: `convex/trialSessions.ts`
- Delete: `convex/gameState.ts`
- Delete: `convex/data/ingredientTemplatesSeed.ts`
- Delete: `convex/trialSessions.test.ts`

**Step 1: Delete the 6 files**

Remove all 6 files listed above.

**Step 2: Run typecheck to see what breaks**

Run: `bun run typecheck 2>&1 | head -50`
Expected: Errors in `convex/schema.ts`, `convex/validators.ts`, `convex/logs.ts`, `convex/migrations.ts`, `src/lib/sync.ts`, `src/pages/Patterns.tsx`, etc.

These errors guide the remaining tasks. Do NOT fix them yet — they will be addressed in Tasks 2-6.

**Step 3: Commit (partial — will error until remaining tasks complete)**

Do NOT commit yet. Continue to Task 2.

---

## Task 2: Clean up Convex schema and validators

**Files:**

- Modify: `convex/schema.ts`
- Modify: `convex/validators.ts`

**Step 1: Remove game layer tables from schema**

In `convex/schema.ts`, delete these table definitions:

- `stationDefinitions` (line ~351)
- `ingredientTemplates` (line ~386)
- `trialSessions` (line ~332)
- `gameState` (line ~373)

Also remove the `trialSessionId` optional field from the `logs` table (line ~60):

```typescript
trialSessionId: v.optional(v.id("trialSessions")),
```

Also remove the import of `lineCategoryValidator` (line ~15).

**Step 2: Remove game layer validators**

In `convex/validators.ts`, delete:

- `lineCategoryValidator` definition (line ~283)
- `gameStateValidator` definition (line ~341)
- Any station/template validator definitions that reference the deleted tables

**Step 3: Run typecheck**

Run: `bun run typecheck 2>&1 | head -30`
Expected: Fewer errors — schema/validator ones should be gone. Remaining errors in `logs.ts`, `migrations.ts`, `sync.ts`, `Patterns.tsx`.

---

## Task 3: Clean up backup/restore and migrations

**Files:**

- Modify: `convex/logs.ts`
- Modify: `convex/migrations.ts`

**Step 1: Remove game layer from backup/restore in `convex/logs.ts`**

- Remove `"stationDefinitions"`, `"trialSessions"`, `"gameState"` from the `USER_DATA_TABLES` array (line ~968-970)
- Remove all restore logic for these 3 tables from `restoreFromBackup` mutation. This includes:
  - Station definition restore block (line ~1361-1399)
  - Trial session restore block with ID mapping (line ~1481-1515)
  - Game state restore block (line ~1401-1419)
  - `lineCategory` validation and the default-to-`"carb"` fallback
- Make the restore logic silently skip unknown table keys in backup data (so old backups that include station data don't crash — just ignore those keys)

**Step 2: Remove game layer migration from `convex/migrations.ts`**

Delete the `initializeGameStateForExistingUsers` migration function (line ~1301-1394) and any related helper code. This bootstrapped stations and gameState from templates — no longer needed.

**Step 3: Run typecheck**

Run: `bun run typecheck 2>&1 | head -30`

---

## Task 4: Delete client-side game layer code

**Files:**

- Delete: `src/lib/trialEngine.ts`
- Delete: `src/lib/trialEngine.test.ts`
- Modify: `src/lib/sync.ts` — delete game layer hooks
- Modify: `src/types/domain.ts` — delete game layer types
- Modify: `src/lib/foodStatusThresholds.ts` — delete `legacyStageToZone`
- Modify: `src/components/patterns/database/columns.tsx` — remove game layer fields
- Modify: `src/components/patterns/database/TrialHistorySubRow.tsx` — remove `TrialSession` import
- Modify: `src/components/patterns/database/index.ts` — remove re-exports if needed

**Step 1: Delete `trialEngine.ts` and `trialEngine.test.ts`**

**Step 2: Delete game layer hooks from `src/lib/sync.ts`**

Delete these hook definitions:

- `useStationsByLine` (~line 586)
- `useStation` (~line 592)
- `useInitializeStations` (~line 596)
- `useBackfillStations` (~line 601)
- `useAllStations` (~line 582)
- `useGameState` (~line 625)
- `useInitializeGame` (~line 630)
- `useGameTrialCooldown` (~line 635)
- `useIngredientTemplates` (~line 640)
- `useIngredientTemplatesByProfile` (~line 644)
- `useSeedTemplates` (~line 651)
- `useIngredientOverrides` (~line 392) — **KEEP this one** (or re-check: it's unused now but the table stays)
- `useSetIngredientOverride` (~line 396) — **KEEP this one**
- `useClearIngredientOverride` (~line 406) — **KEEP this one**

Also delete trial session hooks:

- `useActiveFoodTrials` (~line 529)
- `useTrialsByStation` (~line 533)
- `useRecentTrials` (~line 537)
- `useStartFoodTrial` (~line 541)
- `useCompleteFoodTrial` (~line 561)

Remove any related imports from the api object and `asConvexId<"trialSessions">` cast.

**Step 3: Delete game layer types from `src/types/domain.ts`**

Delete the entire "Game layer types" section (lines ~372-435):

- `StationState` type
- `TrialSessionStatus` type
- `StationDefinition` interface
- `TrialSession` interface
- `GameState` interface
- `IngredientTemplate` interface

**Step 4: Delete `legacyStageToZone` from `src/lib/foodStatusThresholds.ts`**

Delete the `legacyStageToZone` function (line ~97-100). Keep everything else (thresholds, Bristol math, `Zone` type, `clampZone`, `computeBristolAverage`, `classifyConsistency`).

**Step 5: Remove game layer fields from `columns.tsx`**

In `src/components/patterns/database/columns.tsx`, remove from the `FoodDatabaseRow` interface:

- `stationId?: string`
- `preparationMethod?: string`
- `stationState?: StationState`
- `pointsValue?: number`

Remove the `StationState` import from `@/types/domain`.
Remove the `preparationMethod` rendering in the food name cell.
Remove `stationId`, `preparationMethod`, `stationState`, `pointsValue` from `buildFoodDatabaseRow`.

**Keep:** `stage?: number` (renamed concept — this is now the zone from registry), `foodGroup`, `overrideStatus`, `overrideNote`.

**Step 6: Remove `TrialSession` import from `TrialHistorySubRow.tsx`**

Remove the `import type { TrialSession }` line and the `trials?: TrialSession[]` prop. The component only uses `LocalTrialRecord` data from the analysis engine.

Update the `TrialHistorySubRowProps` interface to remove the `trials` prop.

Remove any code paths that use the `trials` prop (check the component body for branches that render `TrialSession` data vs `LocalTrialRecord` data).

**Step 7: Run typecheck**

Run: `bun run typecheck 2>&1 | head -30`
Expected: Errors in `Patterns.tsx` (uses deleted hooks/types). Fixed in Task 5.

---

## Task 5: Update Patterns.tsx and Menu.tsx

**Files:**

- Modify: `src/pages/Patterns.tsx`
- Modify: `src/pages/secondary_pages/Menu.tsx` (if it uses game layer)

**Step 1: Update Patterns.tsx**

Remove:

- Imports: `useAllStations`, `useBackfillStations`, `useGameState`, `StationDefinition`, `legacyStageToZone`
- The `allStations` variable and `useAllStations()` call
- The `gameState` variable and `useGameState()` call
- The `backfillStations` function and `useBackfillStations()` call
- The entire backfill `useEffect` block (~lines 433-462)
- The `stationMap` construction (~lines 466-469)
- The `station` lookup in the `databaseRows` mapping (~line 494)

Replace the zone computation (line ~498):

```typescript
// Before:
const zone = station
  ? legacyStageToZone(station.stage)
  : (getFoodZone(stat.key) ?? 3);

// After:
const zone = getFoodZone(stat.key) ?? 3;
```

Remove station fields from the `buildFoodDatabaseRow` call (~lines 510-515):

```typescript
// Delete these lines:
...(station !== undefined && {
  stationId: station.stationId,
  preparationMethod: station.preparationMethod,
  stationState: station.state,
  pointsValue: station.pointsValue,
}),
```

**Step 2: Verify Menu.tsx**

Check that `Menu.tsx` does not use any game layer imports. It uses `useAllFoodTrials` which reads `foodTrialSummary` — that stays.

**Step 3: Run typecheck and build**

Run: `bun run typecheck && bun run build 2>&1 | tail -10`
Expected: Clean. All game layer references should be resolved.

**Step 4: Run tests**

Run: `bun test 2>&1 | tail -20`
Expected: `trialSessions.test.ts` gone (deleted). `trialEngine.test.ts` gone (deleted). `logs.test.ts` may need updates if it references game layer tables in test fixtures. Food system tests (33) should still pass.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete game layer (stations, templates, trials, gameState)

The game layer was built on the old 6-line/10-stage taxonomy with wrong
canonical names. The UI was deleted in Phase 2.5. Backend tables and
code were orphaned. Phase 5 will rebuild the transit map from scratch
on the new 4-group/11-line registry.

Deleted: stationDefinitions, ingredientTemplates, trialSessions,
gameState tables + all Convex modules, seed data, trialEngine,
game layer hooks, game layer types, legacyStageToZone.

Kept: raw logs, foodTrialSummary, foodAssessments, foodLibrary,
ingredientOverrides, ingredientExposures, ingredientProfiles.

Patterns.tsx zone column now uses getFoodZone() from registry (correct)
instead of legacyStageToZone(station.stage) (broken)."
```

---

## Task 6: Create `shared/` directory and move shared code

**Files:**

- Create: `shared/foodEvidence.ts` (moved from `src/lib/foodEvidence.ts`)
- Create: `shared/foodNormalize.ts` (moved from `src/lib/foodNormalize.ts`)
- Create: `shared/foodCanonicalization.ts` (moved from `src/lib/foodCanonicalization.ts`)
- Create: `shared/foodRegistry.ts` (moved from `src/lib/foodRegistry.ts`)
- Modify: `tsconfig.json` — add `shared/` path alias
- Modify: `vite.config.ts` — add `shared/` resolve alias
- Modify: All consumers — update import paths

**Step 1: Research Convex import resolution**

Before moving files, verify that Convex can import from `../shared/`. Run a quick test:

Create a minimal test file `shared/_test.ts` with `export const TEST = 1;`, then try importing it from a Convex file. If Convex bundling fails, we need an alternative approach (keep files in `src/lib/` — current working state — and accept the boundary crossing until Convex supports external imports).

**If Convex CANNOT import from `../shared/`:** Skip this entire task. Keep files in `src/lib/`. The cross-boundary import works today and is a cosmetic issue, not a correctness issue. Document as deferred.

**If Convex CAN import from `../shared/`:** Proceed with steps 2-6.

**Step 2: Create `shared/` directory**

```bash
mkdir -p shared
```

**Step 3: Move the 4 files**

Move (preserving git history with `git mv`):

```bash
git mv src/lib/foodRegistry.ts shared/foodRegistry.ts
git mv src/lib/foodCanonicalization.ts shared/foodCanonicalization.ts
git mv src/lib/foodNormalize.ts shared/foodNormalize.ts
git mv src/lib/foodEvidence.ts shared/foodEvidence.ts
```

**Step 4: Add path alias**

In `tsconfig.json`, add to `paths`:

```json
"@shared/*": ["./shared/*"]
```

In `vite.config.ts`, add to `resolve.alias`:

```typescript
"@shared": path.resolve(__dirname, "shared"),
```

**Step 5: Update ALL import paths**

Search for every import of the moved files and update:

Client-side (`src/`):

- `@/lib/foodEvidence` → `@shared/foodEvidence`
- `@/lib/foodNormalize` → `@shared/foodNormalize`
- `@/lib/foodCanonicalization` → `@shared/foodCanonicalization`
- `@/lib/foodRegistry` → `@shared/foodRegistry`

Server-side (`convex/`):

- `"../src/lib/foodEvidence"` → `"../shared/foodEvidence"`
- `"../src/lib/foodNormalize"` → `"../shared/foodNormalize"`

Also update any intra-shared imports (e.g., `foodEvidence.ts` imports from `./foodCanonicalization` and `./foodNormalize` — these become relative within `shared/`).

**Step 6: Move the test file**

```bash
git mv src/lib/__tests__/foodEvidence.test.ts shared/__tests__/foodEvidence.test.ts
```

Update its imports. Ensure the test runner picks up tests in `shared/`.

Alternatively, keep the test in `src/lib/__tests__/` and update its import path. Choose whichever is simpler.

**Step 7: Run typecheck, build, and tests**

Run: `bun run typecheck && bun run build && bun test src/lib/__tests__/foodEvidence.test.ts src/lib/__tests__/foodCanonicalization.test.ts 2>&1 | tail -20`
Expected: Clean.

**Step 8: Commit**

```bash
git commit -m "refactor: move shared food system code to shared/ directory

foodRegistry.ts, foodCanonicalization.ts, foodNormalize.ts, and
foodEvidence.ts are used by both client (src/) and server (convex/).
Moving them to shared/ makes the cross-boundary dependency explicit
and eliminates the ../src/lib/ import from Convex files."
```

---

## Task 7: Unify normalization in Convex

**Files:**

- Modify: `convex/foodLibrary.ts`
- Modify: `convex/ingredientOverrides.ts`
- Modify: `convex/extractInsightData.ts`

**Step 1: Fix `convex/foodLibrary.ts`**

Delete the local `normalizeCanonicalName` function (line ~17).

Replace all uses of `normalizeCanonicalName(x)` and inline `x.toLowerCase().trim()` with:

```typescript
canonicalizeKnownFoodName(x) ?? normalizeFoodName(x);
```

Import from `shared/` (or `../shared/` or `../src/lib/` depending on Task 6 outcome):

```typescript
import { canonicalizeKnownFoodName } from "../shared/foodCanonicalization";
import { normalizeFoodName } from "../shared/foodNormalize";
```

Apply this pattern in:

- `addEntry` (line ~106)
- `updateEntry` (line ~139)
- `mergeDuplicates` — everywhere `normalizeCanonicalName` is called

**Step 2: Fix `convex/ingredientOverrides.ts`**

Delete the local `normalizeCanonicalName` function (line ~10).

Replace with the same registry+fallback pattern:

```typescript
import { canonicalizeKnownFoodName } from "../shared/foodCanonicalization";
import { normalizeFoodName } from "../shared/foodNormalize";

// In upsert and remove handlers:
const canonicalName =
  canonicalizeKnownFoodName(args.canonicalName) ??
  normalizeFoodName(args.canonicalName);
```

**Step 3: Fix `convex/extractInsightData.ts`**

This file already imports `normalizeFoodName` from `../src/lib/foodNormalize`. Update to also use registry canonicalization:

```typescript
import { canonicalizeKnownFoodName } from "../shared/foodCanonicalization";
import { normalizeFoodName } from "../shared/foodNormalize";

// Replace normalizeFoodName(x) with:
canonicalizeKnownFoodName(x) ?? normalizeFoodName(x);
```

**Step 4: Clean up `mergeDuplicates` in `foodLibrary.ts`**

The `mergeDuplicates` function renames canonical names across 8 tables. After deleting the game layer, the `stationDefinitions` references in this function are dead code. Remove them. Keep references to tables that still exist: `foodAssessments`, `ingredientExposures`, `ingredientOverrides`, `ingredientProfiles`, `foodLibrary`, `logs`, `foodTrialSummary`, `profiles`.

**Step 5: Run typecheck, build, and full test suite**

Run: `bun run typecheck && bun run build && bun test 2>&1 | tail -30`

**Step 6: Run lint**

Run: `bun run lint:fix`

**Step 7: Commit**

```bash
git commit -m "refactor: unify Convex normalization with registry canonicalization

Replace divergent normalizeCanonicalName() and inline toLowerCase().trim()
in foodLibrary.ts, ingredientOverrides.ts, and extractInsightData.ts with
canonicalizeKnownFoodName() + normalizeFoodName() fallback — the same
pattern used by the Bayesian evidence pipeline since Phase 3.

Clean up mergeDuplicates: remove dead stationDefinitions references."
```

---

## Task 8: Update documentation and verify

**Files:**

- Modify: `docs/plans/food-system-rebuild.md`
- Modify: `docs/adrs/0002-food-registry-and-canonicalization.md`
- Modify: `docs/scratchpadprompts/transitmap.md`
- Modify: `.claude/skills/vite-react-implementer/SKILL.md` (remove station references)
- Modify: `docs/FEATURE_STATUS.md` (update game layer status)

**Step 1: Update all docs**

These will be updated as part of this planning session (see separate commits).

**Step 2: Final verification**

Run:

```bash
bun run typecheck && bun run build && bun test 2>&1 | tail -30
```

Verify:

- 0 typecheck errors
- Build succeeds
- Food system tests (33) pass
- No references to deleted game layer code remain (grep for `stationDefinitions`, `ingredientTemplates`, `trialSessions`, `gameState`, `lineCategoryValidator`, `legacyStageToZone`, `StationDefinition`, `StationState`, `TrialSession`, `IngredientTemplate`)

---

## Deferred to Phase 5

These items are explicitly NOT part of Phase 4:

| Item                                                                              | Reason                                                                                       |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --- | ---------------------------------- |
| Transit map UI rebuild                                                            | Phase 5 — design doc exists at `docs/plans/transit-map-and-reward-model.md`                  |
| Game layer rebuild (stations, trials, points, streaks)                            | Phase 5 — will be designed from scratch on the 4-group/11-line registry                      |
| `buildFoodEvidenceResult` consolidation (runs in 4 places)                        | Separate optimisation — not a correctness issue                                              |
| `analyzeLogs` shared context (PERF-001/004)                                       | Separate optimisation — Patterns + Menu duplicate it                                         |
| `ingredientOverrides` UI wiring                                                   | Phase 5 — backend stays, hooks stay, UI doesn't exist yet                                    |
| Schema cleanup of legacy verdict values (`"culprit"`, `"next_to_try"`)            | Low priority — mapped at read time, historical data still has these values                   |
| `SyncedLogsContext` transit calibration server-side migration                     | Separate optimisation — currently runs full Bayesian engine client-side just for calibration |
| `Zone` type consolidation (`foodStatusThresholds.ts` vs `FoodZone` from registry) | Minor — both are `1                                                                          | 2   | 3`, can be unified when convenient |
