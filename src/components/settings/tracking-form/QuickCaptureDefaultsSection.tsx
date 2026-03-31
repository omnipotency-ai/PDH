import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface QuickCaptureDefaultsSectionProps {
  fluidDefaults: { waterMl: number };
  setFluidDefaults: (updates: { waterMl?: number }) => void;
  fluidDefaultStep: number;
  fluidDefaultDisplayUnitShort: string;
  fluidDefaultDisplayUnitLong: string;
  toFluidDefaultDisplayValue: (ml: number) => number;
  fromFluidDefaultDisplayValue: (value: number) => number;
}

export function QuickCaptureDefaultsSection({
  fluidDefaults,
  setFluidDefaults,
  fluidDefaultStep,
  fluidDefaultDisplayUnitShort,
  fluidDefaultDisplayUnitLong,
  toFluidDefaultDisplayValue,
  fromFluidDefaultDisplayValue,
}: QuickCaptureDefaultsSectionProps) {
  return (
    <div data-slot="quick-capture-defaults-section" className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--section-tracking)]">
          Quick Capture Defaults
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="rounded-md border border-[var(--section-tracking-border)] px-2 py-0.5 text-[10px] text-[var(--text-faint)]"
              aria-label="What are quick capture defaults?"
            >
              ?
            </button>
          </TooltipTrigger>
          <TooltipContent>Auto-logged when you tap Water quick button.</TooltipContent>
        </Tooltip>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="qc-water-default" className="sr-only">
            Water default amount in {fluidDefaultDisplayUnitShort}
          </Label>
          <Input
            id="qc-water-default"
            type="number"
            min={fluidDefaultStep}
            step={fluidDefaultStep}
            value={toFluidDefaultDisplayValue(fluidDefaults.waterMl)}
            onChange={(e) => {
              const val = Math.max(fluidDefaultStep, Number(e.target.value) || 0);
              setFluidDefaults({
                waterMl: fromFluidDefaultDisplayValue(val),
              });
            }}
            className="h-9"
            placeholder={`Water (${fluidDefaultDisplayUnitShort})`}
          />
          <p className="text-[10px] text-[var(--text-faint)]">
            Water: {toFluidDefaultDisplayValue(fluidDefaults.waterMl)} {fluidDefaultDisplayUnitLong}
          </p>
        </div>
      </div>
    </div>
  );
}
