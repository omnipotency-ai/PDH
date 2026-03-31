/**
 * Shared food-system type definitions.
 *
 * These types are used by both the client (src/) and server (convex/) sides.
 * They live in shared/ so that foodEvidence.ts (also in shared/) can import
 * them without reaching into src/types/domain.ts.
 *
 * The canonical copy of these types lives HERE. src/types/domain.ts re-exports
 * them for backward compatibility with existing client-side imports.
 */

export interface TransitCalibration {
  source: "default" | "learned";
  centerMinutes: number;
  spreadMinutes: number;
  sampleSize: number;
  learnedAt: number | null;
}

export type FoodPrimaryStatus = "building" | "safe" | "watch" | "avoid";
export type FoodTendency = "neutral" | "loose" | "hard";
export type FoodAssessmentVerdict = "safe" | "watch" | "avoid" | "trial_next";
export type FoodAssessmentConfidence = "low" | "medium" | "high";
export type FoodAssessmentCausalRole = "primary" | "possible" | "unlikely";
export type FoodAssessmentChangeType = "new" | "upgraded" | "downgraded" | "unchanged";
