import { AlertTriangle, Check, EllipsisVertical, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLongPress } from "@/hooks/useLongPress";
import { getHabitIcon } from "@/lib/habitIcons";
import { getProgressColor, getProgressText, shouldShowBadge } from "@/lib/habitProgress";
import { type HabitConfig, isCheckboxHabit } from "@/lib/habitTemplates";
import type { UnitSystem } from "@/lib/units";
import { TINT_BY_PROGRESS_COLOR, TINT_CLASSES } from "./constants";

// --- Props ---

export interface QuickCaptureTileProps {
  habit: HabitConfig;
  count: number;
  fluidTotalMl?: number;
  unitSystem?: UnitSystem;
  onTap: () => void;
  onLongPress: () => void;
  onHide?: () => void;
}

// --- Component ---

export function QuickCaptureTile({
  habit,
  count,
  fluidTotalMl,
  unitSystem = "metric",
  onTap,
  onLongPress,
  onHide,
}: QuickCaptureTileProps) {
  const longPressHandlers = useLongPress({ onTap, onLongPress });
  const [outgoingText, setOutgoingText] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const previousProgressTextRef = useRef<string>("");

  const progressText = getProgressText(habit, count, fluidTotalMl, "tile", unitSystem);
  const progressColor = getProgressColor(habit, count, fluidTotalMl);
  const tint = TINT_BY_PROGRESS_COLOR[progressColor];
  const tintClass = TINT_CLASSES[tint];
  const isCheckboxTile = isCheckboxHabit(habit);
  const isCheckboxDone = isCheckboxTile && count > 0;
  const badge = isCheckboxTile ? null : shouldShowBadge(habit, count, fluidTotalMl);
  const { Icon, toneClassName } = getHabitIcon(habit);
  useEffect(() => {
    if (isCheckboxTile) return;
    if (!previousProgressTextRef.current) {
      previousProgressTextRef.current = progressText;
      return;
    }
    if (progressText === previousProgressTextRef.current) return;
    setOutgoingText(previousProgressTextRef.current);
    setAnimating(true);
    previousProgressTextRef.current = progressText;
    const timeout = setTimeout(() => {
      setAnimating(false);
      setOutgoingText(null);
    }, 250);
    return () => clearTimeout(timeout);
  }, [isCheckboxTile, progressText]);

  return (
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
        className="absolute top-1 right-1 z-10 hidden h-6 w-6 items-center justify-center rounded-full text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-muted)] md:flex"
        aria-label={`${habit.name} details`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onLongPress();
        }}
      >
        <EllipsisVertical className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <button
        type="button"
        {...longPressHandlers}
        className={`relative flex min-h-11 w-full items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition-all select-none active:scale-95 hover:border-transparent hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40 ${tintClass}`}
        aria-label={
          isCheckboxTile
            ? `${habit.name}: ${isCheckboxDone ? "Done" : "Not done"}`
            : `${habit.name}: ${progressText}`
        }
      >
        {/* Warning badge — bottom-right of tile */}
        {badge === "warning" && (
          <span
            className="animate-badge-pop-in absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border-default)] bg-[var(--surface-2)]"
            aria-hidden="true"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" strokeWidth={2.5} />
          </span>
        )}

        {/* Habit icon */}
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-3)]"
          aria-hidden="true"
        >
          <Icon className={`h-4.5 w-4.5 ${toneClassName}`} />
        </span>

        {isCheckboxTile ? (
          <div className="min-w-0 flex flex-1 flex-col justify-center gap-0.5">
            <span
              className={`block truncate text-[11px] leading-tight font-semibold ${toneClassName}`}
            >
              {isCheckboxDone ? "Done" : "To Do"}
            </span>
            <span className="block truncate text-[11px] leading-tight font-semibold text-[var(--text-muted)]">
              {habit.name}
            </span>
          </div>
        ) : (
          <div className="min-w-0 flex flex-1 flex-col justify-center gap-0.5">
            <div className="relative h-4 min-w-0 overflow-hidden" aria-live="polite">
              {outgoingText !== null && animating && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 block font-mono text-xs font-bold tabular-nums ${toneClassName} animate-counter-slide-out`}
                >
                  {outgoingText}
                </span>
              )}
              <span
                className={`block font-mono text-xs font-bold tabular-nums ${toneClassName} ${
                  animating ? "animate-counter-slide-in" : ""
                }`}
              >
                {progressText}
              </span>
            </div>
            <span className="block truncate text-[11px] leading-tight font-semibold text-[var(--text-muted)]">
              {habit.name}
            </span>
          </div>
        )}

        {/* Checkbox done indicator — bottom-right of tile */}
        {isCheckboxTile && (
          <span
            aria-hidden="true"
            className={`absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
              isCheckboxDone
                ? "border-emerald-500 bg-[var(--surface-2)] text-emerald-500"
                : "border-[var(--color-border-default)] bg-transparent text-transparent"
            }`}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}

        {/* Target-met celebration badge — under the 3-dot menu */}
        {badge === "check" && (
          <span
            aria-hidden="true"
            className="animate-badge-pop-in absolute top-7 right-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-500 bg-[var(--surface-2)] text-emerald-500"
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </button>
    </div>
  );
}
