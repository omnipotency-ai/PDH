import { format } from "date-fns";
import { ChevronDown, Loader2, Soup } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FoodSubRow } from "../editors";
import {
  countUnresolvedItems,
  getLogDetail,
  isFoodLogProcessing,
  truncatePreviewText,
} from "../helpers";
import {
  logGroupChevronTransition,
  logGroupExpandTransition,
  logGroupExpandVariants,
} from "../motion";
import type { FoodLogGroup } from "../types";

interface FoodGroupRowProps {
  group: FoodLogGroup;
  expanded: boolean;
  onToggle: () => void;
}

export function FoodGroupRow({ group, expanded, onToggle }: FoodGroupRowProps) {
  const latest = group.entries[0];
  const latestDetail = latest ? getLogDetail(latest) : null;
  const latestDetailPreview = latestDetail ? truncatePreviewText(latestDetail) : "";
  const count = group.entries.length;

  // Count unresolved items across all food entries in this group
  const { totalUnresolved, anyProcessing } = useMemo(() => {
    let unresolved = 0;
    let processing = false;
    for (const entry of group.entries) {
      unresolved += countUnresolvedItems(entry);
      if (isFoodLogProcessing(entry)) {
        processing = true;
      }
    }
    return { totalUnresolved: unresolved, anyProcessing: processing };
  }, [group.entries]);

  return (
    <div className="group rounded-xl transition-colors hover:bg-[var(--section-log-muted)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
      >
        <Soup className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--section-food)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              Food intake
            </span>
            {anyProcessing && (
              <Loader2 className="h-3 w-3 animate-spin text-[var(--section-food)] opacity-60" />
            )}
            {totalUnresolved > 0 && !anyProcessing && (
              <span
                role="img"
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-semibold text-amber-500"
                aria-label={`${totalUnresolved} unmatched item${totalUnresolved === 1 ? "" : "s"}`}
              >
                {totalUnresolved}
              </span>
            )}
          </div>
          {latest && !expanded && (
            <>
              <p className="mt-0.5 font-mono text-xs text-[var(--color-text-tertiary)]">
                {format(latest.timestamp, "HH:mm")}
              </p>
              {latestDetail && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <p className="mt-0.5 max-w-[26ch] line-clamp-2 break-words text-xs leading-snug text-[var(--color-text-tertiary)]" />
                    }
                  >
                    {latestDetailPreview}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[56ch] text-sm leading-snug">
                    {latestDetail}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="font-mono text-sm font-bold tabular-nums text-[var(--section-food)]">
            {count}
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
                <FoodSubRow key={entry.id} entry={entry} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
