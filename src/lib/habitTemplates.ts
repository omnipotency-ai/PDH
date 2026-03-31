export type HabitKind = "positive" | "destructive";
export type HabitUnit = "count" | "ml" | "minutes" | "hours";

export type HabitType =
  | "sleep"
  | "count"
  | "activity"
  | "fluid"
  | "destructive"
  | "checkbox"
  | "weight";

/** Patch type for updateHabit. Allows explicitly setting optional fields to
 *  `undefined` to clear them — required for exactOptionalPropertyTypes compat. */
export type HabitConfigPatch = {
  [K in keyof HabitConfig]?: HabitConfig[K] | undefined;
};

export interface HabitConfig {
  id: string;
  name: string;
  kind: HabitKind;
  unit: HabitUnit;
  quickIncrement: number;
  dailyTarget?: number;
  dailyCap?: number;
  /** Optional activity-only target for number of sessions per week. */
  weeklyFrequencyTarget?: number;
  showOnTrack: boolean;
  color: string;
  createdAt: number;
  archivedAt?: number;
  logAs?: "habit" | "fluid";
  /** Canonical behavior type used by creation, UI branching, and settings. */
  habitType: HabitType;
  /** Optional reference to immutable template metadata. */
  templateKey?: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  value: number;
  source: "quick" | "ai" | "import";
  at: number;
  bmId?: string;
}

// --- Internal helpers ---

const LEGACY_HABIT_TYPE_MAP: Record<string, HabitType> = {
  cigarettes: "destructive",
  rec_drugs: "destructive",
  confectionery: "destructive",
  alcohol: "destructive",
  movement: "activity",
  hydration: "fluid",
  medication: "checkbox",
  custom: "count",
  hygiene: "count",
  wellness: "count",
  recovery: "count",
};

const DIGESTIVE_HABIT_TYPES = new Set<HabitType>(["destructive", "checkbox", "fluid", "sleep"]);

function toTemplateKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, "_");
}

function inferHabitTypeFromName(name: string): HabitType {
  const key = toTemplateKey(name);
  if (/sleep|nap/.test(key)) return "sleep";
  if (/walk|movement|steps|run|yoga|stretch|breath|swim|workout/.test(key)) return "activity";
  if (/water|hydrat|tea|coffee|electrolyte|juice/.test(key)) return "fluid";
  if (/cig|smok|nicotine|alcohol|beer|wine|spirit|sweet|candy|drug/.test(key)) {
    return "destructive";
  }
  if (/med|pill|tablet|medicine|dressing|wound/.test(key)) return "checkbox";
  if (/weight|weigh/.test(key)) return "weight";
  return "count";
}

function inferKind(habitType: HabitType): HabitKind {
  return habitType === "destructive" ? "destructive" : "positive";
}

function normalizeHabitTypeValue(input: {
  rawType: unknown;
  rawName: unknown;
  rawKind: unknown;
  rawUnit: unknown;
  rawDailyTarget: unknown;
  rawDailyCap: unknown;
  rawLogAs: unknown;
}): HabitType {
  const rawType = typeof input.rawType === "string" ? input.rawType.trim().toLowerCase() : "";
  const rawKind = typeof input.rawKind === "string" ? input.rawKind.trim().toLowerCase() : "";
  const rawUnit = typeof input.rawUnit === "string" ? input.rawUnit.trim().toLowerCase() : "";
  const rawName = typeof input.rawName === "string" ? input.rawName.trim() : "";

  if (
    rawType === "sleep" ||
    rawType === "count" ||
    rawType === "activity" ||
    rawType === "fluid" ||
    rawType === "destructive" ||
    rawType === "checkbox" ||
    rawType === "weight"
  ) {
    return rawType;
  }

  if (rawType in LEGACY_HABIT_TYPE_MAP) {
    const mapped = LEGACY_HABIT_TYPE_MAP[rawType];
    if (mapped === "fluid" && rawKind === "destructive") {
      return "destructive";
    }
    return mapped;
  }

  const dailyCap = typeof input.rawDailyCap === "number" ? input.rawDailyCap : undefined;
  if (typeof dailyCap === "number" && dailyCap > 0) return "destructive";

  const dailyTarget = typeof input.rawDailyTarget === "number" ? input.rawDailyTarget : undefined;
  if (rawUnit === "count" && typeof dailyTarget === "number" && dailyTarget === 1) {
    return "checkbox";
  }

  if (input.rawLogAs === "fluid") {
    return rawKind === "destructive" ? "destructive" : "fluid";
  }

  return inferHabitTypeFromName(rawName);
}

