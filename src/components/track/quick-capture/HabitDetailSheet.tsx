import { startOfWeek } from "date-fns";
import { EyeOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveShell } from "@/components/ui/responsive-shell";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useHabits, useSleepGoal, useUnitSystem } from "@/hooks/useProfile";
import type { HabitDaySummary, HabitStreakSummary } from "@/lib/habitAggregates";
import { getGoodDayLabel, getNeutralSummaryLabel, hasGoal } from "@/lib/habitAggregates";
import { getHabitIcon } from "@/lib/habitIcons";
import {
  getProgressBarColor,
  getProgressColor,
  getProgressFraction,
  getProgressText,
} from "@/lib/habitProgress";
import {
  type HabitConfig,
  type HabitKind,
  isCheckboxHabit,
  isFluidHabit,
  isMovementHabit,
  isSleepHabit,
} from "@/lib/habitTemplates";
import { getDisplayFluidUnit } from "@/lib/units";
import { useStore } from "@/store";

// --- Day-of-week labels ---

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

// --- Micro-graph day dot ---

type DayStatus = "good" | "missed" | "over-cap" | "logged" | "no-data";

function getDayStatus(
  summary: HabitDaySummary | undefined,
  neutralMode: boolean,
  isDestructive: boolean,
): DayStatus {
  if (!summary) return "no-data";
  if (summary.totalValue === 0) return "no-data";
  if (neutralMode) return "logged";
  if (summary.isGoodDay) return "good";
  // For destructive habits, exceeding cap is worse than missing a target
  return isDestructive ? "over-cap" : "missed";
}

function getDayDotClasses(status: DayStatus): string {
  switch (status) {
    case "good":
      return "bg-emerald-500";
    case "missed":
      return "bg-orange-400";
    case "over-cap":
      return "bg-red-500";
    case "logged":
      return "bg-sky-400";
    case "no-data":
      return "border-2 border-dashed border-[var(--text-muted)]/30 bg-transparent";
  }
}

function getDayDotAriaLabel(label: string, status: DayStatus): string {
  switch (status) {
    case "good":
      return `${label}: goal achieved`;
    case "missed":
      return `${label}: under goal`;
    case "over-cap":
      return `${label}: over cap`;
    case "logged":
      return `${label}: logged`;
    case "no-data":
      return `${label}: no data`;
  }
}

// --- Props ---

export interface HabitDetailSheetProps {
  habit: HabitConfig | null;
  count: number;
  fluidMl?: number;
  daySummaries: HabitDaySummary[];
  streakSummary: HabitStreakSummary | null;
  onClose: () => void;
}

// --- Component ---

export function HabitDetailSheet({
  habit,
  count,
  fluidMl,
  daySummaries,
  streakSummary,
  onClose,
}: HabitDetailSheetProps) {
  if (!habit) return null;

  return (
    <HabitDetailSheetInner
      habit={habit}
      count={count}
      {...(fluidMl !== undefined && { fluidMl })}
      daySummaries={daySummaries}
      streakSummary={streakSummary}
      onClose={onClose}
    />
  );
}

// --- Inner component (only mounts when habit is non-null) ---

interface HabitDetailSheetInnerProps {
  habit: HabitConfig;
  count: number;
  fluidMl?: number;
  daySummaries: HabitDaySummary[];
  streakSummary: HabitStreakSummary | null;
  onClose: () => void;
}

