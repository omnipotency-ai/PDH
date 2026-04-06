import { format } from "date-fns";
import { AlertCircle, Check, CircleDashed, FileText, Loader2, Trash2, X } from "lucide-react";
import { lazy, Suspense, useCallback, useState } from "react";
import { RawInputEditModal } from "@/components/track/RawInputEditModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getItemMacros } from "@/lib/nutritionUtils";
import type { FoodItem, FoodLogData } from "@/types/domain";
import {
  getDefaultPortionHint,
  getFoodItemDisplayName,
  getFoodItemResolutionStatus,
  getLogDetail,
  isFoodLogProcessing,
  truncatePreviewText,
} from "../helpers";
import { useTodayLogActions } from "../TodayLogContext";
import type { DraftItem, FoodPipelineLog, LogUpdateData } from "../types";
import { EditableEntryRow } from "./EditableEntryRow";

// Lazy-loaded so that foodRegistry.ts (2858 lines of static data) is code-split
// into a separate chunk and not bundled into the initial JS payload.
const FoodMatchingModal = lazy(() =>
  import("@/components/track/FoodMatchingModal").then((m) => ({
    default: m.FoodMatchingModal,
  })),
);

// ── Resolution status indicator ──────────────────────────────────────────

function ResolutionDot({ item, onTapToMatch }: { item: FoodItem; onTapToMatch?: () => void }) {
  const status = getFoodItemResolutionStatus(item);

  if (status === "resolved") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              role="img"
              data-slot="resolution-dot"
              className="inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20"
              aria-label="Matched"
            />
          }
        >
          <Check className="h-2 w-2 text-emerald-500" />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Matched: {item.canonicalName}
          {item.resolvedBy ? ` (${item.resolvedBy})` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "expired") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              role="img"
              data-slot="resolution-dot"
              className="inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-yellow-500/20"
              aria-label="Not matched"
            />
          }
        >
          <AlertCircle className="h-2 w-2 text-yellow-500" />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Not matched — edit the log to fix this
        </TooltipContent>
      </Tooltip>
    );
  }

  // pending
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-slot="resolution-dot"
            className="inline-flex h-3.5 w-3.5 flex-shrink-0 cursor-pointer items-center justify-center rounded-full bg-amber-500/20"
            aria-label="Pending — tap to match"
            onClick={onTapToMatch}
          />
        }
      >
        <CircleDashed className="h-2 w-2 text-amber-500" />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Pending — tap to match
      </TooltipContent>
    </Tooltip>
  );
}

// ── Meal slot badge ─────────────────────────────────────────────────────

const MEAL_SLOT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  breakfast: {
    bg: "bg-amber-500/15",
    text: "text-amber-600 dark:text-amber-400",
    label: "Breakfast",
  },
  lunch: {
    bg: "bg-sky-500/15",
    text: "text-sky-600 dark:text-sky-400",
    label: "Lunch",
  },
  dinner: {
    bg: "bg-violet-500/15",
    text: "text-violet-600 dark:text-violet-400",
    label: "Dinner",
  },
  snack: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "Snack",
  },
};

