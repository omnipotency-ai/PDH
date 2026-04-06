import { useMutation, useQuery } from "convex/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import { DEFAULT_HEALTH_PROFILE } from "@/lib/defaults";
import type { SleepGoal } from "@/lib/gamificationDefaults";
import { DEFAULT_SLEEP_GOAL } from "@/lib/gamificationDefaults";
import type { HabitConfig } from "@/lib/habitTemplates";
import { getDefaultHabitTemplates } from "@/lib/habitTemplates";
import type { UnitSystem } from "@/lib/units";
import type {
  AiPreferences,
  FluidPreset,
  FoodPersonalisation,
  HealthProfile,
  NutritionGoals,
  TransitCalibration,
} from "@/types/domain";
import {
  DEFAULT_AI_PREFERENCES,
  DEFAULT_FOOD_PERSONALISATION,
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
  foodPersonalisation: FoodPersonalisation;
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
  foodPersonalisation: { ...DEFAULT_FOOD_PERSONALISATION },
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
  foodPersonalisation?: FoodPersonalisation;
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
    habits: (raw.habits ?? DEFAULT_PROFILE.habits) as HabitConfig[],
    fluidPresets: (raw.fluidPresets ??
      DEFAULT_PROFILE.fluidPresets) as FluidPreset[],
    sleepGoal: raw.sleepGoal ?? DEFAULT_PROFILE.sleepGoal,
    healthProfile: hp ?? DEFAULT_PROFILE.healthProfile,
    aiPreferences: (raw.aiPreferences ??
      DEFAULT_PROFILE.aiPreferences) as AiPreferences,
    foodPersonalisation:
      raw.foodPersonalisation ?? DEFAULT_PROFILE.foodPersonalisation,
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
  const nextProfile = useMemo(() => resolveProfile(raw), [raw]);
  const prevProfileRef = useRef<ResolvedProfile>(DEFAULT_PROFILE);

  const profile: ResolvedProfile = useMemo(() => {
    const prev = prevProfileRef.current;
    const next = nextProfile;
    const changed =
      prev.unitSystem !== next.unitSystem ||
      JSON.stringify(prev.habits) !== JSON.stringify(next.habits) ||
      JSON.stringify(prev.fluidPresets) !== JSON.stringify(next.fluidPresets) ||
      JSON.stringify(prev.sleepGoal) !== JSON.stringify(next.sleepGoal) ||
      JSON.stringify(prev.healthProfile) !==
        JSON.stringify(next.healthProfile) ||
      JSON.stringify(prev.aiPreferences) !==
        JSON.stringify(next.aiPreferences) ||
      JSON.stringify(prev.foodPersonalisation) !==
        JSON.stringify(next.foodPersonalisation) ||
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
  }, [nextProfile]);

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

  const value: ProfileContextValue = useMemo(
    () => ({ profile, isLoading, patchProfile }),
    [profile, isLoading, patchProfile],
  );

  return <ProfileContext value={value}>{children}</ProfileContext>;
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
