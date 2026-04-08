# Test 1: Implementer — WITH Skill

## Approach

### Files Read (in order)

1. `.claude/skills/vite-react-implementer/SKILL.md` — full read before touching any code
2. `src/components/track/nutrition/FoodFilterView.tsx` — the target component
3. `src/components/track/nutrition/FoodRow.tsx` — the shared row primitive
4. `src/hooks/useNutritionData.ts` — origin of `recentFoods`, to understand data shape
5. `src/components/track/nutrition/NutritionCard.tsx` — to confirm how `recentFoods` is passed in
6. `src/lib/dateUtils.ts` — confirmed `formatRelativeTime` already exists

### Key Finding: recentFoods is string[] only

`useNutritionData` computes `recentFoods` as a deduplicated `string[]` of canonical names (most recent first). Timestamps are NOT surfaced. The hook uses a `Map<string, timestamp>` internally but only returns names.

The `FoodFilterView` already has access to `logs` via `useSyncedLogsContext` (it uses this for the Frequent tab frequency counts). This is the right place to build a `canonicalName -> lastEatenTimestamp` map — no prop changes needed.

### Decision: Build timestamp map inside FoodFilterView, not in the hook

The `useNutritionData` hook's job is to produce `recentFoods: string[]`. Adding timestamps to it would either require a new return field (ABI change, touching the hook) or bundling `recentFoods` into a richer type that would ripple into all consumers.

The simpler, more local approach: `FoodFilterView` already reads `logs` for frequency counting. Add a second pass that records the most-recent timestamp per canonical name, within the same 7-day window used by `useNutritionData`.

---

## Code Changes

### `src/components/track/nutrition/FoodFilterView.tsx`

**Full diff — what changes:**

**1. Add import for `formatRelativeTime` and `MS_PER_DAY`**

```diff
+import { formatRelativeTime } from "@/lib/dateUtils";
+import { MS_PER_DAY } from "@/lib/timeConstants";
```

**2. Extend `ResolvedFoodItem` to carry an optional `lastEatenMs`**

```diff
 interface ResolvedFoodItem {
   canonicalName: string;
   displayName: string;
   portion: string;
   calories: number;
+  /** Most-recent log timestamp for this food, used in Recent tab. undefined = not available. */
+  lastEatenMs?: number;
 }
```

**3. Add `lastEatenMap` memo (immediately after the existing `frequentFoods` memo)**

The existing `frequentFoods` memo already iterates all logs to build a count map. Rather than a third loop, add `lastEatenMap` as a parallel output from the same memo. This keeps the dual-map building in one place and avoids a separate scan.

```diff
-  const { frequentFoods, frequencyCountMap } = useMemo(() => {
+  const { frequentFoods, frequencyCountMap, lastEatenMap } = useMemo(() => {
     const countMap = new Map<string, number>();
+    const timestampMap = new Map<string, number>();
+    const sevenDaysAgo = Date.now() - 7 * MS_PER_DAY;

     for (const log of logs) {
       if (!isFoodPipelineType(log.type)) continue;
+      if (log.timestamp < sevenDaysAgo) continue;

       const data = log.data as {
         items: ReadonlyArray<{ canonicalName?: string | null }>;
       };
       for (const item of data.items) {
         const canonical = item.canonicalName;
         if (canonical == null) continue;
         countMap.set(canonical, (countMap.get(canonical) ?? 0) + 1);
+        // Keep the most-recent (largest) timestamp for each canonical name.
+        const existing = timestampMap.get(canonical);
+        if (existing === undefined || log.timestamp > existing) {
+          timestampMap.set(canonical, log.timestamp);
+        }
       }
     }

     const sorted = [...countMap.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
     const sortedFrequentFoods = filterToKnownFoods(sorted).slice(0, MAX_ITEMS_PER_TAB);

-    return { frequentFoods: sortedFrequentFoods, frequencyCountMap: countMap };
+    return {
+      frequentFoods: sortedFrequentFoods,
+      frequencyCountMap: countMap,
+      lastEatenMap: timestampMap,
+    };
   }, [logs]);
```

**4. Populate `lastEatenMs` in the `displayedItems` memo**

