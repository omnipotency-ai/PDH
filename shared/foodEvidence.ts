import { resolveCanonicalFoodName } from "./foodCanonicalName";
import { formatFoodDisplayName } from "./foodNormalize";
import { getLoggedFoodIdentity } from "./foodProjection";
import { type FoodZone, getFoodGroup, getFoodZone } from "./foodRegistry";
import { isFoodPipelineType } from "./logTypeUtils";
import type {
  FoodAssessmentCausalRole,
  FoodAssessmentChangeType,
  FoodAssessmentConfidence,
  FoodAssessmentVerdict,
  FoodPrimaryStatus,
  FoodTendency,
  TransitCalibration,
} from "./foodTypes";
import {
  parseActivityData,
  parseDigestiveData,
  parseFluidData,
  parseFoodData,
  parseHabitData,
} from "./logDataParsers";

export type {
  FoodAssessmentCausalRole,
  FoodAssessmentChangeType,
  FoodAssessmentConfidence,
  FoodAssessmentVerdict,
  FoodPrimaryStatus,
  FoodTendency,
  TransitCalibration,
};

export type FoodTrialResolutionMode = "expected_window" | "carry_forward";

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

export interface HabitLike {
  id: string;
  name: string;
}

export interface FoodEvidenceLog {
  id: string;
  timestamp: number;
  type: string;
  data: unknown;
}

export interface FoodAssessmentRecord {
  canonicalName: string;
  foodName: string;
  food: string;
  verdict: FoodAssessmentVerdict;
  confidence: FoodAssessmentConfidence;
  causalRole: FoodAssessmentCausalRole;
  changeType: FoodAssessmentChangeType;
  modifierSummary: string;
  reasoning: string;
  reportTimestamp: number;
}

export interface FoodEvidenceTrial {
  trialId: string;
  canonicalName: string;
  foodName: string;
  foodTimestamp: number;
  bowelTimestamp: number;
  transitMinutes: number;
  resolutionMode: FoodTrialResolutionMode;
  outcome: "good" | "loose" | "hard" | "bad";
  bristolCode: number | null;
  negativeWeight: number;
  modifierDeltaMinutes: number;
  modifierReliability: number;
  severe: boolean;
}

export interface FoodEvidenceSummary {
  canonicalName: string;
  displayName: string;
  totalTrials: number;
  resolvedTrials: number;
  codeScore: number;
  aiScore: number;
  combinedScore: number;
  posteriorSafety: number;
  effectiveEvidence: number;
  confidence: number;
  primaryStatus: FoodPrimaryStatus;
  tendency: FoodTendency;
  recentSuspect: boolean;
  clearedHistory: boolean;
  learnedTransitCenterMinutes: number;
  learnedTransitSpreadMinutes: number;
  latestAiVerdict: FoodAssessmentVerdict | "none";
  latestAiReasoning: string;
  lastTrialAt: number;
  firstSeenAt: number;
  culpritCount: number;
  safeCount: number;
  nextToTryCount: number;
  totalAssessments: number;
  latestConfidence?: FoodAssessmentConfidence;
  latestModifierSummary?: string;
  trials: FoodEvidenceTrial[];
  triggerEvidenceCount: number;
  triggerEvidence: TriggerEvidence[];
}

export interface FoodEvidenceResult {
  summaries: FoodEvidenceSummary[];
  transitCalibration: TransitCalibration;
}

interface DigestiveEvent {
  id: string;
  timestamp: number;
  category: "hard" | "firm" | "loose" | "diarrhea" | "constipated";
  bristolCode: number | null;
}

interface ModifierSignal {
  deltaMinutes: number;
  reliability: number;
}

interface FoodTrial {
  id: string;
  canonicalName: string;
  displayName: string;
  timestamp: number;
}

export interface TransitWindow {
  startMinutes: number;
  endMinutes: number;
}

interface TrialResolutionCandidate {
  event: DigestiveEvent;
  modifier: ModifierSignal;
  resolutionMode: FoodTrialResolutionMode;
  transitMinutes: number;
  trial: FoodTrial;
}

export interface TransitResolverPolicy {
  carryForwardToNextBowelEvent: boolean;
  carryForwardReliabilityMultiplier: number;
  minimumCarryForwardReliability: number;
  minimumExpectedWindowWidthMinutes: number;
  minimumNegativeCandidatePenalty: number;
  minimumPlausibleTransitFloorMinutes: number;
  minimumPositiveCandidatePenalty: number;
  minimumResolvedReliability: number;
}

/**
 * Default transit center: 24 hours (1440 min).
 *
 * Clinical basis: post-anastomosis patients (especially ileocolic) typically
 * show initial transit times of 18-30 hours. 24h is a conservative default
 * center that works for both ileocolic and colonic resections before the
 * system has learned the user's personal calibration.
 *
 * Reference: NHS low-residue diet leaflets, UCSF ileostomy diet guides.
 */
const DEFAULT_CENTER_MINUTES = 24 * 60;

/**
 * Default transit spread: 8 hours (480 min).
 *
 * Combined with the 24h center, this gives a default window of [16h, 32h].
 * Wide enough to capture most post-surgical transit variation while still
 * being useful for evidence correlation.
 */
const DEFAULT_SPREAD_MINUTES = 8 * 60;

const MIN_CALIBRATION_TRIALS = 4;
const MAX_MODIFIER_SHIFT_MINUTES = 240;
const HALF_LIFE_DAYS = 45;
const PRIOR_POSITIVE = 2;
const PRIOR_NEGATIVE = 1;
const BUILDING_EVIDENCE_THRESHOLD = 1.5;

/**
 * Number of resolved trials required to graduate from "building" to an assessed
 * status (safe/watch/avoid) for initial assessment.
 *
 * Clinical basis: 5 resolved trials provides sufficient evidence to make an
 * initial determination about a food's digestive impact.
 */
export const INITIAL_GRADUATION_TRIALS = 5;

/**
 * Number of recent consecutive good trials required for a food to recover
 * from "watch" or "avoid" back to "safe".
 *
 * Clinical rationale: the gut heals progressively. Foods must be able to
 * escape negative ratings once the user's tolerance improves. 3 consecutive
 * good outcomes (Bristol 3-5) is enough to demonstrate recovery without
 * requiring the full 5-trial initial assessment.
 */
export const RECOVERY_GRADUATION_TRIALS = 3;

/**
 * Bristol scores considered "good" for recovery path evaluation.
 * Bristol 3, 4, and 5 represent the normal/ideal stool range.
 */
