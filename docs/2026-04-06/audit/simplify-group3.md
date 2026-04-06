# Simplification Audit — Group 3

**Date:** 2026-04-06
**Auditor:** Claude Sonnet 4.6
**Scope:** src/App.tsx, src/components/archive/_, src/components/mode-toggle.tsx,
src/components/patterns/database/_, src/components/patterns/hero/\*,
src/components/settings/\*\*, src/components/theme-provider.tsx,
src/components/track/FoodMatchingModal.tsx, src/components/track/RawInputEditModal.tsx,
src/components/track/TodayStatusRow.tsx, src/components/track/dr-poo/AiInsightsBody.tsx,
src/components/track/dr-poo/AiInsightsSection.tsx

---

## Findings

---

### [MODERATE] Nested ternary for `label` in `AnalysisProgressOverlay`

**Category:** Boring Code
**Files:** src/components/archive/ai-insights/AnalysisProgressOverlay.tsx:L28-L35

**Description:**
The `label` variable is computed with a nested ternary chain three levels deep:

```ts
const label =
  status === "sending"
    ? "Sending logs to AI..."
    : status === "receiving"
      ? "Analysing your data..."
      : status === "done"
        ? "Analysis complete"
        : null;
```

This is exactly the pattern CLAUDE.md calls out to avoid. Three levels of nesting makes the intent hard to scan at a glance, especially since the values are plain string constants.

**Suggested Simplification:**
Replace with a plain object lookup or a switch statement:

```ts
const STATUS_LABELS: Partial<Record<AiAnalysisStatus, string>> = {
  sending: "Sending logs to AI...",
  receiving: "Analysing your data...",
  done: "Analysis complete",
};
const label = STATUS_LABELS[status] ?? null;
```

---

### [MODERATE] Duplicated section-header pattern across `CollapsibleSectionHeader`, `TrackingForm.SectionHeader`, and `DataManagementSection`

**Category:** DRY
**Files:**

- src/components/settings/CollapsibleSectionHeader.tsx:L11-L39
- src/components/settings/TrackingForm.tsx:L170-L201
- src/components/settings/app-data-form/DataManagementSection.tsx:L31-L43

**Description:**
Three separate components implement the same collapsible section header pattern: a title line, an optional subtitle, and a `ChevronRight` button that rotates 90° when open. The implementations differ only in color token and whether an icon is included. `CollapsibleSectionHeader` is the dedicated abstraction that was built for this, but `TrackingForm.tsx` defines a local `SectionHeader` component rather than reusing or extending it, and `DataManagementSection` rolls its own entirely with a custom chevron button. The local `SectionHeader` in `TrackingForm.tsx` also hard-codes `tracking` color tokens while `CollapsibleSectionHeader` hard-codes `health` tokens, so neither is truly general.

**Suggested Simplification:**
Extend `CollapsibleSectionHeader` to accept a `color` prop (or CSS variable pair), an optional `icon` prop, and an optional `subtitle` prop. Then replace the local `SectionHeader` in `TrackingForm.tsx` and the hand-rolled header in `DataManagementSection` with the shared component.

---

### [MODERATE] `getMealSlotStyle` uses four separate `if` blocks where a lookup table is cleaner

**Category:** Boring Code
**Files:** src/components/archive/ai-insights/MealIdeaCard.tsx:L11-L56

**Description:**
The function returns one of five fixed style objects based on which keyword appears in a meal string. Each condition requires `lower.includes("x") || lower.includes("y")` checks with sequential `if` statements. This works fine but the function is 45 lines long for what is essentially a static keyword-to-style mapping. Adding a new meal slot type currently requires reading all conditions to find the right place to insert.

**Suggested Simplification:**
Extract a data table that maps keyword arrays to style objects, and loop over it:

```ts
const SLOT_STYLES = [
  { keywords: ["breakfast", "morning"], gradient: "...", accent: "..." },
  { keywords: ["lunch", "midday"],      gradient: "...", accent: "..." },
  ...
];
const match = SLOT_STYLES.find(s => s.keywords.some(k => lower.includes(k)));
return match ?? FALLBACK_STYLE;
```

This collapses 45 lines to roughly 20 and makes additions trivial.

---

### [MODERATE] `LifestyleSection` — `smokingChoice` and `alcoholChoice` computed with redundant nested ternaries