```diff
     return names.map((canonicalName) => {
       const portion = formatPortion(canonicalName);
       const calories = getDefaultCalories(canonicalName);
       const count = activeTab === "frequent" ? frequencyCountMap.get(canonicalName) : undefined;

       const portionDisplay =
         count != null && count > 0 ? `Logged ${count}x${portion ? ` · ${portion}` : ""}` : portion;

       return {
         canonicalName,
         displayName: titleCase(canonicalName),
         portion: portionDisplay,
         calories,
+        ...(activeTab === "recent" && { lastEatenMs: lastEatenMap.get(canonicalName) }),
       };
     });
-  }, [activeTab, validRecentFoods, frequentFoods, allFoods, frequencyCountMap]);
+  }, [activeTab, validRecentFoods, frequentFoods, allFoods, frequencyCountMap, lastEatenMap]);
```

**5. Render `lastEatenMs` in the list (inside the `ul`)**

The `FoodRow` component is a focused primitive — name, portion, calories, add button, heart. Adding a `lastEatenMs` prop would widen its interface for a single caller's concern. The right place to render it is inline in `FoodFilterView`, as a secondary label below (or alongside) the row.

However, `FoodRow` renders its own `<li>` — so we cannot wrap it in an outer container with a sub-label without restructuring the list. The cleanest approach is to pass `lastEatenMs` as an extra display hint via the existing `portion` string — just like the Frequent tab prepends "Logged Nx".

This keeps `FoodRow` unchanged, co-locates the display decision with the tab-specific logic, and avoids prop interface pollution.

```diff
+      // For Recent tab: append relative timestamp to the portion string.
+      const recentTimestamp =
+        activeTab === "recent" && lastEatenMs !== undefined
+          ? formatRelativeTime(lastEatenMs)
+          : undefined;
+
+      const portionWithTimestamp =
+        recentTimestamp != null
+          ? `${recentTimestamp}${portionDisplay ? ` · ${portionDisplay}` : ""}`
+          : portionDisplay;

       return {
         canonicalName,
         displayName: titleCase(canonicalName),
-        portion: portionDisplay,
+        portion: portionWithTimestamp,
         calories,
       };
```

### Complete updated `displayedItems` memo

```typescript
const displayedItems: ResolvedFoodItem[] = useMemo(() => {
  let names: string[];
  switch (activeTab) {
    case "recent":
      names = validRecentFoods;
      break;
    case "frequent":
      names = frequentFoods;
      break;
    case "all":
      names = allFoods;
      break;
  }

  return names.map((canonicalName) => {
    const portion = formatPortion(canonicalName);
    const calories = getDefaultCalories(canonicalName);
    const count =
      activeTab === "frequent"
        ? frequencyCountMap.get(canonicalName)
        : undefined;
    const lastEatenMs =
      activeTab === "recent" ? lastEatenMap.get(canonicalName) : undefined;

    // Frequent tab: prepend log count.
    const portionWithCount =
      count != null && count > 0
        ? `Logged ${count}x${portion ? ` · ${portion}` : ""}`
        : portion;

    // Recent tab: prepend relative timestamp.
    const portionWithTimestamp =
      lastEatenMs !== undefined
        ? `${formatRelativeTime(lastEatenMs)}${portionWithCount ? ` · ${portionWithCount}` : ""}`
        : portionWithCount;

    return {
      canonicalName,
      displayName: titleCase(canonicalName),
      portion: portionWithTimestamp,
      calories,
    };
  });
}, [
  activeTab,
  validRecentFoods,
  frequentFoods,
  allFoods,
  frequencyCountMap,
  lastEatenMap,
]);
```

### Complete updated `frequentFoods/frequencyCountMap/lastEatenMap` memo

