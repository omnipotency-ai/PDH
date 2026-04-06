# Security & Performance Audit — Group 4

**Audited:** 2026-04-06
**Scope:** src/components/track/ (dr-poo, nutrition, panels, quick-capture, today-log) + src/components/ui/ (Confetti, ErrorBoundary, Reassuring, SectionHeader, TimeInput, accordion, badge, base-ui-utils)

---

## Findings

---

### [HIGH] ADD_TO_STAGING aggregation path bypasses MAX_PORTION_G clamp

**Category:** Security (data integrity) / Performance
**Files:** `src/components/track/nutrition/useNutritionStore.ts:243-244`

**Description:**
The `ADJUST_STAGING_PORTION` reducer case correctly clamps `newPortionG` to `MAX_PORTION_G` (500g). However the `ADD_TO_STAGING` case — triggered every time a user taps the (+) button on an already-staged food — does not apply this clamp. Line 243 computes `newPortionG = existing.portionG + increment` and passes it directly to `recalculateMacros`, which accepts any positive value without an upper bound. Rapid repeated tapping can push a single item well above 500g (or 500ml for liquids), generating arbitrarily inflated macro and calorie totals that then get written to Convex as a log entry. This corrupts the user's nutrition data — which is the app's single most important correctness requirement.

**Suggested Fix:**

```ts
// In ADD_TO_STAGING, after computing newPortionG:
const newPortionG = Math.min(existing.portionG + increment, MAX_PORTION_G);
const updated = recalculateMacros(existing, newPortionG);
```

---

### [HIGH] `conversations.listByDateRange` fetches without a document limit

**Category:** Performance
**Files:** `convex/conversations.ts:118` (referenced from `src/components/track/dr-poo/ConversationPanel.tsx:34`)

**Description:**
`useConversationsByDateRange(halfWeekStartMs, STABLE_END)` passes `STABLE_END = 9_999_999_999_999` (year 2286) as the upper bound. The server-side `listByDateRange` query uses `.collect()` with no document limit. Over time, a user who sends many messages to Dr. Poo will cause this subscription to return an unbounded result set — all messages ever written from the last half-week boundary to the end of time. Convex has a 1MB document budget per query; hitting it causes a runtime error that crashes the panel. Even before that limit, large result sets increase subscription overhead and latency for every message the user sends.

**Suggested Fix:**
Add a `limit` argument to `listByDateRange` and apply `.take(limit)` before `.collect()` — matching the pattern used elsewhere in this file. Clamp at 500 messages. The client can pass a reasonable cap (200-500) rather than `STABLE_END`.

```ts
// convex/conversations.ts
const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);
const messages = await ctx.db
  .query("conversations")
  .withIndex("by_userId_timestamp", (q) =>
    q
      .eq("userId", userId)
      .gte("timestamp", args.startMs)
      .lte("timestamp", args.endMs),
  )
  .take(limit);
```

---

### [HIGH] AI-generated Markdown rendered with no explicit HTML sanitization

**Category:** Security (XSS)
**Files:** `src/components/track/dr-poo/ConversationPanel.tsx:133,182`

**Description:**
`react-markdown` is used to render AI-generated conversation content (`periodSummary.weeklySummary` and `msg.content`) with custom components from `AI_MARKDOWN_COMPONENTS`. `react-markdown` does not render raw HTML by default, which is protective. However the risk depends entirely on what `AI_MARKDOWN_COMPONENTS` does — if any component uses `dangerouslySetInnerHTML` or renders children as raw HTML, and the AI generates a markdown snippet that triggers it, user content could be injected. The codebase does not show `AI_MARKDOWN_COMPONENTS` using sanitization middleware (`rehype-sanitize`). Since the content originates from an LLM that processes user health data, a prompt injection attack (user types a message that manipulates the LLM to emit malicious markdown) is a realistic threat surface.

**Suggested Fix:**

1. Verify `AI_MARKDOWN_COMPONENTS` contains no `dangerouslySetInnerHTML` usage (confirm `src/lib/aiMarkdownComponents.tsx`).
2. Add `rehype-sanitize` as a rehype plugin to `react-markdown` on all AI content renders to enforce an allowlist of safe HTML elements regardless of what the LLM produces.

```tsx
import rehypeSanitize from "rehype-sanitize";
<Markdown rehypePlugins={[rehypeSanitize]} components={AI_MARKDOWN_COMPONENTS}>
  {msg.content}
</Markdown>;
```

---

### [MODERATE] `FoodFilterView` iterates the full 14-day logs array twice for the same frequency data

**Category:** Performance
**Files:** `src/components/track/nutrition/FoodFilterView.tsx:95-135`

