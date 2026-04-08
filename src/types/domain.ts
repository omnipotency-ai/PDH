import type {
  FoodMatchBucketOption,
  FoodMatchCandidate,
  FoodMatchResolver,
} from "../../shared/foodMatching";
import type { FoodGroup } from "../../shared/foodRegistry";
import type {
  FoodAssessmentCausalRole,
  FoodAssessmentChangeType,
  FoodAssessmentConfidence,
  FoodAssessmentVerdict,
  FoodPrimaryStatus,
  FoodTendency,
  TransitCalibration,
} from "../../shared/foodTypes";
import { DEFAULT_INSIGHT_MODEL, type InsightModel } from "../lib/aiModels";
import type { HabitConfig } from "../lib/habitTemplates";

export type {
  FoodAssessmentCausalRole,
  FoodAssessmentChangeType,
  FoodAssessmentConfidence,
  FoodAssessmentVerdict,
  FoodPrimaryStatus,
  FoodTendency,
  TransitCalibration,
};

import type { SleepGoal } from "../lib/gamificationDefaults";
import type { UnitSystem } from "../lib/units";

export type LogType = "food" | "liquid" | "fluid" | "digestion" | "habit" | "activity" | "weight";

export type SurgeryType =
  | "Colectomy with ileostomy"
  | "Colectomy with colostomy"
  | "Colectomy with primary anastomosis"
  | "Ileostomy reversal"
  | "Colostomy reversal"
  | "Other";
export type YesNoChoice = "yes" | "no" | "";
export type SmokingStatus = YesNoChoice | "never" | "former" | "current";
export type AlcoholUse = YesNoChoice | "none" | "occasional" | "regular";
export type RecreationalCategory = "stimulants" | "depressants";
export type UsageFrequency =
  | "more_than_once_per_day"
  | "daily"
  | "a_few_times_per_week"
  | "about_once_per_week"
  | "a_few_times_per_month"
  | "about_once_per_month"
  | "a_few_times_per_year"
  | "about_once_per_year_or_less";
export type UsageFrequencyChoice = UsageFrequency | "";

export const HEALTH_GI_CONDITION_OPTIONS = [
  "Short bowel syndrome",
  "IBD/IBS",
  "Crohn's disease",
  "Ulcerative colitis",
  "Prior bowel obstruction",
  "Prior bowel surgery",
  "Chronic diarrhea",
  "Chronic constipation",
  "Celiac disease",
] as const;

export const HEALTH_COMORBIDITY_OPTIONS = [
  "Diabetes",
  "High blood sugar",
  "Thyroid disorder",
  "Kidney disease",
  "Heart disease",
  "High blood pressure",
  "HIV+",
] as const;

export type Gender = "male" | "female" | "non_binary" | "prefer_not_to_say" | "";

// ── Nutrition Goals ───────────────────────────────────────────────────────────

export interface NutritionGoals {
  dailyCalorieGoal: number;
  dailyWaterGoalMl: number;
}

export const DEFAULT_NUTRITION_GOALS: NutritionGoals = {
  dailyCalorieGoal: 1850,
  dailyWaterGoalMl: 2000,
};

// ── Food Personalisation ──────────────────────────────────────────────────────

/** How cautiously Dr. Poo upgrades foods and makes suggestions. */
export type CautionLevel = "conservative" | "balanced" | "adventurous";

/** How many good trials are required before a food is considered safe. */
export type UpgradeSpeed = "conservative" | "balanced" | "adventurous";

export interface FoodPersonalisation {
  cautionLevel: CautionLevel;
  upgradeSpeed: UpgradeSpeed;
}

export const DEFAULT_FOOD_PERSONALISATION: FoodPersonalisation = {
  cautionLevel: "balanced",
  upgradeSpeed: "balanced",
};

// ── AI Preferences ────────────────────────────────────────────────────────────

export type AiModel = InsightModel;

/** Axis 1 — Approach: emotional orientation / relationship style */
export type Approach = "supportive" | "personal" | "analytical";
/** Axis 2 — Register: vocabulary and terminology level */
export type Register = "everyday" | "mixed" | "clinical";
/** Axis 3 — Structure: how the output is formatted */
export type OutputFormat = "narrative" | "mixed" | "structured";
/** Axis 4 — Length: how much detail per section */
export type OutputLength = "concise" | "standard" | "detailed";

