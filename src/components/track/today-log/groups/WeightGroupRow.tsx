import { format } from "date-fns";
import { ChevronDown, Weight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { kgToLbs, kgToStones } from "@/lib/formatWeight";
import type { DisplayWeightUnit } from "@/lib/units";
import { WeightSubRow } from "../editors";
import {
  logGroupChevronTransition,
  logGroupExpandTransition,
  logGroupExpandVariants,
} from "../motion";
import type { WeightGroup } from "../types";

interface WeightGroupRowProps {
  group: WeightGroup;
  weightUnit: DisplayWeightUnit;
  expanded: boolean;
  onToggle: () => void;
}

function formatDisplayWeight(kg: number, weightUnit: DisplayWeightUnit): string | null {
  if (!Number.isFinite(kg) || kg <= 0) return null;
  if (weightUnit === "lbs") return `${kgToLbs(kg).toFixed(1)} lbs`;
  if (weightUnit === "stones") return `${kgToStones(kg).toFixed(1)} st`;
  return `${kg.toFixed(1)} kg`;
}

export function WeightGroupRow({ group, weightUnit, expanded, onToggle }: WeightGroupRowProps) {
  const latest = group.entries[0];
  const kg = Number(latest?.data?.weightKg);
  const displayWeight = formatDisplayWeight(kg, weightUnit);

  return (
    <div className="group rounded-xl transition-colors hover:bg-[var(--section-log-muted)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
      >
        <Weight className="mt-0.5 h-4 w-4 flex-shrink-0 text-pink-500 dark:text-pink-400" />
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            Weigh-in
          </span>
          {latest && !expanded && (
            <p className="mt-0.5 font-mono text-xs text-[var(--color-text-tertiary)]">
              {format(latest.timestamp, "HH:mm")}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {displayWeight && (
            <span className="font-mono text-sm font-bold tabular-nums text-pink-500 dark:text-pink-400">
              {displayWeight}
            </span>
          )}
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
                <WeightSubRow key={entry.id} entry={entry} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
