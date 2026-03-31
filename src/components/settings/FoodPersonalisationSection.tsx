import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CautionLevel, FoodPersonalisation, UpgradeSpeed } from "@/types/domain";

// ── Option definitions ───────────────────────────────────────────────────────

interface OptionCard<T extends string> {
  value: T;
  label: string;
  description: string;
}

const CAUTION_OPTIONS: OptionCard<CautionLevel>[] = [
  {
    value: "conservative",
    label: "Conservative",
    description: "More cautious with upgrades and stronger penalty for bad events.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Default behaviour — moderate upgrade speed and suggestion frequency.",
  },
  {
    value: "adventurous",
    label: "Adventurous",
    description: "Faster upgrades and more frequent new-food suggestions.",
  },
];

const UPGRADE_SPEED_OPTIONS: OptionCard<UpgradeSpeed>[] = [
  {
    value: "conservative",
    label: "Conservative",
    description: "3 of last 5 good trials required to upgrade.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "2 of last 3 good trials required to upgrade.",
  },
  {
    value: "adventurous",
    label: "Adventurous",
    description: "2 consecutive good trials required to upgrade.",
  },
];

// ── Component ────────────────────────────────────────────────────────────────

interface FoodPersonalisationSectionProps {
  foodPersonalisation: FoodPersonalisation;
  setFoodPersonalisation: (updates: Partial<FoodPersonalisation>) => void;
}

function RadioGroup<T extends string>({
  legend,
  helperText,
  options,
  value,
  onChange,
  name,
}: {
  legend: string;
  helperText: string;
  options: OptionCard<T>[];
  value: T;
  onChange: (next: T) => void;
  name: string;
}) {
  const helperId = `${name}-helper`;

  return (
    <fieldset className="space-y-2" aria-describedby={helperId}>
      <legend className="text-xs font-medium text-[var(--text)]">{legend}</legend>
      <p id={helperId} className="text-[10px] text-[var(--text-muted)]">
        {helperText}
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const isSelected = option.value === value;
          const inputId = `${name}-${option.value}`;

          return (
            <label
              key={option.value}
              htmlFor={inputId}
              className={cn(
                "cursor-pointer rounded-lg border px-3 py-2 transition-colors",
                "bg-[var(--surface-2)] hover:bg-[var(--surface-1)]",
                isSelected ? "border-sky-400/80" : "border-sky-400/25",
              )}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  id={inputId}
                  name={name}
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onChange(option.value)}
                  className="mt-0.5 accent-sky-400"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[var(--text)]">{option.label}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                    {option.description}
                  </p>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FoodPersonalisationSection({
  foodPersonalisation,
  setFoodPersonalisation,
}: FoodPersonalisationSectionProps) {
  return (
    <div data-slot="food-personalisation-section" className="space-y-3">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-400/80">
          Food Personalisation
        </p>
        <p className="text-[10px] text-[var(--text-faint)]">
          Control how Dr. Poo evaluates your food trials and upgrades foods.
        </p>
      </div>

      <RadioGroup
        legend="Caution level"
        helperText="How cautious should Dr. Poo be when upgrading foods and making suggestions?"
        options={CAUTION_OPTIONS}
        value={foodPersonalisation.cautionLevel}
        onChange={(next) => setFoodPersonalisation({ cautionLevel: next })}
        name="caution-level"
      />

      <RadioGroup
        legend="Upgrade speed"
        helperText="How many good trials before a food is considered safe?"
        options={UPGRADE_SPEED_OPTIONS}
        value={foodPersonalisation.upgradeSpeed}
        onChange={(next) => setFoodPersonalisation({ upgradeSpeed: next })}
        name="upgrade-speed"
      />

      <div className="flex items-start gap-2 rounded-lg border border-sky-400/15 bg-[var(--surface-0)] px-3 py-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400/60" />
        <p className="text-[10px] text-[var(--text-faint)]">
          Bristol scale interpretation (1 = constipated, 3-5 = ideal, 7 = diarrhea) and the 12-hour
          trial window are fixed and cannot be changed.
        </p>
      </div>
    </div>
  );
}
