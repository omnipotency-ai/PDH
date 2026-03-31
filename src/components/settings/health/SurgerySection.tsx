import { format, isValid, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatLocalDateKey } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import type { SurgeryType } from "@/types/domain";
import type { HealthSectionProps } from "./types";

const SURGERY_TYPE_OPTIONS = [
  "Colectomy with ileostomy",
  "Colectomy with colostomy",
  "Colectomy with primary anastomosis",
  "Ileostomy reversal",
  "Colostomy reversal",
] as const satisfies readonly SurgeryType[];

const VALID_SURGERY_TYPES: ReadonlySet<string> = new Set<string>([
  ...SURGERY_TYPE_OPTIONS,
  "Other",
]);

function isValidSurgeryType(value: string): value is SurgeryType {
  return VALID_SURGERY_TYPES.has(value);
}

export function SurgerySection({
  healthProfile,
  setHealthProfile,
}: Omit<HealthSectionProps, "unitSystem">) {
  const [surgeryDatePickerOpen, setSurgeryDatePickerOpen] = useState(false);

  const selectedSurgeryDate = (() => {
    if (!healthProfile.surgeryDate) return undefined;
    const parsed = parseISO(healthProfile.surgeryDate);
    return isValid(parsed) ? parsed : undefined;
  })();

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--section-health)]">
        Surgery Details
      </p>
      <p className="text-[10px] text-[var(--text-faint)]">
        Surgery type and date help time food progression from low-residue to broader reintroduction.
      </p>
      <div className="grid gap-2 sm:grid-cols-[1.3fr_1fr]">
        <div className="space-y-1">
          <Label className="text-[10px] text-[var(--text-faint)]">Type of surgery</Label>
          <select
            className="h-9 w-full rounded-xl border border-[var(--section-health-border)] bg-[var(--surface-0)] px-3 text-sm text-[var(--text)]"
            value={healthProfile.surgeryType}
            onChange={(e) => {
              const val = e.target.value;
              if (!isValidSurgeryType(val)) return;
              if (val === "Other") {
                setHealthProfile({ surgeryType: "Other" });
                return;
              }
              setHealthProfile({ surgeryType: val, surgeryTypeOther: "" });
            }}
            title="Type of surgery"
          >
            {SURGERY_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
          {healthProfile.surgeryType === "Other" && (
            <Input
              value={healthProfile.surgeryTypeOther}
              onChange={(e) => setHealthProfile({ surgeryTypeOther: e.target.value })}
              placeholder="Enter surgery type"
              className="h-9"
            />
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[var(--text-faint)]">Date of surgery</Label>
          <Popover open={surgeryDatePickerOpen} onOpenChange={setSurgeryDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex h-9 w-full items-center justify-between rounded-xl border border-[var(--section-health-border)] bg-[var(--surface-0)] px-2.5 text-left text-sm text-[var(--text)] transition-colors outline-none hover:border-[var(--section-health)]/50 focus-visible:border-[var(--section-health)]/60 focus-visible:ring-[3px] focus-visible:ring-[var(--section-health)]/20 data-[popup-open]:border-[var(--section-health)]/60 data-[popup-open]:ring-[3px] data-[popup-open]:ring-[var(--section-health)]/20",
                  !selectedSurgeryDate && "text-[var(--text-faint)]",
                )}
                aria-label="Choose surgery date"
              >
                <span className="truncate text-xs">
                  {selectedSurgeryDate ? format(selectedSurgeryDate, "dd/MM/yyyy") : "dd/mm/yyyy"}
                </span>
                <CalendarDays className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)]" />
              </button>
            </PopoverTrigger>
            <PopoverContent aria-label="Choose surgery date" className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedSurgeryDate}
                defaultMonth={selectedSurgeryDate ?? new Date()}
                onSelect={(date) => {
                  setHealthProfile({
                    surgeryDate: date ? formatLocalDateKey(date) : "",
                  });
                  if (date) setSurgeryDatePickerOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
