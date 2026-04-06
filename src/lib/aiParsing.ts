import type {
  AiNutritionistInsight,
  StructuredFoodAssessment,
} from "@/types/domain";
import type { PreviousReport } from "./aiPrompts";

// ─── Type guards ──────────────────────────────────────────────────────────────

/** Type guard: narrows unknown to a string-keyed object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Safely coerce an unknown array to string[], filtering out non-strings. */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

// ─── Educational insight deduplication ────────────────────────────────────────

type EducationalInsightValue = NonNullable<
  AiNutritionistInsight["educationalInsight"]
>;

function normalizeEducationalKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function educationalKey(insight: EducationalInsightValue): string {
  return `${normalizeEducationalKey(insight.topic)}|${normalizeEducationalKey(insight.fact)}`;
}

function collectEducationalKeys(
  previousReports: PreviousReport[],
): Set<string> {
  const seen = new Set<string>();
  for (const report of previousReports) {
    const insight = report.insight.educationalInsight;
    if (!insight) continue;
    seen.add(educationalKey(insight));
  }
  return seen;
}

export function enforceNovelEducationalInsight(
  insight: AiNutritionistInsight,
  previousReports: PreviousReport[],
): AiNutritionistInsight {
  const seen = collectEducationalKeys(previousReports);
  const current = insight.educationalInsight;
  if (current && !seen.has(educationalKey(current))) {
    return insight;
  }
  return {
    ...insight,
    educationalInsight: null,
  };
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse and validate a raw AI JSON response into a typed AiNutritionistInsight.
 *
 * Handles missing or malformed fields by substituting safe defaults.
 * Returns null if the input is not a valid object at all.
 *
 * This is the single canonical parser for all AI nutritionist responses —
 * used both when receiving fresh AI completions and when reading stored insights.
 */
export function parseAiInsight(raw: unknown): AiNutritionistInsight | null {
  if (!isRecord(raw)) return null;

  // Parse the new directResponseToUser field
  const directResponseToUser: string | null =
    typeof raw.directResponseToUser === "string"
      ? raw.directResponseToUser
      : null;

  // Parse educationalInsight
  const rawEduInsight = raw.educationalInsight;
  const educationalInsight: AiNutritionistInsight["educationalInsight"] =
    isRecord(rawEduInsight) &&
    typeof rawEduInsight.topic === "string" &&
    typeof rawEduInsight.fact === "string"
      ? { topic: rawEduInsight.topic, fact: rawEduInsight.fact }
      : null;

  const clinicalReasoning: string | null =
    typeof raw.clinicalReasoning === "string" ? raw.clinicalReasoning : null;

  return {
    directResponseToUser,
    summary:
      typeof raw.summary === "string" ? raw.summary : "No summary available.",
    suggestions: toStringArray(raw.suggestions),
    clinicalReasoning,
    educationalInsight,
    foodAssessments: Array.isArray(raw.foodAssessments)
      ? raw.foodAssessments.filter(
          (item: unknown): item is StructuredFoodAssessment =>
            isRecord(item) &&
            typeof item.food === "string" &&
            (item.verdict === "safe" ||
              item.verdict === "watch" ||
              item.verdict === "avoid" ||
              item.verdict === "trial_next") &&
            (item.confidence === "low" ||
              item.confidence === "medium" ||
              item.confidence === "high") &&
            (item.causalRole === "primary" ||
              item.causalRole === "possible" ||
              item.causalRole === "unlikely") &&
            (item.changeType === "new" ||
              item.changeType === "upgraded" ||
              item.changeType === "downgraded" ||
              item.changeType === "unchanged") &&
            typeof item.modifierSummary === "string" &&
            typeof item.reasoning === "string",
        )
      : [],
    suspectedCulprits: Array.isArray(raw.suspectedCulprits)
      ? raw.suspectedCulprits.filter(
          (
            item: unknown,
          ): item is AiNutritionistInsight["suspectedCulprits"][number] =>
            isRecord(item) &&
            typeof item.food === "string" &&
            typeof item.confidence === "string" &&
            typeof item.reasoning === "string",
        )
      : [],
    mealPlan: Array.isArray(raw.mealPlan)
      ? raw.mealPlan.filter(
          (item: unknown): item is AiNutritionistInsight["mealPlan"][number] =>
            isRecord(item) &&
            typeof item.meal === "string" &&
            Array.isArray(item.items) &&
            typeof item.reasoning === "string",
        )
      : [],
  };
}
