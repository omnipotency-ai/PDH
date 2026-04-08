# Test 1: Implementer — WITHOUT Skill

## Approach

Read the following files to understand the current state and available data:

1. `src/components/track/nutrition/FoodFilterView.tsx` — the target component
2. `src/hooks/useNutritionData.ts` — to understand what `recentFoods` contains and where timestamps live
3. `src/lib/syncCore.ts` — to confirm the `SyncedLog` type has a `timestamp: number` field
4. `src/components/track/nutrition/FoodRow.tsx` — to understand the shared row component's props
5. `src/components/track/nutrition/NutritionCard.tsx` — to see how `recentFoods` is passed in

**Key finding:** `recentFoods` (the prop) is a plain `string[]` — just canonical food names, deduplicated and sorted most-recent-first. It carries **no timestamp data**. Timestamps live in the raw `logs` from `useSyncedLogsContext`, which `FoodFilterView` already imports.

The approach is therefore:

- Build a `Map<canonicalName, timestamp>` from the logs inside `FoodFilterView` (similar to how it already builds `frequencyCountMap`)
- Add a `lastEatenMs` field to `ResolvedFoodItem`
- Render the relative timestamp in the Recent tab rows, using a small formatting helper

Rather than pass timestamps through the prop interface (which would require changing `NutritionCard` and `useNutritionData`), we derive it locally inside `FoodFilterView` using the `logs` it already has access to via `useSyncedLogsContext`. This keeps the prop interface stable.

---

## Code Changes

### 1. Add a `formatRelativeTime` helper (inline or in `nutritionUtils.ts`)

This is a simple pure function. I'd add it inline in `FoodFilterView.tsx` to keep the change self-contained, but it could equally live in `src/lib/nutritionUtils.ts`.

```ts
/**
 * Formats a past timestamp as a human-readable relative string.
 * e.g. "just now", "45m ago", "3h ago", "2 days ago"
 */
function formatRelativeTime(timestampMs: number, nowMs: number): string {
  const diffMs = nowMs - timestampMs;
  if (diffMs < 60_000) return "just now";
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
}
```

### 2. Extend `ResolvedFoodItem` to carry an optional timestamp

```ts
interface ResolvedFoodItem {
  canonicalName: string;
  displayName: string;
  portion: string;
  calories: number;
  /** Only populated on the Recent tab. Unix ms of most recent log containing this food. */
  lastEatenMs?: number;
}
```

### 3. Build a `lastEatenMap` in a new memo inside `FoodFilterView`

Add this memo after the existing `frequentFoods / frequencyCountMap` memo:

```ts
// Map from canonicalName → most recent log timestamp (ms).
// Used only on the Recent tab to show "last eaten" relative times.
const lastEatenMap = useMemo(() => {
  const map = new Map<string, number>();
  for (const log of logs) {
    if (!isFoodPipelineType(log.type)) continue;
    const data = log.data as {
      items: ReadonlyArray<{ canonicalName?: string | null }>;
    };
    for (const item of data.items) {
      const canonical = item.canonicalName;
      if (canonical == null) continue;
      // logs arrive most-recent-first; only record the first (newest) occurrence
      if (!map.has(canonical)) {
        map.set(canonical, log.timestamp);
      }
    }
  }
  return map;
}, [logs]);
```

> **Note on log ordering:** `SyncedLogsContext` fetches via `api.logs.listByRange`. Looking at `useNutritionData.ts` line 235, it comments "Logs arrive descending (most recent first) from Convex query." So iterating and taking the first hit per canonical name gives us the most recent timestamp efficiently.

### 4. Populate `lastEatenMs` in the `displayedItems` memo

Change the existing `displayedItems` memo to include `lastEatenMs` when on the `recent` tab:

```ts
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

    const portionDisplay =
      count != null && count > 0
        ? `Logged ${count}x${portion ? ` · ${portion}` : ""}`
        : portion;

    // NEW: capture last-eaten timestamp for Recent tab
    const lastEatenMs =
      activeTab === "recent" ? lastEatenMap.get(canonicalName) : undefined;

    return {
      canonicalName,
      displayName: titleCase(canonicalName),
      portion: portionDisplay,
      calories,
      lastEatenMs,
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

### 5. Render the relative timestamp in the Recent tab

The current render loop passes each item to `<FoodRow>`. `FoodRow` accepts a `portion` string for the metadata slot. The cleanest option is to **append the relative time to the `portion` string** using the existing `·` separator pattern that `FoodRow` already uses.

The alternative is adding a dedicated `FoodRow` prop, but that couples the shared component to a Recent-tab concern. Appending to `portion` is simpler and consistent with how `FoodRow` already renders metadata (see line 78-80 of `FoodRow.tsx`: `{portion}{portion && calories > 0 ? " · " : ""}{calories > 0 ? ...}`).

Change in the render section of `FoodFilterView`:

```tsx
// Near top of component, outside JSX (stable ref, won't change per render):
const nowMs = Date.now(); // captured once per render — acceptable for a list

// ...inside the map in JSX:
{
  displayedItems.map((item) => {
    const relativeTime =
      activeTab === "recent" && item.lastEatenMs != null
        ? formatRelativeTime(item.lastEatenMs, nowMs)
        : undefined;

    const portionWithTime =
      relativeTime != null
        ? item.portion
          ? `${item.portion} · ${relativeTime}`
          : relativeTime
        : item.portion;

    return (
      <FoodRow
        key={item.canonicalName}
        dataSlot="food-filter-row"
        canonicalName={item.canonicalName}
        displayName={item.displayName}
        portion={portionWithTime}
        calories={item.calories}
        isFavourite={favouriteSet.has(item.canonicalName)}
        onAdd={onAddToStaging}
      />
    );
  });
}
```

### Complete diff summary for `FoodFilterView.tsx`

```diff
 interface ResolvedFoodItem {
   canonicalName: string;
   displayName: string;
   portion: string;
   calories: number;
+  lastEatenMs?: number;
 }

