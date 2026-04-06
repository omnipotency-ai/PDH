import { useCallback, useMemo } from "react";
import { useProfileContext } from "@/contexts/ProfileContext";
import type { SleepGoal } from "@/lib/gamificationDefaults";
import type { HabitConfig, HabitConfigPatch } from "@/lib/habitTemplates";
import type { UnitSystem } from "@/lib/units";
import type {
  AiPreferences,
  FluidPreset,
  FoodPersonalisation,
  HealthProfile,
  NutritionGoals,
  TransitCalibration,
} from "@/types/domain";

// ---------------------------------------------------------------------------
// useUnitSystem
// ---------------------------------------------------------------------------

export function useUnitSystem() {
  const { profile, patchProfile } = useProfileContext();

  const setUnitSystem = useCallback(
    (unitSystem: UnitSystem) => patchProfile({ unitSystem }),
    [patchProfile],
  );

  return { unitSystem: profile.unitSystem, setUnitSystem };
}

// ---------------------------------------------------------------------------
// useHabits
// ---------------------------------------------------------------------------

export function useHabits() {
  const { profile, patchProfile } = useProfileContext();

  const setHabits = useCallback(
    (habits: HabitConfig[]) => patchProfile({ habits }),
    [patchProfile],
  );

  const addHabit = useCallback(
    (habit: HabitConfig) => patchProfile({ habits: [...profile.habits, habit] }),
    [patchProfile, profile.habits],
  );

  const removeHabit = useCallback(
    (habitId: string) => patchProfile({ habits: profile.habits.filter((h) => h.id !== habitId) }),
    [patchProfile, profile.habits],
  );

  const updateHabit = useCallback(
    (habitId: string, updates: HabitConfigPatch) =>
      patchProfile({
        habits: profile.habits.map((h) =>
          h.id === habitId ? ({ ...h, ...updates } as HabitConfig) : h,
        ),
      }),
    [patchProfile, profile.habits],
  );

  return useMemo(
    () => ({
      habits: profile.habits,
      setHabits,
      addHabit,
      removeHabit,
      updateHabit,
    }),
    [profile.habits, setHabits, addHabit, removeHabit, updateHabit],
  );
}

// ---------------------------------------------------------------------------
// useHealthProfile
// ---------------------------------------------------------------------------

export function useHealthProfile() {
  const { profile, isLoading, patchProfile } = useProfileContext();

  const setHealthProfile = useCallback(
    (updates: Partial<HealthProfile>) => {
      const merged = {
        ...profile.healthProfile,
        ...updates,
      };
      return patchProfile({ healthProfile: merged });
    },
    [patchProfile, profile.healthProfile],
  );

  return useMemo(
    () => ({
      healthProfile: profile.healthProfile,
      isLoading,
      setHealthProfile,
    }),
    [profile.healthProfile, isLoading, setHealthProfile],
  );
}

// ---------------------------------------------------------------------------
// useFluidPresets
// ---------------------------------------------------------------------------

export function useFluidPresets() {
  const { profile, patchProfile } = useProfileContext();

  const setFluidPresets = useCallback(
    (fluidPresets: FluidPreset[]) => patchProfile({ fluidPresets }),
    [patchProfile],
  );

  return useMemo(
    () => ({ fluidPresets: profile.fluidPresets ?? [], setFluidPresets }),
    [profile.fluidPresets, setFluidPresets],
  );
}

// ---------------------------------------------------------------------------
// useSleepGoal
// ---------------------------------------------------------------------------

export function useSleepGoal() {
  const { profile, patchProfile } = useProfileContext();

  const setSleepGoal = useCallback(
    (updates: Partial<SleepGoal>) => {
      const merged: SleepGoal = { ...profile.sleepGoal, ...updates };
      return patchProfile({ sleepGoal: merged });
    },
    [patchProfile, profile.sleepGoal],
  );

  return { sleepGoal: profile.sleepGoal, setSleepGoal };
}