const RECOVERY_GOOD_BRISTOL_MIN = 3;
const RECOVERY_GOOD_BRISTOL_MAX = 5;

const AI_CONFIDENCE_WEIGHT: Record<FoodAssessmentConfidence, number> = {
  low: 0.5,
  medium: 1,
  high: 1.5,
};
const AI_CAUSAL_ROLE_WEIGHT: Record<FoodAssessmentCausalRole, number> = {
  primary: 1,
  possible: 0.65,
  unlikely: 0.35,
};
const DAY_BUCKET_MS = MS_PER_DAY;

// ---------------------------------------------------------------------------
// Trigger correlation constants
// ---------------------------------------------------------------------------

/**
 * Trigger correlation window: 0-3 hours (180 minutes).
 *
 * Clinical basis: gastrocolic reflex typically occurs within 15-60 minutes
 * of eating, but delayed gastrocolic responses can occur up to 3 hours.
 * This window captures food-induced rapid transit episodes (Bristol 6-7).
 */
export const TRIGGER_WINDOW_MINUTES = 180;

/**
 * Evidence weight for trigger correlations with Bristol 7 (watery diarrhea).
 *
 * Bristol 7 within 3 hours of eating is a strong signal that the food
 * triggered a gastrocolic reflex. Weight 1.5 reflects high confidence
 * in this correlation.
 */
export const TRIGGER_WEIGHT_BRISTOL_7 = 1.5;

/**
 * Evidence weight for trigger correlations with Bristol 6 (mushy/fluffy).
 *
 * Bristol 6 within 3 hours is a moderate signal. Weight 0.75 reflects
 * that Bristol 6 can also be normal transit, so the trigger signal is
 * weaker than Bristol 7.
 */
export const TRIGGER_WEIGHT_BRISTOL_6 = 0.75;

// ---------------------------------------------------------------------------
// Trigger correlation types
// ---------------------------------------------------------------------------

/**
 * Correlation type discriminant.
 *
 * - "trigger": food caused a gastrocolic reflex (0-3h, Bristol 6-7 only)
 * - "transit": food is physically present in this stool (6-96h, all Bristol)
 */
export type CorrelationType = "trigger" | "transit";

/**
 * Evidence record for a trigger correlation event.
 *
 * A trigger event means a Bristol 6-7 bowel movement occurred within
 * 0-3 hours after eating, suggesting the food triggered a gastrocolic
 * reflex rather than being physically present in the stool.
 */
export interface TriggerEvidence {
  type: "trigger";
  foodTrialTimestamp: number;
  digestiveEventTimestamp: number;
  bristolCode: 6 | 7;
  minutesAfterEating: number; // 0-180
  weight: number; // evidence weight (zone/portion/priority adjusted)
  canonicalName: string;
}

export const CLINICAL_TRANSIT_RESOLVER_POLICY: TransitResolverPolicy =
  Object.freeze({
    carryForwardToNextBowelEvent: true,
    carryForwardReliabilityMultiplier: 0.5,
    minimumCarryForwardReliability: 0.08,
    minimumExpectedWindowWidthMinutes: 30,
    minimumNegativeCandidatePenalty: 0.25,
    minimumPlausibleTransitFloorMinutes: 6 * 60,
    minimumPositiveCandidatePenalty: 0.6,
    minimumResolvedReliability: 0.15,
  });

// ---------------------------------------------------------------------------
// Surgery-type transit adjustments
// ---------------------------------------------------------------------------

/**
 * Surgery type for transit center adjustment.
 *
 * - "ileocolic": ileocecal valve removed — faster transit expected.
 * - "colonic": left/sigmoid resection — slower transit expected.
 * - "other" | undefined: no adjustment, use default center.
 */
export type SurgeryType = "ileocolic" | "colonic" | "other" | undefined;

/**
 * Surgery-type center shift constants (minutes).
 *
 * These replace the default center when the user's health profile specifies
 * a surgery type. The spread remains the same; only the center moves.
 *
 * Clinical basis:
 * - Ileocolic (18h / 1080 min): removal of the ileocecal valve shortens
 *   colonic transit. Literature reports 12-24h range; 18h is a conservative
 *   center for post-anastomosis patients.
 * - Colonic (28h / 1680 min): left or sigmoid resection preserves more
 *   colon, resulting in slower transit. 24-36h typical; 28h center.
 */
export const SURGERY_TYPE_CENTER_MINUTES: Record<
  Exclude<SurgeryType, "other" | undefined>,
  number
> = {
  ileocolic: 18 * 60,
  colonic: 28 * 60,
} as const;

// ---------------------------------------------------------------------------
// Food-category transit adjustments
// ---------------------------------------------------------------------------

/**
 * Transit-relevant food categories for window adjustment.
 *
 * These are NOT the same as the registry's FoodGroup or FoodCategory types.
 * They represent digestive-transit-relevant classifications used only for
 * shifting the expected transit window start/end.
 */
export type FoodTransitCategory =
  | "clear_liquid"
  | "complex_liquid"
  | "simple_carb"
  | "mixed_meal"
  | "high_protein"
  | "high_fat"
  | "high_fiber";

/**
 * Per-category transit window adjustments in minutes.
 *
 * Each entry has a `startAdjustment` (shift to window start) and
 * `endAdjustment` (shift to window end). Negative values move earlier,
 * positive values move later.
 *
 * Clinical basis:
 * - Clear liquids: gastric emptying ~20 min, intestinal transit begins
 *   sooner. Window starts 2h earlier.
 * - Complex liquids: slower than clear but faster than solids. 1h earlier.
 * - Simple carbs / mixed meals: baseline, no adjustment.
 * - High-protein: slower gastric emptying due to protein digestion. 1h later.
 * - High-fat: fat significantly delays gastric emptying via CCK. 2h later.
 * - High-fiber (once tolerated): more predictable transit due to bulk.
 *   Narrower window (-1h start, -1h end).
 */
export const FOOD_TRANSIT_CATEGORY_ADJUSTMENTS: Record<
  FoodTransitCategory,
  { startAdjustment: number; endAdjustment: number }
> = {
  clear_liquid: { startAdjustment: -120, endAdjustment: 0 },
  complex_liquid: { startAdjustment: -60, endAdjustment: 0 },
  simple_carb: { startAdjustment: 0, endAdjustment: 0 },
  mixed_meal: { startAdjustment: 0, endAdjustment: 0 },
  high_protein: { startAdjustment: 60, endAdjustment: 0 },
  high_fat: { startAdjustment: 120, endAdjustment: 0 },
  high_fiber: { startAdjustment: -60, endAdjustment: -60 },
} as const;

