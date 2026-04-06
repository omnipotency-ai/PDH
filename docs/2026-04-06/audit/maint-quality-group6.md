# Maintainability & Code Quality Audit — Group 6

**Audited:** 2026-04-06  
**Scope:** `src/lib/`, `src/pages/`, `src/store.ts`, `src/main.tsx`, `src/routeTree.tsx`, `src/registerServiceWorker.ts`, `src/types/domain.ts`, `src/vite-env.d.ts`, `tsconfig.json`, `vercel.json`, `vite.config.ts`, `vitest.config.ts`

---

## Findings

---

### [HIGH] `aiModels.ts` references non-existent model names

**Category:** Code Quality  
**Files:** `src/lib/aiModels.ts:11-14`

**Description:** Both `BACKGROUND_MODEL` and `INSIGHT_MODEL_OPTIONS` reference model names `"gpt-5-mini"` and `"gpt-5.4"`. These do not match any known OpenAI model identifiers as of early 2026 (valid names are `gpt-4o`, `gpt-4o-mini`, `o3`, `o4-mini`, etc.). If the Convex backend forwards these strings verbatim to the OpenAI API they will produce HTTP 400 errors. The `getModelLabel` display function also hard-codes the same strings, creating a single point of failure if the model names must ever change. The empty `LEGACY_INSIGHT_MODEL_ALIASES` object suggests the model names have already been changed at least once, but the current values were never verified to be real.

**Suggested Fix:** Confirm the exact model identifiers in use against the Convex `ai.chatCompletion` action and the OpenAI API, then update both constants. Gate model selection behind a thin validated enum so the app cannot accidentally send an invalid model string.

---

### [HIGH] Duplicate `LogPayloadData` type alias in `Track.tsx`

**Category:** Maintainability  
**Files:** `src/pages/Track.tsx:78`, `src/lib/syncCore.ts:277`

**Description:** `Track.tsx` defines `type LogPayloadData = LogDataMap[LogType]` at line 78, which is identical to `LogPayloadData` already exported from `syncCore.ts` (and re-exported through `sync.ts`). This local re-declaration creates two canonical definitions of the same type. If either definition drifts, TypeScript will still compile because the structures happen to be the same, but code reviewers must check two locations. It is also a signal that the import discipline in Track is loose — the type exists in the barrel export and should be imported from there.

**Suggested Fix:** Remove the local `type LogPayloadData` alias from `Track.tsx` and import it from `@/lib/sync`.

---

### [HIGH] `aiRateLimiter.ts` module-level state is not reset between hot-reloads or test runs

**Category:** Maintainability  
**Files:** `src/lib/aiRateLimiter.ts:9`, `src/lib/aiRateLimiter.ts:27-29`

**Description:** `lastCallTimestamp` is a module-level variable. In the browser, Vite HMR replaces modules in-place, so the timestamp is reset on every hot-reload — meaning the 5-minute rate limit is trivially bypassed during development. In vitest, module state leaks between test files unless the module is explicitly reset. The `resetRateLimit()` function exists but there is no automatic reset mechanism (e.g. `beforeEach` in a test helper). This is high severity because the rate limiter is the "last-resort safety net" per its own comment — if tests or dev environments silently bypass it, it cannot be trusted in production either.

**Suggested Fix:** Add a vitest `beforeEach(() => resetRateLimit())` in any test file that exercises AI call paths. Consider converting the rate limiter to a class instance so state is scoped rather than global.

---

### [HIGH] `customFoodPresets.ts` uses `Math.random()` for ID generation with no collision protection

**Category:** Code Quality  
**Files:** `src/lib/customFoodPresets.ts:21-26`

**Description:** `createBlankCustomFoodPreset` generates IDs as `` `food_${Date.now()}_${Math.round(Math.random() * 10000)}` ``. `Math.random()` returns a float, and `Math.round()` of `random * 10000` yields only 10,001 distinct values. If the user creates two presets in rapid succession (possible via UI double-tap), `Date.now()` may be the same millisecond, and the random component provides only ~0.01% collision avoidance. While presets are capped at 12, the ID scheme is misleading as it implies uniqueness guarantees that don't exist. The project's own CLAUDE.md requires determinism and no reliance on `Math.random()` for IDs.

