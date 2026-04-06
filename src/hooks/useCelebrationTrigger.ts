import { useCallback, useRef } from "react";
import { getCelebration } from "@/lib/celebrations";
import type { HabitStreakSummary } from "@/lib/habitAggregates";
import type { HabitConfig } from "@/lib/habitTemplates";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseCelebrationTriggerOptions {
  streakSummaries: Record<string, HabitStreakSummary>;
  celebrateGoalComplete: (message: string) => void;
}

interface CelebrationTriggerResult {
  /**
   * Checks if a target goal was just met and triggers celebration if so.
   * Only fires when crossing the threshold (not when already past it).
   */
  checkAndCelebrateGoal: (habit: HabitConfig, previousValue: number, nextValue: number) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Provides a stable `checkAndCelebrateGoal` callback that determines whether
 * a habit goal threshold was just crossed and triggers the appropriate celebration.
 * Extracted from useQuickCapture to isolate celebration decision logic.
 */
export function useCelebrationTrigger({
  streakSummaries,
  celebrateGoalComplete,
}: UseCelebrationTriggerOptions): CelebrationTriggerResult {
  // Snapshot refs so the callback doesn't churn on every render
  const streakSummariesRef = useRef(streakSummaries);
  streakSummariesRef.current = streakSummaries;

  const celebrateRef = useRef(celebrateGoalComplete);
  celebrateRef.current = celebrateGoalComplete;

  const checkAndCelebrateGoal = useCallback(
    (habit: HabitConfig, previousValue: number, nextValue: number): void => {
      if (habit.kind !== "positive") return;
      if (habit.dailyTarget === undefined || habit.dailyTarget <= 0) return;

      // Only celebrate when crossing the threshold (not already past it)
      if (previousValue < habit.dailyTarget && nextValue >= habit.dailyTarget) {
        const celebrationConfig = getCelebration(
          habit,
          streakSummariesRef.current[habit.id] ?? null,
        );
        celebrateRef.current(celebrationConfig.message);
      }
    },
    [],
  );

  return { checkAndCelebrateGoal };
}
