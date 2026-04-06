/**
 * Food-related sync hooks: food library, food assessments, food trials,
 * ingredient exposures, ingredient overrides, ingredient profiles,
 * and nutrition API.
 */

import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useMemo } from "react";
import { sanitizePlainText, sanitizeUnknownStringsDeep } from "@/lib/inputSafety";
import { api } from "../../convex/_generated/api";

// ─── Food library ─────────────────────────────────────────────────────────────

/**
 * Convex query results for food library entries return `Id<"foodLibrary">` for the `id` field.
 * Since `Id<T>` extends `string`, the result is structurally compatible with `FoodLibraryEntry`,
 * but TypeScript can't verify structural compatibility across module boundaries without help.
 */
type ConvexFoodLibraryRow = NonNullable<FunctionReturnType<typeof api.foodLibrary.list>>[number];

function toFoodLibraryEntries(rows: ConvexFoodLibraryRow[] | undefined): FoodLibraryEntry[] {
  if (!rows) return [];
  // Explicitly map each row, widening `Id<"foodLibrary">` to `string`.
  // All other fields are already structurally identical.
  return rows.map((row) => ({
    id: row.id as string,
    userId: row.userId,
    canonicalName: row.canonicalName,
    type: row.type,
    ingredients: row.ingredients,
    createdAt: row.createdAt,
  }));
}

export type FoodLibraryEntry = {
  id: string;
  userId: string;
  canonicalName: string;
  type: "ingredient" | "composite";
  ingredients: string[];
  createdAt: number;
};

export function useFoodLibrary(): FoodLibraryEntry[] {
  const entries = useQuery(api.foodLibrary.list, {});
  return useMemo(() => toFoodLibraryEntries(entries), [entries]);
}

export function useAddFoodLibraryEntries() {
  const addBatch = useMutation(api.foodLibrary.addBatch);
  return (
    entries: Array<{
      canonicalName: string;
      type: "ingredient" | "composite";
      ingredients: string[];
      createdAt: number;
    }>,
  ) =>
    addBatch({
      now: Date.now(),
      entries: sanitizeUnknownStringsDeep(entries),
    });
}

export function useUpdateFoodLibraryEntry() {
  const update = useMutation(api.foodLibrary.updateEntry);
  return (entry: {
    canonicalName: string;
    type: "ingredient" | "composite";
    ingredients: string[];
  }) =>
    update({
      now: Date.now(),
      ...sanitizeUnknownStringsDeep(entry),
    });
}

export function useMergeFoodLibraryDuplicates() {
  const merge = useMutation(api.foodLibrary.mergeDuplicates);
  return (merges: Array<{ source: string; target: string }>, updateFoodLogs?: boolean) =>
    merge({
      now: Date.now(),
      merges: sanitizeUnknownStringsDeep(merges),
      ...(updateFoodLogs !== undefined && { updateFoodLogs }),
    });
}

// ─── Food assessment hooks ───────────────────────────────────────────────────

export function useFoodHistory(canonicalName: string | null) {
  return useQuery(api.foodAssessments.historyByFood, canonicalName ? { canonicalName } : "skip");
}

export function useAllFoods() {
  return useQuery(api.foodAssessments.allFoods, {});
}

export function useAllAssessmentRecords() {
  return useQuery(api.foodAssessments.allAssessmentRecords, {});
}

export function useCulprits(limit?: number) {
  return useQuery(api.foodAssessments.culprits, limit !== undefined ? { limit } : {});
}

export function useSafeFoods(limit?: number) {
  return useQuery(api.foodAssessments.safeFoods, limit !== undefined ? { limit } : {});
}

// ─── Ingredient exposure hooks ────────────────────────────────────────────────

export type AllIngredientsResult = NonNullable<
  FunctionReturnType<typeof api.ingredientExposures.allIngredients>
>;

export type IngredientExposureSummary = AllIngredientsResult["ingredients"][number];

export function useAllIngredientExposures(limit?: number) {
  return useQuery(api.ingredientExposures.allIngredients, limit !== undefined ? { limit } : {});
}

export function useIngredientExposureHistory(canonicalName: string | null) {
  return useQuery(
    api.ingredientExposures.historyByIngredient,
    canonicalName ? { canonicalName } : "skip",
  );
}

export function useBackfillIngredientExposures() {
  const backfill = useMutation(api.logs.backfillIngredientExposures);
  return (limit?: number) => backfill(limit !== undefined ? { limit } : {});
}

export type IngredientOverrideStatus = "safe" | "watch" | "avoid";

export type IngredientOverrideRow = NonNullable<
  FunctionReturnType<typeof api.ingredientOverrides.list>
>[number];

export function useIngredientOverrides() {
  return useQuery(api.ingredientOverrides.list, {});
}

export function useSetIngredientOverride() {
  const upsert = useMutation(api.ingredientOverrides.upsert);
  return (canonicalName: string, status: IngredientOverrideStatus, note?: string) =>
    upsert({
      now: Date.now(),
      canonicalName,
      status,
      ...(note !== undefined ? { note } : {}),
    });
}

export function useClearIngredientOverride() {
  const remove = useMutation(api.ingredientOverrides.remove);
  return (canonicalName: string) => remove({ canonicalName });
}

export type IngredientProfileRow = NonNullable<
  FunctionReturnType<typeof api.ingredientProfiles.list>
>[number];

export function useIngredientProfiles() {
  return useQuery(api.ingredientProfiles.list, {});
}

export function useUpsertIngredientProfile() {
  const upsert = useMutation(api.ingredientProfiles.upsert);
  return (
    payload: Omit<FunctionArgs<typeof api.ingredientProfiles.upsert>, "now">,
  ) =>
    upsert({
      now: Date.now(),
      ...sanitizeUnknownStringsDeep(payload),
    });
}

export type ExternalNutritionSearchRow = NonNullable<
  FunctionReturnType<typeof api.ingredientNutritionApi.searchOpenFoodFacts>
>[number];

export function useSearchIngredientNutritionApi() {
  const search = useAction(api.ingredientNutritionApi.searchOpenFoodFacts);
  return (query: string, limit?: number) =>
    search({
      query: sanitizePlainText(query, { preserveNewlines: false }),
      ...(limit !== undefined && { limit }),
    });
}

// ─── Food trial summary hooks ────────────────────────────────────────────────

export type FoodTrialStatus =
  | "testing"
  | "safe"
  | "safe-loose"
  | "safe-hard"
  | "watch"
  | "risky"
  | "culprit"
  | "cleared";

export function useAllFoodTrials() {
  return useQuery(api.aggregateQueries.allFoodTrials, {});
}

export function useFoodTrialsByStatus(status: FoodTrialStatus) {
  return useQuery(api.aggregateQueries.foodTrialsByStatus, { status });
}

export function useFoodTrial(canonicalName: string | null) {
  return useQuery(api.aggregateQueries.foodTrialByName, canonicalName ? { canonicalName } : "skip");
}