/** Named presets that map to sensible axis combinations */
export type DrPooPreset =
  | "reassuring_coach"
  | "clear_clinician"
  | "data_deep_dive"
  | "quiet_checkin"
  | "custom";

export type MealSchedule = {
  breakfast: string;
  middaySnack: string;
  lunch: string;
  midafternoonSnack: string;
  dinner: string;
  lateEveningSnack: string;
};

export interface AiPreferences {
  preferredName: string;
  locationTimezone: string;
  mealSchedule: MealSchedule;
  aiModel: AiModel;
  approach: Approach;
  register: Register;
  outputFormat: OutputFormat;
  outputLength: OutputLength;
  /** Named preset — "custom" when user has manually adjusted axes */
  preset: DrPooPreset;
  /** Monotonically incrementing prompt version — changing personality resets context */
  promptVersion: number;
  /** Controls when Dr. Poo reports are generated after bowel logs. undefined = "auto". */
  reportTriggerMode?: "auto" | "manual";
}

/** Preset definitions mapping preset name → axis values */
export const DR_POO_PRESETS: Record<
  Exclude<DrPooPreset, "custom">,
  Pick<AiPreferences, "approach" | "register" | "outputFormat" | "outputLength">
> = {
  reassuring_coach: {
    approach: "supportive",
    register: "mixed",
    outputFormat: "mixed",
    outputLength: "standard",
  },
  clear_clinician: {
    approach: "personal",
    register: "clinical",
    outputFormat: "structured",
    outputLength: "concise",
  },
  data_deep_dive: {
    approach: "analytical",
    register: "mixed",
    outputFormat: "structured",
    outputLength: "detailed",
  },
  quiet_checkin: {
    approach: "personal",
    register: "everyday",
    outputFormat: "narrative",
    outputLength: "concise",
  },
};

// Default meal schedule uses the midpoint of each common eating window:
//   Breakfast 7–9am → 08:00, Mid-morning snack 10–11am → 10:30,
//   Lunch 12–2pm → 13:00, Afternoon snack 3–4pm → 15:30,
//   Dinner 5–7pm → 18:00, Evening snack 8–9pm → 20:30.
// Tracked in work queue: expose these as user-configurable defaults in the onboarding flow.
export const DEFAULT_AI_PREFERENCES: AiPreferences = {
  preferredName: "",
  locationTimezone: "",
  mealSchedule: {
    breakfast: "08:00",
    middaySnack: "10:30",
    lunch: "13:00",
    midafternoonSnack: "15:30",
    dinner: "18:00",
    lateEveningSnack: "20:30",
  },
  aiModel: DEFAULT_INSIGHT_MODEL,
  approach: "supportive",
  register: "mixed",
  outputFormat: "mixed",
  outputLength: "standard",
  preset: "reassuring_coach",
  promptVersion: 3,
};

export interface HealthProfile {
  gender: Gender;
  ageYears: number | null;
  surgeryType: SurgeryType;
  surgeryTypeOther: string;
  surgeryDate: string;
  height: number | null;
  startingWeight: number | null;
  currentWeight: number | null;
  targetWeight: number | null;
  comorbidities: string[];
  otherConditions: string;
  medications: string;
  supplements: string;
  allergies: string;
  intolerances: string;
  dietaryHistory: string;
  smokingStatus: SmokingStatus;
  smokingCigarettesPerDay: number | null;
  smokingYears: number | null;
  alcoholUse: AlcoholUse;
  alcoholAmountPerSession: string;
  alcoholFrequency: UsageFrequencyChoice;
  alcoholYearsAtCurrentLevel: number | null;
  recreationalDrugUse: string;
  recreationalCategories: RecreationalCategory[];
  recreationalStimulantsFrequency: UsageFrequencyChoice;
  recreationalStimulantsYears: number | null;
  recreationalDepressantsFrequency: UsageFrequencyChoice;
  recreationalDepressantsYears: number | null;
  lifestyleNotes: string;
}

export interface DrPooReply {
  text: string;
  timestamp: number;
}

/** A user-configured drink choice shown in the Track fluid panel. */
export interface FluidPreset {
  name: string;
}

// TransitCalibration is re-exported from shared/foodTypes.ts at the top of this file.

export const DEFAULT_TRANSIT_CALIBRATION: TransitCalibration = {
  source: "default",
  centerMinutes: 12 * 60,
  spreadMinutes: 6 * 60,
  sampleSize: 0,
  learnedAt: null,
};

