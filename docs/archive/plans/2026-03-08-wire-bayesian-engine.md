# Wire Bayesian Food Evidence Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify the Bayesian food scoring engine (`foodEvidence.ts`) with the UI-facing analysis pipeline (`analysis.ts`) so that food statuses reflect AI assessments, habit modifiers, and learned transit calibration.

**Architecture:** `buildFoodEvidenceResult()` already exists and produces correct Bayesian scores. `analyzeLogs()` already calls it but passes only `{ logs }`, missing habits, calibration, and AI assessments. We add a Convex query for assessments, thread the missing parameters through, and remove dead code.

**Tech Stack:** React 19, Convex, Zustand, TypeScript

---

## Current State

- `foodEvidence.ts` (703 lines) - Complete Bayesian engine with recency decay, modifier signals, AI verdict weighting, transit calibration learning. Tested.
- `analyzeLogs()` in `analysis.ts` (line 196) - Already calls `buildFoodEvidenceResult({ logs })` but missing 3 inputs:
  - `habits` - needed for modifier calculation (smoking/stimulant/activity detection)
  - `calibration` - learned transit windows from store (instead of hardcoded 8h/14h/18h)
  - `assessments` - AI verdict history from Convex `foodAssessments` table
- `SyncedLogsContext` already has `habits` and `transitCalibration` from the store
- Convex `foodAssessments` table exists with `allFoods` query, but no hook to fetch raw assessment records for the evidence engine

## What This Changes

After wiring:

- Toast with 26/27 safe trials + 1 bad trial = **"safe"** (Bayesian posterior ~0.93)
- AI says "toast is culprit" = weighted against 26 safe trials = still **"safe"** (AI weight cancels out)
- Habit modifiers (smoking, coffee, stress) shift transit windows dynamically
- Transit windows learned from user's actual data instead of hardcoded 8h/14h/18h

---

### Task 1: Add Convex query for all assessment records

**Files:**

- Modify: `convex/foodAssessments.ts`
- Modify: `src/lib/sync.ts`

**Step 1: Add `allAssessmentRecords` query to Convex**

Add to `convex/foodAssessments.ts` after the existing `allFoods` query:

```typescript
// Get all raw assessment records for the evidence engine
export const allAssessmentRecords = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");
    const userId = identity.subject;
    const limit = Math.min(Math.max(args.limit ?? 500, 1), 1000);
    return await ctx.db
      .query("foodAssessments")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});
```

**Step 2: Add `useAllAssessmentRecords` hook to sync.ts**

Add to `src/lib/sync.ts` after the `useAllFoods()` hook:

```typescript
export function useAllAssessmentRecords() {
  return useQuery(api.foodAssessments.allAssessmentRecords, {});
}
```

**Step 3: Verify types**

Run: `bun run typecheck`
Expected: PASS (Convex codegen may need `npx convex dev` running)

**Step 4: Commit**

```bash
git add convex/foodAssessments.ts src/lib/sync.ts
git commit -m "feat: add allAssessmentRecords query for evidence engine"
```

---

### Task 2: Thread missing parameters through `analyzeLogs()`

**Files:**

- Modify: `src/lib/analysis.ts`

**Step 1: Expand `analyzeLogs` signature**

Change the function signature (line 185) to accept the new parameters:

```typescript
export function analyzeLogs(
  logs: SyncedLog[],
  fusedFoodSummaries: ReadonlyArray<
    {
      canonicalName: string;
    } & FusedFoodSummaryOverride
  > = [],
  evidenceInputs?: {
    habits?: Array<{ id: string; name: string }>;
    calibration?: import("@/lib/foodEvidence").TransitCalibration;
    assessments?: import("@/lib/foodEvidence").FoodAssessmentRecord[];
  },
): AnalysisResult {
```

**Step 2: Pass parameters to `buildFoodEvidenceResult`**

Change line 196 from:

```typescript
const fused = buildFoodEvidenceResult({ logs });
```

To:

