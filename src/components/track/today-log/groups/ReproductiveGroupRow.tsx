import { format } from "date-fns";
import { ChevronDown, Venus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReproductiveSubRow } from "../editors";
import {
  getReproductiveBleedingLabel,
  getReproductiveDaysSincePeriodStart,
  getReproductiveStatTooltip,
  getReproductiveSymptoms,
  titleCaseToken,
  truncatePreviewText,
} from "../helpers";
import {
  logGroupChevronTransition,
  logGroupExpandTransition,
  logGroupExpandVariants,
} from "../motion";
import type { ReproductiveGroup } from "../types";

interface ReproductiveGroupRowProps {
  group: ReproductiveGroup;
  expanded: boolean;
  onToggle: () => void;
}

export function ReproductiveGroupRow({ group, expanded, onToggle }: ReproductiveGroupRowProps) {
  const latest = group.entries[0];
  const latestSymptoms = latest ? getReproductiveSymptoms(latest).map(titleCaseToken) : [];
  const latestSymptomsText = latestSymptoms.length > 0 ? latestSymptoms.join(", ") : "None";
  const latestBleeding = latest
    ? getReproductiveBleedingLabel(latest.data?.bleedingStatus)
    : "None";
  const statDays = latest ? getReproductiveDaysSincePeriodStart(latest) : null;
  const statTooltip = latest ? getReproductiveStatTooltip(latest) : null;

  return (
    <div className="group rounded-xl transition-colors hover:bg-[var(--section-log-muted)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
      >
        <Venus className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--section-summary)]" />
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            Reproductive Health
          </span>
          {latest && !expanded && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <p className="mt-0.5 truncate font-mono text-xs text-[var(--color-text-tertiary)]" />
                }
              >
                {truncatePreviewText(
                  `${format(latest.timestamp, "HH:mm")}  Bleeding: ${latestBleeding}  Symptoms: ${latestSymptomsText}`,
                  35,
                )}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[56ch] text-sm leading-snug">
                {format(latest.timestamp, "HH:mm")}
                {"  "}Bleeding: {latestBleeding}
                {"  "}Symptoms: {latestSymptomsText}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {statDays !== null && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="font-mono text-sm font-bold tabular-nums text-[var(--section-summary)]" />
                }
              >
                {statDays}d
              </TooltipTrigger>
              <TooltipContent>
                {statTooltip ?? `${statDays} days since period start`}
              </TooltipContent>
            </Tooltip>
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
                <ReproductiveSubRow key={entry.id} entry={entry} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
