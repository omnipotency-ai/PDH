import { format } from "date-fns";
import { Clock } from "lucide-react";
import { useId } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface PanelTimePickerProps {
  timeValue: string;
  setTimeValue: (v: string) => void;
  dateValue: string;
  setDateValue: (v: string) => void;
  isEdited: boolean;
  /** Section color for accent (e.g., "var(--section-bowel)") */
  accentColor?: string;
  onEnterKey?: () => void;
}

/**
 * A compact clock-icon trigger that opens a Popover for date + time entry.
 * Intended as a shared replacement for inline time inputs across all left-column panels.
 */
export function PanelTimePicker({
  timeValue,
  setTimeValue,
  dateValue,
  setDateValue,
  isEdited,
  accentColor,
  onEnterKey,
}: PanelTimePickerProps) {
  const instanceId = useId();
  const dateId = `${instanceId}-date`;
  const timeId = `${instanceId}-time`;
  const now = new Date();
  const defaultDate = format(now, "yyyy-MM-dd");
  const defaultTime = format(now, "HH:mm");
  const displayTime = timeValue || defaultTime;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onEnterKey) {
      e.preventDefault();
      onEnterKey();
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={isEdited ? `Time set to ${displayTime}` : "Set log time"}
          className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-(--surface-3) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--ring)"
        >
          <Clock className="h-4 w-4 text-(--text-faint)" aria-hidden="true" />
          <span
            className={cn("text-xs tabular-nums", isEdited ? "" : "text-(--text-faint)")}
            style={isEdited && accentColor ? { color: accentColor } : undefined}
          >
            {isEdited ? displayTime : "Now"}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent side="bottom" align="start" className="w-auto p-2 space-y-1.5">
        <div data-slot="panel-time-picker" className="space-y-1.5">
          <div className="space-y-0.5">
            <label
              htmlFor={dateId}
              className="block text-[10px] uppercase tracking-wider font-mono text-(--text-faint)"
            >
              Date
            </label>
            <input
              id={dateId}
              type="date"
              value={dateValue || defaultDate}
              onChange={(e) => setDateValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full rounded border border-[var(--color-border-default)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>

          <div className="space-y-0.5">
            <label
              htmlFor={timeId}
              className="block text-[10px] uppercase tracking-wider font-mono text-(--text-faint)"
            >
              Time
            </label>
            <input
              id={timeId}
              type="time"
              value={timeValue || defaultTime}
              onChange={(e) => setTimeValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full rounded border border-[var(--color-border-default)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs tabular-nums text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
