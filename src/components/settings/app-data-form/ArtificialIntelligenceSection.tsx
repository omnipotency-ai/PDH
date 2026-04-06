import { KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getModelLabel, INSIGHT_MODEL_OPTIONS, type InsightModel } from "@/lib/aiModels";
import { APP_DATA_HEADING_CLASS, APP_DATA_SELECT_CLASS } from "./shared";

interface ArtificialIntelligenceSectionProps {
  openAiApiKey: string;
  aiModel: InsightModel;
  onApiKeyChange: (value: string) => void;
  onAiModelChange: (model: InsightModel) => void;
}

export function ArtificialIntelligenceSection({
  openAiApiKey,
  aiModel,
  onApiKeyChange,
  onAiModelChange,
}: ArtificialIntelligenceSectionProps) {
  return (
    <div
      data-slot="artificial-intelligence-section"
      className="space-y-3 rounded-xl border border-[var(--section-appdata-border)] bg-[var(--panel)] p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className={APP_DATA_HEADING_CLASS}>Artificial Intelligence</p>
        <span className="text-[11px] text-[var(--text-muted)]">
          Status:{" "}
          <span className={openAiApiKey ? "text-emerald-400" : "text-amber-300"}>
            {openAiApiKey ? "key configured" : "no key set"}
          </span>
        </span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="openai-api-key" className="text-xs font-medium text-[var(--text-muted)]">
          <KeyRound className="mr-1 inline h-3.5 w-3.5" />
          OPENAI_API_KEY
        </Label>
        <Input
          id="openai-api-key"
          type="password"
          value={openAiApiKey}
          maxLength={512}
          onChange={(event) => onApiKeyChange(event.target.value)}
          placeholder="sk-..."
          className="h-9"
        />
        <p className="text-[11px] text-[var(--text-muted)]">
          Your API key is stored securely on our servers and used to make requests on your behalf.
          You can delete it at any time.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] text-[var(--text-faint)]">Insights model</Label>
        <select
          className={APP_DATA_SELECT_CLASS}
          value={aiModel}
          onChange={(event) => {
            const match = INSIGHT_MODEL_OPTIONS.find((m) => m === event.target.value);
            if (match) onAiModelChange(match);
          }}
        >
          {INSIGHT_MODEL_OPTIONS.map((model) => (
            <option key={model} value={model}>
              {getModelLabel(model)}
              {model === INSIGHT_MODEL_OPTIONS[0] ? " (recommended)" : ""}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-[var(--text-faint)]">
          Background tasks always use GPT-5.4 Mini. This setting controls Dr. Poo and insight reports.
        </p>
      </div>
    </div>
  );
}