**Category:** Boring Code
**Files:** src/components/settings/health/LifestyleSection.tsx:L21-L37

**Description:**
Both `smokingChoice` and `alcoholChoice` are derived from raw stored values via deeply nested ternary chains. For example:

```ts
const smokingChoice: YesNoChoice =
  healthProfile.smokingStatus === "yes"
    ? "yes"
    : healthProfile.smokingStatus === "no" ||
        healthProfile.smokingStatus === "never"
      ? "no"
      : healthProfile.smokingStatus === "former" ||
          healthProfile.smokingStatus === "current"
        ? "yes"
        : "";
```

The chain is three levels deep, and multiple branches produce the same output (`"yes"`). The "former" / "current" → `"yes"` mapping in particular is unexpected to read without careful study.

**Suggested Simplification:**
Use a plain `Set`-based or switch approach that makes the mapping explicit:

```ts
const SMOKING_YES_VALUES = new Set(["yes", "former", "current"]);
const SMOKING_NO_VALUES = new Set(["no", "never"]);
const smokingChoice: YesNoChoice = SMOKING_YES_VALUES.has(
  healthProfile.smokingStatus ?? "",
)
  ? "yes"
  : SMOKING_NO_VALUES.has(healthProfile.smokingStatus ?? "")
    ? "no"
    : "";
```

---

### [MODERATE] `setFrequency` and `setNumeric` in `LifestyleSection` use switch statements where direct calls are simpler

**Category:** Over-Engineering
**Files:** src/components/settings/health/LifestyleSection.tsx:L94-L135

**Description:**
Both `setFrequency` and `setNumeric` accept a key parameter and use a `switch` to dispatch to `setHealthProfile` with a different key. Because `setHealthProfile` accepts `Partial<HealthProfile>`, the switch can be replaced by computed property syntax:

```ts
// current — 15 lines of switch
const setFrequency = (key: ..., value: string) => {
  const nextValue = normalizeFrequency(value);
  switch (key) {
    case "alcoholFrequency": setHealthProfile({ alcoholFrequency: nextValue }); break;
    ...
  }
};

// simpler
const setFrequency = (key: ..., value: string) => {
  setHealthProfile({ [key]: normalizeFrequency(value) });
};
```

The same applies to `setNumeric`. Both switches add indirection for no type safety benefit because the key type is already constrained by the union type parameter.

**Suggested Simplification:**
Replace both `switch` bodies with a single `setHealthProfile({ [key]: ... })` call. The union types on the key parameters already prevent invalid keys from being passed in.

---

### [MODERATE] `BmFrequencyTile` — three chained `useMemo` calls where one is sufficient

**Category:** Over-Engineering
**Files:** src/components/patterns/hero/BmFrequencyTile.tsx:L75-L96

**Description:**
The component chains three `useMemo` calls:

1. `digestionCounts` — maps `digestionLogs` to `{ timestamp, episodesCount }` objects
2. `dailyCounts` — calls `computeDailyCounts` on `digestionCounts`
3. `sparklinePoints` — maps `dailyCounts` to `{ dateKey, value }` shape for `Sparkline`

Steps 2 and 3 are pure transforms of step 1's output. Only step 1 has a meaningful dependency (`digestionLogs`). Steps 2 and 3 always recompute whenever step 1 does, so memoising them separately adds overhead (three dependency-array comparisons) without saving any computation. `BristolTrendTile.tsx` has the same structure with its own three chained memos.

**Suggested Simplification:**
Combine all three steps into one `useMemo` that returns both `sparklinePoints` and `todayCount` (and any other derived values needed), keyed only on `digestionLogs`. This is cleaner and honest about the single dependency.

---

### [MODERATE] `BristolTrendTile` — separate `useMemo` for `sparklinePoints` mapping is trivial

**Category:** Over-Engineering
**Files:** src/components/patterns/hero/BristolTrendTile.tsx:L127-L136

**Description:**
`sparklinePoints` is memoised separately from `sparklineData` even though it is a trivial one-property rename (`average` → `value`) with no heavy computation. The memo has only one dependency (`sparklineData`) and will always run whenever `sparklineData` runs. This pattern adds ceremony without benefit.

**Suggested Simplification:**
Either inline the mapping into the `sparklineData` memo (return `{ dateKey, value: average }` directly from `computeDailyAverages`), or derive it inside the single combined memo recommended above.

---