/** Draft state for a single fluid preset row. */
export interface FluidPresetDraft {
  name: string;
}

export interface PersistedProfileSettings {
  unitSystem: UnitSystem;
  habits: HabitConfig[];
  fluidPresets?: FluidPreset[];
  sleepGoal?: SleepGoal;
  healthProfile?: HealthProfile;
  aiPreferences?: AiPreferences;
  foodPersonalisation?: FoodPersonalisation;
  transitCalibration?: TransitCalibration;
}

export interface AiNutritionistInsight {
  /** Direct reply to the patient's messages. Null if no patient messages. */
  directResponseToUser: string | null;
  summary: string;
  /** Free-form clinical reasoning — the model's deductive working (markdown). Null on older reports. */
  clinicalReasoning: string | null;
  /** Novel educational fact — food chemistry, gut anatomy, or recovery science. */
  educationalInsight: { topic: string; fact: string } | null;
  foodAssessments?: StructuredFoodAssessment[];
  suspectedCulprits: Array<{
    food: string;
    confidence: "high" | "medium" | "low";
    reasoning: string;
  }>;
  mealPlan: Array<{ meal: string; items: string[]; reasoning: string }>;
  suggestions: string[];
}

// FoodPrimaryStatus, FoodTendency, FoodAssessmentVerdict, FoodAssessmentConfidence,
// FoodAssessmentCausalRole, FoodAssessmentChangeType are re-exported from
// shared/foodTypes.ts at the top of this file.

export interface StructuredFoodAssessment {
  food: string;
  verdict: FoodAssessmentVerdict;
  confidence: FoodAssessmentConfidence;
  causalRole: FoodAssessmentCausalRole;
  changeType: FoodAssessmentChangeType;
  modifierSummary: string;
  reasoning: string;
}

export type AiAnalysisStatus = "idle" | "sending" | "receiving" | "done" | "error";
export type AiAnalysisProgressStep = "sending" | "receiving" | "done";

export interface FoodItem {
  // New field names
  userSegment?: string;
  parsedName?: string;
  resolvedBy?: "registry" | "llm" | "heuristic" | "user" | "expired";
  // Legacy field names (for existing data)
  name?: string;
  rawName?: string | null;
  // Unchanged fields
  canonicalName?: string | null;
  quantity: number | null;
  unit: string | null;
  quantityText?: string | null;
  defaultPortionDisplay?: string;
  preparation?: string;
  recoveryStage?: 1 | 2 | 3;
  spiceLevel?: "plain" | "mild" | "spicy";
  productId?: string;
  bucketKey?: string;
  bucketLabel?: string;
  matchConfidence?: number;
  matchStrategy?: FoodMatchResolver;
  matchCandidates?: Array<
    Omit<FoodMatchCandidate, "resolver" | "examples"> & {
      resolver: FoodMatchResolver;
      examples: string[];
    }
  >;
  bucketOptions?: Array<
    Omit<FoodMatchBucketOption, "canonicalOptions"> & {
      canonicalOptions: string[];
    }
  >;
}

export const GROUP_COLORS: Record<FoodGroup, { primary: string; glow: string }> = {
  protein: { primary: "teal-400", glow: "teal-500" },
  carbs: { primary: "amber-400", glow: "amber-500" },
  fats: { primary: "violet-400", glow: "violet-500" },
  seasoning: { primary: "yellow-400", glow: "yellow-500" },
};

// ── Typed log data interfaces ──────────────────────────────────────────────

export interface FoodLogData {
  rawInput?: string;
  items: FoodItem[];
  notes?: string;
  mealSlot?: "breakfast" | "lunch" | "dinner" | "snack";
}

export interface FluidLogData {
  items: Array<{ name: string; quantity: number; unit: string }>;
}

export interface DigestiveLogData {
  bristolCode: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  urgencyTag?: string;
  effortTag?: string;
  consistencyTag?: string;
  volumeTag?: string;
  accident?: boolean;
  notes?: string;
  episodesCount?: number | string;
  windowMinutes?: number;
}

export interface HabitLogData {
  habitId: string;
  name: string;
  habitType: string;
  quantity?: number;
  action?: string;
}

export interface ActivityLogData {
  activityType: string;
  durationMinutes?: number;
  feelTag?: string;
}

