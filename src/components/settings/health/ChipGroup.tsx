import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ChipGroupProps {
  label: string;
  options: readonly string[];
  selectedValues: readonly string[];
  onToggle: (value: string) => void;
}

export function ChipGroup({ label, options, selectedValues, onToggle }: ChipGroupProps) {
  return (
    <div data-slot="chip-group" className="space-y-1.5">
      <Label className="text-xs font-semibold text-[var(--text)]">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = selectedValues.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              aria-pressed={selected}
              className={cn(
                "settings-chip inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-all",
                selected
                  ? "border-[var(--section-health)]/50 bg-[var(--section-health)]/10 text-[var(--section-health)]"
                  : "border-[var(--surface-3)] bg-[var(--surface-2)] text-[var(--text-faint)] hover:border-[var(--section-health)]/35 hover:bg-[var(--surface-3)] hover:text-[var(--text-muted)]",
              )}
            >
              <Check
                className={cn(
                  "h-3 w-3 transition-all duration-200",
                  selected ? "scale-100 opacity-100" : "scale-75 opacity-0",
                )}
                aria-hidden="true"
              />
              <span className="whitespace-nowrap font-normal">{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