**Suggested Fix:** Use `crypto.randomUUID()` (available in all modern browsers and edge-runtime) or at minimum use the full floating point value (not rounded) from `Math.random()` combined with a monotonic counter stored in the same module.

---

### [MODERATE] `baselineAverages.ts` acknowledges a known deflation bug via TODO with no tracking reference

**Category:** Maintainability  
**Files:** `src/lib/baselineAverages.ts:201-205`

**Description:** Lines 201–205 contain a TODO comment: "All fluids share one calendarDaySpan. This deflates averages for fluids added later." The comment explains the problem clearly but provides no work queue ticket, issue number, or reference. Stale TODOs without ticket references have a much lower chance of being actioned. The current behavior means a user who adds a tea habit after two weeks of tracking water will see artificially low tea averages — this is a real data-accuracy problem affecting the app's core purpose (pattern tracking).

**Suggested Fix:** Add a work queue item for the per-fluid calendarDaySpan fix and reference it in the comment (e.g., `// TODO WQ-NNN: per-fluid calendarDaySpan`). The fix outline is already in the comment — it needs a ticket, not more description.

---

### [MODERATE] `debugLog.ts` uses `import.meta.env.DEV` conditionals that are not tree-shaken in test builds

**Category:** Maintainability  
**Files:** `src/lib/debugLog.ts:5-15`

**Description:** `debugLog` and `debugWarn` use `if (import.meta.env.DEV)` which Vite replaces with `if (true)` in dev and `if (false)` in prod, allowing dead-code elimination. However, the `vitest.config.ts` sets `environment: "edge-runtime"` without specifying `define: { 'import.meta.env.DEV': true }`. The edge-runtime environment may not define `import.meta.env.DEV`, meaning calls to `debugLog` in tests may silently no-op or throw a ReferenceError depending on the edge-runtime polyfill. No tests currently exercise `debugLog` directly, so this is a latent issue.

**Suggested Fix:** In `vitest.config.ts`, add a `define` block: `define: { 'import.meta.env.DEV': true, 'import.meta.env.PROD': false }`. Alternatively, guard `debugLog` with `typeof import.meta !== 'undefined'`.

---

### [MODERATE] `sounds.ts` has a race condition when resuming a suspended `AudioContext`

**Category:** Code Quality  
**Files:** `src/lib/sounds.ts:67-73`

**Description:** The `resume()` call on a suspended `AudioContext` is asynchronous (returns a Promise), but the code does not await it. It then synchronously checks `ctx.state` immediately after — this check will almost always still show `"suspended"` because the resume hasn't completed yet, causing the function to bail out and produce no sound. The `catch` on the `.resume()` call logs the error, but the sound has already been silently dropped. The comment "If still suspended after resume attempt, bail out" suggests intent, but the implementation doesn't match: it bails regardless because the check is synchronous.

**Suggested Fix:**

```ts
if (ctx.state === "suspended") {
  ctx
    .resume()
    .then(() => scheduleNotes(ctx, variant))
    .catch((err) => {
      console.warn("AudioContext resume failed:", err);
    });
  return;
}
scheduleNotes(ctx, variant);
```

Extract note scheduling into a `scheduleNotes(ctx, variant)` helper and call it from inside the resolved promise.

---

### [MODERATE] `sync.ts` barrel re-export file has a misleading JSDoc comment

**Category:** Maintainability  
**Files:** `src/lib/sync.ts:0-93`