### [MODERATE] `AppDataForm` — two nearly-identical inline `alertdialog` blocks

**Category:** DRY
**Files:** src/components/settings/AppDataForm.tsx:L138-L200

**Description:**
The factory-reset confirmation and the import confirmation are both rendered as inline `div[role="alertdialog"]` blocks with nearly identical structure: amber border, a bold warning line, a description, and two buttons (confirm + cancel). The only differences are the text content, which action is called on confirm, and whether a `disabled` state applies during async work. This is roughly 60 lines of duplicated layout that will need to be kept in sync.

**Suggested Simplification:**
Extract an `InlineConfirmation` component that accepts `title`, `description`, `confirmLabel`, `onConfirm`, `onCancel`, and an optional `isConfirming` prop. Both confirmation blocks become a single component instance. This also makes the pattern reusable if a third confirmation is ever needed.

---

### [MODERATE] `DeleteConfirmDrawer` — `isMobile` hook duplicates an existing responsive pattern

**Category:** DRY / Over-Engineering
**Files:** src/components/settings/DeleteConfirmDrawer.tsx:L18-L32

**Description:**
`DeleteConfirmDrawer` implements a local `useIsMobile` hook that listens to a `matchMedia` query to decide whether to render a `Drawer` or a `Dialog`. The codebase already uses `ResponsiveShell` (seen throughout `FilterSheet`, `DrPooSection`, `FoodMatchingModal`, and `RawInputEditModal`) to handle exactly this responsive shell pattern. Using `ResponsiveShell` would eliminate the local hook, the dual-render branch, and the 30 lines of bespoke dialog markup, while guaranteeing consistent breakpoint behaviour.

**Suggested Simplification:**
Migrate `DeleteConfirmDrawer` to use `ResponsiveShell` with a slot for the confirmation form and action buttons. The local `useIsMobile` hook can be deleted entirely.

---

### [MODERATE] `DrPooSection` — three repeated preset-attribute badge `span` blocks

**Category:** DRY
**Files:** src/components/settings/tracking-form/DrPooSection.tsx:L306-L319

**Description:**
Inside the preset preview sheet, four identical `span` elements are rendered to show preset attributes (approach, register, structure, length). All four share the same class string `"rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"`. The only difference is the text content.

**Suggested Simplification:**
Extract an array of label strings and map over them:

```tsx
const attributeLabels = [
  APPROACH_LABELS[preset.approach],
  REGISTER_LABELS[preset.register],
  STRUCTURE_LABELS[preset.outputFormat],
  LENGTH_LABELS[presetPreviewLength],
];
return attributeLabels.map((label) => (
  <span
    key={label}
    className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
  >
    {label}
  </span>
));
```

---

### [MODERATE] `DrPooSection` — preset preview text block is repeated inline instead of using `PreviewTextBlock`

**Category:** DRY
**Files:** src/components/settings/tracking-form/DrPooSection.tsx:L323-L338

**Description:**
Inside the preset preview `ResponsiveShell`, three `div.space-y-1` blocks display Summary, Suggestions, and "Did you know" preview sections. This is exactly what `PreviewTextBlock` (defined in `DrPooPreviewComponents.tsx`) renders. The component is already imported and used in the advanced preview panel, but it is not used here — the three-section block is hand-written again instead.

**Suggested Simplification:**
Replace the three inline `div` blocks with `<PreviewTextBlock preview={previewCard.preview[presetPreviewLength]} />`. The only styling difference (border color and padding) can be handled via a `className` prop added to `PreviewTextBlock`, or by wrapping it in a container. This removes ~18 lines of duplicated JSX.

---

### [MODERATE] `FoodMatchingModal` — `currentItem` construction duplicates prop extraction

**Category:** Redundancy
**Files:** src/components/track/FoodMatchingModal.tsx:L76-L87

**Description:**
When not in queue mode, a synthetic `currentItem` object is constructed from individual props (`logId`, `itemIndex`, `item`, `foodName`, `rawInput`, `logTimestamp`, `logNotes`), then immediately destructured again with `currentItem?.logId`, `currentItem?.itemIndex`, etc. for each derived variable. This indirection adds lines without benefit: the individual props are already available directly in the closure and could be used directly via a short conditional.

**Suggested Simplification:**
Keep the queue-mode path as-is, but for the non-queue path, use the individual props directly instead of constructing an intermediate object just to unwrap it. A small helper that picks from `queue[queueIndex]` or falls back to individual props would be cleaner than the synthetic object construction.

