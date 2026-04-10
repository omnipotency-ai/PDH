import { Droplets, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { usePanelTime } from "@/hooks/usePanelTime";
import { useUnitSystem } from "@/hooks/useProfile";
import { getErrorMessage } from "@/lib/errors";
import { DEFAULT_FLUID_PRESETS } from "@/lib/fluidPresets";
import { flOzToMl, formatFluidDisplay, getDisplayFluidUnit } from "@/lib/units";
import type { FluidPreset } from "@/types/domain";
import { PanelTimePicker } from "./PanelTimePicker";

interface FluidSectionProps {
  onLogFluid: (
    name: string,
    milliliters: number,
    timestamp?: number,
  ) => Promise<string | undefined>;
  captureTimestamp?: number;
}

const MAX_FLUID_AMOUNT_ML = 5000;

export function FluidSection({ onLogFluid, captureTimestamp }: FluidSectionProps) {
  const { unitSystem } = useUnitSystem();
  const displayFluidUnit = getDisplayFluidUnit(unitSystem);

  const [saving, setSaving] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [otherName, setOtherName] = useState("");
  const [amountError, setAmountError] = useState("");
  const [otherNameError, setOtherNameError] = useState("");
  const otherNameRef = useRef<HTMLInputElement>(null);

  const { timeValue, setTimeValue, dateValue, setDateValue, isEdited, getTimestampMs, reset } =
    usePanelTime(captureTimestamp);

  const quickPresets: readonly FluidPreset[] = DEFAULT_FLUID_PRESETS;

  const parseAmountInputToMl = () => {
    const parsed = Number(amountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setAmountError(`Enter a valid amount in ${displayFluidUnit}.`);
      return null;
    }

    const milliliters = unitSystem === "metric" ? Math.round(parsed) : Math.round(flOzToMl(parsed));

    if (milliliters <= 0 || milliliters > MAX_FLUID_AMOUNT_ML) {
      setAmountError("Enter an amount between 1 and 5000 ml.");
      return null;
    }

    setAmountError("");
    return milliliters;
  };

  const handleLogSelectedFluid = async (name: string) => {
    const milliliters = parseAmountInputToMl();
    if (milliliters === null) return;

    try {
      setSaving(true);
      await onLogFluid(name, milliliters, getTimestampMs());
      toast.success(`${name} ${formatFluidDisplay(milliliters, unitSystem)} logged`);
      setAmountInput("");
      reset();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to log fluid."));
    } finally {
      setSaving(false);
    }
  };

  const handleOtherClick = () => {
    setShowOther(true);
    // Focus the name input after React renders
    requestAnimationFrame(() => {
      otherNameRef.current?.focus();
    });
  };

  const handleOtherSubmit = async () => {
    const name = otherName.trim();
    const milliliters = parseAmountInputToMl();
    let hasError = false;

    if (!name) {
      setOtherNameError("Enter a drink name.");
      hasError = true;
    } else {
      setOtherNameError("");
    }

    if (milliliters === null) hasError = true;
    if (hasError || milliliters === null) return;

    try {
      setSaving(true);
      await onLogFluid(name, milliliters, getTimestampMs());
      toast.success(`${name} ${formatFluidDisplay(milliliters, unitSystem)} logged`);
      setAmountInput("");
      setOtherName("");
      setShowOther(false);
      reset();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to log fluid."));
    } finally {
      setSaving(false);
    }
  };

  const fluidAmountErrorId = "fluid-amount-error";
  const otherNameErrorId = "fluid-other-name-error";

  return (
    <section data-slot="fluid-section" className="glass-card glass-card-fluid space-y-3 p-4">
      <SectionHeader
        icon={Droplets}
        title="Fluids"
        color="var(--section-fluid)"
        mutedColor="var(--section-fluid-muted)"
      />

      <PanelTimePicker
        timeValue={timeValue}
        setTimeValue={setTimeValue}
        dateValue={dateValue}
        setDateValue={setDateValue}
        isEdited={isEdited}
        accentColor="var(--section-fluid)"
        onEnterKey={() => {
          if (showOther) {
            void handleOtherSubmit();
          } else {
            void handleLogSelectedFluid("Water");
          }
        }}
      />

      <div className="flex  pb-2 snap-start">
        <div
          className="flex h-8 w-12 shrink-0 items-center border rounded-sm"
          style={{
            borderColor: amountError ? "var(--red)" : "var(--section-fluid-border)",
          }}
        >
          <Input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amountInput}
            onChange={(event) => {
              setAmountInput(event.target.value);
              if (amountError) setAmountError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (showOther) {
                  void handleOtherSubmit();
                } else {
                  void handleLogSelectedFluid("Water");
                }
              }
            }}
            aria-invalid={Boolean(amountError)}
            aria-describedby={amountError ? fluidAmountErrorId : undefined}
            placeholder={`${displayFluidUnit.toLowerCase()}s`}
            className="border-0 text-center text-xs shadow-none focus-visible:border-transparent focus-visible:ring-0"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleLogSelectedFluid("Water")}
          disabled={saving}
          className="flex h-8 w-11 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50 hover:bg-[var(--section-fluid-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--section-fluid)]/40"
          style={{
            color: "var(--section-fluid)",
            background: "transparent",
          }}
          aria-label="Log water"
        >
          <Droplets className="h-6 w-6" />
        </button>

        {quickPresets.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => void handleLogSelectedFluid(preset.name)}
            disabled={saving}
            className="flex h-8 shrink-0 items-center justify-center rounded-sm px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 hover:bg-[var(--section-fluid-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--section-fluid)]/40"
            style={{
              border: "1px solid var(--section-fluid-border)",
              color: "var(--section-fluid)",
              background: "transparent",
            }}
            aria-label={`Log ${preset.name}`}
          >
            {preset.name}
          </button>
        ))}
        <button
          type="button"
          onClick={handleOtherClick}
          disabled={saving}
          className="flex h-8 shrink-0 items-center justify-center rounded-sm px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 hover:bg-[var(--section-fluid-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--section-fluid)]/40"
          style={{
            border: "1px solid var(--section-fluid-border)",
            color: "var(--section-fluid)",
            background: showOther ? "var(--section-fluid-muted)" : "transparent",
          }}
          aria-label="Log a custom drink"
        >
          Other
        </button>
      </div>

      {amountError && (
        <p id={fluidAmountErrorId} role="alert" className="text-[11px] text-[var(--red)]">
          {amountError}
        </p>
      )}

      {showOther && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Input
              ref={otherNameRef}
              value={otherName}
              maxLength={20}
              onChange={(event) => {
                setOtherName(event.target.value);
                if (otherNameError) setOtherNameError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleOtherSubmit();
              }}
              placeholder="Drink name"
              aria-invalid={Boolean(otherNameError)}
              aria-describedby={otherNameError ? otherNameErrorId : undefined}
              className="h-8 flex-1 min-w-0 rounded-[6px] px-2.5 text-xs text-[var(--text)] placeholder:text-[var(--text-faint)]"
              style={{
                border: otherNameError
                  ? "1px solid var(--red)"
                  : "1px solid var(--section-fluid-border)",
                background: "var(--section-fluid-muted)",
              }}
            />
            <button
              type="button"
              onClick={() => void handleOtherSubmit()}
              disabled={saving}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] transition-colors disabled:opacity-50"
              style={{
                border: "none",
                background: "var(--section-fluid)",
                color: "#ffffff",
                boxShadow: "0 0 12px var(--section-fluid-glow)",
              }}
              aria-label="Log other drink"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {otherNameError && (
            <p id={otherNameErrorId} role="alert" className="text-[11px] text-[var(--red)]">
              {otherNameError}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
