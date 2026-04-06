import { BACKGROUND_MODEL } from "./aiModels";
import { checkRateLimit } from "./aiRateLimiter";
import type { ConvexAiCaller } from "./convexAiClient";
import type { HabitDaySummary, HabitStreakSummary } from "./habitAggregates";
import { formatHabitNumber } from "./habitProgress";
import type { HabitConfig } from "./habitTemplates";
import { isCapHabit, isTargetHabit } from "./habitTemplates";
import { normalizeFluidItemName } from "./normalizeFluidName";

// ─── Shared context type ─────────────────────────────────────────────────────

interface CoachingContext {
  habits: HabitConfig[];
  todayCounts: Record<string, number>;
  todayFluidMl: Record<string, number>;
  streakSummaries: Record<string, HabitStreakSummary>;
}

function getTodayFluidValue(context: CoachingContext, habit: HabitConfig): number {
  const nameKey = normalizeFluidItemName(habit.name);
  return context.todayFluidMl[habit.id] ?? context.todayFluidMl[nameKey] ?? 0;
}

function getTodayHabitValue(context: CoachingContext, habit: HabitConfig): number {
  const countValue = context.todayCounts[habit.id] ?? 0;
  if (habit.logAs !== "fluid") return countValue;
  return isCapHabit(habit) ? countValue : getTodayFluidValue(context, habit);
}

// ─── AI coaching (Tier 1) ────────────────────────────────────────────────────

