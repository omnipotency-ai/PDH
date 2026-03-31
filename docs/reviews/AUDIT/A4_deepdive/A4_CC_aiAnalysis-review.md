# Deep Review: `src/lib/aiAnalysis.ts`

**Date:** 2026-03-16
**Reviewer:** Claude Opus 4.6
**Lines:** 1953
**Overall assessment:** A well-structured, heavily-documented AI prompt engineering and response parsing module. The code is defensive, thoroughly sanitizes inputs, and handles malformed AI responses gracefully. However, the file is very large, has some locale-dependent date formatting, and carries a few `as` casts after sanitization.
**Risk level:** Medium

---

## Critical Issues

**None found.** The file handles security (input sanitization, rate limiting), error cases, and prompt injection resistance well.

---

## High Priority

### 1. Locale-dependent `formatTime` — non-deterministic across environments (lines 298–306)

```ts
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-GB", { ... });
}
```

This runs on the client but feeds data into the AI payload. `toLocaleString` can produce slightly different output depending on the browser/OS ICU dataset. Since this text becomes part of the AI prompt and is stored as food trial timestamps (line 1727), subtle differences could cause inconsistencies. Consider using a deterministic formatter (e.g., `Intl.DateTimeFormat` is fine but lock to a specific calendar, or use a manual formatter).

**Severity:** High — not a crash risk, but non-determinism in prompt context can cause AI reasoning drift or subtle storage mismatches.

### 2. `as` casts after `sanitizeUnknownStringsDeep` (lines 1645, 1649, 1653, 1658)

```ts
const safeLogs = sanitizeUnknownStringsDeep(logs, { ... }) as LogEntry[];
```

`sanitizeUnknownStringsDeep` returns `unknown`. The `as` casts assume the function preserves the structural shape, which is true by design but not enforced by the type system. If `sanitizeUnknownStringsDeep` ever strips keys or changes array structures, these casts would silently produce runtime errors.

**Severity:** High — the casts are justified today but fragile. A type-narrowing wrapper or branded return type on the sanitizer would be safer.

### 3. `getDaysPostOp` uses `new Date()` — drift across renders (line 313)

```ts
const now = new Date();
return Math.floor((now.getTime() - surgery.getTime()) / MS_PER_DAY);
```

Every call computes a fresh `now`. If `buildSystemPrompt` is called at 23:59:59, the daysPostOp value may differ from the `currentTime` in the user message (which also calls `new Date()` at line 1292). In practice this is a single-call flow so the window is tiny, but worth noting.

---

## Medium Priority

### 4. File length — 1953 lines (entire file)

This is the single largest lib file in the project. The prompt text alone (lines 839–1200) is ~360 lines. The `buildSystemPrompt` function (lines 622–1201) is ~580 lines. Consider splitting into:

- `aiPrompt.ts` — system prompt construction, tone matrix, directives
- `aiParsing.ts` — `parseAiInsight`, response parsing utilities
- `aiAnalysis.ts` — orchestration (`fetchAiInsights`, `fetchWeeklySummary`)

### 5. `buildLogContext` filters + sorts 6 times (lines 323–444)

Each log type does `recent.filter(...).sort(...).map(...)`. This is 6 passes over the `recent` array, each with a sort. For a 72-hour window this is fine, but a single-pass categorization with one sort per bucket would be cleaner.

**Severity:** Medium — performance is fine for expected data sizes (<500 logs/72h), but the pattern is unnecessarily repeated.

### 6. `fluidLogs` only reads `items[0]` (line 394)

```ts
const firstItem = log.data.items[0];
```

If a fluid log has multiple items, all but the first are silently dropped. This is intentional (fluid logs are single-item) but the assumption is not documented and there's no guard if the invariant changes.

### 7. `buildUserMessage` has 15 parameters (lines 1275–1291)

This function signature is very long. An options object would improve readability:

```ts
interface BuildUserMessageOptions {
  foodLogs: FoodLog[];
  bowelEvents: BowelEvent[];
  // ...
}
```

### 8. Duplicated `WeeklyContext` / `WeeklyDigestInput` types (lines 214–234)

These two interfaces are structurally identical. `WeeklyContext` is the internal shape, `WeeklyDigestInput` is the exported input. The mapping at lines 1735–1744 is a no-op identity transform. Consider using one type.

### 9. `formatFrequency` switch with string returns (lines 492–513)

This is a clean lookup table pattern but would be more maintainable as a `Record<string, string>`:

```ts
const FREQUENCY_LABELS: Record<string, string> = {
  more_than_once_per_day: "more than once per day",
  // ...
};
```

