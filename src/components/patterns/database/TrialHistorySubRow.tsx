import { useState } from "react";
import { bristolColor } from "@/components/patterns/database/foodSafetyUtils";
import type { LocalTrialRecord } from "@/lib/analysis";
import { digestionBadgeClassName, getFoodDigestionBadges } from "@/lib/foodDigestionMetadata";
import { formatShortDate, formatTransitHours } from "@/lib/trialFormatters";
import type { FoodDatabaseRow } from "./columns";

const INITIAL_DISPLAY_COUNT = 10;

// ── Props ────────────────────────────────────────────────────────────────────

export interface TrialHistorySubRowProps {
  row: FoodDatabaseRow;
}

// ── Outcome color mapping ───────────────────────────────────────────────────

function outcomeColor(outcome: LocalTrialRecord["outcome"]): string {
  switch (outcome) {
    case "good":
      return "var(--section-observe)";
    case "loose":
    case "hard":
      return "var(--section-quick)";
    case "bad":
      return "var(--section-food)";
  }
}

function outcomeLabel(outcome: LocalTrialRecord["outcome"]): string {
  switch (outcome) {
    case "good":
      return "\u2713 good";
    case "loose":
      return "\u25CB loose";
    case "hard":
      return "\u25CB hard";
    case "bad":
      return "\u2717 bad";
  }
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Displays per-food trial history from local client-side analysis.
 *
 * Limitation: the local correlation algorithm resolves ALL unresolved food
 * trials against each bowel event. This means a single bowel event may be
 * attributed to multiple foods eaten in the same window. A future improvement
 * could show a "shared with N other foods" indicator per trial row, but that
 * requires cross-food resolution data not currently passed to this component.
 */
export function TrialHistorySubRow({ row }: TrialHistorySubRowProps) {
  const localTrials = row.resolvedTrials;
  const [showAll, setShowAll] = useState(false);

  if (localTrials === undefined || localTrials.length === 0) {
    return (
      <div
        data-slot="trial-history-empty"
        className="border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-6 py-4"
      >
        <p className="font-mono text-xs text-[var(--text-muted)]">No trial history yet</p>
      </div>
    );
  }

  const digestionBadges = getFoodDigestionBadges(row.digestion);
  const hasMore = localTrials.length > INITIAL_DISPLAY_COUNT;
  const visibleTrials = showAll ? localTrials : localTrials.slice(0, INITIAL_DISPLAY_COUNT);
  const hiddenCount = localTrials.length - INITIAL_DISPLAY_COUNT;

  return (
    <div
      data-slot="trial-history-sub-row"
      className="border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-6 py-3"
    >
      {(row.registryNotes !== undefined || digestionBadges.length > 0) && (
        <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)]/80 p-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
            Registry Profile
          </p>
          {row.registryNotes !== undefined && (
            <p className="mb-2 text-sm leading-6 text-[var(--text-muted)]">{row.registryNotes}</p>
          )}
          {digestionBadges.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {digestionBadges.map((badge) => (
                <span key={badge.key} className={digestionBadgeClassName(badge.tone)}>
                  {badge.label}: {badge.value}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <ul data-slot="trial-history-list" className="flex flex-col gap-1.5">
        {visibleTrials.map((record) => (
          <LocalTrialEntry key={record.id} record={record} />
        ))}
      </ul>

      {hasMore && !showAll && (
        <button
          data-slot="trial-history-show-all"
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 font-mono text-xs text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-slate-200"
        >
          Show all {localTrials.length} trials (+{hiddenCount} more)
        </button>
      )}
    </div>
  );
}

// ── Local Trial Entry (from client analysis) ─────────────────────────────────

function LocalTrialEntry({ record }: { record: LocalTrialRecord }) {
  const dateLabel = formatShortDate(record.foodTimestamp);
  const hasQuantity = record.quantity !== undefined && record.unit !== undefined;

  return (
    <li
      data-slot="trial-entry"
      // Fixed-width grid; may need responsive adjustments for narrow viewports
      className="grid grid-cols-[5rem_6rem_6rem_5rem_auto] items-center gap-2 font-mono text-xs"
    >
      <span className="text-[var(--text-muted)]">{dateLabel}</span>

      {record.bristolCode !== null ? (
        <span className="font-semibold" style={{ color: bristolColor(record.bristolCode) }}>
          Bristol {record.bristolCode}
        </span>
      ) : (
        <span className="text-[var(--text-faint)]">&mdash;</span>
      )}

      <span className="text-[var(--text-muted)]">
        Transit {formatTransitHours(record.transitMinutes)}
      </span>

      <span className="font-semibold" style={{ color: outcomeColor(record.outcome) }}>
        {outcomeLabel(record.outcome)}
      </span>

      <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
        {/*
         * foodName comes from the food log entry's parsedName field.
         * It may be absent for legacy entries logged before parsedName was
         * introduced. Show a faded placeholder rather than leaving blank space.
         */}
        {record.foodName !== undefined ? (
          <span data-slot="trial-food-name" className="truncate">
            {record.foodName}
          </span>
        ) : (
          <span data-slot="trial-food-name-missing" className="truncate opacity-40">
            Food name not recorded
          </span>
        )}
        {hasQuantity && (
          <span data-slot="trial-quantity" className="shrink-0 text-[var(--text-faint)]">
            {record.quantity} {record.unit}
          </span>
        )}
      </span>
    </li>
  );
}
