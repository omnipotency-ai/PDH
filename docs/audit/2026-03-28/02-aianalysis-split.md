Now I have enough information. Let me create a detailed split plan document. Based on my analysis, here's the split plan:

---

## WQ-108: Split Plan for `src/lib/aiAnalysis.ts` (2657 LOC)

### Executive Summary

`src/lib/aiAnalysis.ts` is a monolithic module combining prompt engineering, data transformation, AI API calls, and response parsing. The proposed split divides the code into **four focused modules** with clear responsibilities:

1. **`aiPrompts.ts`** (700-800 LOC) — System prompts, user message templates, structure/tone/length directives
2. **`aiParsing.ts`** (200-250 LOC) — JSON validation, response parsing, type guards
3. **`aiFetchInsights.ts`** (900-1000 LOC) — Main API call orchestration and entry points
4. **`aiContextBuilders.ts`** (800-900 LOC) — Data aggregation and context transformation helpers
5. **Shared types/constants** stay in `aiAnalysis.ts` as a barrel export (re-exports from new modules)

---

## Current Structure Analysis

### Exports (29 public items)

| Category | Count | Items |
|----------|-------|-------|
| Types | 14 | `AiNutritionistInsight`, `PreviousReport`, `FoodTrialSummaryInput`, `WeeklyDigestInput`, `FoodItemDetail`, `FoodLog`, `BowelEvent`, `RecentEventsResult`, `PreviousWeeklySummary`, `SuggestionHistoryEntry`, `HabitCorrelationInsight`, `EnhancedAiContext`, `FetchAiInsightsOptions`, `WeeklySummaryInput`, `WeeklySummaryResult` |
| Functions | 11 | `getAiDisclaimer`, `getFoodWindowHours`, `buildRecentEvents`, `computeBristolTrend`, `buildPatientSnapshot`, `buildDeltaSignals`, `buildFoodContext`, `buildPartialDayContext`, `buildUserMessage`, `parseAiInsight`, `fetchAiInsights`, `fetchWeeklySummary` |
| Constants | 1 | `TOKEN_WARNING_THRESHOLD` |

### Current Consumers

- **`useAiInsights.ts`** → `FetchAiInsightsOptions`, `fetchAiInsights`, `PreviousReport`, `parseAiInsight`
- **`useWeeklySummaryAutoTrigger.ts`** → `fetchWeeklySummary`
- **`foodSafetyUtils.ts`** → `parseAiInsight`
- **`DrPooReport.tsx`** → `getAiDisclaimer`
- **`Archive.tsx`** → `parseAiInsight`
- **`syncAi.ts`** → `parseAiInsight`
- **Tests** → All building/parsing functions for validation

---

## Proposed Split

### 1. `src/lib/aiPrompts.ts` (700-800 LOC)

**Responsibility:** All prompt engineering, formatting templates, and LLM instruction text.

**Exports:**
- `buildSystemPrompt(profile, prefs): string`
- `buildUserMessage(params): string`
- `buildRecentEvents(logs, profile): RecentEventsResult`
- `buildPatientSnapshot(profile, foodTrials, digests): Record<string, unknown>`
- `buildDeltaSignals(logs, foodTrials): Record<string, unknown>`
- `buildFoodContext(foodTrials, logs, profile): Record<string, unknown>`
- `buildPartialDayContext(foodLogs, bowelEvents, now): Record<string, unknown>`
- `computeBristolTrend(weeklyDigests): string`
- `getAiDisclaimer(model): string`
- Helper functions:
  - `buildSystemPrompt` (existing, ~600 LOC of intricate logic)
  - `buildSmokingContext`, `buildAlcoholContext`, `buildSubstanceContext`
  - `buildStructureDirective`, `buildLengthDirective`
  - `buildMealScheduleText`
  - `buildBaselineContext`
  - Log mapping functions: `mapFoodLogs`, `mapBowelEvents`, `mapHabitLogs`, `mapFluidLogs`, `mapActivityLogs`, `mapReproductiveLogs`
  - Utility: `formatTime`, `getDaysPostOp`, `getBmi`, `formatFrequency`, `formatDeltaLine`
  - Educational insight logic: `educationalKey`, `normalizeEducationalKey`, `enforceNovelEducationalInsight`, `collectEducationalKeys`, `pickFallbackEducationalInsight`