**Description:**
`FoodFilterView` has two separate `useMemo` blocks — `frequentFoods` (lines 95-115) and `frequencyCountMap` (lines 118-135) — that both perform an identical full scan of the `logs` array from `useSyncedLogsContext`. The 14-day window can contain thousands of log entries. Both memos have identical dependency arrays (`[logs]`), so they run back-to-back whenever logs update, doubling the work. This is unnecessary — the frequency map is a superset of the sorted list. The count map can be computed once and the sorted list derived from it.

**Suggested Fix:**
Compute a single `frequencyData` memo that returns both `{ sortedFrequentFoods, countMap }`:

```ts
const frequencyData = useMemo(() => {
  const countMap = new Map<string, number>();
  for (const log of logs) {
    if (!isFoodPipelineType(log.type)) continue;
    const data = log.data as {
      items: ReadonlyArray<{ canonicalName?: string | null }>;
    };
    for (const item of data.items) {
      const canonical = item.canonicalName;
      if (canonical == null) continue;
      countMap.set(canonical, (countMap.get(canonical) ?? 0) + 1);
    }
  }
  const sorted = [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  return {
    countMap,
    sorted: filterToKnownFoods(sorted).slice(0, MAX_ITEMS_PER_TAB),
  };
}, [logs]);
```

---

### [MODERATE] `FoodSection.submitFood` — double-submit window between guard and `setSaving(true)`

**Category:** Security (data integrity)
**Files:** `src/components/track/panels/FoodSection.tsx:32-54`

**Description:**
`submitFood` is a synchronous function (not `async`). It guards against re-entry with `if (saving) return` at line 33, then clears the form (`setFoodName("")`, `reset()`), and only then calls `setSaving(true)` at line 54. In React 18 with concurrent rendering, two rapid synchronous invocations within the same event batch (e.g., pressing Enter on the input while simultaneously clicking the Log Food button) both pass the `if (saving) return` guard before either sets `saving = true`. The result is two identical log entries written to Convex for the same meal.

**Suggested Fix:**
Use a `useRef` as an immediate non-reactive guard, or move `setSaving(true)` to before the form clear. A ref-based guard fires synchronously without waiting for the next render cycle:

```ts
const submittingRef = useRef(false);
const submitFood = () => {
  if (submittingRef.current) return;
  submittingRef.current = true;
  // ... rest of logic
  onLogFood(...)
    .catch(...)
    .finally(() => {
      submittingRef.current = false;
      setSaving(false);
    });
};
```

---

### [MODERATE] `PanelTimePicker` computes `new Date()` and `format()` on every render

**Category:** Performance
**Files:** `src/components/track/panels/PanelTimePicker.tsx:34-37`

**Description:**
`PanelTimePicker` is rendered inside `BowelSection`, `FluidSection`, `FoodSection`, and `FoodSubRow` — all of which can re-render frequently as the user interacts with the form. On every render, the component calls `new Date()`, `format(now, "yyyy-MM-dd")`, and `format(now, "HH:mm")` unconditionally. These are used only as fallback placeholder values when `timeValue`/`dateValue` are empty — which is the initial state only. After the user interacts, these computed values are ignored entirely. The cost is small per call, but it runs for every keypress in any sibling input field because the parent re-renders.

**Suggested Fix:**
Move the default date/time computation into a `useMemo` that only recomputes when the popover opens, or use the `useState` initializer pattern:

```ts
const [defaultDateTime] = useState(() => {
  const now = new Date();
  return { date: format(now, "yyyy-MM-dd"), time: format(now, "HH:mm") };
});
```

---

### [MODERATE] `BowelSection.handleSave` is not wrapped in `useCallback` — stale closure risk

**Category:** Performance / Security (data integrity)
**Files:** `src/components/track/panels/BowelSection.tsx:206`

**Description:**
`handleSave` is declared as a bare `async` function inside the component body and is NOT memoized with `useCallback`. It closes over all of the component's state values (`bristolCode`, `urgencyTag`, `effortTag`, `accident`, `notes`, `trips`, `volumeTag`). Because `handleSave` is not stable, it is recreated on every render. This is passed to the `onClick` of the Log Button and referenced via `void handleSave()` in the notes field `onKeyDown`. If the component re-renders mid-save (e.g., a sibling state update during the async `onSave` call), the `finally` block's `setSaving(false)` references the stale closure and the reset operations may apply stale state values.

The more immediate concern is that `saving` is local state — if two rapid Enter keystrokes arrive before the first `setSaving(true)` has caused a re-render, both invocations of `handleSave` pass `if (bristolCode === null)` and execute in parallel.