// --- Public helpers ---

export function isDigestiveHabit(habit: HabitConfig): boolean {
  return DIGESTIVE_HABIT_TYPES.has(habit.habitType);
}

export function isFluidHabit(habit: HabitConfig): boolean {
  return habit.logAs === "fluid" || habit.habitType === "fluid";
}

export function isCapHabit(habit: HabitConfig): boolean {
  return habit.kind === "destructive" && habit.dailyCap !== undefined;
}

export function isTargetHabit(habit: HabitConfig): boolean {
  return habit.kind === "positive" && habit.dailyTarget !== undefined;
}

export function isSleepHabit(habit: HabitConfig): boolean {
  return habit.habitType === "sleep" || habit.id === "habit_sleep";
}

export function isMovementHabit(habit: HabitConfig): boolean {
  return habit.habitType === "activity";
}

export function isCheckboxHabit(habit: HabitConfig): boolean {
  if (habit.habitType === "checkbox") return true;

  // Legacy compatibility for old stored data that encoded checkbox habits via
  // count + increment=1 + dailyTarget=1.
  return (
    habit.unit === "count" &&
    habit.quickIncrement === 1 &&
    habit.kind === "positive" &&
    (habit.dailyTarget ?? 0) === 1
  );
}

export function isDestructiveHabit(habit: HabitConfig): boolean {
  return habit.habitType === "destructive" || habit.kind === "destructive";
}

export function isActivityHabit(habit: HabitConfig): boolean {
  return habit.habitType === "activity";
}

// --- Templates ---