**Internal Dependencies:**
- `aiModels` (getModelLabel, getValidInsightModel)
- `reproductiveHealth` (calculateCycleDay, calculateGestationalAgeFromDueDate)
- `timeConstants` (MS_PER_HOUR, MS_PER_DAY)
- `featureFlags` (FEATURE_FLAGS)
- Types from `domain`

**Internal Interfaces (Internal only):**
- `HabitLog`, `FluidLog`, `ActivityLog`, `ReproductiveLog`, `LogCutoffs`

**Internal Constants:**
- `MAX_CONVERSATION_MESSAGES`
- `FALLBACK_EDUCATIONAL_INSIGHTS`
- `VALID_EXPERIMENT_STATUSES`
- `MAX_PREFERRED_NAME_LENGTH`
- `MAX_FOOD_WINDOW_HOURS`
- `TONE_MATRIX`
- `MAX_IN_TRANSIT_ITEMS`
- `MIN_TRANSIT_HOURS`
- `WEEKLY_SUMMARY_SYSTEM_PROMPT`

**Shared Types (Import from aiAnalysis barrel):**
- `AiNutritionistInsight`
- `FoodItemDetail`, `FoodLog`, `BowelEvent`, `RecentEventsResult`
- `FoodTrialSummaryInput`, `WeeklyDigestInput`
- `PreviousWeeklySummary`, `SuggestionHistoryEntry`, `HabitCorrelationInsight`
- Enums/types from `domain`

---

### 2. `src/lib/aiParsing.ts` (200-250 LOC)

**Responsibility:** Response validation, JSON parsing, type guards, and response structure enforcement.

**Exports:**
- `parseAiInsight(raw): AiNutritionistInsight | null`
- `parseWeeklySummary(raw): WeeklySummaryResult`
- Helper type guards:
  - `isRecord(value): boolean`
  - `toStringArray(value): string[]`

**Internal Functions:**
- Educational insight deduplication (`enforceNovelEducationalInsight` — actually belongs here, not in prompts)
- Constants specific to parsing:
  - `VALID_EXPERIMENT_STATUSES`
  - `DEFAULT_FOOD_SUGGESTION`

**Shared Types (Import from aiAnalysis barrel):**
- `AiNutritionistInsight`
- `StructuredFoodAssessment`, `LifestyleExperimentStatus`
- `PreviousReport`, `WeeklySummaryResult`

**Note on WQ-194 (duplicate types):**
- `EducationalInsightValue` is duplicated; define once here as a shared type

---

### 3. `src/lib/aiFetchInsights.ts` (900-1000 LOC)

**Responsibility:** Main API orchestration, message assembly, rate limiting, error handling, and top-level async entry points.

**Exports:**
- `fetchAiInsights(callAi, apiKey, logs, ...): Promise<AiAnalysisResult>`
- `fetchWeeklySummary(callAi, apiKey, input, model): Promise<...>`
- `type FetchAiInsightsOptions` interface

**Internal Interfaces:**
- `AiAnalysisResult` (stores request/response/duration metadata)
- `ConversationMessage`

**Internal Functions:**
- `groupSuggestions(suggestions): SuggestionHistoryEntry[]`
- `truncateForStorage(value, maxLength): string`
- `sanitizeNameForPrompt(name): string`

**Internal Constants:**
- `STORAGE_TRUNCATION_SUFFIX`
- `TOKEN_WARNING_THRESHOLD` (promoted to shared export for metrics)

