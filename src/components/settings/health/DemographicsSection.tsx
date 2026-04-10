import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cmToInches,
  displayWeightToKg,
  feetInchesToCm,
  getDisplayWeightUnit,
  getWeightUnitLabel,
  inchesToCm,
  isImperialUnitSystem,
  kgToDisplayWeight,
} from "@/lib/units";
import type { Gender } from "@/types/domain";
import type { HealthSectionProps } from "./types";

const VALID_GENDERS: ReadonlySet<string> = new Set<string>([
  "",
  "male",
  "female",
  "non_binary",
  "prefer_not_to_say",
]);

function isValidGender(value: string): value is Gender {
  return VALID_GENDERS.has(value);
}

// Inline field error state for out-of-range numeric inputs.
type FieldErrors = {
  age?: string;
  height?: string;
  weight?: string;
};

export function DemographicsSection({
  healthProfile,
  setHealthProfile,
  unitSystem,
}: HealthSectionProps) {
  const [imperialHeightMode, setImperialHeightMode] = useState<"ft_in" | "inches">("ft_in");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const isImperial = isImperialUnitSystem(unitSystem);
  const displayWeightUnit = getDisplayWeightUnit(unitSystem);
  const weightUnitLabel = getWeightUnitLabel(unitSystem);

  const computedBmi = (() => {
    const weightKg = healthProfile.currentWeight ?? healthProfile.startingWeight;
    if (!weightKg || !healthProfile.height) return null;
    const heightM = healthProfile.height / 100;
    return (weightKg / (heightM * heightM)).toFixed(1);
  })();

  const heightDisplayValue =
    healthProfile.height == null ? "" : String(Math.round(healthProfile.height));

  const totalInchesValue =
    healthProfile.height == null ? "" : String(Number(cmToInches(healthProfile.height).toFixed(1)));

  const feetInches = (() => {
    if (healthProfile.height == null) return { feet: "", inches: "" };
    const roundedTotalInches = Math.max(0, Math.round(cmToInches(healthProfile.height)));
    const feet = Math.floor(roundedTotalInches / 12);
    const inches = roundedTotalInches % 12;
    return { feet: String(feet), inches: String(inches) };
  })();

  const startingWeightDisplayValue = (() => {
    const weightKg = healthProfile.startingWeight;
    if (weightKg == null) return "";
    return String(Number(kgToDisplayWeight(weightKg, unitSystem).toFixed(1)));
  })();

  const currentWeightDisplayValue = (() => {
    const weightKg = healthProfile.currentWeight;
    if (weightKg == null) return null;
    return `${Number(kgToDisplayWeight(weightKg, unitSystem).toFixed(1))} ${weightUnitLabel}`;
  })();

  const weightChangeDisplayValue = (() => {
    const startKg = healthProfile.startingWeight;
    const currentKg = healthProfile.currentWeight;
    if (startKg == null || currentKg == null || startKg <= 0) return null;
    const deltaKg = currentKg - startKg;
    const deltaDisplay = `${deltaKg > 0 ? "+" : ""}${Number(
      kgToDisplayWeight(deltaKg, unitSystem).toFixed(1),
    )} ${weightUnitLabel}`;
    const pct = (deltaKg / startKg) * 100;
    const pctDisplay = `${pct > 0 ? "+" : ""}${Number(pct.toFixed(1))}%`;
    return `${deltaDisplay} (${pctDisplay})`;
  })();

  const setHeightFromDisplayCm = (raw: string) => {
    setFieldErrors(({ height: _h, ...rest }) => rest);
    if (!raw) {
      setHealthProfile({ height: null });
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    setHealthProfile({ height: Math.max(0, Math.min(250, Math.round(value))) });
  };

  const validateHeightCmOnBlur = (raw: string) => {
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 50 || value > 250) {
      const msg = "Enter a number between 50 and 250 cm.";
      setFieldErrors((prev) => ({ ...prev, height: msg }));
      toast.error(msg);
    }
  };

  const setHeightFromTotalInches = (raw: string) => {
    setFieldErrors(({ height: _h, ...rest }) => rest);
    if (!raw) {
      setHealthProfile({ height: null });
      return;
    }
    const inches = Number(raw);
    if (!Number.isFinite(inches)) return;
    const cm = inchesToCm(inches);
    setHealthProfile({ height: Math.max(0, Math.min(250, Math.round(cm))) });
  };

  const validateHeightInchesOnBlur = (raw: string) => {
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 20 || value > 100) {
      const msg = "Enter a number between 20 and 100 inches.";
      setFieldErrors((prev) => ({ ...prev, height: msg }));
      toast.error(msg);
    }
  };

  const setHeightFromFeetAndInches = (feetRaw: string, inchesRaw: string) => {
    setFieldErrors(({ height: _h, ...rest }) => rest);
    if (!feetRaw && !inchesRaw) {
      setHealthProfile({ height: null });
      return;
    }
    const feet = feetRaw ? Number(feetRaw) : 0;
    const inches = inchesRaw ? Number(inchesRaw) : 0;
    if (!Number.isFinite(feet) || !Number.isFinite(inches)) return;
    const boundedFeet = Math.max(0, Math.min(9, Math.round(feet)));
    const boundedInches = Math.max(0, Math.min(11, Math.round(inches)));
    const cm = feetInchesToCm(boundedFeet, boundedInches);
    setHealthProfile({ height: Math.max(0, Math.min(250, Math.round(cm))) });
  };

  // Declare input bounds before the validators that reference them (avoids TDZ).
  const heightInputPlaceholder = "Height (cm)";
  const weightInputPlaceholder =
    displayWeightUnit === "kg"
      ? "Starting weight (kg)"
      : displayWeightUnit === "stones"
        ? "Starting weight (st)"
        : "Starting weight (lb)";
  const heightInputMin = 50;
  const heightInputMax = 250;
  const heightInputStep = 1;
  const weightInputMin = displayWeightUnit === "kg" ? 20 : displayWeightUnit === "stones" ? 3 : 44;
  const weightInputMax =
    displayWeightUnit === "kg" ? 500 : displayWeightUnit === "stones" ? 80 : 1100;
  const weightInputStep = 0.1;

  const setStartingWeightFromDisplay = (raw: string) => {
    setFieldErrors(({ weight: _w, ...rest }) => rest);
    if (!raw) {
      setHealthProfile({ startingWeight: null });
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const kg = displayWeightToKg(value, unitSystem);
    const normalized = Math.max(0, Math.min(500, Number(kg.toFixed(1))));
    setHealthProfile({
      startingWeight: normalized,
    });
  };

  const validateWeightOnBlur = (raw: string) => {
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < weightInputMin || value > weightInputMax) {
      const msg = `Enter a number between ${weightInputMin} and ${weightInputMax} ${weightUnitLabel}.`;
      setFieldErrors((prev) => ({ ...prev, weight: msg }));
      toast.error(msg);
    }
  };

  const setAgeFromDisplay = (raw: string) => {
    setFieldErrors(({ age: _a, ...rest }) => rest);
    if (!raw) {
      setHealthProfile({ ageYears: null });
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    setHealthProfile({
      ageYears: Math.max(0, Math.min(120, Math.round(value))),
    });
  };

  const validateAgeOnBlur = (raw: string) => {
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 120) {
      const msg = "Enter a number between 0 and 120.";
      setFieldErrors((prev) => ({ ...prev, age: msg }));
      toast.error(msg);
    }
  };
  const ageValue = healthProfile.ageYears == null ? "" : String(healthProfile.ageYears);

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--section-health)]">
        About You
      </p>
      <p className="text-[10px] text-[var(--text-faint)]">
        Age, sex, height, and weight give Dr. Poo basic clinical context and keep BMI current.
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="demographics-sex" className="text-[10px] text-[var(--text-faint)]">
            Sex
          </Label>
          <select
            id="demographics-sex"
            className="h-9 w-full rounded-xl border border-[var(--section-health-border)] bg-[var(--surface-0)] px-3 text-sm text-[var(--text)]"
            value={healthProfile.gender}
            onChange={(e) => {
              const val = e.target.value;
              if (!isValidGender(val)) return;
              setHealthProfile({ gender: val });
            }}
            title="Sex"
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non_binary">Non-binary</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="demographics-age" className="text-[10px] text-[var(--text-faint)]">
            Age (years)
          </Label>
          <Input
            id="demographics-age"
            type="number"
            value={ageValue}
            onChange={(e) => setAgeFromDisplay(e.target.value)}
            onBlur={(e) => validateAgeOnBlur(e.target.value)}
            placeholder="Age"
            className="h-9 w-full"
            min={0}
            max={120}
            step={1}
            aria-invalid={!!fieldErrors.age}
          />
          {fieldErrors.age && (
            <p role="alert" className="text-[10px] text-red-400">
              {fieldErrors.age}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="demographics-height" className="text-[10px] text-[var(--text-faint)]">
            Height ({isImperial ? "imperial" : "cm"})
          </Label>
          {isImperial ? (
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setImperialHeightMode("ft_in")}
                  className={`h-7 rounded border px-2 text-[10px] ${
                    imperialHeightMode === "ft_in"
                      ? "border-[var(--section-health)] bg-[var(--section-health-muted)]"
                      : "border-[var(--section-health-border)] bg-[var(--surface-0)]"
                  }`}
                >
                  ft + in
                </button>
                <button
                  type="button"
                  onClick={() => setImperialHeightMode("inches")}
                  className={`h-7 rounded border px-2 text-[10px] ${
                    imperialHeightMode === "inches"
                      ? "border-[var(--section-health)] bg-[var(--section-health-muted)]"
                      : "border-[var(--section-health-border)] bg-[var(--surface-0)]"
                  }`}
                >
                  inches
                </button>
              </div>
              {imperialHeightMode === "ft_in" ? (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={feetInches.feet}
                    onChange={(e) => setHeightFromFeetAndInches(e.target.value, feetInches.inches)}
                    placeholder="ft"
                    className="h-9 min-w-0 flex-1"
                    min={0}
                    max={9}
                    step={1}
                  />
                  <Input
                    type="number"
                    value={feetInches.inches}
                    onChange={(e) => setHeightFromFeetAndInches(feetInches.feet, e.target.value)}
                    placeholder="in"
                    className="h-9 min-w-0 flex-1"
                    min={0}
                    max={11}
                    step={1}
                  />
                </div>
              ) : (
                <Input
                  type="number"
                  value={totalInchesValue}
                  onChange={(e) => setHeightFromTotalInches(e.target.value)}
                  onBlur={(e) => validateHeightInchesOnBlur(e.target.value)}
                  placeholder="Height (in)"
                  className="h-9 w-full"
                  min={20}
                  max={100}
                  step={0.1}
                />
              )}
            </div>
          ) : (
            <Input
              id="demographics-height"
              type="number"
              value={heightDisplayValue}
              onChange={(e) => setHeightFromDisplayCm(e.target.value)}
              onBlur={(e) => validateHeightCmOnBlur(e.target.value)}
              placeholder={heightInputPlaceholder}
              className="h-9 w-full"
              min={heightInputMin}
              max={heightInputMax}
              step={heightInputStep}
              aria-invalid={!!fieldErrors.height}
            />
          )}
          {fieldErrors.height && (
            <p role="alert" className="text-[10px] text-red-400">
              {fieldErrors.height}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="demographics-weight" className="text-[10px] text-[var(--text-faint)]">
            Baseline weight ({weightUnitLabel})
          </Label>
          <Input
            id="demographics-weight"
            type="number"
            value={startingWeightDisplayValue}
            onChange={(e) => setStartingWeightFromDisplay(e.target.value)}
            onBlur={(e) => validateWeightOnBlur(e.target.value)}
            placeholder={weightInputPlaceholder}
            className="h-9 w-full"
            min={weightInputMin}
            max={weightInputMax}
            step={weightInputStep}
            aria-invalid={!!fieldErrors.weight}
          />
          {fieldErrors.weight && (
            <p role="alert" className="text-[10px] text-red-400">
              {fieldErrors.weight}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        {computedBmi ? (
          <span>
            BMI: <span className="font-semibold text-[var(--section-health)]">{computedBmi}</span>
          </span>
        ) : (
          <span className="text-[var(--text-faint)]">BMI: enter height & weight to calculate</span>
        )}
        {currentWeightDisplayValue && (
          <>
            <span className="text-[var(--text-faint)]">·</span>
            <span>Latest weigh-in: {currentWeightDisplayValue}</span>
          </>
        )}
        {weightChangeDisplayValue && (
          <>
            <span className="text-[var(--text-faint)]">·</span>
            <span>Change from surgery start: {weightChangeDisplayValue}</span>
          </>
        )}
      </div>
      <p className="text-[10px] text-[var(--text-faint)]">
        Baseline weight is your reference point. Latest weight syncs from Quick Capture weigh-ins.
      </p>
    </div>
  );
}
