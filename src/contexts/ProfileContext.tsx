import { useMutation, useQuery } from "convex/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { DEFAULT_HEALTH_PROFILE } from "@/lib/defaults";
import type { SleepGoal } from "@/lib/gamificationDefaults";
import { DEFAULT_SLEEP_GOAL } from "@/lib/gamificationDefaults";
import type { HabitConfig } from "@/lib/habitTemplates";
import {
  getDefaultHabitTemplates,
  HABIT_TEMPLATES,
} from "@/lib/habitTemplates";
import type { UnitSystem } from "@/lib/units";
import type {
  AiPreferences,
  FluidPreset,
  FoodPreferences,
  HealthProfile,
  NutritionGoals,
  TransitCalibration,
} from "@/types/domain";
import {
  DEFAULT_AI_PREFERENCES,
  DEFAULT_FOOD_PREFERENCES,
  DEFAULT_NUTRITION_GOALS,
  DEFAULT_TRANSIT_CALIBRATION,
} from "@/types/domain";
import { api } from "../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Default profile values — must match what ensureDefaults() produces in store.ts
// ---------------------------------------------------------------------------

/** All fields are required here — used as fallbacks when server data is missing. */
interface ResolvedProfile {
  unitSystem: UnitSystem;
  habits: HabitConfig[];
  fluidPresets: FluidPreset[];
  sleepGoal: SleepGoal;
  healthProfile: HealthProfile;
  aiPreferences: AiPreferences;
  foodPreferences: FoodPreferences;
  transitCalibration: TransitCalibration;
  nutritionGoals: NutritionGoals;
  foodFavourites: string[];
}

export const DEFAULT_PROFILE: ResolvedProfile = {
  unitSystem: "metric",
  habits: getDefaultHabitTemplates(),
  fluidPresets: [],
  sleepGoal: { ...DEFAULT_SLEEP_GOAL },
  healthProfile: { ...DEFAULT_HEALTH_PROFILE },
  aiPreferences: { ...DEFAULT_AI_PREFERENCES },
  foodPreferences: { ...DEFAULT_FOOD_PREFERENCES },
  transitCalibration: { ...DEFAULT_TRANSIT_CALIBRATION },
  nutritionGoals: { ...DEFAULT_NUTRITION_GOALS },
  foodFavourites: [],
};

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

/** The shape a patching call accepts — all fields optional. */
export type PatchProfileArgs = {
  unitSystem?: UnitSystem;
  habits?: HabitConfig[];
  fluidPresets?: FluidPreset[];
  sleepGoal?: SleepGoal;
  healthProfile?: HealthProfile;
  aiPreferences?: AiPreferences;
  foodPreferences?: FoodPreferences;
  transitCalibration?: TransitCalibration;
  nutritionGoals?: NutritionGoals;
  foodFavourites?: string[];
};