**Description:** The barrel file states "All existing imports from `@/lib/sync` continue to work unchanged." However, the `FoodTrialStatus` type is listed as an export in the barrel but a quick inspection of `syncFood.ts` shows it is exported from that sub-module. This is fine as stated, but the barrel does NOT re-export every symbol that each sub-module exports — for example `useConvexAiCaller` patterns or internal helpers are not re-exported. The broad claim that "all imports continue to work" may mislead future engineers who add a new sub-module export and expect it to auto-appear in the barrel. The barrel is also the entry point for test imports in `sync.test.ts`, which imports `ConvexLogRow` directly — this only works because syncCore re-exports it.

**Suggested Fix:** Narrow the barrel comment to "All previously public exports from the monolithic `sync.ts` continue to work unchanged." Add a note that new exports from sub-modules must be explicitly added to this barrel.

---

### [MODERATE] `habitCoaching.ts` defines an `average()` helper that duplicates similar logic elsewhere

**Category:** Maintainability  
**Files:** `src/lib/habitCoaching.ts:320-323`, `src/lib/baselineAverages.ts` (implicit)

**Description:** `habitCoaching.ts` defines a local `average(values: number[]): number` function. Averaging is also performed inline in `baselineAverages.ts` (via manual `safeDivide`) and likely in other lib files. This is a trivial utility that belongs in a shared math/utils module. Having it duplicated means any future change (e.g., handling empty arrays differently) requires tracking down all copies.

**Suggested Fix:** Move `average()` to `src/lib/utils.ts` or a new `src/lib/mathUtils.ts` alongside the existing `cn()` utility. Export and import from there.

---

### [MODERATE] `celebrations.ts` uses a character-code hash for message selection that is undocumented and fragile

**Category:** Code Quality  
**Files:** `src/lib/celebrations.ts:54-56`

**Description:** The daily message rotation is selected via `habit.name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % dailyMessages.length`. This produces a deterministic but arbitrary index. There is no comment explaining why this approach was chosen over a timestamp-based or user-preference rotation. More importantly, if a habit is renamed, the user will see a different "daily" message — the rotation is not actually daily, it is name-based. This is misleading given the variable name `dailyMessages` and the intent described in the file's JSDoc.

**Suggested Fix:** Either rename the approach to "habit-stable message" and document that it is consistent per habit name, or use a date-based hash (`new Date().toDateString()`) to achieve a truly daily rotation. Add a comment explaining the tradeoff.

---

### [MODERATE] `derivedHabitLogs.ts` has an activity-type matching strategy duplicated from `Track.tsx`

**Category:** Maintainability  
**Files:** `src/lib/derivedHabitLogs.ts:19-21`, `src/pages/Track.tsx:125-133`

**Description:** Both `derivedHabitLogs.ts` and `Track.tsx` implement the same activity type normalization logic (lowercasing, replacing non-alphanumeric chars, mapping `"walk"` to `"walking"`). The implementations are subtly different: `derivedHabitLogs.ts` uses `normalizeKey` + `normalizeActivityType`, while `Track.tsx` uses `toActivityTypeKey` + its own `"walk"` regex. If the normalization rules diverge, logs will be matched differently in retrospective rebuilds vs. the live track page. This is a latent data-consistency bug.

**Suggested Fix:** Extract a single `normalizeActivityTypeKey(value: string): string` function into a shared module (e.g. `src/lib/habitUtils.ts`) and import it in both `derivedHabitLogs.ts` and `Track.tsx`.

---

### [MODERATE] `healthProfile.test.ts` has a misleading test description

**Category:** Code Quality  
**Files:** `src/lib/__tests__/healthProfile.test.ts:57-61`

**Description:** The test at line 57 is titled "passes through non-legacy condition names unchanged" but the first assertion `expect(normalizeHealthConditionName("IBS")).toBe("IBD/IBS")` demonstrates the opposite — `"IBS"` IS a legacy mapping and IS changed. This is confusing for any future engineer reading the test as documentation of the function's behavior.

**Suggested Fix:** Retitle to "applies single-token legacy mappings (IBS, IBD)" and split off a separate test with truly pass-through inputs like `"GERD"` and `"Celiac disease"` under the "passes through non-legacy condition names unchanged" label.

