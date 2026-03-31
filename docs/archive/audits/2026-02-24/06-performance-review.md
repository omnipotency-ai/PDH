# Performance Review: Caca Traca

**Date:** 2026-02-24
**Reviewer:** Performance Engineering (Claude Opus 4.6)
**Stack:** React 19 + TypeScript + Vite + Convex + Zustand + Tailwind CSS 4
**Architecture:** Offline-first (IndexedDB via Zustand) with Convex cloud sync

---

## Executive Summary

Caca Traca is a medium-sized personal health tracker with approximately 35 source files. The application functions well for a single-user tool, but contains several performance issues that will degrade the experience as data volume grows. The most critical problems are:

1. **Duplicate Convex subscriptions** fetching the same 1200-log dataset 5+ times simultaneously across components, multiplying network traffic and memory usage.
2. **Expensive `analyzeLogs()` computation re-running redundantly** on every component that calls it, with no caching or memoization boundary.
3. **No code splitting** -- the entire OpenAI SDK (~200KB) and all three pages are bundled in the initial load, even when AI features are not used.
4. **A monolithic Zustand store destructured without selectors** in Settings, causing full-page re-renders on any state change.

The good news: the codebase is well-structured, has proper `useMemo` usage in most places, uses WebP for header logos, and the Convex backend queries use proper indexes. Most findings are fixable with focused refactoring.

---

## Findings

### CRITICAL

#### C1. Duplicate `useSyncedLogs(1200)` Subscriptions Across Components

**Description:** The hook `useSyncedLogs(1200)` is called independently in 5 different components, each creating its own Convex reactive subscription:

- `TrackPage` (`src/pages/Track.tsx:65`)
- `useAiInsights` hook (`src/hooks/useAiInsights.ts:19`)
- `FoodSafetyDatabase` (`src/components/patterns/FoodSafetyDatabase.tsx:353`)
- `DaySummaryCard` (`src/components/patterns/DaySummaryCard.tsx:36`)
- `HabitsStreaksWeight` (`src/components/patterns/HabitsStreaksWeight.tsx:25`)

Additionally, `SettingsPage` calls `useSyncedLogs(600)`.

**Impact:** Each subscription independently queries the Convex backend and maintains its own copy of up to 1200 log records in memory. On the Patterns page alone, three components each hold 1200 logs. This creates ~3x the memory footprint needed and 3x the WebSocket traffic for reactive updates. Every time a log is added, all 5 subscriptions fire, each triggering their own re-render tree.

**Recommendation:** Lift the `useSyncedLogs(1200)` call to the page level (or a shared context/provider) and pass logs down via props or React context. The Patterns page should fetch logs once and distribute them to `FoodSafetyDatabase`, `DaySummaryCard`, and `HabitsStreaksWeight`. Similarly, `useAiInsights` should receive logs via a ref or parameter rather than creating its own subscription.

---

#### C2. Redundant `analyzeLogs()` Computation

**Description:** The expensive `analyzeLogs()` function is called independently in two components with the same input:

- `TrackPage` (`src/pages/Track.tsx:119`): `const analysis = useMemo(() => analyzeLogs(logs), [logs])`
- `FoodSafetyDatabase` (`src/components/patterns/FoodSafetyDatabase.tsx:356`): `const analysis = useMemo(() => analyzeLogs(logs), [logs])`

The `analyzeLogs()` function in `src/lib/analysis.ts` performs O(n\*m) correlation resolution between food trials and digestive events, multiple full array sorts, five separate `foodStats.filter()` calls, and a full factor analysis. For 1200 logs with hundreds of food items, this is computationally significant.

**Impact:** On the Track page, this runs on every log addition. On the Patterns page, it runs redundantly in `FoodSafetyDatabase` despite the parent page having access to the same data. The computation is duplicated across pages and not cached across navigations.

**Recommendation:**

1. Move analysis into a shared context or custom hook that caches results by log identity.
2. Consider a web worker for `analyzeLogs()` if the log count exceeds ~500 items, to avoid blocking the main thread.
3. Use structural sharing or a hash of the logs array to avoid recomputation when logs haven't actually changed (Convex reactive queries may fire with the same data).

---

#### C3. No Code Splitting or Lazy Loading

**Description:** All three pages (`Track`, `Patterns`, `Settings`) and all their dependencies are eagerly imported in `App.tsx` (lines 14-16):

