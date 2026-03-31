import { useCallback, useRef } from "react";
import type { HabitStreakSummary } from "@/lib/habitAggregates";
import type { HabitConfig } from "@/lib/habitTemplates";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CelebrationConfig {
  confettiColor?: string;
  message: string;
  intensity: "small" | "medium" | "big";
}

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

// ─── Celebration message logic (inlined from celebrations.ts) ─────────────────

/**
 * Determines what celebration to show when a user hits a habit goal.
 * Checks for milestone streaks (7-day streak or 5-of-7 good days) and returns
 * a bigger celebration; otherwise picks a deterministic daily message from a
 * rotation of five options.
 */
function getCelebration(
  habit: HabitConfig,
  streakSummary: HabitStreakSummary | null,
): CelebrationConfig {
  const goodDays = streakSummary?.goodDaysInWindow ?? 0;
  const streak = streakSummary?.currentGoodStreak ?? 0;

  // Milestone celebrations (bigger)
  if (streak === 7) {
    return {
      confettiColor: habit.color,
      message: `7 days straight hitting your ${habit.name} goal!`,
      intensity: "big",
    };
  }
  if (goodDays === 5 && streakSummary?.windowSize === 7) {
    return {
      confettiColor: habit.color,
      message: `${habit.name}: 5 of last 7 days on target. Keep it up.`,
      intensity: "medium",
    };
  }

  // Daily celebrations (smaller, varied)
  const dailyMessages = [
    `${habit.name} target hit. Nice.`,
    `${habit.name} — another good day.`,
    `That's your ${habit.name} goal done for today.`,
    `${habit.name} locked in.`,
    `${habit.name} target reached — well done.`,
  ];
  const messageHash = habit.name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const messageIndex = messageHash % dailyMessages.length;

  return {
    confettiColor: habit.color,
    message: dailyMessages[messageIndex],
    intensity: "small",
  };
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
