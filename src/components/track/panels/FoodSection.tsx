import { Soup } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { usePanelTime } from "@/hooks/usePanelTime";
import { type CustomFoodPreset, loadCustomFoodPresets } from "@/lib/customFoodPresets";
import { getErrorMessage } from "@/lib/errors";
import { PanelTimePicker } from "./PanelTimePicker";

export interface ParsedItem {
  name: string;
  quantity: string;
  unit: string;
  /** When true, this item came from a custom food preset badge and should bypass AI parsing. */
  fromPreset?: boolean;
  /** Ingredients from the custom food preset, if any. */
  presetIngredients?: string[];
}

interface FoodSectionProps {
  onLogFood: (
    items: ParsedItem[],
    notes: string,
    rawText: string,
    timestampMs?: number,
  ) => Promise<void>;
  captureTimestamp?: number;
}

export function FoodSection({ onLogFood, captureTimestamp }: FoodSectionProps) {
  const [foodName, setFoodName] = useState("");
  const [foodError, setFoodError] = useState("");
  const [saving, setSaving] = useState(false);
  const [customFoodPresets, setCustomFoodPresets] = useState<CustomFoodPreset[]>([]);
  // Track the active preset so we can bypass AI parsing when submitting a badge
  const [activePreset, setActivePreset] = useState<CustomFoodPreset | null>(null);

  const { timeValue, setTimeValue, dateValue, setDateValue, isEdited, getTimestampMs, reset } =
    usePanelTime(captureTimestamp);

  useEffect(() => {
    setCustomFoodPresets(loadCustomFoodPresets());
  }, []);

  const submitFood = () => {
    if (saving) return;

    const name = foodName.trim();
    if (!name) {
      setFoodError("Enter a food item.");
      toast.error("Enter a food item.");
      return;
    }
    setFoodError("");

    // Save all current input state in case we need to restore it on error
    const savedName = foodName;
    const savedTimeValue = timeValue;
    const savedDateValue = dateValue;
    const savedActivePreset = activePreset;
    const savedTimestampMs = getTimestampMs();

    // Check if the current food name matches the active preset — if so, bypass AI parsing
    const isFromPreset =
      activePreset !== null && activePreset.name.trim().toLowerCase() === name.toLowerCase();

    const item: ParsedItem = {
      name,
      quantity: "",
      unit: "",
      ...(isFromPreset && { fromPreset: true }),
      ...(isFromPreset &&
        activePreset.ingredients.length > 0 && {
          presetIngredients: activePreset.ingredients,
        }),
    };

    // Optimistic: clear input immediately so the UI stays responsive
    setFoodName("");
    setActivePreset(null);
    reset();
    setSaving(true);

    // Fire save in background — server handles all parsing
    onLogFood([item], "", savedName, savedTimestampMs)
      .catch((err: unknown) => {
        // Restore all input state so the user doesn't lose their entry
        setFoodName(savedName);
        setActivePreset(savedActivePreset);
        setTimeValue(savedTimeValue);
        setDateValue(savedDateValue);
        toast.error(getErrorMessage(err, "Failed to log food."));
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const foodErrorId = "food-name-error";

  return (
    <section className="glass-card glass-card-food p-4 space-y-4">
      <SectionHeader
        icon={Soup}
        title="Food"
        color="var(--section-food)"
        mutedColor="var(--section-food-muted)"
      />

      <div className="space-y-1.5">
        {customFoodPresets.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
              Food badges
            </p>
            <div className="flex flex-wrap gap-1.5">
              {customFoodPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="rounded-full border border-[var(--section-food-border)] bg-[var(--section-food-muted)] px-2.5 py-0.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--section-food)] hover:text-[var(--section-food)]"
                  title={
                    preset.ingredients.length > 0
                      ? `Ingredients: ${preset.ingredients.join(", ")}`
                      : "Custom food badge"
                  }
                  onClick={() => {
                    const nextName = preset.name.trim();
                    if (!nextName) return;
                    if (foodName.trim().toLowerCase() === nextName.toLowerCase()) {
                      void submitFood();
                      return;
                    }
                    setFoodName(nextName);
                    setActivePreset(preset);
                    if (foodError) setFoodError("");
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <PanelTimePicker
            timeValue={timeValue}
            setTimeValue={setTimeValue}
            dateValue={dateValue}
            setDateValue={setDateValue}
            isEdited={isEdited}
            accentColor="var(--section-food)"
            onEnterKey={submitFood}
          />

          <Input
            value={foodName}
            maxLength={300}
            onChange={(event) => {
              setFoodName(event.target.value);
              setActivePreset(null);
              if (foodError) setFoodError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void submitFood();
              }
            }}
            placeholder="eg. Ham sandwich"
            aria-invalid={Boolean(foodError)}
            aria-describedby={foodError ? foodErrorId : undefined}
            className="h-8 flex-1 rounded-[6px] text-(--text-muted) placeholder:text-(--text-faint) focus:ring-(--section-food)/30 focus:border-(--section-food)/50"
            style={{
              border: foodError ? "1px solid var(--red)" : "1px solid var(--section-food-border)",
              background: "var(--section-food-muted)",
            }}
          />
          <Button
            variant="outline"
            onClick={submitFood}
            disabled={saving}
            className="ml-auto h-8 rounded-[6px] px-4 text-xs font-semibold"
            style={{
              border: "none",
              background: "var(--section-food)",
              color: "#ffffff",
              boxShadow: "0 0 12px var(--section-food-glow)",
            }}
          >
            Log Food
          </Button>
        </div>
        {foodError && (
          <p id={foodErrorId} role="alert" className="text-[11px] text-[var(--red)]">
            {foodError}
          </p>
        )}
      </div>
    </section>
  );
}