---

### [MODERATE] `columns.tsx` — `formatRelativeTime` duplicates time-unit constants already defined in the file

**Category:** DRY
**Files:** src/components/patterns/database/columns.tsx:L99-L133

**Description:**
`MS_PER_MINUTE`, `MS_PER_HOUR`, and `MS_PER_DAY` are defined at the module top level, which is correct. However, `formatRelativeTime` contains two conditionals that produce the same result:

```ts
if (diff < 0) return "Just now";
if (diff < MS_PER_MINUTE) return "Just now";
```

The `diff < 0` guard is always `true` before the `diff < MS_PER_MINUTE` check, so it is redundant. This is not a bug but it misleads the reader into thinking the two cases are meaningfully distinct.

**Suggested Simplification:**
Merge the two guards:

```ts
if (diff <= 0) return "Just now";
```

This communicates the same intent with one line instead of two.

---

### [MODERATE] `TodayStatusRow` — three `span` elements with identical `style` objects differing only in `color`

**Category:** DRY
**Files:** src/components/track/TodayStatusRow.tsx:L65-L99

**Description:**
Three `span` elements in the row share the same `background: "transparent"` and `border: "none"` style properties, varying only in `color`. The shared class string `"inline-flex items-center rounded-full px-3 py-1 text-center text-xs font-medium"` is also identical across all three. The inline `style` overrides `background` and `border` to transparent/none, which means the rounded-full pill classes are visual no-ops — the styling comes entirely from the `color` variable.

**Suggested Simplification:**
Extract a small `StatusPill` component or apply a shared Tailwind base class (dropping the border/background style props since they cancel each other out). The color could be passed as a CSS custom property or a `style={{ color }}` prop.

---

### [NICE-TO-HAVE] `AnalysisProgressOverlay` — `showFullError` toggle uses a functional updater for no reason

**Category:** Boring Code
**Files:** src/components/archive/ai-insights/AnalysisProgressOverlay.tsx:L50-L54

**Description:**

```ts
onClick={() => setShowFullError((prev) => !prev)}
```

The functional updater form `(prev) => !prev` is only needed when the new state depends on stale closure state. Since `showFullError` is just a boolean toggle with no batching concern, the simpler `() => setShowFullError(!showFullError)` is equally correct and slightly easier to read.

**Suggested Simplification:**
`onClick={() => setShowFullError(!showFullError)}` — or alternatively extract a named `toggleFullError` function.

---

### [NICE-TO-HAVE] `FilterSheet` — `handleSaveViewButtonClick` wraps `requestAnimationFrame` where a simple `setTimeout(0)` or CSS `autofocus` would read more clearly

**Category:** Boring Code
**Files:** src/components/settings/FilterSheet.tsx:L185-L193

**Description:**

```ts
const handleSaveViewButtonClick = useCallback(() => {
  setSaveViewOpen(true);
  setViewName("");
  requestAnimationFrame(() => {
    nameInputRef.current?.focus();
  });
}, []);
```

`requestAnimationFrame` is used to defer focus until after the next paint. This is a reasonable technique but it is non-obvious to readers unfamiliar with rAF as a DOM-ready deferral mechanism, especially since `setTimeout(() => ..., 0)` is the more commonly understood idiom for "after React renders". The comment says "focus the input after the next paint" which helps, but the code choice adds cognitive overhead.

**Suggested Simplification:**
Replace with `setTimeout(() => { nameInputRef.current?.focus(); }, 0)` for parity with how `DeleteConfirmDrawer` handles the same problem (it already uses `setTimeout` with a 350ms delay). Alternatively, add the HTML `autoFocus` attribute to the input, which React handles correctly for conditionally-rendered elements.

---

### [NICE-TO-HAVE] `SmartViews` — `countActiveFilters` uses `reduce` where a simple `for` loop is more readable

**Category:** Boring Code
**Files:** src/components/patterns/database/FilterSheet.tsx:L70-L76

**Description:**

```ts
export function countActiveFilters(filters: ColumnFiltersState): number {
  return filters.reduce((count, filter) => {
    if (Array.isArray(filter.value)) return count + filter.value.length;
    if (typeof filter.value === "string" && filter.value.length > 0)
      return count + 1;
    return count;
  }, 0);
}
```