```typescript
import PatternsPage from "./pages/Patterns";
import SettingsPage from "./pages/Settings";
import TrackPage from "./pages/Track";
```

The OpenAI SDK (`openai` package, ~200KB minified) is imported at the top level in `src/lib/aiAnalysis.ts:1` and `src/lib/foodParsing.ts:1`, meaning it is included in the initial bundle even when the user has no API key configured.

**Impact:** The initial JavaScript bundle includes code for all pages and the full OpenAI SDK. For a mobile-first health tracking app, this significantly increases Time to Interactive (TTI). Users spend most of their time on the Track page; the Patterns and Settings pages should be lazy-loaded.

**Recommendation:**

1. Use `React.lazy()` and `<Suspense>` for route-level code splitting:
   ```typescript
   const PatternsPage = React.lazy(() => import("./pages/Patterns"));
   const SettingsPage = React.lazy(() => import("./pages/Settings"));
   ```
2. Dynamically import the OpenAI SDK only when an API key is present and an AI operation is triggered:
   ```typescript
   const OpenAI = (await import("openai")).default;
   ```
3. Configure Vite `build.rollupOptions.output.manualChunks` to separate vendor chunks (convex, motion, date-fns, openai, papaparse).

---

### HIGH

#### H1. Zustand Store Destructured Without Selectors in Settings

**Description:** In `src/pages/Settings.tsx:44-66`, the entire store is destructured in a single call:

```typescript
const {
  syncKey,
  setSyncKey,
  openAiApiKey,
  setOpenAiApiKey,
  unitSystem,
  setUnitSystem,
  habits,
  addHabit,
  removeHabit,
  setHabits,
  updateHabit,
  fluidPresets,
  addFluidPreset,
  removeFluidPreset,
  setFluidPresets,
  gamification,
  setGamificationSettings,
  sleepGoal,
  setSleepGoal,
  healthProfile,
  setHealthProfile,
} = useStore();
```

**Impact:** This subscribes the entire Settings page to every state change in the store. When `aiAnalysisStatus` changes (e.g., during a background AI analysis triggered from the Track page), the Settings page re-renders completely even though it uses none of those AI-related fields. Every keystroke in any input field triggers `setHealthProfile` or similar, which triggers a re-render of the entire page.

**Recommendation:** Use individual selectors for each piece of state:

```typescript
const syncKey = useStore((s) => s.syncKey);
const setSyncKey = useStore((s) => s.setSyncKey);
// ... etc.
```

Zustand's selector pattern ensures components only re-render when the specific slice they subscribe to changes.

---

#### H2. `useCelebration` Hook Subscribes to Entire Gamification Object

**Description:** In `src/hooks/useCelebration.ts:19`:

```typescript
const gamification = useStore((s) => s.gamification);
```

The `gamification` object contains `streakCount`, `totalEntries`, `earnedBadges`, and other fields. Every call to `recordLogEntry()` (which runs on every log save) mutates the gamification object, causing a new object reference and triggering a re-render of any component using `useCelebration`.

**Impact:** The `useCelebration` hook is used in `TrackPage`, which is the most performance-sensitive page. Every log entry causes the celebration hook to re-render even when only `totalEntries` changed and no celebration is warranted.

**Recommendation:** Select only the specific fields needed:

```typescript
const soundEnabled = useStore((s) => s.gamification.soundEnabled);
const confettiEnabled = useStore((s) => s.gamification.confettiEnabled);
```

---

#### H3. `useAiInsights` Hook Subscribes to 7 Separate Store Selectors

**Description:** In `src/hooks/useAiInsights.ts:12-17`, the hook creates 6 individual store subscriptions plus its own `useSyncedLogs(1200)` subscription. While individual selectors are used (which is good), the hook also maintains refs that are updated on every render:

```typescript
const logs = useSyncedLogs(1200);
const logsRef = useRef<SyncedLog[]>(logs);
logsRef.current = logs; // runs every render
```

Combined with C1 (duplicate subscription), this hook creates significant overhead.

**Impact:** The `useAiInsights` hook is instantiated in `TrackPage` and creates its own independent Convex subscription for 1200 logs, duplicating the subscription that `TrackPage` itself already has.

**Recommendation:** Accept logs as a parameter or ref from the parent component instead of creating an independent subscription. Consider consolidating store selectors into a single selector that returns a stable object using `useStore` with a shallow equality check.

---