**Dependencies:**
- `aiPrompts` (buildSystemPrompt, buildRecentEvents, buildPatientSnapshot, buildDeltaSignals, buildFoodContext, buildUserMessage, buildPartialDayContext)
- `aiParsing` (parseAiInsight)
- `aiModels` (getValidInsightModel)
- `aiRateLimiter` (checkRateLimit)
- `convexAiClient` (ConvexAiCaller type)
- `inputSafety` (sanitizeUnknownStringsDeep, INPUT_SAFETY_LIMITS)
- `errors` (getErrorMessage)
- `debugLog` (debugWarn)
- Types from `domain`

**Shared Types (Import from aiAnalysis barrel):**
- `AiNutritionistInsight`, `PreviousReport`
- `LogEntry`, `HealthProfile`, `DrPooReply`, `AiPreferences`
- `EnhancedAiContext`, `WeeklyDigestInput`, `WeeklySummaryInput`, `WeeklySummaryResult`

---

### 4. `src/lib/aiContextBuilders.ts` (800-900 LOC)

**Responsibility:** Data aggregation and context transformation helpers that feed into prompts. (This may be a minor module, or these can stay distributed — see decision below.)

**Exports:**
- `buildRecentEvents(logs, profile): RecentEventsResult` — **MOVE to aiPrompts** (used in buildUserMessage)
- `buildPatientSnapshot(...): Record<string, unknown>` — **MOVE to aiPrompts**
- `buildDeltaSignals(...): Record<string, unknown>` — **MOVE to aiPrompts**
- `buildFoodContext(...): Record<string, unknown>` — **MOVE to aiPrompts**

**Decision:** These context builders are tightly coupled to prompt formatting and are called directly in `buildUserMessage` and `fetchAiInsights`. They should **remain in `aiPrompts.ts`** rather than being split into a separate module. Creating a 4th module would fragment related logic without clear benefit.

---

### 5. **Shared Types / Barrel Export (`src/lib/aiAnalysis.ts` refactored)**

**Retain in `aiAnalysis.ts` only:**
- Type exports (re-exports from modules)
- Shared interface definitions that are used across multiple modules
- Barrel re-exports for backward compatibility
- `TOKEN_WARNING_THRESHOLD` constant (used in tests and consumers)

**New structure:**
```typescript
// Re-export public types from new modules
export type { AiNutritionistInsight };
export type {
  PreviousReport,
  FoodTrialSummaryInput,
  WeeklyDigestInput,
  FoodItemDetail,
  FoodLog,
  BowelEvent,
  RecentEventsResult,
} from "./aiPrompts";

export type {
  PreviousWeeklySummary,
  SuggestionHistoryEntry,
  HabitCorrelationInsight,
  EnhancedAiContext,
} from "./aiPrompts"; // shared context types

export { TOKEN_WARNING_THRESHOLD } from "./aiFetchInsights";
export { getAiDisclaimer } from "./aiPrompts";
export { parseAiInsight } from "./aiParsing";
export { fetchAiInsights, fetchWeeklySummary } from "./aiFetchInsights";
export type { FetchAiInsightsOptions } from "./aiFetchInsights";

// Keep backward-compat aliases
export { buildRecentEvents, buildPatientSnapshot, buildDeltaSignals, buildFoodContext, buildPartialDayContext, buildUserMessage, computeBristolTrend, getFoodWindowHours } from "./aiPrompts";
```

---

## Shared Types & Constants

### Types Required Across All Modules

These should be defined in `domain` or re-exported via barrel:

| Type | Current Location | Used In |
|------|------------------|---------|
| `AiNutritionistInsight` | `domain` | all modules |
| `HealthProfile`, `LogEntry`, `DrPooReply`, `AiPreferences` | `domain` | prompts, fetch |
| `StructuredFoodAssessment`, `LifestyleExperimentStatus` | `domain` | parsing |
| `BaselineAverages`, `BaselineDelta` | `domain` | prompts |

