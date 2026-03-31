/**
 * Barrel re-export for backward compatibility.
 *
 * The sync module has been decomposed into focused sub-modules:
 *   - syncCore.ts   — types, validators, sanitization (pure logic, no hooks)
 *   - syncLogs.ts   — log CRUD hooks + backup/export/delete
 *   - syncAi.ts     — AI analysis + conversation hooks
 *   - syncFood.ts   — food library, assessments, trials, ingredients
 *   - syncWeekly.ts — weekly digests + summaries
 *
 * All existing imports from "@/lib/sync" continue to work unchanged.
 */

// AI analysis + conversations
export {
  useAddAiAnalysis,
  useAddAssistantMessage,
  useAddUserMessage,
  useAiAnalysisHistory,
  useConversationByReport,
  useConversationHistory,
  useLatestSuccessfulAiAnalysis,
  useToggleReportStar,
} from "./syncAi";
// Core types and pure functions
export {
  asConvexId,
  type ConvexLogRow,
  type LogPayloadData,
  type SyncedLog,
  sanitizeLogData,
  toConvexFoodItem,
  toSyncedLogs,
  toValidatedSyncedLog,
} from "./syncCore";
// Food: library, assessments, trials, ingredients
export {
  type AllIngredientsResult,
  type ExternalNutritionSearchRow,
  type FoodLibraryEntry,
  type FoodTrialStatus,
  type IngredientExposureSummary,
  type IngredientOverrideRow,
  type IngredientOverrideStatus,
  type IngredientProfileRow,
  useAddFoodLibraryEntries,
  useAllAssessmentRecords,
  useAllFoods,
  useAllFoodTrials,
  useAllIngredientExposures,
  useBackfillIngredientExposures,
  useClearIngredientOverride,
  useCulprits,
  useFoodHistory,
  useFoodLibrary,
  useFoodTrial,
  useFoodTrialsByStatus,
  useIngredientExposureHistory,
  useIngredientOverrides,
  useIngredientProfiles,
  useMergeFoodLibraryDuplicates,
  useSafeFoods,
  useSearchIngredientNutritionApi,
  useSetIngredientOverride,
  useUpdateFoodLibraryEntry,
  useUpsertIngredientProfile,
} from "./syncFood";
// Log CRUD + data management
export {
  type AppBackupImportResult,
  type AppBackupPayload,
  useAddSyncedLog,
  useAllSyncedLogs,
  useDeleteAllSyncedData,
  useExportBackup,
  useImportBackup,
  useRemoveSyncedLog,
  useSyncedLogCount,
  useSyncedLogs,
  useSyncedLogsByRange,
  useUpdateSyncedLog,
} from "./syncLogs";

// Weekly digests + summaries
export {
  useAddWeeklySummary,
  useConversationsByDateRange,
  useCurrentWeekDigest,
  useLatestWeeklySummary,
  useSuggestionsByDateRange,
  useWeeklyDigests,
  useWeeklySummaryByWeek,
} from "./syncWeekly";