#### H4. Google Fonts Blocking Initial Render

**Description:** In `index.html` (lines 7-12), three Google Font families are loaded synchronously:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Bricolage+Grotesque:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

While `display=swap` is used (good), the CSS file itself is render-blocking. Three font families with multiple weights means downloading significant font data before First Contentful Paint.

**Impact:** On slow mobile connections, this can add 500ms-2s to First Contentful Paint. The `preconnect` hints help but don't eliminate the blocking CSS request.

**Recommendation:**

1. Self-host the fonts and include them in the build (eliminates the external request entirely).
2. Alternatively, load fonts asynchronously:
   ```html
   <link
     rel="preload"
     as="style"
     href="..."
     onload="this.onload=null;this.rel='stylesheet'"
   />
   ```
3. Reduce font weights: Do you actually need 5 weights for Nunito and Bricolage Grotesque? Remove unused weights.

---

#### H5. Large Uncompressed PNG Assets in `/public/icons/`

**Description:** The `public/icons/` directory contains several large PNG files that are never converted to modern formats:

| File                                     | Size   |
| ---------------------------------------- | ------ |
| `app-store-1024x1024.png`                | 1.0 MB |
| `play-store-512x512.png`                 | 348 KB |
| `icon-512x512.png`                       | 348 KB |
| `og-image-1200x630.png`                  | 224 KB |
| `icon-384x384.png`                       | 220 KB |
| `caca_traca_transparent_logo_small.webp` | 133 KB |

**Impact:** While these are not loaded on every page view (they are for app manifests and social sharing), the 1MB app-store PNG and 348KB play-store PNG are unnecessarily large. The `caca_traca_transparent_logo_small.webp` at 133KB is referenced nowhere in the codebase and may be dead weight.

**Recommendation:**

1. Convert all PNGs to WebP or AVIF where possible (especially icons used in manifests).
2. Use appropriate compression for app store icons (most app stores re-compress anyway).
3. Remove `caca_traca_transparent_logo_small.webp` if unused.
4. The header logo correctly uses WebP at 2.8KB -- this is good practice to follow for other assets.

---

### MEDIUM

#### M1. `analyzeLogs()` Has O(n\*m) Correlation Algorithm

**Description:** The `resolveAllCorrelations()` function in `src/lib/analysis.ts:259-301` iterates over every bowel event and, for each event, filters all food trials to find unresolved candidates:

```typescript
for (const bowelEvent of sortedEvents) {
  const candidates = foodTrials.filter(
    (trial) => !resolvedIds.has(trial.id) && trial.timestamp <= eatByTimestamp,
  );
  // ...
}
```

**Impact:** With 200 food trials and 100 bowel events, this performs ~20,000 comparisons. As the user accumulates months of data (1200 logs could have 300+ food trials and 200+ bowel events), this becomes noticeable. Currently mitigated by the 1200-log limit.

**Recommendation:**

1. Sort food trials by timestamp and use binary search to find the cutoff point instead of filtering the entire array.
2. Maintain a pointer index into the sorted food trials array rather than re-scanning from the beginning for each bowel event.
3. Consider pre-indexing by resolvedIds using a Set for O(1) lookups (already done) but also pre-filtering resolved items.

---

#### M2. Multiple `Array.filter()` Passes in `analyzeLogs()` Return Value

**Description:** In `src/lib/analysis.ts:127-132`, six separate filter passes run over `foodStats`:

```typescript
const safeFoods = foodStats.filter((stat) => stat.status === "safe");
const safeLooseFoods = foodStats.filter((stat) => stat.status === "safe-loose");
const safeHardFoods = foodStats.filter((stat) => stat.status === "safe-hard");
const watchFoods = foodStats.filter((stat) => stat.status === "watch");
const riskyFoods = foodStats.filter((stat) => stat.status === "risky");
const testingFoods = foodStats.filter((stat) => stat.status === "testing");
```

**Impact:** This iterates over the food stats array 6 times. While each individual pass is fast, a single-pass grouping would be more efficient.

**Recommendation:** Use a single pass with a Map or switch:

```typescript
const groups = Map.groupBy(foodStats, (stat) => stat.status);
```

---

#### M3. `motion/react` (Framer Motion) Imported Eagerly for Confetti and Animations

**Description:** The `motion` library (~40-60KB gzipped) is imported in multiple components:

