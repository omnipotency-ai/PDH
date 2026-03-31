# Category 10: TODOs, Deferred Work & Unfinished Code

**Audit date:** 2026-02-28
**Scope:** `/Users/peterjamesblizzard/projects/caca_traca/src/`
**Files scanned:** All `.ts` and `.tsx` files (120+ files)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 4 |
| MODERATE | 10 |
| LOW | 9 |
| COULD BE IMPROVED | 8 |
| **Total** | **31** |

---

## HIGH

### H-01: `data: any` on core data types propagates untyped data throughout the app

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` line 310
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/sync.ts` line 15

**Code:**
```typescript
// store.ts:303-311
export interface LogEntry {
  id: string;
  timestamp: number;
  type: LogType;
  // data is typed loosely to remain compatible with aiAnalysis.ts which uses
  // optional chaining across all log types without narrowing. Use LogEntryData
  // for new code that narrows by type before accessing data fields.
  data: any;
}

// sync.ts:11-16
export type SyncedLog = {
  id: string;
  timestamp: number;
  type: "food" | "fluid" | "habit" | "activity" | "digestion" | "weight" | "reproductive";
  data: any;
};
```

**Impact:** The `any` type on `data` is the root cause of nearly all other `any` usage in the codebase. The comment in `store.ts` explicitly documents this as a known compromise. It forces all downstream consumers (TodayLog, analysis, sync functions) to use `any` casts when reading `data`, and prevents the TypeScript compiler from catching field-access mistakes. The discriminated union `LogEntryData` already exists but is not used by these core types.

**Recommendation:** Replace `data: any` with the existing `LogEntryData` discriminated union on both `LogEntry` and `SyncedLog`. This is a significant refactoring task that will fix ~25 downstream `any` usages across the codebase.

---

### H-02: Sync hook functions use `id as any` to circumvent Convex ID type checking

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/sync.ts` lines 68, 76, 114

**Code:**
```typescript
// sync.ts:66-69 — useRemoveSyncedLog
return (id: string) =>
  remove({
    id: id as any,
  });

// sync.ts:74-79 — useUpdateSyncedLog
return (payload: { id: string; timestamp: number; data: any }) =>
  update({
    id: payload.id as any,
    ...
  });

// sync.ts:114 — useToggleReportStar
return (id: string) => toggle({ id: id as any });
```

**Impact:** The `as any` casts bypass Convex's `Id<"logs">` / `Id<"aiAnalyses">` branded type safety. If a non-ID string is passed, the mutation will fail at runtime with no compile-time protection. This is a deliberate workaround to avoid threading Convex branded types through the component tree.

**Recommendation:** Accept `Id<"logs">` / `Id<"aiAnalyses">` in the public API signatures, or create a branded `LogId` type that both local and synced stores share.

---

### H-03: `useAddAiAnalysis` payload uses `any` for request/response/insight fields

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/sync.ts` lines 86-88

**Code:**
```typescript
return (payload: {
  timestamp: number;
  request: any;
  response: any;
  insight: any;
  model: string;
  durationMs: number;
  inputLogCount: number;
  error?: string;
}) => ...
```

**Impact:** No compile-time guarantee that the AI analysis payloads match expected shapes. A malformed `insight` object would be persisted to Convex and could break the Archive page or AI context when loaded later.

**Recommendation:** Type `request`, `response`, and `insight` with their actual shapes (`AiNutritionistInsight` for insight, structured message types for request/response).

---

### H-04: Weekly summary backup is saved to localStorage but never restored

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useWeeklySummaryAutoTrigger.ts` lines 127, 198, 201

**Code:**
```typescript
// Saves backup on attempt
localStorage.setItem("weekly-summary-backup", JSON.stringify(snapshot));

// Removes backup on success
localStorage.removeItem("weekly-summary-backup");

// On failure, logs that backup remains:
console.log("[Weekly Summary] Backup remains in localStorage for retry");
```

**Impact:** The backup is saved and the log says it "remains for retry," but there is no code anywhere in the codebase that reads the `weekly-summary-backup` key from localStorage to retry the generation. If the API call fails, the backup data is orphaned indefinitely.

**Recommendation:** Either implement a retry mechanism that checks localStorage on mount and retries the summary generation, or remove the backup logic and the misleading log message.

---

## MODERATE

### M-01: TEMP backward-compatibility code for walking habit / activity log merging

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/TodayLog.tsx` line 155

