import { USAGE_FREQUENCY_OPTIONS } from "@/lib/settingsUtils";
import type { UsageFrequencyChoice, YesNoChoice } from "@/types/domain";

interface YesNoRadioGroupProps {
  name: string;
  value: YesNoChoice;
  onChange: (value: "yes" | "no") => void;
}

/**
 * A pair of Yes / No radio buttons used at the top of each substance section.
 */
export function YesNoRadioGroup({ name, value, onChange }: YesNoRadioGroupProps) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-4">
      <label className="inline-flex items-center gap-2 text-xs text-[var(--text)]">
        <input
          type="radio"
          name={name}
          checked={value === "yes"}
          onChange={() => onChange("yes")}
          className="h-3.5 w-3.5 accent-[var(--section-health)]"
        />
        Yes
      </label>
      <label className="inline-flex items-center gap-2 text-xs text-[var(--text)]">
        <input
          type="radio"
          name={name}
          checked={value === "no"}
          onChange={() => onChange("no")}
          className="h-3.5 w-3.5 accent-[var(--section-health)]"
        />
        No
      </label>
    </div>
  );
}

interface FrequencySelectProps {
  value: UsageFrequencyChoice;
  onChange: (value: string) => void;
  title: string;
}

/**
 * A frequency dropdown used in alcohol and recreational substance detail panels.
 */
export function FrequencySelect({ value, onChange, title }: FrequencySelectProps) {
  return (
    <select
      className="h-9 w-full rounded-xl border border-[var(--section-health-border)] bg-[var(--surface-0)] px-3 text-sm text-[var(--text)]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title={title}
    >
      {USAGE_FREQUENCY_OPTIONS.map((option) => (
        <option key={option.value || "none"} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