export const HABIT_TEMPLATES: Record<string, HabitConfig> = {
  water: {
    id: "habit_water",
    name: "Water",
    kind: "positive",
    unit: "ml",
    quickIncrement: 100,
    dailyTarget: 1000,
    showOnTrack: true,
    color: "blue",
    createdAt: 0,
    logAs: "fluid",
    habitType: "fluid",
    templateKey: "water",
  },
  tea: {
    id: "habit_tea",
    name: "Tea",
    kind: "positive",
    unit: "ml",
    quickIncrement: 250,
    dailyTarget: 750,
    showOnTrack: true,
    color: "blue",
    createdAt: 0,
    logAs: "fluid",
    habitType: "fluid",
    templateKey: "tea",
  },
  electrolyte: {
    id: "habit_electrolyte",
    name: "Electrolyte drink",
    kind: "positive",
    unit: "ml",
    quickIncrement: 250,
    dailyTarget: 500,
    showOnTrack: true,
    color: "blue",
    createdAt: 0,
    logAs: "fluid",
    habitType: "fluid",
    templateKey: "electrolyte",
  },
  sleep: {
    id: "habit_sleep",
    name: "Sleep",
    kind: "positive",
    unit: "hours",
    quickIncrement: 0.5,
    dailyTarget: 7,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "sleep",
    templateKey: "sleep",
  },
  weigh_in: {
    id: "habit_weigh_in",
    name: "Weigh-in",
    kind: "positive",
    unit: "count",
    quickIncrement: 1,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "weight",
    templateKey: "weigh_in",
  },
  walking: {
    id: "habit_walking",
    name: "Walking",
    kind: "positive",
    unit: "minutes",
    quickIncrement: 10,
    dailyTarget: 30,
    weeklyFrequencyTarget: 3,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "activity",
    templateKey: "walking",
  },
  yoga: {
    id: "habit_yoga",
    name: "Yoga",
    kind: "positive",
    unit: "minutes",
    quickIncrement: 15,
    dailyTarget: 20,
    weeklyFrequencyTarget: 3,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "activity",
    templateKey: "yoga",
  },
  stretching: {
    id: "habit_stretching",
    name: "Stretching",
    kind: "positive",
    unit: "minutes",
    quickIncrement: 10,
    dailyTarget: 10,
    weeklyFrequencyTarget: 4,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "activity",
    templateKey: "stretching",
  },
  breathing: {
    id: "habit_breathing",
    name: "Breathing",
    kind: "positive",
    unit: "minutes",
    quickIncrement: 10,
    dailyTarget: 10,
    weeklyFrequencyTarget: 4,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "activity",
    templateKey: "breathing",
  },
  medication: {
    id: "habit_medication",
    name: "Medication",
    kind: "positive",
    unit: "count",
    quickIncrement: 1,
    dailyTarget: 1,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "checkbox",
    templateKey: "medication",
  },
  morning_medication: {
    id: "habit_medication_am",
    name: "Morning medication",
    kind: "positive",
    unit: "count",
    quickIncrement: 1,
    dailyTarget: 1,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "checkbox",
    templateKey: "morning_medication",
  },
  afternoon_medication: {
    id: "habit_medication_pm",
    name: "Afternoon medication",
    kind: "positive",
    unit: "count",
    quickIncrement: 1,
    dailyTarget: 1,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "checkbox",
    templateKey: "afternoon_medication",
  },
  evening_medication: {
    id: "habit_medication_night",
    name: "Evening medication",
    kind: "positive",
    unit: "count",
    quickIncrement: 1,
    dailyTarget: 1,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "checkbox",
    templateKey: "evening_medication",
  },
  wound_dressing_checkbox: {
    id: "habit_wound_dressing_checkbox",
    name: "Change dressing",
    kind: "positive",
    unit: "count",
    quickIncrement: 1,
    dailyTarget: 1,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "checkbox",
    templateKey: "wound_dressing_checkbox",
  },
  wound_dressing_count: {
    id: "habit_wound_dressing_count",
    name: "Dressing changes",
    kind: "positive",
    unit: "count",
    quickIncrement: 1,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "count",
    templateKey: "wound_dressing_count",
  },
  cigarettes: {
    id: "habit_cigarettes",
    name: "Cigarettes",
    kind: "destructive",
    unit: "count",
    quickIncrement: 1,
    dailyCap: 10,
    showOnTrack: true,
    color: "gray",
    createdAt: 0,
    habitType: "destructive",
    templateKey: "cigarettes",
  },
  rec_drugs: {
    id: "habit_rec_drugs",
    name: "Rec Drugs",
    kind: "destructive",
    unit: "count",
    quickIncrement: 1,
    dailyCap: 1,
    showOnTrack: true,
    color: "gray",
    createdAt: 0,
    habitType: "destructive",
    templateKey: "rec_drugs",
  },
  alcohol: {
    id: "habit_alcohol",
    name: "Alcohol",
    kind: "destructive",
    unit: "count",
    quickIncrement: 1,
    dailyCap: 2,
    showOnTrack: true,
    color: "gray",
    createdAt: 0,
    habitType: "destructive",
    templateKey: "alcohol",
  },
  confectionery: {
    id: "habit_confectionery",
    name: "Sweets",
    kind: "destructive",
    unit: "count",
    quickIncrement: 1,
    dailyCap: 5,
    showOnTrack: true,
    color: "gray",
    createdAt: 0,
    habitType: "destructive",
    templateKey: "confectionery",
  },
  coffee: {
    id: "habit_coffee",
    name: "Coffee",
    kind: "destructive",
    // unit is "count" (cups) but quickIncrement is 250 (ml per cup) — used by
    // getProgressValue() to convert fluidMl to cup count for cap comparison.
    unit: "count",
    quickIncrement: 250,
    dailyCap: 3,
    showOnTrack: true,
    color: "gray",
    createdAt: 0,
    logAs: "fluid",
    habitType: "destructive",
    templateKey: "coffee",
  },
  journaling: {
    id: "habit_journaling",
    name: "Journaling",
    kind: "positive",
    unit: "count",
    quickIncrement: 1,
    dailyTarget: 1,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "count",
    templateKey: "journaling",
  },
};

