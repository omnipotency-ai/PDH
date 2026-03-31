import { ArrowLeft, CopyPlus, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveShell } from "@/components/ui/responsive-shell";
import { useHabits, useUnitSystem } from "@/hooks/useProfile";
import {
  createCustomHabit,
  HABIT_TEMPLATES,
  type HabitConfig,
  type HabitType,
} from "@/lib/habitTemplates";
import { flOzToMl, getDisplayFluidUnit } from "@/lib/units";

type CreationStep = "type" | "template" | "custom";

type CustomDraft = {
  name: string;
  dailyTarget: string;
  dailyCap: string;
  quickIncrement: string;
  weeklyFrequencyTarget: string;
};

type TemplateMeta = {
  description: string;
  type: HabitType;
};

const HABIT_TYPE_OPTIONS: Array<{
  type: HabitType;
  label: string;
  description: string;
}> = [
  {
    type: "sleep",
    label: "Sleep",
    description: "Track nightly sleep with target hours and optional nudge settings.",
  },
  {
    type: "count",
    label: "Count",
    description: "Track repeat events with optional daily target.",
  },
  {
    type: "activity",
    label: "Activity",
    description: "Track minutes per session plus optional frequency per week.",
  },
  {
    type: "fluid",
    label: "Fluid",
    description: "Track hydration in ml with a daily target.",
  },
  {
    type: "destructive",
    label: "Destructive (cap)",
    description: "Track capped habits where the goal is to stay under allowance.",
  },
  {
    type: "checkbox",
    label: "Checkbox",
    description: "One-tap done/undone habits such as medication or wound care.",
  },
  {
    type: "weight",
    label: "Weight",
    description: "Track weigh-ins with the dedicated weight quick-capture card.",
  },
];

const TEMPLATE_META: Record<string, TemplateMeta> = {
  water: {
    type: "fluid",
    description: "Hydration target with quick ml increments.",
  },
  tea: { type: "fluid", description: "Tea target in ml." },
  electrolyte: {
    type: "fluid",
    description: "Electrolyte drink target in ml.",
  },
  sleep: {
    type: "sleep",
    description: "Nightly sleep target with hours-based tracking.",
  },
  weigh_in: {
    type: "weight",
    description: "Quick weigh-in card with weight trend settings.",
  },
  walking: {
    type: "activity",
    description: "Minutes per walk with weekly frequency support.",
  },
  yoga: {
    type: "activity",
    description: "Mind-body session duration and weekly cadence.",
  },
  stretching: { type: "activity", description: "Short flexibility sessions." },
  breathing: {
    type: "activity",
    description: "Breathing sessions tracked in minutes.",
  },
  medication: {
    type: "checkbox",
    description: "Daily medication done/undone toggle.",
  },
  morning_medication: {
    type: "checkbox",
    description: "Morning dose checkbox.",
  },
  afternoon_medication: {
    type: "checkbox",
    description: "Afternoon dose checkbox.",
  },
  evening_medication: {
    type: "checkbox",
    description: "Evening dose checkbox.",
  },
  wound_dressing_checkbox: {
    type: "checkbox",
    description: "Single daily dressing change checkbox.",
  },
  wound_dressing_count: {
    type: "count",
    description: "Count each dressing change event, no forced daily target.",
  },
  cigarettes: {
    type: "destructive",
    description: "Capped daily cigarette allowance.",
  },
  rec_drugs: {
    type: "destructive",
    description: "Capped recreational substance allowance.",
  },
  alcohol: { type: "destructive", description: "Capped drinks per day." },
  confectionery: {
    type: "destructive",
    description: "Capped sweets allowance.",
  },
  coffee: {
    type: "destructive",
    description: "Capped cups while still logging ml intake per coffee.",
  },
  journaling: {
    type: "count",
    description: "Track journaling sessions as events.",
  },
};

function parsePositiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function defaultDraftForType(type: HabitType): CustomDraft {
  switch (type) {
    case "sleep":
      return {
        name: "",
        dailyTarget: "7",
        dailyCap: "",
        quickIncrement: "0.5",
        weeklyFrequencyTarget: "",
      };
    case "activity":
      return {
        name: "",
        dailyTarget: "30",
        dailyCap: "",
        quickIncrement: "10",
        weeklyFrequencyTarget: "3",
      };
    case "fluid":
      return {
        name: "",
        dailyTarget: "1000",
        dailyCap: "",
        quickIncrement: "250",
        weeklyFrequencyTarget: "",
      };
    case "destructive":
      return {
        name: "",
        dailyTarget: "",
        dailyCap: "3",
        quickIncrement: "1",
        weeklyFrequencyTarget: "",
      };
    case "checkbox":
      return {
        name: "",
        dailyTarget: "1",
        dailyCap: "",
        quickIncrement: "1",
        weeklyFrequencyTarget: "",
      };
    case "weight":
      return {
        name: "",
        dailyTarget: "",
        dailyCap: "",
        quickIncrement: "",
        weeklyFrequencyTarget: "",
      };
    default:
      return {
        name: "",
        dailyTarget: "",
        dailyCap: "",
        quickIncrement: "1",
        weeklyFrequencyTarget: "",
      };
  }
}

function draftFromTemplate(template: HabitConfig): CustomDraft {
  return {
    name: template.name,
    dailyTarget: template.dailyTarget !== undefined ? String(template.dailyTarget) : "",
    dailyCap: template.dailyCap !== undefined ? String(template.dailyCap) : "",
    quickIncrement: String(template.quickIncrement),
    weeklyFrequencyTarget:
      template.weeklyFrequencyTarget !== undefined ? String(template.weeklyFrequencyTarget) : "",
  };
}

interface AddHabitDrawerContentProps {
  existingHabits: HabitConfig[];
  onClose: () => void;
}

