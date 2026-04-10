import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { UnitSystem } from "@/lib/units";
import { APP_DATA_HEADING_CLASS } from "./shared";

interface UnitsSectionProps {
  unitSystem: UnitSystem;
  onUnitSystemChange: (unitSystem: UnitSystem) => void;
}

export function UnitsSection({ unitSystem, onUnitSystemChange }: UnitsSectionProps) {
  return (
    <div data-slot="units-section" className="space-y-2">
      <div className="space-y-0.5">
        <p className={APP_DATA_HEADING_CLASS}>Units of Measurement</p>
        <p className="text-[11px] text-[var(--text-muted)]">Used across tracking and reports.</p>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        spacing={1}
        value={unitSystem}
        onValueChange={(value) => value && onUnitSystemChange(value as UnitSystem)}
        className="w-full"
      >
        <ToggleGroupItem
          value="metric"
          className="h-9 flex-1 rounded-md border px-3 text-xs font-semibold text-[var(--text-muted)] shadow-none transition-colors data-[pressed]:border-[var(--section-appdata)] data-[pressed]:bg-[var(--section-appdata-muted)] data-[pressed]:text-[var(--text)]"
        >
          Metric
        </ToggleGroupItem>
        <ToggleGroupItem
          value="imperial_us"
          className="h-9 flex-1 rounded-md border px-3 text-xs font-semibold text-[var(--text-muted)] shadow-none transition-colors data-[pressed]:border-[var(--section-appdata)] data-[pressed]:bg-[var(--section-appdata-muted)] data-[pressed]:text-[var(--text)]"
        >
          US
        </ToggleGroupItem>
        <ToggleGroupItem
          value="imperial_uk"
          className="h-9 flex-1 rounded-md border px-3 text-xs font-semibold text-[var(--text-muted)] shadow-none transition-colors data-[pressed]:border-[var(--section-appdata)] data-[pressed]:bg-[var(--section-appdata-muted)] data-[pressed]:text-[var(--text)]"
        >
          UK
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
