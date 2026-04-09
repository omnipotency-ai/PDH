# Maintainability & Code Quality Audit — Group 5

**Date:** 2026-04-06
**Auditor:** Claude Sonnet 4.6
**Scope:** UI components, contexts, hooks, test files, index.css

---

## Findings

---

### [CRITICAL] Divergent getCelebration Implementations — Logic Bug

**Category:** Code Quality / Maintainability
**Files:** `src/hooks/useCelebrationTrigger.ts:34-73`, `src/lib/celebrations.ts:23-61`
**Description:**
`useCelebrationTrigger.ts` contains a hand-inlined copy of `getCelebration` (noted in a comment as "inlined from celebrations.ts") but the two implementations have diverged in a way that produces different behaviour:

- `celebrations.ts` uses `streak >= 7 && streak % 7 === 0` — fires for every 7-day multiple (7, 14, 21…).
- `useCelebrationTrigger.ts` uses `streak === 7` — fires only at exactly 7 days.

The milestone message in `useCelebrationTrigger.ts` also hard-codes "7 days straight", which will print the wrong number if the canonical version ever fires at 14 or 21 days. The `celebrations.ts` version correctly interpolates the streak count.

Because `useQuickCapture` → `useCelebrationTrigger` is the live code path used on the Track page, the canonical file (`celebrations.ts`) is effectively dead code while the in-file copy with the bugs is active.

**Suggested Fix:**
Delete the inlined private `getCelebration` from `useCelebrationTrigger.ts`. Import from `src/lib/celebrations.ts` directly:

```ts
import { getCelebration } from "@/lib/celebrations";
```

The comment header on `celebrations.ts` already declares `useQuickCapture.ts` as its sole consumer — update it to `useCelebrationTrigger.ts`. Then delete the dead duplicate.

---

### [CRITICAL] `dailyMessages[messageIndex]` Can Theoretically Return `undefined` — No Non-null Assertion or Fallback

**Category:** Code Quality
**Files:** `src/hooks/useCelebrationTrigger.ts:70`, `src/lib/celebrations.ts:59`
**Description:**
Both copies of `getCelebration` do:

```ts
const messageIndex = messageHash % dailyMessages.length;
// ...
message: dailyMessages[messageIndex],
```

The return type of `message` in `CelebrationConfig` is `string`, not `string | undefined`. TypeScript's standard array index access returns `T`, not `T | undefined`, so no compile error is raised. But the project should have `noUncheckedIndexedAccess` in mind — the `message` field in the callback eventually passes to `celebrateGoalComplete(message: string)`. If the array is ever accidentally emptied during a refactor, a runtime crash is inevitable.

**Suggested Fix:**
Add a non-null assertion with a safe fallback:

```ts
message: dailyMessages[messageIndex] ?? `${habit.name} goal done!`,
```

---

### [HIGH] `useQuickCapture` Returns `detailDaySummaries: []` — Permanently Empty Phantom Field in Public API

**Category:** Maintainability
**Files:** `src/hooks/useQuickCapture.ts:50-56`, `src/hooks/useQuickCapture.ts:133`
**Description:**
The `QuickCaptureResult` interface declares `detailDaySummaries` as a typed array field, but `useQuickCapture` always returns an empty array (`[]`) with a comment explaining it is "computed in Track.tsx". This means the public contract of the hook is permanently lying — consumers reading the type definition expect data; they always get nothing.

This is a maintainability trap: any future consumer of `useQuickCapture` who relies on `detailDaySummaries` from the hook return value will get silent empty data with no error.

**Suggested Fix:**
Remove `detailDaySummaries` from the `QuickCaptureResult` interface entirely. Track.tsx computes it independently via its own `useMemo`; it does not need to be part of the hook's return contract. Delete the dead interface field and the `detailDaySummaries: []` line from the return value.

---

### [HIGH] `useCelebration` Has Dead Module-Level Constants That Block Future Configuration

**Category:** Maintainability
**Files:** `src/hooks/useCelebration.ts:7-8`
**Description:**

```ts
const SOUND_ENABLED = true;
const CONFETTI_ENABLED = true;
```