**Code:**
```typescript
// TEMP BACKWARD-COMPAT: while legacy activity walk logs still exist in parallel,
// merge walking habit taps into the walk activity display group to avoid duplicate rows.
if (isWalkingHabitLog(log, habits)) {
  const group = activityGroups.get("walk");
  ...
}
```

**Impact:** This is the only `// TEMP` comment in the entire codebase. It adds complexity to the TodayLog grouping logic to handle a data migration that may already be complete. If all legacy walk activity logs have been re-logged as habit taps, this code is dead weight.

**Recommendation:** Verify whether any users still have `type: "activity"` walk logs. If not, remove this backward-compatibility path.

---

### M-02: `applyFallbacks` uses `any` parameter and returns hardcoded fallback food

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` lines 1078, 1089-1092

**Code:**
```typescript
function applyFallbacks(parsed: any): AiNutritionistInsight {
  return {
    ...
    nextFoodToTry:
      parsed.nextFoodToTry && ... ? parsed.nextFoodToTry
        : {
            food: "Plain white rice",
            reasoning: "Safe default after any episode.",
            timing: "Next meal",
          },
    ...
    summary: typeof parsed.summary === "string" ? parsed.summary : "No summary available.",
  };
}
```

**Impact:** The hardcoded "Plain white rice" fallback will appear to the user as a real AI recommendation if the LLM response is malformed. "No summary available." similarly looks like a real response. The `any` parameter provides no type checking on the parsed object.

**Recommendation:** Type the parameter as `unknown` and use proper narrowing. Consider making fallback values visually distinct (e.g., prefixed with a warning) so users know the AI response was incomplete.

---

### M-03: `parsed as any` cast in weekly summary parser

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` line 1440

**Code:**
```typescript
const p = parsed as any;
const result: WeeklySummaryResult = {
  weeklySummary: typeof p.weeklySummary === "string" ? p.weeklySummary : "No summary available.",
  keyFoods: {
    safe: Array.isArray(p.keyFoods?.safe) ? p.keyFoods.safe : [],
    flagged: Array.isArray(p.keyFoods?.flagged) ? p.keyFoods.flagged : [],
    toTryNext: Array.isArray(p.keyFoods?.toTryNext) ? p.keyFoods.toTryNext : [],
  },
  carryForwardNotes: Array.isArray(p.carryForwardNotes) ? p.carryForwardNotes : [],
};
```

**Impact:** Same pattern as M-02. The `as any` cast skips type checking on the parsed JSON, and "No summary available." could appear as a real summary to the user.

**Recommendation:** Use `unknown` with runtime validation or a schema validator (e.g., Zod).

---

### M-04: `foodParsing.ts` creates its own OpenAI client instead of using the shared client

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/foodParsing.ts` line 261

**Code:**
```typescript
const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
```

**Impact:** Every other AI call site (`aiAnalysis.ts`, `habitCoaching.ts`) uses the shared `getOpenAIClient()` from `openaiClient.ts` which caches the client instance. `foodParsing.ts` creates a fresh OpenAI instance on every call, importing the full OpenAI library each time.

**Recommendation:** Replace with `getOpenAIClient(apiKey)` for consistency and to benefit from client caching.

---

### M-05: Three deprecated re-exports still in use

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` line 19: `DEFAULT_AI_MODEL` (deprecated, re-exports `DEFAULT_INSIGHT_MODEL`)
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/foodParsing.ts` line 3-4: `FOOD_PARSE_MODEL` (deprecated, re-exports `BACKGROUND_MODEL`)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/ActivitySection.tsx` line 168-169: `ActivitySection` (deprecated, re-exports `HealthSection`)

**Impact:** These deprecated exports may still be imported elsewhere. They add confusion about which is the canonical import.

**Recommendation:** Search for consumers of these deprecated exports and migrate them to the canonical imports, then remove the deprecated re-exports.

---