- `src/components/Confetti.tsx:1` (AnimatePresence, motion)
- `src/components/track/BowelSection.tsx:13` (AnimatePresence, motion)
- `src/components/track/TodayLog.tsx:17` (AnimatePresence, motion)

**Impact:** The entire motion library is included in the initial bundle. The Confetti component is only rendered during celebrations (rare events). BowelSection animations are nice-to-have but not critical path.

**Recommendation:**

1. The `Confetti` component should be dynamically imported since it is conditionally rendered.
2. Consider whether `motion` can be replaced with CSS animations for simpler cases (the BowelSection expand/collapse and TodayLog chevron rotation).
3. At minimum, use `motion/react` tree-shakeable imports (which is already done -- good).

---

#### M4. `ObservationWindow` Timer Runs Every 30 Seconds

**Description:** In `src/components/track/ObservationWindow.tsx:53-56`:

```typescript
useEffect(() => {
  const timer = window.setInterval(() => setNow(Date.now()), 30_000);
  return () => window.clearInterval(timer);
}, []);
```

This causes a re-render every 30 seconds, which triggers the `pendingFoods` useMemo recalculation.

**Impact:** While 30 seconds is reasonable for a food observation timer, combined with the fact that `logs` (1200 items) is passed as a prop and filtered in the memo, this creates periodic work even when the user isn't actively watching. The memo does proper filtering, but the parent `TrackPage` also re-renders due to its own 60-second timer, meaning the component can re-render more frequently than intended.

**Recommendation:** This is acceptable for the current use case but consider:

1. Increasing the interval to 60 seconds to match the parent timer.
2. Using `requestAnimationFrame` with a visibility check to pause when the tab is backgrounded.
3. Using `document.hidden` to skip updates when the page is not visible.

---

#### M5. `TrackPage` Has Two Independent Timers

**Description:** In `src/pages/Track.tsx:86-89` and `App.tsx:105-108`, there are two separate 60-second interval timers that call `setNow(new Date())`. The Track page timer drives date calculations, while the App header timer drives the date display.

**Impact:** Two independent timers create two separate re-render cycles per minute. The Track page timer triggers recalculation of `todayStart`, `todayEnd`, `todayLogs`, `selectedLogs`, `todayHabitCounts`, and `analysis`.

**Recommendation:** The timer in TrackPage should check if the date has actually changed before triggering state updates:

```typescript
useEffect(() => {
  const timer = window.setInterval(() => {
    const next = new Date();
    if (startOfDay(next).getTime() !== startOfDay(now).getTime()) {
      setNow(next);
    }
  }, 60 * 1000);
  return () => window.clearInterval(timer);
}, [now]);
```

This eliminates 1439 of the 1440 daily re-renders from this timer (only triggers at midnight).

---

#### M6. `papaparse` Bundled for Export-Only Feature

**Description:** The `papaparse` library is imported in `src/pages/Settings.tsx:18`:

```typescript
import Papa from "papaparse";
```

This library is only used for CSV export (`handleExport` function, line 100), which is an infrequently used feature.

**Impact:** `papaparse` is ~20KB minified and included in the initial bundle. It's only used when the user explicitly clicks "Export CSV".

**Recommendation:** Dynamic import when the user triggers export:

```typescript
const handleExport = async (type: "csv" | "json") => {
  if (type === "csv") {
    const Papa = (await import("papaparse")).default;
    // ...
  }
};
```

---

#### M7. OpenAI Client Instantiated on Every Call

**Description:** In both `src/lib/aiAnalysis.ts:529` and `src/lib/foodParsing.ts:191`:

```typescript
const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
```

A new OpenAI client is created on every function call.

**Impact:** Minor overhead per call, but the OpenAI client may initialize internal state, HTTP agents, or configuration parsing on each instantiation.

**Recommendation:** Cache the client instance and only recreate when the API key changes:

```typescript
let cachedClient: OpenAI | null = null;
let cachedKey = "";

function getClient(apiKey: string): OpenAI {
  if (cachedClient && cachedKey === apiKey) return cachedClient;
  cachedKey = apiKey;
  cachedClient = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  return cachedClient;
}
```

---

#### M8. `date-fns` Functions Used Without Tree Shaking Awareness

**Description:** Various `date-fns` functions are imported from the top-level module:

```typescript
import { format, startOfDay, addDays } from "date-fns";
```

