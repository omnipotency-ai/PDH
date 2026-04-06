import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAiPreferences, useFluidPresets, useFoodPersonalisation } from "@/hooks/useProfile";
import {
  type CustomFoodPreset,
  createBlankCustomFoodPreset,
  formatIngredientsInput,
  loadCustomFoodPresets,
  MAX_PRESET_NAME_LENGTH,
  MAX_PRESETS,
  parseIngredientsInput,
  saveCustomFoodPresets,
} from "@/lib/customFoodPresets";
import { BLOCKED_FLUID_PRESET_NAMES, MAX_FLUID_PRESETS } from "@/store";
import type { FluidPreset, FluidPresetDraft } from "@/types/domain";
import { FoodPersonalisationSection } from "./FoodPersonalisationSection";
import { CustomDrinksSection, DrPooSection } from "./tracking-form";

function normalizePreset(item: FluidPreset | string): FluidPreset {
  if (typeof item === "string") return { name: item };
  return item;
}

function makeDrafts(presets: (FluidPreset | string)[]): FluidPresetDraft[] {
  const drafts: FluidPresetDraft[] = [];
  for (let i = 0; i < MAX_FLUID_PRESETS; i++) {
    const raw = presets[i];
    drafts.push(raw ? { name: normalizePreset(raw).name } : { name: "" });
  }
  return drafts;
}

// ── CustomFoodCard ────────────────────────────────────────────────────────────
//
// Keeps a local raw string for the ingredients field so typing "pasta, cheese"
// doesn't get clobbered by the parse→format round-trip on every keystroke
// An explicit Save button commits changes and shows a toast.

interface CustomFoodCardProps {
  preset: CustomFoodPreset;
  onSave: (id: string, name: string, ingredients: string[]) => void;
  onRemove: (id: string) => void;
}

