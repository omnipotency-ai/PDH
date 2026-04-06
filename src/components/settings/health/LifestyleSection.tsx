import { CollapsibleSection } from "@/components/settings/CollapsibleSectionHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeFrequency } from "@/lib/settingsUtils";
import type { AlcoholUse, RecreationalCategory, SmokingStatus, YesNoChoice } from "@/types/domain";
import { FrequencySelect, YesNoRadioGroup } from "./SubstanceTrackingField";
import type { HealthSectionProps } from "./types";

type NumericHealthProfileKey =
  | "smokingCigarettesPerDay"
  | "smokingYears"
  | "alcoholYearsAtCurrentLevel"
  | "recreationalStimulantsYears"
  | "recreationalDepressantsYears";

function resolveSmokingChoice(status: SmokingStatus | undefined): YesNoChoice {
  if (status === "yes") return "yes";
  if (status === "no" || status === "never") return "no";
  if (status === "former" || status === "current") return "yes";
  return "";
}

function resolveAlcoholChoice(alcoholUse: AlcoholUse | undefined): YesNoChoice {
  if (alcoholUse === "yes") return "yes";
  if (alcoholUse === "no" || alcoholUse === "none") return "no";
  if (alcoholUse === "occasional" || alcoholUse === "regular") return "yes";
  return "";
}

