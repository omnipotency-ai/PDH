import {
  AlertTriangle,
  BadgeCheck,
  ChevronRight,
  Droplets,
  Dumbbell,
  GripVertical,
  LayoutGrid,
  Moon,
  Plus,
  Scale,
  Target,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AiSuggestionsCard } from "@/components/settings/AiSuggestionsCard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHabits } from "@/hooks/useProfile";
import { getHabitIcon } from "@/lib/habitIcons";
import {
  createCustomHabit,
  HABIT_TEMPLATES,
  type HabitConfig,
  type HabitType,
} from "@/lib/habitTemplates";
import { HiddenHabitsSection } from "./tracking-form";

type HabitCategory = {
  habitType: HabitType;
  label: string;
  blurb: string;
  Icon: typeof Moon;
};

const HABIT_CATEGORIES: HabitCategory[] = [
  {
    habitType: "sleep",
    label: "Sleep",
    blurb: "Hours-based sleep cards and targets.",
    Icon: Moon,
  },
  {
    habitType: "weight",
    label: "Weigh-in",
    blurb: "Dedicated scale entry cards.",
    Icon: Scale,
  },
  {
    habitType: "checkbox",
    label: "Checkbox",
    blurb: "Boolean done / not-done habits.",
    Icon: BadgeCheck,
  },
  {
    habitType: "destructive",
    label: "Destructive",
    blurb: "Capped habits such as cigarettes or alcohol.",
    Icon: AlertTriangle,
  },
  {
    habitType: "count",
    label: "Count",
    blurb: "Simple count-based habits.",
    Icon: Target,
  },
  {
    habitType: "activity",
    label: "Activity",
    blurb: "Time goals for movement and exercise.",
    Icon: Dumbbell,
  },
  {
    habitType: "fluid",
    label: "Fluid",
    blurb: "Drink tracking cards in ml.",
    Icon: Droplets,
  },
];

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

function buildCustomHabitByCategory(name: string, category: HabitType): HabitConfig {
  switch (category) {
    case "sleep":
      return createCustomHabit(name, {
        habitType: "sleep",
        kind: "positive",
        unit: "hours",
        quickIncrement: 0.5,
        dailyTarget: 7,
        color: "indigo",
      });
    case "fluid":
      return createCustomHabit(name, {
        habitType: "fluid",
        kind: "positive",
        unit: "ml",
        quickIncrement: 250,
        dailyTarget: 1000,
        logAs: "fluid",
        color: "indigo",
      });
    case "activity":
      return createCustomHabit(name, {
        habitType: "activity",
        kind: "positive",
        unit: "minutes",
        quickIncrement: 10,
        dailyTarget: 30,
        weeklyFrequencyTarget: 3,
        color: "indigo",
      });
    case "destructive":
      return createCustomHabit(name, {
        habitType: "destructive",
        kind: "destructive",
        unit: "count",
        quickIncrement: 1,
        dailyCap: 2,
        color: "gray",
      });
    case "checkbox":
      return createCustomHabit(name, {
        habitType: "checkbox",
        kind: "positive",
        unit: "count",
        quickIncrement: 1,
        dailyTarget: 1,
        color: "indigo",
      });
    case "count":
      return createCustomHabit(name, {
        habitType: "count",
        kind: "positive",
        unit: "count",
        quickIncrement: 1,
        color: "indigo",
      });
    default:
      return createCustomHabit(name, {
        habitType: "count",
        kind: "positive",
        unit: "count",
        quickIncrement: 1,
        color: "indigo",
      });
  }
}

function getCategoryLabel(habitType: HabitType): string {
  return HABIT_CATEGORIES.find((category) => category.habitType === habitType)?.label ?? habitType;
}

// ── Reusable section header with collapsible trigger ────────────────────────

