/**
 * Canonical food status taxonomy and threshold definitions.
 *
 * This is the single source of truth for:
 *  - Status categories (safe, safe-loose, safe-hard, testing, watch, risky)
 *  - Consistency classification (majority-rules 30% threshold, NOT transit time)
 *  - Zone/stage definitions (1–3 only)
 *  - Graduation thresholds: see INITIAL_GRADUATION_TRIALS / RECOVERY_GRADUATION_TRIALS in shared/foodEvidence.ts
 *  - Surgery-type-aware Bristol expectations
 *
 * Referenced by: analysis.ts, database tab, transit map, AI prompts, Dr. Poo.
 */
import type { SurgeryType } from "@shared/foodEvidence";
import type { FoodZone } from "@shared/foodRegistry";

// ── Status categories ─────────────────────────────────────────────────────────

/**
 * Food statuses in order from safest to riskiest.
 *
 * - safe:       Bristol avg 3–5, no bad outcomes in recent trials
 * - safe-loose: Bristol avg > 5 (mostly 6–7), but no "bad" outcomes
 * - safe-hard:  Bristol avg < 3 (mostly 1–2), but no "bad" outcomes
 * - testing:    Fewer than required resolved trials (see INITIAL_GRADUATION_TRIALS in foodEvidence.ts)
 * - watch:      1 bad outcome in recent trials
 * - risky:      2+ bad outcomes in recent trials
 */

// ── Bristol classification thresholds ─────────────────────────────────────────

/**
 * Bristol average ranges for consistency classification.
 *
 * These thresholds determine safe vs safe-loose vs safe-hard.
 * Transit time does NOT influence these labels — transit time is a separate
 * attribute ("slow/normal/fast") shown independently.
 */

/** Bristol average at or below this value → "hard" consistency (Bristol 1–2 territory) */
export const BRISTOL_HARD_UPPER = 2.5;

/** Bristol average at or above this value → "loose" consistency (Bristol 6–7 territory) */
export const BRISTOL_LOOSE_LOWER = 5.5;

/**
 * Bristol range for "normal/safe" consistency:
 *   BRISTOL_HARD_UPPER < avg < BRISTOL_LOOSE_LOWER  →  safe (normal)
 *   avg <= BRISTOL_HARD_UPPER                        →  safe-hard
 *   avg >= BRISTOL_LOOSE_LOWER                       →  safe-loose
 */

// ── Zone/stage definitions ────────────────────────────────────────────────────

/**
 * Recovery zones (stages) for ileostomy/colostomy recovery. Only 3 zones exist:
 *
 * Zone 1 — Safest / foundation foods
 *   Plain proteins, simple carbs, and very gentle foods. Low-residue, easy to digest.
 *   Examples: chicken (any prep), fish, eggs, white rice, white bread, toast,
 *             banana, applesauce, smooth peanut butter, potato (no skin),
 *             plain yoghurt, cottage cheese, oatmeal/porridge, broth.
 *
 * Zone 2 — Moderate expansion
 *   Cooked vegetables, pasta, dairy, moderate fruits, avocado.
 *   Examples: cooked carrots, pumpkin, zucchini, steamed spinach, pasta,
 *             cheese, milk, ripe pear, cooked apple, honey, butter.
 *
 * Zone 3 — Caution / full variety
 *   Raw vegetables, high-fibre foods, nuts, seeds, whole grains, spicy foods,
 *   fried foods, carbonated drinks, dried fruit, popcorn, tough meats.
 */
export const ZONE_MIN = 1;
export const ZONE_MAX = 3;

export type Zone = FoodZone;

/**
 * Clamp a raw stage number to the valid zone range [1, 3].
 * Returns the clamped Zone value.
 */
export function clampZone(raw: number): Zone {
  if (!Number.isFinite(raw) || raw <= ZONE_MIN) return 1;
  if (raw >= ZONE_MAX) return 3;
  return 2;
}

// ── Bad outcome thresholds ────────────────────────────────────────────────────

/** Number of "bad" outcomes in recent trials that triggers "risky" status. */
export const RISKY_BAD_COUNT = 2;

/** Number of "bad" outcomes in recent trials that triggers "watch" status. */
export const WATCH_BAD_COUNT = 1;

// ── Bristol average computation ───────────────────────────────────────────────

/**
 * Compute a weighted average Bristol score from a breakdown record.
 * Returns null when there are no entries.
 */
