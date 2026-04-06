import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Check, FileText, MessageSquarePlus, Search } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RawInputEditModal } from "@/components/track/RawInputEditModal";
import { Button } from "@/components/ui/button";
import { ResponsiveShell } from "@/components/ui/responsive-shell";
import type { UnresolvedQueueItem } from "@/hooks/useUnresolvedFoodQueue";
import { getErrorMessage } from "@/lib/errors";
import { asConvexId } from "@/lib/sync";
import type { FoodItem } from "@/types/domain";
import { api } from "../../../convex/_generated/api";
import { type FoodGroup, getGroupDisplayName } from "../../../shared/foodRegistry";

interface FoodMatchingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logId?: string;
  itemIndex?: number;
  item?: FoodItem;
  foodName?: string;
  rawInput?: string;
  logTimestamp?: number;
  logNotes?: string;
  queue?: UnresolvedQueueItem[];
}

interface SearchOption {
  canonicalName: string;
  group: FoodGroup;
  zone: 1 | 2 | 3;
  bucketKey: string;
  examples: ReadonlyArray<string>;
}

const GROUP_ORDER: ReadonlyArray<FoodGroup> = ["protein", "carbs", "fats", "seasoning"];

const ZONE_COLORS: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  2: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  3: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function formatConfidence(value: number | undefined): string | null {
  if (value === undefined || Number.isNaN(value)) return null;
  return `${Math.round(value * 100)}% confidence`;
}