export async function generateCoachingSnippet(
  callAi: ConvexAiCaller,
  apiKey: string,
  context: CoachingContext & {
    timeOfDay: string; // "morning" | "afternoon" | "evening"
    hadGapYesterday: boolean;
  },
  surgeryType = "digestive condition",
): Promise<string> {
  checkRateLimit();

  const habitSummaries = context.habits
    .map((h) => {
      const value = getTodayHabitValue(context, h);
      const streak = context.streakSummaries[h.id];
      const lines: string[] = [`- ${h.name}: ${value} ${h.unit} today`];
      if (isTargetHabit(h)) {
        lines[0] += ` (target: ${h.dailyTarget})`;
      }
      if (isCapHabit(h)) {
        lines[0] += ` (cap: ${h.dailyCap})`;
      }
      if (streak) {
        lines.push(
          `  Streak: ${streak.currentGoodStreak} days | Good: ${streak.goodDaysInWindow}/${streak.windowSize} days`,
        );
      }
      return lines.join("\n");
    })
    .join("\n");

  const systemPrompt = [
    "Given today's habit totals and recent streak data, respond in 180 characters or fewer",
    "with one piece of practical advice, encouragement, or contextual reward",
    `for a ${surgeryType} recovery patient.`,
    "Rules:",
    "- If user exceeded a target for 7+ days, suggest raising it slightly",
    "- If user consistently misses, suggest lowering it",
    "- If user returned after a gap day, acknowledge the return without judgment",
    "- Include 'X of last Y days' stats when relevant",
    "- Vary your responses — don't repeat the same message pattern",
    "- Reply with ONLY the coaching message text, nothing else",
  ].join("\n");

  const userPrompt = [
    `Time of day: ${context.timeOfDay}`,
    `Returned after gap: ${context.hadGapYesterday ? "yes" : "no"}`,
    "",
    "Habits:",
    habitSummaries,
  ].join("\n");

  const result = await callAi({
    apiKey,
    model: BACKGROUND_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = result.content.trim();
  if (text.length === 0) {
    throw new Error("AI coaching returned an empty response");
  }
  return text;
}

// ─── Heuristic fallback (no API key) ─────────────────────────────────────────

export function getHeuristicCoachingMessage(
  context: CoachingContext & {
    hadGapYesterday: boolean;
  },
): string {
  const activeHabits = context.habits;

  // 1. Return after gap
  if (context.hadGapYesterday) {
    return "Back at it today \u2014 that\u2019s what matters.";
  }

  // Helper: get today's value for a habit
  function todayValue(h: HabitConfig): number {
    return getTodayHabitValue(context, h);
  }

  // Gather target habits and their status
  const targetHabits = activeHabits.filter(isTargetHabit);
  const capHabits = activeHabits.filter(isCapHabit);

  // 2. All targets met
  if (targetHabits.length > 0) {
    const allMet = targetHabits.every((h) => todayValue(h) >= (h.dailyTarget ?? 0));
    if (allMet) {
      return "All targets hit today \u2014 well done.";
    }
  }

  // 3. Target just met (find a habit whose count equals target exactly)
  for (const h of targetHabits) {
    const val = todayValue(h);
    const target = h.dailyTarget ?? 0;
    if (target > 0 && val === target) {
      const streak = context.streakSummaries[h.id];
      if (streak) {
        return `${h.name} target hit! That\u2019s ${streak.goodDaysInWindow} of the last ${streak.windowSize} days \u2014 real progress.`;
      }
      return `${h.name} target hit! Keep it going.`;
    }
  }

  // 4. Under cap acknowledgment
  for (const h of capHabits) {
    const val = todayValue(h);
    const cap = h.dailyCap ?? 0;
    if (cap > 0 && val <= cap && val > 0) {
      const streak = context.streakSummaries[h.id];
      if (streak && streak.goodDaysInWindow >= 3) {
        return `Stayed under your ${h.name} cap ${streak.goodDaysInWindow} of the last ${streak.windowSize} days. Solid.`;
      }
    }
  }

  // 5. Cap warning (at cap exactly)
  for (const h of capHabits) {
    const val = todayValue(h);
    const cap = h.dailyCap ?? 0;
    if (cap > 0 && val === cap) {
      return `You\u2019ve hit your ${h.name} cap \u2014 try to hold steady for the rest of today.`;
    }
  }

  // 6. Over cap
  for (const h of capHabits) {
    const val = todayValue(h);
    const cap = h.dailyCap ?? 0;
    if (cap > 0 && val > cap) {
      const over = val - cap;
      return `${over} over your ${h.name} cap. Tomorrow\u2019s a new day.`;
    }
  }

  // 7. Progress toward target (find a fluid/ml habit with remaining amount)
  for (const h of targetHabits) {
    if (h.unit === "minutes") {
      const val = todayValue(h);
      const target = h.dailyTarget ?? 0;
      if (target > 0 && val > 0 && val < target) {
        const remaining = target - val;
        return `${remaining} minutes to go for your ${h.name.toLowerCase()} target.`;
      }
    }
  }

  // 8. Progress toward target (fluid/ml)
  for (const h of targetHabits) {
    if (h.unit === "ml") {
      const val = todayValue(h);
      const target = h.dailyTarget ?? 0;
      if (target > 0 && val > 0 && val < target) {
        const remaining = target - val;
        return `You\u2019re ${remaining}ml from your ${h.name.toLowerCase()} goal. Keep sipping.`;
      }
    }
  }

  // 9. Consistently exceeding (7+ good days in a row on a target habit)
  for (const h of targetHabits) {
    const streak = context.streakSummaries[h.id];
    if (streak && streak.currentGoodStreak >= 7) {
      return `You\u2019ve been crushing your ${h.name} target \u2014 consider raising it a notch.`;
    }
  }

  // 10. Consistently missing (fewer than 2 good days in window)
  for (const h of targetHabits) {
    const streak = context.streakSummaries[h.id];
    if (streak && streak.windowSize >= 5 && streak.goodDaysInWindow <= 1) {
      return `${h.name} target has been tough to hit. Maybe lower it and build from there?`;
    }
  }

  // 11. Partial success fallback (any habit with some good days)
  for (const h of activeHabits) {
    const streak = context.streakSummaries[h.id];
    if (streak && streak.goodDaysInWindow > 0 && streak.goodDaysInWindow < streak.windowSize) {
      return `${streak.goodDaysInWindow} of ${streak.windowSize} days on track. Progress, not perfection.`;
    }
  }

  // 12. Default
  return "Keep logging \u2014 every data point helps your recovery.";
}

// ─── Per-habit snippet (for detail sheet) ────────────────────────────────────

export async function generateHabitSnippet(
  callAi: ConvexAiCaller,
  apiKey: string,
  context: {
    habit: HabitConfig;
    daySummaries: HabitDaySummary[];
    streakSummary: HabitStreakSummary;
  },
  surgeryType = "digestive condition",
): Promise<string> {
  checkRateLimit();

  const h = context.habit;
  const displayUnit = h.unit;
  const daySummaryLines = context.daySummaries
    .slice(-7)
    .map(
      (s) =>
        `${s.date}: ${formatHabitNumber(s.totalValue)} ${displayUnit}${s.isGoodDay ? " (good)" : ""}`,
    )
    .join("\n");

  const goalLine = isTargetHabit(h)
    ? `Daily target: ${formatHabitNumber(h.dailyTarget ?? 0)} ${displayUnit}`
    : isCapHabit(h)
      ? `Daily cap: ${formatHabitNumber(h.dailyCap ?? 0)} ${displayUnit}`
      : "No target/cap set";

  const streakLine = `Streak: ${context.streakSummary.currentGoodStreak} days | Good: ${context.streakSummary.goodDaysInWindow}/${context.streakSummary.windowSize} days`;

  const systemPrompt = [
    "Given this habit's 7-day history, provide one short, specific insight or suggestion",
    `in 100 characters or fewer for a ${surgeryType} recovery patient.`,
    "Reply with ONLY the insight text, nothing else.",
  ].join("\n");

  const userPrompt = [
    `Habit: ${h.name} (${h.kind}, ${displayUnit})`,
    goalLine,
    streakLine,
    "",
    "Last 7 days:",
    daySummaryLines,
  ].join("\n");

  const result = await callAi({
    apiKey,
    model: BACKGROUND_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = result.content.trim();
  if (text.length === 0) {
    throw new Error("AI habit snippet returned an empty response");
  }
  return text;
}

export function heuristicHabitSnippet(
  habit: HabitConfig,
  daySummaries: HabitDaySummary[],
  streakSummary: HabitStreakSummary,
): string {
  const last7 = [...daySummaries].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const latest = last7[last7.length - 1];
  const latestValue = latest?.totalValue ?? 0;

  if (isTargetHabit(habit) && habit.dailyTarget) {
    if (latestValue >= habit.dailyTarget) {
      return `${habit.name} target hit today. ${streakSummary.goodDaysInWindow}/${streakSummary.windowSize} good days.`;
    }
    const remaining = Math.max(0, habit.dailyTarget - latestValue);
    return `${remaining} ${habit.unit} to reach today’s ${habit.name.toLowerCase()} target.`;
  }

  if (isCapHabit(habit) && habit.dailyCap) {
    if (latestValue > habit.dailyCap) {
      return `${latestValue - habit.dailyCap} ${habit.unit} over cap today. Reset tomorrow, no drama.`;
    }
    if (latestValue === habit.dailyCap) {
      return `${habit.name} is at cap today. Holding here keeps it a good day.`;
    }
    return `${habit.dailyCap - latestValue} ${habit.unit} left before today’s cap.`;
  }

  return `${habit.name}: ${streakSummary.goodDaysInWindow}/${streakSummary.windowSize} good days in the last ${streakSummary.windowSize}.`;
}

// ─── Tier 3: Settings suggestions ────────────────────────────────────────────

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface HabitSuggestion {
  habitId: string;
  suggestion: string;
  newValue: number;
}

function isHabitSuggestion(value: unknown): value is HabitSuggestion {
  if (value === null || typeof value !== "object") return false;
  return (
    "habitId" in value &&
    typeof value.habitId === "string" &&
    "suggestion" in value &&
    typeof value.suggestion === "string" &&
    "newValue" in value &&
    typeof value.newValue === "number"
  );
}

export async function generateSettingsSuggestions(
  callAi: ConvexAiCaller,
  apiKey: string,
  context: {
    habits: HabitConfig[];
    streakSummaries: Record<string, HabitStreakSummary>;
    recentDaySummaries: HabitDaySummary[];
  },
): Promise<HabitSuggestion[]> {
  checkRateLimit();

  const activeHabits = context.habits;
  const habitLines = activeHabits
    .map((h) => {
      const streak = context.streakSummaries[h.id];
      const goalLine = isTargetHabit(h)
        ? `target: ${h.dailyTarget}`
        : isCapHabit(h)
          ? `cap: ${h.dailyCap}`
          : "no target/cap";

      // Gather recent day summaries for this habit
      const daySums = context.recentDaySummaries.filter((s) => s.habitId === h.id);
      const values = daySums.map((s) => s.totalValue);
      const goodDays = daySums.filter((s) => s.isGoodDay).length;

      const avg = values.length > 0 ? average(values) : 0;

      const lines = [
        `- ${h.name} (id: ${h.id}, kind: ${h.kind}, unit: ${h.unit}, ${goalLine})`,
        `  Recent avg: ${avg.toFixed(1)}, good days: ${goodDays}/${daySums.length}`,
      ];
      if (streak) {
        lines.push(
          `  Streak: ${streak.currentGoodStreak}d, ${streak.goodDaysInWindow}/${streak.windowSize} good`,
        );
      }
      return lines.join("\n");
    })
    .join("\n");

  const systemPrompt = [
    "Given 14 days of habit data, suggest up to 3 specific target/cap adjustments.",
    "Only suggest changes with clear evidence from the data.",
    "For each suggestion, return the habitId, a short human-readable explanation,",
    "and the suggested new numeric value for dailyTarget or dailyCap.",
    "",
    "Reply with ONLY a valid JSON array, nothing else. Format:",
    '[{"habitId":"habit_water","suggestion":"You hit your target 12 of 14 days. Try raising it to 1200ml.","newValue":1200}]',
    "",
    "If no changes are warranted, return an empty array: []",
  ].join("\n");

  const userPrompt = ["Habits:", habitLines].join("\n");

  const aiResult = await callAi({
    apiKey,
    model: BACKGROUND_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = aiResult.content.trim() || "[]";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Habit coaching returned invalid response");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AI suggestions did not return an array");
  }

  // Validate and filter to known habit IDs
  const knownIds = new Set(activeHabits.map((h) => h.id));
  const results: HabitSuggestion[] = [];

  for (const item of parsed) {
    if (!isHabitSuggestion(item)) continue;
    if (!knownIds.has(item.habitId)) continue;
    results.push(item);
  }

  return results.slice(0, 3);
}

// ─── Tier 3 heuristic fallback ────────────────────────────────────────────────

export function heuristicSuggestions(
  habits: HabitConfig[],
  summaries: HabitDaySummary[],
): HabitSuggestion[] {
  const activeHabits = habits;
  const results: HabitSuggestion[] = [];

  for (const h of activeHabits) {
    if (results.length >= 3) break;

    const daySums = summaries
      .filter((s) => s.habitId === h.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (daySums.length < 7) continue;

    const last7 = daySums.slice(-7);
    const goodCount = last7.filter((s) => s.isGoodDay).length;
    const values = last7.map((s) => s.totalValue);
    const avg = average(values);

    // Target habits: if hit 7/7 days, suggest raising by ~15%
    if (isTargetHabit(h) && h.dailyTarget !== undefined) {
      if (goodCount === 7) {
        const newTarget = Math.ceil(h.dailyTarget * 1.15);
        if (newTarget > h.dailyTarget) {
          results.push({
            habitId: h.id,
            suggestion: `You hit your ${h.name} target every day this week. Consider raising it from ${h.dailyTarget} to ${newTarget} ${h.unit}.`,
            newValue: newTarget,
          });
        }
      } else if (goodCount <= 2) {
        // Missed 5+/7 days, suggest lowering by ~15%
        const newTarget = Math.max(1, Math.floor(h.dailyTarget * 0.85));
        if (newTarget < h.dailyTarget) {
          results.push({
            habitId: h.id,
            suggestion: `You hit your ${h.name} target only ${goodCount} of 7 days. Try lowering it from ${h.dailyTarget} to ${newTarget} ${h.unit}.`,
            newValue: newTarget,
          });
        }
      }
    }

    // Cap habits: if stayed well under cap every day, suggest lowering
    if (isCapHabit(h) && h.dailyCap !== undefined) {
      const maxValue = Math.max(...values);
      // If user's max was less than 60% of cap, suggest a tighter cap
      if (h.dailyCap > 1 && maxValue < h.dailyCap * 0.6 && maxValue > 0) {
        const newCap = Math.max(1, Math.ceil(avg * 1.3));
        if (newCap < h.dailyCap) {
          results.push({
            habitId: h.id,
            suggestion: `Your ${h.name} stayed well under cap (avg ${avg.toFixed(0)}). Consider tightening the cap from ${h.dailyCap} to ${newCap} ${h.unit}.`,
            newValue: newCap,
          });
        }
      }
    }
  }

  return results.slice(0, 3);
}