export function computeBristolAverage(breakdown: Record<number, number>): number | null {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [code, count] of Object.entries(breakdown)) {
    const numCode = Number(code);
    if (Number.isFinite(numCode) && count > 0) {
      weightedSum += numCode * count;
      totalWeight += count;
    }
  }
  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

// ── Bristol category definitions (majority-rules classification) ──────────────

/**
 * Bristol categories for majority-rules classification.
 * Each Bristol score maps to exactly one category.
 */
export type BristolCategory = "constipated" | "hard" | "normal" | "loose" | "diarrhea";

/** Valid Bristol scale values (1-7). */
export type BristolScore = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Map a Bristol score to its category.
 * Throws if the score is outside the valid 1-7 range.
 */
export function bristolCategory(score: number): BristolCategory {
  switch (score) {
    case 1:
    case 2:
      return "constipated";
    case 3:
      return "hard";
    case 4:
      return "normal";
    case 5:
    case 6:
      return "loose";
    case 7:
      return "diarrhea";
    default:
      throw new RangeError(`Bristol score must be 1-7, got ${score}`);
  }
}

/** Minimum percentage threshold for a category to win majority-rules classification. */
export const MAJORITY_THRESHOLD = 0.3;

/**
 * Distance from "normal" (Bristol 4) for tie-breaking.
 * Higher = more concerning. Diarrhea is more concerning than constipated
 * because in anastomosis recovery, dehydration from loose output is
 * the more urgent clinical risk.
 */
const CONCERN_DISTANCE: Record<BristolCategory, number> = {
  normal: 0,
  hard: 1,
  loose: 2,
  constipated: 3,
  diarrhea: 4,
};

/**
 * Map a winning Bristol category to the consistency classification.
 */
function categoryToConsistency(category: BristolCategory): "safe" | "safe-loose" | "safe-hard" {
  switch (category) {
    case "normal":
      return "safe";
    case "hard":
    case "constipated":
      return "safe-hard";
    case "loose":
    case "diarrhea":
      return "safe-loose";
  }
}

/**
 * Classify a food's consistency variant using majority-rules with a 30% threshold.
 *
 * Algorithm:
 *  1. Count Bristol scores by category (constipated/hard/normal/loose/diarrhea)
 *  2. Calculate each category's percentage of total scores
 *  3. The category with >=30% and the highest count wins
 *  4. Ties (same count): pick the more concerning category (further from normal)
 *
 * Returns:
 *  - "safe"       when the dominant category is normal (Bristol 4)
 *  - "safe-hard"  when the dominant category is hard (3) or constipated (1-2)
 *  - "safe-loose" when the dominant category is loose (5-6) or diarrhea (7)
 *  - "testing"    when no Bristol data is available
 */
export function classifyConsistency(
  bristolBreakdown: Record<number, number>,
): "safe" | "safe-loose" | "safe-hard" | "testing" {
  // Count scores by category
  const categoryCounts: Record<BristolCategory, number> = {
    constipated: 0,
    hard: 0,
    normal: 0,
    loose: 0,
    diarrhea: 0,
  };

  let totalCount = 0;

  for (const [scoreStr, count] of Object.entries(bristolBreakdown)) {
    const score = Number(scoreStr);
    if (!Number.isFinite(score) || count <= 0) continue;
    const category = bristolCategory(score); // throws on out-of-range
    categoryCounts[category] += count;
    totalCount += count;
  }

  if (totalCount === 0) return "testing";

  // Find all categories meeting the 30% threshold
  type Candidate = { category: BristolCategory; count: number };
  const candidates: Candidate[] = [];

  for (const [category, count] of Object.entries(categoryCounts) as Array<
    [BristolCategory, number]
  >) {
    const percentage = count / totalCount;
    if (percentage >= MAJORITY_THRESHOLD) {
      candidates.push({ category, count });
    }
  }

  // If no category meets the threshold (shouldn't happen with valid data,
  // but can happen with evenly spread data across >3 categories), fall back
  // to the category with the highest count.
  if (candidates.length === 0) {
    let bestCategory: BristolCategory = "normal";
    let bestCount = 0;
    for (const [category, count] of Object.entries(categoryCounts) as Array<
      [BristolCategory, number]
    >) {
      if (
        count > bestCount ||
        (count === bestCount && CONCERN_DISTANCE[category] > CONCERN_DISTANCE[bestCategory])
      ) {
        bestCategory = category;
        bestCount = count;
      }
    }
    return categoryToConsistency(bestCategory);
  }

  // Pick the candidate with the highest count.
  // Tie-break: pick the more concerning category (higher CONCERN_DISTANCE).
  candidates.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return CONCERN_DISTANCE[b.category] - CONCERN_DISTANCE[a.category];
  });

  return categoryToConsistency(candidates[0].category);
}

