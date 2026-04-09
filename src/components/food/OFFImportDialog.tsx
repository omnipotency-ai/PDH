/**
 * OFFImportDialog — Import foods from OpenFoodFacts into the ingredient registry.
 *
 * Opens a dialog with a debounced search input that calls the
 * `searchOpenFoodFacts` action, shows product results with key nutrition info
 * per 100g, and lets the user import any result into their ingredientProfiles.
 *
 * Uses Base UI Dialog (Portal + Backdrop + Popup) following the LogFoodModal
 * pattern. New rows appear immediately via Convex reactivity on upsert.
 */

import { Dialog } from "@base-ui/react/dialog";
import { useAction, useMutation } from "convex/react";
import { Download, Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";

// ── Types ──────────────────────────────────────────────────────────────────

type OFFResult = {
  externalId: string;
  displayName: string;
  brand: string | null;
  ingredientsText: string | null;
  categories: string[];
  nutritionPer100g: {
    kcal: number | null;
    fatG: number | null;
    saturatedFatG: number | null;
    carbsG: number | null;
    sugarsG: number | null;
    fiberG: number | null;
    proteinG: number | null;
    saltG: number | null;
  };
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatNutrient(value: number | null, suffix: string): string {
  if (value === null) return "—";
  return `${value % 1 === 0 ? value : value.toFixed(1)}${suffix}`;
}

/** Derive a stable canonical name from displayName + externalId. */
function deriveCanonicalName(result: OFFResult): string {
  // Use externalId (barcode or generated) as a stable discriminator.
  // canonicalName must be lowercase kebab-like.
  const base = result.displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base}-${result.externalId.slice(0, 12)}`;
}

// ── NutritionChip ──────────────────────────────────────────────────────────

function NutritionChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-0.5 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px]">
      <span className="font-mono font-bold text-[var(--text)]">{value}</span>
      <span className="text-[var(--text-faint)]">{label}</span>
    </span>
  );
}

// ── ResultRow ─────────────────────────────────────────────────────────────

function ResultRow({
  result,
  onImport,
  importing,
  imported,
}: {
  result: OFFResult;
  onImport: (result: OFFResult) => void;
  importing: boolean;
  imported: boolean;
}) {
  const n = result.nutritionPer100g;

  return (
    <div
      data-slot="off-result-row"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3 transition-colors",
        imported && "opacity-60",
      )}
    >
      {/* Product info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text)]">
          {result.displayName}
        </p>
        {result.brand !== null && (
          <p className="truncate text-xs text-[var(--text-muted)]">
            {result.brand}
          </p>
        )}

        {/* Nutrition chips — per 100g */}
        <div className="mt-1.5 flex flex-wrap gap-1">
          <NutritionChip label="kcal" value={formatNutrient(n.kcal, "")} />
          <NutritionChip label="pro" value={formatNutrient(n.proteinG, "g")} />
          <NutritionChip label="carb" value={formatNutrient(n.carbsG, "g")} />
          <NutritionChip label="fat" value={formatNutrient(n.fatG, "g")} />
          {n.fiberG !== null && (
            <NutritionChip
              label="fibre"
              value={formatNutrient(n.fiberG, "g")}
            />
          )}
        </div>
      </div>

      {/* Import button */}
      <button
        type="button"
        onClick={() => onImport(result)}
        disabled={importing || imported}
        aria-label={
          imported
            ? `${result.displayName} imported`
            : `Import ${result.displayName}`
        }
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
          imported
            ? "bg-[var(--surface-2)] text-[var(--text-faint)]"
            : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {importing ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-3.5" aria-hidden="true" />
        )}
        {imported ? "Imported" : "Import"}
      </button>
    </div>
  );
}

// ── OFFImportDialog ────────────────────────────────────────────────────────

export interface OFFImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OFFImportDialog({ open, onOpenChange }: OFFImportDialogProps) {
  const searchOFF = useAction(api.ingredientNutritionApi.searchOpenFoodFacts);
  const upsert = useMutation(api.ingredientProfiles.upsert);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OFFResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Track per-result import state: externalId → "importing" | "done"
  const [importState, setImportState] = useState<
    Record<string, "importing" | "done">
  >({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (open) {
      // Small delay to allow the dialog animation to start
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setQuery("");
        setResults([]);
        setSearchError(null);
        setImportState({});
        if (debounceRef.current !== null) {
          clearTimeout(debounceRef.current);
        }
      }
    },
    [onOpenChange],
  );

  // Debounced search
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      setSearchError(null);

      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }

      if (value.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const rows = await searchOFF({ query: value.trim(), limit: 8 });
          setResults(rows as OFFResult[]);
        } catch {
          setSearchError("Search failed. Check your connection and try again.");
          setResults([]);
        } finally {
          setSearching(false);
        }
      }, 400);
    },
    [searchOFF],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleImport = useCallback(
    async (result: OFFResult) => {
      setImportState((prev) => ({ ...prev, [result.externalId]: "importing" }));

      try {
        const canonicalName = deriveCanonicalName(result);
        await upsert({
          canonicalName,
          displayName: result.displayName,
          source: "openfoodfacts",
          externalId: result.externalId,
          ...(result.brand !== null && { productName: result.brand }),
          ...(result.ingredientsText !== null && {
            ingredientsText: result.ingredientsText,
          }),
          nutritionPer100g: result.nutritionPer100g,
          now: Date.now(),
        });
        setImportState((prev) => ({ ...prev, [result.externalId]: "done" }));
      } catch {
        // On failure, clear the importing state so the user can retry
        setImportState((prev) => {
          const next = { ...prev };
          delete next[result.externalId];
          return next;
        });
      }
    },
    [upsert],
  );

  const hasResults = results.length > 0;
  const showEmpty =
    !searching &&
    query.trim().length >= 2 &&
    !hasResults &&
    searchError === null;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          data-slot="off-import-backdrop"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        />
        <Dialog.Popup
          data-slot="off-import-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Import from OpenFoodFacts"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 mx-4 flex w-full max-w-lg",
            "-translate-x-1/2 -translate-y-1/2 flex-col",
            "rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] shadow-xl",
            "max-h-[80vh]",
          )}
        >
          {/* ── Header ─────────────────────────────────────────────── */}
          <div
            data-slot="off-import-header"
            className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"
          >
            <div>
              <Dialog.Title className="text-base font-bold text-[var(--text)]">
                Import from OpenFoodFacts
              </Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-[var(--text-muted)]">
                Search the OFF database and import into your registry
              </Dialog.Description>
            </div>
            <Dialog.Close
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-md",
                "text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
                "transition-colors",
              )}
              aria-label="Close import dialog"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/* ── Search input ────────────────────────────────────────── */}
          <div className="border-b border-[var(--border)] px-4 py-3">
            <div className="relative">
              {searching ? (
                <Loader2
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-[var(--text-faint)]"
                  aria-hidden="true"
                />
              ) : (
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-faint)]"
                  aria-hidden="true"
                />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleQueryChange}
                placeholder="e.g. rolled oats, Greek yogurt…"
                aria-label="Search OpenFoodFacts"
                className={cn(
                  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)]",
                  "py-2 pr-3 pl-9 text-sm text-[var(--text)]",
                  "placeholder:text-[var(--text-faint)]",
                  "focus:border-[var(--border-strong)] focus:outline-none",
                )}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-[var(--text-faint)]">
              Type at least 2 characters to search. Nutrition values are per
              100g.
            </p>
          </div>

          {/* ── Results ─────────────────────────────────────────────── */}
          <div
            data-slot="off-import-results"
            className="flex-1 overflow-y-auto px-4 py-3"
          >
            {searchError !== null && (
              <p
                role="alert"
                className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400"
              >
                {searchError}
              </p>
            )}

            {showEmpty && (
              <p className="py-6 text-center text-sm text-[var(--text-faint)]">
                No results found for &ldquo;{query}&rdquo;
              </p>
            )}

            {!hasResults && query.trim().length < 2 && (
              <p className="py-6 text-center text-sm text-[var(--text-faint)]">
                Start typing to search OpenFoodFacts
              </p>
            )}

            {hasResults && (
              <ul
                className="flex flex-col gap-2"
                role="list"
                aria-label="Search results"
              >
                {results.map((result) => (
                  <li key={result.externalId}>
                    <ResultRow
                      result={result}
                      onImport={(r) => void handleImport(r)}
                      importing={importState[result.externalId] === "importing"}
                      imported={importState[result.externalId] === "done"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div
            data-slot="off-import-footer"
            className="border-t border-[var(--border)] px-4 py-2.5"
          >
            <p className="text-[10px] text-[var(--text-faint)]">
              Data from{" "}
              <a
                href="https://world.openfoodfacts.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[var(--text-muted)]"
              >
                OpenFoodFacts
              </a>{" "}
              (ODbL licence). Review values before clinical use.
            </p>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
