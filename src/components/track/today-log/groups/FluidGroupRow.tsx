import { format } from "date-fns";
import { ChevronDown, Droplets } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FluidSubRow } from "../editors";
import { truncatePreviewText } from "../helpers";
import {
  logGroupChevronTransition,
  logGroupExpandTransition,
  logGroupExpandVariants,
} from "../motion";
import type { FluidGroup } from "../types";

interface FluidGroupRowProps {
  group: FluidGroup;
  expanded: boolean;
  onToggle: () => void;
}

export function FluidGroupRow({ group, expanded, onToggle }: FluidGroupRowProps) {
  const latest = group.entries[0];
  const latestName = latest ? String(latest.data.items[0]?.name ?? "").trim() || "Fluid" : "Fluid";
  const latestQty = latest ? Number(latest.data.items[0]?.quantity) : 0;
  const latestUnit = latest ? String(latest.data.items[0]?.unit ?? "").trim() : "";
  const totalL = (group.totalMl / 1000).toFixed(1);

  return (
    <div className="group rounded-xl transition-colors hover:bg-[var(--section-log-muted)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
      >
        <Droplets className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600 dark:text-sky-400" />
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            Fluids
          </span>
          {latest && !expanded && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <p className="mt-0.5 truncate font-mono text-xs text-[var(--color-text-tertiary)]" />
                }
              >
                {truncatePreviewText(
                  `${format(latest.timestamp, "HH:mm")}  ${latestName}  ${
                    Number.isFinite(latestQty) && latestQty > 0 ? `${latestQty}${latestUnit}` : ""
                  }`,
                )}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[56ch] text-sm leading-snug">
                {format(latest.timestamp, "HH:mm")}
                {"  "}
                {latestName}
                {"  "}
                {Number.isFinite(latestQty) && latestQty > 0 ? `${latestQty}${latestUnit}` : ""}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="font-mono text-sm font-bold tabular-nums text-sky-600 dark:text-sky-400">
            {totalL}L
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
                <FluidSubRow key={entry.id} entry={entry} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