/**
 * Maps registry FoodGroup values to transit categories.
 *
 * This is a best-effort mapping. Individual foods within a group may not
 * perfectly match their group's transit category, but the group-level
 * default is a reasonable starting point.
 */
export const FOOD_GROUP_TO_TRANSIT_CATEGORY: Record<
  string,
  FoodTransitCategory
> = {
  protein: "high_protein",
  carbs: "simple_carb",
  fats: "high_fat",
  seasoning: "mixed_meal",
} as const;

// formatFoodDisplayName is imported from ./foodNormalize
// resolveCanonicalFoodName is imported from ./foodCanonicalName

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDigestiveCategory(parsed: {
  bristolCode: number | undefined;
  urgency: string | undefined;
  effort: string | undefined;
}): DigestiveEvent["category"] | null {
  const bristol = parsed.bristolCode;
  if (bristol !== undefined) {
    if (bristol <= 1) return "constipated";
    if (bristol === 2) return "hard";
    if (bristol >= 3 && bristol <= 5) return "firm";
    if (bristol === 6) return "loose";
    if (bristol === 7) return "diarrhea";
  }

  const urgency = (parsed.urgency ?? "").trim().toLowerCase();
  const effort = (parsed.effort ?? "").trim().toLowerCase();
  if (urgency.includes("accident") || urgency.includes("immediate"))
    return "diarrhea";
  if (effort.includes("strain")) return "constipated";
  return null;
}