function MealSlotBadge({ slot }: { slot: string }) {
  const style = MEAL_SLOT_STYLES[slot];
  if (!style) return null;

  return (
    <span
      data-slot="meal-slot-badge"
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

// ── Portion + calorie display for a single item ────────────────────────

function ItemPortionCalorie({ item }: { item: FoodItem }) {
  const macros = getItemMacros(item);

  // Build portion text: "200g" or "250ml" or default portion hint
  const portionText = buildPortionText(item, macros.portionG);
  const calorieText = macros.calories > 0 ? `${macros.calories} kcal` : null;

  if (!portionText && !calorieText) return null;

  return (
    <span
      data-slot="item-portion-calorie"
      className="ml-auto flex flex-shrink-0 items-center gap-1 text-[10px] text-[var(--color-text-tertiary)] opacity-60"
    >
      {portionText && <span>{portionText}</span>}
      {portionText && calorieText && <span className="opacity-40">&middot;</span>}
      {calorieText && <span>{calorieText}</span>}
    </span>
  );
}

/** Build a human-readable portion string from item data. */
function buildPortionText(item: FoodItem, effectivePortionG: number): string | null {
  const unit = String(item.unit ?? "")
    .trim()
    .toLowerCase();
  const qty = item.quantity;

  // Explicit quantity + unit from the item
  if (qty != null && Number.isFinite(qty) && qty > 0) {
    if (unit === "ml" || unit === "l") {
      const mlValue = unit === "l" ? qty * 1000 : qty;
      return `${Math.round(mlValue)}ml`;
    }
    if (unit === "g" || unit === "kg") {
      const gValue = unit === "kg" ? qty * 1000 : qty;
      return `${Math.round(gValue)}g`;
    }
    // Has quantity but non-standard unit (e.g., "slices", "cups") — show as-is
    if (unit) {
      return `${qty}${unit}`;
    }
    // Quantity without unit — show as grams (the default assumption)
    return `${Math.round(qty)}g`;
  }

  // Fall back to default portion hint
  const hint = getDefaultPortionHint(item);
  if (hint) return hint;

  // Fall back to effective portion from registry lookup
  if (effectivePortionG > 0) {
    return `~${Math.round(effectivePortionG)}g`;
  }

  return null;
}

// ── Single food item line ────────────────────────────────────────────────

function FoodItemLine({ item, onTapToMatch }: { item: FoodItem; onTapToMatch?: () => void }) {
  const displayName = getFoodItemDisplayName(item);
  const status = getFoodItemResolutionStatus(item);

  const canonicalName = item.canonicalName ?? null;
  // Compare against the bare food name (without quantity/unit) to avoid
  // redundant brackets like "toast (toast)" when canonical matches the name.
  const bareName = String(item.parsedName ?? item.name ?? "")
    .trim()
    .toLowerCase();
  const showCanonicalInline =
    status === "resolved" && canonicalName !== null && canonicalName.toLowerCase() !== bareName;

  const textColorClass =
    status === "expired"
      ? "text-[var(--color-text-tertiary)] opacity-60"
      : "text-[var(--color-text-tertiary)]";

  return (
    <div className="flex items-center gap-1.5">
      <ResolutionDot item={item} {...(onTapToMatch !== undefined && { onTapToMatch })} />
      <span className={`min-w-0 truncate text-xs ${textColorClass}`}>
        {displayName}
        {showCanonicalInline && (
          <span className="ml-1 text-[10px] text-emerald-500/70">({canonicalName})</span>
        )}
      </span>
      <ItemPortionCalorie item={item} />
    </div>
  );
}

// ── Processing state (rawInput present but items not yet populated) ──────

function FoodProcessingView({ entry }: { entry: FoodPipelineLog }) {
  const { onDelete } = useTodayLogActions();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rawInputModalOpen, setRawInputModalOpen] = useState(false);

  return (
    <div className="group/entry flex items-start justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--section-log-muted)]">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-[var(--color-text-tertiary)]">
          {format(entry.timestamp, "HH:mm")}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin text-[var(--section-food)] opacity-60" />
          <p className="truncate text-xs text-[var(--color-text-tertiary)] italic">
            {truncatePreviewText(entry.data.rawInput)}
          </p>
        </div>
        <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)] opacity-50">
          Processing...
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/entry:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setRawInputModalOpen(true)}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:text-blue-400"
          aria-label="Edit raw text"
        >
          <FileText className="h-3 w-3" />
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-1 text-xs">
            <span className="text-[var(--color-text-tertiary)]">Sure?</span>
            <button
              type="button"
              onClick={async () => {
                await onDelete(entry.id);
                setConfirmDelete(false);
              }}
              className="rounded px-1 text-red-400 hover:text-red-300"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded px-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:text-red-400"
            aria-label="Delete entry"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <RawInputEditModal
        open={rawInputModalOpen}
        onOpenChange={setRawInputModalOpen}
        logId={entry.id}
        currentRawInput={entry.data.rawInput ?? ""}
        logTimestamp={entry.timestamp}
        {...(entry.data.notes !== undefined && {
          currentNotes: entry.data.notes,
        })}
      />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export function FoodSubRow({ entry }: { key?: string | number; entry: FoodPipelineLog }) {
  const [rawInputModalOpen, setRawInputModalOpen] = useState(false);
  const [matchingItemIndex, setMatchingItemIndex] = useState<number | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const isProcessing = isFoodLogProcessing(entry);
  const detail = getLogDetail(entry);

  const initDraftItems = useCallback((): DraftItem[] => {
    const items = entry.data.items;
    return items.map((item) => ({
      id: crypto.randomUUID(),
      name: String(item?.parsedName ?? item?.name ?? item?.rawName ?? item?.userSegment ?? ""),
      quantity:
        item?.quantity != null && Number.isFinite(Number(item.quantity))
          ? String(item.quantity)
          : "",
      unit: String(item?.unit ?? ""),
    }));
  }, [entry.data.items]);

  const onStartEditing = useCallback(() => {
    setDraftItems(initDraftItems());
  }, [initDraftItems]);

  const buildSaveData = useCallback((): LogUpdateData => {
    const originalItems = entry.data.items;
    const nextItems = draftItems
      .filter((d) => d.name.trim())
      .map((draft, i) => {
        const original = originalItems[i];
        const originalName = String(
          original?.parsedName ??
            original?.name ??
            original?.rawName ??
            original?.userSegment ??
            "",
        ).trim();
        const draftName = draft.name.trim();
        const nameChanged = draftName.toLowerCase() !== originalName.toLowerCase();
        return {
          ...(original ?? {}),
          parsedName: draftName,
          userSegment: [draft.quantity || null, draft.unit.trim() || null, draftName]
            .filter(Boolean)
            .join(" "),
          ...(nameChanged && { resolvedBy: "user" as const }),
          quantity: draft.quantity ? Number(draft.quantity) : null,
          unit: draft.unit.trim() || null,
        };
      });
    const nextData: FoodLogData = {
      ...entry.data,
      items:
        nextItems.length > 0
          ? nextItems
          : [
              {
                parsedName: "Food",
                userSegment: "Food",
                resolvedBy: "user" as const,
                quantity: null,
                unit: null,
              },
            ],
    };
    return nextData;
  }, [entry.data, draftItems]);

  const renderEditFields = useCallback(
    () => (
      <>
        {draftItems.map((draft, i) => (
          <div key={draft.id} className="flex items-center gap-1">
            <input
              type="number"
              value={draft.quantity}
              onChange={(e) => {
                const next = [...draftItems];
                next[i] = { ...draft, quantity: e.target.value };
                setDraftItems(next);
              }}
              placeholder="qty"
              className="w-14 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1.5 py-0.5 text-center text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
            />
            <input
              value={draft.unit}
              maxLength={7}
              onChange={(e) => {
                const next = [...draftItems];
                next[i] = { ...draft, unit: e.target.value };
                setDraftItems(next);
              }}
              placeholder="unit"
              className="w-12 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1.5 py-0.5 text-center text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
            />
            <input
              value={draft.name}
              maxLength={60}
              onChange={(e) => {
                const next = [...draftItems];
                next[i] = { ...draft, name: e.target.value };
                setDraftItems(next);
              }}
              placeholder="Food name"
              className="min-w-0 flex-1 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1.5 py-0.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
            />
            {draftItems.length > 1 && (
              <button
                type="button"
                onClick={() => setDraftItems(draftItems.filter((d) => d.id !== draft.id))}
                className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </>
    ),
    [draftItems],
  );

  const renderExtraActions = useCallback(
    () =>
      entry.data.rawInput ? (
        <button
          type="button"
          onClick={() => setRawInputModalOpen(true)}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:text-blue-400"
          aria-label="Edit raw text"
        >
          <FileText className="h-3 w-3" />
        </button>
      ) : null,
    [entry.data.rawInput],
  );

  const detailPreview = detail ? truncatePreviewText(detail) : "";

  const renderDisplay = useCallback(
    () => (
      <>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-mono text-xs text-[var(--color-text-tertiary)]">
              {format(entry.timestamp, "HH:mm")}
            </p>
            {entry.data.mealSlot != null && <MealSlotBadge slot={entry.data.mealSlot} />}
          </div>

          {/* Per-item resolution indicators */}
          {entry.data.items.length > 0 && (
            <div className="mt-0.5 space-y-0.5">
              {entry.data.items.map((item, index) => (
                <FoodItemLine
                  key={item.userSegment ?? item.parsedName ?? item.name ?? `item-${index}`}
                  item={item}
                  onTapToMatch={() => setMatchingItemIndex(index)}
                />
              ))}
            </div>
          )}

          {/* Fallback: show detail as plain text if items have no resolution info */}
          {entry.data.items.length === 0 && detail && (
            <Tooltip>
              <TooltipTrigger
                render={<p className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]" />}
              >
                {detailPreview}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[56ch] text-sm leading-snug">
                {detail}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <RawInputEditModal
          open={rawInputModalOpen}
          onOpenChange={setRawInputModalOpen}
          logId={entry.id}
          currentRawInput={entry.data.rawInput ?? ""}
          logTimestamp={entry.timestamp}
          {...(entry.data.notes !== undefined && {
            currentNotes: entry.data.notes,
          })}
        />
        {matchingItemIndex !== null &&
          matchingItemIndex < entry.data.items.length &&
          entry.data.items[matchingItemIndex] != null && (
            <Suspense fallback={null}>
              <FoodMatchingModal
                open
                onOpenChange={(isOpen) => {
                  if (!isOpen) setMatchingItemIndex(null);
                }}
                logId={entry.id}
                itemIndex={matchingItemIndex}
                item={entry.data.items[matchingItemIndex]}
                foodName={getFoodItemDisplayName(entry.data.items[matchingItemIndex])}
                rawInput={entry.data.rawInput ?? ""}
                logTimestamp={entry.timestamp}
                {...(entry.data.notes !== undefined && {
                  logNotes: entry.data.notes,
                })}
              />
            </Suspense>
          )}
      </>
    ),
    [entry, detail, detailPreview, rawInputModalOpen, matchingItemIndex],
  );

  // ── Processing state: rawInput present but items not yet populated ────
  if (isProcessing) {
    return <FoodProcessingView entry={entry} />;
  }

  return (
    <EditableEntryRow
      entryId={entry.id}
      timestamp={entry.timestamp}
      saveErrorMessage="Failed to save food entry."
      buildSaveData={buildSaveData}
      onStartEditing={onStartEditing}
      renderEditFields={renderEditFields}
      renderDisplay={renderDisplay}
      renderExtraActions={renderExtraActions}
      editLayout="stacked"
      displayPadding="normal"
    />
  );
}