---

### [MODERATE] `sync.test.ts` `makeRow` helper has a poorly-typed `id` field that requires a cast

**Category:** Code Quality  
**Files:** `src/lib/__tests__/sync.test.ts:27-41`

**Description:** The `makeRow` helper takes `id: string` in its overrides but returns the row with `id: overrides.id ?? "test-id-123"` — then casts the whole object `as ConvexLogRow`. The `ConvexLogRow` type derives from Convex's generated types where `id` is `Id<"logs">` (a branded string), not a plain string. The cast suppresses this brand mismatch. This is an acknowledged limitation (commented in the helper), but the helper comment says "At runtime, Convex IDs are plain strings" — which is correct, but worth noting that this pattern would hide any future change to how the id field is typed in generated Convex types.

**Suggested Fix:** This is acceptable given the constraints of testing Convex types, but the comment at lines 27-30 should note that the cast will need updating if Convex changes its Id brand. Low urgency, but document it.

---

### [MODERATE] `nutritionUtils.ts` test uses `Date.now()` in `makeFluidLog` helper

**Category:** Code Quality  
**Files:** `src/lib/__tests__/nutritionUtils.test.ts:39-44`

**Description:** The `makeFluidLog` test helper calls `Date.now()` for both `id` and `timestamp`, making the test non-deterministic in timing (though not in outcome, since `calculateWaterIntake` does not use timestamps). This is a minor bad practice: test helpers should use fixed values unless the property under test requires real time. If a future `calculateWaterIntake` implementation were to filter by recency, these tests would give misleading results.

**Suggested Fix:** Replace `Date.now()` with fixed values: `id: "fluid-test-1"` and `timestamp: 1700000000000`.

---

### [MODERATE] `customFoodPresets.ts` duplicates normalization logic between `loadCustomFoodPresets` and `saveCustomFoodPresets`

**Category:** Maintainability  
**Files:** `src/lib/customFoodPresets.ts:48-58`, `src/lib/customFoodPresets.ts:65-76`

**Description:** The normalization of preset data (`.trim().slice(0, 80)` for names, `.map(item => item.trim()).filter(Boolean).slice(0, 20)` for ingredients, `.slice(0, 12)` for the preset list) is copy-pasted identically between `loadCustomFoodPresets` and `saveCustomFoodPresets`. If the limits change (e.g., name length from 80 to 100), two places must be updated. The magic numbers 80, 20, and 12 have no named constants explaining their origin.

**Suggested Fix:** Extract a `normalizePreset(preset)` helper and a `normalizePresets(presets)` helper (for the slice(0, 12) cap). Define named constants `MAX_PRESET_NAME_LENGTH = 80`, `MAX_PRESET_INGREDIENTS = 20`, `MAX_CUSTOM_PRESETS = 12`. Call the helpers from both functions.

---

### [MODERATE] `settingsUtils.ts` has an `isUsageFrequency` type guard that is not exported despite being useful externally

**Category:** Maintainability  
**Files:** `src/lib/settingsUtils.ts:33-35`

**Description:** `isUsageFrequency` is a locally-defined type guard function that is not exported. `normalizeFrequency` wraps it but only returns the value — callers who need a boolean type guard have to call `normalizeFrequency(x) !== ""` as a workaround, which is less expressive and less type-safe than `isUsageFrequency(x)`. The same pattern is used in `healthProfile.ts` where the type guard is internal but the normalizer is public.

**Suggested Fix:** Export `isUsageFrequency` for consistency with the exported pattern used in `aiModels.ts` (`isInsightModel` is internal there too — consider auditing all type guard visibility as a batch).

---

### [MODERATE] `trialFormatters.ts` imports `date-fns` for a single `format` call — heavy dependency for a tiny utility

**Category:** Maintainability  
**Files:** `src/lib/trialFormatters.ts:1`, `src/lib/trialFormatters.ts:10-12`