export function FoodMatchingModal({
  open,
  onOpenChange,
  logId,
  itemIndex,
  item,
  foodName,
  rawInput,
  logTimestamp,
  logNotes,
  queue,
}: FoodMatchingModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCanonical, setSelectedCanonical] = useState<string | null>(null);
  const [activeBucketKey, setActiveBucketKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [rawInputEditOpen, setRawInputEditOpen] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketNote, setTicketNote] = useState("");
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const resolveItem = useMutation(api.foodParsing.resolveItem);
  const submitFoodRequest = useMutation(api.foodRequests.submitRequest);

  const isQueueMode = queue !== undefined && queue.length > 0;
  const currentItem = isQueueMode
    ? queue[queueIndex]
    : { logId, itemIndex, item, foodName, rawInput, logTimestamp, logNotes };

  const currentLogId = currentItem?.logId ?? "";
  const currentItemIndex = currentItem?.itemIndex ?? 0;
  const currentFoodItem = currentItem?.item;
  const currentFoodName =
    currentItem?.foodName ?? currentFoodItem?.parsedName ?? currentFoodItem?.userSegment ?? "Food";
  const currentRawInput = currentItem?.rawInput ?? "";
  const currentLogTimestamp = currentItem?.logTimestamp;
  const currentLogNotes = currentItem?.logNotes;
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());

  const candidateOptions = currentFoodItem?.matchCandidates ?? [];
  const bucketOptions = currentFoodItem?.bucketOptions ?? [];
  const activeBucket = bucketOptions.find((bucket) => bucket.bucketKey === activeBucketKey);
  const confidenceLabel = formatConfidence(currentFoodItem?.matchConfidence);
  const defaultCandidateCanonical = candidateOptions[0]?.canonicalName ?? null;
  const serverSearchOptions = useQuery(
    api.foodParsing.searchFoods,
    open
      ? {
          query: deferredSearchQuery,
          ...(activeBucketKey ? { bucketKey: activeBucketKey } : {}),
          limit: deferredSearchQuery.length > 0 ? 40 : activeBucketKey ? 80 : 160,
        }
      : "skip",
  );

  useEffect(() => {
    if (!open) return;
    setQueueIndex(0);
    setSearchQuery("");
    setSelectedCanonical(null);
    setActiveBucketKey(null);
    setShowTicketForm(false);
    setTicketNote("");
    setTicketSubmitted(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedCanonical(defaultCandidateCanonical);
    setActiveBucketKey(null);
  }, [defaultCandidateCanonical, open]);

  useEffect(() => {
    if (open && searchInputRef.current) {
      const timeout = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [open]);

  const filteredOptions = serverSearchOptions ?? [];
  const isSearchLoading = serverSearchOptions === undefined;

  const groupedOptions = useMemo(() => {
    const groups = new Map<FoodGroup, SearchOption[]>();
    for (const option of filteredOptions) {
      const existing = groups.get(option.group) ?? [];
      existing.push(option);
      groups.set(option.group, existing);
    }
    return GROUP_ORDER.filter((group) => groups.has(group)).map((group) => ({
      group,
      label: getGroupDisplayName(group),
      options: groups.get(group) ?? [],
    }));
  }, [filteredOptions]);

  const resetItemState = useCallback(() => {
    setSearchQuery("");
    setSelectedCanonical(defaultCandidateCanonical);
    setActiveBucketKey(null);
    setShowTicketForm(false);
    setTicketNote("");
    setTicketSubmitted(false);
  }, [defaultCandidateCanonical]);

  const handleSave = useCallback(async () => {
    if (!selectedCanonical || !currentLogId) return;

    setIsSaving(true);
    try {
      await resolveItem({
        logId: asConvexId<"logs">(currentLogId),
        itemIndex: currentItemIndex,
        canonicalName: selectedCanonical,
        now: Date.now(),
      });
      toast.success(`Matched "${currentFoodName}" to "${selectedCanonical}"`);

      if (isQueueMode && queue !== undefined) {
        const nextIndex = queueIndex + 1;
        if (nextIndex < queue.length) {
          setQueueIndex(nextIndex);
          resetItemState();
        } else {
          toast.success("All items matched!");
          onOpenChange(false);
        }
      } else {
        onOpenChange(false);
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to match food item."));
    } finally {
      setIsSaving(false);
    }
  }, [
    currentFoodName,
    currentItemIndex,
    currentLogId,
    isQueueMode,
    onOpenChange,
    queue,
    queueIndex,
    resetItemState,
    resolveItem,
    selectedCanonical,
  ]);

  const handleSkip = useCallback(() => {
    if (!isQueueMode || queue === undefined) return;
    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      setQueueIndex(nextIndex);
      resetItemState();
    }
  }, [isQueueMode, queue, queueIndex, resetItemState]);

  const handleSelectBucket = useCallback(
    (bucketKey: string) => {
      const bucket = bucketOptions.find((option) => option.bucketKey === bucketKey);
      if (!bucket) return;
      setActiveBucketKey(bucketKey);
      setSelectedCanonical(bucket.canonicalOptions[0] ?? null);
    },
    [bucketOptions],
  );

  const handleSubmitTicket = useCallback(async () => {
    setIsSaving(true);
    try {
      await submitFoodRequest({
        foodName: currentFoodName,
        now: Date.now(),
        ...(currentRawInput.length > 0 && { rawInput: currentRawInput }),
        ...(ticketNote.trim().length > 0 && { note: ticketNote.trim() }),
        ...(currentLogId.length > 0 && { logId: currentLogId }),
        ...(currentItem?.itemIndex !== undefined && {
          itemIndex: currentItemIndex,
        }),
      });
      setTicketSubmitted(true);
      toast.success(`Request submitted for "${currentFoodName}". We'll add it to the registry.`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to submit food request."));
    } finally {
      setIsSaving(false);
    }
  }, [
    currentFoodName,
    currentItem,
    currentItemIndex,
    currentLogId,
    currentRawInput,
    submitFoodRequest,
    ticketNote,
  ]);

  const title = isQueueMode
    ? `Match food item (${queueIndex + 1} of ${queue?.length ?? 0})`
    : "Match food item";

  const description =
    candidateOptions.length > 0 || bucketOptions.length > 0
      ? `"${currentFoodName}" needs confirmation. Start with the server suggestions below.`
      : `"${currentFoodName}" couldn't be automatically matched. Search for the closest option below.`;

  return (
    <ResponsiveShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      <div data-slot="food-matching-body" className="flex flex-col gap-3 p-4">
        {currentRawInput.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
              Full meal
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{currentRawInput}</p>
          </div>
        )}

        {showTicketForm ? (
          <TicketForm
            foodName={currentFoodName}
            ticketNote={ticketNote}
            onTicketNoteChange={setTicketNote}
            onSubmit={handleSubmitTicket}
            onBack={() => setShowTicketForm(false)}
            submitted={ticketSubmitted}
            isSaving={isSaving}
          />
        ) : (
          <>
            {(confidenceLabel || currentFoodItem?.matchStrategy) && (
              <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                <span className="font-medium text-[var(--color-text-primary)]">
                  Server assessment:
                </span>{" "}
                {confidenceLabel ?? "Pending review"}
                {currentFoodItem?.matchStrategy ? ` via ${currentFoodItem.matchStrategy}` : ""}
              </div>
            )}

            {candidateOptions.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                    Best candidates
                  </p>
                  {candidateOptions.length > 1 && (
                    <p className="text-[10px] text-[var(--text-faint)]">
                      Pick the closest one, or search below.
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  {candidateOptions.slice(0, 3).map((candidate) => {
                    const isSelected = selectedCanonical === candidate.canonicalName;
                    return (
                      <button
                        key={candidate.canonicalName}
                        type="button"
                        onClick={() =>
                          setSelectedCanonical(isSelected ? null : candidate.canonicalName)
                        }
                        className={`rounded-lg border px-3 py-2 text-left ${
                          isSelected
                            ? "border-[var(--section-food)] bg-[var(--section-food-muted)]"
                            : "border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] hover:border-[var(--section-food)]/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm text-[var(--color-text-primary)]">
                              {candidate.canonicalName}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[var(--text-faint)]">
                              {candidate.bucketLabel}
                            </p>
                            {candidate.examples.length > 0 && (
                              <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                                e.g. {candidate.examples.slice(0, 3).join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ZONE_COLORS[candidate.zone] ?? ""}`}
                            >
                              Z{candidate.zone}
                            </span>
                            <span className="rounded-full bg-[var(--color-bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
                              {Math.round(candidate.combinedConfidence * 100)}%
                            </span>
                            {isSelected && <Check className="h-4 w-4 text-[var(--section-food)]" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {bucketOptions.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                    Closest bucket
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveBucketKey(null)}
                    className="text-[10px] text-[var(--text-faint)] hover:text-[var(--color-text-primary)]"
                  >
                    Show all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bucketOptions.map((bucket) => {
                    const isActive = activeBucketKey === bucket.bucketKey;
                    return (
                      <button
                        key={bucket.bucketKey}
                        type="button"
                        onClick={() => handleSelectBucket(bucket.bucketKey)}
                        className={`rounded-full border px-2.5 py-1 text-xs ${
                          isActive
                            ? "border-[var(--section-food)] bg-[var(--section-food-muted)] text-[var(--section-food)]"
                            : "border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:border-[var(--section-food)]/40"
                        }`}
                      >
                        {bucket.bucketLabel}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
              <input
                ref={searchInputRef}
                id="food-search-input"
                type="text"
                role="combobox"
                aria-label="Search foods"
                aria-expanded={groupedOptions.length > 0}
                aria-controls="food-canonical-listbox"
                aria-autocomplete="list"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={
                  activeBucket
                    ? `Search within ${activeBucket.bucketLabel}...`
                    : "Search the full food registry..."
                }
                className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] py-2 pr-3 pl-8 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--section-food)]/50 focus:ring-2 focus:ring-[var(--section-food)]/30 focus:outline-none"
              />
            </div>

            <div
              id="food-canonical-listbox"
              role="listbox"
              aria-label="Food canonicals"
              className="max-h-[40vh] min-h-[120px] overflow-y-auto rounded-lg border border-[var(--color-border-default)]"
            >
              {isSearchLoading ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Search className="h-5 w-5 animate-pulse text-[var(--text-faint)]" />
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    Loading food matches...
                  </p>
                </div>
              ) : groupedOptions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <AlertTriangle className="h-5 w-5 text-[var(--text-faint)]" />
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    {searchQuery.trim().length > 0
                      ? `No matches found for "${searchQuery}"`
                      : activeBucket
                        ? `No foods found in ${activeBucket.bucketLabel}`
                        : "No foods found"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowTicketForm(true)}
                    className="mt-1 text-xs font-medium text-[var(--section-food)] hover:underline"
                  >
                    Not in the list? Request it be added
                  </button>
                </div>
              ) : (
                groupedOptions.map((groupData) => (
                  <div key={groupData.group}>
                    <div className="sticky top-0 z-10 border-b border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-3 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                        {groupData.label}
                      </span>
                    </div>
                    {groupData.options.map((option) => {
                      const isSelected = selectedCanonical === option.canonicalName;
                      return (
                        <button
                          key={option.canonicalName}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() =>
                            setSelectedCanonical(isSelected ? null : option.canonicalName)
                          }
                          className={`flex w-full items-center gap-2 border-b border-[var(--color-border-default)] px-3 py-2 text-left last:border-b-0 ${
                            isSelected
                              ? "bg-[var(--section-food-muted)]"
                              : "hover:bg-[var(--color-bg-overlay)]"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-sm text-[var(--color-text-primary)]">
                              {option.canonicalName}
                            </span>
                            {option.examples.length > 0 && (
                              <p className="mt-0.5 truncate text-[10px] text-[var(--text-faint)]">
                                e.g. {option.examples.slice(0, 3).join(", ")}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ZONE_COLORS[option.zone] ?? ""}`}
                          >
                            Z{option.zone}
                          </span>
                          {isSelected && (
                            <Check className="h-4 w-4 shrink-0 text-[var(--section-food)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {groupedOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTicketForm(true)}
                  className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--section-food)]"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Not in the list? Request it be added
                </button>
              )}
              {currentLogTimestamp !== undefined && (
                <button
                  type="button"
                  onClick={() => setRawInputEditOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--section-food)]"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Edit raw text
                </button>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border-default)] pt-3">
              {isQueueMode && queue !== undefined && queueIndex < queue.length - 1 && (
                <Button variant="ghost" size="sm" onClick={handleSkip} disabled={isSaving}>
                  Skip
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={isSaving || selectedCanonical === null}
                className="rounded-[6px] px-4 text-xs font-semibold"
                style={{
                  border: "none",
                  background: "var(--section-food)",
                  color: "#ffffff",
                  boxShadow: "0 0 12px var(--section-food-glow)",
                }}
              >
                {isSaving ? "Saving..." : "Match"}
              </Button>
            </div>
          </>
        )}
      </div>
      {currentLogTimestamp !== undefined && currentLogId.length > 0 && (
        <RawInputEditModal
          open={rawInputEditOpen}
          onOpenChange={(isOpen) => {
            setRawInputEditOpen(isOpen);
            if (!isOpen) {
              onOpenChange(false);
            }
          }}
          logId={currentLogId}
          currentRawInput={currentRawInput}
          logTimestamp={currentLogTimestamp}
          {...(currentLogNotes !== undefined && {
            currentNotes: currentLogNotes,
          })}
        />
      )}
    </ResponsiveShell>
  );
}

function TicketForm({
  foodName,
  ticketNote,
  onTicketNoteChange,
  onSubmit,
  onBack,
  submitted,
  isSaving,
}: {
  foodName: string;
  ticketNote: string;
  onTicketNoteChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onBack: () => void;
  submitted: boolean;
  isSaving: boolean;
}) {
  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Request submitted</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            &ldquo;{foodName}&rdquo; will be reviewed and added to the registry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-xs text-amber-800 dark:text-amber-300">
          If &ldquo;{foodName}&rdquo; still doesn&apos;t fit, submit it for a registry review.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="ticket-note" className="text-xs font-medium text-[var(--text-muted)]">
          Additional context (optional)
        </label>
        <textarea
          id="ticket-note"
          value={ticketNote}
          onChange={(event) => onTicketNoteChange(event.target.value)}
          placeholder={`e.g. "It's a tropical fruit similar to mango"`}
          maxLength={300}
          rows={2}
          className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--section-food)]/50 focus:ring-2 focus:ring-[var(--section-food)]/30 focus:outline-none resize-none"
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          &larr; Back to list
        </button>
        <Button
          size="sm"
          onClick={() => void onSubmit()}
          disabled={isSaving}
          className="rounded-[6px] px-4 text-xs font-semibold"
          style={{
            border: "none",
            background: "var(--section-food)",
            color: "#ffffff",
            boxShadow: "0 0 12px var(--section-food-glow)",
          }}
        >
          {isSaving ? "Submitting..." : "Submit request"}
        </Button>
      </div>
    </div>
  );
}
