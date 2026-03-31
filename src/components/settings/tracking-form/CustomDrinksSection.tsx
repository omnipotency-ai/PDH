import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FluidPresetDraft } from "@/types/domain";

interface CustomDrinksSectionProps {
  fluidDrafts: FluidPresetDraft[];
  updateFluidDraft: (index: number, value: string) => void;
  saveFluidDrafts: () => void;
}

export function CustomDrinksSection({
  fluidDrafts,
  updateFluidDraft,
  saveFluidDrafts,
}: CustomDrinksSectionProps) {
  return (
    <div data-slot="custom-drinks-section" className="space-y-2">
      <p className="text-[10px] font-medium text-[var(--text-muted)]">
        Drink choices (3 pills on Track)
      </p>
      <div className="grid gap-2">
        {fluidDrafts.map((draft, index) => (
          <div key={`drink-${index}`} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Label className="sr-only">Drink choice {index + 1}</Label>
              <Input
                value={draft.name}
                maxLength={20}
                onChange={(e) => updateFluidDraft(index, e.target.value)}
                onBlur={() => saveFluidDrafts()}
                onKeyDown={(e) => e.key === "Enter" && saveFluidDrafts()}
                placeholder={`Drink ${index + 1}`}
                className="h-9"
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-[var(--text-faint)]">
        These labels sit beside the manual amount field in the Fluids panel.
      </p>
    </div>
  );
}