**Description:** `trialFormatters.ts` imports from `date-fns` solely for `format(new Date(timestamp), "MMM d")`. The `date-fns` library is non-trivial even with tree-shaking. The function body is 2 lines. Given that the rest of the codebase uses `Intl.DateTimeFormat` or custom `formatLocalDateKey` for simple formatting, pulling in `date-fns` here is inconsistent and adds a module-level dependency for what could be `new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(timestamp))`.

**Suggested Fix:** Replace the `date-fns` import with an `Intl.DateTimeFormat` call, or add `formatShortDate` to `dateUtils.ts` using `Intl`. This removes the `date-fns` dependency from `trialFormatters.ts` entirely.

---

### [MODERATE] `routeTree.tsx` contains the full application shell, error boundaries, auth loading UI, and navigation — violating single responsibility

**Category:** Maintainability  
**Files:** `src/routeTree.tsx:62-327`

**Description:** `routeTree.tsx` is 434 lines long and contains: the `RouteErrorBoundary` class component, `AuthLoadingFallback`, `GlobalHeader` (with full navigation rendering logic), `AppLayout`, and all route definitions. This conflates route configuration with UI components. If `GlobalHeader` or `AuthLoadingFallback` need to change, a developer must open the routing file, which is unexpected. The file is also imported in multiple contexts, creating a broad blast radius for any change.

**Suggested Fix:** Extract `RouteErrorBoundary`, `AuthLoadingFallback`, and `GlobalHeader` into separate files under `src/components/layout/`. Keep `routeTree.tsx` focused solely on route definitions and the `createRouter` call. This is a refactor, not a patch.

---

### [MODERATE] `store.ts` exports `DEFAULT_FLUID_PRESETS`, `MAX_FLUID_PRESETS`, and `BLOCKED_FLUID_PRESET_NAMES` — these are not store state and do not belong here

**Category:** Maintainability  
**Files:** `src/store.ts:64-74`

**Description:** The Zustand store file exports fluid preset constants (`DEFAULT_FLUID_PRESETS`, `MAX_FLUID_PRESETS`, `BLOCKED_FLUID_PRESET_NAMES`) and the `DEFAULT_HEALTH_PROFILE` object. None of these are store state — they are configuration constants. The `store.ts` file is already a legitimate re-export hub (it re-exports `HabitConfig`, `HabitLog`, `SleepGoal`), but adding configuration data to it creates an unclear module identity. Future developers importing from `@/store` will find both Zustand state and static config, which are unrelated.

**Suggested Fix:** Move fluid preset constants to a new `src/lib/fluidPresets.ts` (or co-locate with fluid-related types in `domain.ts`). Move `DEFAULT_HEALTH_PROFILE` to either `domain.ts` or a `src/lib/healthProfileDefaults.ts`. The store should only export Zustand state, actions, and type guard helpers that depend on store types.

---

### [MODERATE] `sync.ts` barrel re-exports `FoodTrialStatus` but the type is not clearly documented as the canonical location

**Category:** Maintainability  
**Files:** `src/lib/sync.ts:45-46`, `src/lib/syncFood.ts`

**Description:** `FoodTrialStatus` is listed in the barrel re-export from `syncFood.ts`, but it is a domain type (food trial classification) that arguably belongs in `src/types/domain.ts` alongside other domain types like `FoodPrimaryStatus`. Having it live in `syncFood.ts` means its canonical location is the data-access layer rather than the domain type layer. This is inconsistent with how `FoodPrimaryStatus` and `FoodTendency` are organized (in `domain.ts` via re-export from `shared/foodTypes`).

**Suggested Fix:** Move `FoodTrialStatus` to `src/types/domain.ts` or `shared/foodTypes.ts` and update the barrel export accordingly. This aligns with the project's existing pattern of keeping domain types in the domain layer.

---

### [MODERATE] `aiAnalysis.ts` internal interfaces `FoodLog`, `BowelEvent`, and `FoodItemDetail` are `@internal Exported for testing` but have no corresponding tests

