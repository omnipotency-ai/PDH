import { format } from "date-fns";
import { Activity, ChevronDown, Footprints, Moon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { SyncedLog } from "@/lib/sync";
import { ActivitySubRow } from "../editors";
import { formatDuration, getActivityEntryDurationMinutes, getActivityLabel } from "../helpers";
import {
  logGroupChevronTransition,
  logGroupExpandTransition,
  logGroupExpandVariants,
} from "../motion";
import type { ActivityGroup, SleepGroup } from "../types";

interface ActivityGroupRowProps {
  group: ActivityGroup | SleepGroup;
  expanded: boolean;
  onToggle: () => void;
}

function getActivityType(entry: SyncedLog): string {
  const raw = String(entry.type === "activity" ? entry.data?.activityType : "")
    .trim()
    .toLowerCase();
  return raw || "activity";
}

function getActivityIcon(typeKey: string) {
  if (typeKey === "walk") return Footprints;
  if (typeKey === "sleep") return Moon;
  return Activity;
}

function formatTotalDuration(minutes: number): string {
  if (minutes <= 0) return "0";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function ActivityGroupRow({ group, expanded, onToggle }: ActivityGroupRowProps) {
  const latest = group.entries[0];
  const latestType = latest ? getActivityType(latest) : "activity";
  const latestLabel = getActivityLabel(latestType);
  const Icon = getActivityIcon(latestType);
  const iconColor =
    latestType === "sleep"
      ? "text-indigo-600 dark:text-indigo-400"
      : "text-teal-600 dark:text-teal-400";
  const badgeColor = iconColor;
  const latestDuration = latest ? getActivityEntryDurationMinutes(latest) : null;

  const totalDurationMinutes = group.entries.reduce((sum, e) => {
    const d = getActivityEntryDurationMinutes(e);
    return sum + (d ?? 0);
  }, 0);
  const badgeText = formatTotalDuration(totalDurationMinutes);
  const isSleepOnlyGroup = group.entries.every((e) => getActivityType(e) === "sleep");
  const groupTitle = isSleepOnlyGroup ? "Sleep" : "Activity";

  return (
    <div className="group rounded-xl transition-colors hover:bg-[var(--section-log-muted)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-3 px-3 py-2.5 text-left"
      >
        <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${iconColor}`} />
        <div className="min-w-0 flex-1">
          <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {groupTitle}
          </span>
          {latest && !expanded && (
            <p className="mt-0.5 font-mono text-xs text-[var(--color-text-tertiary)]">
              {format(latest.timestamp, "HH:mm")}
              {`  ${latestLabel}`}
              {latestDuration !== null && Number.isFinite(latestDuration) && latestDuration > 0
                ? `  ${formatDuration(latestDuration, latestType)}`
                : ""}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className={`font-mono text-sm font-bold tabular-nums ${badgeColor}`}>
            {badgeText}
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
              {group.entries.map((entry) => {
                const typeKey = getActivityType(entry);
                return (
                  <ActivitySubRow
                    key={entry.id}
                    entry={entry}
                    activityType={typeKey}
                    showLabel={!isSleepOnlyGroup}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
