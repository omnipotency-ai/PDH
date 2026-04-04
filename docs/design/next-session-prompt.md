# Next Session — Wire TODOs, PR, Review

## TL;DR

Three TODO stubs in `NutritionCard.tsx` need real wiring. Then commit, push, PR, and review. Agent prompts are pre-written below — dispatch immediately.

## Current State

- **Branch:** `feat/nutrition`
- **Last commit:** `43d3667` (W2-03+04+06)
- **Uncommitted:** CalorieDetailView extracted to own file (user directive). Commit this first.
- **All verification passes:** typecheck, build, 1357 tests, lint, format

## Step 1: Commit CalorieDetailView extraction

```
git add src/components/track/nutrition/CalorieDetailView.tsx src/components/track/nutrition/NutritionCard.tsx
git commit -m "refactor: extract CalorieDetailView to own file"
```

Include `.agents/skills/` files — they're from Codex and should be committed.

## Step 2: Dispatch 2 opus agents to wire TODOs

### Agent 1: Wire handleLogWater + handleDeleteLog

```
You are implementing two TODO stubs in NutritionCard.tsx. This is a food reintegration tracker app (PDH).

## TODO 1: handleLogWater (line ~499-505)

Current code:
  const handleLogWater = useCallback(
    (_amountMl: number) => {
      // TODO: wire to actual fluid logging (FluidSection pattern)
      dispatch({ type: "CLOSE_WATER_MODAL" });
    },
    [dispatch],
  );

Wire this to log a water entry via useAddSyncedLog. Pattern from useHabitLog.ts:
  const logId = await addSyncedLog({
    timestamp: Date.now(),
    type: "fluid",
    data: { items: [{ name: "Water", quantity: amountMl, unit: "ml" }] },
  });

After success: show toast ("Water Xml logged"), close modal.
On error: show error toast, keep modal open.

## TODO 2: handleDeleteLog (line ~565-567)

Current code:
  const handleDeleteLog = useCallback((_logId: string) => {
    // TODO: wire to useRemoveSyncedLog
  }, []);

Wire this to call useRemoveSyncedLog(logId). Pattern from Track.tsx line 85:
  const removeSyncedLog = useRemoveSyncedLog();
  // then: await removeSyncedLog(logId);

After success: show toast ("Entry deleted").
On error: show error toast.

## Files to read:
1. src/components/track/nutrition/NutritionCard.tsx — the file to modify
2. src/lib/syncLogs.ts — useAddSyncedLog, useRemoveSyncedLog exports
3. src/lib/sync.ts — re-exports from syncLogs

## Imports to add:
- import { toast } from "sonner";
- import { useAddSyncedLog, useRemoveSyncedLog } from "@/lib/sync";
- import { getErrorMessage } from "@/lib/errors";

## Constraints:
- Keep the existing dispatch calls (CLOSE_WATER_MODAL stays)
- Make handlers async
- Use getErrorMessage for error toasts (existing pattern)
- Run: bun run typecheck && bun run build && bun run test after changes
- Commit with message: "feat: wire handleLogWater and handleDeleteLog to Convex"
```

### Agent 2: Wire handleLogFood