**Suggested Fix:**
Wrap `handleSave` in `useCallback` with all its dependencies listed, or use the same `useRef` guard pattern described for `FoodSection`. Also add a guard `if (saving) return` at the top of `handleSave`.

---

### [MODERATE] `base-ui-utils.tsx` uses `any` type in public utility function

**Category:** Security (type safety)
**Files:** `src/components/ui/base-ui-utils.tsx:4`

**Description:**
`resolveRenderProps` accepts `props: any` and `state: any` in its function signature. This bypasses TypeScript's type system for all callers. The function is used by `Badge` and potentially other components. If a caller passes an object with a crafted `dangerouslySetInnerHTML` key via `render`, TypeScript will not catch it. While this is a low-severity vector in a SPA context, it contradicts the project's TypeScript strictness requirements and introduces an unchecked extension point.

**Suggested Fix:**
Type the parameters using `React.ComponentPropsWithRef<React.ElementType>` or a generic that constrains the accepted shape.

---

### [MODERATE] `useNutritionStore.createInitialState` calls `Date.now()` — resets meal slot on every store instantiation

**Category:** Performance / correctness
**Files:** `src/components/track/nutrition/useNutritionStore.ts:348`

**Description:**
`createInitialState` calls `getMealSlot(Date.now())` to set the initial `activeMealSlot`. This is passed as the initializer to `useReducer`. While `useReducer` only calls the initializer once (correct), if `NutritionCard` is unmounted and remounted (e.g., navigating away and back), the store is recreated and `getMealSlot` is called again. This is intentional behavior, but it means the meal slot silently changes during navigation. If the user had manually set a meal slot override before leaving and then returned, they would lose their override. This is a UX data-integrity issue rather than a crash risk.

More importantly: `getMealSlot(Date.now())` in `createInitialState` means the function is non-pure and depends on wall-clock time. This is acceptable in a React initializer but worth documenting so future refactors don't accidentally move it into a Convex mutation.

**Suggested Fix:**
Document the intentional time dependency with a comment. If manual overrides need to persist across navigation, store `activeMealSlot` in sessionStorage or Zustand ephemeral state rather than `useReducer`.

---

### [MODERATE] `conversations.listByDateRange` — `listByReport` does a full-table scan followed by in-memory filter

**Category:** Performance
**Files:** `convex/conversations.ts:91-102`

**Description:**
`listByReport` fetches all conversations matching `aiAnalysisId` using the `by_aiAnalysisId` index, then applies an in-memory `filter((m) => m.userId === userId)` for authorization. The comment notes this is intentional to avoid adding a compound index. For a single-user application this is low risk right now, but if the `aiAnalyses` index contains entries across users (no guarantee they are scoped by userId first), this query returns other users' data before filtering. If the `by_aiAnalysisId` index is not userId-scoped, a user who can guess or enumerate another user's `aiAnalysisId` could trigger a cross-user data read (though the in-memory filter prevents data return). More urgently: when the app becomes multi-user, this pattern is a privilege escalation vector waiting to happen.

**Suggested Fix:**
Add a compound index `by_aiAnalysisId_userId` or — simpler — filter at the query level:

```ts
.withIndex("by_aiAnalysisId", (q) => q.eq("aiAnalysisId", args.aiAnalysisId))
.filter((q) => q.eq(q.field("userId"), userId))
```

This is still not a true compound-index scan but keeps the authorization check server-side rather than in JS memory, and is a cleaner pattern.

---

### [MODERATE] `WeightTrendChart` — `progressPercent` can be unbounded (no cap on display)

**Category:** Performance / correctness
**Files:** `src/components/track/quick-capture/WeightTrendChart.tsx:140-143`

**Description:**
`progressPercent` is computed as `(achievedDelta / totalDelta) * 100` with `Math.max(0, ...)` applied but no upper cap beyond 100 for the progress bar rendering. The bar itself is clamped with `Math.min(progressPercent, 100)` on line 290, but the label on line 283 shows `Math.round(progressPercent)%` which can print large numbers (e.g., "247%") if a user overshoots their goal significantly. This can cause layout overflow in the narrow bar container on small screens. Not a security issue, but a minor display correctness problem.

**Suggested Fix:**
Cap the displayed percentage at a reasonable value (e.g., 200%) or change the label text when exceeded: `progressPercent > 100 ? "Target exceeded" : \`${Math.round(progressPercent)}%\``. The condition already checks `progressPercent > 100` on line 281, so this is a simple text-only fix on line 283.

---

### [MODERATE] `Confetti.tsx` — `onComplete` callback included in `useEffect` deps, causing re-trigger risk

