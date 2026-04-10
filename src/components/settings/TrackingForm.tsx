import { ChevronRight, GripVertical, LayoutGrid, Trash2 } from "lucide-react";
import { type ComponentType, useMemo, useState } from "react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHabits } from "@/hooks/useProfile";
import { getHabitIcon } from "@/lib/habitIcons";
import type { HabitConfig } from "@/lib/habitTemplates";
import { HiddenHabitsSection } from "./tracking-form";

function reorderHabits(habits: HabitConfig[], fromId: string, toId: string): HabitConfig[] {
  if (fromId === toId) return habits;
  const fromIndex = habits.findIndex((habit) => habit.id === fromId);
  const toIndex = habits.findIndex((habit) => habit.id === toId);
  if (fromIndex < 0 || toIndex < 0) return habits;
  const next = [...habits];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function SectionHeader({
  title,
  subtitle,
  isOpen,
  icon: HeaderIcon,
}: {
  title: string;
  subtitle: string;
  isOpen: boolean;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--section-tracking)]">
          <HeaderIcon className="h-3.5 w-3.5" />
          {title}
        </p>
        <p className="text-[10px] text-[var(--text-faint)]">{subtitle}</p>
      </div>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--section-tracking)] hover:bg-[var(--section-tracking-muted)]"
          aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
        >
          <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        </button>
      </CollapsibleTrigger>
    </div>
  );
}

export function TrackingForm() {
  const { habits, setHabits, removeHabit, updateHabit } = useHabits();
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [dragOverHabitId, setDragOverHabitId] = useState<string | null>(null);
  const [activeHabitsOpen, setActiveHabitsOpen] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeHabits = useMemo(() => habits.filter((habit) => habit.showOnTrack), [habits]);

  const handleDrop = (targetHabitId: string) => {
    if (!draggedHabitId || draggedHabitId === targetHabitId) return;
    void setHabits(reorderHabits(habits, draggedHabitId, targetHabitId));
    setDraggedHabitId(null);
    setDragOverHabitId(null);
  };

  const hideHabit = (habit: HabitConfig) => {
    void updateHabit(habit.id, {
      showOnTrack: false,
      archivedAt: undefined,
    });
    toast.success(`${habit.name} hidden from Track.`);
  };

  const handleDeleteClick = (habit: HabitConfig) => {
    if (confirmDeleteId === habit.id) {
      setConfirmDeleteId(null);
      void removeHabit(habit.id);
      toast.success(`${habit.name} deleted from Quick Capture. Existing logs were kept.`);
      return;
    }
    setConfirmDeleteId(habit.id);
  };

  return (
    <div className="space-y-3">
      <Collapsible
        open={activeHabitsOpen}
        onOpenChange={setActiveHabitsOpen}
        data-slot="active-habits-section"
        className="rounded-xl border border-[var(--section-tracking-border)] bg-[var(--surface-2)] p-3"
      >
        <SectionHeader
          title="Active Habits"
          subtitle={`${activeHabits.length} of ${habits.length} habits shown on Track. Drag to reorder and hide anything you do not want on the main screen.`}
          isOpen={activeHabitsOpen}
          icon={LayoutGrid}
        />

        <CollapsibleContent className="mt-2 space-y-2">
          <p className="text-[10px] text-[var(--text-faint)]">
            Habit definitions are now code-defined. This screen only manages visibility, order,
            and cleanup of older custom cards.
          </p>

          {activeHabits.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--section-tracking-border)] px-3 py-4 text-center text-xs text-[var(--text-faint)]">
              No active habits are configured.
            </p>
          ) : (
            <ul className="grid list-none grid-cols-2 gap-2 sm:grid-cols-3">
              {activeHabits.map((habit) => {
                const { Icon, toneClassName } = getHabitIcon(habit);
                const isDragTarget = dragOverHabitId === habit.id;

                return (
                  <li
                    key={habit.id}
                    draggable
                    onDragStart={() => setDraggedHabitId(habit.id)}
                    onDragEnd={() => {
                      setDraggedHabitId(null);
                      setDragOverHabitId(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverHabitId(habit.id);
                    }}
                    onDrop={() => handleDrop(habit.id)}
                    className={`rounded-xl border bg-[var(--surface-0)] p-2 transition ${
                      isDragTarget
                        ? "border-[var(--section-tracking)] shadow-[0_0_0_1px_var(--section-tracking)]"
                        : "border-[var(--section-tracking-border)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <button
                          type="button"
                          className="mt-0.5 cursor-grab text-[var(--text-faint)]"
                          aria-label={`Drag to reorder ${habit.name}`}
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 shrink-0 ${toneClassName}`} />
                            <p className="truncate text-sm font-medium text-[var(--text)]">
                              {habit.name}
                            </p>
                          </div>
                          <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                            {habit.habitType} · {habit.unit}
                            {habit.dailyTarget ? ` · target ${habit.dailyTarget}` : ""}
                            {habit.dailyCap ? ` · cap ${habit.dailyCap}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => hideHabit(habit)}
                          className="rounded-md border border-[var(--section-tracking-border)] px-2 py-1 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--section-tracking)] hover:text-[var(--section-tracking)]"
                        >
                          Hide
                        </button>
                        {!habit.templateKey && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(habit)}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs transition-colors ${
                                  confirmDeleteId === habit.id
                                    ? "border-red-500/50 bg-red-500/15 text-red-300"
                                    : "border-[var(--section-tracking-border)] text-[var(--text-faint)] hover:border-red-400/40 hover:text-red-300"
                                }`}
                                aria-label={
                                  confirmDeleteId === habit.id
                                    ? `Confirm delete ${habit.name}`
                                    : `Delete ${habit.name}`
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-48 text-xs leading-snug">
                              {confirmDeleteId === habit.id
                                ? "Tap again to confirm. Existing logs are preserved."
                                : "Delete this old custom habit from Quick Capture while keeping historical logs."}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CollapsibleContent>
      </Collapsible>

      <HiddenHabitsSection
        habits={habits}
        updateHabit={(id, updates) => void updateHabit(id, updates)}
      />
    </div>
  );
}
