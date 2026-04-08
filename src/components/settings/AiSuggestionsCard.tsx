import { useAction } from "convex/react";
import { ArrowRight, Check, Lightbulb, Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAiConfig } from "@/hooks/useAiConfig";
import { useHabits } from "@/hooks/useProfile";
import { formatLocalDateKey } from "@/lib/dateUtils";
import { getErrorMessage } from "@/lib/errors";
import { computeDaySummaries, computeStreakSummary } from "@/lib/habitAggregates";
import type { HabitSuggestion } from "@/lib/habitCoaching";
import { generateSettingsSuggestions, heuristicSuggestions } from "@/lib/habitCoaching";
import { isCapHabit, isTargetHabit } from "@/lib/habitTemplates";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { api } from "../../../convex/_generated/api";

type AiSuggestionsCardVariant = "panel" | "inline";

interface AiSuggestionsCardProps {
  variant?: AiSuggestionsCardVariant;
  className?: string;
  defaultOpen?: boolean;
}

export function AiSuggestionsCard({
  variant = "panel",
  className,
  defaultOpen = false,
}: AiSuggestionsCardProps = {}) {
  const callAi = useAction(api.ai.chatCompletion);
  const { habits, updateHabit } = useHabits();
  const habitLogs = useStore((s) => s.habitLogs);
  const { isAiConfigured } = useAiConfig();

  const [suggestions, setSuggestions] = useState<HabitSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);

  async function handleGetSuggestions() {
    // Guard against double-click and clear stale error atomically.
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const activeHabits = habits;
      const today = new Date();
      const dateRange = {
        start: formatLocalDateKey(new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000)),
        end: formatLocalDateKey(today),
      };
      const daySummaries = computeDaySummaries(habitLogs, activeHabits, dateRange);

      const streakSummaries: Record<string, ReturnType<typeof computeStreakSummary>> = {};
      for (const h of activeHabits) {
        streakSummaries[h.id] = computeStreakSummary(daySummaries, h.id, 7);
      }

      let result: HabitSuggestion[];

      if (isAiConfigured) {
        result = await generateSettingsSuggestions(callAi, {
          habits: activeHabits,
          streakSummaries,
          recentDaySummaries: daySummaries,
        });
      } else {
        result = heuristicSuggestions(activeHabits, daySummaries);
      }

      if (result.length === 0) {
        toast.info("No suggestions right now. Your targets look well-tuned.");
      }

      setSuggestions(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to generate suggestions"));
      console.error("AI suggestions error:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleApply(suggestion: HabitSuggestion) {
    const habit = habits.find((h) => h.id === suggestion.habitId);
    if (!habit) return;

    if (isTargetHabit(habit)) {
      void updateHabit(habit.id, { dailyTarget: suggestion.newValue });
    } else if (isCapHabit(habit)) {
      void updateHabit(habit.id, { dailyCap: suggestion.newValue });
    }

    toast.success(`Updated ${habit.name} to ${suggestion.newValue} ${habit.unit}`);
    setSuggestions((prev) => prev.filter((s) => s.habitId !== suggestion.habitId));
  }

  function handleDismiss(habitId: string) {
    setSuggestions((prev) => prev.filter((s) => s.habitId !== habitId));
  }

  function getHabitName(habitId: string): string {
    return habits.find((h) => h.id === habitId)?.name ?? habitId;
  }

  function getCurrentValue(habitId: string): number | null {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return null;
    if (isTargetHabit(habit)) return habit.dailyTarget ?? null;
    if (isCapHabit(habit)) return habit.dailyCap ?? null;
    return null;
  }

  function getHabitUnit(habitId: string): string {
    return habits.find((h) => h.id === habitId)?.unit ?? "";
  }

  const body = (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-muted)]">
        {isAiConfigured
          ? "Get AI-powered target and cap adjustments based on your last 14 days."
          : "Get data-driven target and cap adjustments based on your last 14 days."}
      </p>

      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => void handleGetSuggestions()}
        className="w-full border-[var(--settings-hairline)] bg-[var(--settings-control-bg)] text-[var(--text)] hover:bg-[var(--surface-2)]"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Lightbulb className="h-3.5 w-3.5" />
            Get suggestions
          </>
        )}
      </Button>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((s) => {
            const currentValue = getCurrentValue(s.habitId);
            const unit = getHabitUnit(s.habitId);

            return (
              <div
                key={s.habitId}
                className="rounded-xl border border-[var(--settings-hairline)] bg-[var(--settings-control-bg)] p-3"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[var(--text)]">
                    {getHabitName(s.habitId)}
                  </p>
                  {currentValue !== null && (
                    <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                      <span>
                        {currentValue} {unit}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-semibold text-[var(--section-health)]">
                        {s.newValue} {unit}
                      </span>
                    </div>
                  )}
                </div>

                <p className="mb-2 text-xs leading-relaxed text-[var(--text-muted)]">
                  {s.suggestion}
                </p>

                <div className="flex gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handleApply(s)}
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <Check className="h-3 w-3" />
                    Apply
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => handleDismiss(s.habitId)}
                    className="text-[var(--text-faint)] hover:text-[var(--text-muted)]"
                  >
                    <X className="h-3 w-3" />
                    Dismiss
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (variant === "inline") {
    return (
      <Collapsible open={open} onOpenChange={setOpen} className={className}>
        <div className="bg-[var(--surface-2)]">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--section-tracking-muted)]/40"
            >
              <Sparkles className="h-4 w-4 text-orange-400/80" />
              <span className="text-xs text-[var(--text)]">
                Ask AI for a 14 Day Habit Goals Review
              </span>
              <span className="ml-auto text-xs text-[var(--text-faint)]">
                {open ? "Collapse" : "Expand"}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 border-t border-[var(--section-tracking-border)] px-3 py-3">
              {body}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cn("settings-panel settings-panel-ai", className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-2 transition-colors hover:bg-white/2">
            <CardTitle className="flex items-center gap-2 text-base text-[var(--text)]">
              <Sparkles className="h-4 w-4 text-orange-400/80" />
              14 Day Habit Review
              <span className="ml-auto text-xs font-normal text-[var(--text-faint)]">
                {open ? "Collapse" : "Expand"}
              </span>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">{body}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
