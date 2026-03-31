import { AlertTriangle, Check, EllipsisVertical, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import { useLongPress } from "@/hooks/useLongPress";
import { getErrorMessage } from "@/lib/errors";
import { getHabitIcon } from "@/lib/habitIcons";
import {
  getProgressColor,
  getProgressText,
  type HabitProgressColor,
  shouldShowBadge,
} from "@/lib/habitProgress";
import type { HabitConfig } from "@/lib/habitTemplates";

// ── Tile color tint (mirrors QuickCaptureTile logic) ─────────────────────

type TileColorTint = "default" | "emerald" | "orange" | "muted" | "red";

const TINT_BY_PROGRESS_COLOR: Record<HabitProgressColor, TileColorTint> = {
  neutral: "default",
  "target-in-progress": "default",
  "target-met": "emerald",
  "cap-clear": "default",
  "cap-under": "default",
  "cap-warning": "orange",
  "cap-at": "muted",
  "cap-over": "red",
};

const TINT_CLASSES: Record<TileColorTint, string> = {
  default: "bg-[var(--surface-2)] border-[var(--color-border-default)]",
  emerald:
    "bg-[rgba(52,211,153,0.12)] border-[rgba(52,211,153,0.35)] dark:bg-[rgba(52,211,153,0.12)] dark:border-[rgba(52,211,153,0.35)]",
  orange:
    "bg-[rgba(251,146,60,0.12)] border-[rgba(251,146,60,0.35)] dark:bg-[rgba(251,146,60,0.12)] dark:border-[rgba(251,146,60,0.35)]",
  muted: "bg-[var(--surface-3)] border-[var(--color-border-default)] opacity-60",
  red: "bg-[rgba(248,113,113,0.12)] border-[rgba(248,113,113,0.35)] dark:bg-[rgba(248,113,113,0.12)] dark:border-[rgba(248,113,113,0.35)]",
};

// ── Types ────────────────────────────────────────────────────────────────

type DurationMode = "minutes" | "hours-minutes";

interface DurationEntryPopoverProps {
  habit: HabitConfig;
  count: number;
  mode: DurationMode;
  /** Called with value in minutes for "minutes" mode, or decimal hours for "hours-minutes" mode. */
  onSubmit: (habit: HabitConfig, value: number) => Promise<void>;
  onLongPress: () => void;
  onHide?: () => void;
  popoverTitle: string;
  popoverDescription: string;
}

// ── Component ────────────────────────────────────────────────────────────

export function DurationEntryPopover({
  habit,
  count,
  mode,
  onSubmit,
  onLongPress,
  onHide,
  popoverTitle,
  popoverDescription,
}: DurationEntryPopoverProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // For "minutes" mode: single minutes input
  const [minutesDraft, setMinutesDraft] = useState("");

  // For "hours-minutes" mode: separate hours and minutes
  const [hoursDraft, setHoursDraft] = useState("");
  const [minsDraft, setMinsDraft] = useState("");

  const progressText = getProgressText(habit, count, undefined, "tile");
  const progressColor = getProgressColor(habit, count, undefined);
  const tint = TINT_BY_PROGRESS_COLOR[progressColor];
  const tintClass = TINT_CLASSES[tint];
  const badge = shouldShowBadge(habit, count, undefined);
  const { Icon, toneClassName } = getHabitIcon(habit);

  const openPopover = () => {
    if (mode === "minutes") {
      setMinutesDraft(String(habit.quickIncrement));
    } else {
      const defaultHours = Math.floor(habit.quickIncrement);
      const defaultMins = Math.round((habit.quickIncrement % 1) * 60);
      setHoursDraft(String(defaultHours));
      setMinsDraft(String(defaultMins));
    }
    setSaving(false);
    setOpen(true);
  };

  const longPressHandlers = useLongPress({
    onTap: openPopover,
    onLongPress,
  });

  const submit = async () => {
    if (mode === "minutes") {
      const parsed = Math.round(Number(minutesDraft));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error("Enter a valid duration in minutes.");
        return;
      }
      try {
        setSaving(true);
        await onSubmit(habit, parsed);
        setOpen(false);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to log."));
      } finally {
        setSaving(false);
      }
    } else {
      const hours = Number(hoursDraft) || 0;
      const mins = Number(minsDraft) || 0;
      const totalMinutes = hours * 60 + mins;
      if (totalMinutes <= 0) {
        toast.error("Enter a duration greater than 0.");
        return;
      }
      const decimalHours = totalMinutes / 60;
      try {
        setSaving(true);
        await onSubmit(habit, decimalHours);
        setOpen(false);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, "Failed to log."));
      } finally {
        setSaving(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div data-slot="quick-capture-tile" className="group relative">
          {onHide && (
            <button
              type="button"
              className="absolute -top-1.5 -right-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border-default)] bg-[var(--surface-3)] text-[var(--text-faint)] shadow-sm opacity-0 transition-opacity hover:bg-[var(--surface-0)] hover:text-[var(--text)] group-hover:opacity-100 group-focus-within:opacity-100"
              aria-label={`Hide ${habit.name} from Quick Capture`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onHide();
              }}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}

          {/* Desktop-only 3-dot menu button for detail sheet access */}
          <button
            type="button"
            className="absolute top-1 right-1 z-10 hidden h-6 w-6 items-center justify-center rounded-full text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-muted)] xl:flex"
            aria-label={`${habit.name} details`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onLongPress();
            }}
          >
            <EllipsisVertical className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            {...longPressHandlers}
            className={`relative flex min-h-11 w-full items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition-all select-none active:scale-95 hover:border-transparent hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40 ${tintClass}`}
            aria-label={`${habit.name}: ${progressText}`}
          >
            {badge === "warning" && (
              <span className="animate-badge-pop-in absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
                <AlertTriangle className="h-3.5 w-3.5 text-white" />
              </span>
            )}

            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-3)]"
              aria-hidden="true"
            >
              <Icon className={`h-4.5 w-4.5 ${toneClassName}`} />
            </span>

            <div className="min-w-0 flex flex-1 items-center gap-2">
              <div className="min-w-0 flex flex-1 flex-col justify-center gap-0.5">
                <span className={`block font-mono text-xs font-bold tabular-nums ${toneClassName}`}>
                  {progressText}
                </span>
                <span className="block truncate text-[11px] leading-tight font-semibold text-[var(--text-muted)]">
                  {habit.name}
                </span>
              </div>
            </div>

            {/* Target-met badge — bottom-right of tile */}
            {badge === "check" && (
              <span
                aria-hidden="true"
                className="animate-badge-pop-in absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500 text-white"
              >
                <Check className="h-3 w-3" />
              </span>
            )}
          </button>
        </div>
      </PopoverAnchor>

      <PopoverContent align="center" sideOffset={8} className="w-[240px] space-y-2 p-3">
        <PopoverHeader>
          <PopoverTitle>{popoverTitle}</PopoverTitle>
          <PopoverDescription>{popoverDescription}</PopoverDescription>
        </PopoverHeader>

        {mode === "minutes" ? (
          <div className="space-y-1">
            <Label htmlFor="duration-popover-minutes">Minutes</Label>
            <Input
              id="duration-popover-minutes"
              inputMode="numeric"
              value={minutesDraft}
              onChange={(e) => setMinutesDraft(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={handleKeyDown}
              autoFocus
              className="h-11 text-center font-mono text-lg"
              placeholder="e.g. 30"
              disabled={saving}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="duration-popover-hours">Hours</Label>
              <Input
                id="duration-popover-hours"
                inputMode="numeric"
                value={hoursDraft}
                onChange={(e) => setHoursDraft(e.target.value.replace(/[^\d]/g, ""))}
                onKeyDown={handleKeyDown}
                autoFocus
                className="h-11 text-center font-mono text-lg"
                placeholder="0"
                disabled={saving}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="duration-popover-mins">Minutes</Label>
              <Input
                id="duration-popover-mins"
                inputMode="numeric"
                value={minsDraft}
                onChange={(e) => setMinsDraft(e.target.value.replace(/[^\d]/g, ""))}
                onKeyDown={handleKeyDown}
                className="h-11 text-center font-mono text-lg"
                placeholder="0"
                disabled={saving}
              />
            </div>
          </div>
        )}

        {saving && <p className="text-center text-xs text-[var(--text-muted)]">Saving...</p>}
      </PopoverContent>
    </Popover>
  );
}