function SectionHeader({
  title,
  subtitle,
  isOpen,
  icon: HeaderIcon,
}: {
  title: string;
  subtitle: string;
  isOpen: boolean;
  icon: React.ComponentType<{ className?: string }>;
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

// ── Main form ───────────────────────────────────────────────────────────────

export function TrackingForm() {
  const { habits, addHabit, setHabits, removeHabit, updateHabit } = useHabits();

  const [selectedCategory, setSelectedCategory] = useState<HabitType>("sleep");
  const [customHabitName, setCustomHabitName] = useState("");
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [dragOverHabitId, setDragOverHabitId] = useState<string | null>(null);
  const [activeHabitsOpen, setActiveHabitsOpen] = useState(true);
  const [addNewOpen, setAddNewOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeHabits = useMemo(() => habits.filter((h) => h.showOnTrack), [habits]);
  const activeCount = activeHabits.length;
  const totalCount = habits.length;

  const templatesByCategory = useMemo(() => {
    const grouped = new Map<HabitType, Array<{ key: string; template: HabitConfig }>>();

    for (const [key, template] of Object.entries(HABIT_TEMPLATES)) {
      const existing = grouped.get(template.habitType) ?? [];
      existing.push({ key, template });
      grouped.set(template.habitType, existing);
    }

    return grouped;
  }, []);

  const selectedCategoryTemplates = templatesByCategory.get(selectedCategory) ?? [];

  const habitsByType = useMemo(() => {
    return habits.reduce<Record<HabitType, HabitConfig[]>>(
      (acc, habit) => {
        acc[habit.habitType].push(habit);
        return acc;
      },
      {
        sleep: [],
        weight: [],
        checkbox: [],
        destructive: [],
        count: [],
        activity: [],
        fluid: [],
      },
    );
  }, [habits]);

  const toggleHabitVisibility = (habit: HabitConfig) => {
    void updateHabit(habit.id, {
      showOnTrack: !habit.showOnTrack,
      archivedAt: undefined,
    });
  };

  const handleDeleteClick = (habit: HabitConfig) => {
    if (confirmDeleteId === habit.id) {
      // Second tap — confirmed, proceed with deletion
      setConfirmDeleteId(null);
      void removeHabit(habit.id);
      if (habit.templateKey) {
        toast.success(
          `${habit.name} removed from your habits. Existing logs were kept and the template is still available.`,
        );
        return;
      }
      toast.success(`${habit.name} deleted from Quick Capture. Existing logs were kept.`);
    } else {
      // First tap — enter confirmation state
      setConfirmDeleteId(habit.id);
    }
  };

  const addTemplateHabit = (template: HabitConfig) => {
    const existingHabit = habits.find((habit) => habit.id === template.id);

    if (!existingHabit) {
      void addHabit(template);
      toast.success(`${template.name} added to Quick Capture.`);
      return;
    }

    if (!existingHabit.showOnTrack) {
      void updateHabit(existingHabit.id, {
        showOnTrack: true,
        archivedAt: undefined,
      });
      toast.success(`${template.name} shown in Quick Capture.`);
      return;
    }

    toast.message(`${template.name} is already active.`);
  };

  const handleCreateCustomHabit = () => {
    const name = customHabitName.trim();

    if (!name) {
      toast.error("Enter a habit name.");
      return;
    }

    if (selectedCategory === "weight") {
      toast.info("Weight uses the built-in Weigh-in card. Use templates to show it.");
      return;
    }

    const duplicate = habits.some((habit) => habit.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      toast.error("That habit already exists.");
      return;
    }

    const customHabit = buildCustomHabitByCategory(name, selectedCategory);
    const { templateKey: _removed, ...habitToAdd } = customHabit;
    void addHabit(habitToAdd);
    setCustomHabitName("");
    toast.success(`${name} added to ${getCategoryLabel(selectedCategory)}.`);
  };

  const handleDrop = (targetHabitId: string) => {
    if (!draggedHabitId || draggedHabitId === targetHabitId) return;
    const reordered = reorderHabits(habits, draggedHabitId, targetHabitId);
    void setHabits(reordered);
    setDraggedHabitId(null);
    setDragOverHabitId(null);
  };

  return (
    <div className="space-y-3">
      {/* ── Section 1: Active Habits ── */}
      <Collapsible
        open={activeHabitsOpen}
        onOpenChange={setActiveHabitsOpen}
        data-slot="active-habits-section"
        className="rounded-xl border border-[var(--section-tracking-border)] bg-[var(--surface-2)] p-3"
      >
        <SectionHeader
          title="Active Habits"
          subtitle={`${activeCount} of ${totalCount} habits shown on Track. Tap to toggle, drag to reorder.`}
          isOpen={activeHabitsOpen}
          icon={LayoutGrid}
        />

        <CollapsibleContent className="mt-2 space-y-2">
          {habits.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--section-tracking-border)] px-3 py-4 text-center text-xs text-[var(--text-faint)]">
              No habits yet. Use the section below to add habits from templates or create your own.
            </p>
          ) : (
            <>
              <ul className="grid list-none grid-cols-2 gap-2 sm:grid-cols-3">
                {activeHabits.map((habit) => {
                  const { Icon, toneClassName } = getHabitIcon(habit);
                  const isDragTarget = dragOverHabitId === habit.id;

                  return (
                    <li
                      key={habit.id}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverHabitId(habit.id);
                      }}
                      onDrop={() => handleDrop(habit.id)}
                      className={`relative rounded-xl border border-emerald-500/50 bg-emerald-500/8 transition-colors ${isDragTarget ? "ring-1 ring-[var(--section-tracking)]" : ""}`}
                    >
                      <div className="flex">
                        {/* Drag handle */}
                        <button
                          type="button"
                          draggable
                          onDragStart={() => setDraggedHabitId(habit.id)}
                          onDragEnd={() => {
                            setDraggedHabitId(null);
                            setDragOverHabitId(null);
                          }}
                          className="flex w-6 shrink-0 cursor-grab items-center justify-center rounded-l-xl text-[var(--text-faint)] hover:bg-[var(--surface-3)] active:cursor-grabbing"
                          aria-label={`Drag to reorder ${habit.name}`}
                        >
                          <GripVertical className="h-3 w-3" />
                        </button>

                        {/* Card body -- click to toggle */}
                        <button
                          type="button"
                          onClick={() => toggleHabitVisibility(habit)}
                          className="min-w-0 flex-1 px-2 py-2 text-left"
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${toneClassName}`} />
                            <span className="truncate text-[11px] font-medium text-[var(--text)]">
                              {habit.name}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] text-[var(--text-faint)]">
                            {getCategoryLabel(habit.habitType)}
                          </p>
                        </button>

                        {/* Delete button — two-tap confirmation */}
                        <button
                          type="button"
                          className={`flex w-7 shrink-0 items-start justify-center pt-2 transition-colors ${
                            confirmDeleteId === habit.id
                              ? "text-red-400"
                              : "text-red-400/60 hover:text-red-400"
                          }`}
                          aria-label={
                            confirmDeleteId === habit.id
                              ? `Confirm delete ${habit.name}`
                              : `Delete ${habit.name}`
                          }
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleDeleteClick(habit);
                          }}
                          onBlur={() => {
                            if (confirmDeleteId === habit.id) {
                              setConfirmDeleteId(null);
                            }
                          }}
                        >
                          {confirmDeleteId === habit.id ? (
                            <span className="text-[9px] font-bold leading-none">Del?</span>
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="note"
                    className="block cursor-default text-[9px] text-[var(--text-faint)]"
                  >
                    Tap the card body to hide a habit. Drag the grip handle to reorder. Trash
                    deletes permanently.
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Hidden habits can be restored from the section below.</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}

          {/* Hidden habits sub-section */}
          <HiddenHabitsSection habits={habits} updateHabit={updateHabit} />
        </CollapsibleContent>
      </Collapsible>

      {/* ── Section 3: Add New Habits ── */}
      <Collapsible
        open={addNewOpen}
        onOpenChange={setAddNewOpen}
        data-slot="add-new-habits-section"
        className="rounded-xl border border-[var(--section-tracking-border)] bg-[var(--surface-2)] p-3"
      >
        <SectionHeader
          title="Add New Habits"
          subtitle="Browse templates or create a custom habit."
          isOpen={addNewOpen}
          icon={Plus}
        />

        <CollapsibleContent className="mt-2 space-y-3">
          {/* Category selector grid */}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {HABIT_CATEGORIES.map((category) => {
              const total = habitsByType[category.habitType].length;
              const active = habitsByType[category.habitType].filter(
                (habit) => habit.showOnTrack,
              ).length;
              const isSelected = selectedCategory === category.habitType;
              const CategoryIcon = category.Icon;

              return (
                <button
                  key={category.habitType}
                  type="button"
                  onClick={() => setSelectedCategory(category.habitType)}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? "border-[var(--section-tracking)] bg-[var(--section-tracking-muted)]"
                      : "border-[var(--section-tracking-border)] bg-[var(--surface-0)] hover:border-[var(--section-tracking)]/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text)]">
                      <CategoryIcon className="h-3.5 w-3.5 text-[var(--section-tracking)]" />
                      {category.label}
                    </span>
                    <span className="rounded-full bg-[var(--surface-0)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                      {active}/{total}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--text-faint)]">{category.blurb}</p>
                </button>
              );
            })}
          </div>

          {/* Templates + custom creation for selected category */}
          <div className="space-y-2 rounded-xl border border-[var(--section-tracking-border)] bg-[var(--surface-0)] p-3">
            <p className="text-xs font-semibold text-[var(--text)]">
              {getCategoryLabel(selectedCategory)} templates
            </p>

            {selectedCategoryTemplates.length === 0 ? (
              <p className="text-xs text-[var(--text-faint)]">No templates in this category yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedCategoryTemplates.map(({ key, template }) => {
                  const existingHabit = habits.find((habit) => habit.id === template.id);
                  const isActive = Boolean(existingHabit?.showOnTrack);
                  const actionLabel = !existingHabit ? "Add" : isActive ? "Active" : "Show again";

                  return (
                    <div
                      key={key}
                      className="rounded-lg border border-[var(--section-tracking-border)] bg-[var(--surface-2)] px-2.5 py-2"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium text-[var(--text)]">
                          {template.name}
                        </p>
                        <button
                          type="button"
                          disabled={isActive}
                          onClick={() => addTemplateHabit(template)}
                          className="rounded-md border border-[var(--section-tracking-border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)] disabled:cursor-default disabled:opacity-50"
                        >
                          {actionLabel}
                        </button>
                      </div>
                      <p className="text-[10px] text-[var(--text-faint)]">
                        Quick increment {template.quickIncrement} {template.unit}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <Separator className="my-2" />

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-1">
                <Label className="text-[10px] text-[var(--text-faint)]">
                  Create new {getCategoryLabel(selectedCategory).toLowerCase()} habit
                </Label>
                <Input
                  value={customHabitName}
                  maxLength={40}
                  onChange={(event) => setCustomHabitName(event.target.value)}
                  placeholder={`New ${getCategoryLabel(selectedCategory).toLowerCase()} habit`}
                  className="h-8"
                  disabled={selectedCategory === "weight"}
                />
              </div>
              <button
                type="button"
                onClick={handleCreateCustomHabit}
                disabled={selectedCategory === "weight"}
                className="rounded-md border border-[var(--section-tracking-border)] px-2.5 py-1 text-xs text-[var(--text-muted)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Add habit
              </button>
            </div>
            {selectedCategory === "weight" && (
              <p className="text-[10px] text-[var(--text-faint)]">
                Weight uses the single built-in Weigh-in card and does not support extra custom
                cards.
              </p>
            )}
            <p className="text-[10px] text-[var(--text-faint)]">
              For full numeric options (targets, caps, increments) use the{" "}
              <span className="font-medium text-[var(--text-muted)]">Add habit</span> button on the
              Track page.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Section 4: AI Habit Review ── */}
      <AiSuggestionsCard variant="inline" />
    </div>
  );
}
