import { ChevronRight, Eye, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getHabitIcon } from "@/lib/habitIcons";
import type { HabitConfig, HabitConfigPatch } from "@/lib/habitTemplates";

interface HiddenHabitsSectionProps {
  habits: HabitConfig[];
  updateHabit: (id: string, updates: HabitConfigPatch) => void;
}

export function HiddenHabitsSection({ habits, updateHabit }: HiddenHabitsSectionProps) {
  const hiddenHabits = habits.filter((h) => h.showOnTrack === false || h.archivedAt !== undefined);
  const [isOpen, setIsOpen] = useState(false);

  const handleRestore = (habit: HabitConfig) => {
    updateHabit(habit.id, {
      showOnTrack: true,
      archivedAt: undefined,
    });
    toast.success(`${habit.name} restored`);
  };

  if (hiddenHabits.length === 0) {
    return null;
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      data-slot="hidden-habits-section"
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--section-tracking)]">
          <Eye className="mr-1 inline h-3.5 w-3.5" />
          Hidden Habits ({hiddenHabits.length})
        </p>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-label={isOpen ? "Collapse hidden habits" : "Expand hidden habits"}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--section-tracking)] hover:bg-[var(--section-tracking-muted)]"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          </button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="space-y-1.5">
          {hiddenHabits.map((habit) => {
            const { Icon, toneClassName } = getHabitIcon(habit);
            const reason = habit.archivedAt ? "Archived" : "Hidden";
            return (
              <div
                key={habit.id}
                className="flex items-center justify-between rounded-xl border border-[var(--section-tracking-border)] bg-[var(--surface-2)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${toneClassName}`} />
                  <span className="text-sm text-[var(--text)]">{habit.name}</span>
                  <span className="text-[10px] text-[var(--text-faint)]">({reason})</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-[var(--section-tracking)] hover:text-[var(--section-tracking)]"
                  onClick={() => handleRestore(habit)}
                >
                  <RotateCcw className="h-3 w-3" />
                  Restore
                </Button>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