**Category:** Performance
**Files:** `src/components/ui/Confetti.tsx:94`

**Description:**
The `useEffect` that triggers confetti particle generation includes `onComplete` in its dependency array. If the parent component passes an unstable (non-memoized) `onComplete` function — which is extremely common in inline arrow function props — the effect re-fires every time the parent re-renders, even when `active` is `false`. On the `active = false` branch, this calls `setParticles([])` which is benign, but if the parent re-renders while `active = true`, the effect cancels the existing timer and creates a new burst of particles, effectively restarting the animation mid-flight. This can cause unexpected repeated confetti or timer leaks.

**Suggested Fix:**
Separate the `onComplete` cleanup from the particle-generation effect, or use a `useRef` to hold the callback so it is not a dependency:

```ts
const onCompleteRef = useRef(onComplete);
useLayoutEffect(() => {
  onCompleteRef.current = onComplete;
}, [onComplete]);
// In the effect, call onCompleteRef.current() — stable dep, no re-trigger risk
```

---

### [NICE-TO-HAVE] `FoodSection.loadCustomFoodPresets` called inside `useEffect` with no cleanup — localStorage read on every mount

**Category:** Performance
**Files:** `src/components/track/panels/FoodSection.tsx:28-30`

**Description:**
`loadCustomFoodPresets()` reads and parses JSON from `localStorage` synchronously inside a `useEffect`. This fires on every mount of `FoodSection` (which can happen on tab switches). LocalStorage reads are synchronous and block the main thread. For the current data size (up to 12 presets, each small), the impact is negligible. However it is slightly inconsistent with the project's pattern of using a context or store for persistent UI preferences rather than raw localStorage reads in component effects.

**Suggested Fix:**
Move custom food presets to Zustand or a dedicated context so they are read once at app startup rather than on every panel mount.

---

### [NICE-TO-HAVE] `DR_POO_REPLY_MAX_LENGTH` enforced client-side only — no server-side length validation visible

**Category:** Security (defense in depth)
**Files:** `src/components/track/dr-poo/ReplyInput.tsx:8,99`

**Description:**
`DR_POO_REPLY_MAX_LENGTH = 2500` is enforced via the HTML `maxLength` attribute and a conditional toast. The `input` element prevents typing beyond 2500 characters in the UI. However there is no evidence that the Convex mutation that stores the reply validates the length server-side. A user bypassing the UI (curl, modified client) can send arbitrarily long strings to the backend. For a health tracking app storing medical notes, oversized strings can bloat the database and inflate AI analysis context windows unnecessarily.

**Suggested Fix:**
In the Convex mutation that persists pending replies, add a server-side validator: `v.string()` with a `.max(2500)` constraint, or use the `sanitizeRequiredText` helper already present elsewhere in the codebase with `INPUT_SAFETY_LIMITS`.

---

### [NICE-TO-HAVE] `BowelSection.notes` field has `maxLength={400}` but no client-side validation feedback

**Category:** Security (defense in depth)
**Files:** `src/components/track/panels/BowelSection.tsx:524`

**Description:**
The notes input has `maxLength={400}` which silently truncates at the browser level. There is no character counter or validation message — the user cannot tell when they are near the limit. Compare this to `ReplyInput.tsx` which shows a live character counter. Additionally, if the Convex mutation that saves bowel data does not enforce the 400-character limit server-side, bypassed clients can store longer strings.

**Suggested Fix:**
Add a character counter similar to `ReplyInput`. Verify the corresponding Convex mutation validates the notes field length server-side.

---

## Summary

| Severity     | Count  |
| ------------ | ------ |
| CRITICAL     | 0      |
| HIGH         | 3      |
| MODERATE     | 8      |
| NICE-TO-HAVE | 3      |
| **Total**    | **14** |

## Priority order for fixes

1. **F1 — ADD_TO_STAGING MAX_PORTION_G bypass** (HIGH): One-line fix, prevents data corruption in the most-used nutrition logging path.
2. **F2 — AI Markdown XSS surface** (HIGH): Add `rehype-sanitize` to all AI content renders — low effort, defense-in-depth against prompt injection.
3. **F3 — conversations.listByDateRange unbounded** (HIGH): Add `take(limit)` before `.collect()` — prevents subscription from crashing with Convex 1MB document budget exceeded.
4. **F4 — FoodSection double-submit** (MODERATE): `useRef` guard — prevents duplicate food logs from rapid Enter+button interactions.
5. **F5 — FoodFilterView double log scan** (MODERATE): Merge two identical log-scanning memos into one — halves CPU work on every log update.
6. **F6 — listByReport compound scan** (MODERATE): Authorization pattern improvement for multi-user readiness.
