import { Zap } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useHabits, useUnitSystem } from "@/hooks/useProfile";
import type { HabitConfig } from "@/lib/habitTemplates";
import { isMovementHabit, isSleepHabit } from "@/lib/habitTemplates";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import { AddHabitDrawer } from "./AddHabitDrawer";
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
}: QuickCaptureProps) {
  const longPressHintSeen = useRef<Set<string>>(new Set());
  const { updateHabit } = useHabits();
  const { unitSystem } = useUnitSystem();

  const visibleHabits = habits.filter((h) => h.showOnTrack);

  const hideHabit = (habit: HabitConfig) => {
    updateHabit(habit.id, { showOnTrack: false });
    toast.success(`${habit.name} hidden from Quick Capture`);
  };

  return (
    <section data-slot="quick-capture" className="glass-card glass-card-quick p-4 space-y-0">
      <SectionHeader
        icon={Zap}
        title="Quick Capture"
        color="var(--section-quick)"
        mutedColor="var(--section-quick-muted)"
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
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
            habit.logAs === "fluid" ? todayFluidMl[normalizedFluidName] : undefined;

          return (
            <QuickCaptureTile
              key={habit.id}
              habit={habit}
              count={count}
              {...(fluidTotalMl !== undefined && { fluidTotalMl })}
              unitSystem={unitSystem}
              onTap={() => {
                if (habit.logAs === "fluid" && !longPressHintSeen.current.has(habit.id)) {
                  longPressHintSeen.current.add(habit.id);
                  toast.message(`Tip: long press ${habit.name} to open settings.`);
                }
                onTap(habit);
              }}
              onLongPress={() => onLongPress(habit)}
              onHide={() => hideHabit(habit)}
            />
          );
        })}

        {/* Add habit tile */}
        <AddHabitDrawer existingHabits={habits} />
      </div>
    </section>
  );
}