`reduce` is being used to accumulate a count with multi-branch logic inside. A `for` loop with a `let count` variable expresses this more directly and is faster to read — especially given the project's "write boring code" rule.

**Suggested Simplification:**

```ts
export function countActiveFilters(filters: ColumnFiltersState): number {
  let count = 0;
  for (const filter of filters) {
    if (Array.isArray(filter.value)) count += filter.value.length;
    else if (typeof filter.value === "string" && filter.value.length > 0)
      count += 1;
  }
  return count;
}
```

---

### [NICE-TO-HAVE] `AiSuggestionsCard` — `getHabitName`, `getCurrentValue`, `getHabitUnit` all call `habits.find` separately

**Category:** DRY
**Files:** src/components/settings/AiSuggestionsCard.tsx:L106-L119

**Description:**
Three helpers each call `habits.find((h) => h.id === habitId)` separately inside the `suggestions.map` render. Each call is O(n) over the habits array, and all three are called for every suggestion item on every render. This is a minor performance issue but primarily a clarity issue: the three tiny helpers obscure that all three pieces of data come from a single `habit` object.

**Suggested Simplification:**
Inline the lookup once inside the `suggestions.map` render callback and destructure what's needed:

```tsx
{suggestions.map((s) => {
  const habit = habits.find((h) => h.id === s.habitId);
  if (!habit) return null;
  const currentValue = isTargetHabit(habit) ? (habit.dailyTarget ?? null) : isCapHabit(habit) ? (habit.dailyCap ?? null) : null;
  // use habit.name and habit.unit directly
```

This removes three single-use helpers and makes the data flow obvious.

---

### [NICE-TO-HAVE] `CustomDrinksSection` — key uses array index

**Category:** Boring Code
**Files:** src/components/settings/tracking-form/CustomDrinksSection.tsx:L23

**Description:**

```tsx
<div key={`drink-${index}`} className="flex items-center gap-2">
```

The outer `div` wrapping each `Input` uses a `drink-${index}` key. The `index` is already the canonical identity here (drink slot 1, slot 2, etc.), so using it as a key is correct in this case. However, the wrapping `div` has no functional purpose — it contains only a single non-conditional child (`div.flex-1 > Label + Input`). The label and input could sit directly in the grid without the outer `div`.

**Suggested Simplification:**
Remove the outer wrapper `div` and key the flex container directly, or simplify the grid to not need a wrapper at all:

```tsx
{fluidDrafts.map((draft, index) => (
  <div key={index} className="flex-1 min-w-0">
    <Label className="sr-only">Drink choice {index + 1}</Label>
    <Input ... />
  </div>
))}
```

---

### [NICE-TO-HAVE] `HeroStrip` — wrapping `flex-col gap-3` div serves no purpose

**Category:** Redundancy
**Files:** src/components/patterns/hero/HeroStrip.tsx:L19-L26

**Description:**
`HeroStrip` renders a single outer `div` with `data-slot="hero-strip" className="flex flex-col gap-3"` that contains only one child: the `grid` of tiles. Since there is no second sibling and no additional spacing context needed at this level, the `flex-col gap-3` wrapper adds no layout value. The comment in the JSX (`{/* Metric tiles grid */}`) suggests a second tile or stat row was once planned but has not been added.

**Suggested Simplification:**
Return the `grid` directly from `HeroStrip` (or keep the wrapper only if a second child element is planned and documented). If the `data-slot` attribute is needed for test targeting, it can move to the grid element.

---

### [NICE-TO-HAVE] `mode-toggle.tsx` — Tailwind class ordering is inconsistent with the rest of the codebase

**Category:** Boring Code
**Files:** src/components/mode-toggle.tsx:L18-L19

**Description:**

```tsx
<Sun className="text-yellow-900 h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
<Moon className="text-yellow-500 absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
```

The class order starts with `text-*` color before layout utilities (`h-`, `w-`), which is inconsistent with Biome's enforced ordering used everywhere else in the codebase. This is cosmetic but will cause Biome to flag it during a lint pass.

**Suggested Simplification:**
Reorder to put layout utilities before color utilities, matching Biome's canonical order:

```tsx
<Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 text-yellow-900 transition-all dark:scale-0 dark:-rotate-90" />
```

---

_End of report. 17 findings: 1 CRITICAL — 0, HIGH — 0, MODERATE — 12, NICE-TO-HAVE — 5._