```
You are implementing a TODO stub in NutritionCard.tsx. This is a food reintegration tracker app (PDH).

## TODO: handleLogFood (line ~552-555)

Current code:
  const handleLogFood = useCallback(() => {
    // TODO: wire to actual food logging pipeline
    dispatch({ type: "RESET_AFTER_LOG" });
  }, [dispatch]);

This is called when the user presses "Log Food" in the LogFoodModal (staging confirmation).
At this point, state.stagingItems contains StagedItem[] with:
  { id, canonicalName, displayName, portionG, calories, protein, carbs, fat, sugars, fiber, naturalUnit?, unitWeightG? }

Wire this to create a food log via useAddSyncedLog. The food log format is:
  await addSyncedLog({
    timestamp: Date.now(),
    type: "food",
    data: {
      items: state.stagingItems.map(item => ({
        canonicalName: item.canonicalName,
        parsedName: item.displayName,
        quantity: item.portionG,
        unit: "g",
      })),
    },
  });

After success: show toast ("N items logged"), dispatch RESET_AFTER_LOG.
On error: show error toast, do NOT reset staging (so user can retry).

## Files to read:
1. src/components/track/nutrition/NutritionCard.tsx — the file to modify
2. src/components/track/nutrition/useNutritionStore.ts — StagedItem type, state.stagingItems
3. src/lib/syncLogs.ts — useAddSyncedLog export
4. src/hooks/useFoodParsing.ts — reference for food log data shape

## Imports needed (if not already present from Agent 1):
- import { toast } from "sonner";
- import { useAddSyncedLog } from "@/lib/sync";
- import { getErrorMessage } from "@/lib/errors";

## Constraints:
- The handler needs access to state.stagingItems — it's already in scope via useNutritionStore
- Make handler async
- Keep RESET_AFTER_LOG dispatch but move it to success path only
- Run: bun run typecheck && bun run build && bun run test after changes
- Commit with message: "feat: wire handleLogFood to create food logs from staging"
```

## Step 3: After both agents complete, commit and PR

```bash
git push -u origin feat/nutrition
gh pr create --title "feat: Nutrition Card UI (Wave 2)" --body "$(cat <<'EOF'
## Summary
- NutritionCard with collapsed/expanded calorie detail views
- WaterModal (cyan ring, +/- 200ml, logs to Convex)
- LogFoodModal (staging confirmation with macro totals)
- CalorieDetailView (meal breakdown bar, macros, one-at-a-time accordions)
- FavouritesView + FoodFilterView (Recent|Frequent|Favourites|All tabs)
- All wired to useNutritionStore (useReducer) + useNutritionData (Convex)
- Delete, water logging, and food logging wired to Convex mutations

## Test plan
- [ ] Typecheck, build, 1357 unit tests pass
- [ ] Visual verification on localhost:3005
- [ ] Water modal: open, adjust amount, log → appears in today log
- [ ] Food staging: search → add → review in modal → log → appears in today log
- [ ] Delete: expand calorie detail → accordion → delete button removes entry
- [ ] Escape key returns to collapsed from any expanded view

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

## Step 4: Review PR with opus agents

Dispatch 2 opus agents in parallel reviewing the full PR diff (git diff main...HEAD):

1. **Code quality reviewer** — security, correctness, performance, React patterns, accessibility
2. **Architecture reviewer** — component boundaries, state management, data flow, future extensibility

## Spec Review Findings (from this session, already documented)

Issues to defer (not blocking PR):

- Match status indicators in LogFoodModal (decision says "parked for research")
- E2E tests for individual modals/views (defer to Wave 5)
- recentFoods not scoped to current meal slot (minor, data layer change)
- Dead code: waterAmount/SET_WATER_AMOUNT in store (cleanup task)
- Duplicate utils across FavouritesView/FoodFilterView (cleanup task)
- No food thumbnail in LogFoodModal (no image data available yet)

## Key files

| File                                                   | Purpose                                        |
| ------------------------------------------------------ | ---------------------------------------------- |
| `src/components/track/nutrition/NutritionCard.tsx`     | Main orchestrator (~550 lines)                 |
| `src/components/track/nutrition/CalorieDetailView.tsx` | Expanded view with breakdown/macros/accordions |
| `src/components/track/nutrition/WaterModal.tsx`        | Water logging modal                            |
| `src/components/track/nutrition/LogFoodModal.tsx`      | Staging confirmation modal                     |
| `src/components/track/nutrition/FavouritesView.tsx`    | Favourites list                                |
| `src/components/track/nutrition/FoodFilterView.tsx`    | Filter tabs (Recent/Frequent/Favourites/All)   |
| `src/components/track/nutrition/useNutritionStore.ts`  | UI state (useReducer + Fuse.js)                |
| `src/hooks/useNutritionData.ts`                        | Read-only Convex data                          |
| `src/hooks/useProfile.ts`                              | Nutrition goals + favourites                   |
