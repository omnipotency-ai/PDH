/**
 * aiAnalysis.ts — thin re-export barrel (W3-07)
 *
 * The original 2178-line file has been split into three focused modules:
 *   - aiPrompts.ts       — system prompt construction, context builders, sanitization
 *   - aiParsing.ts       — response parsing, JSON extraction, validation
 *   - aiFetchInsights.ts — fetch orchestration, error handling, retry logic
 *
 * This barrel preserves the public API for all existing import sites.
 */

// ─── From aiPrompts ───────────────────────────────────────────────────────────

export type {
  AiNutritionistInsight,
  BowelEvent,
  BuildUserMessageParams,
  FoodItemDetail,
  FoodLog,
  FoodTrialSummaryInput,
  PreviousReport,
  PreviousWeeklySummary,
  RecentEventsResult,
  SuggestionHistoryEntry,
  WeeklyContext,
} from "./aiPrompts";

export {
  buildDeltaSignals,
  buildFoodContext,
  buildPartialDayContext,
  buildPatientSnapshot,
  buildRecentEvents,
  buildSystemPrompt,
  buildUserMessage,
  computeBristolTrend,
  getAiDisclaimer,
  getFoodWindowHours,
  sanitizeNameForPrompt,
  sanitizeProfileField,
  truncateForStorage,
} from "./aiPrompts";

// ─── From aiParsing ───────────────────────────────────────────────────────────

export {
  enforceNovelEducationalInsight,
  isRecord,
  parseAiInsight,
  toStringArray,
} from "./aiParsing";

// ─── From aiFetchInsights ─────────────────────────────────────────────────────

export type {
  EnhancedAiContext,
  FetchAiInsightsOptions,
  WeeklySummaryInput,
  WeeklySummaryResult,
} from "./aiFetchInsights";

export {
  fetchAiInsights,
  fetchWeeklySummary,
  TOKEN_WARNING_THRESHOLD,
} from "./aiFetchInsights";