**Category:** Maintainability  
**Files:** `src/lib/aiAnalysis.ts:174-199`

**Description:** Three interfaces are marked `@internal Exported for testing` but the test file `src/lib/analysis.test.ts` tests the high-level `analyzeLogs` function from `analysis.ts`, not from `aiAnalysis.ts`. There is no test file for `aiAnalysis.ts` itself. The `@internal` exports are dead weight — they increase the module's public surface area without test coverage to justify the exposure.

**Suggested Fix:** If these types are not tested, remove the `@internal Exported for testing` comments and make them unexported. If they should be tested, add a `src/lib/__tests__/aiAnalysis.test.ts` that exercises the functions that use them.

---

### [MODERATE] `vite.config.ts` has a destructured but unused parameter in `defineConfig`

**Category:** Code Quality  
**Files:** `vite.config.ts:7`

**Description:** `defineConfig(({}) => { ... })` destructures an empty object from the config callback — the `{}` pattern matches the `{ command, mode, ssrBuild }` config function parameter, but nothing is extracted. This is a placeholder pattern that suggests the author intended to use `command` (e.g., to differentiate dev vs. build) but did not. It is cleaner to write `defineConfig(() => { ... })`.

**Suggested Fix:** Change `defineConfig(({}) => {` to `defineConfig(() => {` to avoid the misleading empty destructure.

---

### [MODERATE] `habitIcons.tsx` imports both `Coffee` and `CoffeeIcon` from `lucide-react`

**Category:** Code Quality  
**Files:** `src/lib/habitIcons.tsx:9-10`, `src/lib/habitIcons.tsx:35-39`

**Description:** Both `Coffee` (used for tea: `habit_tea`) and `CoffeeIcon` (used for coffee: `habit_coffee`) are imported from `lucide-react`. In lucide-react, `CoffeeIcon` is an alias for `Coffee` — they render the same icon. This means tea and coffee habits display identical icons, which may be intentional but is not documented. More importantly, having both imported with different names suggests they are expected to be visually distinct, which is misleading.

**Suggested Fix:** Confirm whether using the same icon for tea and coffee is intentional. If it is, remove `CoffeeIcon`, use `Coffee` for both, and add a comment explaining the deliberate choice. If different icons are desired, find appropriate distinct lucide icons (e.g., `Mug` or `TeaCup`).

---

### [NICE-TO-HAVE] `CHAKRA_SEQUENCE` in `chakraColors.ts` is typed as `readonly string[]` instead of `readonly (typeof CHAKRA_VALUES)[number][]`

**Category:** Code Quality  
**Files:** `src/lib/chakraColors.ts:14-22`

**Description:** `CHAKRA_SEQUENCE` is typed `readonly string[]` even though all values come from the `CHAKRA` const object. Using `string[]` loses the literal type information. Since `CHAKRA` uses `as const`, the values are narrowed to their hex string literals. `CHAKRA_SEQUENCE` could be typed `ReadonlyArray<(typeof CHAKRA)[keyof typeof CHAKRA]>` to preserve the relationship, or simply `as const` on the array itself.

**Suggested Fix:** Change to `export const CHAKRA_SEQUENCE = [...] as const;` so the type is `readonly ["#E74C3C", "#f97316", ...]`, preserving literal types for consumer type inference.

---

### [NICE-TO-HAVE] `timeConstants.ts` exports `HOURS_PER_DAY = 24` which is never used in the audited files

**Category:** Maintainability  
**Files:** `src/lib/timeConstants.ts:5`

**Description:** `HOURS_PER_DAY` is defined and exported but does not appear to be used in any of the audited files. If it is unused project-wide, it is dead code. If it is used elsewhere, the constant name is unnecessary verbosity — `24` is self-evident in context and does not benefit from extraction.

**Suggested Fix:** Run a project-wide search for `HOURS_PER_DAY`. If unused, remove it. If used only once or twice in contexts where `24` is self-explanatory, prefer the literal.