function HabitDetailSheetInner({
  habit,
  count,
  fluidMl,
  daySummaries,
  streakSummary,
  onClose,
}: HabitDetailSheetInnerProps) {
  const { updateHabit } = useHabits();
  const { sleepGoal, setSleepGoal } = useSleepGoal();
  const habitLogs = useStore((s) => s.habitLogs);
  const { unitSystem } = useUnitSystem();

  const fluidHabit = isFluidHabit(habit);
  const sleepHabit = isSleepHabit(habit);
  const movementHabit = isMovementHabit(habit);
  const checkboxHabit = isCheckboxHabit(habit);

  // Settings form state
  const [goalDraft, setGoalDraft] = useState(() => {
    const goalValue =
      habit.kind === "positive" ? (habit.dailyTarget ?? "") : (habit.dailyCap ?? "");
    return String(goalValue);
  });
  const [incrementDraft, setIncrementDraft] = useState(() => String(habit.quickIncrement));
  const [weeklyFrequencyDraft, setWeeklyFrequencyDraft] = useState(() =>
    habit.weeklyFrequencyTarget !== undefined ? String(habit.weeklyFrequencyTarget) : "",
  );

  // Track initial values for change detection on blur/save
  const initialGoalRef = useRef(goalDraft);
  const initialIncrementRef = useRef(incrementDraft);
  const initialWeeklyFrequencyRef = useRef(weeklyFrequencyDraft);

  // Sync form state when habit properties change (e.g. after kind toggle)
  useEffect(() => {
    const nextGoalValue =
      habit.kind === "positive" ? (habit.dailyTarget ?? "") : (habit.dailyCap ?? "");
    const nextGoalDraft = String(nextGoalValue);
    const nextIncrementDraft = String(habit.quickIncrement);
    const nextWeeklyFrequencyDraft =
      habit.weeklyFrequencyTarget !== undefined ? String(habit.weeklyFrequencyTarget) : "";
    setGoalDraft(nextGoalDraft);
    setIncrementDraft(nextIncrementDraft);
    setWeeklyFrequencyDraft(nextWeeklyFrequencyDraft);
    initialGoalRef.current = nextGoalDraft;
    initialIncrementRef.current = nextIncrementDraft;
    initialWeeklyFrequencyRef.current = nextWeeklyFrequencyDraft;
  }, [
    habit.kind,
    habit.dailyTarget,
    habit.dailyCap,
    habit.quickIncrement,
    habit.weeklyFrequencyTarget,
  ]);

  // Handle open state change via the Drawer/Dialog
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );

  // Sort day summaries by date ascending, take last 7, then reverse for display (most recent first)
  const sortedDays = useMemo(
    () => [...daySummaries].sort((a, b) => a.date.localeCompare(b.date)),
    [daySummaries],
  );
  const last7Days = useMemo(() => sortedDays.slice(-7), [sortedDays]);

  // Reversed for display: Today first, then yesterday, etc.
  const displayDays = useMemo(() => [...last7Days].reverse(), [last7Days]);

  // Compute day labels from actual dates (reversed order: most recent first)
  const dayLabels = useMemo(() => {
    if (displayDays.length === 0) return DAY_LABELS;
    const days = ["S", "M", "T", "W", "T", "F", "S"];
    return displayDays.map((s) => {
      const d = new Date(`${s.date}T12:00:00`);
      return days[d.getDay()];
    });
  }, [displayDays]);

  const progressFraction = getProgressFraction(habit, count, fluidMl);
  const progressColor = getProgressColor(habit, count, fluidMl);
  const progressBarColor = getProgressBarColor(progressColor);
  const progressText = getProgressText(habit, count, fluidMl, "detail");
  const { Icon, toneClassName } = getHabitIcon(habit);
  // Stable week-start key so useMemo deps don't churn on every render.
  // Recomputes only when the calendar week changes, logs change, or habit changes.
  const weekStartMs = useMemo(
    () => startOfWeek(new Date(), { weekStartsOn: 1 }).getTime(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally stable per mount; sheet is short-lived
    [],
  );
  const weeklyActivitySessions = useMemo(() => {
    if (!movementHabit) return 0;
    const weekEnd = weekStartMs + 7 * 24 * 60 * 60 * 1000;
    return habitLogs.filter(
      (entry) => entry.habitId === habit.id && entry.at >= weekStartMs && entry.at < weekEnd,
    ).length;
  }, [movementHabit, habitLogs, habit.id, weekStartMs]);

  // Y1: Neutral mode for habits with no target/cap
  const neutralMode = !hasGoal(habit);

  // Settings handlers
  function makeNumberSaveHandler(opts: {
    draft: string;
    initialRef: React.RefObject<string>;
    errorMessage: string;
    onClear?: () => void;
    onSave: (value: number) => void;
    clearLabel: string;
    saveLabel: string;
    round?: boolean;
  }) {
    return () => {
      if (opts.draft === opts.initialRef.current) return;

      if (opts.draft.trim() === "" && opts.onClear) {
        opts.onClear();
        opts.initialRef.current = opts.draft;
        toast.success(opts.clearLabel);
        return;
      }

      const parsed = Number(opts.draft);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error(opts.errorMessage);
        return;
      }

      opts.onSave(opts.round ? Math.round(parsed) : parsed);
      opts.initialRef.current = opts.draft;
      toast.success(opts.saveLabel);
    };
  }

  const handleSaveGoal = makeNumberSaveHandler({
    draft: goalDraft,
    initialRef: initialGoalRef,
    errorMessage: "Please enter a valid positive number",
    onClear: () => {
      if (movementHabit || habit.kind === "positive") {
        updateHabit(habit.id, { dailyTarget: undefined });
      } else {
        updateHabit(habit.id, { dailyCap: undefined });
      }
    },
    onSave: (value) => {
      if (movementHabit || habit.kind === "positive") {
        updateHabit(habit.id, { dailyTarget: value });
      } else {
        updateHabit(habit.id, { dailyCap: value });
      }
    },
    clearLabel: "Goal cleared",
    saveLabel: "Goal updated",
  });

  const handleSaveIncrement = makeNumberSaveHandler({
    draft: incrementDraft,
    initialRef: initialIncrementRef,
    errorMessage: "Please enter a valid positive number",
    onSave: (value) => updateHabit(habit.id, { quickIncrement: value }),
    clearLabel: "",
    saveLabel: "Quick increment updated",
  });

  const handleSaveWeeklyFrequency = makeNumberSaveHandler({
    draft: weeklyFrequencyDraft,
    initialRef: initialWeeklyFrequencyRef,
    errorMessage: "Please enter a valid weekly frequency",
    onClear: () => updateHabit(habit.id, { weeklyFrequencyTarget: undefined }),
    onSave: (value) => updateHabit(habit.id, { weeklyFrequencyTarget: value }),
    clearLabel: "Weekly frequency cleared",
    saveLabel: "Weekly frequency updated",
    round: true,
  });

  const handleKindChange = (nextKind: HabitKind) => {
    if (nextKind === habit.kind) return;
    if (fluidHabit) {
      updateHabit(habit.id, {
        kind: nextKind,
        dailyTarget: undefined,
        dailyCap: undefined,
      });
      setGoalDraft("");
      initialGoalRef.current = "";
      toast.success(
        nextKind === "positive" ? "Switched to daily target mode" : "Switched to cup cap mode",
      );
      return;
    }
    const parsedGoal = Number(goalDraft);
    const validGoal = Number.isFinite(parsedGoal) && parsedGoal > 0 ? parsedGoal : undefined;
    updateHabit(habit.id, {
      kind: nextKind,
      ...(nextKind === "positive"
        ? { dailyTarget: validGoal, dailyCap: undefined }
        : { dailyCap: validGoal, dailyTarget: undefined }),
    });
    toast.success(nextKind === "positive" ? "Switched to target mode" : "Switched to cap mode");
  };

  const handleHideFromQuickCapture = () => {
    updateHabit(habit.id, { showOnTrack: false });
    toast.success(`${habit.name} hidden from Quick Capture`);
    onClose();
  };

  const goalLabel =
    habit.kind === "destructive" ? (fluidHabit ? "Cup cap" : "Daily cap") : "Daily target";

  const detailSections = (
    <>
      {/* ── Section 1: Activity / Data summary ── */}
      <div data-slot="habit-detail-data" className="space-y-4">
        {/* Progress bar */}
        <div data-slot="habit-detail-progress" className="space-y-1.5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
              style={{ width: `${Math.round(progressFraction * 100)}%` }}
            />
          </div>
        </div>

        {/* Micro-graph: 7-day visualization (most recent first) */}
        <div data-slot="habit-detail-micro-graph" className="space-y-1.5">
          <p className="text-sm font-medium text-[var(--text-muted)]">Last 7 days</p>
          <div className="flex items-center justify-between gap-1">
            {dayLabels.map((label, index) => {
              const summary = displayDays[index];
              const status = getDayStatus(summary, neutralMode, habit.kind === "destructive");
              const dotClasses = getDayDotClasses(status);
              return (
                <div
                  key={summary?.date ?? `empty-${index}`}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    role="img"
                    className={`h-6 w-6 rounded-full ${dotClasses}`}
                    aria-label={getDayDotAriaLabel(label, status)}
                  />
                  <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
                </div>
              );
            })}
          </div>
          {/* Dot legend */}
          <div className="flex items-center gap-3 pt-1 text-[10px] text-[var(--text-faint)]">
            {neutralMode ? (
              <>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />
                  Logged
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-[var(--text-muted)]/30" />
                  No data
                </span>
              </>
            ) : habit.kind === "destructive" ? (
              <>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Under cap
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                  Over cap
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-[var(--text-muted)]/30" />
                  No data
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Goal met
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-400" />
                  Under goal
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-[var(--text-muted)]/30" />
                  No data
                </span>
              </>
            )}
          </div>
        </div>

        {/* Summary label: neutral for no-target habits, good days for goal habits */}
        {neutralMode ? (
          <div data-slot="habit-detail-streak" className="text-sm text-[var(--text-muted)]">
            {getNeutralSummaryLabel(daySummaries, habit.id, 7)}
          </div>
        ) : (
          streakSummary !== null && (
            <div data-slot="habit-detail-streak" className="text-sm text-[var(--text-muted)]">
              {habit.kind === "destructive" ? "Under cap" : "Good days"}:{" "}
              {getGoodDayLabel(streakSummary)}
            </div>
          )
        )}
      </div>

      {/* ── Divider between data and settings ── */}
      <hr className="border-[var(--border)]" />

      {/* ── Section 2: Settings ── */}
      <div data-slot="habit-detail-settings" className="space-y-4">
        <p className="text-sm font-semibold text-[var(--text-muted)]">Settings</p>

        {/* Mode toggle (full width, not in grid) */}
        {!sleepHabit && !checkboxHabit && !movementHabit && (
          <div className="space-y-1.5">
            <Label id="habit-detail-kind-label">{fluidHabit ? "Mode" : "Kind"}</Label>
            <ToggleGroup
              type="single"
              value={habit.kind}
              variant="outline"
              aria-labelledby="habit-detail-kind-label"
              className="w-full"
              onValueChange={(value) => {
                if (value === "positive" || value === "destructive") {
                  handleKindChange(value);
                }
              }}
            >
              <ToggleGroupItem
                value="positive"
                className="h-9 basis-0 flex-1 justify-center text-xs sm:text-sm data-[pressed]:border-emerald-500/40 data-[pressed]:bg-emerald-500/10 data-[pressed]:text-emerald-700 dark:data-[pressed]:text-emerald-300"
              >
                {fluidHabit ? "Daily target" : "Positive (target)"}
              </ToggleGroupItem>
              <ToggleGroupItem
                value="destructive"
                className="h-9 basis-0 flex-1 justify-center text-xs sm:text-sm data-[pressed]:border-red-500/40 data-[pressed]:bg-red-500/10 data-[pressed]:text-red-700 dark:data-[pressed]:text-red-300"
              >
                {fluidHabit ? "Cup cap" : "Destructive (cap)"}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        {/* Sleep settings in 2-column grid */}
        {sleepHabit && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="habit-detail-sleep-target">Daily target</Label>
              <div className="flex gap-2">
                <Input
                  id="habit-detail-sleep-target"
                  type="number"
                  min="0"
                  step="0.5"
                  value={sleepGoal.targetHours}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (!Number.isFinite(parsed) || parsed <= 0) return;
                    const bounded = Math.max(1, Math.min(20, parsed));
                    Promise.all([
                      setSleepGoal({ targetHours: bounded }),
                      updateHabit(habit.id, {
                        dailyTarget: bounded,
                        kind: "positive",
                      }),
                    ]).catch((err) => {
                      console.error("[HabitDetailSheet] Failed to update sleep target:", err);
                      toast.error("Failed to update sleep target");
                    });
                  }}
                />
                <span className="flex items-center text-sm text-[var(--text-muted)]">hrs</span>
              </div>
            </div>
            <div className="flex flex-col justify-end">
              <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
                <Label
                  htmlFor="habit-detail-sleep-nudge"
                  className="text-sm text-[var(--text-muted)]"
                >
                  Sleep nudge
                </Label>
                <input
                  id="habit-detail-sleep-nudge"
                  type="checkbox"
                  checked={sleepGoal.nudgeEnabled}
                  onChange={(e) => {
                    setSleepGoal({ nudgeEnabled: e.target.checked }).catch((err: unknown) => {
                      console.error("[HabitDetailSheet] Failed to update sleep nudge:", err);
                      toast.error("Failed to update sleep nudge");
                    });
                  }}
                  className="h-4 w-4 accent-[var(--section-quick)]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="habit-detail-sleep-nudge-time">Nudge time</Label>
              <Input
                id="habit-detail-sleep-nudge-time"
                type="time"
                value={sleepGoal.nudgeTime}
                disabled={!sleepGoal.nudgeEnabled}
                onChange={(e) => {
                  setSleepGoal({ nudgeTime: e.target.value }).catch((err: unknown) => {
                    console.error("[HabitDetailSheet] Failed to update nudge time:", err);
                    toast.error("Failed to update nudge time");
                  });
                }}
              />
            </div>
            {/* Empty cell keeps alignment */}
            <div />
          </div>
        )}

        {/* Non-sleep, non-checkbox settings in 2-column grid */}
        {!sleepHabit && !checkboxHabit && (
          <div className="grid grid-cols-2 gap-3">
            {/* Goal/cap value input */}
            <div className="space-y-1.5">
              <Label htmlFor="habit-detail-goal">{goalLabel}</Label>
              <div className="flex gap-2">
                <Input
                  id="habit-detail-goal"
                  type="number"
                  min="0"
                  placeholder="Optional"
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  onBlur={handleSaveGoal}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveGoal();
                  }}
                />
                <span className="flex items-center text-sm text-[var(--text-muted)]">
                  {fluidHabit
                    ? habit.kind === "destructive"
                      ? "cups"
                      : getDisplayFluidUnit(unitSystem)
                    : habit.unit}
                </span>
              </div>
              {fluidHabit && (
                <p className="text-xs text-[var(--text-faint)]">
                  Daily target tracks total {getDisplayFluidUnit(unitSystem)}. Cup cap tracks taps.
                </p>
              )}
            </div>

            {/* Quick increment input — not shown for movement habits (entry drawer has presets) */}
            {!movementHabit && (
              <div className="space-y-1.5">
                <Label htmlFor="habit-detail-increment">
                  {habit.logAs === "fluid" ? "Quick qty" : "Quick incr."}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="habit-detail-increment"
                    type="number"
                    min="1"
                    value={incrementDraft}
                    onChange={(e) => setIncrementDraft(e.target.value)}
                    onBlur={handleSaveIncrement}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveIncrement();
                    }}
                  />
                  <span className="flex items-center text-sm text-[var(--text-muted)]">
                    {habit.logAs === "fluid" ? getDisplayFluidUnit(unitSystem) : habit.unit}
                  </span>
                </div>
              </div>
            )}

            {/* Weekly frequency for movement habits */}
            {movementHabit && (
              <div className="space-y-1.5">
                <Label htmlFor="habit-detail-weekly-frequency">Weekly target</Label>
                <div className="flex gap-2">
                  <Input
                    id="habit-detail-weekly-frequency"
                    type="number"
                    min="1"
                    max="14"
                    placeholder="Optional"
                    value={weeklyFrequencyDraft}
                    onChange={(e) => setWeeklyFrequencyDraft(e.target.value)}
                    onBlur={handleSaveWeeklyFrequency}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveWeeklyFrequency();
                    }}
                  />
                  <span className="flex items-center text-sm text-[var(--text-muted)]">/wk</span>
                </div>
                {habit.weeklyFrequencyTarget !== undefined && (
                  <p className="text-xs text-[var(--text-faint)]">
                    This week: {weeklyActivitySessions} / {habit.weeklyFrequencyTarget}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Checkbox habits are fixed single-tap */}
        {checkboxHabit && (
          <p className="text-xs text-[var(--text-faint)]">
            This is a checkbox habit. One tap marks done and the next tap marks undone.
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div data-slot="habit-detail-actions" className="space-y-2 pt-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleHideFromQuickCapture}
        >
          <EyeOff className="h-4 w-4" />
          Hide from Quick Capture
        </Button>
      </div>
    </>
  );

  const titleContent = (
    <span className="flex items-center gap-2">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-3)]"
        aria-hidden="true"
      >
        <Icon className={`h-4 w-4 ${toneClassName}`} />
      </span>
      {habit.name}
    </span>
  );

  return (
    <ResponsiveShell
      open={true}
      onOpenChange={handleOpenChange}
      title={titleContent}
      description={progressText}
      bodyClassName="space-y-4 px-4 pb-6"
      sheetContentClassName="max-w-[450px]"
    >
      {detailSections}
    </ResponsiveShell>
  );
}