+/**
+ * Formats a past timestamp as a human-readable relative string.
+ */
+function formatRelativeTime(timestampMs: number, nowMs: number): string {
+  const diffMs = nowMs - timestampMs;
+  if (diffMs < 60_000) return "just now";
+  const diffMins = Math.floor(diffMs / 60_000);
+  if (diffMins < 60) return `${diffMins}m ago`;
+  const diffHours = Math.floor(diffMins / 60);
+  if (diffHours < 24) return `${diffHours}h ago`;
+  const diffDays = Math.floor(diffHours / 24);
+  return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
+}

 export function FoodFilterView({ ... }) {
   const [activeTab, setActiveTab] = useState<FilterTab>("recent");
   const { logs } = useSyncedLogsContext();

   // ... existing allFoods, validRecentFoods, frequentFoods/frequencyCountMap memos ...

+  // Map from canonicalName → most recent log timestamp (ms).
+  const lastEatenMap = useMemo(() => {
+    const map = new Map<string, number>();
+    for (const log of logs) {
+      if (!isFoodPipelineType(log.type)) continue;
+      const data = log.data as {
+        items: ReadonlyArray<{ canonicalName?: string | null }>;
+      };
+      for (const item of data.items) {
+        const canonical = item.canonicalName;
+        if (canonical == null) continue;
+        if (!map.has(canonical)) {
+          map.set(canonical, log.timestamp);
+        }
+      }
+    }
+    return map;
+  }, [logs]);

   const displayedItems: ResolvedFoodItem[] = useMemo(() => {
     // ...existing logic...
     return names.map((canonicalName) => {
       // ...existing portion/calories/count logic...
+      const lastEatenMs = activeTab === "recent" ? lastEatenMap.get(canonicalName) : undefined;
       return {
         canonicalName,
         displayName: titleCase(canonicalName),
         portion: portionDisplay,
         calories,
+        lastEatenMs,
       };
     });
-  }, [activeTab, validRecentFoods, frequentFoods, allFoods, frequencyCountMap]);
+  }, [activeTab, validRecentFoods, frequentFoods, allFoods, frequencyCountMap, lastEatenMap]);

   // ... favouriteSet, tabCounts unchanged ...

+  const nowMs = Date.now();

   return (
     // ... header, tabs unchanged ...
     <ul className="space-y-1" aria-label={`${activeTab} foods`}>
-      {displayedItems.map((item) => (
-        <FoodRow
-          key={item.canonicalName}
-          dataSlot="food-filter-row"
-          canonicalName={item.canonicalName}
-          displayName={item.displayName}
-          portion={item.portion}
-          calories={item.calories}
-          isFavourite={favouriteSet.has(item.canonicalName)}
-          onAdd={onAddToStaging}
-        />
-      ))}
+      {displayedItems.map((item) => {
+        const relativeTime =
+          activeTab === "recent" && item.lastEatenMs != null
+            ? formatRelativeTime(item.lastEatenMs, nowMs)
+            : undefined;
+        const portionWithTime =
+          relativeTime != null
+            ? item.portion ? `${item.portion} · ${relativeTime}` : relativeTime
+            : item.portion;
+        return (
+          <FoodRow
+            key={item.canonicalName}
+            dataSlot="food-filter-row"
+            canonicalName={item.canonicalName}
+            displayName={item.displayName}
+            portion={portionWithTime}
+            calories={item.calories}
+            isFavourite={favouriteSet.has(item.canonicalName)}
+            onAdd={onAddToStaging}
+          />
+        );
+      })}
     </ul>
   );
 }
```

---

## Decisions Made

### 1. Derive timestamps locally inside `FoodFilterView`, not via the prop

`recentFoods` is a `string[]` with no timestamp data. The two options were:

- **(A)** Change the prop type to `Array<{ canonicalName: string; lastEatenMs: number }>` and update `useNutritionData` + `NutritionCard`
- **(B)** Derive `lastEatenMap` locally inside `FoodFilterView` using `logs` it already has

Option B is the least-invasive change. The component already imports `useSyncedLogsContext` and builds maps over `logs` (see `frequencyCountMap`). Adding one more `useMemo` over the same `logs` is consistent with the existing pattern and avoids touching the public prop API of a shared component.

### 2. Reuse the `portion` string slot in `FoodRow` rather than adding a new prop

`FoodRow` is a shared component also used by `FavouritesView`. Adding a `lastEatenAt` prop to it would couple a Recent-tab feature to a shared component. The `portion` field already renders secondary metadata with `·` separators; appending the relative time there is consistent and requires zero changes to `FoodRow`.

### 3. `nowMs` computed once per render, not inside the memo

The relative time text is display-only and changes at most every minute. Capturing `Date.now()` once at render time (outside the `useMemo`) means the text is stable for the full render pass. A live-updating clock (via `useCurrentMinute`) would be more correct but is out of scope for this task.

### 4. Logs assumed to arrive most-recent-first

The comment at `useNutritionData.ts:235` confirms "Logs arrive descending (most recent first) from Convex query." The `lastEatenMap` implementation relies on this: it takes `map.set(canonical, log.timestamp)` only if the key is not yet present (i.e., first/newest occurrence wins). If log ordering were ever ascending, this logic would need to be inverted to track the maximum.

### 5. No changes outside `FoodFilterView.tsx`

The only file changed is `src/components/track/nutrition/FoodFilterView.tsx`. No prop interface changes, no hook changes, no new files.