### 10. `educationalKey` normalization is basic (lines 130–139)

The dedup uses lowercased alphanumeric normalization, which works for exact-match dedup but won't catch semantic duplicates (e.g., "Meal volume and urgency" vs "How meal volume affects urgency"). This is acceptable since the fallback bank is small and curated, but the AI-generated insights could return semantically equivalent but textually distinct facts.

---

## Low Priority

### 11. `CONTEXT_WINDOW_HOURS = 72` is a magic number without explanation (line 236)

The constant is named but has no JSDoc explaining why 72 hours specifically. A comment like "3-day window covers typical post-op transit times" would help.

### 12. `entryType: "cycle"` is hardcoded as a literal type (line 291, 427)

The `ReproductiveLog` interface has `entryType: "cycle"` as a string literal, and the filter at line 421 checks for it. This works but the string could be a constant.

### 13. Token estimate is rough (lines 1768–1778)

`Math.ceil(content.length / 4)` is the standard char/4 heuristic. It's a rough estimate (actual BPE tokenization varies). Acceptable for a warning threshold, but the comment could note the approximation.

### 14. `TONE_MATRIX` fallback silently defaults (line 849)

```ts
TONE_MATRIX[`${prefs.approach}/${prefs.register}`] ??
  TONE_MATRIX["personal/everyday"];
```

If invalid values reach this, the fallback is silent. A `debugWarn` here would help surface misconfigured preferences.

### 15. `fetchWeeklySummary` doesn't validate the model parameter (line 1893)

Unlike `fetchAiInsights` which calls `getValidInsightModel(prefs.aiModel)`, the weekly summary function accepts `model` as a raw string default. It should validate:

```ts
const validatedModel = getValidInsightModel(model);
```

---

## Specific Recommendations (Top 5)

1. **Split the file into 3 modules** (`aiPrompt.ts`, `aiParsing.ts`, `aiAnalysis.ts`) — the current 1953-line file mixes prompt construction, response parsing, and API orchestration. This is the highest-leverage maintainability improvement.

2. **Validate model in `fetchWeeklySummary`** (line 1893) — call `getValidInsightModel(model)` the same way `fetchAiInsights` does. Currently an invalid model string passes straight through.

3. **Reduce `buildUserMessage` parameter count** — wrap the 15 parameters in an options object for readability and to prevent argument-order bugs.

4. **Eliminate the `WeeklyContext`/`WeeklyDigestInput` duplication** — use a single type; the identity mapping at lines 1735–1744 is pure overhead.

5. **Add a deterministic date formatter or test** — verify that `formatTime` produces consistent output across target environments, or replace with explicit formatting.

---

## Dead Code Found

**None.** All functions are either exported or called internally. No commented-out code blocks. No unreachable branches.

---

## Stale/Bad Comments Found

| Line | Issue                                                                                                                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28   | `// ─── Named constants (extracted from inline magic numbers)` — "extracted from" is an audit trail about how the code was written, not why the constants exist. Rephrase to what they control. |

Only line 28 qualifies as a stale audit-trail comment. The file is generally well-commented with "why" over "what".

---

## AI/Prompt-Specific Findings

**Prompt quality:** Excellent. The system prompt at lines 839–1200 is extremely well-structured with clear sections, explicit behavioral rules, a defined output JSON schema, and anti-repetition/anti-nagging constraints. The tone matrix (lines 466–485) cleanly separates voice from content.

**Prompt injection resistance:** The user payload is JSON-stringified (line 1410), which limits structural injection. Patient messages are sanitized via `sanitizeUnknownStringsDeep`. However, the prompt does instruct the AI to "read the patientMessages array" and "fulfil the request" (lines 861–866), which creates a tension — a determined user could craft messages that manipulate output. This is mitigated by the JSON output format requirement, but worth noting as an inherent design trade-off in a BYOK system.

**Token efficiency:** The system prompt is ~4000 tokens (estimated). This is heavy but justified by the complexity of the clinical reasoning framework. The prompt is not unnecessarily verbose — each section carries distinct behavioral instructions.

**Version tracking:** The prompt is not versioned. Consider adding a `PROMPT_VERSION` constant that gets logged alongside requests, so changes to the prompt can be correlated with behavior shifts in stored AI responses.

---

## Priority Matrix

| File                    | Critical | High | Medium | Low | Risk Level |
| ----------------------- | -------- | ---- | ------ | --- | ---------- |
| `src/lib/aiAnalysis.ts` | 0        | 3    | 7      | 5   | Medium     |