export interface WeightLogData {
  weightKg: number;
}

/** Maps LogType to its corresponding data shape */
export interface LogDataMap {
  food: FoodLogData;
  liquid: FoodLogData;
  fluid: FluidLogData;
  digestion: DigestiveLogData;
  habit: HabitLogData;
  activity: ActivityLogData;
  weight: WeightLogData;
}

/** Discriminated union of all log entry types with properly typed data */
export type LogEntry = {
  [K in LogType]: {
    id: string;
    timestamp: number;
    type: K;
    data: LogDataMap[K];
  };
}[LogType];

// ── Narrowed log type aliases ────────────────────────────────────────────────
export type FoodLog = LogEntry & { type: "food"; data: FoodLogData };
export type LiquidLog = LogEntry & { type: "liquid"; data: FoodLogData };
export type FluidLog = LogEntry & { type: "fluid"; data: FluidLogData };
export type DigestiveLog = LogEntry & {
  type: "digestion";
  data: DigestiveLogData;
};
export type HabitLogEntry = LogEntry & { type: "habit"; data: HabitLogData };
export type ActivityLog = LogEntry & {
  type: "activity";
  data: ActivityLogData;
};
export type WeightLog = LogEntry & { type: "weight"; data: WeightLogData };

// ── Baseline averages ─────────────────────────────────────────────────────────

/** Per-habit baseline average computed across all logged days. */
export interface HabitBaseline {
  habitId: string;
  habitName: string;
  habitType: string;
  /** Average daily value across days that have at least one log for this habit. */
  avgPerLoggedDay: number;
  /** Average daily value across ALL days in the tracking window (including zero-days). */
  avgPerCalendarDay: number;
  /** For checkbox habits: percentage of calendar days where target was met (0–1). */
  completionRate: number | null;
  /** Total number of calendar days in the tracking window. */
  calendarDays: number;
  /** Number of days with at least one log for this habit. */
  loggedDays: number;
  /** Unit of measurement for this habit. */
  unit: string;
}

/** Per-fluid baseline average computed across all logged days. */
export interface FluidBaseline {
  /** Normalized fluid name (lowercase). */
  fluidName: string;
  /** Average ml/day across all calendar days. */
  avgMlPerDay: number;
  /** Average ml/day across days with at least one fluid log. */
  avgMlPerLoggedDay: number;
  /** Number of calendar days in the tracking window. */
  calendarDays: number;
  /** Number of days with at least one log for this fluid. */
  loggedDays: number;
}

/** Today's value compared to the all-time baseline. */
export interface BaselineDelta {
  habitId: string;
  todayValue: number;
  baselineAvg: number;
  /** todayValue - baselineAvg */
  absoluteDelta: number;
  /** (todayValue - baselineAvg) / baselineAvg, null if baselineAvg is 0 */
  percentDelta: number | null;
}

/** Aggregated baseline averages and 24h deltas for all tracked metrics. */
export interface BaselineAverages {
  /** Per-habit baselines keyed by habitId. */
  habits: Record<string, HabitBaseline>;
  /** Per-fluid baselines keyed by normalized fluid name. */
  fluids: Record<string, FluidBaseline>;
  /** Total fluid intake avg ml/day across all calendar days. */
  totalFluidAvgMlPerDay: number;
  /** Water-only avg ml/day across all calendar days. */
  waterAvgMlPerDay: number;
  /** Average weight across all weigh-in logs, or null if no weigh-ins. */
  avgWeightKg: number | null;
  /** Average bowel movements per day across calendar days with at least one digestion log. */
  avgBmPerDay: number;
  /** Average Bristol score across all digestion logs, or null if none. */
  avgBristolScore: number | null;
  /** 24h deltas: today's values vs baseline, keyed by habitId. */
  deltas: Record<string, BaselineDelta>;
  /** Fluid deltas keyed by normalized fluid name. */
  fluidDeltas: Record<string, BaselineDelta>;
  /** Total fluid delta for today vs baseline. */
  totalFluidDelta: BaselineDelta | null;
  /** Epoch ms when these baselines were last computed. */
  computedAt: number;
  /** Epoch ms when the AI insight job last consumed these baselines. */
  lastInsightRunAt: number | null;
  /** True if today's totals have changed since the last insight run. */
  changedSinceLastRun: boolean;
}
