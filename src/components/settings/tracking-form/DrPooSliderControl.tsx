import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AxisOption } from "./drPooPreviewData";

// ── Slider control ──────────────────────────────────────────────────────────

interface SliderControlProps<T extends string> {
  label: string;
  value: T;
  options: readonly AxisOption<T>[];
  onChange: (next: T) => void;
}

function getOptionIndex<T extends string>(options: readonly AxisOption<T>[], value: T): number {
  const index = options.findIndex((option) => option.value === value);
  return index === -1 ? 0 : index;
}

export function SliderControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SliderControlProps<T>) {
  const selectedIndex = getOptionIndex(options, value);
  const selected = options[selectedIndex];

  return (
    <div className="space-y-1.5 rounded-lg border border-sky-400/25 bg-[var(--surface-0)] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] text-[var(--text-faint)]">{label}</Label>
        <span className="text-[10px] font-semibold text-[var(--text)]">{selected.label}</span>
      </div>

      <input
        type="range"
        min={0}
        max={options.length - 1}
        step={1}
        value={selectedIndex}
        onChange={(event) => {
          const nextIndex = Number(event.target.value);
          const next = options[nextIndex];
          if (!next) return;
          onChange(next.value);
        }}
        className="h-2 w-full cursor-pointer accent-sky-400"
        aria-label={label}
      />

      <div
        className="grid text-[10px]"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <span
            key={option.value}
            className={cn(
              "truncate text-center",
              option.value === value ? "text-[var(--text)]" : "text-[var(--text-faint)]",
            )}
          >
            {option.label}
          </span>
        ))}
      </div>

      <p className="text-[10px] text-[var(--text-muted)]">{selected.description}</p>
    </div>
  );
}
