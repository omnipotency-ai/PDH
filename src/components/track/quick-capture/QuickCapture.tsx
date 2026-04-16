import { format } from "date-fns";
import { Clock, Zap } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useHabits, useUnitSystem } from "@/hooks/useProfile";
import type { HabitConfig } from "@/lib/habitTemplates";
import { isMovementHabit, isSleepHabit } from "@/lib/habitTemplates";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import { cn } from "@/lib/utils";
import { DurationEntryPopover } from "./DurationEntryPopover";
import { QuickCaptureTile } from "./QuickCaptureTile";
import { WeightEntryDrawer } from "./WeightEntryDrawer";

// ── Types ──────────────────────────────────────────────────────────────────

interface QuickCaptureProps {
  habits: HabitConfig[];
  todayHabitCounts: Record<string, number>;
  todayFluidMl: Record<string, number>;
  onTap: (habit: HabitConfig) => void;
  onLogSleepHours: (habit: HabitConfig, hours: number) => Promise<void>;
  onLogActivityMinutes: (habit: HabitConfig, minutes: number) => Promise<void>;
  onLogWeightKg: (weightKg: number) => Promise<void>;
  onLongPress: (habit: HabitConfig) => void;
  /** HH:mm time override — empty string means "now" */
  captureTimeOverride: string;
  onCaptureTimeChange: (time: string) => void;
}

// ── QuickCapture ───────────────────────────────────────────────────────────

export function QuickCapture({
  habits,
  todayHabitCounts,
  todayFluidMl,
  onTap,
  onLogSleepHours,
  onLogActivityMinutes,
  onLogWeightKg,
  onLongPress,
  captureTimeOverride,
  onCaptureTimeChange,
}: QuickCaptureProps) {
  const longPressHintSeen = useRef<Set<string>>(new Set());
  const { updateHabit } = useHabits();
  const { unitSystem } = useUnitSystem();

  const visibleHabits = habits.filter((h) => h.showOnTrack);
  const hasTimeOverride = captureTimeOverride !== "";
  const displayTime = hasTimeOverride
    ? captureTimeOverride
    : format(new Date(), "HH:mm");

  const [clockOpen, setClockOpen] = useState(false);

  const hideHabit = (habit: HabitConfig) => {
    updateHabit(habit.id, { showOnTrack: false });
    toast.success(`${habit.name} hidden from Quick Capture`);
  };

  return (
    <section
      data-slot="quick-capture"
      className="glass-card glass-card-quick p-4 space-y-0"
    >
      <SectionHeader
        icon={Zap}
        title="Quick Capture"
        color="var(--section-quick)"
        mutedColor="var(--section-quick-muted)"
      >
        <Popover open={clockOpen} onOpenChange={setClockOpen}>
          <PopoverAnchor asChild>
            <button
              type="button"
              className={cn(
                "ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs tabular-nums transition-colors hover:bg-(--surface-3) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                hasTimeOverride
                  ? "text-(--section-quick) font-semibold"
                  : "text-(--text-faint)",
              )}
              aria-label={
                hasTimeOverride
                  ? `Capture time set to ${displayTime}. Tap to change.`
                  : "Set capture time"
              }
              onClick={() => setClockOpen(true)}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{hasTimeOverride ? displayTime : "Now"}</span>
            </button>
          </PopoverAnchor>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-auto p-2 space-y-2"
          >
            <div className="space-y-1">
              <label
                htmlFor="qc-time-override"
                className="block text-[10px] uppercase tracking-wider font-mono text-(--text-faint)"
              >
                Log time
              </label>
              <input
                id="qc-time-override"
                type="time"
                value={captureTimeOverride || format(new Date(), "HH:mm")}
                onChange={(e) => {
                  onCaptureTimeChange(e.target.value);
                  setClockOpen(false);
                }}
                className="w-full rounded border border-(--color-border-default) bg-(--surface-2) px-1.5 py-1 text-sm tabular-nums text-(--text) focus:outline-none focus:ring-1 focus:ring-ring"
                autoFocus
              />
            </div>
            {hasTimeOverride && (
              <button
                type="button"
                className="w-full rounded px-2 py-1 text-xs text-(--text-muted) transition-colors hover:bg-(--surface-3)"
                onClick={() => {
                  onCaptureTimeChange("");
                  setClockOpen(false);
                }}
              >
                Reset to Now
              </button>
            )}
          </PopoverContent>
        </Popover>
      </SectionHeader>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visibleHabits.map((habit) => {
          if (habit.habitType === "weight") {
            return (
              <WeightEntryDrawer
                key={habit.id}
                habit={habit}
                onLogWeightKg={onLogWeightKg}
                onHide={() => hideHabit(habit)}
              />
            );
          }

          // AB2: Sleep habits use hours-minutes popover
          if (isSleepHabit(habit)) {
            const count = todayHabitCounts[habit.id] ?? 0;
            return (
              <DurationEntryPopover
                key={habit.id}
                habit={habit}
                count={count}
                mode="hours-minutes"
                onSubmit={onLogSleepHours}
                onLongPress={() => onLongPress(habit)}
                onHide={() => hideHabit(habit)}
                popoverTitle={`Log ${habit.name}`}
                popoverDescription="Enter duration, press Enter."
              />
            );
          }

          // AB1: Walking/activity habits use minutes popover
          if (isMovementHabit(habit) && habit.unit === "minutes") {
            const count = todayHabitCounts[habit.id] ?? 0;
            return (
              <DurationEntryPopover
                key={habit.id}
                habit={habit}
                count={count}
                mode="minutes"
                onSubmit={onLogActivityMinutes}
                onLongPress={() => onLongPress(habit)}
                onHide={() => hideHabit(habit)}
                popoverTitle={`Log ${habit.name}`}
                popoverDescription="Enter minutes, press Enter."
              />
            );
          }

          const normalizedFluidName = normalizeFluidItemName(habit.name);
          const count = todayHabitCounts[habit.id] ?? 0;
          const fluidTotalMl =
            habit.logAs === "fluid"
              ? todayFluidMl[normalizedFluidName]
              : undefined;

          return (
            <QuickCaptureTile
              key={habit.id}
              habit={habit}
              count={count}
              {...(fluidTotalMl !== undefined && { fluidTotalMl })}
              unitSystem={unitSystem}
              onTap={() => {
                if (
                  habit.logAs === "fluid" &&
                  !longPressHintSeen.current.has(habit.id)
                ) {
                  longPressHintSeen.current.add(habit.id);
                  toast.message(
                    `Tip: long press ${habit.name} to open settings.`,
                  );
                }
                onTap(habit);
              }}
              onLongPress={() => onLongPress(habit)}
              onHide={() => hideHabit(habit)}
            />
          );
        })}
      </div>
    </section>
  );
}
