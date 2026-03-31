import { format } from "date-fns";
import { CalendarDays, ChevronDown, Droplet, Venus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHealthProfile } from "@/hooks/useProfile";
import { formatLocalDateKey } from "@/lib/dateUtils";
import { getErrorMessage } from "@/lib/errors";
import {
  parseDateOnly,
  REPRODUCTIVE_BLEEDING_OPTIONS,
  REPRODUCTIVE_SYMPTOM_OPTIONS,
} from "@/lib/reproductiveHealth";
import type { ReproductiveBleedingStatus, ReproductiveSymptom } from "@/types/domain";

export interface CycleLogFormState {
  periodStartDate: string;
  bleedingStatus: ReproductiveBleedingStatus;
  symptoms: ReproductiveSymptom[];
  notes: string;
}

interface CycleHormonalSectionProps {
  onSave: (state: CycleLogFormState) => Promise<void>;
}

const BLEEDING_BUTTON_UI: Record<
  ReproductiveBleedingStatus,
  { tooltip: string; color: string; bg: string; border: string }
> = {
  none: {
    tooltip: "No bleeding today",
    color: "#38bdf8", // blue
    bg: "rgba(56, 189, 248, 0.1)",
    border: "#f673bb",
  },
  spotting: {
    tooltip: "Spotting today",
    color: "#f97316",
    bg: "rgba(251, 191, 36, 0.1)",
    border: "#f673bb",
  },
  light: {
    tooltip: "Light bleeding today",
    color: "#F84F71",
    bg: "rgba(249, 115, 22, 0.1)",
    border: "#f673bb",
  },
  medium: {
    tooltip: "Medium bleeding today",
    color: "#F51441", // pink/coral
    bg: "rgba(244, 114, 182, 0.1)",
    border: "#f673bb",
  },
  heavy: {
    tooltip: "Heavy bleeding today",
    color: "#C4082E", // red
    bg: "rgba(248, 113, 113, 0.1)",
    border: "#f673bb",
  },
};

function BleedingGlyph({ status }: { status: ReproductiveBleedingStatus }) {
  if (status === "none") {
    return <span className="font-mono text-sm leading-none">—</span>;
  }

  const drop = <Droplet className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden="true" />;

  if (status === "spotting") {
    return <div className="grid h-4 w-4 place-items-center">{drop}</div>;
  }

  if (status === "light") {
    return (
      <div className="grid h-4 w-5 grid-cols-2 place-items-center gap-0.5">
        {drop}
        {drop}
      </div>
    );
  }

  if (status === "medium") {
    return (
      <div className="grid h-5 w-5 grid-cols-2 place-items-center gap-x-0.5 gap-y-0">
        <div className="col-span-2 flex justify-center">{drop}</div>
        {drop}
        {drop}
      </div>
    );
  }

  return (
    <div className="grid h-5 w-5 grid-cols-2 place-items-center gap-0.5">
      {drop}
      {drop}
      {drop}
      {drop}
    </div>
  );
}

