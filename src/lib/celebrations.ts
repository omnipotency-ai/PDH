/**
 * @file celebrations.ts
 *
 * Determines what celebration to show when a user hits a habit goal. Checks for milestone
 * streaks (7-day streak or 5-of-7 good days) and returns a bigger celebration; otherwise
 * picks a deterministic daily message from a rotation of five options. Returns a config
 * with confetti colour, message string, and intensity level.
 *
 * @exports getCelebration — sole export, returns CelebrationConfig for a completed habit
 *
 * @consumers
 *   - src/hooks/useQuickCapture.ts (sole consumer)
 */
import type { HabitStreakSummary } from "./habitAggregates";
import type { HabitConfig } from "./habitTemplates";

interface CelebrationConfig {
  confettiColor?: string;
  message: string;
  intensity: "small" | "medium" | "big";
}

export function getCelebration(
  habit: HabitConfig,
  streakSummary: HabitStreakSummary | null,
): CelebrationConfig {
  const goodDays = streakSummary?.goodDaysInWindow ?? 0;
  const streak = streakSummary?.currentGoodStreak ?? 0;

  // Milestone celebrations (bigger)
  if (streak >= 7 && streak % 7 === 0) {
    return {
      confettiColor: habit.color,
      message: `${streak} days straight hitting your ${habit.name} goal!`,
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
