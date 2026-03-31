import { MapPinned, SlidersHorizontal, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveShell } from "@/components/ui/responsive-shell";
import { cn } from "@/lib/utils";
import type { AiPreferences, DrPooPreset, OutputLength } from "@/types/domain";
import { DR_POO_PRESETS } from "@/types/domain";
import { LengthTabBar, PreviewTextBlock, PreviewTextField } from "./DrPooPreviewComponents";
import { SliderControl } from "./DrPooSliderControl";
import {
  ADVANCED_PREVIEW_MATRIX,
  APPROACH_LABELS,
  APPROACH_OPTIONS,
  LENGTH_LABELS,
  LENGTH_OPTIONS,
  PRESET_CARDS,
  REGISTER_LABELS,
  REGISTER_OPTIONS,
  STRUCTURE_LABELS,
  STRUCTURE_OPTIONS,
} from "./drPooPreviewData";

// ── Types ───────────────────────────────────────────────────────────────────

interface DrPooSectionProps {
  aiPreferences: AiPreferences;
  setAiPreferences: (updates: Partial<AiPreferences>) => void;
}

// ── Main component ──────────────────────────────────────────────────────────

export function DrPooSection({ aiPreferences, setAiPreferences }: DrPooSectionProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [previewPreset, setPreviewPreset] = useState<Exclude<DrPooPreset, "custom"> | null>(null);
  const [presetPreviewLength, setPresetPreviewLength] = useState<OutputLength>("standard");

  function applyPreset(presetName: Exclude<DrPooPreset, "custom">) {
    const values = DR_POO_PRESETS[presetName];
    setAiPreferences({ ...values, preset: presetName });
  }

  function setAxisValue(updates: Partial<AiPreferences>) {
    setAiPreferences({ ...updates, preset: "custom" });
  }

  const presetSummary = useMemo(() => {
    return PRESET_CARDS.find((preset) => preset.value === aiPreferences.preset)?.description ?? "";
  }, [aiPreferences.preset]);

  const advancedPreviewSet = useMemo(() => {
    return ADVANCED_PREVIEW_MATRIX[aiPreferences.approach][aiPreferences.register];
  }, [aiPreferences.approach, aiPreferences.register]);

  const advancedPreviewText = useMemo(() => {
    return advancedPreviewSet[aiPreferences.outputLength];
  }, [advancedPreviewSet, aiPreferences.outputLength]);

  const previewCard = useMemo(
    () => PRESET_CARDS.find((preset) => preset.value === previewPreset) ?? null,
    [previewPreset],
  );

  // When opening a preset preview, initialise the length tab to match that
  // preset's configured outputLength
  function openPresetPreview(presetValue: Exclude<DrPooPreset, "custom">) {
    const presetConfig = DR_POO_PRESETS[presetValue];
    setPresetPreviewLength(presetConfig.outputLength);
    setPreviewPreset(presetValue);
  }

  return (
    <div data-slot="dr-poo-section" className="space-y-2">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-400/80">
          AI Personalisation
        </p>
        <p className="text-[9px] text-[var(--text-faint)]">
          What should Dr. Poo call you? What&apos;s your closest city so we can adjust for your
          timezone?
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="relative">
          <Label htmlFor="dr-poo-preferred-name" className="sr-only">
            Preferred name
          </Label>
          <UserRound className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
          <Input
            id="dr-poo-preferred-name"
            value={aiPreferences.preferredName}
            maxLength={30}
            onChange={(event) => setAiPreferences({ preferredName: event.target.value })}
            placeholder="Your preferred name"
            className="h-9 pl-9"
          />
        </div>
        <div className="relative">
          <MapPinned className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
          <Input
            id="dr-poo-location"
            value={aiPreferences.locationTimezone}
            maxLength={30}
            onChange={(event) => setAiPreferences({ locationTimezone: event.target.value })}
            placeholder="Your location"
            className="h-9 pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs justify-center text-[var(--text)]/70">
          Choose Dr. Poo&apos;s Style and Communication
        </Label>

        <div className="grid gap-2 sm:grid-cols-2">
          {PRESET_CARDS.map((preset) => {
            const isSelected = aiPreferences.preset === preset.value;
            const Icon = preset.Icon;

            return (
              <div
                key={preset.value}
                className={cn(
                  "rounded-lg border bg-[var(--surface-2)] px-3 py-2 hover:bg-[var(--surface-1)]",
                  isSelected ? "border-sky-400/80" : "border-sky-400/25",
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-0)]">
                    <Icon className="h-3.5 w-3.5 text-sky-400/80" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text)]">{preset.label}</p>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                      {preset.description}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openPresetPreview(preset.value)}
                    className="text-xs text-sky-400/80 underline-offset-2 transition-colors hover:text-[var(--text)] hover:underline"
                  >
                    See preview
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset(preset.value)}
                    disabled={isSelected}
                    className="rounded-md border border-sky-400/25 px-2 py-0.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-sky-400/70 hover:text-[var(--text)] disabled:cursor-default disabled:opacity-50"
                  >
                    {isSelected ? "Selected" : "Select"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-[var(--text-faint)]">{presetSummary}</p>
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <div className="flex justify-end">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="text-[10px] text-sky-500 underline-offset-2 transition-colors hover:text-sky-400 hover:underline"
            >
              {advancedOpen ? "Hide advanced controls" : "Advanced controls"}
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="space-y-3 rounded-xl border border-sky-400/25 bg-[var(--surface-2)] p-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[var(--text)]">
              Fine-tune Dr. Poo&apos;s communication
            </p>
            <p className="text-[10px] text-[var(--text-faint)]">
              Use these sliders to control tone, language level, response structure, and detail.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <SliderControl
              label="Approach"
              value={aiPreferences.approach}
              options={APPROACH_OPTIONS}
              onChange={(value) => setAxisValue({ approach: value })}
            />

            <SliderControl
              label="Language level"
              value={aiPreferences.register}
              options={REGISTER_OPTIONS}
              onChange={(value) => setAxisValue({ register: value })}
            />

            <SliderControl
              label="Response structure"
              value={aiPreferences.outputFormat}
              options={STRUCTURE_OPTIONS}
              onChange={(value) => setAxisValue({ outputFormat: value })}
            />

            <SliderControl
              label="Detail level"
              value={aiPreferences.outputLength}
              options={LENGTH_OPTIONS}
              onChange={(value) => setAxisValue({ outputLength: value })}
            />
          </div>

          <div className="rounded-lg border border-sky-400/25 bg-[var(--surface-0)] p-2.5">
            <div className="mb-2 flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-sky-400/80" />
              <p className="text-[11px] font-semibold text-[var(--text)]">Generated preview</p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-medium text-[var(--text-muted)]">
                {advancedPreviewSet.heading} &middot; {STRUCTURE_LABELS[aiPreferences.outputFormat]}{" "}
                structure &middot; {LENGTH_LABELS[aiPreferences.outputLength]} length
              </p>

              <PreviewTextBlock preview={advancedPreviewText} />
            </div>
          </div>

          <div className="rounded-lg border border-sky-400/25 bg-[var(--surface-0)] p-2.5">
            <p className="mb-2 text-[11px] font-semibold text-[var(--text)]">Meal timing context</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-[var(--text-faint)]">Breakfast</Label>
                <Input
                  type="time"
                  value={aiPreferences.mealSchedule.breakfast}
                  onChange={(event) =>
                    setAiPreferences({
                      mealSchedule: {
                        ...aiPreferences.mealSchedule,
                        breakfast: event.target.value,
                      },
                    })
                  }
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-[var(--text-faint)]">Lunch</Label>
                <Input
                  type="time"
                  value={aiPreferences.mealSchedule.lunch}
                  onChange={(event) =>
                    setAiPreferences({
                      mealSchedule: {
                        ...aiPreferences.mealSchedule,
                        lunch: event.target.value,
                      },
                    })
                  }
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-[var(--text-faint)]">Dinner</Label>
                <Input
                  type="time"
                  value={aiPreferences.mealSchedule.dinner}
                  onChange={(event) =>
                    setAiPreferences({
                      mealSchedule: {
                        ...aiPreferences.mealSchedule,
                        dinner: event.target.value,
                      },
                    })
                  }
                  className="h-8"
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <ResponsiveShell
        open={previewCard !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewPreset(null);
        }}
        title={previewCard ? `${previewCard.label} preview` : "Style preview"}
        description="Sample report voice for this preset."
        bodyClassName="space-y-3 p-4"
        sheetContentClassName="sm:max-w-xl"
        dialogContentClassName="max-w-[680px]"
      >
        {previewCard ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                {APPROACH_LABELS[DR_POO_PRESETS[previewCard.value].approach]}
              </span>
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                {REGISTER_LABELS[DR_POO_PRESETS[previewCard.value].register]}
              </span>
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                {STRUCTURE_LABELS[DR_POO_PRESETS[previewCard.value].outputFormat]}
              </span>
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                {LENGTH_LABELS[presetPreviewLength]}
              </span>
            </div>

            <LengthTabBar value={presetPreviewLength} onChange={setPresetPreviewLength} />

            <div className="space-y-2">
              <div className="space-y-1 rounded-lg border border-sky-400/25 px-2.5 py-2">
                <p className="text-[11px] font-semibold text-[var(--text)]">Summary</p>
                <PreviewTextField text={previewCard.preview[presetPreviewLength].summary} />
              </div>

              <div className="space-y-1 rounded-lg border border-sky-400/25 px-2.5 py-2">
                <p className="text-[11px] font-semibold text-[var(--text)]">Suggestions</p>
                <PreviewTextField text={previewCard.preview[presetPreviewLength].suggestions} />
              </div>

              <div className="space-y-1 rounded-lg border border-sky-400/25 px-2.5 py-2">
                <p className="text-[11px] font-semibold text-[var(--text)]">Did you know</p>
                <PreviewTextField text={previewCard.preview[presetPreviewLength].didYouKnow} />
              </div>
            </div>

            <div className="border-t border-sky-400/25 pt-3">
              <button
                type="button"
                onClick={() => {
                  applyPreset(previewCard.value);
                  setPreviewPreset(null);
                }}
                className="rounded-md border border-sky-400/25 px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-sky-400/70 hover:text-[var(--text)]"
              >
                {aiPreferences.preset === previewCard.value ? "Selected" : "Select this style"}
              </button>
            </div>
          </>
        ) : null}
      </ResponsiveShell>
    </div>
  );
}
