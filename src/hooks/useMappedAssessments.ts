import type { FoodAssessmentRecord } from "@shared/foodEvidence";
import { useMemo } from "react";
import { useAllAssessmentRecords } from "@/lib/sync";

function mapVerdict(value: unknown): FoodAssessmentRecord["verdict"] {
  switch (value) {
    case "safe":
    case "watch":
    case "avoid":
    case "trial_next":
      return value;
    default:
      return "watch";
  }
}

function mapConfidence(value: unknown): FoodAssessmentRecord["confidence"] {
  switch (value) {
    case "low":
    case "medium":
    case "high":
      return value;
    default:
      return "low";
  }
}

function mapCausalRole(value: unknown): FoodAssessmentRecord["causalRole"] {
  switch (value) {
    case "primary":
    case "possible":
    case "unlikely":
      return value;
    default:
      return "unlikely";
  }
}

function mapChangeType(value: unknown): FoodAssessmentRecord["changeType"] {
  switch (value) {
    case "new":
    case "upgraded":
    case "downgraded":
    case "unchanged":
      return value;
    default:
      return "unchanged";
  }
}

export function useMappedAssessments(): FoodAssessmentRecord[] | undefined {
  const assessmentRecords = useAllAssessmentRecords();
  return useMemo((): FoodAssessmentRecord[] | undefined => {
    if (!assessmentRecords) return undefined;
    return assessmentRecords.map((r) => ({
      canonicalName: r.canonicalName,
      foodName: r.foodName,
      food: r.foodName,
      verdict: mapVerdict(r.verdict),
      confidence: mapConfidence(r.confidence),
      causalRole: mapCausalRole(r.causalRole),
      changeType: mapChangeType(r.changeType),
      modifierSummary: r.modifierSummary ?? "",
      reasoning: r.reasoning,
      reportTimestamp: r.reportTimestamp,
    }));
  }, [assessmentRecords]);
}