This is used correctly for tree shaking in modern bundlers with ESM support (date-fns v4 supports this). However, `date-fns` is imported in 9+ files across the codebase.

**Impact:** date-fns v4 with Vite should tree-shake correctly, so this is not a significant issue. Verified that the import pattern is correct.

**Recommendation:** No action needed -- current usage is correct for tree shaking with Vite and date-fns v4.

---

#### M9. No Debouncing on Settings Input Fields

**Description:** In `src/pages/Settings.tsx`, every keystroke in text inputs immediately calls Zustand setters:

```typescript
onChange={(e) => setHealthProfile({ medications: e.target.value })}
```

Combined with H1 (full store subscription), every keystroke triggers: Zustand state update -> IndexedDB persist -> full Settings page re-render.

**Impact:** On slower devices, rapid typing in the medications textarea could cause noticeable lag. The IndexedDB persistence on every keystroke is unnecessary I/O.

**Recommendation:**

1. Use local component state for text inputs and sync to the store on blur or after a debounce period.
2. The Zustand `persist` middleware's `partialize` option could also help by excluding frequently-changing fields from immediate persistence.

---

### LOW

#### L1. Confetti Creates 35 DOM Nodes Per Celebration

**Description:** In `src/components/Confetti.tsx:33-44`, each celebration spawns 35 particles, each as an absolutely positioned `motion.div` element.

**Impact:** 35 animated DOM nodes with `willChange: "transform, opacity"` is within acceptable limits for a celebration effect. The 2-second cleanup timer is properly implemented.