### M-06: Stale JSDoc comment says 18:00 boundary but code uses 21:00

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useWeeklySummaryAutoTrigger.ts` lines 89-90

**Code:**
```typescript
/**
 * Auto-triggers summary generation at each half-week boundary (Sunday 18:00 and Wednesday 18:00).
```

But the actual boundary constant on line 16 is:
```typescript
const BOUNDARY_HOUR = 21; // 9:00 PM local time
```

**Impact:** Misleading documentation. The JSDoc says 18:00, but the code uses 21:00 (9 PM). The inline comment on `BOUNDARY_HOUR` is correct; only the function's JSDoc is stale.

**Recommendation:** Update the JSDoc to say "Sunday 21:00 and Wednesday 21:00".

---

### M-07: Magic number 2.20462 (kg-to-lbs conversion factor) repeated 10 times

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/formatWeight.ts` lines 3, 11
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/WeightTrendCard.tsx` lines 11, 51
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/TodayLog.tsx` lines 2312, 2320, 2330, 2343, 2888
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/ActivitySection.tsx` line 66

**Impact:** If the conversion factor ever needs adjustment (it won't, but the DRY principle applies), every instance must be found and changed. The `formatWeight.ts` utility exists but many components inline the conversion instead of using it.

**Recommendation:** Extract `const KG_TO_LBS = 2.20462` to a shared constants file and use `formatWeight()` / `formatWeightDelta()` from `formatWeight.ts` everywhere.

---

### M-08: `Record<string, any>` used for log data mutations in TodayLog

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/TodayLog.tsx` lines 679, 695, 1311, 1730, 2346, 2508

**Code:**
```typescript
const nextData: Record<string, any> = { ...(log.data ?? {}) };
const existingItems: Array<Record<string, any>> = Array.isArray(nextData.items) ...
```

**Impact:** This is a downstream consequence of H-01. Each inline edit save handler constructs a `Record<string, any>` for the updated data. Type errors in field names or values will not be caught at compile time.

**Recommendation:** This will be naturally resolved by fixing H-01 (typing the `data` field properly).

---

### M-09: Lint suppression for React hook dependency

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useHabitStreaks.ts` line 31

**Code:**
```typescript
// biome-ignore lint/correctness/useExhaustiveDependencies: todayKey derives from now
const last7DaysRange = useMemo(() => {
```

**Impact:** This is the only lint suppression in the entire `src/` directory, and it is well-documented with a clear justification. Low risk.

**Recommendation:** Acceptable as-is. The justification is correct: `todayKey` only changes when the calendar date changes, avoiding unnecessary recomputation on the 60-second timer.

---

### M-10: `catch (err: any)` pattern used for error message access

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx` lines 686, 718
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/ActivitySection.tsx` line 72
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/CycleHormonalSection.tsx` line 142

**Code:**
```typescript
} catch (err: any) {
  toast.error(err?.message ?? "Failed to delete entry.");
}
```

**Impact:** `catch (err: any)` bypasses TypeScript's strict error typing. The pattern `err?.message` is safe at runtime but does not leverage the type system.

**Recommendation:** Use `catch (err: unknown)` and the existing `getErrorMessage()` utility from `src/lib/errors.ts`, which already handles unknown error types correctly.

---

## LOW

### L-01: console.log statements in weekly summary auto-trigger

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useWeeklySummaryAutoTrigger.ts` lines 128, 174, 193, 201

**Code:**
```typescript
console.log(`[Weekly Summary] Backed up ${conversations.length} messages to localStorage`);
console.log(`[Weekly Summary] Auto-generating for week of ${periodLabel}...`);
console.log(`[Weekly Summary] Saved summary for week of ${periodLabel} (${response.durationMs}ms)`);
console.log("[Weekly Summary] Backup remains in localStorage for retry");
```

**Impact:** These are informational development logs left in production code. They will appear in every user's browser console.

**Recommendation:** Either remove or gate behind a `DEBUG` flag / environment variable.

---

### L-02: console.error for AI-related error logging (legitimate but noisy)

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/foodParsing.ts` lines 276, 284, 289
- `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useCoaching.ts` line 79
- `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useAiInsights.ts` lines 219, 222, 238
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/AiInsightsSection.tsx` line 114
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/AiSuggestionsCard.tsx` line 69
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/HabitDetailSheet.tsx` line 274

**Impact:** These are all error-logging statements for AI call failures. They log to the browser console which is reasonable for debugging, but in production they could be noisy if the API key is invalid or the service is down.

**Recommendation:** These are acceptable for now. Consider a structured logging utility in the future.

---

### L-03: console.warn for high token count

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` lines 1298-1301

**Code:**
```typescript
if (estimatedTokens > 50000) {
  console.warn(
    `[Dr. Poo] High token estimate: ~${estimatedTokens} tokens. Consider reducing context.`,
  );
}
```

**Impact:** Useful development warning but will appear in user's console if they have extensive conversation history. The 50000 token threshold is a magic number.

**Recommendation:** Either extract the threshold to a named constant or remove the warning from production builds.

---

### L-04: console.error in route error boundary

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/routeTree.tsx` line 84

**Code:**
```typescript
componentDidCatch(error: unknown) {
  console.error("Route render error:", error);
}
```

**Impact:** Appropriate for an error boundary. This is standard React error reporting.

**Recommendation:** Acceptable as-is. Could be enhanced with an error reporting service in the future.

---

### L-05: Empty catch block swallows AudioContext resume error

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/sounds.ts` line 50

**Code:**
```typescript
ctx.resume().catch(() => {});
```

**Impact:** Intentionally swallows the error when AudioContext cannot be resumed (e.g., autoplay policy). The sound simply won't play, which is acceptable UX. However, the empty catch gives no signal that audio is blocked.

**Recommendation:** Acceptable as-is. The alternative (logging) would be noisy since this fires on every user interaction until the context is resumed.

---

### L-06: Silent catch blocks in TodayLog inline edit save handlers

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/TodayLog.tsx` lines 754, 1329, 1595, 1748, 1858, 2364, 2537

**Code (7 instances, all identical pattern):**
```typescript
try {
  setSaving(true);
  await onSave(entry.id, nextData, newTimestamp);
  setEditing(false);
} catch {
  /* keep open */
} finally {
  setSaving(false);
}
```

**Impact:** The `onSave` callback (from `Track.tsx` line 691) already shows a `toast.error()` and re-throws the error. These catch blocks intentionally swallow the re-thrown error to keep the inline editor open so the user can retry. The comment "keep open" documents the intent. This is acceptable behavior.

**Recommendation:** Acceptable as-is. The user sees the toast error from the `onSave` handler. The catch here just prevents the error from propagating further.

---

### L-07: Silent catch in WaitlistForm

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/landing/WaitlistForm.tsx` line 50