The comment says preferences were removed and these should be re-introduced if needed. However, `celebrateGoalComplete` only fires sound/confetti inside conditionals gated by these constants — meaning the conditions are evaluated every call but can never be false. This is dead branching code: the `else` paths (L44-46, which call `toast.success`) are unreachable. Additionally, `celebrateLog` (L27) does not use these flags at all, creating inconsistent behaviour between log celebrations and goal celebrations.

**Suggested Fix:**
Remove the constants and simplify `celebrateGoalComplete` by removing the dead conditional branches, or restore them as user preferences passed in from context. Do not leave unreachable else branches in place.

---

### [HIGH] `useWeeklySummaryAutoTrigger` Hard-Codes a Specific City's Timezone in a Comment

**Category:** Maintainability
**Files:** `src/hooks/useWeeklySummaryAutoTrigger.ts:18`
**Description:**

```ts
 * Boundary hour for half-week periods (local time — Barcelona CET/CEST).
```

The code uses `new Date()` which produces the browser's local time — not Barcelona's time specifically. The comment implies a product decision to hard-code for a single user's timezone, which violates the CLAUDE.md rule "No Hard-Coding Personalization". If a second user in a different timezone ever uses this app, all half-week boundaries will fire at the wrong local time for them. The boundary logic is also undocumented as timezone-dependent in any user-facing way.

**Suggested Fix:**
If this is genuinely a known single-user constraint, document it clearly in a top-level comment and add a TODO. If it needs to generalise, replace local time usage with timezone-aware logic using the user's configured timezone from their profile. At minimum, the comment should not refer to a specific city.

---

### [HIGH] `responsive-shell.tsx` Has Two Body Wrapper Divs With Divergent Classes (Subtle Layout Bug)

**Category:** Code Quality
**Files:** `src/components/ui/responsive-shell.tsx:86-88`, `src/components/ui/responsive-shell.tsx:106-108`
**Description:**
The mobile path defines `drawerBody`:

```tsx
<div className={cn("min-h-0 shrink-0 overflow-y-auto", bodyClassName)}>
```

The tablet/desktop paths share `body`:

```tsx
<div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>
```