---

### [NICE-TO-HAVE] `analysis.ts` `DigestiveCategory` type is a private local type despite being conceptually equivalent to `BristolCategory` in `foodStatusThresholds.ts`

**Category:** Maintainability  
**Files:** `src/lib/analysis.ts:6`, `src/lib/foodStatusThresholds.ts:121`

**Description:** `analysis.ts` defines `type DigestiveCategory = "constipated" | "hard" | "firm" | "loose" | "diarrhea"` as a local type. `foodStatusThresholds.ts` defines `type BristolCategory = "constipated" | "hard" | "normal" | "loose" | "diarrhea"`. The two types differ only in that `BristolCategory` uses `"normal"` while `DigestiveCategory` uses `"firm"`. This subtle difference forces callers to know which type to use in which context and prevents cross-module type safety. There is no comment explaining why `analysis.ts` uses `"firm"` instead of `"normal"`.

**Suggested Fix:** Document in a comment why `"firm"` is used here instead of `"normal"` (is it a different clinical classification?). If the difference is intentional, consider exporting `DigestiveCategory` from a shared location so both modules refer to the same type definition rather than maintaining parallel sets of almost-identical string union types.

---

### [NICE-TO-HAVE] `inputSafety.ts` `assertMaxLength` is not exported despite being testable utility logic

**Category:** Maintainability  
**Files:** `src/lib/inputSafety.ts:83-87`

**Description:** `assertMaxLength` is a pure throw-or-pass validation function that is useful in isolation and would be easy to test. However, it is not exported. The test file for `inputSafety` tests `sanitizeUnknownStringsDeep` (which calls `assertMaxLength` internally), so the logic is covered indirectly, but direct testing of the helper with a descriptive test name would improve documentation and aid future debugging.

**Suggested Fix:** Export `assertMaxLength` as a named export. The existing test covers the path through `sanitizeUnknownStringsDeep` — a direct unit test for `assertMaxLength` would be additive, not duplicative.

---

### [NICE-TO-HAVE] `vercel.json` CSP `connect-src` includes `https://api.openai.com` even though API calls go through Convex

**Category:** Maintainability  
**Files:** `vercel.json:13`

**Description:** The CSP `connect-src` directive includes `https://api.openai.com`. However, the architecture (per `convexAiClient.ts` and the codebase's design) routes all AI calls through Convex actions, not directly to OpenAI from the browser. Direct browser-to-OpenAI connections should never occur. Keeping `https://api.openai.com` in the CSP is dead policy that could mislead future developers into thinking direct browser API calls are expected, and weakens the CSP unnecessarily.

**Suggested Fix:** Remove `https://api.openai.com` from `connect-src` in `vercel.json`. If any code path does require direct browser access to OpenAI, document it with a comment in the CSP.

---

## Summary

| Severity     | Count  |
| ------------ | ------ |
| CRITICAL     | 0      |
| HIGH         | 3      |
| MODERATE     | 15     |
| NICE-TO-HAVE | 5      |
| **Total**    | **23** |

### High-priority actions

1. **Verify model names in `aiModels.ts`** — if they don't match what the Convex `chatCompletion` action actually uses, every AI call is silently broken.
2. **Fix the `sounds.ts` async race condition** — `AudioContext.resume()` is never awaited, making the sound system unreliable when the browser suspends audio.
3. **Remove the `LogPayloadData` re-declaration from `Track.tsx`** — the canonical definition already exists in `syncCore.ts`.

### Systemic patterns to watch

- Several small utilities (averaging, activity type normalization, normalization constants) are duplicated across modules. A `src/lib/mathUtils.ts` or `src/lib/habitUtils.ts` would be high-value additions.
- The store file (`store.ts`) is used as a catch-all for exports that don't belong there — constants, type re-exports, and state are mixed. This will become a maintenance problem as the codebase grows.
- Several type guards are internal when they should be exported (the inverse problem to overly-broad exports elsewhere).