### Constants Across Modules

| Constant | Current | Target Module | Shared? |
|----------|---------|---------------|---------|
| `MAX_CONVERSATION_MESSAGES` | aiAnalysis | aiPrompts | No (internal) |
| `TOKEN_WARNING_THRESHOLD` | aiAnalysis | aiFetchInsights | **Yes** (exported) |
| `STORAGE_TRUNCATION_SUFFIX` | aiAnalysis | aiFetchInsights | No (internal) |
| `VALID_EXPERIMENT_STATUSES` | aiAnalysis | aiParsing | No (internal) |
| `MAX_PREFERRED_NAME_LENGTH` | aiAnalysis | aiPrompts | No (internal) |
| `MAX_FOOD_WINDOW_HOURS` | aiAnalysis | aiPrompts | No (internal) |
| `FALLBACK_EDUCATIONAL_INSIGHTS` | aiAnalysis | aiPrompts | No (internal) |
| `TONE_MATRIX` | aiAnalysis | aiPrompts | No (internal) |
| `MAX_IN_TRANSIT_ITEMS`, `MIN_TRANSIT_HOURS` | aiAnalysis | aiPrompts | No (internal) |
| `WEEKLY_SUMMARY_SYSTEM_PROMPT` | aiAnalysis | aiFetchInsights | No (internal) |
| `DEFAULT_FOOD_SUGGESTION` | aiAnalysis | aiParsing | No (internal) |

---

## Import Dependencies (After Split)

### `aiPrompts.ts` imports:
```typescript
import { getModelLabel } from "@/lib/aiModels";
import { calculateCycleDay, calculateGestationalAgeFromDueDate } from "@/lib/reproductiveHealth";
import { MS_PER_DAY, MS_PER_HOUR } from "@/lib/timeConstants";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import type { AiNutritionistInsight, ... } from "@/types/domain";
```

### `aiParsing.ts` imports:
```typescript
import type { AiNutritionistInsight, StructuredFoodAssessment, ... } from "@/types/domain";
```

### `aiFetchInsights.ts` imports:
```typescript
import { checkRateLimit } from "@/lib/aiRateLimiter";
import type { ConvexAiCaller } from "@/lib/convexAiClient";
import { getErrorMessage } from "@/lib/errors";
import { INPUT_SAFETY_LIMITS, sanitizeUnknownStringsDeep } from "@/lib/inputSafety";
import { getValidInsightModel } from "@/lib/aiModels";
import { debugWarn } from "@/lib/debugLog";

import {
  buildSystemPrompt,
  buildRecentEvents,
  buildPatientSnapshot,
  buildDeltaSignals,
  buildFoodContext,
  buildUserMessage,
  buildPartialDayContext,
} from "@/lib/aiPrompts";
import { parseAiInsight } from "@/lib/aiParsing";
```

### Consumer update (e.g., `useAiInsights.ts`):
```typescript
// No changes needed — all current imports work via barrel
import {
  type FetchAiInsightsOptions,
  fetchAiInsights,
  type PreviousReport,
  parseAiInsight,
} from "@/lib/aiAnalysis";
```

---

## Circular Dependency Risks

### Risk Analysis

**Between `aiPrompts.ts` and `aiFetchInsights.ts`:**
- `aiFetchInsights` calls `buildUserMessage`, `buildPatientSnapshot`, etc. from `aiPrompts` ✓ (one-way dependency, safe)
- `aiPrompts` does NOT import from `aiFetchInsights` ✓ (no cycle)

**Between `aiParsing.ts` and `aiFetchInsights.ts`:**
- `aiFetchInsights` calls `parseAiInsight` from `aiParsing` ✓ (one-way dependency)
- `aiParsing` does NOT import from `aiFetchInsights` ✓ (no cycle)

**Between `aiPrompts.ts` and `aiParsing.ts`:**
- Neither imports from the other ✓ (independent)

