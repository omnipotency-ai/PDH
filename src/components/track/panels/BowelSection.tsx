import { AlertTriangle, HeartPulse, Minus, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { BRISTOL_SCALE, BristolIllustration } from "@/components/track/panels/BristolScale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePanelTime } from "@/hooks/usePanelTime";

import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  BRISTOL_ACCENT,
  EFFORT,
  SEVERITY_COLORS,
  SPECTRUM_POS,
  URGENCY,
  VOLUME,
} from "./bowelConstants";
import { PanelTimePicker } from "./PanelTimePicker";

const bristolValues = BRISTOL_SCALE.map((b) => b.value);

/* ── Types ── */

export interface BowelFormState {
  bristolCode: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  urgencyTag: "low" | "medium" | "high" | "immediate";
  effortTag: "none" | "some" | "hard" | "urgent-release";
  accident: boolean;
  notes: string;
  episodesCount: string;
  volumeTag: "small" | "medium" | "large" | "juices";
  timestampMs?: number;
}

interface BowelFormDraft {
  bristolCode: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  urgencyTag: BowelFormState["urgencyTag"];
  effortTag: BowelFormState["effortTag"];
  accident: boolean;
  notes: string;
  episodesCount: number;
  volumeTag: BowelFormState["volumeTag"];
}

const INITIAL_BOWEL_DRAFT: BowelFormDraft = {
  bristolCode: null,
  urgencyTag: "medium",
  effortTag: "some",
  accident: false,
  notes: "",
  episodesCount: 1,
  volumeTag: "medium",
};

interface BowelSectionProps {
  onSave: (state: BowelFormState) => Promise<void>;
  captureTimestamp?: number;
}

/* ── Sub-components ── */

function SeverityScale<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; icon: typeof Plus; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p
        className="text-[11px] font-mono uppercase tracking-wider"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </p>
      <div
        className="flex gap-1 rounded-xl p-1"
        style={{ border: "1px solid var(--section-bowel-border)" }}
      >
        {options.map((opt) => {
          const isSelected = value === opt.value;
          const colors = SEVERITY_COLORS[opt.value];
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-label={`${label}: ${opt.label}`}
              aria-pressed={isSelected}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 rounded-xl min-h-[44px] justify-center transition-all duration-200",
                !isSelected && "bg-(--surface-3) hover:bg-(--surface-0)",
              )}
              style={
                isSelected
                  ? {
                      backgroundColor: colors.bg,
                      boxShadow: `inset 0 0 0 1.5px ${colors.ring}, 0 0 8px var(--section-bowel-glow)`,
                    }
                  : undefined
              }
            >
              <Icon
                className={cn("h-4 w-4", !isSelected && "text-(--text-faint)")}
                style={isSelected ? { color: colors.text } : undefined}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-[10px] font-bold leading-none",
                  !isSelected && "text-(--text-faint)",
                )}
                style={isSelected ? { color: colors.text } : undefined}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TripStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl bg-(--surface-3) min-h-[44px] px-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Decrease trip count"
        className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-(--surface-0) disabled:opacity-30"
        style={{
          border: "1px solid var(--section-bowel-border)",
          color: "var(--section-bowel)",
        }}
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        className="min-w-[1.5rem] text-center font-display text-xl font-bold"
        style={{ color: "var(--section-bowel)" }}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(20, value + 1))}
        disabled={value >= 20}
        aria-label="Increase trip count"
        className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-(--surface-0) disabled:opacity-30"
        style={{
          border: "1px solid var(--section-bowel-border)",
          color: "var(--section-bowel)",
        }}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ── Main Component ── */