function buildDigestiveEvents(logs: FoodEvidenceLog[]): DigestiveEvent[] {
  const events: DigestiveEvent[] = [];
  for (const log of logs) {
    if (log.type !== "digestion") continue;
    const parsed = parseDigestiveData(log.data);
    if (!parsed) {
      console.warn(
        `[foodEvidence] Skipping digestion log ${log.id}: invalid data shape`,
      );
      continue;
    }
    const category = normalizeDigestiveCategory(parsed);
    if (!category) continue;
    const episodes = Math.max(1, parsed.episodesCount ?? 1);
    const bristolCode = parsed.bristolCode;
    if (
      bristolCode !== undefined &&
      (!Number.isInteger(bristolCode) || bristolCode < 1 || bristolCode > 7)
    ) {
      console.warn(
        `[foodEvidence] Skipping digestion log ${log.id}: bristol code ${bristolCode} is out of range 1-7`,
      );
      continue;
    }
    for (let index = 0; index < episodes; index += 1) {
      events.push({
        id: `${log.id}-${index}`,
        timestamp: log.timestamp + index * 2 * MS_PER_MINUTE,
        category,
        bristolCode: bristolCode !== undefined ? bristolCode : null,
      });
    }
  }

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

function buildFoodTrials(logs: FoodEvidenceLog[]): FoodTrial[] {
  const trials: FoodTrial[] = [];

  for (const log of logs) {
    if (!isFoodPipelineType(log.type)) continue;
    const parsed = parseFoodData(log.data);
    if (!parsed) {
      console.warn(
        `[foodEvidence] Skipping food log ${log.id}: invalid data shape`,
      );
      continue;
    }
    parsed.items.forEach((item, index) => {
      const identity = getLoggedFoodIdentity(item);
      if (!identity) return;
      // Skip unknown/unresolved items — they don't affect transit calculations
      if (identity.canonicalName === "unknown_food") return;
      trials.push({
        id: `${log.id}-${index}`,
        canonicalName: identity.canonicalName,
        displayName: identity.displayName,
        timestamp: log.timestamp,
      });
    });
  }

  return trials.sort((a, b) => a.timestamp - b.timestamp);
}

function getDayBucket(timestamp: number) {
  return Math.floor(timestamp / DAY_BUCKET_MS);
}

function getHabitLookup(habits: HabitLike[]) {
  const byId = new Map<string, HabitLike>();
  for (const habit of habits) {
    byId.set(habit.id, habit);
  }
  return byId;
}

function summarizeModifiers(logs: FoodEvidenceLog[], habits: HabitLike[]) {
  const habitLookup = getHabitLookup(habits);
  const summary = new Map<number, ModifierSignal>();

  for (const log of logs) {
    const bucket = getDayBucket(log.timestamp);
    const current = summary.get(bucket) ?? { deltaMinutes: 0, reliability: 1 };

    if (log.type === "habit") {
      const parsed = parseHabitData(log.data);
      if (!parsed) {
        console.warn(
          `[foodEvidence] Skipping habit log ${log.id}: invalid data shape`,
        );
      } else {
        const quantity = parsed.quantity ?? 1;
        const habitName =
          readText(habitLookup.get(parsed.habitId)?.name) || parsed.name;
        const key = `${parsed.habitId} ${habitName}`.toLowerCase();

        if (
          /cig|nicotine|smok|coffee|caffeine|stimulant|tina|rec drug/.test(key)
        ) {
          current.deltaMinutes -= Math.min(180, quantity * 20);
          current.reliability -= 0.12;
        } else if (/alcohol|beer|wine|spirit|opiate|depressant/.test(key)) {
          current.deltaMinutes += Math.min(120, quantity * 18);
          current.reliability -= 0.08;
        }
      }
    }

    if (log.type === "activity") {
      const parsed = parseActivityData(log.data);
      if (!parsed) {
        console.warn(
          `[foodEvidence] Skipping activity log ${log.id}: invalid data shape`,
        );
      } else {
        const activityType = parsed.activityType.toLowerCase();
        const durationMinutes = parsed.durationMinutes ?? 20;
        if (
          /walk|run|cycle|swim|cardio|workout|yoga|stretch/.test(activityType)
        ) {
          current.deltaMinutes -= Math.min(90, durationMinutes * 0.9);
          current.reliability -= 0.08;
        }
        if (/sleep/.test(activityType)) {
          current.deltaMinutes += 45;
        }
      }
    }

    if (log.type === "fluid") {
      const parsed = parseFluidData(log.data);
      if (!parsed) {
        console.warn(
          `[foodEvidence] Skipping fluid log ${log.id}: invalid data shape`,
        );
      } else {
        const totalMl = parsed.items.reduce(
          (sum, item) => sum + (item.quantity ?? 0),
          0,
        );
        if (totalMl >= 1200) {
          current.deltaMinutes -= 30;
        }
      }
    }

    summary.set(bucket, {
      deltaMinutes: Math.max(
        -MAX_MODIFIER_SHIFT_MINUTES,
        Math.min(MAX_MODIFIER_SHIFT_MINUTES, current.deltaMinutes),
      ),
      reliability: Math.max(0.2, Math.min(1, current.reliability)),
    });
  }

  return summary;
}

function outcomeFromEvent(event: DigestiveEvent): FoodEvidenceTrial["outcome"] {
  if (event.category === "diarrhea" || event.category === "constipated")
    return "bad";
  if (event.category === "loose") return "loose";
  if (event.category === "hard") return "hard";
  return "good";
}

function negativeWeightForOutcome(outcome: FoodEvidenceTrial["outcome"]) {
  switch (outcome) {
    case "good":
      return 0;
    case "loose":
    case "hard":
      return 0.35;
    case "bad":
      return 1;
  }
}

// ---------------------------------------------------------------------------
// Trigger correlation functions
// ---------------------------------------------------------------------------

/**
 * Computes a priority score for a food within the trigger window.
 *
 * When multiple foods fall within the 0-3h trigger window before a
 * Bristol 6-7 event, this score determines relative weighting.
 *
 * Priority factors (higher = more likely the trigger):
 * - Zone 3 foods are penalized more (experimental, higher risk)
 * - High-fat foods delay gastric emptying but can provoke gastrocolic reflex
 * - More recent foods (closer to the event) get higher priority
 * - All foods get some weight — this just adjusts relative contribution
 */
function computeTriggerPriorityScore(args: {
  canonicalName: string;
  minutesAfterEating: number;
}): number {
  let score = 1.0;

  // Zone 3 foods are more suspect as triggers
  const zone = getFoodZone(args.canonicalName);
  if (zone === 3) {
    score *= 1.35;
  } else if (zone === 1) {
    score *= 0.85;
  }

  // High-fat foods are known gastrocolic reflex triggers
  const group = getFoodGroup(args.canonicalName);
  if (group === "fats") {
    score *= 1.25;
  }

  // More recent foods (shorter time to event) are more suspect.
  // Linear decay: food eaten 0 min before event gets full weight,
  // food eaten 180 min before gets 50% weight.
  const recencyFactor =
    1.0 - 0.5 * (args.minutesAfterEating / TRIGGER_WINDOW_MINUTES);
  score *= recencyFactor;

  return score;
}

/**
 * Finds trigger correlations for all food trials.
 *
 * A trigger correlation occurs when a Bristol 6-7 event happens within
 * 0-3 hours of eating. This represents a gastrocolic reflex — the food
 * irritated the GI tract and caused rapid evacuation, rather than the
 * food itself physically transiting the bowel.
 *
 * Returns trigger evidence grouped by canonical food name.
 */
export function findTriggerCorrelations(
  trials: FoodTrial[],
  events: DigestiveEvent[],
): Map<string, TriggerEvidence[]> {
  const result = new Map<string, TriggerEvidence[]>();

  // Only consider Bristol 6-7 events for trigger correlations
  const triggerEvents = events.filter((event) => {
    const bristol = event.bristolCode;
    return bristol === 6 || bristol === 7;
  });

  if (triggerEvents.length === 0) {
    return result;
  }

  for (const event of triggerEvents) {
    const bristolCode = event.bristolCode as 6 | 7;

    // Find all foods eaten within the trigger window before this event
    const candidateFoods: Array<{
      trial: FoodTrial;
      minutesAfterEating: number;
    }> = [];

    for (const trial of trials) {
      const minutesAfterEating = Math.round(
        (event.timestamp - trial.timestamp) / MS_PER_MINUTE,
      );

      // Must be after eating (>= 0) and within the trigger window
      if (
        minutesAfterEating < 0 ||
        minutesAfterEating > TRIGGER_WINDOW_MINUTES
      ) {
        continue;
      }

      candidateFoods.push({ trial, minutesAfterEating });
    }

    if (candidateFoods.length === 0) {
      continue;
    }

    // Compute priority scores for all candidates
    const scoredCandidates = candidateFoods.map((candidate) => ({
      ...candidate,
      priorityScore: computeTriggerPriorityScore({
        canonicalName: candidate.trial.canonicalName,
        minutesAfterEating: candidate.minutesAfterEating,
      }),
    }));

    // Normalize priority scores so they sum to 1 (relative weighting)
    const totalPriority = scoredCandidates.reduce(
      (sum, c) => sum + c.priorityScore,
      0,
    );

    // Base weight depends on Bristol code
    const baseWeight =
      bristolCode === 7 ? TRIGGER_WEIGHT_BRISTOL_7 : TRIGGER_WEIGHT_BRISTOL_6;

    // Sort by priority score descending (highest priority first)
    scoredCandidates.sort((a, b) => b.priorityScore - a.priorityScore);

    for (const candidate of scoredCandidates) {
      const normalizedWeight =
        totalPriority > 0 ? candidate.priorityScore / totalPriority : 1;
      const weight = baseWeight * normalizedWeight;

      const evidence: TriggerEvidence = {
        type: "trigger",
        foodTrialTimestamp: candidate.trial.timestamp,
        digestiveEventTimestamp: event.timestamp,
        bristolCode,
        minutesAfterEating: candidate.minutesAfterEating,
        weight,
        canonicalName: candidate.trial.canonicalName,
      };

      const existing = result.get(candidate.trial.canonicalName) ?? [];
      existing.push(evidence);
      result.set(candidate.trial.canonicalName, existing);
    }
  }

  return result;
}

/**
 * Checks whether a transit trial's evidence should be marked unreliable
 * because the digestive event was a Bristol 7 trigger event.
 *
 * Bristol 7 within the trigger window means the food was flushed out
 * by a gastrocolic reflex — the transit timing is meaningless because
 * the food didn't transit normally.
 *
 * Bristol 6 trigger events keep both trigger and transit signals.
 */
function isTransitUnreliableDueToTrigger(
  trial: FoodEvidenceTrial,
  triggerMap: Map<string, TriggerEvidence[]>,
): boolean {
  const triggers = triggerMap.get(trial.canonicalName);
  if (triggers === undefined || triggers.length === 0) {
    return false;
  }

  // Check if any trigger evidence for this food matches a Bristol 7 event
  // that is the SAME digestive event as this transit trial's bowel event
  return triggers.some(
    (trigger) =>
      trigger.bristolCode === 7 &&
      trigger.digestiveEventTimestamp === trial.bowelTimestamp,
  );
}

/**
 * Zone-aware multiplier applied to negative evidence strength.
 *
 * - Zone 1 (0.85): 15% reduction — inherently safer foods (liquids/soft solids)
 *   need less negative evidence to shift posterior.
 * - Zone 2 (1.0): Baseline — no adjustment for standard expanded-diet foods.
 * - Zone 3 (1.35): 35% increase — experimental foods are penalized more heavily
 *   by negative outcomes, reflecting higher inherent risk.
 */
function negativeEvidenceMultiplierForZone(zone?: FoodZone) {
  switch (zone) {
    case 1:
      return 0.85; // Zone 1: 15% reduction — inherently safer foods
    case 3:
      return 1.35; // Zone 3: 35% increase — experimental foods penalized more
    default:
      return 1; // Zone 2 / unknown: baseline
  }
}

/**
 * Zone-aware posterior threshold a food must exceed to graduate to "safe".
 *
 * - Zone 1 (0.55): Default threshold — safe foods graduate at baseline bar.
 * - Zone 2 (0.55): Default threshold — expanded-diet foods use the same bar.
 * - Zone 3 (0.65): Higher bar — experimental foods need stronger positive
 *   evidence to graduate, reflecting the need for more confidence before
 *   declaring an untested food safe.
 */
function safePosteriorThresholdForZone(zone?: FoodZone) {
  switch (zone) {
    case 3:
      return 0.65; // Zone 3: higher bar — experimental foods need stronger evidence
    default:
      return 0.55; // Zone 1 & 2: default threshold
  }
}

function recencyWeight(timestamp: number, now: number) {
  const ageDays = Math.max(0, (now - timestamp) / DAY_BUCKET_MS);
  return 0.5 ** (ageDays / HALF_LIFE_DAYS);
}

function learnTransitCalibration(
  trials: FoodEvidenceTrial[],
  now: number,
  current?: TransitCalibration,
): TransitCalibration {
  const lowConfounder = trials.filter(
    (trial) => trial.modifierReliability >= 0.7 && trial.transitMinutes > 0,
  );
  if (lowConfounder.length < MIN_CALIBRATION_TRIALS) {
    if (current) {
      return {
        ...current,
        sampleSize: lowConfounder.length,
      };
    }
    return {
      source: "default",
      centerMinutes: DEFAULT_CENTER_MINUTES,
      spreadMinutes: DEFAULT_SPREAD_MINUTES,
      sampleSize: lowConfounder.length,
      learnedAt: null,
    };
  }

  const values = lowConfounder
    .map((trial) => trial.transitMinutes)
    .sort((a, b) => a - b);
  const center =
    values[Math.floor(values.length / 2)] ?? DEFAULT_CENTER_MINUTES;
  const q3Idx = Math.min(Math.floor(values.length * 0.75), values.length - 1);
  const q3 = values[q3Idx] ?? 0;
  const min = values[0] ?? 0;
  const spread = Math.max(90, Math.min(360, Math.round((q3 - min) / 2)));

  return {
    source: "learned",
    centerMinutes: Math.round(center),
    spreadMinutes: spread,
    sampleSize: lowConfounder.length,
    learnedAt: now,
  };
}

/**
 * Builds the expected transit window for a food trial.
 *
 * Applies adjustments in this order:
 * 1. Start with calibration center/spread (or defaults)
 * 2. Apply surgery-type center shift (replaces default center only —
 *    if calibration is learned, surgery type is ignored since personal
 *    data supersedes population-level estimates)
 * 3. Apply food-category start/end adjustments
 * 4. Apply habit/activity modifier shift
 * 5. Clamp start to the minimum plausible transit floor (6h)
 */
export function buildTransitWindow(args: {
  calibration?: TransitCalibration;
  modifierDeltaMinutes: number;
  policy: TransitResolverPolicy;
  surgeryType?: SurgeryType;
  foodCategory?: FoodTransitCategory;
}): TransitWindow {
  // Step 1: Determine base center. If calibration is learned, use it directly.
  // If calibration is default or absent, check for surgery-type adjustment.
  let centerMinutes: number;
  const calibrationSource = args.calibration?.source;
  if (calibrationSource === "learned") {
    // Personal learned data supersedes surgery-type population estimates
    centerMinutes = args.calibration?.centerMinutes ?? DEFAULT_CENTER_MINUTES;
  } else {
    // No learned calibration — apply surgery-type shift if applicable
    const surgeryType = args.surgeryType;
    if (surgeryType === "ileocolic" || surgeryType === "colonic") {
      centerMinutes = SURGERY_TYPE_CENTER_MINUTES[surgeryType];
    } else {
      centerMinutes = args.calibration?.centerMinutes ?? DEFAULT_CENTER_MINUTES;
    }
  }

  const spreadMinutes =
    args.calibration?.spreadMinutes ?? DEFAULT_SPREAD_MINUTES;

  // Step 2: Compute raw window
  const rawWindowStartMinutes = centerMinutes - spreadMinutes;
  const rawWindowEndMinutes = centerMinutes + spreadMinutes;

  // Step 3: Apply food-category adjustments
  const foodAdj = args.foodCategory
    ? FOOD_TRANSIT_CATEGORY_ADJUSTMENTS[args.foodCategory]
    : undefined;
  const foodStartAdj = foodAdj?.startAdjustment ?? 0;
  const foodEndAdj = foodAdj?.endAdjustment ?? 0;

  const adjustedStartMinutes = rawWindowStartMinutes + foodStartAdj;
  const adjustedEndMinutes = rawWindowEndMinutes + foodEndAdj;

  const windowWidthMinutes = Math.max(
    args.policy.minimumExpectedWindowWidthMinutes,
    adjustedEndMinutes - adjustedStartMinutes,
  );

  // Step 4: Apply modifier shift and clamp to floor
  const shiftedStart = Math.max(
    args.policy.minimumPlausibleTransitFloorMinutes,
    adjustedStartMinutes + args.modifierDeltaMinutes,
  );
  const shiftedEnd = Math.max(
    adjustedEndMinutes + args.modifierDeltaMinutes,
    shiftedStart + windowWidthMinutes,
  );

  return {
    startMinutes: shiftedStart,
    endMinutes: shiftedEnd,
  };
}

function findTrialResolution(args: {
  calibration?: TransitCalibration;
  events: DigestiveEvent[];
  modifier: ModifierSignal;
  policy: TransitResolverPolicy;
  trial: FoodTrial;
}): TrialResolutionCandidate | null {
  const window = buildTransitWindow({
    ...(args.calibration && { calibration: args.calibration }),
    modifierDeltaMinutes: args.modifier.deltaMinutes,
    policy: args.policy,
  });
  const eligibleEvents = args.events
    .map((event) => {
      const transitMinutes = Math.max(
        0,
        Math.round((event.timestamp - args.trial.timestamp) / MS_PER_MINUTE),
      );
      if (transitMinutes < window.startMinutes) return null;
      return {
        event,
        transitMinutes,
      };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        event: DigestiveEvent;
        transitMinutes: number;
      } => candidate !== null,
    );

  const expectedWindowMatch = eligibleEvents.find(
    (candidate) => candidate.transitMinutes <= window.endMinutes,
  );
  if (expectedWindowMatch) {
    return {
      event: expectedWindowMatch.event,
      modifier: args.modifier,
      resolutionMode: "expected_window",
      transitMinutes: expectedWindowMatch.transitMinutes,
      trial: args.trial,
    };
  }

  if (!args.policy.carryForwardToNextBowelEvent) {
    return null;
  }

  const carryForwardMatch = eligibleEvents[0];
  if (!carryForwardMatch) {
    return null;
  }

  return {
    event: carryForwardMatch.event,
    modifier: args.modifier,
    resolutionMode: "carry_forward",
    transitMinutes: carryForwardMatch.transitMinutes,
    trial: args.trial,
  };
}

function candidatePenaltyForOutcome(
  outcome: FoodEvidenceTrial["outcome"],
  candidateCount: number,
  policy: TransitResolverPolicy,
) {
  const inverseCount = 1 / Math.max(candidateCount, 1);
  if (outcome === "good") {
    return Math.max(policy.minimumPositiveCandidatePenalty, inverseCount);
  }
  return Math.max(policy.minimumNegativeCandidatePenalty, inverseCount);
}

function resolveTrials(
  logs: FoodEvidenceLog[],
  habits: HabitLike[],
  calibration?: TransitCalibration,
): FoodEvidenceTrial[] {
  const trials = buildFoodTrials(logs);
  const events = buildDigestiveEvents(logs);
  const modifiers = summarizeModifiers(logs, habits);
  const provisional = trials
    .map((trial) => {
      const modifier = modifiers.get(getDayBucket(trial.timestamp)) ?? {
        deltaMinutes: 0,
        reliability: 1,
      };
      return findTrialResolution({
        events,
        modifier,
        policy: CLINICAL_TRANSIT_RESOLVER_POLICY,
        trial,
        ...(calibration && { calibration }),
      });
    })
    .filter(
      (candidate): candidate is TrialResolutionCandidate => candidate !== null,
    );
  const candidateCountsByEvent = new Map<string, number>();

  for (const candidate of provisional) {
    candidateCountsByEvent.set(
      candidate.event.id,
      (candidateCountsByEvent.get(candidate.event.id) ?? 0) + 1,
    );
  }

  return provisional.map((candidate) => {
    const outcome = outcomeFromEvent(candidate.event);
    const candidatePenalty = candidatePenaltyForOutcome(
      outcome,
      candidateCountsByEvent.get(candidate.event.id) ?? 1,
      CLINICAL_TRANSIT_RESOLVER_POLICY,
    );
    const reliabilityMultiplier =
      candidate.resolutionMode === "carry_forward"
        ? CLINICAL_TRANSIT_RESOLVER_POLICY.carryForwardReliabilityMultiplier
        : 1;
    const minimumReliability =
      candidate.resolutionMode === "carry_forward"
        ? CLINICAL_TRANSIT_RESOLVER_POLICY.minimumCarryForwardReliability
        : CLINICAL_TRANSIT_RESOLVER_POLICY.minimumResolvedReliability;
    const reliability = Math.max(
      minimumReliability,
      Math.min(
        1,
        candidate.modifier.reliability *
          candidatePenalty *
          reliabilityMultiplier,
      ),
    );

    return {
      trialId: candidate.trial.id,
      canonicalName: candidate.trial.canonicalName,
      foodName: candidate.trial.displayName,
      foodTimestamp: candidate.trial.timestamp,
      bowelTimestamp: candidate.event.timestamp,
      transitMinutes: candidate.transitMinutes,
      resolutionMode: candidate.resolutionMode,
      outcome,
      bristolCode: candidate.event.bristolCode,
      negativeWeight: negativeWeightForOutcome(outcome),
      modifierDeltaMinutes: candidate.modifier.deltaMinutes,
      modifierReliability: reliability,
      severe: outcome === "bad",
    };
  });
}

function assessmentScore(
  verdict: FoodAssessmentVerdict,
  confidence: FoodAssessmentConfidence,
  causalRole: FoodAssessmentCausalRole,
): number {
  const baseWeight =
    AI_CONFIDENCE_WEIGHT[confidence] * AI_CAUSAL_ROLE_WEIGHT[causalRole];
  switch (verdict) {
    case "safe":
      return baseWeight;
    case "watch":
      return -0.65 * baseWeight;
    case "avoid":
      return -1 * baseWeight;
    case "trial_next":
      return 0.2 * baseWeight;
    default:
      return 0;
  }
}

function tendencyFromTrials(trials: FoodEvidenceTrial[]): FoodTendency {
  if (trials.length === 0) return "neutral";
  const looseCount = trials.filter((trial) => trial.outcome === "loose").length;
  const hardCount = trials.filter((trial) => trial.outcome === "hard").length;
  const total = trials.length;
  if (looseCount / total >= 0.3 && looseCount > hardCount) return "loose";
  if (hardCount / total >= 0.3 && hardCount > looseCount) return "hard";
  return "neutral";
}

/**
 * Count consecutive good trials from the most recent trial backward.
 *
 * A trial is "good" for recovery purposes if:
 * - Its outcome is "good" (Bristol 3-5)
 * - Its Bristol code falls in the normal range (3-5)
 *
 * Trials must be sorted most-recent-first (descending by foodTimestamp).
 */
export function countRecentConsecutiveGoodTrials(
  trials: FoodEvidenceTrial[],
): number {
  let count = 0;
  for (const trial of trials) {
    if (trial.outcome !== "good") break;
    // Additional Bristol code check: outcome "good" already implies Bristol 3-5,
    // but verify explicitly when the code is available
    if (
      trial.bristolCode !== null &&
      (trial.bristolCode < RECOVERY_GOOD_BRISTOL_MIN ||
        trial.bristolCode > RECOVERY_GOOD_BRISTOL_MAX)
    ) {
      break;
    }
    count += 1;
  }
  return count;
}

function primaryStatusFromSignals(args: {
  effectiveEvidence: number;
  posteriorSafety: number;
  severeLowConfounderCount: number;
  resolvedTrialCount: number;
  safePosteriorThreshold: number;
  recentConsecutiveGoodTrials: number;
}): FoodPrimaryStatus {
  // Not enough evidence yet — still building
  if (
    args.effectiveEvidence < BUILDING_EVIDENCE_THRESHOLD &&
    args.resolvedTrialCount < INITIAL_GRADUATION_TRIALS
  ) {
    return "building";
  }

  // Determine the raw status from Bayesian signals
  if (args.posteriorSafety < 0.35 && args.severeLowConfounderCount >= 2) {
    // Recovery path: food was "avoid" but has enough recent consecutive good trials
    if (args.recentConsecutiveGoodTrials >= RECOVERY_GRADUATION_TRIALS) {
      return "safe";
    }
    return "avoid";
  }

  if (
    args.posteriorSafety < 0.35 &&
    args.effectiveEvidence >= BUILDING_EVIDENCE_THRESHOLD * 2
  ) {
    // Recovery path: food was "watch" but has enough recent consecutive good trials
    if (args.recentConsecutiveGoodTrials >= RECOVERY_GRADUATION_TRIALS) {
      return "safe";
    }
    return "watch";
  }

  if (args.posteriorSafety >= args.safePosteriorThreshold) return "safe";

  // Below safe threshold but not strongly negative — watch status.
  // Recovery path still applies here.
  if (args.recentConsecutiveGoodTrials >= RECOVERY_GRADUATION_TRIALS) {
    return "safe";
  }

  return "watch";
}

export function toLegacyFoodStatus(
  primaryStatus: FoodPrimaryStatus,
  tendency: FoodTendency,
): "testing" | "safe" | "safe-loose" | "safe-hard" | "watch" | "risky" {
  if (primaryStatus === "building") return "testing";
  if (primaryStatus === "watch") return "watch";
  if (primaryStatus === "avoid") return "risky";
  if (tendency === "loose") return "safe-loose";
  if (tendency === "hard") return "safe-hard";
  return "safe";
}

export function buildFoodEvidenceResult(args: {
  logs: FoodEvidenceLog[];
  habits?: HabitLike[];
  assessments?: FoodAssessmentRecord[];
  calibration?: TransitCalibration;
  now?: number;
}): FoodEvidenceResult {
  const now = args.now ?? Date.now();
  const resolvedTrials = resolveTrials(
    args.logs,
    args.habits ?? [],
    args.calibration,
  );
  const allFoodTrials = buildFoodTrials(args.logs);
  const allDigestiveEvents = buildDigestiveEvents(args.logs);

  // Compute trigger correlations (Bristol 6-7 within 0-3h of eating)
  const triggerMap = findTriggerCorrelations(allFoodTrials, allDigestiveEvents);

  const calibration = learnTransitCalibration(
    resolvedTrials,
    now,
    args.calibration,
  );
  const groupedTrials = new Map<string, FoodEvidenceTrial[]>();
  const groupedTrialCounts = new Map<string, number>();
  const groupedAssessments = new Map<string, FoodAssessmentRecord[]>();
  const displayNames = new Map<string, string>();
  const firstSeen = new Map<string, number>();
  const lastSeen = new Map<string, number>();

  for (const trial of allFoodTrials) {
    displayNames.set(trial.canonicalName, trial.displayName);
    const existingFirst = firstSeen.get(trial.canonicalName) ?? trial.timestamp;
    firstSeen.set(
      trial.canonicalName,
      Math.min(existingFirst, trial.timestamp),
    );
    const existingLast = lastSeen.get(trial.canonicalName) ?? trial.timestamp;
    lastSeen.set(trial.canonicalName, Math.max(existingLast, trial.timestamp));
    groupedTrialCounts.set(
      trial.canonicalName,
      (groupedTrialCounts.get(trial.canonicalName) ?? 0) + 1,
    );
  }

  for (const trial of resolvedTrials) {
    const current = groupedTrials.get(trial.canonicalName) ?? [];
    current.push(trial);
    groupedTrials.set(trial.canonicalName, current);
  }

  for (const assessment of args.assessments ?? []) {
    const current = groupedAssessments.get(assessment.canonicalName) ?? [];
    current.push(assessment);
    groupedAssessments.set(assessment.canonicalName, current);
    displayNames.set(assessment.canonicalName, assessment.foodName);
    const existingFirst =
      firstSeen.get(assessment.canonicalName) ?? assessment.reportTimestamp;
    firstSeen.set(
      assessment.canonicalName,
      Math.min(existingFirst, assessment.reportTimestamp),
    );
    const existingLast =
      lastSeen.get(assessment.canonicalName) ?? assessment.reportTimestamp;
    lastSeen.set(
      assessment.canonicalName,
      Math.max(existingLast, assessment.reportTimestamp),
    );
  }

  const allKeys = new Set<string>(groupedTrials.keys());

  for (const key of displayNames.keys()) {
    const trialCount = groupedTrialCounts.get(key) ?? 0;
    if (trialCount === 0) continue;
    allKeys.add(key);
  }

  const summaries: FoodEvidenceSummary[] = Array.from(allKeys)
    .map((canonicalName) => {
      const trials = (groupedTrials.get(canonicalName) ?? []).sort(
        (a, b) => b.foodTimestamp - a.foodTimestamp,
      );
      const assessments = (groupedAssessments.get(canonicalName) ?? []).sort(
        (a, b) => b.reportTimestamp - a.reportTimestamp,
      );

      let codePositive = 0;
      let codeNegative = 0;
      let positiveEvidence = PRIOR_POSITIVE;
      let negativeEvidence = PRIOR_NEGATIVE;
      const zone = getFoodZone(canonicalName);
      const negativeEvidenceMultiplier =
        negativeEvidenceMultiplierForZone(zone);
      const safePosteriorThreshold = safePosteriorThresholdForZone(zone);

      // Get trigger evidence for this food
      const foodTriggerEvidence = triggerMap.get(canonicalName) ?? [];

      for (const trial of trials) {
        const decay = recencyWeight(trial.foodTimestamp, now);

        // Check if this transit trial is unreliable due to a Bristol 7
        // trigger event — the food was flushed, transit timing is meaningless
        const transitUnreliable = isTransitUnreliableDueToTrigger(
          trial,
          triggerMap,
        );

        if (trial.outcome === "good") {
          // Transit-unreliable trials still count as good (the food
          // didn't cause a problem through normal transit), but at
          // reduced weight since the data point is noisy
          const reliabilityScale = transitUnreliable ? 0.25 : 1;
          const contribution =
            1 * trial.modifierReliability * decay * reliabilityScale;
          codePositive += contribution;
          positiveEvidence += contribution;
        } else {
          // For negative outcomes, transit-unreliable trials get heavily
          // downweighted — the negative outcome is explained by the
          // trigger (gastrocolic reflex), not normal transit
          const reliabilityScale = transitUnreliable ? 0.1 : 1;
          const contribution =
            trial.negativeWeight *
            negativeEvidenceMultiplier *
            trial.modifierReliability *
            decay *
            reliabilityScale;
          codeNegative += contribution;
          negativeEvidence += contribution;
        }
      }

      // Add trigger evidence as an additional negative signal.
      // Trigger events (Bristol 6-7 within 3h of eating) indicate the
      // food provoked a gastrocolic reflex — a strong "avoid" signal.
      for (const trigger of foodTriggerEvidence) {
        const decay = recencyWeight(trigger.foodTrialTimestamp, now);
        const contribution =
          trigger.weight * negativeEvidenceMultiplier * decay;
        codeNegative += contribution;
        negativeEvidence += contribution;
      }

      let aiScore = 0;
      for (const assessment of assessments) {
        const decay = recencyWeight(assessment.reportTimestamp, now);
        const contribution = assessmentScore(
          assessment.verdict,
          assessment.confidence,
          assessment.causalRole,
        );
        aiScore += contribution * decay;
      }

      if (aiScore >= 0) {
        positiveEvidence += aiScore;
      } else {
        negativeEvidence += Math.abs(aiScore);
      }

      const effectiveEvidence = Math.max(
        0,
        positiveEvidence + negativeEvidence - PRIOR_POSITIVE - PRIOR_NEGATIVE,
      );
      const posteriorSafety =
        positiveEvidence / Math.max(positiveEvidence + negativeEvidence, 1);
      const severeLowConfounderCount = trials.filter(
        (trial) => trial.severe && trial.modifierReliability >= 0.7,
      ).length;
      const tendency = tendencyFromTrials(trials);
      // trials are sorted most-recent-first (descending by foodTimestamp)
      const recentConsecutiveGoodTrials =
        countRecentConsecutiveGoodTrials(trials);
      const primaryStatus = primaryStatusFromSignals({
        effectiveEvidence,
        posteriorSafety,
        severeLowConfounderCount,
        resolvedTrialCount: trials.length,
        safePosteriorThreshold,
        recentConsecutiveGoodTrials,
      });
      const latestAssessment = assessments[0];
      const recentSuspect =
        assessments.some(
          (assessment) =>
            (assessment.verdict === "watch" ||
              assessment.verdict === "avoid") &&
            now - assessment.reportTimestamp <= 14 * DAY_BUCKET_MS,
        ) || severeLowConfounderCount > 0;
      const clearedHistory =
        primaryStatus === "safe" &&
        (assessments.some(
          (assessment) =>
            assessment.verdict === "watch" || assessment.verdict === "avoid",
        ) ||
          severeLowConfounderCount > 0);

      return {
        canonicalName,
        displayName:
          displayNames.get(canonicalName) ??
          formatFoodDisplayName(canonicalName),
        totalTrials: groupedTrialCounts.get(canonicalName) ?? trials.length,
        resolvedTrials: trials.length,
        codeScore: codePositive - codeNegative,
        aiScore,
        combinedScore: codePositive - codeNegative + aiScore,
        posteriorSafety,
        effectiveEvidence,
        confidence: Math.min(1, effectiveEvidence / 6),
        primaryStatus,
        tendency,
        recentSuspect,
        clearedHistory,
        learnedTransitCenterMinutes: calibration.centerMinutes,
        learnedTransitSpreadMinutes: calibration.spreadMinutes,
        latestAiVerdict: latestAssessment?.verdict ?? "none",
        latestAiReasoning: latestAssessment?.reasoning ?? "",
        lastTrialAt:
          lastSeen.get(canonicalName) ??
          trials[0]?.foodTimestamp ??
          latestAssessment?.reportTimestamp ??
          0,
        firstSeenAt:
          firstSeen.get(canonicalName) ??
          trials[trials.length - 1]?.foodTimestamp ??
          latestAssessment?.reportTimestamp ??
          0,
        culpritCount: assessments.filter(
          (assessment) => assessment.verdict === "avoid",
        ).length,
        safeCount: assessments.filter(
          (assessment) => assessment.verdict === "safe",
        ).length,
        nextToTryCount: assessments.filter(
          (assessment) => assessment.verdict === "trial_next",
        ).length,
        totalAssessments: assessments.length,
        ...(latestAssessment?.confidence && {
          latestConfidence: latestAssessment.confidence,
        }),
        ...(latestAssessment?.modifierSummary && {
          latestModifierSummary: latestAssessment.modifierSummary,
        }),
        trials,
        triggerEvidenceCount: foodTriggerEvidence.length,
        triggerEvidence: foodTriggerEvidence,
      };
    })
    .sort(
      (a, b) =>
        b.lastTrialAt - a.lastTrialAt ||
        a.displayName.localeCompare(b.displayName),
    );

  return {
    summaries,
    transitCalibration: calibration,
  };
}

export function normalizeAssessmentRecord(args: {
  food: string;
  verdict: FoodAssessmentVerdict;
  confidence?: FoodAssessmentConfidence;
  causalRole?: FoodAssessmentCausalRole;
  changeType?: FoodAssessmentChangeType;
  modifierSummary?: string;
  reasoning: string;
  reportTimestamp: number;
}): FoodAssessmentRecord {
  const food = args.food.trim();
  return {
    food,
    foodName: formatFoodDisplayName(food),
    canonicalName: resolveCanonicalFoodName(food),
    verdict: args.verdict,
    confidence: args.confidence ?? "medium",
    causalRole: args.causalRole ?? "possible",
    changeType: args.changeType ?? "unchanged",
    modifierSummary: args.modifierSummary ?? "",
    reasoning: args.reasoning.trim(),
    reportTimestamp: args.reportTimestamp,
  };
}