```typescript
const fused = buildFoodEvidenceResult({
  logs,
  ...(evidenceInputs?.habits && { habits: evidenceInputs.habits }),
  ...(evidenceInputs?.calibration && {
    calibration: evidenceInputs.calibration,
  }),
  ...(evidenceInputs?.assessments && {
    assessments: evidenceInputs.assessments,
  }),
});
```

**Step 3: Verify types**

Run: `bun run typecheck`
Expected: PASS (signature is backwards-compatible via optional param)

**Step 4: Commit**

```bash
git add src/lib/analysis.ts
git commit -m "feat: thread habits, calibration, assessments through analyzeLogs"
```

---

### Task 3: Update callers to pass evidence inputs

**Files:**

- Modify: `src/pages/Patterns.tsx`
- Modify: `src/pages/Menu.tsx`

**Step 1: Update Patterns.tsx**

The page already has `habits` and `logs`. Add the assessment hook and transit calibration:

Near the top imports, add:

```typescript
import { useAllAssessmentRecords } from "@/lib/sync";
```

In the component body (near line 568), add:

```typescript
const assessmentRecords = useAllAssessmentRecords();
const transitCalibration = useStore((state) => state.transitCalibration);
```

Change the `analyzeLogs` call (line 580-582) from:

```typescript
const analysis = useMemo(
  () => analyzeLogs(logs, allFoodTrials ?? []),
  [allFoodTrials, logs],
);
```

To:

```typescript
const evidenceInputs = useMemo(
  () => ({
    habits: habits.map((h) => ({ id: h.id, name: h.name })),
    calibration: transitCalibration,
    assessments: assessmentRecords ?? undefined,
  }),
  [habits, transitCalibration, assessmentRecords],
);
const analysis = useMemo(
  () => analyzeLogs(logs, allFoodTrials ?? [], evidenceInputs),
  [allFoodTrials, evidenceInputs, logs],
);
```

**Step 2: Update Menu.tsx**

Same pattern. Add imports and pass evidence inputs.

Near imports, add:

```typescript
import { useAllAssessmentRecords } from "@/lib/sync";
import { useStore } from "@/store";
```

In the component body, add:

```typescript
const habits = useStore((state) => state.habits);
const transitCalibration = useStore((state) => state.transitCalibration);
const assessmentRecords = useAllAssessmentRecords();
```

Update the `analyzeLogs` call:

```typescript
const evidenceInputs = useMemo(
  () => ({
    habits: habits.map((h) => ({ id: h.id, name: h.name })),
    calibration: transitCalibration,
    assessments: assessmentRecords ?? undefined,
  }),
  [habits, transitCalibration, assessmentRecords],
);
const analysis = useMemo(
  () => analyzeLogs(logs, allFoodTrials ?? [], evidenceInputs),
  [allFoodTrials, evidenceInputs, logs],
);
```

**Step 3: Verify types**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/pages/Patterns.tsx src/pages/Menu.tsx
git commit -m "feat: pass evidence inputs to analyzeLogs in Patterns and Menu"
```

---

### Task 4: Remove dead code

**Files:**

- Modify: `src/lib/analysis.ts`

The old `buildFoodStats()` function (lines ~482-670) is dead code. It was the pre-Bayesian scorer that used simple threshold counting. It is no longer called from `analyzeLogs()`.

**Step 1: Identify dead code**

Search for any callers of `buildFoodStats` outside of its own definition:

```bash
grep -rn "buildFoodStats" src/ --include="*.ts" --include="*.tsx"
```

Expected: Only the function definition, no callers.

**Step 2: Remove `buildFoodStats` function**

Delete the entire `buildFoodStats()` function from `analysis.ts`.

**Step 3: Check for other dead helpers**

The old `resolveAllCorrelations()` function is still called on line 195 for `correlations` display (the last-20 food-to-bowel timeline). This is NOT dead code - keep it.

But check if any of these are now unused:

- Constants: `WINDOW_START_MINUTES`, `NORMAL_END_HOURS`, `SLOW_END_HOURS`, `VERY_SLOW_END_HOURS`
- Function: `outcomeFromTransitAndCategory()`

If they're only used by `buildFoodStats()` or `resolveAllCorrelations()`, check before removing.

**Step 4: Verify types and that nothing breaks**

Run: `bun run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/analysis.ts
git commit -m "refactor: remove dead buildFoodStats function from analysis.ts"
```

---

### Task 5: Verify the Bayesian engine produces correct results

**Files:**

- Read: `src/lib/__tests__/foodEvidence.test.ts`

**Step 1: Run existing tests**

```bash
bun run test -- --run src/lib/__tests__/foodEvidence.test.ts
```

Expected: All tests PASS. The existing test suite validates:

- Toast with 27 safe + 1 bad trial stays "safe"
- Food with only bad trials becomes "avoid"
- Learned transit calibration works

**Step 2: Verify the toast scenario manually**

After wiring, check in the browser:

1. Open the app, navigate to Patterns
2. Find a food with many safe trials and 1 bad trial
3. Verify it shows "safe" (not "watch" or "risky")
4. Check that the confidence score is > 0.75

**Step 3: Verify AI assessments are factored in**

In browser DevTools, check the analysis result:

1. Look for a food with AI assessments
2. Verify `aiScore` is non-zero
3. Verify `combinedScore` includes both code + AI signals

---

## Post-Wiring Architecture

```
SyncedLogsContext
  |
  +-- logs (Convex)
  +-- habits (Zustand)
  +-- transitCalibration (Zustand, learned from evidence engine)
  |
  v
