import { format } from "date-fns";
import { Activity, Check, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getErrorMessage } from "@/lib/errors";
import { getHabitIcon } from "@/lib/habitIcons";
import type { HabitConfig } from "@/lib/habitTemplates";
import { HabitSubRow } from "../editors";
import {
  logGroupChevronTransition,
  logGroupExpandTransition,
  logGroupExpandVariants,
} from "../motion";
import type { CounterHabitGroup, EventHabitGroup } from "../types";

// ── Grouped row: CounterHabitRow ──────────────────────────────────────

interface CounterHabitRowProps {
  group: CounterHabitGroup;
  habits: HabitConfig[];
  expanded: boolean;
  onToggle: () => void;
}

export function CounterHabitRow({ group, habits, expanded, onToggle }: CounterHabitRowProps) {
  const firstEntry = group.entries[0];
  const firstHabitData = firstEntry?.type === "habit" ? firstEntry.data : null;
  const habitConfig = habits.find(
    (h) => h.id === group.groupKey || h.name === firstHabitData?.name,
  );
  const { Icon, toneClassName } = habitConfig
    ? getHabitIcon(habitConfig)
    : { Icon: Activity, toneClassName: "text-amber-400" };
  const label = habitConfig?.name ?? firstHabitData?.name ?? "Habit";
  const latest = group.entries[0];

  return (
    <div className="group rounded-xl transition-colors hover:bg-[var(--section-log-muted)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
      >
        <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${toneClassName}`} />
        <div className="min-w-0 flex-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]" />
              }
            >
              {label}
            </TooltipTrigger>
            <TooltipContent side="top" className="text-sm">
              {label}
            </TooltipContent>
          </Tooltip>
          {latest && !expanded && (
            <p className="mt-0.5 font-mono text-xs text-[var(--color-text-tertiary)]">
              {format(latest.timestamp, "HH:mm")}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className={`font-mono text-sm font-bold tabular-nums ${toneClassName}`}>
            {group.entries.length}
          </span>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={logGroupChevronTransition}
          >
            <ChevronDown className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={logGroupExpandVariants}
            transition={logGroupExpandTransition}
            className="overflow-hidden"
          >
            <div className="ml-[2.75rem] space-y-1 pb-2 pr-3">
              {group.entries.map((entry) => (
                <HabitSubRow key={entry.id} entry={entry} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Grouped row: EventHabitRow ────────────────────────────────────────

interface EventHabitRowProps {
  group: EventHabitGroup;
  habits: HabitConfig[];
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => Promise<void>;
}

export function EventHabitRow({ group, habits, expanded, onToggle, onDelete }: EventHabitRowProps) {
  const firstEntry = group.entries[0];
  const firstHabitData = firstEntry?.type === "habit" ? firstEntry.data : null;
  const habitConfig = habits.find(
    (h) => h.id === group.groupKey || h.name === firstHabitData?.name,
  );
  const { Icon, toneClassName } = habitConfig
    ? getHabitIcon(habitConfig)
    : { Icon: Activity, toneClassName: "text-amber-400" };
  const label = habitConfig?.name ?? firstHabitData?.name ?? "Habit";
  const latest = group.entries[0];
  const uncheckAccentClass = "bg-emerald-500 hover:bg-emerald-400";
  const [unchecking, setUnchecking] = useState(false);

  const handleUncheckAll = async () => {
    setUnchecking(true);
    try {
      const results = await Promise.allSettled(group.entries.map((entry) => onDelete(entry.id)));
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        const msg =
          failures.length === results.length
            ? "Failed to uncheck all entries."
            : `Failed to uncheck ${failures.length} of ${results.length} entries.`;
        toast.error(msg);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to uncheck entries."));
    } finally {
      setUnchecking(false);
    }
  };

  return (
    <div className="group relative rounded-xl transition-colors hover:bg-[var(--section-log-muted)]">
      <div className="flex items-start">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left"
        >
          <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${toneClassName}`} />
          <div className="min-w-0 flex-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]" />
                }
              >
                {label}
              </TooltipTrigger>
              <TooltipContent side="top" className="text-sm">
                {label}
              </TooltipContent>
            </Tooltip>
            {latest && !expanded && (
              <p className="mt-0.5 font-mono text-xs text-[var(--color-text-tertiary)]">
                {format(latest.timestamp, "HH:mm")}
              </p>
            )}
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={logGroupChevronTransition}
          >
            <ChevronDown className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          </motion.div>
        </button>
        <button
          type="button"
          onClick={handleUncheckAll}
          disabled={unchecking}
          className={`mr-3 mt-2.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-colors disabled:opacity-50 ${uncheckAccentClass}`}
          aria-label={`Uncheck ${label}`}
        >
          <Check className="h-3 w-3" />
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={logGroupExpandVariants}
            transition={logGroupExpandTransition}
            className="overflow-hidden"
          >
            <div className="ml-[2.75rem] space-y-1 pb-2 pr-3">
              {group.entries.map((entry) => (
                <HabitSubRow key={entry.id} entry={entry} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