function AddHabitDrawerContent({ existingHabits, onClose }: AddHabitDrawerContentProps) {
  const { addHabit, updateHabit } = useHabits();
  const { unitSystem } = useUnitSystem();
  const fluidUnit = getDisplayFluidUnit(unitSystem);

  const [step, setStep] = useState<CreationStep>("type");
  const [selectedType, setSelectedType] = useState<HabitType | null>(null);
  const [customDraft, setCustomDraft] = useState<CustomDraft>(defaultDraftForType("count"));

  const existingHabitsById = useMemo(
    () => new Map(existingHabits.map((habit) => [habit.id, habit])),
    [existingHabits],
  );

  const templatesBySelectedType = useMemo(() => {
    if (!selectedType) return [];

    return Object.entries(HABIT_TEMPLATES)
      .filter(([key]) => TEMPLATE_META[key]?.type === selectedType)
      .map(([key, template]) => ({
        key,
        template,
        description: TEMPLATE_META[key]?.description ?? "Template preset",
        existingHabit: existingHabitsById.get(template.id) ?? null,
      }));
  }, [selectedType, existingHabitsById]);

  const handleTypeSelect = (type: HabitType) => {
    setSelectedType(type);
    setCustomDraft(defaultDraftForType(type));
    setStep("template");
  };

  const handleAddTemplate = (templateKey: string) => {
    const template = HABIT_TEMPLATES[templateKey];
    if (!template) return;
    const existingHabit = existingHabitsById.get(template.id);

    if (existingHabit) {
      if (existingHabit.showOnTrack) {
        toast.message(`${template.name} is already displayed.`);
      } else {
        updateHabit(existingHabit.id, {
          showOnTrack: true,
        });
        toast.success(`${template.name} shown in Quick Capture`);
      }
      onClose();
      return;
    }

    addHabit(template);
    toast.success(`${template.name} added`);
    onClose();
  };

  const handleCopyTemplateToCustom = (templateKey: string) => {
    const template = HABIT_TEMPLATES[templateKey];
    if (!template) return;
    setSelectedType(template.habitType);
    setCustomDraft(draftFromTemplate(template));
    setStep("custom");
  };

  const handleCreateCustom = () => {
    if (!selectedType) return;

    if (selectedType === "weight") {
      toast.message("Use the built-in Weigh-in card in Quick Capture.");
      onClose();
      return;
    }

    const name = customDraft.name.trim();
    if (!name) {
      toast.error("Please enter a habit name.");
      return;
    }

    let quickIncrement = parsePositiveNumber(customDraft.quickIncrement);
    let dailyTarget = parsePositiveNumber(customDraft.dailyTarget);
    const dailyCap = parsePositiveNumber(customDraft.dailyCap);
    const weeklyFrequencyTarget = parsePositiveNumber(customDraft.weeklyFrequencyTarget);
    const defaultQuickIncrement =
      parsePositiveNumber(defaultDraftForType(selectedType).quickIncrement) ?? 1;

    // Fluid habits: user enters in display units (fl oz for imperial), but we store ml
    if (selectedType === "fluid" && unitSystem !== "metric") {
      if (quickIncrement !== undefined) {
        quickIncrement = Math.round(flOzToMl(quickIncrement));
      }
      if (dailyTarget !== undefined) {
        dailyTarget = Math.round(flOzToMl(dailyTarget));
      }
    }

    const builtHabit = createCustomHabit(name, {
      habitType: selectedType,
      kind: selectedType === "destructive" ? "destructive" : "positive",
      unit:
        selectedType === "sleep"
          ? "hours"
          : selectedType === "activity"
            ? "minutes"
            : selectedType === "fluid"
              ? "ml"
              : "count",
      quickIncrement: selectedType === "checkbox" ? 1 : (quickIncrement ?? defaultQuickIncrement),
      ...(selectedType === "checkbox" && { dailyTarget: 1 }),
      ...(selectedType === "destructive" && dailyCap !== undefined && { dailyCap }),
      ...(selectedType !== "destructive" &&
        selectedType !== "checkbox" &&
        dailyTarget !== undefined && { dailyTarget }),
      ...(selectedType === "activity" &&
        weeklyFrequencyTarget !== undefined && { weeklyFrequencyTarget }),
      ...(selectedType === "fluid" && { logAs: "fluid" as const }),
      color: selectedType === "destructive" ? "gray" : "indigo",
    });

    // Ensure custom habits remain visually generic unless the user picks a preset.
    const { templateKey: _removed, ...habitToAdd } = builtHabit;

    addHabit(habitToAdd);
    toast.success(`${name} added`);
    onClose();
  };

  const setDraft = (updates: Partial<CustomDraft>) => {
    setCustomDraft((prev) => ({ ...prev, ...updates }));
  };

  if (step === "type") {
    return (
      <div className="space-y-4 px-4 pb-6">
        <p className="text-sm text-[var(--text-muted)]">
          Choose the kind of habit you want to create.
        </p>
        <div className="space-y-2">
          {HABIT_TYPE_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => handleTypeSelect(option.type)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-left transition-colors hover:border-[var(--section-quick-border)]"
            >
              <p className="text-sm font-semibold text-[var(--text)]">{option.label}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{option.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "template") {
    return (
      <div className="space-y-4 px-4 pb-6">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => {
              setStep("type");
              setSelectedType(null);
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
            {selectedType}
          </span>
        </div>

        <div className="space-y-2">
          {templatesBySelectedType.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-xs text-[var(--text-muted)]">
              No templates in this category yet.
            </p>
          ) : (
            templatesBySelectedType.map((item) => {
              const isDisplayed = Boolean(item.existingHabit?.showOnTrack);
              const actionLabel = !item.existingHabit
                ? "Add template"
                : isDisplayed
                  ? "Already displayed"
                  : "Show again";
              return (
                <div
                  key={item.key}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--text)]">{item.template.name}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{item.description}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isDisplayed}
                      onClick={() => handleAddTemplate(item.key)}
                    >
                      {actionLabel}
                    </Button>
                    {selectedType !== "weight" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyTemplateToCustom(item.key)}
                      >
                        <CopyPlus className="h-3.5 w-3.5" />
                        Use as custom
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selectedType !== "weight" && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              if (!selectedType) return;
              setCustomDraft(defaultDraftForType(selectedType));
              setStep("custom");
            }}
          >
            <Sparkles className="h-4 w-4" />
            Create custom {selectedType ?? "habit"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-6">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setStep("template")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
          Custom {selectedType}
        </span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="habit-custom-name">Name</Label>
        <Input
          id="habit-custom-name"
          value={customDraft.name}
          onChange={(e) => setDraft({ name: e.target.value })}
          placeholder="Habit name"
        />
      </div>

      {(selectedType === "count" ||
        selectedType === "activity" ||
        selectedType === "fluid" ||
        selectedType === "sleep" ||
        selectedType === "destructive") && (
        <div className="space-y-1.5">
          <Label htmlFor="habit-custom-increment">
            {selectedType === "activity"
              ? "Quick capture minutes"
              : selectedType === "sleep"
                ? "Quick capture hours"
                : selectedType === "fluid"
                  ? `Quick capture ${fluidUnit}`
                  : "Quick increment"}
          </Label>
          <Input
            id="habit-custom-increment"
            type="number"
            min="0"
            step={selectedType === "sleep" ? "0.25" : "1"}
            value={customDraft.quickIncrement}
            onChange={(e) => setDraft({ quickIncrement: e.target.value })}
          />
        </div>
      )}

      {(selectedType === "count" ||
        selectedType === "activity" ||
        selectedType === "fluid" ||
        selectedType === "sleep") && (
        <div className="space-y-1.5">
          <Label htmlFor="habit-custom-target">
            {selectedType === "sleep"
              ? "Daily target (hours)"
              : selectedType === "activity"
                ? "Session target (minutes)"
                : selectedType === "fluid"
                  ? `Daily target (${fluidUnit})`
                  : "Daily target (optional)"}
          </Label>
          <Input
            id="habit-custom-target"
            type="number"
            min="0"
            value={customDraft.dailyTarget}
            onChange={(e) => setDraft({ dailyTarget: e.target.value })}
            placeholder="Optional"
          />
        </div>
      )}

      {selectedType === "destructive" && (
        <div className="space-y-1.5">
          <Label htmlFor="habit-custom-cap">Daily cap (optional)</Label>
          <Input
            id="habit-custom-cap"
            type="number"
            min="0"
            value={customDraft.dailyCap}
            onChange={(e) => setDraft({ dailyCap: e.target.value })}
            placeholder="Optional"
          />
          <p className="text-xs text-[var(--text-faint)]">
            Destructive habits are capped, not target-driven.
          </p>
        </div>
      )}

      {selectedType === "activity" && (
        <div className="space-y-1.5">
          <Label htmlFor="habit-custom-weekly-frequency">Times per week (optional)</Label>
          <Input
            id="habit-custom-weekly-frequency"
            type="number"
            min="1"
            max="14"
            value={customDraft.weeklyFrequencyTarget}
            onChange={(e) => setDraft({ weeklyFrequencyTarget: e.target.value })}
            placeholder="e.g. 3"
          />
        </div>
      )}

      {selectedType === "checkbox" && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">
          Checkbox habits are boolean: one tap marks done, next tap marks undone.
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button className="flex-1" onClick={handleCreateCustom}>
          Add custom habit
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface AddHabitDrawerProps {
  existingHabits: HabitConfig[];
}

export function AddHabitDrawer({ existingHabits }: AddHabitDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--text-muted)] transition-all hover:border-transparent hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--section-quick)]/40"
        aria-label="Add habit"
      >
        <Plus className="h-5 w-5" />
        <span className="text-xs font-medium">Add habit</span>
      </button>

      <ResponsiveShell
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-[var(--section-quick)]" />
            Add Habit
          </span>
        }
        description="Choose a type, then add a template or create a custom habit. To edit, reorder, or delete habits go to Settings."
        bodyClassName="pb-0"
        sheetContentClassName="max-w-[620px]"
        dialogContentClassName="max-w-[620px]"
      >
        <AddHabitDrawerContent
          existingHabits={existingHabits}
          onClose={() => setDrawerOpen(false)}
        />
      </ResponsiveShell>
    </>
  );
}