function CustomFoodCard({ preset, onSave, onRemove }: CustomFoodCardProps) {
  const [name, setName] = useState(preset.name);
  // Keep ingredients as a raw editable string; only parse on save.
  const [ingredientsRaw, setIngredientsRaw] = useState(formatIngredientsInput(preset.ingredients));

  // If the parent resets the preset (e.g. storage event from another tab),
  // sync local state to the new values.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on id only — don't clobber mid-edit
  useEffect(() => {
    setName(preset.name);
    setIngredientsRaw(formatIngredientsInput(preset.ingredients));
  }, [preset.id]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Food title is required.");
      return;
    }
    // Validate that at least one ingredient was parsed. An empty
    // result after parsing means the input had no meaningful content.
    const ingredients = parseIngredientsInput(ingredientsRaw);
    if (ingredientsRaw.trim() && ingredients.length === 0) {
      toast.error("No valid ingredients found. Use comma-separated names.");
      return;
    }
    onSave(preset.id, trimmedName, ingredients);
    toast.success(`"${trimmedName}" saved.`);
  };

  return (
    <div className="rounded-xl border border-[var(--section-personalisation-border)] bg-[var(--surface-2)] p-2.5">
      <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">Food title</Label>
              <Input
                value={name}
                maxLength={MAX_PRESET_NAME_LENGTH}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Lasagna"
                className="h-8"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">
                Ingredients (comma separated)
              </Label>
              <Input
                value={ingredientsRaw}
                maxLength={220}
                onChange={(event) => setIngredientsRaw(event.target.value)}
                placeholder="pasta, tomato sauce, cheese"
                className="h-8"
              />
            </div>
          </div>

          <button
            type="button"
            className="self-start rounded-md border border-red-500/40 px-2 py-1 text-[10px] text-red-400"
            onClick={() => onRemove(preset.id)}
          >
            Remove
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-md border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-[10px] font-medium text-sky-400 hover:bg-sky-400/20"
            onClick={handleSave}
          >
            Save food
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PersonalisationForm ───────────────────────────────────────────────────────

export function PersonalisationForm() {
  const { fluidPresets, setFluidPresets } = useFluidPresets();
  const { aiPreferences, setAiPreferences } = useAiPreferences();
  const { foodPersonalisation, setFoodPersonalisation } = useFoodPersonalisation();

  const [fluidDrafts, setFluidDrafts] = useState<FluidPresetDraft[]>(() =>
    makeDrafts(fluidPresets),
  );
  const [customFoodPresets, setCustomFoodPresets] = useState<CustomFoodPreset[]>([]);
  const [foodAndDrinkOpen, setFoodAndDrinkOpen] = useState(false);
  const [hasHydratedCustomFoods, setHasHydratedCustomFoods] = useState(false);

  useEffect(() => {
    setFluidDrafts(makeDrafts(fluidPresets));
  }, [fluidPresets]);

  useEffect(() => {
    setCustomFoodPresets(loadCustomFoodPresets());
    setHasHydratedCustomFoods(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedCustomFoods) return;
    saveCustomFoodPresets(customFoodPresets);
  }, [customFoodPresets, hasHydratedCustomFoods]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (event: StorageEvent) => {
      if (!event.key?.includes("custom-food-presets")) return;
      setCustomFoodPresets(loadCustomFoodPresets());
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const saveFluidDrafts = (drafts: FluidPresetDraft[] = fluidDrafts) => {
    const normalized: FluidPreset[] = [];
    const seen = new Set<string>();

    for (const draft of drafts) {
      const name = draft.name.trim();
      if (!name) continue;
      if (name.length > 20) {
        toast.error("Drink names must be 20 characters or less.");
        continue;
      }
      if (BLOCKED_FLUID_PRESET_NAMES.has(name.toLowerCase())) {
        toast.error(`"${name}" is built in. Choose a different name.`);
        continue;
      }
      const key = name.toLowerCase();
      if (seen.has(key)) {
        toast.error("Drink presets must have different names.");
        continue;
      }
      seen.add(key);

      normalized.push({ name });
    }

    setFluidPresets(normalized.slice(0, MAX_FLUID_PRESETS));
  };

  const updateFluidDraft = (index: number, value: string) => {
    setFluidDrafts((prev) => {
      const next = [...prev];
      next[index] = { name: value };
      return next;
    });
  };

  const addCustomFoodCard = () => {
    setCustomFoodPresets((prev) => [...prev, createBlankCustomFoodPreset()].slice(0, MAX_PRESETS));
  };

  const saveCustomFoodCard = (id: string, name: string, ingredients: string[]) => {
    setCustomFoodPresets((prev) =>
      prev.map((preset) => (preset.id === id ? { ...preset, name, ingredients } : preset)),
    );
  };

  const removeCustomFoodCard = (id: string) => {
    setCustomFoodPresets((prev) => prev.filter((preset) => preset.id !== id));
  };

  return (
    <div className="space-y-4">
      <DrPooSection aiPreferences={aiPreferences} setAiPreferences={setAiPreferences} />

      <FoodPersonalisationSection
        foodPersonalisation={foodPersonalisation}
        setFoodPersonalisation={setFoodPersonalisation}
      />

      <Collapsible
        open={foodAndDrinkOpen}
        onOpenChange={setFoodAndDrinkOpen}
        data-slot="food-and-drink-personalisation"
        className="space-y-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-400/80">
              Food & Drink Personalisation
            </p>
            <p className="text-[10px] text-[var(--text-faint)]">
              Configure reusable drink names and custom foods for Track.
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--section-personalisation)] hover:bg-[var(--section-personalisation-muted)]"
              aria-label={
                foodAndDrinkOpen
                  ? "Collapse food and drink personalisation"
                  : "Expand food and drink personalisation"
              }
            >
              <ChevronRight
                className={`h-4 w-4 text-sky-400/80 transition-transform ${foodAndDrinkOpen ? "rotate-90" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="space-y-3">
          <CustomDrinksSection
            fluidDrafts={fluidDrafts}
            updateFluidDraft={updateFluidDraft}
            saveFluidDrafts={saveFluidDrafts}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-[var(--text-muted)]">Custom foods</p>
              <button
                type="button"
                className="rounded-md border border-[var(--section-personalisation-border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
                onClick={addCustomFoodCard}
              >
                Add food card
              </button>
            </div>

            {customFoodPresets.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--section-personalisation-border)] px-3 py-3 text-xs text-[var(--text-faint)]">
                No custom foods yet. Add one to create reusable food badges.
              </p>
            ) : (
              <div className="grid gap-2">
                {customFoodPresets.map((preset) => (
                  <CustomFoodCard
                    key={preset.id}
                    preset={preset}
                    onSave={saveCustomFoodCard}
                    onRemove={removeCustomFoodCard}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