**Recommendation:** No immediate action needed. If celebrations happen frequently (they shouldn't), consider reducing the particle count or using Canvas/WebGL.

---

#### L2. Inline `style` Props on Buttons in `FluidSection` and `QuickFactors`

**Description:** Both `FluidSection` and `QuickFactors` use inline `onMouseEnter`/`onMouseLeave` handlers to swap CSS properties:

```typescript
onMouseEnter={(e) => {
  e.currentTarget.style.background = "var(--section-quick-muted)";
  e.currentTarget.style.borderColor = "rgba(251,191,36,0.4)";
}}
```

**Impact:** Creates new function objects on every render. Minor but worth noting -- this pattern bypasses React's declarative model and could cause style flickering.

**Recommendation:** Replace with CSS `:hover` pseudo-class or Tailwind `hover:` utilities. This eliminates both the event listener overhead and the function allocation:

```tsx
className =
  "... hover:bg-[var(--section-quick-muted)] hover:border-amber-400/40";
```

---

#### L3. `BristolBadge` Performs `Array.find()` on Every Render

**Description:** In `src/components/BristolScale.tsx:311`:

```typescript
const option = BRISTOL_SCALE.find((b) => b.value === code);
```

**Impact:** The BRISTOL_SCALE array has only 7 elements, so the find is negligible. However, this component is rendered per-log-entry in the TodayLog.

**Recommendation:** Convert `BRISTOL_SCALE` to a `Map<number, BristolOption>` for O(1) lookup. Very low priority.

---

#### L4. `foodLibrary.listBySyncKey` Uses `.collect()` Without Limit

**Description:** In `convex/foodLibrary.ts:13`:

```typescript
const rows = await ctx.db
  .query("foodLibrary")
  .withIndex("by_syncKey", (q) => q.eq("syncKey", args.syncKey))
  .collect();
```

**Impact:** As the food library grows, this query returns all entries without a limit. For a personal tracker, this is unlikely to exceed a few hundred entries, but it's unbounded.

**Recommendation:** Add a reasonable limit (e.g., `.take(1000)`) to prevent unexpected growth from causing issues.

---

#### L5. `ReportArchive` Fetches 50 AI Analysis Records

**Description:** In `src/components/patterns/ReportArchive.tsx:155`:

```typescript
const aiHistory = useAiAnalysisHistory(50);
```

Each record includes the full `insight` object, `request` (full prompt), and `response` (full AI output).

**Impact:** 50 full AI analysis records with request/response payloads could be several hundred KB of data transmitted over WebSocket. The `listBySyncKey` query in `convex/aiAnalyses.ts` already strips `request` and `response` from the return value (good), but still returns full `insight` objects for all 50 records.

**Recommendation:** Consider pagination or virtual scrolling for the report archive instead of fetching all 50 at once. Alternatively, fetch summaries first and load full details on expand.

---

#### L6. `MealPlanSection` and `NextFoodCard` Fetch 20 Records Each

**Description:** Both `MealPlanSection` and `NextFoodCard` independently call `useAiAnalysisHistory(20)`, creating two separate Convex subscriptions for the same data.

**Impact:** Duplicate subscriptions for the same query. Minor since these are on the same page and Convex may deduplicate identical queries, but the components iterate through the results independently.

**Recommendation:** Lift the `useAiAnalysisHistory` call to the Patterns page and pass the data down.

---

#### L7. `GEMINI_API_KEY` Exposed via `process.env.GEMINI_API_KEY` in Bundle

**Description:** In `vite.config.ts:14`:

```typescript
'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
```

This defines the Gemini API key as a build-time constant that gets inlined into the JavaScript bundle.

**Impact:** This is a security concern rather than a performance issue, but it means the API key is visible in the built JavaScript. The key appears unused in the current codebase (only OpenAI is used).

**Recommendation:** Remove this define if the Gemini API key is not used. If it is needed in the future, use a server-side proxy or Convex action to keep the key server-side.

---

## Performance Budget Recommendations

| Metric                            | Target               | Notes                                              |
| --------------------------------- | -------------------- | -------------------------------------------------- |
| **Initial JS Bundle**             | < 200 KB gzipped     | Currently estimated at 350-450 KB with OpenAI SDK  |
| **First Contentful Paint**        | < 1.5s on 4G         | Blocked by Google Fonts; self-hosting would help   |
| **Time to Interactive**           | < 3.0s on 4G         | Code splitting would reduce this significantly     |
| **Largest Contentful Paint**      | < 2.5s               | Header logo is already small WebP (2.8 KB)         |
| **Convex Subscriptions per page** | <= 3                 | Currently 5+ on Track page                         |
| **Memory per page**               | < 15 MB              | Duplicate log arrays inflate this                  |
| **`analyzeLogs()` execution**     | < 50ms for 1200 logs | Should be profiled; consider web worker if > 100ms |

---

## Quick Wins (Effort vs Impact)

Ranked by impact-to-effort ratio:

1. **Lazy load `Patterns` and `Settings` pages** (C3 partial fix) -- 10 minutes, large bundle reduction
2. **Dynamic import OpenAI SDK** (C3 partial fix) -- 15 minutes, ~200KB off initial bundle
3. **Fix Settings destructuring** (H1) -- 20 minutes, eliminates unnecessary re-renders
4. **Lift `useSyncedLogs` to page level on Patterns** (C1 partial fix) -- 30 minutes, eliminates 2 duplicate subscriptions
5. **Dynamic import papaparse** (M6) -- 5 minutes, ~20KB off initial bundle
6. **Replace inline mouse handlers with CSS hover** (L2) -- 15 minutes, cleaner code
7. **Optimize TrackPage timer to only trigger on date change** (M5) -- 10 minutes, eliminates 1439 daily re-renders
8. **Cache OpenAI client instance** (M7) -- 10 minutes, minor performance gain
9. **Self-host Google Fonts** (H4) -- 30 minutes, eliminates external render-blocking request
10. **Dynamic import Confetti component** (M3 partial fix) -- 5 minutes, reduces initial bundle

---

## Overall Performance Assessment

**Rating: 6/10 -- Functional but not optimized**

The application works correctly and is well-architected for a personal health tracker. The code is clean, readable, and follows good React patterns in most places. However, it has grown organically without performance budgeting, resulting in several compounding issues:

**Strengths:**

- Proper use of `useMemo` in most computation-heavy areas
- Convex queries use appropriate indexes
- WebP format for actively-used images
- Zustand selectors used correctly in most components (Track page, AI insights, etc.)
- Convex backend query response shapes strip unnecessary fields
- Animation library uses tree-shakeable imports
- `idb-keyval` is a lightweight choice for IndexedDB access

**Weaknesses:**

- No code splitting at all -- the biggest single improvement opportunity
- Duplicate Convex subscriptions multiply network and memory costs
- Expensive analysis computation runs redundantly without cross-component caching
- Settings page is a re-render hotspot due to full store destructuring
- Build-time API key exposure in bundle
- Large unused PNG assets in public directory

The most impactful improvement would be implementing the three critical fixes (C1, C2, C3), which together would roughly halve the initial bundle size, eliminate duplicate network subscriptions, and prevent redundant computation. These three changes alone would likely bring the rating to 8/10.