export function LifestyleSection({
  healthProfile,
  setHealthProfile,
}: Omit<HealthSectionProps, "unitSystem">) {
  const smokingChoice = resolveSmokingChoice(healthProfile.smokingStatus);

  const alcoholChoice = resolveAlcoholChoice(healthProfile.alcoholUse);

  const recreationalChoice: YesNoChoice = (() => {
    const value = (healthProfile.recreationalDrugUse ?? "").trim().toLowerCase();
    if (!value) return "";
    if (value === "no" || value === "none" || value === "never") return "no";
    return "yes";
  })();

  const alcoholFrequencyChoice = normalizeFrequency(healthProfile.alcoholFrequency);
  const stimulantsFrequencyChoice = normalizeFrequency(
    healthProfile.recreationalStimulantsFrequency,
  );
  const depressantsFrequencyChoice = normalizeFrequency(
    healthProfile.recreationalDepressantsFrequency,
  );
  const selectedRecreationalCategories = healthProfile.recreationalCategories ?? [];
  const stimulantsSelected = selectedRecreationalCategories.includes("stimulants");
  const depressantsSelected = selectedRecreationalCategories.includes("depressants");

  const setSmokingChoice = (value: string) => {
    if (value !== "yes" && value !== "no" && value !== "") return;
    const status: SmokingStatus = value;
    setHealthProfile({ smokingStatus: status });
  };

  const setAlcoholChoice = (value: string) => {
    if (value !== "yes" && value !== "no" && value !== "") return;
    const nextValue: AlcoholUse = value;
    if (nextValue === "no") {
      setHealthProfile({
        alcoholUse: "no",
        alcoholAmountPerSession: "",
        alcoholFrequency: "",
        alcoholYearsAtCurrentLevel: null,
      });
      return;
    }
    setHealthProfile({ alcoholUse: nextValue });
  };

  const setRecreationalChoice = (value: string) => {
    if (value !== "yes" && value !== "no" && value !== "") return;
    const nextValue: YesNoChoice = value;
    if (nextValue === "no") {
      setHealthProfile({
        recreationalDrugUse: "no",
        recreationalCategories: [],
        recreationalStimulantsFrequency: "",
        recreationalStimulantsYears: null,
        recreationalDepressantsFrequency: "",
        recreationalDepressantsYears: null,
      });
      return;
    }
    setHealthProfile({ recreationalDrugUse: nextValue });
  };

  const setFrequency = (
    key:
      | "alcoholFrequency"
      | "recreationalStimulantsFrequency"
      | "recreationalDepressantsFrequency",
    value: string,
  ) => {
    const nextValue = normalizeFrequency(value);
    switch (key) {
      case "alcoholFrequency":
        setHealthProfile({ alcoholFrequency: nextValue });
        break;
      case "recreationalStimulantsFrequency":
        setHealthProfile({ recreationalStimulantsFrequency: nextValue });
        break;
      case "recreationalDepressantsFrequency":
        setHealthProfile({ recreationalDepressantsFrequency: nextValue });
        break;
    }
  };

  const setNumeric = (raw: string, key: NumericHealthProfileKey) => {
    const value = raw ? Number(raw) : null;
    if (value !== null && !Number.isFinite(value)) return;
    switch (key) {
      case "smokingCigarettesPerDay":
        setHealthProfile({ smokingCigarettesPerDay: value });
        break;
      case "smokingYears":
        setHealthProfile({ smokingYears: value });
        break;
      case "alcoholYearsAtCurrentLevel":
        setHealthProfile({ alcoholYearsAtCurrentLevel: value });
        break;
      case "recreationalStimulantsYears":
        setHealthProfile({ recreationalStimulantsYears: value });
        break;
      case "recreationalDepressantsYears":
        setHealthProfile({ recreationalDepressantsYears: value });
        break;
    }
  };

  const toggleRecreationalCategory = (category: RecreationalCategory) => {
    const current = healthProfile.recreationalCategories ?? [];
    const wasSelected = current.includes(category);
    const next = wasSelected
      ? current.filter((entry) => entry !== category)
      : [...current, category];
    if (!wasSelected) {
      setHealthProfile({ recreationalCategories: next });
      return;
    }
    if (category === "stimulants") {
      setHealthProfile({
        recreationalCategories: next,
        recreationalStimulantsFrequency: "",
        recreationalStimulantsYears: null,
      });
      return;
    }
    if (category === "depressants") {
      setHealthProfile({
        recreationalCategories: next,
        recreationalDepressantsFrequency: "",
        recreationalDepressantsYears: null,
      });
      return;
    }
    setHealthProfile({ recreationalCategories: next });
  };

  return (
    <CollapsibleSection
      title="Lifestyle Factors"
      description="Long-term lifestyle patterns can affect gut motility, healing, and hydration. We collect this to normalise your baseline and highlight when use is above or below your usual pattern."
    >
      <div className="space-y-3">
        {/* Smoking */}
        <div className="space-y-2 rounded-xl border border-[var(--section-health-border)] bg-[var(--surface-1)] p-3">
          <p className="text-sm font-semibold text-[var(--text)]">Smoking</p>
          <p className="text-[10px] text-[var(--text-muted)]">
            Smoking can affect gut motility and tissue healing. We use this to understand your
            baseline and avoid over-attributing symptoms to food alone.
          </p>
          <YesNoRadioGroup
            name="smoking-status"
            value={smokingChoice}
            onChange={setSmokingChoice}
          />
          {smokingChoice === "yes" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-[var(--text-faint)]">Cigarettes per day</Label>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={healthProfile.smokingCigarettesPerDay ?? ""}
                  onChange={(e) => setNumeric(e.target.value, "smokingCigarettesPerDay")}
                  placeholder="e.g. 10"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-[var(--text-faint)]">Years smoking</Label>
                <Input
                  type="number"
                  min={0}
                  max={80}
                  value={healthProfile.smokingYears ?? ""}
                  onChange={(e) => setNumeric(e.target.value, "smokingYears")}
                  placeholder="e.g. 6"
                  className="h-9"
                />
              </div>
            </div>
          )}
        </div>

        {/* Alcohol */}
        <div className="space-y-2 rounded-xl border border-[var(--section-health-border)] bg-[var(--surface-1)] p-3">
          <p className="text-sm font-semibold text-[var(--text)]">Alcohol</p>
          <p className="text-[10px] text-[var(--text-muted)]">
            Alcohol can affect hydration, gut irritation, and acid balance. This helps us normalise
            your usual pattern when reviewing symptom changes.
          </p>
          <YesNoRadioGroup name="alcohol-use" value={alcoholChoice} onChange={setAlcoholChoice} />
          {alcoholChoice === "yes" && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-[var(--text-faint)]">Amount per session</Label>
                <Input
                  value={healthProfile.alcoholAmountPerSession ?? ""}
                  maxLength={120}
                  onChange={(e) =>
                    setHealthProfile({
                      alcoholAmountPerSession: e.target.value,
                    })
                  }
                  placeholder="e.g. 3 drinks"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-[var(--text-faint)]">How often</Label>
                <FrequencySelect
                  value={alcoholFrequencyChoice}
                  onChange={(v) => setFrequency("alcoholFrequency", v)}
                  title="Alcohol frequency"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-[var(--text-faint)]">Years at this level</Label>
                <Input
                  type="number"
                  min={0}
                  max={80}
                  value={healthProfile.alcoholYearsAtCurrentLevel ?? ""}
                  onChange={(e) => setNumeric(e.target.value, "alcoholYearsAtCurrentLevel")}
                  placeholder="e.g. 4"
                  className="h-9"
                />
              </div>
            </div>
          )}
        </div>

        {/* Recreational Substances */}
        <div className="space-y-2 rounded-xl border border-[var(--section-health-border)] bg-[var(--surface-1)] p-3">
          <p className="text-sm font-semibold text-[var(--text)]">Recreational Substances</p>
          <p className="text-[10px] text-[var(--text-muted)]">
            Stimulants can speed bowel passage and depressants can slow it. We use this to
            contextualise motility and hydration trends against your normal baseline.
          </p>
          <YesNoRadioGroup
            name="recreational-use"
            value={recreationalChoice}
            onChange={setRecreationalChoice}
          />
          {recreationalChoice === "yes" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-lg border border-[var(--section-health-border)] px-3 py-2">
                <Label className="text-sm text-[var(--text)]">Stimulants</Label>
                <input
                  type="checkbox"
                  checked={stimulantsSelected}
                  onChange={() => toggleRecreationalCategory("stimulants")}
                  className="h-3.5 w-3.5 accent-[var(--section-health)]"
                  aria-label="Track stimulant use"
                />
              </div>
              {stimulantsSelected && (
                <div className="grid gap-2 rounded-lg border border-[var(--section-health-border)] p-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[var(--text-faint)]">Frequency of use</Label>
                    <FrequencySelect
                      value={stimulantsFrequencyChoice}
                      onChange={(v) => setFrequency("recreationalStimulantsFrequency", v)}
                      title="Stimulants frequency"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[var(--text-faint)]">
                      Years at this level
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={80}
                      value={healthProfile.recreationalStimulantsYears ?? ""}
                      onChange={(e) => setNumeric(e.target.value, "recreationalStimulantsYears")}
                      placeholder="e.g. 5"
                      className="h-9"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-[var(--section-health-border)] px-3 py-2">
                <Label className="text-sm text-[var(--text)]">Depressants</Label>
                <input
                  type="checkbox"
                  checked={depressantsSelected}
                  onChange={() => toggleRecreationalCategory("depressants")}
                  className="h-3.5 w-3.5 accent-[var(--section-health)]"
                  aria-label="Track depressant use"
                />
              </div>
              {depressantsSelected && (
                <div className="grid gap-2 rounded-lg border border-[var(--section-health-border)] p-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[var(--text-faint)]">Frequency of use</Label>
                    <FrequencySelect
                      value={depressantsFrequencyChoice}
                      onChange={(v) => setFrequency("recreationalDepressantsFrequency", v)}
                      title="Depressants frequency"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-[var(--text-faint)]">
                      Years at this level
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={80}
                      value={healthProfile.recreationalDepressantsYears ?? ""}
                      onChange={(e) => setNumeric(e.target.value, "recreationalDepressantsYears")}
                      placeholder="e.g. 3"
                      className="h-9"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] text-[var(--text-faint)]">
            Optional context (non-judgmental)
          </Label>
          <Input
            value={healthProfile.lifestyleNotes ?? ""}
            maxLength={500}
            onChange={(e) => setHealthProfile({ lifestyleNotes: e.target.value })}
            placeholder="Anything that helps us understand your usual baseline"
            className="h-9"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