analyzeLogs(logs, fusedFoodSummaries, { habits, calibration, assessments })
  |
  +-- buildFoodEvidenceResult({ logs, habits, calibration, assessments })
  |     |
  |     +-- resolveTrials() -- uses calibrated windows + modifier signals
  |     +-- Bayesian posterior = (positive + AI_safe) / (positive + negative + AI_avoid)
  |     +-- primaryStatusFromSignals() -- building/safe/watch/avoid
  |     +-- toLegacyFoodStatus() -- maps to 6 UI statuses
  |     +-- learnTransitCalibration() -- updates calibration from data
  |     |
  |     v
  |   FoodEvidenceSummary[] (Bayesian scores, AI scores, confidence)
  |
  +-- fusedFoodSummaries overrides (from Convex foodTrialSummary)
  |
  v
FoodStat[] (UI-facing, with Bayesian scores + legacy status labels)
```

## What's NOT in this plan (future work)

- Exposing transit calibration settings in the Settings UI
- Environmental factor weighting into food status (factors are analyzed but display-only)
- Syncing habit logs to Convex
- Expanding the food library to 100+ foods
- E2E tests for the analysis pipeline

---

## Verification Audit (2026-03-12)

**Status: FULLY EXECUTED — archiving.**

### Task-by-task verification

| Task | Description                                                              | Status | Evidence                                                                                                                      |
| ---- | ------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1    | Add `allAssessmentRecords` Convex query + `useAllAssessmentRecords` hook | DONE   | `convex/foodAssessments.ts` line 60, `src/lib/sync.ts` line 352                                                               |
| 2    | Thread `evidenceInputs` through `analyzeLogs()`                          | DONE   | `src/lib/analysis.ts` lines 182-199 — signature expanded, params threaded to `buildFoodEvidenceResult`                        |
| 3    | Update callers (Patterns + Menu) to pass evidence inputs                 | DONE   | `src/pages/Patterns.tsx` line 463, `src/pages/secondary_pages/Menu.tsx` line 268 — both pass habits, calibration, assessments |
| 4    | Remove dead `buildFoodStats` function                                    | DONE   | No references to `buildFoodStats` remain anywhere in `src/`                                                                   |
| 5    | Verify Bayesian engine tests                                             | N/A    | Manual/browser verification step, not code changes                                                                            |

### Notes

- The cloud-only migration (ADR-0001) moved habits and transit calibration from Zustand to Convex/profile hooks (`useHabits`, `useTransitCalibration`), which is a slight deviation from the plan's assumption that these came from Zustand. The wiring is correct regardless.
- The food system rebuild (Phases 1-4) builds on top of this wiring but does not supersede it. This plan was a prerequisite for Phase 3 (evidence pipeline).
- Future work items listed above remain unaddressed and are tracked elsewhere.
