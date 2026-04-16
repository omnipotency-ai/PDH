import { EllipsisVertical, Settings, Weight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import { ResponsiveShell } from "@/components/ui/responsive-shell";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { useLongPress } from "@/hooks/useLongPress";
import { useHealthProfile, useUnitSystem } from "@/hooks/useProfile";
import { getErrorMessage } from "@/lib/errors";
import { formatWeight, formatWeightDelta } from "@/lib/formatWeight";
import type { HabitConfig } from "@/lib/habitTemplates";
import {
  displayWeightToKg,
  getDisplayWeightUnit,
  getWeightUnitLabel,
  kgToDisplayWeight,
} from "@/lib/units";
import { UnitAwareInput } from "./UnitAwareInput";
import { WeightTrendChart } from "./WeightTrendChart";
import { kgToStonesAndPounds, stonesAndPoundsToKg } from "./weightUtils";

// ── Main component ───────────────────────────────────────────────────────────

interface WeightEntryDrawerProps {
  onLogWeightKg: (weightKg: number) => Promise<void>;
  habit?: HabitConfig;
  onHide?: () => void;
}

type TargetDraft = {
  value: string;
  stones: string;
  pounds: string;
};

export function WeightEntryDrawer({
  onLogWeightKg,
  habit,
  onHide,
}: WeightEntryDrawerProps) {
  const { logs } = useSyncedLogsContext();
  const { healthProfile, setHealthProfile } = useHealthProfile();
  const { unitSystem } = useUnitSystem();

  const weightLogs = useMemo(
    () =>
      logs
        .filter(
          (entry): entry is typeof entry & { type: "weight" } =>
            entry.type === "weight",
        )
        .sort((a, b) => a.timestamp - b.timestamp),
    [logs],
  );

  const latestWeightKg =
    weightLogs[weightLogs.length - 1]?.data?.weightKg ??
    healthProfile?.currentWeight ??
    healthProfile?.startingWeight;
  const previousWeightKg =
    weightLogs.length >= 2
      ? (weightLogs[weightLogs.length - 2]?.data?.weightKg ?? null)
      : null;

  const sinceLastKg =
    latestWeightKg != null && previousWeightKg != null
      ? latestWeightKg - previousWeightKg
      : null;
  const sinceSurgeryKg =
    latestWeightKg != null && healthProfile?.startingWeight != null
      ? latestWeightKg - healthProfile?.startingWeight
      : null;

  const weightUnit = getWeightUnitLabel(unitSystem);
  const displayWeightUnit = getDisplayWeightUnit(unitSystem);
  const habitName = habit?.name ?? "Weigh-in";

  // ── Entry popover state ──────────────────────────────────────────────────

  const [weightEntryOpen, setWeightEntryOpen] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);
  const [entryValue, setEntryValue] = useState("");
  const [entryStones, setEntryStones] = useState("");
  const [entryPounds, setEntryPounds] = useState("");

  // ── Settings drawer state ────────────────────────────────────────────────

  const [weightSettingsOpen, setWeightSettingsOpen] = useState(false);
  const [targetValue, setTargetValue] = useState("");
  const [targetStones, setTargetStones] = useState("");
  const [targetPounds, setTargetPounds] = useState("");
  const targetDraftRef = useRef<TargetDraft>({
    value: "",
    stones: "",
    pounds: "",
  });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncTargetDraft = useCallback((nextDraft: TargetDraft) => {
    targetDraftRef.current = nextDraft;
    setTargetValue(nextDraft.value);
    setTargetStones(nextDraft.stones);
    setTargetPounds(nextDraft.pounds);
  }, []);

  const populateEntryState = useCallback(() => {
    if (latestWeightKg == null) {
      setEntryValue("");
      setEntryStones("");
      setEntryPounds("");
      return;
    }

    if (unitSystem === "imperial_uk") {
      const { stones, pounds } = kgToStonesAndPounds(latestWeightKg);
      setEntryValue("");
      setEntryStones(String(stones));
      setEntryPounds(String(pounds));
      return;
    }

    setEntryValue(
      String(Number(kgToDisplayWeight(latestWeightKg, unitSystem).toFixed(1))),
    );
  }, [latestWeightKg, unitSystem]);

  const populateTargetState = useCallback(() => {
    const targetWeightKg = healthProfile?.targetWeight;
    if (targetWeightKg == null) {
      syncTargetDraft({ value: "", stones: "", pounds: "" });
      return;
    }

    if (unitSystem === "imperial_uk") {
      const { stones, pounds } = kgToStonesAndPounds(targetWeightKg);
      syncTargetDraft({
        value: "",
        stones: String(stones),
        pounds: String(pounds),
      });
      return;
    }

    syncTargetDraft({
      value: String(
        Number(kgToDisplayWeight(targetWeightKg, unitSystem).toFixed(1)),
      ),
      stones: "",
      pounds: "",
    });
  }, [healthProfile?.targetWeight, syncTargetDraft, unitSystem]);

  /**
   * Shared weight parsing: converts display-unit input strings to kg.
   * Returns null for empty/invalid input.
   *
   * For imperial_uk: takes stones + pounds strings.
   * For metric/imperial_us: takes a single value string.
   */
  const parseWeightKg = useCallback(
    (opts: {
      value: string;
      stones: string;
      pounds: string;
    }): number | null => {
      if (unitSystem === "imperial_uk") {
        if (opts.stones.trim() === "" && opts.pounds.trim() === "") return null;
        const rawStones = Number(opts.stones);
        const rawPounds = Number(opts.pounds);
        if (!Number.isFinite(rawStones) || !Number.isFinite(rawPounds))
          return null;
        const stones = Math.round(rawStones);
        const pounds = Math.round(rawPounds);
        if (stones < 0 || pounds < 0 || pounds >= 14) return null;
        const kg = stonesAndPoundsToKg(stones, pounds);
        return kg > 0 ? kg : null;
      }

      if (opts.value.trim() === "") return null;
      const value = Number(opts.value);
      if (!Number.isFinite(value) || value <= 0) return null;
      return displayWeightToKg(value, unitSystem);
    },
    [unitSystem],
  );

  const parseEntryWeightKg = (): number | null => {
    return parseWeightKg({
      value: entryValue,
      stones: entryStones,
      pounds: entryPounds,
    });
  };

  // ── Auto-save target weight on change ─────────────────────────────────

  const autoSaveTarget = useCallback(() => {
    const draft = targetDraftRef.current;
    const parsed = parseWeightKg(draft);
    // Only save if there's valid input or if all fields are intentionally blank (clear target)
    const hasInput =
      unitSystem === "imperial_uk"
        ? draft.stones.trim() !== "" || draft.pounds.trim() !== ""
        : draft.value.trim() !== "";

    if (!hasInput) {
      // Clear target
      if (healthProfile?.targetWeight != null) {
        setHealthProfile({ targetWeight: null });
        toast.success("Target weight cleared.");
      }
      return;
    }

    if (parsed == null) return; // Invalid input, don't save

    // Only save if different from current
    if (
      healthProfile?.targetWeight != null &&
      Math.abs(healthProfile?.targetWeight - parsed) < 0.01
    ) {
      return;
    }

    setHealthProfile({ targetWeight: parsed });
    toast.success("Target weight updated.");
  }, [
    parseWeightKg,
    unitSystem,
    healthProfile?.targetWeight,
    setHealthProfile,
  ]);

  const debouncedAutoSaveTarget = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(autoSaveTarget, 800);
  }, [autoSaveTarget]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const clearTargetWeight = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    syncTargetDraft({ value: "", stones: "", pounds: "" });
    if (healthProfile?.targetWeight != null) {
      setHealthProfile({ targetWeight: null });
      toast.success("Target weight cleared.");
    }
  }, [healthProfile?.targetWeight, setHealthProfile, syncTargetDraft]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openWeightEntry = useCallback(() => {
    populateEntryState();
    setWeightSaving(false);
    setWeightEntryOpen(true);
  }, [populateEntryState]);

  const openWeightSettings = useCallback(() => {
    setWeightEntryOpen(false);
    populateTargetState();
    setWeightSettingsOpen(true);
  }, [populateTargetState]);

  const closeWeightSettings = useCallback(() => {
    // Fire auto-save on close in case debounce hasn't triggered yet
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    autoSaveTarget();
    setWeightSettingsOpen(false);
  }, [autoSaveTarget]);

  const weightTileLongPress = useLongPress({
    onTap: () => {},
    onLongPress: openWeightSettings,
  });

  // Save on Enter, close popover on save
  const saveWeightEntry = async () => {
    const parsedWeightKg = parseEntryWeightKg();
    if (parsedWeightKg == null) {
      toast.error("Enter a valid weight.");
      return;
    }

    try {
      setWeightSaving(true);
      await onLogWeightKg(parsedWeightKg);
      setWeightEntryOpen(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to log weight."));
    } finally {
      setWeightSaving(false);
    }
  };

  const handleEntryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveWeightEntry();
    }
  };

  const targetWeightKg = healthProfile?.targetWeight;

  return (
    <>
      <Popover open={weightEntryOpen} onOpenChange={setWeightEntryOpen}>
        <PopoverAnchor asChild>
          <div data-slot="weight-capture-tile" className="group relative">
            {onHide && (
              <button
                type="button"
                className="absolute -top-1.5 -right-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border-default)] bg-[var(--surface-3)] text-[var(--text-faint)] shadow-sm opacity-0 transition-opacity hover:bg-[var(--surface-0)] hover:text-[var(--text)] group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-border-default)] focus-visible:outline-none before:absolute before:-inset-[12px] before:content-['']"
                aria-label={`Hide ${habitName} from Quick Capture`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onHide();
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}

            {/* Desktop-only 3-dot menu button for settings access */}
            <button
              type="button"
              className="absolute top-1 right-1 z-10 hidden h-6 w-6 items-center justify-center rounded-full text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-muted)] xl:flex"
              aria-label={`${habitName} settings`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openWeightSettings();
              }}
            >
              <EllipsisVertical className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              {...weightTileLongPress}
              onClick={openWeightEntry}
              className="relative flex min-h-11 w-full items-center gap-2 rounded-2xl border border-[rgba(236,72,153,0.35)] bg-[rgba(236,72,153,0.08)] px-3 py-2.5 text-left transition-all select-none active:scale-95 hover:border-transparent hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/40"
              aria-label={`${habitName} quick capture. Tap to log weight, long press for settings`}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-3)]"
                aria-hidden="true"
              >
                <Weight className="h-4.5 w-4.5 text-pink-600 dark:text-pink-400" />
              </span>
              <div className="min-w-0 flex flex-1 flex-col justify-center gap-0.5">
                <span className="truncate font-mono text-xs font-bold tabular-nums text-pink-600 dark:text-pink-400">
                  {latestWeightKg != null
                    ? `${kgToDisplayWeight(latestWeightKg, unitSystem).toFixed(1)} ${weightUnit}`
                    : "Tap to log"}
                </span>
                <span className="truncate text-[11px] text-[var(--text-muted)]">
                  {habitName}
                </span>
              </div>
            </button>
          </div>
        </PopoverAnchor>

        {/* Compact popover — Enter saves, click-away closes */}
        <PopoverContent
          align="center"
          sideOffset={8}
          className="w-[280px] space-y-2 p-3"
        >
          <PopoverHeader>
            <PopoverTitle>Weigh-in</PopoverTitle>
            <PopoverDescription>Type weight, press Enter.</PopoverDescription>
          </PopoverHeader>

          <UnitAwareInput
            unitSystem={unitSystem}
            value={entryValue}
            stones={entryStones}
            pounds={entryPounds}
            setValue={setEntryValue}
            setStones={setEntryStones}
            setPounds={setEntryPounds}
            ids={{
              value: "weight-popover-value",
              stones: "weight-popover-stones",
              pounds: "weight-popover-pounds",
            }}
            labels={{
              value: `Weight (${weightUnit})`,
              stones: "Stones",
              pounds: "Pounds",
            }}
            onKeyDown={handleEntryKeyDown}
            autoFocus
          />

          {weightSaving && (
            <p className="text-center text-xs text-[var(--text-muted)]">
              Saving...
            </p>
          )}
        </PopoverContent>
      </Popover>

      <ResponsiveShell
        open={weightSettingsOpen}
        onOpenChange={(open) => {
          if (!open) closeWeightSettings();
        }}
        title={
          <span className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--section-weight)]" />
            Weight Settings
          </span>
        }
        description="Review progress since surgery and set your target weight."
        bodyClassName="px-4 pb-6"
        sheetContentClassName="max-w-[560px]"
      >
        <div className="space-y-4">
          {/* Surgery progress stats */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-[var(--surface-2)] px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Starting weight
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-[var(--text)]">
                {healthProfile?.startingWeight != null
                  ? formatWeight(
                      healthProfile?.startingWeight,
                      displayWeightUnit,
                    )
                  : "Not set"}
              </p>
            </div>

            <div className="rounded-xl border bg-[var(--surface-2)] px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Current weight
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-[var(--text)]">
                {latestWeightKg != null
                  ? formatWeight(latestWeightKg, displayWeightUnit)
                  : "No weigh-in yet"}
              </p>
            </div>
          </div>

          {/* Target weight with auto-save */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Target weight</Label>
              {healthProfile?.targetWeight != null && (
                <button
                  type="button"
                  onClick={clearTargetWeight}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
            <UnitAwareInput
              unitSystem={unitSystem}
              value={targetValue}
              stones={targetStones}
              pounds={targetPounds}
              setValue={(v) => {
                syncTargetDraft({
                  value: v,
                  stones: "",
                  pounds: "",
                });
                debouncedAutoSaveTarget();
              }}
              setStones={(v) => {
                syncTargetDraft({
                  value: "",
                  stones: v,
                  pounds: targetDraftRef.current.pounds,
                });
                debouncedAutoSaveTarget();
              }}
              setPounds={(v) => {
                syncTargetDraft({
                  value: "",
                  stones: targetDraftRef.current.stones,
                  pounds: v,
                });
                debouncedAutoSaveTarget();
              }}
              ids={{
                value: "weight-target-value",
                stones: "weight-target-stones",
                pounds: "weight-target-pounds",
              }}
              labels={{
                value: `Target (${weightUnit})`,
                stones: "Target stones",
                pounds: "Target pounds",
              }}
              inputClassName="selection:bg-[var(--surface-3)] selection:text-[var(--text)]"
            />
            <p className="text-xs text-[var(--text-muted)]">
              Auto-saves as you type.
            </p>
          </div>

          {/* Delta stats */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border bg-[var(--surface-2)] px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Since last weigh-in
              </p>
              <p className="mt-1 font-mono text-base font-semibold text-[var(--text)]">
                {sinceLastKg != null
                  ? formatWeightDelta(sinceLastKg, displayWeightUnit)
                  : "Not enough data"}
              </p>
            </div>
            <div className="rounded-xl border bg-[var(--surface-2)] px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Since surgery
              </p>
              <p className="mt-1 font-mono text-base font-semibold text-[var(--text)]">
                {sinceSurgeryKg != null
                  ? formatWeightDelta(sinceSurgeryKg, displayWeightUnit)
                  : "Not enough data"}
              </p>
            </div>
          </div>

          {/* Weight trend chart */}
          <div className="rounded-xl border bg-[var(--surface-2)] px-3 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Weight trend
            </p>
            <WeightTrendChart
              weightLogs={weightLogs}
              targetWeightKg={targetWeightKg ?? null}
              startingWeightKg={healthProfile?.startingWeight ?? null}
              displayWeightUnit={displayWeightUnit}
            />
          </div>

          {/* No Save/Close buttons — drawer auto-saves and closes on escape/backdrop */}
        </div>
      </ResponsiveShell>
    </>
  );
}