export const DEFAULT_HABIT_TEMPLATE_KEYS = [
  "water",
  "sleep",
  "weigh_in",
  "walking",
  "medication",
] as const;

export function getDefaultHabitTemplates(): HabitConfig[] {
  return DEFAULT_HABIT_TEMPLATE_KEYS.map((key) => HABIT_TEMPLATES[key]).filter(Boolean);
}

// --- Validation ---

const VALID_HABIT_UNITS: ReadonlySet<string> = new Set<HabitUnit>([
  "count",
  "ml",
  "minutes",
  "hours",
]);

function isHabitUnit(value: unknown): value is HabitUnit {
  return typeof value === "string" && VALID_HABIT_UNITS.has(value);
}

const VALID_HABIT_TYPES: ReadonlySet<string> = new Set<HabitType>([
  "sleep",
  "count",
  "activity",
  "fluid",
  "destructive",
  "checkbox",
  "weight",
]);

export function isHabitType(value: unknown): value is HabitType {
  return typeof value === "string" && VALID_HABIT_TYPES.has(value);
}

function coerceHabitType(habit: Record<string, unknown>): HabitType {
  return normalizeHabitTypeValue({
    rawType: habit.habitType,
    rawName: habit.name,
    rawKind: habit.kind,
    rawUnit: habit.unit,
    rawDailyTarget: habit.dailyTarget,
    rawDailyCap: habit.dailyCap,
    rawLogAs: habit.logAs,
  });
}

function validateHabitConfig(habit: Record<string, unknown>): HabitConfig {
  const id = habit.id;
  const name = habit.name;
  const unit = habit.unit;
  const quickIncrement = habit.quickIncrement;
  const showOnTrack = habit.showOnTrack;
  const color = habit.color;
  const createdAt = habit.createdAt;

  if (typeof id !== "string" || id.length === 0) {
    throw new Error("HabitConfig: id must be a non-empty string");
  }
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("HabitConfig: name must be a non-empty string");
  }

  const habitType = coerceHabitType(habit);

  if (!isHabitUnit(unit)) {
    throw new Error(`HabitConfig: invalid unit "${String(unit)}"`);
  }

  const numericQuickIncrement =
    typeof quickIncrement === "number" && quickIncrement > 0 ? quickIncrement : undefined;

  if (numericQuickIncrement === undefined) {
    throw new Error("HabitConfig: quickIncrement must be a positive number");
  }

  if (typeof showOnTrack !== "boolean") {
    throw new Error("HabitConfig: showOnTrack must be a boolean");
  }
  if (typeof color !== "string" || color.length === 0) {
    throw new Error("HabitConfig: color must be a non-empty string");
  }
  if (typeof createdAt !== "number") {
    throw new Error("HabitConfig: createdAt must be a number");
  }

  const rawKind = habit.kind;
  let kind: HabitKind;
  if (rawKind === "positive" || rawKind === "destructive") {
    kind = rawKind;
  } else {
    kind = inferKind(habitType);
  }

  if (habitType === "destructive") {
    kind = "destructive";
  }

  if (habitType === "checkbox") {
    kind = "positive";
  }

  const result: HabitConfig = {
    id,
    name,
    kind,
    unit,
    quickIncrement: habitType === "checkbox" ? 1 : numericQuickIncrement,
    showOnTrack,
    color,
    createdAt,
    habitType,
  };

  if (typeof habit.dailyTarget === "number" && habit.dailyTarget > 0 && kind === "positive") {
    result.dailyTarget = habitType === "checkbox" ? 1 : habit.dailyTarget;
  }

  if (typeof habit.dailyCap === "number" && habit.dailyCap >= 0 && kind === "destructive") {
    result.dailyCap = habit.dailyCap;
  }

  if (habitType === "checkbox") {
    result.dailyTarget = 1;
    delete result.dailyCap;
  }

  if (habitType === "destructive") {
    delete result.dailyTarget;
  }

  if (habit.weeklyFrequencyTarget !== undefined) {
    if (
      typeof habit.weeklyFrequencyTarget !== "number" ||
      !Number.isFinite(habit.weeklyFrequencyTarget) ||
      habit.weeklyFrequencyTarget <= 0
    ) {
      throw new Error("HabitConfig: weeklyFrequencyTarget must be a positive number");
    }
    result.weeklyFrequencyTarget = Math.round(habit.weeklyFrequencyTarget);
  }

  if (habit.archivedAt !== undefined) {
    if (typeof habit.archivedAt !== "number") {
      throw new Error("HabitConfig: archivedAt must be a number if provided");
    }
    result.archivedAt = habit.archivedAt;
  }

  if (habit.logAs !== undefined) {
    if (habit.logAs !== "habit" && habit.logAs !== "fluid") {
      throw new Error(
        `HabitConfig: logAs must be "habit" or "fluid", got "${String(habit.logAs)}"`,
      );
    }
    result.logAs = habit.logAs;
  }

  if (habit.templateKey !== undefined) {
    if (typeof habit.templateKey !== "string") {
      throw new Error("HabitConfig: templateKey must be a string if provided");
    }
    result.templateKey = habit.templateKey;
  }

  // Final safety check in case any mapping function drifts.
  if (!isHabitType(result.habitType)) {
    throw new Error(`HabitConfig: invalid habitType "${String(result.habitType)}"`);
  }

  return result;
}