// ---------------------------------------------------------------------------
// useAiPreferences
// ---------------------------------------------------------------------------

export function useAiPreferences() {
  const { profile, patchProfile } = useProfileContext();

  const setAiPreferences = useCallback(
    (updates: Partial<AiPreferences>) =>
      patchProfile({ aiPreferences: { ...profile.aiPreferences, ...updates } }),
    [patchProfile, profile.aiPreferences],
  );

  return { aiPreferences: profile.aiPreferences, setAiPreferences };
}

// ---------------------------------------------------------------------------
// useFoodPersonalisation
// ---------------------------------------------------------------------------

export function useFoodPersonalisation() {
  const { profile, patchProfile } = useProfileContext();

  const setFoodPersonalisation = useCallback(
    (updates: Partial<FoodPersonalisation>) =>
      patchProfile({
        foodPersonalisation: { ...profile.foodPersonalisation, ...updates },
      }),
    [patchProfile, profile.foodPersonalisation],
  );

  return useMemo(
    () => ({
      foodPersonalisation: profile.foodPersonalisation,
      setFoodPersonalisation,
    }),
    [profile.foodPersonalisation, setFoodPersonalisation],
  );
}

// ---------------------------------------------------------------------------
// useTransitCalibration
// ---------------------------------------------------------------------------

export function useTransitCalibration() {
  const { profile, patchProfile } = useProfileContext();

  const setTransitCalibration = useCallback(
    (transitCalibration: TransitCalibration) => patchProfile({ transitCalibration }),
    [patchProfile],
  );

  return useMemo(
    () => ({
      transitCalibration: profile.transitCalibration,
      setTransitCalibration,
    }),
    [profile.transitCalibration, setTransitCalibration],
  );
}

// ---------------------------------------------------------------------------
// useNutritionGoals
// ---------------------------------------------------------------------------

export function useNutritionGoals(): {
  dailyCalorieGoal: number;
  dailyWaterGoalMl: number;
  setNutritionGoals: (updates: Partial<NutritionGoals>) => void;
} {
  const { profile, patchProfile } = useProfileContext();

  const setNutritionGoals = useCallback(
    (updates: Partial<NutritionGoals>) =>
      patchProfile({
        nutritionGoals: { ...profile.nutritionGoals, ...updates },
      }),
    [patchProfile, profile.nutritionGoals],
  );

  return {
    ...profile.nutritionGoals,
    setNutritionGoals,
  };
}

// ---------------------------------------------------------------------------
// useFoodFavourites
// ---------------------------------------------------------------------------

export function useFoodFavourites() {
  const { profile, patchProfile } = useProfileContext();
  const favourites = profile.foodFavourites;

  const addFavourite = useCallback(
    (canonical: string) => {
      if (!favourites.includes(canonical)) {
        patchProfile({ foodFavourites: [...favourites, canonical] });
      }
    },
    [patchProfile, favourites],
  );

  const removeFavourite = useCallback(
    (canonical: string) => {
      patchProfile({
        foodFavourites: favourites.filter((f) => f !== canonical),
      });
    },
    [patchProfile, favourites],
  );

  const isFavourite = useCallback(
    (canonical: string) => favourites.includes(canonical),
    [favourites],
  );

  const toggleFavourite = useCallback(
    (canonical: string) => {
      if (favourites.includes(canonical)) {
        patchProfile({
          foodFavourites: favourites.filter((f) => f !== canonical),
        });
      } else {
        patchProfile({ foodFavourites: [...favourites, canonical] });
      }
    },
    [patchProfile, favourites],
  );

  return useMemo(
    () => ({
      favourites,
      addFavourite,
      removeFavourite,
      isFavourite,
      toggleFavourite,
    }),
    [favourites, addFavourite, removeFavourite, isFavourite, toggleFavourite],
  );
}
