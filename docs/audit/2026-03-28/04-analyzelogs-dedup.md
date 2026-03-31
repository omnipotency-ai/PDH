Perfect. Now I have all the information needed to provide a comprehensive report.

## WQ-094: `analyzeLogs` Deduplication Research Report

### 1. Both Call Locations

**Call 1: `src/pages/Patterns.tsx` (lines 461-469)**
```typescript
const analysis = useMemo(
  () =>
    analyzeLogs(logs, allFoodTrials ?? [], {
      habits: habits.map((h) => ({ id: h.id, name: h.name })),
      calibration: transitCalibration,
      assessments: mappedAssessments,
    }),
  [allFoodTrials, habits, transitCalibration, mappedAssessments, logs],
);
```

**Call 2: `src/pages/secondary_pages/Menu.tsx` (lines 218-226)**
```typescript
const analysis = useMemo(
  () =>
    analyzeLogs(logs, allFoodTrials ?? [], {
      habits: habits.map((h) => ({ id: h.id, name: h.name })),
      calibration: transitCalibration,
      assessments: mappedAssessments,
    }),
  [allFoodTrials, habits, transitCalibration, mappedAssessments, logs],
);
```

### 2. Shared Data

Both calls are **identical in structure**. They consume:
- `logs` (from `useSyncedLogsContext()`)
- `allFoodTrials` (from `useAllFoodTrials()`)
- `habits` (derived from `useHabits()`)
- `transitCalibration` (from `useTransitCalibration()`)
- `mappedAssessments` (from `useMappedAssessments()`)

The dependency arrays are also identical across both pages.

### 3. What `analyzeLogs` Does (Cost Analysis)

`src/lib/analysis.ts` is a **moderately expensive function** that:

1. Calls `buildFoodEvidenceResult()` — a Bayesian evidence pipeline that processes all logs to compute trial statistics, Bristol correlations, and transit times
2. Iterates through all food summaries to compute:
   - Average transit times (single pass)
   - Recent outcome counts (single pass)
   - Bristol breakdowns by code (accumulator pattern)
   - Status sorting (O(n log n))
3. Builds `resolvedTrialsByKey` map — reconstructs trial history per canonical food name

**Cost: O(n) in logs + O(m log m) in foodStats where m ≤ ~150 foods**

### 4. Existing Context/Hook Patterns

**Available contexts:**
- `SyncedLogsContext` — provides synced logs only (no analysis)
- `ProfileContext` — provides habits, calibration, etc. (no analysis)
- `ApiKeyContext` — API keys only

**No analysis context exists.** The two pages independently call `analyzeLogs`, then each uses the result differently:
- **Patterns.tsx**: Uses `foodStats` for database table rows + transit map
- **Menu.tsx**: Uses `foodStats` for zone sections and status filters

### 5. Recommended Dedup Approach: **Shared Hook (Preferred)**

**Best option:** Create `useAnalysisContext` hook that memoizes `analyzeLogs` output and provides stable references.

**Rationale:**
- **Lightweight**: No new provider boilerplate needed
- **Scope-aware**: Both pages already consume the same inputs (`logs`, `habits`, `calibration`, `assessments`)
- **Reusable**: Future pages can call the same hook
- **Single responsibility**: Analysis is a derived computation, not a shared state concern
- **Avoids over-engineering**: An AnalysisProvider would be overkill for what is just a memoization boundary

**Implementation files needed:**

1. **Create: `src/hooks/useAnalysis.ts`** (new file)
   ```typescript
   // Memoizes analyzeLogs with stable inputs from hooks
   // Returns: { foodStats, resolvedTrialsByKey }
   ```

2. **Update: `src/pages/Patterns.tsx`** 
   - Replace local `useMemo(analyzeLogs(...))` with `const analysis = useAnalysis()`

3. **Update: `src/pages/secondary_pages/Menu.tsx`**
   - Replace local `useMemo(analyzeLogs(...))` with `const analysis = useAnalysis()`

**Alternative (if needed later):**
- If analysis needs to be consumed by 3+ pages, consider promoting to `AnalysisContext` + provider wrapper in `routeTree.tsx` root (inside `SyncedLogsProvider`). But keep it in `src/hooks/` first.

### 6. Why NOT Other Approaches

| Approach | Why Not |
|----------|---------|
| **Lift to `routeTree.tsx`** | Only 2 pages use it; premature generalization |
| **AnalysisProvider + Context** | Adds provider boilerplate; hook is simpler |
| **Store state in Zustand** | Analysis is ephemeral UI state, not persistent |
| **Memoize in `SyncedLogsProvider`** | Couples analysis to logs context; breaks separation |

---

## Summary

**Duplicate calls identified**: Patterns.tsx (line 461) and Menu.tsx (line 218) — identical `analyzeLogs()` invocation with identical dependencies.

**Recommended solution**: Create `useAnalysis()` hook in `src/hooks/useAnalysis.ts` that internally calls the same `useMemo(analyzeLogs(...), [...])` pattern. Both pages consume the hook instead of reimplementing. This deduplicates computation while keeping the code simple and maintainable.