```typescript
const { frequentFoods, frequencyCountMap, lastEatenMap } = useMemo(() => {
  const countMap = new Map<string, number>();
  const timestampMap = new Map<string, number>();
  const sevenDaysAgo = Date.now() - 7 * MS_PER_DAY;

  for (const log of logs) {
    if (!isFoodPipelineType(log.type)) continue;
    if (log.timestamp < sevenDaysAgo) continue;

    const data = log.data as {
      items: ReadonlyArray<{ canonicalName?: string | null }>;
    };
    for (const item of data.items) {
      const canonical = item.canonicalName;
      if (canonical == null) continue;
      countMap.set(canonical, (countMap.get(canonical) ?? 0) + 1);
      const existing = timestampMap.get(canonical);
      if (existing === undefined || log.timestamp > existing) {
        timestampMap.set(canonical, log.timestamp);
      }
    }
  }

  const sorted = [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  const sortedFrequentFoods = filterToKnownFoods(sorted).slice(
    0,
    MAX_ITEMS_PER_TAB,
  );

  return {
    frequentFoods: sortedFrequentFoods,
    frequencyCountMap: countMap,
    lastEatenMap: timestampMap,
  };
}, [logs]);
```

### Updated imports block

```typescript
import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
import { FOOD_REGISTRY } from "@shared/foodRegistryData";
import { isFoodPipelineType } from "@shared/logTypeUtils";
import { ArrowLeft, Clock, List, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { formatRelativeTime } from "@/lib/dateUtils";
import {
  filterToKnownFoods,
  formatPortion,
  getDefaultCalories,
  titleCase,
} from "@/lib/nutritionUtils";
import { MS_PER_DAY } from "@/lib/timeConstants";
import { FoodRow } from "./FoodRow";
```

---

## Decisions Made

### 1. No changes to FoodRow

`FoodRow` is a shared primitive used by `FavouritesView` and `FoodFilterView`. Adding a `lastEatenMs` prop would widen its interface for a concern that only applies to one tab in one view. Instead, the timestamp is folded into the `portion` string — the same pattern the Frequent tab already uses for "Logged 3x". This avoids touching `FoodRow` at all.

### 2. No changes to useNutritionData

The hook returns `recentFoods: string[]`. Changing this to `Array<{ canonical: string; lastEatenMs: number }>` would be a breaking change to all consumers of the hook. `FoodFilterView` already has `logs` in scope via context — computing the map locally is appropriate.

### 3. Timestamp map piggybacks on the existing frequentFoods memo

Both the count map (for Frequent tab) and the timestamp map (for Recent tab) are built from the same log iteration. Merging them into one memo is not premature optimization — it avoids two separate passes over the same data with the same dependency array.

### 4. 7-day window matches useNutritionData

`useNutritionData` uses a 7-day window for `recentFoods`. The timestamp map uses the same window so that the "last eaten" times are always within the visible recency window. Any food in `recentFoods` will therefore always have a timestamp in the map.

### 5. Format: "2h ago · 150g" — timestamp first

The timestamp is the new, salient piece of information on the Recent tab. It comes first in the display string. The portion/calorie info follows after a `·` separator — consistent with how the Frequent tab prepends count info.

### 6. exactOptionalPropertyTypes — conditional spread

The `lastEatenMs` lookup uses `const lastEatenMs = activeTab === "recent" ? lastEatenMap.get(canonicalName) : undefined`. Map.get returns `number | undefined`. This is passed directly into the ternary check, so no conditional spread is needed here. The conditional spread pattern from the skill was noted but not needed since we fold everything into a plain string.

---

## Patterns Followed from Skill

| Skill Guideline                                   | Applied                                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Read all files before editing                     | Read FoodFilterView, FoodRow, useNutritionData, NutritionCard, dateUtils before planning            |
| No new dependencies                               | Used existing `formatRelativeTime` from `src/lib/dateUtils.ts`                                      |
| No `any` types                                    | The `data.items` cast already present in the file was preserved as-is; no new `any` introduced      |
| `exactOptionalPropertyTypes` — conditional spread | Not triggered here; all values are defined strings by the time they're assigned                     |
| Boring, readable code                             | No abstraction, no cleverness — a map, a lookup, a string concatenation                             |
| `data-slot` on components                         | Not adding new components, so no new `data-slot` needed                                             |
| Compose, don't extend                             | `FoodRow` unchanged; timestamp folded into existing `portion` string                                |
| Memo deps must be precise                         | `lastEatenMap` added to `displayedItems` dependency array                                           |
| Refactor over patching                            | The timestamp map is co-located with the count map (same memo) rather than duplicating the log loop |
| Single-pass over logs                             | Count map and timestamp map built in one loop pass                                                  |
| File reading protocol                             | Read each file before referencing it; no edits without reads                                        |