**Code:**
```typescript
} catch {
  toast.error("Something went wrong. Please try again.");
}
```

**Impact:** The error details are not logged. If the waitlist submission fails, there's no way to diagnose why from the console.

**Recommendation:** Add `console.error` or log the error to understand failure reasons.

---

### L-08: Silent catch in DigestiveCorrelationGrid date formatting

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/DigestiveCorrelationGrid.tsx` line 53

**Code:**
```typescript
try {
  return format(parseISO(dateStr), "MMM d");
} catch {
  return dateStr;
}
```

**Impact:** Silently falls back to the raw date string if parsing fails. This is reasonable defensive coding.

**Recommendation:** Acceptable as-is.

---

### L-09: Silent catch in habitCoaching JSON parse

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitCoaching.ts` line 584

**Code:**
```typescript
try {
  parsed = JSON.parse(raw);
} catch {
  throw new Error(`AI suggestions returned invalid JSON: ${raw.slice(0, 200)}`);
}
```

**Impact:** This is not actually a silent catch -- it re-throws with a descriptive error. Good error handling.

**Recommendation:** No action needed. Listed for completeness.

---

## COULD BE IMPROVED

### CI-01: `store.ts` migration function uses `any` for persisted state

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` line 697

**Code:**
```typescript
migrate: (persisted: any, _version: number) => {
```

**Impact:** The migration function operates on deserialized state from IndexedDB. It inherently receives untyped data. Using `any` here is a pragmatic choice since the shape of old persisted state versions is unknowable at compile time.

**Recommendation:** Consider typing as `unknown` and narrowing with runtime checks, though the current code already performs defensive checks like `typeof persisted !== "object"`.

---

### CI-02: `any[]` casts in TodayLog for reading food items from log data

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/TodayLog.tsx` lines 631-632, 682, 1283-1284, 1302

**Code:**
```typescript
const items: any[] = Array.isArray(log.data?.items) ? log.data.items : [];
return items.map((item: any) => ({
  name: String(item?.name ?? ""),
  quantity: item?.quantity != null && Number.isFinite(Number(item.quantity)) ...
```

**Impact:** Downstream consequence of H-01. The code defensively coerces every field to its expected type, which is good runtime behavior. The `any` type just means the compiler cannot verify correctness.

**Recommendation:** Will be resolved when H-01 is fixed.

---

### CI-03: `any` type in `aiAnalysis.ts` for food item mapping

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` line 206

**Code:**
```typescript
.map((item: any) => {
  const name = String(item?.name ?? "").trim();
```

**Impact:** Same pattern as CI-02. The code reads food items from the loosely-typed `log.data.items` array.

**Recommendation:** Will be resolved when H-01 is fixed.

---

### CI-04: `any` type in `analysis.ts` for food item and digestive data normalization

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/analysis.ts` lines 188, 767

**Code:**
```typescript
items.forEach((item: any, index: number) => {
  ...
function normalizeDigestiveCategory(data: any): DigestiveCategory | null {
```

**Impact:** Same root cause as H-01. Both functions operate on `log.data` which is typed as `any`.

**Recommendation:** Will be resolved when H-01 is fixed.

---

### CI-05: Duplicate `formatWeight` function in WeightTrendCard

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/WeightTrendCard.tsx` lines 9-14

**Code:**
```typescript
function formatWeight(kg: number, unit: "kg" | "lbs"): string {
  if (unit === "lbs") {
    return `${(kg * 2.20462).toFixed(1)} lbs`;
  }
  return `${kg.toFixed(1)} kg`;
}
```

**Impact:** This is an exact duplicate of the function in `/Users/peterjamesblizzard/projects/caca_traca/src/lib/formatWeight.ts`. The shared utility already exists but is not used here.

**Recommendation:** Import from `@/lib/formatWeight` instead of re-declaring locally.

---

### CI-06: Magic numbers for conversation/token limits

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` lines 1217-1220, 1245-1248, 1298

**Code:**
```typescript
// Limit to last 20 messages to control token usage
.slice(-20);

// Limit food trials to most recently assessed 50
.slice(0, 50);

// Token threshold
if (estimatedTokens > 50000) {
```

**Impact:** These limits (20 messages, 50 food trials, 50000 token threshold) are embedded inline with only comments explaining them. Changing them requires finding and updating the code.

**Recommendation:** Extract to named constants (e.g., `MAX_CONVERSATION_MESSAGES = 20`, `MAX_FOOD_TRIALS = 50`, `TOKEN_WARNING_THRESHOLD = 50_000`).

---

### CI-07: `BOUNDARY_HOUR` and `OBSERVATION_HOURS` are hardcoded with no user configurability

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useWeeklySummaryAutoTrigger.ts` line 16: `BOUNDARY_HOUR = 21`
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/ObservationWindow.tsx` line 10: `OBSERVATION_HOURS = 6`
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/ObservationWindow.tsx` line 11: `TRANSIT_MINUTES = 55`

**Impact:** These are properly extracted as named constants (good), but they're hardcoded to specific values that may not suit all users. The weekly summary boundary assumes all users are in Barcelona CET/CEST timezone (per the comment on line 13). The observation window assumes a fixed 6-hour window with 55-minute transit time.

**Recommendation:** Consider making these configurable in user settings in the future, especially the timezone-dependent `BOUNDARY_HOUR`. The transit/observation constants are clinically motivated and less likely to need user configuration.

---

### CI-08: `dangerouslyAllowBrowser: true` on OpenAI client

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/openaiClient.ts` line 20
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/foodParsing.ts` line 261

**Code:**
```typescript
cachedClient = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
```

**Impact:** The OpenAI SDK warns against browser usage because it exposes the API key in client-side code. This app stores the API key in the user's browser (Zustand/IndexedDB) by design -- the user provides their own key. The `dangerouslyAllowBrowser` flag is required for this architecture.

**Recommendation:** Acceptable given the architecture. The user provides their own API key. This is an inherent tradeoff of the local-first design. A future improvement could route AI calls through Convex backend functions to avoid exposing the key in client-side network requests.

---

## Patterns Not Found (Clean)

The following patterns were searched for and **not found** in the codebase:

- **`@ts-ignore` / `@ts-expect-error`**: Zero instances. All TypeScript issues are handled without compiler escapes.
- **Empty event handlers** (`onClick={() => {}}`): Zero instances. All handlers have implementations.
- **Placeholder/stub functions**: No functions return dummy data or have empty implementations.
- **Commented-out feature code**: No blocks of commented-out code were found.
- **Feature stubs**: No components are wired up without implementations.
- **`// FIXME` / `// HACK` / `// XXX`**: Zero instances.
- **`eslint-disable`**: Zero instances (project uses Biome, not ESLint).
- **`biome-ignore`**: Only one instance (L-09/M-09, well-justified).

---

## Dependency Map

Many findings are interconnected. Fixing H-01 (typing `data: any` on `LogEntry` and `SyncedLog`) would cascade and resolve:
- H-03 (sync hook `any` payload types)
- M-08 (`Record<string, any>` in TodayLog)
- CI-02, CI-03, CI-04 (downstream `any` casts)

This single change would eliminate approximately 25 of the 31 `any` usages found in the codebase.