export function BowelSection({ onSave, captureTimestamp }: BowelSectionProps) {
  const bristolGroupName = useId();
  const [draft, setDraft] = useState<BowelFormDraft>({ ...INITIAL_BOWEL_DRAFT });
  const [saving, setSaving] = useState(false);
  // useRef guard prevents double-submit under React 18 concurrent rendering,
  // where two rapid invocations can both pass a useState check before either
  // state update commits.
  const submittingRef = useRef(false);

  const { timeValue, setTimeValue, dateValue, setDateValue, isEdited, getTimestampMs, reset } =
    usePanelTime(captureTimestamp);

  const prefersReducedMotion = useReducedMotion();

  const selectedBristol =
    draft.bristolCode !== null ? BRISTOL_SCALE.find((b) => b.value === draft.bristolCode) : null;
  const accent = draft.bristolCode !== null ? BRISTOL_ACCENT[draft.bristolCode] : null;

  const resetDraft = useCallback(() => {
    setDraft({ ...INITIAL_BOWEL_DRAFT });
  }, []);

  const handleSave = useCallback(async () => {
    if (submittingRef.current) return;
    if (draft.bristolCode === null) return;
    submittingRef.current = true;
    try {
      setSaving(true);
      await onSave({
        bristolCode: draft.bristolCode,
        urgencyTag: draft.urgencyTag,
        effortTag: draft.effortTag,
        accident: draft.accident,
        notes: draft.notes,
        episodesCount: String(draft.episodesCount),
        volumeTag: draft.volumeTag,
        timestampMs: getTimestampMs(),
      });
      resetDraft();
      reset();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to save bowel movement."));
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }, [
    draft.bristolCode,
    draft.urgencyTag,
    draft.effortTag,
    draft.accident,
    draft.notes,
    draft.episodesCount,
    draft.volumeTag,
    onSave,
    getTimestampMs,
    reset,
    resetDraft,
  ]);

  const handleBristolKeyDown = useCallback(
    (event: React.KeyboardEvent, currentValue: 1 | 2 | 3 | 4 | 5 | 6 | 7) => {
      const currentIndex = bristolValues.indexOf(currentValue);
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % bristolValues.length;
        setDraft((prev) => ({ ...prev, bristolCode: bristolValues[nextIndex] }));
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const prevIndex = (currentIndex - 1 + bristolValues.length) % bristolValues.length;
        setDraft((prev) => ({ ...prev, bristolCode: bristolValues[prevIndex] }));
      }
    },
    [],
  );

  return (
    <section className="glass-card glass-card-bowel rounded-2xl p-4 space-y-3">
      {/* Header */}
      <SectionHeader
        icon={HeartPulse}
        title="Bowel Movement"
        color="var(--section-bowel)"
        mutedColor="var(--section-bowel-muted)"
      />

      {/* ── Bristol Type Picker ── */}
      <div className="space-y-2">
        <div
          role="radiogroup"
          aria-label="Bristol stool type"
          className="flex gap-1 rounded-xl p-1"
          style={{ border: "1px solid var(--section-bowel-border)" }}
        >
          {BRISTOL_SCALE.map((option) => {
            const isSelected = draft.bristolCode === option.value;
            const typeAccent = BRISTOL_ACCENT[option.value];
            return (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>
                  <label
                    className={cn(
                      "relative flex-1 flex flex-col items-center gap-0.5 rounded-xl py-2 transition-all duration-200 cursor-pointer",
                      isSelected && "scale-[1.08] z-10",
                      !isSelected &&
                        "bg-(--surface-3) opacity-50 hover:opacity-80 hover:bg-(--surface-0)",
                    )}
                    style={
                      isSelected
                        ? {
                            backgroundColor: `${typeAccent.hex}18`,
                            boxShadow: `inset 0 0 0 2px ${typeAccent.hex}55, 0 0 12px ${typeAccent.hex}20`,
                          }
                        : undefined
                    }
                  >
                    <input
                      type="radio"
                      name={bristolGroupName}
                      checked={isSelected}
                      onChange={() => setDraft((prev) => ({ ...prev, bristolCode: option.value }))}
                      onKeyDown={(e) => handleBristolKeyDown(e, option.value)}
                      aria-label={`Bristol type ${option.value}: ${option.description}`}
                      className="sr-only"
                    />
                    <span aria-hidden="true">
                      <BristolIllustration type={option.value} size={isSelected ? 36 : 26} />
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold leading-tight text-center",
                        !isSelected && "text-(--text-faint)",
                      )}
                      style={isSelected ? { color: typeAccent.hex } : undefined}
                    >
                      {isSelected ? option.label : String(option.value)}
                    </span>
                  </label>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Type {option.value}: {option.description}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Spectrum bar + callout (only when a type is selected) */}
        {selectedBristol && accent && (
          <>
            <div className="relative px-2 pt-1 pb-0.5" aria-hidden="true">
              <div
                className="h-1 rounded-full opacity-40"
                style={{
                  background:
                    "linear-gradient(to right, #f87171, #fb923c 17%, #34d399 33%, #34d399 50%, #84cc16 67%, #fb923c 83%, #f87171)",
                }}
              />
              <div
                className="absolute top-[1px] h-3 w-3 rounded-full transition-all duration-300 ease-out"
                style={{
                  left: `calc(${SPECTRUM_POS[selectedBristol.value]}% - 4px)`,
                  backgroundColor: accent.hex,
                  border: "2px solid var(--surface-3)",
                  boxShadow: `0 0 8px ${accent.hex}80`,
                }}
              />
            </div>
            <p
              className="text-center text-sm font-semibold transition-colors duration-300"
              style={{ color: accent.hex }}
            >
              Type {selectedBristol.value} &middot; {selectedBristol.description}
            </p>
          </>
        )}
      </div>

      {/* ── Detail fields (revealed after Bristol type selection) ── */}
      <AnimatePresence>
        {draft.bristolCode !== null && (
          <motion.div
            initial={{ opacity: 0, height: prefersReducedMotion ? "auto" : 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: prefersReducedMotion ? "auto" : 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", bounce: 0.15, duration: 0.45 }
            }
            className="overflow-hidden space-y-3"
          >
            {/* ── Attributes Grid ── */}
            <fieldset className="border-none p-0 m-0">
              <legend className="sr-only">Bowel movement details</legend>

              {/* Urgency + Effort */}
              <div className="grid grid-cols-2 gap-2.5">
                <SeverityScale
                  label="Urgency"
                  options={URGENCY}
                  value={draft.urgencyTag}
                  onChange={(value) => setDraft((prev) => ({ ...prev, urgencyTag: value }))}
                />
                <SeverityScale
                  label="Effort"
                  options={EFFORT}
                  value={draft.effortTag}
                  onChange={(value) => setDraft((prev) => ({ ...prev, effortTag: value }))}
                />
              </div>

              {/* Volume + Accident + Trips */}
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                {/* Volume (left column) */}
                <div className="space-y-1.5">
                  <p
                    className="text-[11px] font-mono uppercase tracking-wider"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    Volume
                  </p>
                  <div className="flex gap-1">
                    {VOLUME.map((opt) => {
                      const isSelected = draft.volumeTag === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDraft((prev) => ({ ...prev, volumeTag: opt.value }))}
                          aria-label={`Volume: ${opt.label}`}
                          aria-pressed={isSelected}
                          className={cn(
                            "flex-1 flex flex-col items-center gap-0.5 rounded-xl min-h-[44px] justify-center transition-all duration-200",
                            !isSelected && "bg-(--surface-3) hover:bg-(--surface-0)",
                          )}
                          style={
                            isSelected
                              ? {
                                  backgroundColor: "var(--section-bowel-muted)",
                                  boxShadow: "inset 0 0 0 1.5px var(--section-bowel)",
                                }
                              : {
                                  border: "1px solid var(--section-bowel-border)",
                                }
                          }
                        >
                          <span
                            className="text-sm font-black leading-none tracking-[0.2em]"
                            style={{
                              color: isSelected ? "var(--section-bowel)" : "var(--text-faint)",
                            }}
                          >
                            {opt.visual}
                          </span>
                          <span
                            className="text-[10px] font-bold leading-none"
                            style={{
                              color: isSelected ? "var(--section-bowel)" : "var(--text-faint)",
                            }}
                          >
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Accident + Trips (right column) */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <p
                      className="text-[11px] font-mono uppercase tracking-wider"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      Accident
                    </p>
                    <p
                      className="text-center text-[11px] font-mono uppercase tracking-wider"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      Trips
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Accident toggle */}
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, accident: !prev.accident }))}
                      aria-pressed={draft.accident}
                      aria-label={draft.accident ? "Accident: yes" : "Accident: no"}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-xl transition-all duration-200",
                        draft.accident
                          ? "bg-red-500/15 text-red-400"
                          : "bg-(--surface-3) text-(--text-faint) hover:text-(--text-muted)",
                      )}
                      style={
                        draft.accident
                          ? {
                              boxShadow:
                                "inset 0 0 0 1.5px color-mix(in srgb, var(--red) 40%, transparent)",
                              border: "1px solid var(--section-bowel-border)",
                            }
                          : {
                              border: "1px solid var(--section-bowel-border)",
                            }
                      }
                    >
                      <AlertTriangle
                        className={cn(
                          "h-4 w-4",
                          draft.accident ? "text-red-500" : "text-(--text-faint)",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {/* Trips stepper */}
                    <TripStepper
                      value={draft.episodesCount}
                      onChange={(value) => setDraft((prev) => ({ ...prev, episodesCount: value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Time + Notes + Log BM row */}
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <div className="flex items-center gap-2">
                  <PanelTimePicker
                    timeValue={timeValue}
                    setTimeValue={setTimeValue}
                    dateValue={dateValue}
                    setDateValue={setDateValue}
                    isEdited={isEdited}
                    accentColor="var(--section-bowel)"
                  />
                  <Input
                    placeholder="Notes..."
                    value={draft.notes}
                    maxLength={400}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!saving) void handleSave();
                      }
                    }}
                    className="h-9 min-w-0 flex-1 text-sm text-(--text-muted) border-(--section-bowel-border) focus-visible:border-(--section-bowel) focus-visible:ring-(--section-bowel)/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div />
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-9 rounded-[6px] text-xs font-semibold text-white transition-all duration-200"
                    style={{
                      border: "none",
                      background: "var(--section-bowel)",
                      boxShadow: "0 0 12px var(--section-bowel-glow)",
                    }}
                  >
                    {saving ? "..." : "Log Bowel Movement"}
                  </Button>
                </div>
              </div>
            </fieldset>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