interface ProfileContextValue {
  /** Merged profile (server data + defaults). Never undefined after load. */
  profile: ResolvedProfile;
  /** True while the initial query is still loading. */
  isLoading: boolean;
  /** Granular patch — only sends the fields you pass. */
  patchProfile: (updates: PatchProfileArgs) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const RETIRED_HABIT_IDS = new Set([
  "habit_electrolyte",
  "habit_stretching",
  "habit_wound_dressing_checkbox",
  "habit_wound_dressing_count",
]);

const RETIRED_HABIT_TEMPLATE_KEYS = new Set([
  "electrolyte",
  "stretching",
  "wound_dressing_checkbox",
  "wound_dressing_count",
]);

function filterRetiredHabits(habits: HabitConfig[]): HabitConfig[] {
  return habits.filter((habit) => {
    const normalizedName = habit.name.trim().toLowerCase();
    return !(
      RETIRED_HABIT_IDS.has(habit.id) ||
      (habit.templateKey !== undefined &&
        RETIRED_HABIT_TEMPLATE_KEYS.has(habit.templateKey)) ||
      normalizedName === "bebida" ||
      normalizedName === "electrolyte drink" ||
      normalizedName === "stretching" ||
      normalizedName === "change dressing" ||
      normalizedName === "dressing changes"
    );
  });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Build a ResolvedProfile from raw Convex data, falling back to defaults.
 * Extracted as a pure function so it can be called from useMemo without
 * needing a closure over component state.
 */
function resolveProfile(
  raw: ReturnType<typeof useQuery<typeof api.logs.getProfile>>,
): ResolvedProfile {
  if (raw === null || raw === undefined) return DEFAULT_PROFILE;
  const hp = raw.healthProfile as HealthProfile | undefined;
  return {
    unitSystem: raw.unitSystem ?? DEFAULT_PROFILE.unitSystem,
    habits: filterRetiredHabits(
      (raw.habits ?? DEFAULT_PROFILE.habits) as HabitConfig[],
    ),
    fluidPresets: (raw.fluidPresets ??
      DEFAULT_PROFILE.fluidPresets) as FluidPreset[],
    sleepGoal: { ...DEFAULT_PROFILE.sleepGoal, ...(raw.sleepGoal ?? {}) },
    healthProfile: { ...DEFAULT_PROFILE.healthProfile, ...(hp ?? {}) },
    aiPreferences: {
      ...DEFAULT_PROFILE.aiPreferences,
      ...((raw.aiPreferences ?? {}) as Partial<AiPreferences>),
    } as AiPreferences,
    foodPreferences: raw.foodPreferences ?? DEFAULT_PROFILE.foodPreferences,
    transitCalibration:
      raw.transitCalibration ?? DEFAULT_PROFILE.transitCalibration,
    nutritionGoals:
      (raw.nutritionGoals as NutritionGoals | undefined) ??
      DEFAULT_PROFILE.nutritionGoals,
    foodFavourites:
      (raw.foodFavourites as string[] | undefined) ??
      DEFAULT_PROFILE.foodFavourites,
  };
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const raw = useQuery(api.logs.getProfile);
  const patchMutation = useMutation(api.logs.patchProfile);

  const isLoading = raw === undefined;

  // ---------------------------------------------------------------------------
  // Stabilize the profile reference using structural comparison.
  //
  // Problem: Convex's useQuery returns a new object reference on every
  // re-delivery, even when the underlying data hasn't changed. Since
  // `useMemo(() => ..., [raw])` uses reference equality, this causes a new
  // profile object on every delivery, which in turn triggers re-renders in
  // ALL context consumers — even those that only care about one field.
  //
  // Fix: Compare the resolved profile against the previous one using a
  // shallow field-by-field check over the known top-level keys. For scalar
  // fields (unitSystem) we use strict equality. For object/array fields we
  // compare via JSON.stringify per-field, which is cheaper than serializing
  // the whole profile on every render.
  // ---------------------------------------------------------------------------
  const prevProfileRef = useRef<ResolvedProfile>(DEFAULT_PROFILE);

  const profile: ResolvedProfile = useMemo(() => {
    const next = resolveProfile(raw);
    const prev = prevProfileRef.current;
    const changed =
      prev.unitSystem !== next.unitSystem ||
      JSON.stringify(prev.habits) !== JSON.stringify(next.habits) ||
      JSON.stringify(prev.fluidPresets) !== JSON.stringify(next.fluidPresets) ||
      JSON.stringify(prev.sleepGoal) !== JSON.stringify(next.sleepGoal) ||
      JSON.stringify(prev.healthProfile) !==
        JSON.stringify(next.healthProfile) ||
      JSON.stringify(prev.aiPreferences) !==
        JSON.stringify(next.aiPreferences) ||
      JSON.stringify(prev.foodPreferences) !==
        JSON.stringify(next.foodPreferences) ||
      JSON.stringify(prev.transitCalibration) !==
        JSON.stringify(next.transitCalibration) ||
      JSON.stringify(prev.nutritionGoals) !==
        JSON.stringify(next.nutritionGoals) ||
      JSON.stringify(prev.foodFavourites) !==
        JSON.stringify(next.foodFavourites);
    if (!changed) {
      return prev;
    }
    prevProfileRef.current = next;
    return next;
  }, [raw]);

  const patchProfile = useCallback(
    async (updates: PatchProfileArgs) => {
      // Filter out undefined values so only defined fields are sent to Convex.
      // PatchProfileArgs keys are a strict subset of patchProfile mutation args,
      // so the cast to PatchProfileArgs is safe.
      const definedUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined),
      ) as PatchProfileArgs;
      await patchMutation({ now: Date.now(), ...definedUpdates });
    },
    [patchMutation],
  );

  // One-shot seeding of new code-defined templates into existing profiles.
  // Tracks seeded keys in localStorage so a hidden/deleted habit stays gone.
  useSeedNewTemplates(raw, profile.habits, patchProfile);

  const value: ProfileContextValue = useMemo(
    () => ({ profile, isLoading, patchProfile }),
    [profile, isLoading, patchProfile],
  );

  return <ProfileContext value={value}>{children}</ProfileContext>;
}

// ---------------------------------------------------------------------------
// One-shot template seeding for existing users
// ---------------------------------------------------------------------------

const SEEDED_TEMPLATE_KEYS_STORAGE = "pdh.seededTemplateKeys";

// Template keys that existing users should receive automatically on next load.
// Add a key here when a new template should auto-appear for users whose
// profile was created before the template existed.
const AUTO_SEED_TEMPLATE_KEYS = ["halibut"] as const;

function readSeededKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEDED_TEMPLATE_KEYS_STORAGE);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function writeSeededKeys(keys: Set<string>): void {
  try {
    localStorage.setItem(
      SEEDED_TEMPLATE_KEYS_STORAGE,
      JSON.stringify([...keys]),
    );
  } catch {
    // localStorage may be unavailable (private mode, SSR). Failing silently
    // means we might re-seed on next load, which is acceptable.
  }
}

function useSeedNewTemplates(
  raw: ReturnType<typeof useQuery<typeof api.logs.getProfile>>,
  habits: HabitConfig[],
  patchProfile: (updates: PatchProfileArgs) => Promise<void>,
): void {
  const hasSeededRef = useRef(false);

  useEffect(() => {
    if (hasSeededRef.current) return;
    if (raw === undefined || raw === null) return;

    const seeded = readSeededKeys();
    const existingTemplateKeys = new Set(
      habits
        .map((h) => h.templateKey)
        .filter((k): k is string => typeof k === "string"),
    );

    const toAdd: HabitConfig[] = [];
    for (const key of AUTO_SEED_TEMPLATE_KEYS) {
      if (seeded.has(key)) continue;
      if (existingTemplateKeys.has(key)) {
        seeded.add(key);
        continue;
      }
      const template = HABIT_TEMPLATES[key];
      if (template) toAdd.push({ ...template, createdAt: Date.now() });
      seeded.add(key);
    }

    if (toAdd.length > 0) {
      void patchProfile({ habits: [...habits, ...toAdd] });
    }
    writeSeededKeys(seeded);
    hasSeededRef.current = true;
  }, [raw, habits, patchProfile]);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (ctx === null) {
    throw new Error("useProfileContext must be used within ProfileProvider");
  }
  return ctx;
}
