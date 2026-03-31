/**
 * TimeInput — inline HH:MM split input with keyboard increment/decrement.
 *
 * - Two separate fields: hours (00–23) and minutes (00–59)
 * - Up/Down arrow keys increment/decrement the focused field
 * - Typing two valid digits auto-advances from hours to minutes
 * - Tab moves between fields naturally
 * - Styled to match the app's section accent colour via CSS variables
 *
 * variant "icon": compact trigger (clock only); time input opens in a popover on click.
 */

import { Clock } from "lucide-react";
import { useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TimeInputProps {
  /** Current time value as HH:MM string */
  value: string;
  /** Called with new HH:MM string whenever the time changes */
  onChange: (value: string) => void;
  /** Whether the time has been manually edited (affects visual state) */
  edited?: boolean;
  /** Accent CSS variable name, e.g. "var(--section-food)" */
  accentColor?: string;
  /** Muted background CSS variable, e.g. "var(--section-food-muted)" */
  accentMuted?: string;
  /** Border CSS variable for unedited state, e.g. "var(--section-food-border)" */
  borderColor?: string;
  /** Additional wrapper className */
  className?: string;
  /** aria-label prefix for the group */
  label?: string;
  disabled?: boolean;
  /** "inline" = full badge + time always visible; "icon" = clock only, time in popover on click */
  variant?: "inline" | "icon";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseHHMM(value: string): [number, number] {
  const [h = "0", m = "0"] = value.split(":");
  return [clamp(Number.parseInt(h, 10) || 0, 0, 23), clamp(Number.parseInt(m, 10) || 0, 0, 59)];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function TimeInput({
  value,
  onChange,
  edited = false,
  accentColor = "var(--section-food)",
  accentMuted = "var(--section-food-muted)",
  borderColor = "var(--section-food-border)",
  className,
  label = "Log time",
  disabled = false,
  variant = "inline",
}: TimeInputProps) {
  const [hours, minutes] = parseHHMM(value);
  const minuteRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Track partial input for the hours field (allows typing "0" before "9" → "09")
  const [hourDraft, setHourDraft] = useState<string | null>(null);
  const [minuteDraft, setMinuteDraft] = useState<string | null>(null);

  const commitHours = (h: number) => {
    onChange(`${pad2(clamp(h, 0, 23))}:${pad2(minutes)}`);
    setHourDraft(null);
  };

  const commitMinutes = (m: number) => {
    onChange(`${pad2(hours)}:${pad2(clamp(m, 0, 59))}`);
    setMinuteDraft(null);
  };

  // ── Hours field handlers ──────────────────────────────────────────────────

  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (hourDraft !== null) {
        commitHours(Number.parseInt(hourDraft, 10) || 0);
      }
      e.currentTarget.blur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      commitHours(hours === 23 ? 0 : hours + 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      commitHours(hours === 0 ? 23 : hours - 1);
    } else if (e.key === "Tab" && !e.shiftKey) {
      setHourDraft(null);
    } else if (e.key === "Backspace") {
      setHourDraft((prev) => (prev !== null && prev.length > 0 ? prev.slice(0, -1) : null));
    }
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw === "") {
      setHourDraft("");
      return;
    }

    const lastTwo = raw.slice(-2);
    const num = Number.parseInt(lastTwo, 10);

    if (lastTwo.length === 2) {
      // two digits entered — commit if valid, else clamp
      const clamped = clamp(num, 0, 23);
      commitHours(clamped);
      minuteRef.current?.focus();
      minuteRef.current?.select();
    } else {
      // one digit — could still be a prefix (e.g. "0", "1", "2")
      const digit = Number.parseInt(lastTwo, 10);
      if (digit >= 3) {
        // 3–9 can only be a complete single-digit hour — commit and advance
        commitHours(digit);
        minuteRef.current?.focus();
        minuteRef.current?.select();
      } else {
        setHourDraft(lastTwo);
      }
    }
  };

  const handleHourBlur = () => {
    if (hourDraft !== null) {
      const parsed = Number.parseInt(hourDraft, 10) || 0;
      commitHours(parsed);
    }
  };

  // ── Minutes field handlers ────────────────────────────────────────────────

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (minuteDraft !== null) {
        commitMinutes(Number.parseInt(minuteDraft, 10) || 0);
      }
      e.currentTarget.blur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      commitMinutes(minutes === 59 ? 0 : minutes + 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      commitMinutes(minutes === 0 ? 59 : minutes - 1);
    } else if (e.key === "Tab" && e.shiftKey) {
      setMinuteDraft(null);
    } else if (e.key === "Backspace") {
      if (minuteDraft === "" || minuteDraft === null) {
        // back-tab to hour when backspace on empty minutes
        hourRef.current?.focus();
        hourRef.current?.select();
      } else {
        setMinuteDraft((prev) => (prev !== null && prev.length > 0 ? prev.slice(0, -1) : null));
      }
    }
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw === "") {
      setMinuteDraft("");
      return;
    }

    const lastTwo = raw.slice(-2);
    const num = Number.parseInt(lastTwo, 10);

    if (lastTwo.length === 2) {
      const clamped = clamp(num, 0, 59);
      commitMinutes(clamped);
    } else {
      const digit = Number.parseInt(lastTwo, 10);
      if (digit >= 6) {
        commitMinutes(digit);
      } else {
        setMinuteDraft(lastTwo);
      }
    }
  };

  const handleMinuteBlur = () => {
    if (minuteDraft !== null) {
      const parsed = Number.parseInt(minuteDraft, 10) || 0;
      commitMinutes(parsed);
    }
  };

  // ── Derived display values ────────────────────────────────────────────────

  const hourDisplay = hourDraft !== null ? hourDraft : pad2(hours);
  const minuteDisplay = minuteDraft !== null ? minuteDraft : pad2(minutes);

  // ── Styles ───────────────────────────────────────────────────────────────

  const wrapperStyle: React.CSSProperties = {
    border: edited ? `1px solid ${accentColor}` : `1px solid ${borderColor}`,
    background: edited ? accentMuted : "transparent",
  };

  const segmentStyle: React.CSSProperties = {
    color: edited ? accentColor : "var(--text-muted)",
  };

  const timeControl = (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl px-2.5 h-9 transition-colors focus-within:ring-2 focus-within:ring-[var(--section-food)]/40",
        disabled && "pointer-events-none opacity-50",
        variant === "inline" && className,
      )}
      style={wrapperStyle}
    >
      <Clock
        className="h-3.5 w-3.5 shrink-0 mr-1"
        style={{ color: edited ? accentColor : "var(--text-faint)" }}
        aria-hidden="true"
      />

      <input
        ref={hourRef}
        type="text"
        inputMode="numeric"
        value={hourDisplay}
        onChange={handleHourChange}
        onKeyDown={handleHourKeyDown}
        onBlur={handleHourBlur}
        onFocus={(e) => e.target.select()}
        aria-label="Hours"
        maxLength={2}
        disabled={disabled}
        className={cn(
          "w-7 bg-transparent text-center text-sm font-semibold tabular-nums",
          "border-none outline-none",
          "caret-transparent",
        )}
        style={segmentStyle}
      />

      <span
        className="text-sm font-semibold select-none"
        style={{ color: edited ? accentColor : "var(--text-faint)" }}
        aria-hidden="true"
      >
        :
      </span>

      <input
        ref={minuteRef}
        type="text"
        inputMode="numeric"
        value={minuteDisplay}
        onChange={handleMinuteChange}
        onKeyDown={handleMinuteKeyDown}
        onBlur={handleMinuteBlur}
        onFocus={(e) => e.target.select()}
        aria-label="Minutes"
        maxLength={2}
        disabled={disabled}
        className={cn(
          "w-7 bg-transparent text-center text-sm font-semibold tabular-nums",
          "border-none outline-none",
          "caret-transparent",
        )}
        style={segmentStyle}
      />
    </div>
  );

  if (variant === "icon") {
    return (
      <TooltipProvider delayDuration={1000}>
        <Tooltip>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={label}
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors",
                    "text-(--text-faint) hover:bg-(--surface-2) hover:text-(--text-muted)",
                    disabled && "pointer-events-none opacity-50",
                    className,
                  )}
                  style={edited ? { color: accentColor } : undefined}
                >
                  <Clock className="h-5 w-5" aria-hidden="true" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Change time of entry</TooltipContent>
            <PopoverContent align="start" sideOffset={6} className="w-auto p-2">
              {timeControl}
            </PopoverContent>
          </Popover>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return timeControl;
}