The difference is `shrink-0` vs `flex-1`. A drawer body should probably be `flex-1` (to fill available space in the flex column) not `shrink-0` (which prevents shrinking but doesn't grow). This means on mobile the drawer content may not scroll correctly when content is tall, while on tablet/desktop it does. The divergence is likely accidental — there is no comment justifying the difference.

**Suggested Fix:**
Audit the intended layout of the mobile drawer. If the body should fill remaining space, change `shrink-0` to `flex-1`. Extract the single `body` definition before all mode checks and reuse it, unless the layout genuinely differs by mode.

---

### [HIGH] Duplicated Activity Type Key Normalisation Function

**Category:** Maintainability
**Files:** `src/hooks/useDayStats.ts:38-46`, `src/hooks/useHabitLog.ts:68-77`
**Description:**
`useDayStats.ts` defines `toActivityTypeKey(value: string)` and `useHabitLog.ts` defines `toActivityType(habit: HabitConfig)`, both containing the same normalization logic:

```ts
key
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");
```

Both also have the `walk`/`walking` normalization special case. The logic is identical but the function signatures differ slightly (one takes a raw string, one takes a `HabitConfig`). Any future change to the normalization rules must be applied in two places. This has already caused a divergence: `toActivityType` handles `habitType === "sleep"` early, while `toActivityTypeKey` has no such check.

**Suggested Fix:**
Extract the core string normalization to a shared utility in `@/lib/activityTypeUtils.ts` (or similar). Both functions delegate to it. `toActivityType` can then be a thin wrapper that handles the `habitType === "sleep"` case before delegating.

---

### [HIGH] `PopoverTitle` is Typed as `ComponentProps<"h2">` but Rendered as `<div>`

**Category:** Code Quality
**Files:** `src/components/ui/popover.tsx:125-127`
**Description:**

```tsx
function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <div
      data-slot="popover-title"
      className={cn("font-medium", className)}
      {...props}
    />
  );
}
```

The function accepts `ComponentProps<"h2">` (which includes `h2`-specific ARIA and DOM attributes), but the underlying element is a `<div>`. This is a type lie — passing `h2`-specific attributes like `align` will silently be forwarded to a `<div>` where they are meaningless. It also produces incorrect semantic HTML — `PopoverTitle` should render a heading element. Compare with `PopoverDescription` which correctly uses `<p>` and types itself as `ComponentProps<"p">`.

**Suggested Fix:**
Either change the implementation to `<h2>` (preferred — better semantics), or change the type to `ComponentProps<"div">` if the div is intentional.

---

### [MODERATE] `"use client"` Directive on Files in a Vite/Client-SPA (Dead Directive)

**Category:** Maintainability
**Files:** `src/components/ui/date-picker.tsx:1`, `src/components/ui/switch.tsx:1`, `src/components/ui/tabs.tsx:1`, `src/components/ui/toggle-group.tsx:1`, `src/components/ui/toggle.tsx:1`, `src/components/ui/drawer.tsx:1`
**Description:**
`"use client"` is a React Server Components directive used in Next.js and similar RSC frameworks. This project is a Vite client-side SPA with no server rendering. The directive is completely inert — it is not processed by Vite and has no effect. Leaving it in creates false signals for contributors who may assume RSC patterns are in play.

Notably, many other UI files (`button.tsx`, `calendar.tsx`, `card.tsx`, etc.) do not have the directive, making the codebase inconsistent.

**Suggested Fix:**
Remove `"use client"` from all affected files. The project's stack (Vite + TanStack Router, not Next.js) does not use this directive.

---

### [MODERATE] `index.css` Dark Theme `--section-tracking` Uses RGBA With Opacity, Inconsistent With All Other Section Tokens

**Category:** Code Quality / Maintainability
**Files:** `src/index.css:236`
**Description:**
The dark theme defines:

```css
--section-tracking: rgba(249, 115, 22, 0.8);
```

Every other `--section-*` token in the dark theme uses a solid hex value (e.g., `--section-food: #ff7c64`). The `0.8` opacity means `--section-tracking` will appear differently when composited over any background that isn't the expected dark base, and it will look subtly wrong when used in the `glass-card-tracking` border-top rule. The light theme uses a solid value `#d97706`, making the dark theme inconsistent.

**Suggested Fix:**
Replace `rgba(249, 115, 22, 0.8)` with the solid equivalent `#f97316` in the dark theme, matching the convention of all other section tokens.

---

### [MODERATE] `SyncedLogsContext` Uses Old React Context Provider API Inconsistently

**Category:** Maintainability
**Files:** `src/contexts/SyncedLogsContext.tsx:59`, `src/contexts/ProfileContext.tsx:196`, `src/contexts/ApiKeyContext.tsx:10`
**Description:**
`SyncedLogsContext` uses the older `<Context.Provider value={...}>` pattern, while `ProfileContext` and `ApiKeyContext` both use the newer React 19 `<Context value={...}>` pattern. The codebase has mixed both syntaxes across its three context files.

**Suggested Fix:**
Standardize to the new `<Context value={...}>` pattern:

```tsx
return <SyncedLogsContext value={logs}>{children}</SyncedLogsContext>;
```

---

### [MODERATE] `useFoodLlmMatching` Duplicates the 6-Hour Processing Window Constant as a Local Variable

**Category:** Maintainability
**Files:** `src/hooks/useFoodLlmMatching.ts:47`, `src/hooks/useUnresolvedFoodToast.ts:9`
**Description:**
`useFoodLlmMatching.ts` defines the 6-hour window as a local variable inside a function:

```ts
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
```

`useUnresolvedFoodToast.ts` correctly defines the same constant at module level using the shared `MS_PER_HOUR` utility:

```ts
const PROCESSING_WINDOW_MS = 6 * MS_PER_HOUR;
```

Both hooks implement the same 6-hour processing window business rule. Having separate, differently-named constants with different derivation means they could silently diverge. The constant in `useFoodLlmMatching.ts` is also inside the helper function body rather than at module scope, which is unusual for a named constant.

**Suggested Fix:**
Hoist `SIX_HOURS_MS` in `useFoodLlmMatching.ts` to module scope, rename to `PROCESSING_WINDOW_MS`, and derive from `MS_PER_HOUR`:

```ts
import { MS_PER_HOUR } from "@/lib/timeConstants";
const PROCESSING_WINDOW_MS = 6 * MS_PER_HOUR;
```

---

### [MODERATE] `responsive-shell.tsx` Uses SSR Guard (`typeof window === "undefined"`) in a Vite SPA

**Category:** Maintainability
**Files:** `src/components/ui/responsive-shell.tsx:36`, `src/components/ui/responsive-shell.tsx:41`
**Description:**

```ts
if (typeof window === "undefined") return "mobile";
// ...
if (typeof window === "undefined") return;
```

This project is a client-only SPA; `window` is always defined at runtime. The guard is cargo-culted from SSR-aware patterns (Next.js, Remix) and adds noise. It also creates a misleading false-positive fallback: if these guards were ever actually triggered, the silent `return "mobile"` would cause layout bugs with no warning.

**Suggested Fix:**
Remove the SSR guards. If there is a genuine concern about SSR-readiness in future, document it explicitly rather than leaving silent no-op guards.

---

### [MODERATE] `useBaselineAverages` Timer Leak Risk — Cleanup Does Not Always Execute

**Category:** Code Quality
**Files:** `src/hooks/useBaselineAverages.ts:121-147`
**Description:**
The `useEffect` cleanup function conditionally clears the pending timer:

```ts
return () => {
  if (pendingTimerRef.current !== null) {
    clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = null;
  }
};
```

However, the early return path `if (!needsRecompute) return;` at line 122 returns `undefined` (no cleanup function). This means if the component unmounts while `needsRecompute` is false, but a timer was previously scheduled from a prior render cycle, the timer is not cleared because the last effect run provided no cleanup. The timer fires after unmount, calling `setBaselineRef.current(result, ...)` — a stale setter.

**Suggested Fix:**
Move the timer cleanup to an always-executed cleanup function, or use a single effect that always returns a cleanup:

```ts
useEffect(() => {
  if (!needsRecompute) return () => {};
  // ...schedule timer...
  return () => {
    if (pendingTimerRef.current !== null) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  };
}, [needsRecompute, storedBaseline, executeComputation]);
```

---

### [MODERATE] `useMappedAssessments` Has a Redundant Duplicate Field — `food` and `foodName` Both Map From `r.foodName`

**Category:** Code Quality
**Files:** `src/hooks/useMappedAssessments.ts:57-58`
**Description:**

```ts
food: r.foodName,
foodName: r.foodName,
```

Both `food` and `foodName` are mapped to the same source value. One of these fields is redundant. If `FoodAssessmentRecord` (from `@shared/foodEvidence`) requires both, this is a type definition problem. If only one is needed, the other can be removed. Either way, having two identically-valued properties with different names is a code smell that will confuse anyone reading or maintaining the mapping.

**Suggested Fix:**
Check the `FoodAssessmentRecord` type definition. If `food` is an alias maintained for backwards compatibility, add a comment. If both are genuinely needed, document why. If only one is needed, remove the duplicate.

---

### [MODERATE] `SyncedLogsContext` Does Not Surface Loading State — Consumers Cannot Distinguish Empty vs Loading

**Category:** Maintainability
**Files:** `src/contexts/SyncedLogsContext.tsx:7`, `src/contexts/SyncedLogsContext.tsx:59`
**Description:**
The context value is typed as `SyncedLog[] | null` (null = outside provider). The provider passes `logs` which is always `SyncedLog[]` (never `undefined`) because `toSyncedLogs` in `syncLogs.ts` coerces `undefined` from `useQuery` to `[]`. This means consumers like `useAiInsights` and `useFoodLlmMatching` cannot distinguish between "data is loading" and "no logs exist". Both states return an empty array. In practice, the AI analysis could run prematurely against an empty dataset while data is still loading from Convex.

**Suggested Fix:**
Expose an `isLoading` field alongside `logs`, or change the context value to `SyncedLog[] | undefined` where `undefined` means loading. Update all consumers to guard on the loading state before acting on an empty array.

---

### [MODERATE] `aiModels.test.ts` Hard-Codes Model Names That Will Go Stale

**Category:** Code Quality
**Files:** `src/lib/__tests__/aiModels.test.ts:6-7`
**Description:**

```ts
expect(DEFAULT_INSIGHT_MODEL).toBe("gpt-5.4");
expect(INSIGHT_MODEL_OPTIONS).toEqual(["gpt-5.4", "gpt-5-mini"]);
```

The test pins specific model version strings. These will fail every time models are upgraded (e.g., gpt-5.4 → gpt-5.5). The test is asserting the current value of constants rather than testing meaningful behavior — if someone updates the constants for a legitimate model upgrade, the test blocks them without adding safety.

**Suggested Fix:**
Import the constants and test structural properties rather than literal values:

```ts
it("includes DEFAULT_INSIGHT_MODEL in INSIGHT_MODEL_OPTIONS", () => {
  expect(INSIGHT_MODEL_OPTIONS).toContain(DEFAULT_INSIGHT_MODEL);
});
it("DEFAULT_INSIGHT_MODEL is a non-empty string", () => {
  expect(typeof DEFAULT_INSIGHT_MODEL).toBe("string");
  expect(DEFAULT_INSIGHT_MODEL.length).toBeGreaterThan(0);
});
```

---

### [MODERATE] `index.css` `::selection` Only Defined for Dark Theme Teal — No Light Theme Override

**Category:** Code Quality
**Files:** `src/index.css:573-576`
**Description:**

```css
::selection {
  background: rgba(45, 212, 191, 0.3);
  color: var(--color-text-primary);
}
```

This is declared inside `@layer base` with no theme scope, meaning it applies to both dark and light themes. The teal color (`rgba(45, 212, 191, 0.3)`) looks good on the dark navy background but appears visually jarring on the light cream background (`#f8f5ef`). The light theme has its own teal (`#0d9488`, a darker shade), but the selection background uses the dark theme's teal. There is no `[data-theme="light"] ::selection` override.

**Suggested Fix:**
Add a light theme selection rule:

```css
[data-theme="light"] ::selection {
  background: rgba(13, 148, 136, 0.2);
  color: var(--color-text-primary);
}
```

---

### [NICE-TO-HAVE] `DatePicker` Is an Uncontrolled Demo Component With No Props — Not Suitable for Production Use

**Category:** Maintainability
**Files:** `src/components/ui/date-picker.tsx`
**Description:**
`DatePicker` is a fully self-contained component that manages its own internal state and accepts no props:

```tsx
export function DatePicker() {
  const [date, setDate] = React.useState<Date>();
```

It has no `value`, `onChange`, `placeholder`, or `disabled` props. This is the shadcn "demo" boilerplate and is not usable in any form context without modification. If it is actually used anywhere in the app, it is being used incorrectly (or the form manages state around it in an ad-hoc way). If it is not used, it is dead code.

**Suggested Fix:**
Either convert to a controlled component with `value: Date | undefined` and `onChange: (date: Date | undefined) => void` props, or document that this is a demo shell only and flag it for replacement before use in any real form.

---

### [NICE-TO-HAVE] `useTimePicker`'s `toTodayTimestampMs` Always Resolves to Today — Cannot Handle Backdated Entries

**Category:** Code Quality
**Files:** `src/hooks/useTimePicker.ts:18-23`
**Description:**

```ts
function toTodayTimestampMs(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}
```

The function always uses `new Date()` as the base date. If the user is backdating a log (a supported feature in the app via `captureTimestamp`), calling `getTimestampMs()` when `timeEdited` is true will combine the user's time input with today's date, not the capture date. This is a subtle correctness issue — the hook is used alongside `usePanelTime` which handles this properly, but `useTimePicker` alone cannot produce the correct timestamp for a backdated entry.

**Suggested Fix:**
Add an optional `baseDate?: Date` parameter to `toTodayTimestampMs` and thread through from the hook:

```ts
function toTodayTimestampMs(timeStr: string, baseDate = new Date()): number {
  const d = new Date(baseDate);
  // ...
}
```

---

### [NICE-TO-HAVE] `useLongPress` Registers a `contextmenu` Listener on `e.currentTarget` Inside `onPointerDown` — Potential Listener Leak

**Category:** Code Quality
**Files:** `src/hooks/useLongPress.ts:876-887`
**Description:**

```ts
e.currentTarget.addEventListener(
  "contextmenu",
  (ev) => {
    ev.preventDefault();
  },
  { once: true },
);
```

This adds a new event listener on every `pointerdown` event. While `{ once: true }` ensures it fires once and auto-removes, if the pointer down fires but the context menu never fires (e.g., the user cancels the gesture), the listener sits attached to the DOM node indefinitely for that element's lifetime. Multiple pointers down without context menu events accumulate orphaned listeners. The `onContextMenu` handler on line 922 already calls `e.preventDefault()` — making the inline listener redundant.

**Suggested Fix:**
Remove the `addEventListener` call inside `onPointerDown` entirely. The `onContextMenu: (e) => e.preventDefault()` handler returned from the hook already suppresses the context menu when wired up by the caller. The inline listener is redundant.

---

### [NICE-TO-HAVE] `useHabitLog` Uses `useStore.getState()` After `await` — Race Condition Risk

**Category:** Code Quality
**Files:** `src/hooks/useHabitLog.ts:273`, `src/hooks/useHabitLog.ts:290-291`
**Description:**
After `await Promise.all([...addSyncedLog...])` resolves, the code reads Zustand store state with `useStore.getState().habitLogs`. The comment on line 269 correctly identifies this as a potential race condition. Reading state imperatively after an async boundary is a well-known pattern to avoid in Zustand — the state may have been mutated by another callback between the await and the read.

While the existing dedup logic tolerates duplicates (as the comment notes), this is an acknowledged technical shortcut. The implicit acceptance of the race condition should not block ship, but it is a quality gap.

**Suggested Fix:**
Pass the deduplication timestamp as a closure-captured local variable before the first `await`, rather than reading from `getState()` after the await. For example:

```ts
const wakeTime = captureNow();
// ...
await Promise.all([...]);
// Use wakeTime (captured before await) not store state
addHabitLog({ at: wakeTime, ... });
```

Remove the duplicate-check read from `getState()` and instead rely on the captured local `wakeTime` being unique per invocation.

---

### [NICE-TO-HAVE] `useNutritionData.ts` Has `currentMealSlot` Computed Outside `useMemo` — Causes Unnecessary Renders

**Category:** Code Quality
**Files:** `src/hooks/useNutritionData.ts:244-246`
**Description:**

```ts
const currentMealSlot = targetDate
  ? getMealSlot(getDateScopedTimestamp(targetDate))
  : getMealSlot(Date.now());
```

This is computed inline on every render, not wrapped in `useMemo`. `getMealSlot(Date.now())` calls `Date.now()` on every render, which always produces a new value. Since `currentMealSlot` is used as a dependency in the `recentFoods` memo on line 291, the `recentFoods` memo will recompute more often than necessary (every time the component re-renders rather than only when the meal slot actually changes).

**Suggested Fix:**
Wrap in `useMemo` keyed on `targetDate` and a clock tick (or the `todayKey` already available in scope):

```ts
const currentMealSlot = useMemo(
  () =>
    targetDate
      ? getMealSlot(getDateScopedTimestamp(targetDate))
      : getMealSlot(Date.now()),
  [targetDate, todayKey],
);
```

---

## Summary

| Severity     | Count | Items                                                                                                                                                                                                                                                                                                                                 |
| ------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL     | 2     | Divergent getCelebration implementations; dailyMessages unchecked index access                                                                                                                                                                                                                                                        |
| HIGH         | 6     | Dead detailDaySummaries phantom field; dead SOUND/CONFETTI constants; Barcelona timezone hard-code; responsive-shell body div class divergence; duplicated activity type normalization; PopoverTitle type-implementation mismatch                                                                                                     |
| MODERATE     | 9     | "use client" directives; section-tracking rgba inconsistency; mixed React context API style; duplicate 6-hour constant; SSR guard in SPA; useBaselineAverages cleanup gap; useMappedAssessments duplicate field; SyncedLogsContext loading state not exposed; aiModels test pins literal strings; ::selection no light-theme override |
| NICE-TO-HAVE | 5     | DatePicker uncontrolled demo; useTimePicker backdating gap; useLongPress redundant contextmenu listener; useHabitLog getState() after await; currentMealSlot not memoized                                                                                                                                                             |
