import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UnitSystem } from "@/lib/units";
import { sanitizeDecimalInput, sanitizeWholeNumberInput } from "./weightUtils";

interface UnitAwareInputProps {
  unitSystem: UnitSystem;
  value: string;
  stones: string;
  pounds: string;
  setValue: (value: string) => void;
  setStones: (value: string) => void;
  setPounds: (value: string) => void;
  ids: { value: string; stones: string; pounds: string };
  labels: { value: string; stones: string; pounds: string };
  onKeyDown?: (e: React.KeyboardEvent) => void;
  autoFocus?: boolean;
  inputClassName?: string;
}

export function UnitAwareInput({
  unitSystem,
  value,
  stones,
  pounds,
  setValue,
  setStones,
  setPounds,
  ids,
  labels,
  onKeyDown,
  autoFocus,
  inputClassName,
}: UnitAwareInputProps) {
  const baseInputClass = `h-11 text-center font-mono text-lg${inputClassName ? ` ${inputClassName}` : ""}`;

  if (unitSystem === "imperial_uk") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={ids.stones}>{labels.stones}</Label>
          <Input
            id={ids.stones}
            inputMode="numeric"
            value={stones}
            onChange={(event) => setStones(sanitizeWholeNumberInput(event.target.value))}
            onKeyDown={onKeyDown}
            autoFocus={autoFocus}
            className={baseInputClass}
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={ids.pounds}>{labels.pounds}</Label>
          <Input
            id={ids.pounds}
            inputMode="numeric"
            value={pounds}
            onChange={(event) => setPounds(sanitizeWholeNumberInput(event.target.value))}
            onKeyDown={onKeyDown}
            className={baseInputClass}
            placeholder="0"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={ids.value}>{labels.value}</Label>
      <Input
        id={ids.value}
        inputMode="decimal"
        value={value}
        onChange={(event) => setValue(sanitizeDecimalInput(event.target.value))}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        className={baseInputClass}
        placeholder={unitSystem === "metric" ? "e.g. 104.4" : "e.g. 172.0"}
      />
    </div>
  );
}