/**
 * Type-narrowing convenience: accepts either a typed HabitConfig or raw
 * persisted data (Record<string, unknown>) and returns a validated HabitConfig.
 * Callers in store.ts migration and settings forms use this so they don't need
 * to cast before calling validateHabitConfig.
 */
export function normalizeHabitConfig(habit: HabitConfig | Record<string, unknown>): HabitConfig {
  // Spread into a plain record so HabitConfig (no index signature) is
  // widened to Record<string, unknown> without a type assertion.
  const raw: Record<string, unknown> = { ...habit };
  return validateHabitConfig(raw);
}

// --- Custom habit creation ---

export function createCustomHabit(
  name: string,
  options: {
    habitType?: HabitType;
    kind?: HabitKind;
    unit?: HabitUnit;
    quickIncrement?: number;
    dailyTarget?: number;
    dailyCap?: number;
    weeklyFrequencyTarget?: number;
    color?: string;
    logAs?: "habit" | "fluid";
    templateKey?: string;
  } = {},
): HabitConfig {
  const habitType = options.habitType ?? inferHabitTypeFromName(name);
  const kind = options.kind ?? inferKind(habitType);
  const unit =
    options.unit ??
    (habitType === "sleep" ? "hours" : habitType === "activity" ? "minutes" : "count");
  const quickIncrement =
    options.quickIncrement ??
    (habitType === "fluid" ? 250 : habitType === "activity" ? 10 : habitType === "sleep" ? 0.5 : 1);
  const color = options.color ?? "indigo";

  return normalizeHabitConfig({
    id: `habit_${toTemplateKey(name).replace(/[^a-z0-9_]/g, "")}_${Date.now()}`,
    name,
    kind,
    unit,
    quickIncrement,
    ...(options.dailyTarget !== undefined && {
      dailyTarget: options.dailyTarget,
    }),
    ...(options.dailyCap !== undefined && { dailyCap: options.dailyCap }),
    ...(options.weeklyFrequencyTarget !== undefined && {
      weeklyFrequencyTarget: options.weeklyFrequencyTarget,
    }),
    showOnTrack: true,
    color,
    createdAt: Date.now(),
    habitType,
    ...(options.logAs !== undefined && { logAs: options.logAs }),
    ...(options.templateKey !== undefined && {
      templateKey: options.templateKey,
    }),
  });
}