export function CycleHormonalSection({ onSave }: CycleHormonalSectionProps) {
  const { healthProfile } = useHealthProfile();
  const reproductiveHealth = healthProfile?.reproductiveHealth;

  const [panelOpen, setPanelOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [bleedingStatus, setBleedingStatus] = useState<ReproductiveBleedingStatus>("none");
  const [symptoms, setSymptoms] = useState<ReproductiveSymptom[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleSymptom = (symptom: ReproductiveSymptom) => {
    setSymptoms((current) =>
      current.includes(symptom)
        ? current.filter((value) => value !== symptom)
        : [...current, symptom],
    );
  };

  const handleSave = async () => {
    if (!periodStartDate) {
      toast.error("Please choose the period start date for this cycle.");
      return;
    }

    try {
      setSaving(true);
      await onSave({
        periodStartDate,
        bleedingStatus,
        symptoms,
        notes,
      });
      setPeriodStartDate("");
      setBleedingStatus("none");
      setSymptoms([]);
      setNotes("");
      setPanelOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to save cycle entry."));
    } finally {
      setSaving(false);
    }
  };

  const selectedPeriodStartDate = parseDateOnly(periodStartDate);

  if (!reproductiveHealth?.trackingEnabled || !reproductiveHealth?.cycleTrackingEnabled) {
    return null;
  }

  return (
    <section className="glass-card glass-card-summary space-y-3 p-4">
      <button
        type="button"
        onClick={() => setPanelOpen((value) => !value)}
        className="section-header flex w-full items-center justify-between rounded-lg text-left"
        aria-expanded={panelOpen}
        aria-controls="cycle-details"
      >
        <div className="flex items-center gap-2">
          <div className="section-icon bg-[var(--section-summary-muted)]">
            <Venus className="h-4 w-4 text-[var(--section-summary)]" />
          </div>
          <span className="section-title text-[var(--section-summary)]">Reproductive Health</span>
        </div>

        <ChevronDown
          className={`h-4 w-4 text-[var(--section-summary)] transition-transform ${panelOpen ? "rotate-180" : ""}`}
        />
      </button>

      {panelOpen && (
        <div id="cycle-details" className="space-y-3">
          <div className="grid grid-cols-[8.25rem_minmax(0,1fr)] items-end gap-2">
            <div className="space-y-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
                    Period start
                  </span>
                </TooltipTrigger>
                <TooltipContent>Start date of your period</TooltipContent>
              </Tooltip>

              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`flex h-9 w-full items-center justify-between rounded-md border px-2.5 text-left text-sm transition-colors outline-none ${
                      selectedPeriodStartDate
                        ? "border-(--section-summary-border) bg-(--surface-0) text-(--text-muted)"
                        : "border-(--section-summary-border) bg-(--surface-0) text-(--text-faint)"
                    } hover:border-[var(--section-summary)]/50 focus-visible:border-[var(--section-summary)]/60 focus-visible:ring-[3px] focus-visible:ring-[var(--section-summary)]/20 data-[popup-open]:border-[var(--section-summary)]/60 data-[popup-open]:ring-[3px] data-[popup-open]:ring-[var(--section-summary)]/20`}
                    aria-label="Choose period start date"
                  >
                    <span className="truncate font-mono text-xs">
                      {selectedPeriodStartDate
                        ? format(selectedPeriodStartDate, "dd/MM/yyyy")
                        : "dd/mm/yyyy"}
                    </span>
                    <CalendarDays className="h-4 w-4 flex-shrink-0 text-(--text-muted)" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  aria-label="Choose period start date"
                  className="w-auto p-0"
                  align="start"
                >
                  <Calendar
                    mode="single"
                    selected={selectedPeriodStartDate ?? undefined}
                    defaultMonth={selectedPeriodStartDate ?? new Date()}
                    onSelect={(date) => {
                      setPeriodStartDate(date ? formatLocalDateKey(date) : "");
                      if (date) setDatePickerOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
                Bleeding
              </span>
              <div className="grid grid-cols-5 gap-1">
                {REPRODUCTIVE_BLEEDING_OPTIONS.map((option) => {
                  const active = bleedingStatus === option.value;
                  const ui = BLEEDING_BUTTON_UI[option.value];
                  return (
                    <Tooltip key={option.value}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setBleedingStatus(option.value)}
                          aria-pressed={active}
                          aria-label={ui.tooltip}
                          className="flex h-9 items-center justify-center rounded-md border px-1 transition-colors outline-none bg-(--surface-0) focus-visible:ring-1 focus-visible:ring-(--section-summary)/30"
                          style={{
                            borderColor: active ? ui.border : "var(--border)",
                            backgroundColor: active ? ui.bg : undefined,
                            color: active ? ui.color : "var(--text-muted)",
                          }}
                        >
                          <BleedingGlyph status={option.value} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{ui.tooltip}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </div>

          <fieldset className="space-y-1 border-none p-0 m-0">
            <legend className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
              Symptoms
            </legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {REPRODUCTIVE_SYMPTOM_OPTIONS.map((option) => {
                const selected = symptoms.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleSymptom(option.value)}
                    className={`min-h-6 rounded-sm border border-(--section-summary-border) px-1 py-1 text-[11px] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-(--section-summary)/30 ${
                      selected
                        ? "bg-(--section-summary-muted) text-(--section-summary)"
                        : "bg-(--surface-3) text-(--text-faint) hover:text-(--section-summary)"
                    }`}
                    aria-pressed={selected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-center gap-2">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={400}
              placeholder="Notes"
              className="h-9 flex-1 border-(--section-summary-border) bg-(--surface-0) text-(--text-muted) placeholder:text-(--text-faint) hover:border-(--section-summary-border) focus-visible:border-(--section-summary)/60 focus-visible:ring-(--section-summary)/20"
              style={{ boxShadow: "inset 0 0 8px var(--section-summary-glow)" }}
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="h-9 rounded-md bg-(--section-summary) px-3 text-sm font-semibold text-pink-50 transition-colors outline-none hover:opacity-90 active:opacity-80 focus-visible:ring-[3px] focus-visible:ring-(--section-summary)/30 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Cycle"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