**Barrel export (`aiAnalysis.ts`):**
- Acts as re-export hub only; does not import logic implementations ✓ (safe)

**Verdict:** No circular dependency risks.

---

## Related Work Queue Items

### WQ-193: Reduce `fetchAiInsights` parameter count (15 params)

**Current signature:**
```typescript
fetchAiInsights(
  callAi,
  apiKey,
  logs,
  previousReports,
  patientMessages,
  healthProfile,
  enhancedContext,
  aiPreferences,
  options
)
```

**Recommendation after split:**
- Keep as-is for now (split does not solve this)
- Future: Consider object destructuring wrapper or batched context object
- Note in `aiFetchInsights.ts` as TODO for next refactor

### WQ-194: Duplicate types

**Current issues:**
- `EducationalInsightValue` is redefined; should be a single type in `aiParsing.ts`
- Move `EducationalInsightValue = NonNullable<AiNutritionistInsight["educationalInsight"]>` to `aiParsing.ts`
- May be other internal type duplicates — audit during split

### WQ-195: Undocumented constant

**Likely candidate:**
- `FALLBACK_EDUCATIONAL_INSIGHTS` in `aiPrompts.ts` — add JSDoc explaining why it exists and how it's used

### WQ-196: Model validation

**Related to split:**
- `getValidInsightModel` call in `fetchAiInsights` — document assumptions about model availability
- Consider extracting model prep logic to a helper in `aiFetchInsights.ts`

---

## Split Execution Checklist

### Phase 1: Create new files with exports

- [ ] Create `src/lib/aiPrompts.ts` with all prompt/context builders and their dependencies
- [ ] Create `src/lib/aiParsing.ts` with parsing logic and type guards
- [ ] Create `src/lib/aiFetchInsights.ts` with API orchestration (keep heavy lifting here)
- [ ] Update `src/lib/aiAnalysis.ts` to re-export from new modules only

### Phase 2: Update imports in consumers

- [ ] No changes needed if using barrel export (`aiAnalysis.ts`)
- [ ] Verify tests still import via barrel

### Phase 3: Verify & validate

- [ ] Run all tests: `bun run test` — should pass without modification
- [ ] Run typecheck: `bun run typecheck`
- [ ] Run linter: `bun run lint:fix`
- [ ] Verify no dead code or circular imports

### Phase 4: Documentation

- [ ] Add module-level JSDoc to each new file
- [ ] Document internal constants per WQ-195
- [ ] Update CLAUDE.md or create ADR if architectural decision is significant

---

## File Size Estimates

| Module | LOC | Comments |
|--------|-----|----------|
| `aiPrompts.ts` | 750 | buildSystemPrompt dominates (~600 LOC) |
| `aiParsing.ts` | 220 | Mostly parseAiInsight validation |
| `aiFetchInsights.ts` | 950 | fetchAiInsights + fetchWeeklySummary with full orchestration |
| `aiAnalysis.ts` (refactored) | 40 | Barrel re-exports only |
| **Total** | **1960** | Reduction from 2657 due to removal of duplicate definitions/comments |

---

## Summary

This split achieves:

1. **Clear responsibility separation:**
   - Prompts/context building (aiPrompts)
   - Response parsing (aiParsing)
   - API coordination (aiFetchInsights)

2. **Maintainability:**
   - Prompt engineers focus on `aiPrompts.ts`
   - Type/validation experts focus on `aiParsing.ts`
   - Integration engineers focus on `aiFetchInsights.ts`

3. **No breaking changes:**
   - Barrel export maintains backward compatibility for all consumers
   - Tests continue to import via barrel without modification

4. **Identified technical debt (for follow-up):**
   - WQ-193: Reduce parameter count (consider context object batching)
   - WQ-194: Remove `EducationalInsightValue` duplication
   - WQ-195: Document `FALLBACK_EDUCATIONAL_INSIGHTS` rationale
   - WQ-196: Validate model selection assumptions