// ── Surgery-type-aware Bristol expectations ───────────────────────────────────

/**
 * How expected or concerning a Bristol score is for a given surgery type
 * and recovery phase.
 *
 * - "ideal":    Bristol 3-4 — textbook-perfect output
 * - "expected": Within normal range for this surgery type + phase
 * - "normal":   Acceptable in steady state, not alarming
 * - "unusual":  Outside typical range — worth noting but not alarming
 * - "concern":  Clinically concerning for this surgery type + phase
 */
export type BristolExpectation = "ideal" | "expected" | "normal" | "unusual" | "concern";

/** Months since surgery at or above which the patient is in steady state. */
export const STEADY_STATE_MONTHS = 6;

/**
 * Bristol expectation lookup tables, keyed by Bristol code (1-7).
 *
 * Clinical basis:
 * - Ileocolic (early recovery): ileocecal valve removed, faster transit.
 *   Looser stools (5-6) are expected. Hard stools (1) are unusual/concerning
 *   because they suggest dehydration or obstruction risk.
 * - Colonic (early recovery): left/sigmoid resection preserves more colon,
 *   slower transit. Firmer stools (1-2) are expected. Loose stools (6) are
 *   unusual/concerning because they may indicate poor absorption.
 * - Steady state (6+ months): both surgery types converge toward population
 *   norms. Bristol 3-4 ideal, 2 and 5 normal-ish, extremes are concern.
 * - Bristol 7 is always "concern" regardless of surgery type or phase.
 */
const ILEOCOLIC_EARLY_EXPECTATIONS: Record<number, BristolExpectation> = {
  1: "concern",
  2: "unusual",
  3: "ideal",
  4: "ideal",
  5: "expected",
  6: "expected",
  7: "concern",
};

const COLONIC_EARLY_EXPECTATIONS: Record<number, BristolExpectation> = {
  1: "expected",
  2: "expected",
  3: "ideal",
  4: "ideal",
  5: "unusual",
  6: "concern",
  7: "concern",
};

const STEADY_STATE_EXPECTATIONS: Record<number, BristolExpectation> = {
  1: "concern",
  2: "normal",
  3: "ideal",
  4: "ideal",
  5: "normal",
  6: "concern",
  7: "concern",
};

/**
 * Returns the clinical expectation for a given Bristol score based on
 * surgery type and recovery phase.
 *
 * Pure function — no side effects, no database reads.
 *
 * @param bristolCode - Bristol Stool Scale score (1-7). Throws RangeError if out of range.
 * @param surgeryType - Surgery type from health profile. "other" or undefined uses steady state defaults.
 * @param monthsSinceSurgery - Months elapsed since surgery. >= 6 uses steady state ranges.
 * @returns The clinical expectation level for the given Bristol score.
 */
export function getBristolExpectation(
  bristolCode: number,
  surgeryType: SurgeryType,
  monthsSinceSurgery: number,
): BristolExpectation {
  if (!Number.isInteger(bristolCode) || bristolCode < 1 || bristolCode > 7) {
    throw new RangeError(`Bristol score must be 1-7, got ${bristolCode}`);
  }

  // Steady state: >= 6 months, or unknown/other surgery type
  if (
    monthsSinceSurgery >= STEADY_STATE_MONTHS ||
    surgeryType === "other" ||
    surgeryType === undefined
  ) {
    return STEADY_STATE_EXPECTATIONS[bristolCode] as BristolExpectation;
  }

  // Early recovery: surgery-type-specific ranges
  if (surgeryType === "ileocolic") {
    return ILEOCOLIC_EARLY_EXPECTATIONS[bristolCode] as BristolExpectation;
  }

  // surgeryType === "colonic"
  return COLONIC_EARLY_EXPECTATIONS[bristolCode] as BristolExpectation;
}

// ── Legacy zone/category lookups removed ──────────────────────────────────────
// DEFAULT_FOOD_ZONES, defaultZoneForFood, DEFAULT_FOOD_CATEGORIES,
// CATEGORY_KEYWORD_RULES, defaultCategoryForFood, and LineCategory were removed
// in favour of the food registry (src/lib/foodRegistry.ts). Use getFoodZone()
// and getFoodEntry() from the registry instead.
